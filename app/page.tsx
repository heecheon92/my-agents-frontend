import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-dvh bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-between rounded-[2.5rem] border border-white/10 bg-white/[0.03] p-8 shadow-2xl shadow-black/20">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">
            my-agents
          </p>
          <div className="flex gap-2">
            <Link
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
              href="/login"
            >
              Log in
            </Link>
            <Link
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-white/90"
              href="/signup"
            >
              Sign up
            </Link>
          </div>
        </header>
        <section className="grid gap-10 py-20 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-sm font-medium text-emerald-300">
              FastAPI + LangGraph product frontend
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight lg:text-7xl">
              A real AI-agent console, wired to the backend service.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Manage authenticated conversations, server-owned transcripts,
              agent runs, citations, documents, groups, and knowledge workflows
              without using the legacy smoke chat endpoint.
            </p>
          </div>
          <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            {[
              "Greet-style services, query keys, models, and keymesh components.",
              "Next BFF route handlers protect session and CSRF forwarding.",
              "Implementation log keeps the work followable for future manual edits.",
            ].map((item) => (
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
