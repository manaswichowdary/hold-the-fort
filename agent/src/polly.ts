// Sage's voice through Amazon Polly. Gemini writes the reply, Polly speaks it.
// Polly streams raw audio, so Sage starts talking a fraction of a second after the reply.
// Credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION (read by the AWS SDK).
import { PollyClient, SynthesizeSpeechCommand, type Engine, type VoiceId } from "@aws-sdk/client-polly";
import { cfg } from "./config.js";

let client: PollyClient | null = null;
function polly() {
  if (!client) client = new PollyClient({ region: cfg.awsRegion });
  return client;
}

export function pollyEnabled() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

// Polly returns 16 bit mono PCM at this rate
export const POLLY_RATE = 16000;

// Streams one line. Calls onPcm with each audio piece as it arrives.
export async function pollyStream(text: string, onPcm: (pcm: Buffer) => void): Promise<void> {
  const out = await polly().send(
    new SynthesizeSpeechCommand({
      Text: text,
      VoiceId: cfg.pollyVoice as VoiceId,
      Engine: cfg.pollyEngine as Engine,
      OutputFormat: "pcm",
      SampleRate: String(POLLY_RATE),
      TextType: "text",
    })
  );
  const stream = out.AudioStream as unknown as AsyncIterable<Uint8Array> | undefined;
  if (!stream) throw new Error("Polly sent no audio");
  for await (const chunk of stream) onPcm(Buffer.from(chunk));
}
