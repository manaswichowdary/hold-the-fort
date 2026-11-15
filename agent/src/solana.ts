// Coverage karma: every time a coworker covers for you, a public kudos record
// is written to Solana (devnet) as a memo, so the invisible work becomes visible.
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { cfg } from "./config.js";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function loadKeypair(): Keypair | null {
  const raw = cfg.solanaSecret.trim();
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  } catch {
    return null;
  }
}

export function solanaEnabled() {
  return Boolean(loadKeypair());
}

export function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export async function walletInfo() {
  const kp = loadKeypair();
  if (!kp) return { enabled: false as const };
  const conn = new Connection(cfg.solanaRpc, "confirmed");
  const lamports = await conn.getBalance(kp.publicKey).catch(() => -1);
  return {
    enabled: true as const,
    address: kp.publicKey.toBase58(),
    sol: lamports >= 0 ? lamports / LAMPORTS_PER_SOL : null,
    explorer: `https://explorer.solana.com/address/${kp.publicKey.toBase58()}?cluster=devnet`,
  };
}

export async function writeKudos(memo: string): Promise<{ ok: boolean; signature?: string; error?: string }> {
  const kp = loadKeypair();
  if (!kp) return { ok: false, error: "no wallet configured" };
  try {
    const conn = new Connection(cfg.solanaRpc, "confirmed");
    const tx = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM,
        data: Buffer.from(memo.slice(0, 500), "utf8"),
      })
    );
    const signature = await Promise.race([
      sendAndConfirmTransaction(conn, tx, [kp]),
      new Promise<string>((_, rej) => setTimeout(() => rej(new Error("Solana timed out")), 25000)),
    ]);
    return { ok: true, signature };
  } catch (e: any) {
    return { ok: false, error: String(e.message || e).slice(0, 200) };
  }
}
