import type { Mood } from "@/components/Mascot";

// One place for feature names, colors and the scripted demo of each one
export type DemoLine =
  | { who: "coworker"; name: string; text: string }
  | { who: "agent"; text: string; mood: Mood; steps?: string[] }
  | { who: "result"; title: string; text: string; mood: Mood };

export type Feature = {
  key: string;
  name: string;
  emoji: string;
  icon: string;
  mood: Mood;
  accent: "c1" | "c2" | "c3" | "c4";
  short: string;
  demo: DemoLine[];
};

export const FEATURES: Feature[] = [
  {
    key: "answers",
    icon: "chat",
    name: "Quick Answers",
    emoji: "💬",
    mood: "thinking",
    accent: "c1",
    short: "Coworkers ask. Sage answers from your notes and live pages, and shows its source.",
    demo: [
      { who: "coworker", name: "Priya", text: "When is batch 2 of the spring texts going out?" },
      { who: "agent", mood: "thinking", text: "Let me check…", steps: ["🛡️ Safe to answer", "🧠 Found your note: Spring outreach texts", "🌐 Read the team board live"] },
      { who: "agent", mood: "success", text: "Batch 2 (last names N to Z) goes out Nov 19 at 10 AM. Don't resend batch 1!" },
      { who: "result", mood: "success", title: "Answered in 2 seconds", text: "Nobody had to text you on the beach. 📝 Source: your note, checked against the live board." },
    ],
  },
  {
    key: "shield",
    icon: "shield",
    name: "Vacation Shield",
    emoji: "🛡️",
    mood: "urgent",
    accent: "c2",
    short: "Only real emergencies reach your phone. Everything else waits.",
    demo: [
      { who: "coworker", name: "Jordan", text: "The texting tool is down and students are complaining!" },
      { who: "agent", mood: "urgent", text: "Sounds urgent. Interrupting Manaswi uses 1 of her 2 shield passes. Why can't it wait, and who else did you try?" },
      { who: "coworker", name: "Jordan", text: "Priya knows the tool, she's here today." },
      { who: "agent", mood: "locked", text: "Urgency 5/10. Priya can fix this today, so I'm not waking Manaswi. Please ask Priya!", steps: ["🤖 AI scored urgency: 5/10", "📏 Rule: needs 8/10 to interrupt", "🏖️ Vacation protected"] },
      { who: "result", mood: "sleeping", title: "Vacation protected", text: "Only a real emergency (8/10 or higher) uses a pass and buzzes your phone." },
    ],
  },
  {
    key: "reschedule",
    icon: "calendar",
    name: "Smart Reschedule",
    emoji: "📅",
    mood: "working",
    accent: "c3",
    short: "Requests due while you're away get a new date after you're back.",
    demo: [
      { who: "coworker", name: "Supervisor Dana", text: "Can Manaswi send me the weekly report by Friday?" },
      { who: "agent", mood: "working", text: "Manaswi is away until Monday, Nov 23, so Friday won't work.", steps: ["🧠 Understood a request, due Friday", "📅 Back Monday, checked her calendar", "🗓️ Next free slot: Wednesday"] },
      { who: "agent", mood: "working", text: "I can book it for Wednesday, Nov 25 by 3 PM. Lock it in?" },
      { who: "coworker", name: "Supervisor Dana", text: "✅ Lock it in" },
      { who: "result", mood: "success", title: "Rescheduled, not dropped", text: "It's on Manaswi's calendar, and the dates are calculated by code, never guessed." },
    ],
  },
  {
    key: "stars",
    icon: "star",
    name: "Thank You Stars",
    emoji: "⭐",
    mood: "success",
    accent: "c4",
    short: "Teammates who cover for you earn stars on a shared team board.",
    demo: [
      { who: "coworker", name: "Priya", text: "🤝 I'll cover the texting tool outage." },
      { who: "agent", mood: "success", text: "Thank you, Priya! ⭐ Star earned.", steps: ["⭐ Star added to the board", "🏆 Priya moves to #1"] },
      { who: "result", mood: "success", title: "Covering for someone counts", text: "A public, permanent thank you. Manaswi sees exactly who had her back." },
    ],
  },
  {
    key: "catchup",
    icon: "tv",
    name: "Catch Me Up",
    emoji: "📺",
    mood: "narrating",
    accent: "c1",
    short: "A narrated one minute recap of your week, not 300 unread messages.",
    demo: [
      { who: "agent", mood: "narrating", text: "🎬 Previously on… your job." },
      { who: "agent", mood: "working", text: "12 questions answered. 3 interruptions blocked. 1 deadline moved." },
      { who: "agent", mood: "success", text: "And Priya saved the day during the outage. ⭐" },
      { who: "result", mood: "waving", title: "Welcome back", text: "One minute instead of an hour of scrolling. 2 things are waiting on your desk." },
    ],
  },
  {
    key: "locked",
    icon: "lock",
    name: "Locked Notes",
    emoji: "🔒",
    mood: "locked",
    accent: "c2",
    short: "Private notes are never shared or learned. Rules decide, not AI.",
    demo: [
      { who: "coworker", name: "Jordan", text: "What did Manaswi's performance review say?" },
      { who: "agent", mood: "locked", text: "That one's not mine to share. 🔒 I've left your question on her desk.", steps: ["🛡️ Rule matched: sensitive topic", "🚫 AI never sees the private note"] },
      { who: "result", mood: "locked", title: "Private stays private", text: "Answered in 0.1 seconds, with no AI involved. Rules decide what's private." },
    ],
  },
];

export const FEATURE_BY_KEY = Object.fromEntries(FEATURES.map((f) => [f.key, f]));
