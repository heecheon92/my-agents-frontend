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
      <div className="responsive-container flex min-h-dvh flex-col py-4 sm:py-6">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-cal-hairline py-3">
          <p className="font-heading text-xl font-semibold tracking-[-0.04em]">
            {brand.name}
          </p>
          <div className="responsive-cluster justify-end">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-cal-hairline bg-cal-canvas px-5 text-sm font-semibold text-cal-ink transition hover:bg-cal-surface-soft"
              href="/login"
            >
              {home.login}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-cal-primary px-5 text-sm font-semibold text-white transition hover:bg-cal-primary-active"
              href="/signup"
            >
              {home.signup}
            </Link>
          </div>
        </header>
        <section className="responsive-section grid flex-1 gap-10 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-12">
          <div>
            <p className="cal-label">{home.eyebrow}</p>
            <h1 className="cal-heading cal-fluid-display mt-5 max-w-4xl">
              {home.title}
            </h1>
            <p className="cal-subcopy cal-fluid-subtitle mt-6 max-w-2xl">
              {home.description}
            </p>
            <div className="responsive-cluster mt-8">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-cal-primary px-5 text-sm font-semibold text-white transition hover:bg-cal-primary-active"
                href="/signup"
              >
                {home.signup}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-cal-hairline bg-cal-canvas px-5 text-sm font-semibold text-cal-ink transition hover:bg-cal-surface-soft"
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
            <div className="responsive-card-grid mt-4">
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
