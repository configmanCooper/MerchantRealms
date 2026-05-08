# Graphics Milestone 1 (v9p09)

**Date:** 2026-05-07
**Tag:** `graphics-milestone-1`
**Cache-bust version:** `v9p09`

## What this milestone represents

Brown-grid pattern artifact across grass and water is **eliminated**.
Visual baseline accepted by supervisor: terrain looks clean, lush
grass + open water with smooth coastlines, no visible repeating-tile
seams. Performance is **NOT** part of this milestone (panning/zooming
is currently slow and is the next focus).

## Highlight changes baked into this milestone

- v9p03  single grass + water sprite, disabled `_smoothCoastlines`
- v9p05  mirror-tiled seamless source canvas (mostly superseded by v9p09)
- v9p08  disabled anisotropic river noise in `engine.js generateTerrain`
         + morphological erosion in `render.js init()` to clean up
         old grid-water tiles in pre-v9p08 saves
- v9p09  **`_fillTerrainTextured` uses solid color (`getTerrainColor`)
         for tile IDs 0/2/4 (grass/water/hills) instead of the
         mirror-tiled pattern fill** — this is what killed the brown
         grid. Mountain (3) + sand (5) keep per-tile sprite drawing.

Texture variation now comes only from post-process layers
(`_addGrassVariation`, `_addNoiseGrain`, `_renderWaterWithDepth`,
`_drawBeachFringe`, scattered trees, `_applyWarmOverlay`).

## How to revert to this milestone

```powershell
cd C:\Users\rocma\CLI\MerchantRealms
git fetch --tags
git checkout graphics-milestone-1
# or, by commit:
git log --oneline | Select-String 'Graphics Milestone 1'
git checkout <that-sha>
```

To revert just the working tree without leaving your branch:

```powershell
git checkout graphics-milestone-1 -- js/render.js js/engine.js index.html
```

If the tag is missing locally:

```powershell
git tag graphics-milestone-1 <commit-sha-from-this-doc>
```

## Files that define this milestone

- `js/render.js`              — `_fillTerrainTextured` solid-color path
- `js/engine.js`              — anisotropic river noise commented out
- `index.html`                — script cache-bust `?v=v9p09`
- `images/all_sprites/terrain_grass_lush.png`
- `images/all_sprites/terrain_water_deep_a.png`

## Known issues at milestone (next focus)

- Panning is sluggish (terrain cache rebuilds on every pan past margin)
- Zooming is sluggish (scene cache rebuild + texture re-pattern on each step)
- These are the targets for the next sprint (perf milestone)
