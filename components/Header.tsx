"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { Button } from "@heroui/react";
import { getClientAuth } from "@/lib/firebase-client";
import { useAuth } from "@/components/AuthProvider";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="border-b border-line/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link className="text-lg font-black tracking-normal text-foreground" href="/">
          LT Slide Editor
        </Link>
        {user ? (
          <nav className="flex items-center gap-2">
            <Link className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-black/5" href="/dashboard">
              Dashboard
            </Link>
            <Button size="sm" variant="outline" onPress={async () => signOut(await getClientAuth())}>
              Logout
            </Button>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
