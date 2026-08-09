import { cookies } from "next/headers";
import { ServiceShell } from "@/components/ServiceShell";
import { parseThemePreference, THEME_COOKIE_NAME } from "@/constants/theme";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  // Read here rather than in the toggler so the button renders the saved
  // preference on the server, instead of flipping to it after hydration.
  const themePreference = parseThemePreference(
    cookieStore.get(THEME_COOKIE_NAME)?.value,
  );

  return (
    <ServiceShell
      defaultSidebarOpen={sidebarState !== "false"}
      themePreference={themePreference}
    >
      {children}
    </ServiceShell>
  );
}
