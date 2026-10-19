import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generatePost } from "@/lib/ai";

export const maxDuration = 60;

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const range = (lead: number) => {
  const now = new Date();
  return { from: ymd(now), to: ymd(new Date(now.getTime() + lead * 86400000)) };
};

type Result = { made: number; pending: number; error?: string };

// Creates text drafts for calendar dates that have no draft yet.
async function draftFor(db: SupabaseClient, userId: string, lead: number, budget: { left: number }): Promise<Result> {
  const { from, to } = range(lead);
  const ev = await db
    .from("calendar_events")
    .select("id,title,event_date,notes")
    .eq("user_id", userId)
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date");
  if (ev.error) throw new Error(ev.error.message);
  const events = ev.data ?? [];
  if (!events.length) return { made: 0, pending: 0 };

  const ex = await db.from("posts").select("event_id").eq("user_id", userId).in("event_id", events.map((e) => e.id));
  if (ex.error) throw new Error(ex.error.message);
  const done = new Set((ex.data ?? []).map((p) => p.event_id));
  const todo = events.filter((e) => !done.has(e.id));
  const { data: brand } = await db.from("brand_profiles").select("*").eq("user_id", userId).maybeSingle();

  let made = 0;
  let error: string | undefined;
  for (const e of todo) {
    if (budget.left <= 0) break;
    budget.left--;
    try {
      const t = await generatePost({
        action: "generate",
        brand: brand ?? {},
        postLang: brand?.post_lang || "en",
        captionLang: brand?.caption_lang || "en",
        title: e.title,
        date: e.event_date,
        notes: e.notes,
      });
      const ins = await db.from("posts").insert({
        user_id: userId,
        event_id: e.id,
        caption: t.caption,
        hashtags: t.hashtags,
        overlay_text: t.post_text,
        text_position: "center",
        status: "draft",
        auto_generated: true,
      });
      if (ins.error) throw new Error(ins.error.message);
      made++;
    } catch (err) {
      error = err instanceof Error ? err.message : "Draft failed";
    }
  }
  return { made, pending: todo.length, error };
}

// Daily cron (Vercel calls this with the CRON_SECRET)
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = admin();
    const lead = Number(process.env.AUTO_LEAD_DAYS || 3);
    const { from, to } = range(lead);
    const { data } = await db.from("calendar_events").select("user_id").gte("event_date", from).lte("event_date", to);
    const users = Array.from(new Set((data ?? []).map((r) => r.user_id as string)));
    const budget = { left: 8 };
    let drafts = 0;
    const errors: string[] = [];
    for (const u of users) {
      const r = await draftFor(db, u, lead, budget);
      drafts += r.made;
      if (r.error) errors.push(r.error);
    }
    return NextResponse.json({ users: users.length, drafts, errors });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Cron failed" }, { status: 500 });
  }
}

// "Auto-draft" button: same job, only for the logged-in user
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is missing" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const lead = Math.min(Number(body.lead) || 30, 60);
  try {
    const r = await draftFor(admin(), u.user.id, lead, { left: 5 });
    return NextResponse.json({ drafts: r.made, pending: r.pending, error: r.error });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Auto-draft failed" }, { status: 500 });
  }
}