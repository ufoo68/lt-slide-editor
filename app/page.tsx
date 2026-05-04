"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { LoginPanel } from "@/components/LoginPanel";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  return (
    <>
      <Header />
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="mb-4 text-sm font-black uppercase tracking-normal text-coral">Markdown slides for lightning talks</p>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-normal md:text-7xl">
            LT Slide Editor
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            5〜15分のLTを素早く作るための、MarkdownベースのWebスライド作成ツールです。箇条書き、コード、公開URL共有に絞って、発表資料を軽く作れます。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="rounded-md bg-ink px-5 py-3 font-semibold text-white" href="#login">
              はじめる
            </Link>
          </div>
        </section>
        <section className="grid justify-items-center" id="login">
          {loading ? <p>Loading...</p> : <LoginPanel />}
        </section>
      </main>
    </>
  );
}
