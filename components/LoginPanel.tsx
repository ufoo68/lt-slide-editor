"use client";

import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase-client";

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const auth = getClientAuth();
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(getClientAuth(), getGoogleProvider());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Googleログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="mb-4 flex rounded-md border border-line p-1">
        <button
          className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${mode === "signin" ? "bg-ink text-white" : ""}`}
          onClick={() => setMode("signin")}
          type="button"
        >
          ログイン
        </button>
        <button
          className={`h-10 flex-1 rounded px-3 text-sm font-semibold ${mode === "signup" ? "bg-ink text-white" : ""}`}
          onClick={() => setMode("signup")}
          type="button"
        >
          新規登録
        </button>
      </div>
      <label className="mb-3 block text-sm font-semibold">
        メール
        <input
          className="mt-1 h-11 w-full rounded-md border border-line px-3"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </label>
      <label className="mb-4 block text-sm font-semibold">
        パスワード
        <input
          className="mt-1 h-11 w-full rounded-md border border-line px-3"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
      </label>
      {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-2">
        <button
          className="h-11 rounded-md bg-mint px-4 font-semibold text-white disabled:opacity-50"
          disabled={busy || !email || !password}
          onClick={submit}
          type="button"
        >
          {mode === "signin" ? "メールでログイン" : "アカウント作成"}
        </button>
        <button
          className="h-11 rounded-md border border-line bg-white px-4 font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={google}
          type="button"
        >
          Googleで続ける
        </button>
      </div>
    </div>
  );
}
