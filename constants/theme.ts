/**
 * Theme preference contract.
 *
 * Deliberately hand-rolled rather than pulling in `next-themes`: `DESIGN.md`
 * forbids adding a dependency for this, and the repo already has a working
 * server-read cookie pattern for the sidebar (`app/(service)/layout.tsx`),
 * which this mirrors.
 */

export const THEME_COOKIE_NAME = "theme";
/** One year. The preference is a UI setting, not session state. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === "string" &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

export function parseThemePreference(value: unknown): ThemePreference {
  return isThemePreference(value) ? value : DEFAULT_THEME_PREFERENCE;
}

/**
 * Whether a preference should render dark, given the OS setting.
 *
 * Shared by the server (which has no OS signal, so `systemPrefersDark` is
 * false there) and the client, so both agree on how `"system"` resolves.
 */
export function resolvesToDark(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return systemPrefersDark;
}

/**
 * Runs before first paint to apply the theme class.
 *
 * Needed only for `"system"`: the server writes the class directly for an
 * explicit light/dark preference, but it cannot know the OS setting, so
 * without this a system-dark user would see a white flash on every navigation.
 *
 * This is a static string with no interpolation of user or request data.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)/);
var p=m?decodeURIComponent(m[1]):'${DEFAULT_THEME_PREFERENCE}';
var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.classList.toggle('dark',d);
r.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;
