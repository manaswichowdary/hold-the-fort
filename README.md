# 🌵 Hold the Fort

**Go on vacation. We'll hold the fort.**

Hold the Fort is a personal away agent. Before you leave, you drop quick notes about your work. While you're out, coworkers ask **Sage** (a saguaro cactus security guard) instead of messaging you on the beach. Sage answers from your notes with sources, reads live pages instead of guessing, locks anything private, and flags anything urgent. When you're back, you get a postcard of what happened, and every question you answer teaches Sage for next time.

## What it does

- **Answers for you:** coworkers ask, it answers from your notes and live pages, with sources
- **Interruption budget:** you allow N interruptions per trip. Coworkers make their case, the agent scores urgency, and a fixed rule decides if it reaches your phone
- **Deadline negotiator:** requests due while you're away get a real slot after you return, booked around your calendar
- **Coverage karma:** people who cover for you earn kudos, written publicly to Solana (devnet)
- **"Previously on…":** a narrated, TV style recap of your week when you're back
- **Private stays private:** privacy, urgency threshold, budget and dates are plain code, never a model

## How it works

| Part | Tech | Job |
|---|---|---|
| Web app | Next.js + TypeScript on AWS Amplify | Setup, chat, coverage board, phone view, recap |
| Agent | Node + TypeScript on Maritime | One sleeping agent per person, wakes when someone asks |
| Memory | supermemory | Learns your work, and learns again from every answer you give |
| Live checks | TinyFish | Reads live pages (like the team board) at question time |
| Reasoning | Gemini | Understands messages, scores urgency, writes replies and the recap |
| Kudos | Solana devnet | Public, permanent record of who covered for you |
| Data | MongoDB Atlas | Notes, questions, interruptions, deadlines, kudos |

## Run locally

1. Copy `.env.example` to `.env` in the repo root and fill in your keys.
2. Agent:
   ```
   cd agent
   npm install
   npm run seed -- --history
   npm run dev
   ```
3. Web app (new terminal tab):
   ```
   cd web
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

Optional Solana kudos: `cd agent && npm run wallet`, fund the address at faucet.solana.com (Devnet), and add `SOLANA_SECRET` to `.env`.

## Custom mascot

Put PNGs in `web/public/mascot/` named `idle`, `thinking`, `working`, `success`, `locked`, `urgent`, `sleeping`, `narrating`. Missing poses fall back to `idle.png`, then the built in placeholder.

## Agent API (Maritime contract)

- `GET /health`
- `POST /chat` with `{ "message": "...", "asker": "Name" }`


## Phone push, voice and the Shield interview

- **Phone push:** install the free ntfy app, subscribe to a long random topic, put it in `.env` as `NTFY_TOPIC`. Test with `curl -X POST localhost:8787/notify/test`.
- **Vacation Shield interview:** Sage asks up to 3 questions. The model fills a checklist, and plain code decides (score of 8 or more, real harm before return, backup cannot handle it, pass available). Tests: `cd agent && npm test`.
- **Voice:** tap the mic on the ask page. Turn on "Voice on" and Sage talks back and listens for your answers. Chrome or Safari.
- **Calendar invite:** accepting a new deadline gives an .ics file.
