"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { ErrorState } from "./Status";

const navRoutes = [
  { href: "/chat", key: "chat" },
  { href: "/documents", key: "documents" },
  { href: "/knowledge", key: "knowledge" },
  { href: "/groups", key: "groups" },
] as const;

export function ServiceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const logout = useLogout();
  const { localization } = useLocalization((state) => ({
    brand: state.localization.brand,
    service: state.localization.service,
  }));

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  if (user.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cal-canvas text-cal-ink">
        {localization.service.restoringSession}
      </div>
    );
  }

  if (user.error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-cal-canvas p-6">
        <div className="cal-card max-w-md rounded-xl p-6">
          <ErrorState
            title={localization.service.pleaseLogin}
            error={user.error}
          />
          <Button className="mt-4" onClick={() => router.push("/login")}>
            {localization.service.goToLogin}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh bg-cal-canvas text-cal-ink">
      <aside className="hidden w-72 flex-col border-r border-cal-hairline bg-cal-surface-soft p-5 lg:flex">
        <Link
          href="/chat"
          className="rounded-lg bg-cal-primary px-5 py-4 font-heading text-2xl font-semibold tracking-[-0.04em] text-white"
        >
          {localization.brand.name}
        </Link>
        <nav className="mt-8 grid gap-2">
          {navRoutes.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium text-cal-muted transition hover:bg-cal-canvas hover:text-cal-ink",
                pathname === item.href &&
                  "bg-cal-primary text-white hover:bg-cal-primary hover:text-white",
              )}
            >
              {localization.service.nav[item.key]}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-cal-hairline bg-cal-canvas p-4 text-sm text-cal-muted shadow-[0_4px_16px_rgb(0_0_0/0.04)]">
          <p className="font-medium text-cal-ink">{user.data?.email}</p>
          <p className="mt-2 text-xs leading-5">
            {localization.service.sessionRestored}
          </p>
          <Button
            className="mt-4 w-full"
            variant="outline"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            {localization.service.logout}
          </Button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-cal-hairline bg-cal-surface-soft px-4 py-3 lg:hidden">
          <Link
            href="/chat"
            className="font-heading text-2xl font-semibold tracking-[-0.04em]"
          >
            {localization.brand.name}
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            {localization.service.logout}
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </div>
      </section>
    </main>
  );
}
