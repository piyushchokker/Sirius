import uuid
import json
import io
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Security, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep
from app.core.config import settings
from app.core.security import decode_web_bridge_token
from app.models.chat import Conversation, Message, MessageRole
from app.services.ai_service import AIService

router = APIRouter()
ai_service = AIService()
bridge_bearer = HTTPBearer(auto_error=False)


class GenerateRequest(BaseModel):
    messages: list[dict] = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    temperature: float = Field(default=0.7, ge=0, le=2)
    service_tier: str | None = None
    reasoning_effort: str | None = None


async def require_web_bridge(credentials: HTTPAuthorizationCredentials | None = Security(bridge_bearer)) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_web_bridge_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid web bridge token") from exc
    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="Invalid web bridge subject")
    return user_id


@router.post("/generate")
async def generate_chat(body: GenerateRequest, _user_id: str = Depends(require_web_bridge)):
    """Generation-only endpoint for the Next.js chat BFF; persistence stays in the web app."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OpenAI is not configured")

    messages = []
    for message in body.messages:
        role = message.get("role")
        content = message.get("content")
        if role not in {"user", "assistant", "system"}:
            raise HTTPException(status_code=400, detail="Unsupported message role")
        if isinstance(content, str):
            messages.append({"role": role, "content": content})
            continue
        if not isinstance(content, list):
            raise HTTPException(status_code=400, detail="Invalid message content")
        parts = []
        for part in content:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "text" and isinstance(part.get("text"), str):
                parts.append({"type": "text", "text": part["text"]})
            elif part.get("type") == "image_url" and isinstance(part.get("image_url"), dict):
                parts.append(part)
            elif part.get("type") == "file_url" and isinstance(part.get("url"), str):
                file_url = part["url"]
                if not settings.SUPABASE_URL or not file_url.startswith(settings.SUPABASE_URL.rstrip("/") + "/storage/v1/"):
                    raise HTTPException(status_code=400, detail="Unsupported file URL")
                media_type = part.get("media_type", "")
                if isinstance(media_type, str) and media_type.startswith("image/"):
                    if media_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
                        raise HTTPException(status_code=415, detail="Unsupported image type")
                    parts.append({"type": "image_url", "image_url": {"url": file_url}})
                    continue
                try:
                    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
                        response = await client.get(file_url)
                    response.raise_for_status()
                    reader = PdfReader(io.BytesIO(response.content))
                    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
                except Exception as exc:
                    raise HTTPException(status_code=422, detail="Could not read attached PDF") from exc
                parts.append({"type": "text", "text": f"\n\n[PDF: {part.get('filename', 'attachment')}]\n{extracted[:100000]}"})
        messages.append({"role": role, "content": parts})

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for chunk in ai_service.stream_chat(
                messages=messages,
                model=body.model,
                provider="openai",
                temperature=body.temperature,
                max_tokens=4096,
                service_tier=body.service_tier,
                reasoning_effort=body.reasoning_effort,
            ):
                yield f"data: {json.dumps(chunk, separators=(',', ':'))}\n\n"
            yield "data: [DONE]\n\n"
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'error': 'Model generation failed'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    conversation_id: str | None = None
    message: str
    model: str = "gpt-4o-mini"
    provider: str = "openai"
    system_prompt: str | None = None
    temperature: float | None = 0.7
    max_tokens: int | None = None
    attachment_ids: list[str] = []


class ConversationCreate(BaseModel):
    title: str = "New Conversation"
    model: str = "gpt-4o-mini"
    provider: str = "openai"
    system_prompt: str | None = None


# ─── Conversations ────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    current_user: CurrentUser,
    db: DbDep,
    page: int = 1,
    page_size: int = 20,
    archived: bool = False,
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.user_id == current_user.id,
            Conversation.is_archived == archived,
        )
        .order_by(desc(Conversation.updated_at))
        .offset(offset)
        .limit(page_size)
    )
    conversations = result.scalars().all()
    return {"data": conversations, "page": page, "page_size": page_size}


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate, current_user: CurrentUser, db: DbDep
):
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title=body.title,
        model=body.model,
        provider=body.provider,
        system_prompt=body.system_prompt,
    )
    db.add(conv)
    await db.flush()
    return conv


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str, current_user: CurrentUser, db: DbDep
):
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str, current_user: CurrentUser, db: DbDep
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await db.delete(conv)


# ─── Streaming chat ───────────────────────────────────────────────────────────

@router.post("/completions")
async def chat_completion(body: ChatRequest, current_user: CurrentUser, db: DbDep):
    # Get or create conversation
    if body.conversation_id:
        result = await db.execute(
            select(Conversation)
            .where(
                Conversation.id == body.conversation_id,
                Conversation.user_id == current_user.id,
            )
            .options(selectinload(Conversation.messages))
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            model=body.model,
            provider=body.provider,
            system_prompt=body.system_prompt,
        )
        db.add(conv)
        await db.flush()

    # Save user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv.id,
        user_id=current_user.id,
        role=MessageRole.USER,
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Build message history
    history = [
        {"role": m.role.value.lower(), "content": m.content}
        for m in (conv.messages if hasattr(conv, "messages") and conv.messages else [])
        if m.id != user_msg.id
    ]
    history.append({"role": "user", "content": body.message})

    async def stream_generator() -> AsyncGenerator[str, None]:
        full_content = ""
        prompt_tokens = 0
        completion_tokens = 0

        async for chunk in ai_service.stream_chat(
            messages=history,
            model=body.model,
            provider=body.provider,
            system_prompt=body.system_prompt or conv.system_prompt,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        ):
            if chunk["type"] == "content":
                full_content += chunk.get("content", "")
                yield f"data: {chunk['content']}\n\n"
            elif chunk["type"] == "done":
                prompt_tokens = chunk.get("usage", {}).get("prompt_tokens", 0)
                completion_tokens = chunk.get("usage", {}).get("completion_tokens", 0)

        # Persist assistant message
        assistant_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            role=MessageRole.ASSISTANT,
            content=full_content,
            model=body.model,
            provider=body.provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        )
        db.add(assistant_msg)

        # Update conversation token count
        conv.total_tokens += prompt_tokens + completion_tokens
        current_user.tokens_used += prompt_tokens + completion_tokens

        # Auto-title if first message
        if conv.title == "New Conversation" and body.message:
            conv.title = body.message[:50]

        await db.commit()
        yield f"data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Conversation-ID": conv.id,
        },
    )
