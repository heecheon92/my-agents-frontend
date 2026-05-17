export function getSetCookieHeaders(headers: Headers) {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === "function") return getSetCookie.call(headers);
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export function parseCookieValue(setCookie: string, cookieName: string) {
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  if (separator === -1) return undefined;
  const name = pair.slice(0, separator).trim();
  if (name !== cookieName) return undefined;
  return pair.slice(separator + 1);
}
