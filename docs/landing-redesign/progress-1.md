# Landing redesign, phase 1 (static re-skin, reused assets only)

Branch `feat/landing-cinematic`. Snapshot before: tag `traike-pre-redesign-2026-11-01` + ~/Downloads zip.

Done: new section structure and minimal copy, LandingHero (static phone + SVG route),
FloatingPropCard (compass, pin, boot overlap card top), PropParallax, BeforeAfter slider,
closing card. H1 "A walk built around you" kept (e2e/hydration.spec.ts).

Verified: tsc, eslint, hydration e2e (4 pass), screenshots 1440 and 390 via scripts/landing/shoot.mjs.
Not yet: contrast numbers, reduced-motion check, 360/1280/1920 viewports, real-phone check.

Stand-ins to replace in phase 2: hero plate (tent photo), SVG map paper, closing card image
(becomes a video in phase 4). Feature cards have no props yet (binoculars, signpost, watch, backpack are generated in phase 2).
TODO(launch gate): testimonials may not be real quotes.
