"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/calendar", label: "Calendar" },
  { href: "/brand", label: "Brand" },
];

export default function Nav({ email }: { email?: string }) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-xl font-extrabold tracking-tight text-blue-600">HAWI</span>
          <nav className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  path === l.href ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-gray-500 sm:inline">{email}</span>
          <button onClick={signOut} className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}