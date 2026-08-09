import Link from "next/link";
import { defaultLocalization } from "@/utils/localization";

export default function Home() {
  const { brand, home } = defaultLocalization;

  return (
    <main className="min-h-dvh bg-cal-canvas text-cal-ink">
      <div className="responsive-container flex min-h-dvh flex-col py-4 sm:py-6">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-cal-hairline py-3">
          <p className="font-heading text-xl font-semibold">{brand.name}</p>
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
            {/*
              Guest leads. Someone arriving cold wants to see the product, not
              open an account — and signup now waits on operator approval, so
              making it the primary call to action would send a first-time
              visitor into a queue. Signup and login stay one click away.
            */}
            <div className="responsive-cluster mt-8">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-control bg-cal-primary px-5 text-sm font-semibold text-white transition hover:bg-cal-primary-active"
                href="/guest"
              >
                {home.guestCta}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-control border border-cal-hairline bg-cal-canvas px-5 text-sm font-semibold text-cal-ink transition hover:bg-cal-surface-soft"
                href="/signup"
              >
                {home.signup}
              </Link>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-control px-5 text-sm font-semibold text-cal-ink underline-offset-4 transition hover:underline"
                href="/login"
              >
                {home.login}
              </Link>
            </div>
            <p className="mt-3 text-sm text-cal-muted">{home.guestCtaHint}</p>
          </div>
          <div className="cal-product-card overflow-hidden rounded-xl p-4">
            <div className="mb-3 rounded-lg border border-cal-hairline bg-cal-surface-soft p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cal-muted">
                {home.artifactLabel}
              </p>
              <div className="mt-3 rounded-md border border-cal-hairline bg-cal-canvas p-3">
                <p className="text-xs font-semibold text-cal-ink">
                  {home.transcriptLabel}
                </p>
                <div className="mt-2 grid gap-2 text-xs">
                  {home.transcriptRows.map((row) => (
                    <p
                      key={row}
                      className="rounded-md border border-cal-hairline bg-cal-surface-soft px-2 py-1"
                    >
                      {row}
                    </p>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-md border border-cal-hairline bg-cal-canvas p-3">
                <p className="text-xs font-semibold text-cal-ink">
                  {home.activityLabel}
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-5 text-cal-muted">
                  {home.activityItems.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-cal-ink" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 grid gap-2 text-xs">
                <p className="rounded-md border border-cal-hairline bg-cal-canvas p-2 text-cal-muted">
                  <span className="font-semibold text-cal-ink">
                    {home.citationLabel}:
                  </span>{" "}
                  {home.citationText}
                </p>
                <p className="rounded-md border border-cal-hairline bg-cal-canvas p-2 text-cal-muted">
                  <span className="font-semibold text-cal-ink">
                    {home.sourceLabel}:
                  </span>{" "}
                  {home.sourceText}
                </p>
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
