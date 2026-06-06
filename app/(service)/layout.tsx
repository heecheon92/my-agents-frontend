import { ServiceShell } from "@/components/ServiceShell";

export default function ServiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ServiceShell>{children}</ServiceShell>;
}
