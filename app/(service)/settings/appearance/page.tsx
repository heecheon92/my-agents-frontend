import { cookies } from "next/headers";
import { AppearanceSettingsPanel } from "@/components/settings/AppearanceSettingsPanel";
import { parseThemePreference, THEME_COOKIE_NAME } from "@/constants/theme";

export default async function AppearanceSettingsPage() {
  // Read on the server so the control renders already showing the saved
  // preference, rather than flipping to it after hydration.
  const preference = parseThemePreference(
    (await cookies()).get(THEME_COOKIE_NAME)?.value,
  );

  return <AppearanceSettingsPanel initialPreference={preference} />;
}
