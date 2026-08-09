"use client";

import {
  FilePlus2Icon,
  LogOutIcon,
  MessageSquareTextIcon,
  SettingsIcon,
  SparklesIcon,
  UsersRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { OnboardingRuntime } from "@/components/onboarding/OnboardingRuntime";
import { OnboardingTarget } from "@/components/onboarding/OnboardingTarget";
import { ThemeTogglerButton } from "@/components/ThemeTogglerButton";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ThemePreference } from "@/constants/theme";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { ErrorState } from "./Status";

const navRoutes = [
  // `fill` routes get a height-bounded content box and manage their own
  // internal scrolling; `scroll` routes scroll the whole content region.
  {
    href: "/chat",
    key: "chat",
    icon: MessageSquareTextIcon,
    layout: "fill",
  },
  {
    href: "/knowledge",
    key: "knowledge",
    icon: FilePlus2Icon,
    layout: "scroll",
  },
  { href: "/groups", key: "groups", icon: UsersRoundIcon, layout: "scroll" },
  { href: "/settings", key: "settings", icon: SettingsIcon, layout: "scroll" },
] as const;

type ServiceShellProps = {
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
  themePreference?: ThemePreference;
};

export function ServiceShell({
  children,
  defaultSidebarOpen = true,
  themePreference = "system",
}: ServiceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const logout = useLogout();
  const { localization } = useLocalization((state) => ({
    brand: state.localization.brand,
    service: state.localization.service,
  }));

  async function handleLogout() {
    try {
      await logout.mutateAsync();
      router.push("/login");
    } catch {
      // React Query stores the API error on the mutation; keep the user on the shell.
    }
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

  const currentRoute =
    navRoutes.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? navRoutes[0];
  const sessionLabel = user.data?.is_guest
    ? localization.service.guestSessionLabel
    : user.data?.email;

  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      // `h-dvh`, not `min-h-dvh`: this bounds `SidebarInset` so the content
      // region below can own the page's only scrollbar. Routes then never need
      // to guess the chrome's height with `calc(100dvh - …)`.
      className="h-dvh bg-cal-canvas text-cal-ink"
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <Sidebar
        collapsible="icon"
        className="border-cal-hairline bg-cal-surface-soft"
      >
        <SidebarHeader className="gap-3 border-b border-cal-hairline p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={localization.brand.name}
                className="rounded-xl bg-cal-primary text-white hover:bg-cal-primary-active hover:text-white data-active:bg-cal-primary"
                render={<Link href="/chat" />}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/12 text-sm font-semibold text-white ring-1 ring-white/20">
                  <SparklesIcon />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-heading text-lg font-semibold">
                    {localization.brand.name}
                  </span>
                  <span className="truncate text-xs font-medium text-white/75">
                    {localization.service.sessionEvidenceTitle}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="py-3 group-data-[collapsible=icon]:px-3">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navRoutes.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <OnboardingTarget id={`nav.${item.key}`}>
                        <SidebarMenuButton
                          tooltip={localization.service.nav[item.key]}
                          isActive={isActive}
                          className="h-10 rounded-lg text-cal-muted data-active:bg-cal-primary data-active:text-white hover:text-cal-ink data-active:hover:bg-cal-primary data-active:hover:text-white"
                          render={
                            <Link
                              href={item.href}
                              aria-current={isActive ? "page" : undefined}
                            />
                          }
                        >
                          <Icon />
                          <span>{localization.service.nav[item.key]}</span>
                        </SidebarMenuButton>
                      </OnboardingTarget>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-3 border-t border-cal-hairline p-3">
          <OnboardingTarget id="service.guest-session-card">
            <div className="rounded-xl border border-cal-hairline bg-cal-canvas p-4 text-sm text-cal-muted shadow-card group-data-[collapsible=icon]:hidden">
              <p className="truncate font-medium text-cal-ink">
                {sessionLabel}
              </p>
              <p className="mt-2 text-xs leading-5">
                {localization.service.sessionRestored}
              </p>
              {logout.error ? (
                <div className="mt-3">
                  <ErrorState error={logout.error} />
                </div>
              ) : null}
            </div>
          </OnboardingTarget>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={localization.service.logout}
                onClick={handleLogout}
                disabled={logout.isPending}
                className="h-10 rounded-lg text-cal-muted hover:text-cal-ink"
              >
                <LogOutIcon />
                <span>{localization.service.logout}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0 bg-cal-canvas">
        {/* `sticky` was a near no-op here: the scroll container is this
            header's sibling, not its ancestor. Now that the shell is height
            bounded, `shrink-0` is what actually keeps it in place. */}
        <header className="z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-cal-hairline bg-cal-surface-soft px-4 sm:px-6 lg:px-8">
          <SidebarTrigger
            aria-label={localization.service.toggleSidebar}
            title={localization.service.toggleSidebar}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cal-ink">
              {localization.service.nav[currentRoute.key]}
            </p>
            <OnboardingTarget id="service.guest-session-mobile">
              <p className="truncate text-xs text-cal-muted sm:hidden">
                {sessionLabel}
              </p>
            </OnboardingTarget>
          </div>
          <ThemeTogglerButton initialPreference={themePreference} />
          <Button
            className="md:hidden"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            {localization.service.logout}
          </Button>
        </header>
        {/*
          Two modes, chosen from the route the shell already resolved.
          `fill` gives the route a fixed-height box it can divide up, which is
          what a transcript needs; every other route scrolls normally.

          Deriving this from the pathname rather than threading a prop avoids
          adding `app/(service)/chat/layout.tsx` for a single boolean. The
          trade-off is recorded in DESIGN.md.
        */}
        <div
          className={cn(
            "min-h-0 flex-1 p-4 sm:p-6 lg:p-8",
            currentRoute.layout === "fill"
              ? "overflow-hidden"
              : "overflow-auto",
          )}
        >
          {children}
        </div>
      </SidebarInset>
      <OnboardingRuntime user={user.data} />
    </SidebarProvider>
  );
}
