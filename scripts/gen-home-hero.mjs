// Home hero art (round 2026-11-22, item 9, task D2). Never prints the API key.
//
//   node --env-file=.env.local scripts/gen-home-hero.mjs gen  <wide|forward> <out.png> [low|medium|high] [WxH]
//   node scripts/gen-home-hero.mjs finish <in.png> <out.jpg> <width> <height> [maxKB]
//
// `gen` asks the OpenAI image API (edits endpoint, the shipped phone photo as the style/subject reference)
// for one image. `finish` crops to the exact ratio, resizes and writes a JPEG under the size budget.
// The prompts, parameters and the chosen files are recorded in docs/design-brief/HOME-HERO-D2.md.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = process.env.HERO_MODEL || "gpt-image-2";

const SHARED = [
  "Photoreal landscape photograph, soft overcast morning light, natural film grain, same mood and palette as the reference photo:",
  "misty subalpine meadow valley, deep fir greens and sage grass, drifts of white and golden-yellow wildflowers,",
  "hazy blue-grey mountains with a few snow patches, pale cream-grey mist sky, a narrow red-brown dirt trail.",
  "One hiker seen from behind, walking away along the trail, wearing a warm terracotta-orange backpack and khaki shorts,",
  "holding a trekking pole in each hand so BOTH hands are clearly visible gripping the poles.",
  "No text, no logo, no frame, no border, no arch, no halo, no vignette, no watermark, no illustration or painted look.",
].join(" ");

const PROMPTS = {
  // 2.4:1 band. The hero header on tablet and desktop is short and wide and its centred text column covers the
  // middle, so the hiker sits in the lower-left third and the right side stays calm.
  wide: [
    "Create a WIDE panoramic version of the reference photo, about 2.4:1 landscape.",
    SHARED,
    "Composition: the hiker is in the lower-left of the frame (the figure spans about 8 to 17 percent from the left edge, close to the left side), larger than in the reference,",
    "standing about 42 percent of the frame height, full figure visible from boots to pack, with the trail leading from the bottom of the frame up past him into the valley.",
    "The upper half and the whole right half are open misty sky and a soft distant valley with calm, low-detail areas so text can sit over them.",
    "Sharp fine detail in the flowers and foreground grass.",
  ].join(" "),
  // Optional phone variant (?homebg=forward): same scene as the approved portrait, the traveler a little more forward
  // and clear of the bottom gradient. Not the default.
  forward: [
    "Re-frame the reference portrait photo (2:3) with the same scene, same light, same palette.",
    SHARED,
    "Composition: the hiker is slightly closer and larger than in the reference, centred a bit to the right of middle, in the middle band of the frame",
    "(about 45 to 70 percent from the top), full figure from boots to pack, clear of the bottom of the frame.",
    "Keep the misty mountains and the flowers; sharp fine detail.",
  ].join(" "),
};

const [, , cmd, ...args] = process.argv;

if (cmd === "gen") {
  const [kind, out, quality = "high", size = kind === "wide" ? "2880x1200" : "1024x1536"] = args;
  if (!PROMPTS[kind] || !out) throw new Error("usage: gen <wide|forward> <out.png> [low|medium|high] [WxH]");
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set (run with --env-file=.env.local)");
  const form = new FormData();
  form.set("model", MODEL);
  form.set("prompt", PROMPTS[kind]);
  form.set("size", size);
  form.set("quality", quality);
  form.set("n", "1");
  form.set("output_format", "png");
  const ref = readFileSync(resolve(root, "public/images/traike/home-forest.jpg"));
  form.append("image[]", new Blob([ref], { type: "image/jpeg" }), "home-forest.jpg");
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log("ERROR", res.status, String(body.error?.message ?? "").replaceAll(key, "***"));
    process.exit(1);
  }
  writeFileSync(out, Buffer.from(body.data[0].b64_json, "base64"));
  console.log("saved", out, `model=${MODEL} size=${size} quality=${quality}`, "usage:", JSON.stringify(body.usage ?? null));
} else if (cmd === "finish") {
  const [input, out, w, h, maxKB = "450"] = args;
  const { default: sharp } = await import("sharp");
  const W = Number(w);
  const H = Number(h);
  let q = 86;
  let buf;
  do {
    buf = await sharp(input).resize(W, H, { fit: "cover", position: "centre" }).jpeg({ quality: q, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
    q -= 3;
  } while (buf.length > Number(maxKB) * 1024 && q > 50);
  writeFileSync(out, buf);
  console.log("wrote", out, `${W}x${H}`, `${Math.round(buf.length / 1024)} KB`, `q=${q + 3}`);
} else {
  console.log("usage: gen <wide|forward> <out.png> [quality] [WxH] | finish <in> <out.jpg> <w> <h> [maxKB]");
}
