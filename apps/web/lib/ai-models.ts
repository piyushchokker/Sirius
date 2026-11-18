export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

// The AI SDK's OpenAI provider names the API's fast processing tier "priority".
export const OPENAI_FAST_SERVICE_TIER = "priority" as const;

export const AGENT_MODELS = [
  { value: "gpt-6-luna", label: "GPT-6 Luna · Fast" },
  { value: "gpt-6-sol", label: "GPT-6 Sol" },
  { value: "gpt-4.1", label: "GPT-4.1" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
] as const;

