"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ErrorState } from "./Status";

const navItems = [
  { href: "/chat", label: "Chat" },
  { href: "/documents", label: "Documents" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/groups", label: "Groups" },
];

export function ServiceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  if (user.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-slate-950 text-white">
        Restoring session...
      </div>
    );
  }

  if (user.error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorState title="Please log in" error={user.error} />
          <Button className="mt-4" onClick={() => router.push("/login")}>
            Go to login
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh bg-slate-100 text-slate-950">
      <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
        <Link
          href="/chat"
          className="rounded-2xl bg-slate-950 px-4 py-3 text-lg font-semibold text-white"
        >
          my-agents
        </Link>
        <nav className="mt-8 grid gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                pathname === item.href &&
                  "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{user.data?.email}</p>
          <p className="mt-1 text-xs">
            Backend session restored through /auth/me.
          </p>
          <Button
            className="mt-3 w-full"
            variant="outline"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            Log out
          </Button>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <Link href="/chat" className="font-semibold">
            my-agents
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </div>
      </section>
    </main>
  );
}
