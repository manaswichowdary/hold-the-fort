import dotenv from "dotenv";

// Works whether you run from /agent or from the repo root
dotenv.config({ path: [".env", "../.env"] });

export const cfg = {
  port: Number(process.env.PORT || 8787),
  agentName: process.env.AGENT_NAME || "Sage",
  geminiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  geminiFallbacks: (process.env.GEMINI_FALLBACK_MODELS ||
    "gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI || "",
  supermemoryKey: process.env.SUPERMEMORY_API_KEY || "",
  tinyfishKey: process.env.TINYFISH_API_KEY || "",
  solanaSecret: process.env.SOLANA_SECRET || "",
  solanaRpc: process.env.SOLANA_RPC || "https://api.devnet.solana.com",
  defaultOwner: process.env.DEFAULT_OWNER_ID || "manaswi",
  boardUrl: process.env.PUBLIC_BOARD_URL || "",
  ntfyTopic: process.env.NTFY_TOPIC || "",
  ntfyServer: (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, ""),
  publicUrl: process.env.PUBLIC_APP_URL || "",
  // Shared secret between the website proxy and the agent. Set it in production.
  agentAuth: process.env.AGENT_AUTH || "",
  // Sage's spoken voice (Gemini speech models, fastest first)
  ttsModels: (process.env.GEMINI_TTS_MODELS || "gemini-3.8-flash-lite-tts,gemini-3.8-flash-tts,gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  ttsVoice: process.env.GEMINI_TTS_VOICE || "Sulafat",
  // Amazon Polly voice (used when AWS keys are set): Tiffany on the generative engine
  pollyVoice: process.env.POLLY_VOICE || "Tiffany",
  pollyEngine: process.env.POLLY_ENGINE || "generative",
  awsRegion: process.env.AWS_REGION || "us-east-1",
};

export function missingKeys(): string[] {
  const missing: string[] = [];
  if (!cfg.geminiKey) missing.push("GEMINI_API_KEY");
  if (!cfg.mongoUri) missing.push("MONGODB_URI");
  if (!cfg.supermemoryKey) missing.push("SUPERMEMORY_API_KEY");
  if (!cfg.tinyfishKey) missing.push("TINYFISH_API_KEY");
  return missing;
}
