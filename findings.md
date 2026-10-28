# Area-aware walk starts — findings

- The assistant prompt explicitly tells the model to ask “start there or drop the area rule” when it believes the origin is outside a town. It sees coarse coordinates but has no reliable town-membership result.
- `fetchTownBoundary` clamps towns/municipalities to 1.5 km around their centre for route search. That routing heuristic must not decide whether a person is in a municipality such as Binyamina–Giv'at Ada.
- `set_start` currently always replaces the origin with the selected candidate. The existing UI already syncs a changed assistant origin to the map/start picker.
- The existing server-written start-moved notice must remain intact. Unknown boundaries must not produce a false “outside” claim.
- Nominatim currently returns a Polygon for `בנימינה גבעת עדה, ישראל`, so membership can be checked without guessing from the municipality centre's coordinates. Live lookup inspected the geometry type only.
- Real-model evals confirm the updated prompt calls area-aware `set_start` and searches for places in the same turn in both inside/outside scenarios. No timer or automatic start of GPS navigation is involved.
- Repository baseline checks have unrelated failures: generated `.next-mobile` bundles are not excluded by the existing ESLint config, and `walk-history.ts` already imports a type from `WalkCompanionPanel.tsx` across the declared layer boundary.
