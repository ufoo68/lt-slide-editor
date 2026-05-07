"use client";

import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { Button, Card, Input, Tabs } from "@heroui/react";
import { useAuth } from "@/components/AuthProvider";
import { getClientAuth, getGoogleProvider } from "@/lib/firebase-client";

export function LoginPanel() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <Card className="w-full max-w-md border border-line bg-white/90 shadow-panel">
        <Card.Content className="p-6">
          <h2 className="text-lg font-black">Firebase設定が必要です</h2>
          <p className="mt-2 text-sm leading-6 text-stone-700">
            Cloud Runの環境変数に `NEXT_PUBLIC_FIREBASE_API_KEY` などのFirebase Webアプリ設定を入れて、再デプロイしてください。
          </p>
        </Card.Content>
      </Card>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const auth = await getClientAuth();
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
      await signInWithPopup(await getClientAuth(), getGoogleProvider());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Googleログインに失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md border border-line bg-white/90 shadow-panel">
      <Card.Content className="gap-4 p-5">
      <Tabs
        aria-label="認証方法"
        selectedKey={mode}
        onSelectionChange={(key) => setMode(key === "signup" ? "signup" : "signin")}
      >
        <Tabs.List className="rounded-md border border-line bg-white p-1">
          <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold data-[selected=true]:bg-ink data-[selected=true]:text-white" id="signin">
            ログイン
          </Tabs.Tab>
          <Tabs.Tab className="rounded px-3 py-2 text-sm font-semibold data-[selected=true]:bg-ink data-[selected=true]:text-white" id="signup">
            新規登録
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
      <label className="grid gap-1 text-sm font-semibold">
        メール
        <Input onChange={(event) => setEmail(event.target.value)} type="email" value={email} variant="primary" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        パスワード
        <Input onChange={(event) => setPassword(event.target.value)} type="password" value={password} variant="primary" />
      </label>
      {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-2">
        <Button
          isDisabled={busy || !email || !password}
          variant="primary"
          onPress={submit}
        >
          {mode === "signin" ? "メールでログイン" : "アカウント作成"}
        </Button>
        <Button
          isDisabled={busy}
          variant="outline"
          onPress={google}
        >
          Googleで続ける
        </Button>
      </div>
      </Card.Content>
    </Card>
  );
}
