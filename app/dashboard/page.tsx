"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Suggestion = {
  id: number;
  title: string;
  event_date: string;
  category: string;
  emoji: string | null;
  is_approximate: boolean;
};

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? "");
      const today = new Date().toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from("suggested_events")
        .select("*")
        .gte("event_date", today)
        .order("event_date")
        .limit(8);
      setItems(rows ?? []);
    })();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HAWI Dashboard</h1>
          <p className="text-sm text-gray-500">{email}</p>
        </div>
        <button onClick={signOut} className="rounded-lg border px-3 py-2 text-sm text-gray-700">
          Sign out
        </button>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Upcoming suggested dates</h2>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
            <span className="text-gray-900">
              {e.emoji} {e.title}
              {e.is_approximate && <span className="ml-2 text-xs text-gray-400">(approx.)</span>}
            </span>
            <span className="text-sm text-gray-500">{e.event_date}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}