import Link from "next/link";
import { defaultLocalization } from "@/utils/localization";

const calendarCells = Array.from(
  { length: 28 },
  (_, index) => `calendar-cell-${index}`,
);

export default function Home() {
  const { brand, home } = defaultLocalization;

  return (
    <main className="min-h-dvh bg-cal-canvas text-cal-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-6">
        <header className="flex h-16 items-center justify-between border-b border-cal-hairline">
          <p className="font-heading text-xl font-semibold tracking-[-0.04em]">
            {brand.name}
          </p>
          <div className="flex gap-2">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-cal-hairline bg-cal-canvas px-5 text-sm font-semibold text-cal-ink transition hover:bg-cal-surface-soft"
              href="/login"
            >
              {home.login}
            </Link>
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md bg-cal-primary px-5 text-sm font-semibold text-white transition hover:bg-cal-primary-active"
              href="/signup"
            >
              {home.signup}
            </Link>
          </div>
        </header>
        <section className="grid flex-1 gap-12 py-20 lg:grid-cols-[7fr_5fr] lg:items-center lg:py-24">
          <div>
            <p className="cal-label">{home.eyebrow}</p>
            <h1 className="cal-heading mt-5 max-w-4xl text-5xl leading-[1.05] lg:text-[64px]">
              {home.title}
            </h1>
            <p className="cal-subcopy mt-6 max-w-2xl text-lg">
              {home.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md bg-cal-primary px-5 text-sm font-semibold text-white transition hover:bg-cal-primary-active"
                href="/signup"
              >
                {home.signup}
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-cal-hairline bg-cal-canvas px-5 text-sm font-semibold text-cal-ink transition hover:bg-cal-surface-soft"
                href="/login"
              >
                {home.login}
              </Link>
            </div>
          </div>
          <div className="cal-product-card overflow-hidden rounded-xl p-4">
            <div className="rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="h-2.5 w-24 rounded-full bg-cal-surface-strong" />
                <span className="h-8 w-20 rounded-md bg-cal-primary" />
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarCells.map((cell) => (
                  <span
                    // Static decorative product chrome mirrors the Cal.com calendar-grid motif.
                    key={cell}
                    className="aspect-square rounded-md border border-cal-hairline bg-cal-canvas"
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {home.featureCards.map((item, index) => (
                <div
                  key={item}
                  className="rounded-lg border border-cal-hairline bg-cal-canvas p-4 text-sm leading-6 text-cal-body"
                >
                  <span className="mb-3 block size-9 rounded-full bg-cal-surface-card text-center text-sm font-semibold leading-9 text-cal-ink">
                    {index + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
