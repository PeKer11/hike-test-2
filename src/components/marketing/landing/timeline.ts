/* Hero scroll story. Pure maths so the same numbers drive the page and the tests.
   p runs 0..1 across the pinned hero. Only transform/opacity are ever derived. */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const remap = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export type HeroState = {
  copyO: number;
  copyY: number;
  push: number; // 0..1, camera push into the phone screen
  propsOut: number; // 0..1, props fly outward and fade
  plateScale: number;
  cloudO: number; // cloud layer opacity (one layer, lifts as a whole)
  cloudS: number; // cloud sprite scale
  phoneVisible: boolean;
  mapVisible: boolean;
  mapScale: number;
  play: boolean; // route draw + pin drop on the full map
};

export function stateAt(p: number): HeroState {
  const push = easeInOut(remap(p, 0.1, 0.42));
  const cover = easeInOut(remap(p, 0.25, 0.4));
  const lift = easeInOut(remap(p, 0.48, 0.6));
  const covered = p < 0.46;
  return {
    copyO: 1 - remap(p, 0.03, 0.16),
    copyY: -34 * remap(p, 0.03, 0.18),
    push,
    propsOut: easeOut(remap(p, 0.08, 0.3)),
    plateScale: 1 + 0.1 * easeInOut(remap(p, 0.1, 0.6)),
    cloudO: covered ? cover : 1 - lift,
    cloudS: covered ? 0.7 + 0.8 * cover : 1.5 + 1.6 * lift,
    phoneVisible: p < 0.45,
    mapVisible: p >= 0.45,
    mapScale: 1.12 - 0.12 * easeOut(remap(p, 0.46, 0.64)),
    play: p >= 0.56,
  };
}
