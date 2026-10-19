import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePost, type AiRequest } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  try {
    return NextResponse.json(await generatePost((await req.json()) as AiRequest));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI error" }, { status: 502 });
  }
}