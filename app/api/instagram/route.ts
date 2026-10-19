import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const GRAPH = `https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION || "v25.0"}`;

async function ig(path: string, params: Record<string, string>, method: "GET" | "POST") {
  const body = new URLSearchParams({ ...params, access_token: process.env.INSTAGRAM_ACCESS_TOKEN! });
  const r =
    method === "GET"
      ? await fetch(`${GRAPH}${path}?${body}`)
      : await fetch(`${GRAPH}${path}`, {
          method,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Instagram error ${r.status}`);
  return j;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return fail("Not logged in", 401);
  const igId = process.env.INSTAGRAM_USER_ID;
  if (!igId || !process.env.INSTAGRAM_ACCESS_TOKEN) return fail("Instagram is not connected yet (missing token or user id in Vercel).", 500);

  // act as the logged-in user so row-level security checks ownership
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return fail("Not logged in", 401);

  const { postId } = await req.json();
  const { data: post } = await sb.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post) return fail("Post not found", 404);
  if (post.instagram_post_id) return fail("This post is already live on Instagram.", 409);
  if (post.status !== "approved") return fail("Approve the post first.", 400);
  if (!post.image_url) return fail("This post has no image.", 400);

  try {
    const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n").slice(0, 2200);
    const container = await ig(`/${igId}/media`, { image_url: post.image_url, ...(caption ? { caption } : {}) }, "POST");

    let ready = false;
    for (let i = 0; i < 15; i++) {
      const s = await ig(`/${container.id}`, { fields: "status_code" }, "GET");
      if (s.status_code === "FINISHED") {
        ready = true;
        break;
      }
      if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error("Instagram could not process the image.");
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!ready) throw new Error("Instagram is still processing the image. Try again in a minute.");

    const pub = await ig(`/${igId}/media_publish`, { creation_id: container.id }, "POST");
    let permalink: string | null = null;
    try {
      const m = await ig(`/${pub.id}`, { fields: "permalink" }, "GET");
      permalink = m.permalink ?? null;
    } catch {
      // the link is nice to have, not required
    }
    await sb.from("posts").update({ status: "posted", instagram_post_id: pub.id, instagram_permalink: permalink }).eq("id", postId);
    return NextResponse.json({ id: pub.id, permalink });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Instagram error", 502);
  }
}