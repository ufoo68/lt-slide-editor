"use client";

import { signOut } from "firebase/auth";
import { Button } from "ufoo-ui";
import { getClientAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { useLanguage } from "@/lib/i18n";
import Link from "next/link";

export function Header() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="border-b border-line/70 bg-background/85 backdrop-blur">
      <div className="grid min-h-16 w-full gap-3 px-4 py-3 sm:flex sm:flex-nowrap sm:items-center sm:justify-between sm:py-0">
        <div className="min-w-0">
          <Logo />
        </div>
        {user ? (
          <nav className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:w-auto sm:justify-end">
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-line bg-white px-2 text-xs font-semibold sm:px-3">
              <span className="hidden min-w-0 truncate sm:inline">{t.languageMode}</span>
              <select
                aria-label={t.languageMode}
                className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
                onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "ja")}
                value={language}
              >
                <option value="ja">{t.japanese}</option>
                <option value="en">{t.english}</option>
              </select>
            </label>
            <Link className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-semibold text-foreground hover:bg-black/5 sm:px-3" href="/dashboard">
              {t.dashboard}
            </Link>
            <Button size="sm" variant="outline" onPress={async () => signOut(await getClientAuth())}>
              {t.logout}
            </Button>
          </nav>
        ) : (
          <label className="flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold sm:w-auto">
            <span className="min-w-0 truncate">{t.languageMode}</span>
            <select
              aria-label={t.languageMode}
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none sm:flex-none"
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
