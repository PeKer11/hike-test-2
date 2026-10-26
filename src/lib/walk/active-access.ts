import { isAccess, type Access } from "./access";

/** The walk being planned or walked needs a stroller / wheelchair route; mid-walk requests (rejoin, shortcuts, options) read it from here. */
let active: Access | undefined;

export function setActiveAccess(access: unknown): void {
  active = isAccess(access) ? access : undefined;
}

/** Spread into a request body that is routed on the server. */
export function accessBody(): { access?: Access } {
  return active ? { access: active } : {};
}
