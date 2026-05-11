"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip } from "ufoo-ui";
import { Header } from "@/components/Header";
import { LoginPanel } from "@/components/LoginPanel";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "@/lib/i18n";

export default function HomePage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
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
          <Chip className="mb-4" color="accent" variant="soft">{t.homeTagline}</Chip>
          <h1 className="max-w-3xl">
            <Logo href="" size="lg" />
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700">
            {t.homeDescription}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="#login">
              <Button variant="primary">{t.start}</Button>
            </Link>
          </div>
        </section>
        <section className="grid justify-items-center" id="login">
          {loading ? <p>{t.loading}</p> : <LoginPanel />}
        </section>
      </main>
    </>
  );
}
