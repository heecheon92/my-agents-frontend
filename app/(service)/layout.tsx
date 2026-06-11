import { cookies } from "next/headers";
import { ServiceShell } from "@/components/ServiceShell";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarState = (await cookies()).get(SIDEBAR_COOKIE_NAME)?.value;

  return (
    <ServiceShell defaultSidebarOpen={sidebarState !== "false"}>
      {children}
    </ServiceShell>
  );
}
