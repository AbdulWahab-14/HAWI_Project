"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg } from "@fullcalendar/core";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/useUser";
import Nav from "@/components/Nav";

type MyEvent = { id: string; title: string; event_date: string; notes: string | null; source: string };
type Suggestion = { id: number; title: string; event_date: string; category: string; emoji: string | null; is_approximate: boolean };
type Modal =
  | { kind: "new"; date: string }
  | { kind: "mine"; ev: MyEvent }
  | { kind: "suggest"; s: Suggestion }
  | null;

const iso = (d: Date) => d.toLocaleDateString("en-CA");

function daysFrom(today: string, date: string) {
  const n = Math.round((new Date(date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
}

export default function CalendarPage() {
  const user = useUser();
  const [mine, setMine] = useState<MyEvent[]>([]);
  const [sugg, setSugg] = useState<Suggestion[]>([]);
  const [view, setView] = useState<"month" | "list">("month");
  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("calendar_events").select("*").order("event_date"),
      supabase.from("suggested_events").select("*").order("event_date"),
    ]);
    setMine(a.data ?? []);
    setSugg(b.data ?? []);
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // suggestions the owner has not added yet
  const freeSugg = useMemo(() => {
    const taken = new Set(mine.map((m) => m.title + "|" + m.event_date));
    return sugg.filter((s) => !taken.has(s.title + "|" + s.event_date));
  }, [mine, sugg]);

  const calEvents = useMemo(
    () => [
      ...mine.map((e) => ({
        id: "m-" + e.id,
        title: e.title,
        start: e.event_date,
        allDay: true,
        backgroundColor: "#2563eb",
        borderColor: "#2563eb",
        textColor: "#ffffff",
        extendedProps: { kind: "mine", ref: e.id },
      })),
      ...freeSugg.map((s) => ({
        id: "s-" + s.id,
        title: `${s.emoji ?? ""} ${s.title}`,
        start: s.event_date,
        allDay: true,
        backgroundColor: "#fef3c7",
        borderColor: "#fcd34d",
        textColor: "#92400e",
        extendedProps: { kind: "suggest", ref: String(s.id) },
      })),
    ],
    [mine, freeSugg]
  );

    const [today, setToday] = useState("");
  useEffect(() => {
    setToday(iso(new Date()));
  }, []);
    const upcoming = useMemo(() => {
    if (!today) return [];
    const end = new Date(today + "T00:00:00");
    end.setDate(end.getDate() + 30);
    const endStr = iso(end);
    const items = [
      ...mine.map((e) => ({ key: "m" + e.id, date: e.event_date, title: e.title, emoji: "📌", mine: true, modal: { kind: "mine", ev: e } as Modal })),
      ...freeSugg.map((s) => ({ key: "s" + s.id, date: s.event_date, title: s.title, emoji: s.emoji ?? "📅", mine: false, modal: { kind: "suggest", s } as Modal })),
    ];
    return items.filter((i) => i.date >= today && i.date <= endStr).sort((a, b) => a.date.localeCompare(b.date));
  }, [mine, freeSugg, today]);

  function openNew(d: string) {
    setTitle("");
    setNotes("");
    setDate(d);
    setModal({ kind: "new", date: d });
  }

  function onEventClick(info: EventClickArg) {
    const { kind, ref } = info.event.extendedProps as { kind: string; ref: string };
    if (kind === "mine") {
      const ev = mine.find((m) => m.id === ref);
      if (ev) setModal({ kind: "mine", ev });
    } else {
      const s = sugg.find((x) => String(x.id) === ref);
      if (s) setModal({ kind: "suggest", s });
    }
  }

  async function saveNew() {
    if (!user || !title.trim() || !date) return;
    setBusy(true);
    await supabase.from("calendar_events").insert({ user_id: user.id, title: title.trim(), event_date: date, notes: notes || null, source: "manual" });
    setBusy(false);
    setModal(null);
    load();
  }

  async function addSuggestion(s: Suggestion) {
    if (!user) return;
    setBusy(true);
    await supabase.from("calendar_events").insert({ user_id: user.id, title: s.title, event_date: s.event_date, source: "suggested" });
    setBusy(false);
    setModal(null);
    load();
  }

  async function remove(id: string) {
    await supabase.from("calendar_events").delete().eq("id", id);
    setModal(null);
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Nav email={user?.email} />
      <main className="mx-auto max-w-6xl p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Content calendar</h1>
            <p className="text-sm text-gray-500">HAWI drafts posts ahead of every date you add. You approve before anything goes live.</p>
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm">
            {(["month", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium ${view === v ? "bg-blue-600 text-white" : "text-gray-600"}`}>
                {v === "month" ? "Month" : "Next 30 days"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-blue-600" /> Your dates</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-100" /> Suggested (tap to add)</span>
          <span className="text-gray-400">Tap any day to add your own date</span>
        </div>

        {view === "month" ? (
          <div className="rounded-2xl bg-white p-3 shadow sm:p-5">
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
              events={calEvents}
              eventClick={onEventClick}
              dateClick={(i: DateClickArg) => openNew(i.dateStr)}
              dayMaxEvents={2}
              height="auto"
            />
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <p className="rounded-2xl bg-white p-6 text-center text-gray-500 shadow">Nothing in the next 30 days. Add a date from the Month view.</p>
            )}
            {upcoming.map((i) => {
              const d = new Date(i.date + "T00:00:00");
              return (
                <button key={i.key} onClick={() => setModal(i.modal)}
                  className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow transition hover:shadow-md">
                  <div className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl ${i.mine ? "bg-blue-600 text-white" : "bg-amber-100 text-amber-800"}`}>
                    <span className="text-xs uppercase">{d.toLocaleDateString("en-US", { month: "short" })}</span>
                    <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{i.emoji} {i.title}</p>
                    <p className="text-sm text-gray-500">{daysFrom(today, i.date)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${i.mine ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                    {i.mine ? "On your calendar" : "+ Add"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "new" && (
              <>
                <h2 className="mb-4 text-lg font-bold">Add a date</h2>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer sale launch" className="mb-3 w-full rounded-lg border p-3" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-lg border p-3" />
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the AI (optional): offer, discount, mood..." rows={3} className="mb-4 w-full rounded-lg border p-3" />
                <button onClick={saveNew} disabled={busy || !title.trim()} className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white disabled:opacity-50">Save to calendar</button>
              </>
            )}
            {modal.kind === "suggest" && (
              <>
                <p className="text-4xl">{modal.s.emoji}</p>
                <h2 className="mt-2 text-lg font-bold">{modal.s.title}</h2>
                <p className="mb-1 text-sm text-gray-500">{modal.s.event_date}{modal.s.is_approximate && " (approximate, depends on moon sighting)"}</p>
                <p className="mb-4 text-sm capitalize text-gray-500">{modal.s.category} date</p>
                <button onClick={() => addSuggestion(modal.s)} disabled={busy} className="w-full rounded-lg bg-blue-600 p-3 font-medium text-white disabled:opacity-50">Add to my calendar</button>
              </>
            )}
            {modal.kind === "mine" && (
              <>
                <h2 className="text-lg font-bold">{modal.ev.title}</h2>
                <p className="mb-2 text-sm text-gray-500">{modal.ev.event_date}</p>
                {modal.ev.notes && <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">{modal.ev.notes}</p>}
                <button onClick={() => remove(modal.ev.id)} className="w-full rounded-lg border border-red-200 p-3 font-medium text-red-600">Remove from calendar</button>
              </>
            )}
            <button onClick={() => setModal(null)} className="mt-3 w-full text-sm text-gray-500">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}