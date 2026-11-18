import "server-only";

const DEFAULT_BUCKET = "chat-attachments";
const SIGNED_URL_SECONDS = 60 * 60;

function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = process.env.SUPABASE_CHAT_BUCKET || DEFAULT_BUCKET;
  if (!url || !key) {
    throw new ChatStorageError("Chat file storage is not configured on the server.", 503);
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/i.test(bucket)) {
    throw new ChatStorageError("Chat file storage bucket configuration is invalid.", 500);
  }
  return { url, key, bucket };
}

function objectUrl(url: string, bucket: string, path: string) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${safePath}`;
}

function headers(key: string) {
  return { apikey: key, authorization: `Bearer ${key}` };
}

export function chatFilePath(userId: string, conversationId: string, fileId: string, filename: string) {
  const candidate = filename.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180);
  const safeFilename = candidate === "." || candidate === ".." ? "attachment" : candidate || "attachment";
  return `${userId}/${conversationId}/${fileId}/${safeFilename}`;
}

export async function uploadChatFile(path: string, bytes: Uint8Array, mimeType: string) {
  const { url, key, bucket } = configuration();
  const response = await fetch(objectUrl(url, bucket, path), {
    method: "POST",
    headers: { ...headers(key), "content-type": mimeType, "x-upsert": "false" },
    body: bytes as BodyInit,
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new ChatStorageError(`The private "${bucket}" bucket must exist in Supabase Storage.`, 503);
    }
    throw new ChatStorageError("A chat attachment could not be stored.", 502);
  }
}

export async function downloadChatFile(path: string) {
  const { url, key, bucket } = configuration();
  const response = await fetch(objectUrl(url, bucket, path), {
    headers: headers(key),
    cache: "no-store",
  });
  if (!response.ok) throw new ChatStorageError("A saved chat attachment could not be loaded.", 502);
  return new Uint8Array(await response.arrayBuffer());
}

export async function signedChatFileUrl(path: string) {
  const { url, key, bucket } = configuration();
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${safePath}`, {
    method: "POST",
    headers: { ...headers(key), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS }),
    cache: "no-store",
  });
  if (!response.ok) throw new ChatStorageError("A saved chat attachment could not be opened.", 502);
  const payload = await response.json() as { signedURL?: string; signedUrl?: string };
  const signedUrl = payload.signedURL ?? payload.signedUrl;
  if (typeof signedUrl !== "string") throw new ChatStorageError("Storage returned an invalid signed URL.", 502);
  if (signedUrl.startsWith("http")) return signedUrl;
  return signedUrl.startsWith("/storage/v1/")
    ? `${url}${signedUrl}`
    : `${url}/storage/v1${signedUrl}`;
}

export async function removeChatFiles(paths: string[]) {
  if (!paths.length) return;
  const { url, key, bucket } = configuration();
  const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: "DELETE",
    headers: { ...headers(key), "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
    cache: "no-store",
  });
  if (!response.ok) throw new ChatStorageError("An unused chat attachment could not be removed.", 502);
}

export class ChatStorageError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
