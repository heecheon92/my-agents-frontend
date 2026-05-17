import { ServiceShell } from "@/components/keymesh/ServiceShell";

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ServiceShell>{children}</ServiceShell>;
}
