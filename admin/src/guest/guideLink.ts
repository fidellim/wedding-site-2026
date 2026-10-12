/** Compatibility destination for seating links formerly issued on the invitation route. */
export function legacyGuideDestination(url: URL): URL | null {
  const code = url.searchParams.get("code")?.trim(), token = url.searchParams.get("seating")?.trim();
  if (url.pathname !== "/" || !code || !token) return null;
  return guestGuideLink(url.origin, code, token);
}

export function guestGuideLink(origin: string, code: string, token: string): URL {
  const link = new URL("/seating/", origin);
  link.searchParams.set("code", code);
  link.searchParams.set("seating", token);
  return link;
}
