import Link from "next/link";
import { defaultLocalization } from "@/utils/localization";

export default function Home() {
  const { brand, home } = defaultLocalization;

  return (
    <main className="min-h-dvh bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-between rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/20">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            {brand.name}
          </p>
          <div className="flex gap-2">
            <Link
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              href="/login"
            >
              {home.login}
            </Link>
            <Link
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-white/90"
              href="/signup"
            >
              {home.signup}
            </Link>
          </div>
        </header>
        <section className="grid gap-10 py-20 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              {home.eyebrow}
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight lg:text-7xl">
              {home.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {home.description}
            </p>
          </div>
          <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            {home.featureCards.map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-white/10 p-4 text-sm text-slate-100"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
