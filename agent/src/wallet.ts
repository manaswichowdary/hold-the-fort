// One time setup for coverage karma: creates a Solana devnet wallet for the fort.
// Run: npm run wallet
import { Keypair } from "@solana/web3.js";

const kp = Keypair.generate();
console.log("\n🌵 New fort wallet (Solana devnet, test money only)\n");
console.log("Address (paste into faucet.solana.com, choose Devnet):");
console.log(kp.publicKey.toBase58());
console.log("\nAdd this line to your .env (keep it secret):");
console.log(`SOLANA_SECRET=${JSON.stringify(Array.from(kp.secretKey))}`);
console.log("");
