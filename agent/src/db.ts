import { MongoClient, Db, ObjectId } from "mongodb";
import { cfg } from "./config.js";

export type Owner = {
  ownerId: string;
  name: string;
  role: string;
  awayUntil: string; // friendly text, e.g. "Monday, Nov 24"
  returnDate: string; // ISO date, e.g. "2026-11-24"
  backup: string;
  interruptBudget: number; // how many times coworkers may interrupt the vacation
};

export type Note = {
  _id?: ObjectId;
  ownerId: string;
  title: string;
  content: string;
  shareable: boolean;
  updatedAt: Date;
};

export type Watch = {
  _id?: ObjectId;
  ownerId: string;
  label: string;
  url: string;
  keywords: string[];
};

export type Source = {
  kind: "note" | "learned" | "live";
  title: string;
  detail?: string;
  url?: string;
  date?: string;
};

export type Step = { icon: string; label: string };

export type Status = "answered" | "escalated" | "urgent" | "private" | "case_needed" | "deadline";

export type Proposal = { task: string; requestedDue?: string | null; proposed: string; proposedLabel: string };

export type Question = {
  _id?: ObjectId;
  ownerId: string;
  asker: string;
  question: string;
  reply: string;
  status: Status;
  reason?: string;
  sources: Source[];
  trace: Step[];
  proposal?: Proposal;
  conflict?: string;
  fyi?: string; // handled, but worth telling the owner when back
  resolved: boolean;
  ownerAnswer?: string;
  coveredBy?: string;
  createdAt: Date;
  ms: number;
};

export type Interruption = {
  _id?: ObjectId;
  ownerId: string;
  questionId: string;
  asker: string;
  question: string;
  caseText: string;
  score: number;
  verdict: "interrupted" | "break_glass" | "declined" | "no_tokens";
  reasoning: string;
  acknowledged: boolean;
  createdAt: Date;
};

export type Commitment = {
  _id?: ObjectId;
  ownerId: string;
  task: string;
  requestedBy: string;
  requestedDue?: string | null;
  due: string; // ISO datetime
  dueLabel: string;
  createdAt: Date;
};

export type Kudos = {
  _id?: ObjectId;
  ownerId: string;
  helper: string;
  what: string;
  itemId?: string;
  signature?: string;
  chain: "pending" | "confirmed" | "failed" | "off";
  chainError?: string;
  createdAt: Date;
};

export type BoardItem = {
  _id?: ObjectId;
  task: string;
  owner: string;
  status: string;
  updatedAt: Date;
};

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!cfg.mongoUri) throw new Error("MONGODB_URI is missing");
  client = new MongoClient(cfg.mongoUri);
  await client.connect();
  db = client.db("holdthefort");
  return db;
}

export async function cols() {
  const d = await getDb();
  return {
    owners: d.collection<Owner>("owners"),
    notes: d.collection<Note>("notes"),
    watches: d.collection<Watch>("watches"),
    questions: d.collection<Question>("questions"),
    interruptions: d.collection<Interruption>("interruptions"),
    commitments: d.collection<Commitment>("commitments"),
    kudos: d.collection<Kudos>("kudos"),
    board: d.collection<BoardItem>("board"),
  };
}

export async function closeDb() {
  await client?.close();
  client = null;
  db = null;
}

export { ObjectId };
