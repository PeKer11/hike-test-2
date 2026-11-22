# Home hero art, batch D (feedback round 2026-11-22, item 9)

Why: `home-forest.jpg` is a 1000x1500 portrait that was stretched across the full width on tablet and desktop, so it was blurry. md and up now draw a new 2880x1200 landscape; the phone pair is untouched (pixel-identical, checked at 390 px, EN and HE, light and dark, with and without a walk in progress).

## Files

| File | Size | Used by | sha256 |
|---|---|---|---|
| `public/images/traike/home-forest-wide.jpg` | 2880x1200, 424 KB | md and up (default) | `eead5b1afc2dc4c100c25d850ee0199ed39be72ceac84db82576354f79ee8e18` |
| `public/images/traike/home-forest-forward.jpg` | 1024x1536, 313 KB | phone, only with `?homebg=forward` | `e4d0cd199205757784ad3713abffcf8c154e6ffaaee42daaef0a01fc159cc850` |
| `public/images/traike/home-forest.jpg` (unchanged) | 1000x1500, 258 KB | phone (approved look) | `26b96e0c414805366f179a9949889b220c439620cbd07a31c8101c95863054bd` |

## How they were made

`scripts/gen-home-hero.mjs` (OpenAI image API, `gpt-image-2`, edits endpoint with `home-forest.jpg` as the style and subject reference; the key comes from `.env.local` and is never printed). `gen` writes the raw PNG, `finish` crops, resizes and writes the JPEG (mozjpeg, 4:2:0, under 450 KB). The prompts are the `PROMPTS` constants in the script.

Generations, 4 in total:

1. wide, quality low, 2880x1200, first prompt (composition probe only, not shipped)
2. wide, quality high, 2880x1200, first prompt (hiker at about 27 percent from the left, too close to the centred text column, not shipped)
3. wide, quality high, 2880x1200, current prompt (hiker at 16 to 23 percent from the left): **shipped**, raw PNG sha256 `27983a73836533b4a16da01f15ac1188f7ede8b942940bd5c501fb635324a9d8`
4. forward, quality high, 1024x1536: **shipped as the optional variant**, raw PNG sha256 `d012cc357495e6e49aab497d7c8398af29a39a52b518f956c4a7684160e3f1db`

The raw PNGs (about 5.7 MB each) are not committed. No night variant: dark mode already reuses the day picture on phone, and the wide one does the same, with the dark paper gradient at the bottom.

## Behaviour

- Header at md and up gets `min-h-[clamp(26rem,34vw,34rem)]` so the picture is a band, not a strip; the text column is unchanged.
- The wide picture sits on the start side, so `rtl:-scale-x-100` mirrors it for Hebrew.
- `sizes="(min-width: 1024px) calc(100vw - 72px), 1000px"`: on a tablet `object-cover` draws the picture about 1000 px wide, so the srcset must not pick 828.
- `?homebg=city` is unchanged at every width (no wide picture; its old pair and header height).
- Tests: `tests/home-view.test.tsx` (class and src contracts, file size and dimensions), `e2e/home-hero.spec.ts` (decoded width at least the device pixels covered at 768, 1440@2x and 1920; phone never requests the wide file).

## Not done

- Night variant of the wide picture, and a wide city picture (`?homebg=city` stays low resolution).
- The two-column wide Home layout (C4).
