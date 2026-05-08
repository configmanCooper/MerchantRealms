# Graphics Milestone 2 (v9p16)

**Date:** 2026-05-08
**Tag:** `graphics-milestone-2`
**Cache-bust version:** `v9p16`
**Builds on:** Milestone 1 (visual baseline) + 6 perf wins

## What this milestone represents

Visual quality of milestone 1 PLUS supervisor-approved color tweak
(20% darker + 20% extra contrast on grass/forest/hills) PLUS major
performance overhaul. Sustained pan now ~55 FPS, zoom in/out
responsive. Visually clean across full 21-shot capture
(zoom 1.5/2/2.5/3, pans, flat mode).

## Performance vs milestone 1 (3-sec sustained pan @ zoom 1.5, headless playwright, seed 12345)

| Metric | Pre-v9p12 baseline | Milestone 2 (v9p16) | Speedup |
|---|---|---|---|
| Pan avg | 67.77 ms | **18.19 ms** | **3.7x** |
| Pan p95 | 130.5 ms | **19.8 ms** | **6.6x** |
| Zoom / step | 108.51 ms | **46.7 ms** | **2.3x** |

Remaining: pan max ≈ 238 ms hitch every ~1.6 s of sustained pan when
the cache exhausts. Borderline-perceptible but no longer "terrible".

## Highlight changes baked into this milestone

Visual:
- v9p11 — `_darkenGrassForestHills` filter (20% darker + 20% contrast
  on tile IDs 1/2/4) + `_addGrassVariation` & `_addNoiseGrain` rewritten
  with smooth bilinear-interpolated macro grids (no more checker/grid)

Performance:
- v9p12 — Removed pan-driven `terrainDirty=true` trigger (was firing
  every ~6 screen px and bypassing the terrain cache entirely).
  Bumped `TERRAIN_MARGIN_HIGH` 6→24, `TERRAIN_MARGIN_NORMAL` 10→24.
- v9p13 — Terrain offscreen cache stored at world-px resolution; reused
  across all zoom changes except `DECORATION_SKIP_ZOOM` (0.65) crossing.
- v9p14 — Skip per-tile fallback loop entirely when all textures loaded.
- v9p15 — Global water depth cache (`_ensureGlobalDepth`); BFS runs
  once per terrain instead of per rebuild.
- v9p16 — Global forest tree placement cache (`_ensureForestTreeCache`);
  precomputed `Float32Array(10)` per forest tile. Was 75% of rebuild
  cost; now lookup + drawImage only.

## Diagnostic toggles available in code

- `window.__perfTrace = true` — enable per-pass timing into `__perfStats`
- `window.__noP11 = true` — disable v9p11 darken/contrast filter
- `window.__noNoiseGrain = true` — disable noise grain pass

## How to revert to this milestone

```powershell
cd C:\Users\rocma\CLI\MerchantRealms
git checkout graphics-milestone-2
# or, by commit:
git log --oneline | Select-String 'Graphics Milestone 2'
git checkout <that-sha>
```

To revert just the working tree without leaving your branch:

```powershell
git checkout graphics-milestone-2 -- js/render.js js/config.js index.html
```

If the tag is missing locally:

```powershell
git tag graphics-milestone-2 <commit-sha-from-this-doc>
```

## Files that define this milestone

- `js/render.js`              — all v9p11–v9p16 visual + perf passes
- `js/config.js`              — `TERRAIN_MARGIN_HIGH=24`, `TERRAIN_MARGIN_NORMAL=24`
- `index.html`                — script cache-bust `?v=v9p16`

## Commits since milestone 1

```
bedc9b0  v9p16: cache forest tree placements globally
60a6a77  v9p15: cache water depth map globally
193da03  v9p14: skip per-tile fallback loop when textures loaded
29091c3  v9p13: zoom 2.5x faster by reusing terrain cache
53b9019  v9p12: terrain pan perf 3.7x faster
e68cef5  v9p11: 20% darker + 20% contrast on grass/forest/hills, smooth bilinear noise
```

All commits are LOCAL only — never pushed to any remote.

## Known issues at milestone (next focus candidates)

- Pan max=238 ms hitch when terrain cache exhausts (every ~1.6 s of
  sustained pan). Eliminating it requires either async/streamed
  rebuild or copy-on-shift cache (both complex).
- Dead chunk code in `render.js` (`CHUNK_TILES`, `_buildTerrainChunk`,
  `_getTerrainChunk`, `_invalidateTerrainChunks`) — unused since
  v9p10c, candidate for cleanup.
- `__perfTrace` instrumentation lives in production render path
  (gated, cheap, but pollutes the legacy renderer code).
