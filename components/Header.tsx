"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link className="text-lg font-black tracking-normal" href="/">
          LT Slide Editor
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link className="font-semibold text-steel" href="/dashboard">
                Dashboard
              </Link>
              <button className="rounded-md border border-line px-3 py-2 font-semibold" onClick={() => signOut(getClientAuth())}>
                Logout
              </button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
