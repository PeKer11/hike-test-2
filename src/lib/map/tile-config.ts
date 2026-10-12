// Basemap tile source, env-configurable so the provider can change (OSMF's tile
// policy does not allow commercial-scale use or offline prefetching) without a
// code edit. Pure on purpose: `next.config.ts` imports it for the CSP, and
// MapView imports it for the TileLayer. NEXT_PUBLIC_* must be read as literal
// property accesses so Next inlines them in the client bundle.

export const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SUBDOMAIN_WILDCARD = /^\{s\}\./;
// Host: plain labels only (no port, userinfo or other punctuation), `{s}.` allowed only as the leading label.
const SAFE_AUTHORITY = /^(\{s\}\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** The host part of a valid tile template, or null when the template is not safe to use. */
function safeAuthority(value: string): string | null {
  const match = /^https:\/\/([^/?#]*)([/?#].*)$/.exec(value);
  if (!match) return null;
  const [, authority, rest] = match;
  if (!SAFE_AUTHORITY.test(authority)) return null;
  // {z}/{x}/{y} are required, {r} (retina) is allowed, {s} only ever as the host's leading label.
  if (!rest.includes("{z}") || !rest.includes("{x}") || !rest.includes("{y}")) return null;
  if (/[{}]/.test(rest.replace(/\{[zxyr]\}/g, ""))) return null;
  try {
    const probe = new URL(`https://${authority.replace(SUBDOMAIN_WILDCARD, "a.")}${rest.replace(/\{[zxyr]\}/g, "0")}`);
    if (probe.protocol !== "https:" || probe.username || probe.password || probe.port) return null;
  } catch {
    return null;
  }
  return authority;
}

/** A value that is not a safe https template with {z}/{x}/{y} falls back to the default (with a warning). */
export function resolveTileUrl(value: string | undefined): string {
  const url = value?.trim();
  if (!url) return DEFAULT_TILE_URL;
  if (safeAuthority(url)) return url;
  console.warn("NEXT_PUBLIC_TILE_URL is not a safe https tile template; using the default OSM tiles.");
  return DEFAULT_TILE_URL;
}

export function getTileUrl(): string {
  return resolveTileUrl(process.env.NEXT_PUBLIC_TILE_URL);
}

export function getTileAttribution(): string {
  return process.env.NEXT_PUBLIC_TILE_ATTRIBUTION?.trim() || DEFAULT_TILE_ATTRIBUTION;
}

/**
 * CSP `img-src` source for a tile template: scheme + host, with a leading `{s}`
 * subdomain placeholder turned into a wildcard. The OSM default host has no
 * subdomain, so `*.tile.openstreetmap.org` alone would not match it.
 */
export function tileImgSrc(tileUrl: string): string {
  const authority = safeAuthority(resolveTileUrl(tileUrl))!;
  return `https://${authority.replace(SUBDOMAIN_WILDCARD, "*.")}`;
}
