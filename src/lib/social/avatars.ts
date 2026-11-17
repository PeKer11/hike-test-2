/** The 12 preset avatars: existing accessory art (public/images/traike/accessories). No uploads, no new art. */
export const AVATARS = [
  "backpack", "bench", "binoculars", "boot", "bottle", "camera",
  "footprints", "hat", "signpost", "stick", "tent", "thermos",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export const DEFAULT_AVATAR: AvatarId = "backpack";

export function isAvatar(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATARS as readonly string[]).includes(v);
}

export function avatarOr(v: unknown): AvatarId {
  return isAvatar(v) ? v : DEFAULT_AVATAR;
}

export const avatarSrc = (id: AvatarId): string => `/images/traike/accessories/${id}.png`;
