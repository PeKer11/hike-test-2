/* Hero scroll story. Pure maths so the same numbers drive the page and the tests.
   p runs 0..1 across the pinned hero. Only transform/opacity are ever derived; the haze
   is the cloud layer itself fading in, never a blur filter. */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const remap = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export type HeroState = {
  copyO: number;
  copyY: number;
  push: number; // 0..1, camera push into the phone screen
  spin: number; // degrees of yaw: one full turn, ends face-on as the screen fills the stage
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
  const turn = easeInOut(remap(p, 0.06, 0.36));
  const push = turn;
  const mist = easeInOut(remap(p, 0.12, 0.3)); // first thin clouds drift in while the phone turns
  const cover = easeInOut(remap(p, 0.3, 0.44)); // then they close completely
  const drift = easeInOut(remap(p, 0.12, 0.44));
  const lift = easeInOut(remap(p, 0.52, 0.64));
  const covered = p < 0.5;
  return {
    copyO: 1 - remap(p, 0.02, 0.14),
    copyY: -34 * remap(p, 0.02, 0.16),
    push,
    spin: 360 * turn,
    propsOut: easeOut(remap(p, 0.05, 0.26)),
    plateScale: 1 + 0.1 * easeInOut(remap(p, 0.06, 0.64)),
    cloudO: covered ? Math.min(1, 0.55 * mist + 0.45 * cover) : 1 - lift,
    cloudS: covered ? 0.7 + 0.8 * drift : 1.5 + 1.6 * lift,
    phoneVisible: p < 0.48,
    mapVisible: p >= 0.48,
    mapScale: 1.12 - 0.12 * easeOut(remap(p, 0.5, 0.68)),
    play: p >= 0.6,
  };
}
