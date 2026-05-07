"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { Button } from "@heroui/react";
import { getClientAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/lib/i18n";

export function Header() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="border-b border-line/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link className="text-lg font-black tracking-normal text-foreground" href="/">
          LT Slide Editor
        </Link>
        {user ? (
          <nav className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold">
              {t.languageMode}
              <select
                className="bg-transparent text-xs font-semibold outline-none"
                onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "ja")}
                value={language}
              >
                <option value="ja">{t.japanese}</option>
                <option value="en">{t.english}</option>
              </select>
            </label>
            <Link className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-black/5" href="/dashboard">
              {t.dashboard}
            </Link>
            <Button size="sm" variant="outline" onPress={async () => signOut(await getClientAuth())}>
              {t.logout}
            </Button>
          </nav>
        ) : (
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold">
            {t.languageMode}
            <select
              className="bg-transparent text-xs font-semibold outline-none"
              onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "ja")}
              value={language}
            >
              <option value="ja">{t.japanese}</option>
              <option value="en">{t.english}</option>
            </select>
          </label>
        )}
      </div>
    </header>
  );
}
