// ============================================================
// Merchant Realms — Canvas Rendering, Camera, Minimap
// ============================================================

window.Renderer = (function () {
    'use strict';

    // ── Canvas & context references ──
    let canvas, ctx;
    let minimapCanvas, minimapCtx;
    let offscreenTerrain, offscreenCtx; // cached terrain layer

    // ── Camera state ──
    const camera = {
        x: 0, y: 0,           // world position (center of viewport)
        targetX: 0, targetY: 0,
        zoom: CONFIG.CAMERA_ZOOM_DEFAULT,
        targetZoom: CONFIG.CAMERA_ZOOM_DEFAULT,
        minZoom: CONFIG.CAMERA_ZOOM_MIN,
        maxZoom: CONFIG.CAMERA_ZOOM_MAX,
        lerpSpeed: 0.12,
        width: 0,
        height: 0,
    };

    // ── Map mode state ──
    let mapMode = 0; // 0=normal, 1=strategic, 2=world
    let savedZoom = CONFIG.CAMERA_ZOOM_DEFAULT;
    let savedCamX = 0;
    let savedCamY = 0;
    let worldMapCanvas = null;
    let worldMapCtx = null;
    let worldMapCached = null; // offscreen canvas for cached world map render
    let worldMapDirty = true;

    // ── Cached state ──
    let terrainDirty = true;
    let lastTerrainZoom = -1;
    let lastTerrainCamX = -9999;
    let lastTerrainCamY = -9999;
    // Overscroll terrain cache: render extra margin so small pans reuse the buffer
    let _terrainCacheStartCol = 0;
    let _terrainCacheStartRow = 0;
    let _terrainCacheEndCol = 0;
    let _terrainCacheEndRow = 0;

    // ── Full-scene snapshot cache (low zoom optimization) ──
    // At zoom < 1.0, we render the entire visible scene (terrain + overlays + towns + roads)
    // onto a large offscreen canvas with margin, then just blit-shift on pan.
    let _sceneCache = null;       // offscreen canvas
    let _sceneCacheCtx = null;
    let _sceneCacheDirty = true;
    let _sceneCacheZoom = -1;
    let _sceneCacheCamX = -9999;
    let _sceneCacheCamY = -9999;
    // World-coordinate bounds of what the scene cache covers
    let _sceneCacheLeft = 0;
    let _sceneCacheTop = 0;
    let _sceneCacheRight = 0;
    let _sceneCacheBottom = 0;
    // Zoom stability tracking — only use scene cache when zoom is stable
    let _zoomStableFrames = 0;
    let _lastCheckedZoom = -1;

    let worldData = null;
    let frameCount = 0;
    let _npcAnimTime = 0; // Game-speed-driven animation clock for NPC movement
    let _lastFrameTimestamp = 0;
    let hoverTarget = null; // { type, id, x, y }
    let selectedTarget = null;
    let _lastSeason = null; // Track season for terrain color changes

    // ── Minimap cache (redrawn once per game day) ──
    let _minimapCacheCanvas = null;
    let _minimapCacheDirty = true;
    let _minimapCacheDay = -1;
    let _minimapTerrainCanvas = null; // Permanent terrain cache — never changes after init
    let showDeposits = false; // toggled by player with Regional Survey skill
    let showFertility = false; // toggled by player with Soil Knowledge skill
    let _surveyCircle = null; // { type: 'fertility'|'deposits', wx, wy, startFrame, duration }

    // ── Caravan position cache for hit testing ──
    var _caravanPositions = []; // [{id, x, y, caravan}]

    // ── Per-frame render cache (avoid repeated Engine calls) ──
    let _frameTowns = null;
    let _frameTownMap = null;
    let _frameKingdoms = null;

    // ── Tile variation hash cache ──
    const tileHashCache = {};
    let tileHashCacheSize = 0;
    function tileHash(x, y) {
        const key = x * 7919 + y;
        if (tileHashCache[key] !== undefined) return tileHashCache[key];
        if (tileHashCacheSize > 10000) {
            for (const k in tileHashCache) delete tileHashCache[k];
            tileHashCacheSize = 0;
        }
        let h = ((key * 2654435761) >>> 0) / 4294967296;
        tileHashCache[key] = h;
        tileHashCacheSize++;
        return h;
    }

    // ── Color helpers ──
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }

    function rgbShift(hex, amount) {
        const { r, g, b } = hexToRgb(hex);
        const clamp = v => Math.max(0, Math.min(255, v));
        return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
    }

    function colorWithAlpha(hex, a) {
        const { r, g, b } = hexToRgb(hex);
        return `rgba(${r},${g},${b},${a})`;
    }

    // ── Terrain color look-up ──
    const terrainColors = {};
    // Winter-tinted terrain: grass/forest/hills get desaturated, lighter, frosty
    const _winterTerrainOverrides = {
        0: '#7a9a78', // Grass: faded pale green
        1: '#4a6e50', // Forest: muted cold green
        4: '#8a9a7e', // Hills: faded grey-green
    };
    function getTerrainColor(id) {
        var isWinter = (typeof Engine !== 'undefined' && Engine.getSeason && Engine.getSeason() === 'Winter');
        if (isWinter && _winterTerrainOverrides[id]) return _winterTerrainOverrides[id];
        if (terrainColors[id]) return terrainColors[id];
        for (const key in TERRAIN) {
            if (TERRAIN[key].id === id) {
                terrainColors[id] = TERRAIN[key].color;
                return TERRAIN[key].color;
            }
        }
        return '#333';
    }

    // ── Season tint ──
    function getSeasonTint() {
        if (typeof Engine === 'undefined' || !Engine.getSeason) return null;
        const s = Engine.getSeason();
        switch (s) {
            case 'Spring': return { r: 20, g: 40, b: 10, a: 0.06 };
            case 'Summer': return { r: 30, g: 20, b: 0, a: 0.04 };
            case 'Autumn': return { r: 50, g: 30, b: 0, a: 0.08 };
            case 'Winter': return { r: 20, g: 30, b: 60, a: 0.10 };
        }
        return null;
    }

    // ── Day/night overlay ──
    function getDayNightAlpha() {
        if (typeof Engine === 'undefined' || !Engine.getDay) return 0;
        const day = Engine.getDay() || 0;
        // simulate day/night within each day
        const phase = (day % 1) || 0; // fractional part
        return 0; // subtle: we'll dim slightly in the render pass based on day count parity
    }

    // ═══════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════

    function init(canvasEl, world) {
        canvas = canvasEl || document.getElementById('gameCanvas');
        if (!canvas) { console.error('Render.init: canvas element not found'); return; }
        ctx = canvas.getContext('2d');
        minimapCanvas = document.getElementById('minimapCanvas');
        if (minimapCanvas) minimapCtx = minimapCanvas.getContext('2d');

        worldData = world;
        _minimapTerrainCanvas = null; // Rebuild terrain cache for new world
        resize();
        window.removeEventListener('resize', resize);
        window.addEventListener('resize', resize);

        // Center camera on player town
        centerOnPlayer();

        terrainDirty = true;
        _sceneCacheDirty = true;
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        camera.width = canvas.width;
        camera.height = canvas.height;
        terrainDirty = true;
        _sceneCacheDirty = true;
    }

    function centerOnPlayer() {
        if (typeof Player === 'undefined') return;

        // If traveling, center on interpolated position along route
        if (Player.traveling && Player.travelProgress != null) {
            const route = Player.travelRoute || [];
            const progress = Player.travelProgress || 0;
            if (route.length >= 2) {
                let totalDist = 0;
                const segDists = [];
                for (let i = 1; i < route.length; i++) {
                    const d = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
                    segDists.push(d);
                    totalDist += d;
                }
                if (totalDist > 0) {
                    let targetDist = progress * totalDist;
                    let accumulated = 0;
                    let px = route[0].x, py = route[0].y;
                    for (let i = 0; i < segDists.length; i++) {
                        if (accumulated + segDists[i] >= targetDist) {
                            const sp = (targetDist - accumulated) / segDists[i];
                            px = route[i].x + (route[i + 1].x - route[i].x) * sp;
                            py = route[i].y + (route[i + 1].y - route[i].y) * sp;
                            break;
                        }
                        accumulated += segDists[i];
                        px = route[i + 1].x;
                        py = route[i + 1].y;
                    }
                    camera.targetX = px;
                    camera.targetY = py;
                    camera.x = camera.targetX;
                    camera.y = camera.targetY;
                    return;
                }
            }
            // Fallback: linear interpolation between origin and destination
            let originTown, destTown;
            try { originTown = Engine.getTown(Player.travelOrigin || Player.townId); } catch (e) { /* no-op */ }
            try { destTown = Engine.getTown(Player.travelDestination); } catch (e) { /* no-op */ }
            if (originTown && destTown) {
                camera.targetX = originTown.x + (destTown.x - originTown.x) * progress;
                camera.targetY = originTown.y + (destTown.y - originTown.y) * progress;
                camera.x = camera.targetX;
                camera.y = camera.targetY;
                return;
            }
        }

        // Wilderness (stopped on road, no townId)
        if (!Player.townId && Player.worldX != null && Player.worldY != null) {
            camera.targetX = Player.worldX;
            camera.targetY = Player.worldY;
            camera.x = camera.targetX;
            camera.y = camera.targetY;
            return;
        }

        // At a town
        const townId = Player.townId;
        if (townId == null) return;
        let town = null;
        try { town = Engine.getTown(townId); } catch (e) { /* no-op */ }
        if (!town) {
            const towns = Engine.getTowns ? Engine.getTowns() : [];
            town = towns.find(t => t.id === townId);
        }
        if (town) {
            camera.targetX = town.x;
            camera.targetY = town.y;
            camera.x = camera.targetX;
            camera.y = camera.targetY;
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CAMERA
    // ═══════════════════════════════════════════════════════════

    function updateCamera() {
        var panLerp = CONFIG.CAMERA_PAN_LERP;
        camera.x += (camera.targetX - camera.x) * panLerp;
        camera.y += (camera.targetY - camera.y) * panLerp;
        if (Math.abs(camera.targetX - camera.x) < CONFIG.CAMERA_PAN_SNAP) camera.x = camera.targetX;
        if (Math.abs(camera.targetY - camera.y) < CONFIG.CAMERA_PAN_SNAP) camera.y = camera.targetY;
        // Extra fast at low zoom where scene cache transitions are more noticeable
        var zoomLerp = (camera.zoom < 1.0 || camera.targetZoom < 1.0) ? CONFIG.CAMERA_ZOOM_LERP_LOW : CONFIG.CAMERA_ZOOM_LERP_NORMAL;
        camera.zoom += (camera.targetZoom - camera.zoom) * zoomLerp;
        if (Math.abs(camera.targetZoom - camera.zoom) < CONFIG.CAMERA_ZOOM_SNAP) camera.zoom = camera.targetZoom;

        // Clamp to world bounds
        const worldPxW = CONFIG.WORLD_WIDTH;
        const worldPxH = CONFIG.WORLD_HEIGHT;
        const halfW = (camera.width / camera.zoom) / 2;
        const halfH = (camera.height / camera.zoom) / 2;

        camera.x = Math.max(halfW, Math.min(worldPxW - halfW, camera.x));
        camera.y = Math.max(halfH, Math.min(worldPxH - halfH, camera.y));
        camera.targetX = Math.max(halfW, Math.min(worldPxW - halfW, camera.targetX));
        camera.targetY = Math.max(halfH, Math.min(worldPxH - halfH, camera.targetY));

        // Check if terrain needs redraw
        const dz = Math.abs(camera.zoom - lastTerrainZoom);
        const dx = Math.abs(camera.x - lastTerrainCamX);
        const dy = Math.abs(camera.y - lastTerrainCamY);
        // At low zoom, generous threshold since terrain cache has large margin tiles
        // At mid zoom (1.0-1.5), slightly increased threshold for perf
        const panThreshold = camera.zoom < 0.5 ? CONFIG.PAN_THRESHOLD_EXTREME : camera.zoom < 0.7 ? CONFIG.PAN_THRESHOLD_LOW : camera.zoom < 1.0 ? CONFIG.PAN_THRESHOLD_MEDIUM : camera.zoom < 1.5 ? CONFIG.PAN_THRESHOLD_NORMAL : CONFIG.PAN_THRESHOLD_HIGH;
        if (dz > 0.005 || dx > panThreshold || dy > panThreshold) {
            terrainDirty = true;
        }
        // Scene cache invalidation is handled in _renderViaSceneCache via bounds check
    }

    function pan(dx, dy) {
        camera.targetX += dx / camera.zoom;
        camera.targetY += dy / camera.zoom;
    }

    function zoomAt(delta, mx, my) {
        const factor = delta > 0 ? 0.9 : 1.1;
        var minZ = camera.minZoom;
        // Enforce minimum zoom based on game speed
        if (typeof Game !== 'undefined' && Game.getSpeed) {
            var spd = Game.getSpeed();
            if (spd >= 16) minZ = Math.max(minZ, 1.5);
            else if (spd >= 4) minZ = Math.max(minZ, 1.0);
        }
        camera.targetZoom = Math.max(minZ,
            Math.min(camera.maxZoom, camera.targetZoom * factor));
    }

    function setZoom(z) {
        var minZ = camera.minZoom;
        if (typeof Game !== 'undefined' && Game.getSpeed) {
            var spd = Game.getSpeed();
            if (spd >= 16) minZ = Math.max(minZ, 1.5);
            else if (spd >= 4) minZ = Math.max(minZ, 1.0);
        }
        camera.targetZoom = Math.max(minZ, Math.min(camera.maxZoom, z));
    }

    function panTo(worldX, worldY) {
        camera.targetX = worldX;
        camera.targetY = worldY;
    }

    // Screen → World coordinate conversion
    function screenToWorld(sx, sy) {
        const wx = (sx - camera.width / 2) / camera.zoom + camera.x;
        const wy = (sy - camera.height / 2) / camera.zoom + camera.y;
        return { x: wx, y: wy };
    }

    function worldToScreen(wx, wy) {
        const sx = (wx - camera.x) * camera.zoom + camera.width / 2;
        const sy = (wy - camera.y) * camera.zoom + camera.height / 2;
        return { x: sx, y: sy };
    }

    // ═══════════════════════════════════════════════════════════
    //  VIEWPORT CULLING
    // ═══════════════════════════════════════════════════════════

    function getVisibleBounds() {
        const halfW = (camera.width / camera.zoom) / 2;
        const halfH = (camera.height / camera.zoom) / 2;
        return {
            left: camera.x - halfW,
            right: camera.x + halfW,
            top: camera.y - halfH,
            bottom: camera.y + halfH,
        };
    }

    function isVisible(wx, wy, margin) {
        margin = margin || 0;
        const vb = getVisibleBounds();
        return wx >= vb.left - margin && wx <= vb.right + margin &&
               wy >= vb.top - margin && wy <= vb.bottom + margin;
    }

    // ── Event indicator emojis for map town labels ──
    function _getTownEventIndicators(townId) {
        let indicators = '';
        try {
            for (let ki = 0; ki < _frameKingdoms.length; ki++) {
                const k = _frameKingdoms[ki];
                // Festival
                if (k._activeFestivals && k._activeFestivals.length > 0) {
                    for (let fi = 0; fi < k._activeFestivals.length; fi++) {
                        if (k._activeFestivals[fi].townId === townId) { indicators += '🎪'; break; }
                    }
                }
                // Feast
                if (k._activeFeast && k._activeFeast.townId === townId) { indicators += '🍷'; }
                // Court (active interactive session or formal court)
                if ((k._activeCourtSession || k._courtSession) && (k.capital === townId || k.capitalTownId === townId)) { indicators += '⚖️'; }
                // Tournament
                if (k.tournament && k.tournament.active && k.tournament.townId === townId) { indicators += '⚔️'; }
            }
        } catch (e) { /* ignore */ }
        return indicators;
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER — MAIN ENTRY
    // ═══════════════════════════════════════════════════════════

    function render(world, player) {
        worldData = world || worldData;
        if (!worldData || !ctx) return;

        frameCount++;
        // Check for season change — redraw terrain if needed
        var _curSeason = (typeof Engine !== 'undefined' && Engine.getSeason) ? Engine.getSeason() : null;
        if (_curSeason !== _lastSeason) {
            terrainDirty = true;
            _sceneCacheDirty = true;
            _lastSeason = _curSeason;
        }
        // Periodically refresh scene cache to pick up game state changes (territory, towns)
        // Every ~300 frames ≈ 5 seconds at 60fps
        if (camera.zoom < 1.0 && (frameCount % CONFIG.SCENE_CACHE_REFRESH === 0)) {
            _sceneCacheDirty = true;
        }
        // Advance NPC animation clock based on game speed (NPCs freeze when paused)
        var now = performance.now();
        if (_lastFrameTimestamp > 0) {
            var dt = (now - _lastFrameTimestamp) / 1000; // seconds since last frame
            var gameSpeed = (typeof Game !== 'undefined' && Game.getSpeed) ? Game.getSpeed() : 0;
            if (gameSpeed > 0) {
                _npcAnimTime += dt * 0.056 * gameSpeed;
            }
        }
        _lastFrameTimestamp = now;
        updateCamera();

        // Cache towns/kingdoms for this frame to avoid repeated Engine calls
        _frameTowns = Engine.getTowns ? Engine.getTowns() : [];
        _frameTownMap = {};
        for (let i = 0; i < _frameTowns.length; i++) {
            _frameTownMap[_frameTowns[i].id] = _frameTowns[i];
        }
        _frameKingdoms = Engine.getKingdoms ? Engine.getKingdoms() : [];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ── LOW ZOOM PATH (zoom < 1.0) ──
        if (camera.zoom < 1.0) {
            // Track zoom stability — scene cache only kicks in after zoom stops changing
            if (Math.abs(camera.zoom - _lastCheckedZoom) > 0.003) {
                _zoomStableFrames = 0;
                _lastCheckedZoom = camera.zoom;
            } else {
                _zoomStableFrames++;
            }

            // If zoom is still transitioning, use lightweight direct render (no scene cache)
            // This avoids the expensive full-scene rebuild on every frame during zoom lerp
            if (_zoomStableFrames < CONFIG.SCENE_CACHE_STABLE_FRAMES) {
                _renderLowZoomDirect(player);
                return;
            }

            // Zoom is stable — use the scene snapshot cache for buttery-smooth panning
            _renderViaSceneCache(player);
            return;
        }

        // Reset zoom stability when not in low-zoom mode
        _zoomStableFrames = 0;
        _lastCheckedZoom = -1;
        _sceneCacheDirty = true;

        // ── NORMAL RENDER (zoom >= 1.0) ──
        ctx.save();

        // Apply camera transform
        ctx.translate(camera.width / 2, camera.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        // 1. Terrain
        renderTerrain();

        // 2. Kingdom territories
        renderKingdomTerritories();

        // 3. Roads
        renderRoads();

        // 3b. Sea routes
        renderSeaRoutes();

        // 4. Towns
        renderTowns();

        // 4a. Strategic map overlays (Mode 1)
        if (mapMode === 1) {
            renderStrategicTownOverlays();
        }

        // 4b-4e: Overlays (skip fertility/deposits/survey at 1.0-1.5 for perf)
        var midZoom = camera.zoom < 1.5;
        if (!midZoom) {
            renderEliteMerchantIcons();
            renderFertility();
            renderDeposits();
            renderSurveyCircle();
        } else {
            // At 1.0-1.5x, still render elite merchant icons (useful) but skip others
            renderEliteMerchantIcons();
        }

        // 5. People (only when zoomed in)
        if (camera.zoom > 1.5) {
            renderPeople();
        }

        // 6. Caravans
        renderCaravans(player);

        // 6b. Marching armies
        renderArmies();

        // 7. Player marker
        renderPlayerMarker(player);

        // 9. War indicators
        renderWarIndicators();

        // 10. Event effects (skip at mid-zoom for slight perf gain)
        if (!midZoom) {
            renderEventEffects();
        }

        // Hover highlight
        renderHoverHighlight();

        ctx.restore();

        // Seasonal tint overlay
        renderSeasonOverlay();

        // Minimap
        renderMinimap(player);
    }

    // ═══════════════════════════════════════════════════════════
    //  LOW-ZOOM DIRECT RENDER (during zoom transitions)
    //  Lightweight — uses terrain cache + simplified overlays
    //  No scene snapshot, so zoom changes are cheap
    // ═══════════════════════════════════════════════════════════

    function _renderLowZoomDirect(player) {
        ctx.save();
        ctx.translate(camera.width / 2, camera.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        renderTerrain();
        renderKingdomTerritories();
        renderRoads();
        renderSeaRoutes();
        renderTowns();
        if (mapMode === 1) renderStrategicTownOverlays();
        renderCaravansSimple(player);
        renderArmiesSimple();
        renderPlayerMarker(player);
        renderHoverHighlight();

        ctx.restore();
        renderSeasonOverlay();
        renderMinimap(player);
    }

    // ═══════════════════════════════════════════════════════════
    //  SCENE SNAPSHOT (zoom < 1.0) — overlay cache approach
    //  Terrain uses its own existing cache; this caches ONLY
    //  territories + roads + sea routes + towns + caravans
    //  as a transparent overlay, making cache build very fast.
    // ═══════════════════════════════════════════════════════════

    function _renderViaSceneCache(player) {
        var vb = getVisibleBounds();
        // 110% margin in each direction — can pan over a full viewport before needing redraw
        var marginW = (vb.right - vb.left) * CONFIG.SCENE_CACHE_MARGIN;
        var marginH = (vb.bottom - vb.top) * CONFIG.SCENE_CACHE_MARGIN;

        // Check if current viewport is still within cached overlay bounds
        var needsRedraw = _sceneCacheDirty || !_sceneCache;
        if (!needsRedraw && Math.abs(camera.zoom - _sceneCacheZoom) > 0.005) needsRedraw = true;
        if (!needsRedraw && (
            vb.left < _sceneCacheLeft || vb.right > _sceneCacheRight ||
            vb.top < _sceneCacheTop || vb.bottom > _sceneCacheBottom
        )) needsRedraw = true;

        // On cache miss from fast pan, use direct render this frame and rebuild next frame
        if (needsRedraw && _sceneCache && !_sceneCacheDirty &&
            Math.abs(camera.zoom - _sceneCacheZoom) <= 0.005) {
            _sceneCacheDirty = true;
            _renderLowZoomDirect(player);
            return;
        }

        if (needsRedraw) {
            // Compute scene bounds with margin
            var scLeft = vb.left - marginW;
            var scTop = vb.top - marginH;
            var scRight = vb.right + marginW;
            var scBottom = vb.bottom + marginH;

            // Clamp to world bounds
            var worldW = CONFIG.WORLD_WIDTH || 4000;
            var worldH = CONFIG.WORLD_HEIGHT || 4000;
            if (scLeft < 0) scLeft = 0;
            if (scTop < 0) scTop = 0;
            if (scRight > worldW) scRight = worldW;
            if (scBottom > worldH) scBottom = worldH;

            var sceneW = Math.ceil((scRight - scLeft) * camera.zoom);
            var sceneH = Math.ceil((scBottom - scTop) * camera.zoom);

            // Cap canvas size to avoid huge memory (max ~4096px in each dimension)
            var maxDim = 4096;
            if (sceneW > maxDim) {
                var scaleX = maxDim / sceneW;
                scLeft = vb.left - marginW * scaleX;
                scRight = vb.right + marginW * scaleX;
                if (scLeft < 0) scLeft = 0;
                if (scRight > worldW) scRight = worldW;
                sceneW = Math.ceil((scRight - scLeft) * camera.zoom);
            }
            if (sceneH > maxDim) {
                var scaleY = maxDim / sceneH;
                scTop = vb.top - marginH * scaleY;
                scBottom = vb.bottom + marginH * scaleY;
                if (scTop < 0) scTop = 0;
                if (scBottom > worldH) scBottom = worldH;
                sceneH = Math.ceil((scBottom - scTop) * camera.zoom);
            }

            if (!_sceneCache) {
                _sceneCache = document.createElement('canvas');
                _sceneCacheCtx = _sceneCache.getContext('2d');
            }
            if (_sceneCache.width !== sceneW || _sceneCache.height !== sceneH) {
                _sceneCache.width = sceneW;
                _sceneCache.height = sceneH;
            }

            // Render ONLY overlay layers (no terrain — terrain has its own cache)
            var sctx = _sceneCacheCtx;
            sctx.clearRect(0, 0, sceneW, sceneH);
            sctx.save();
            sctx.scale(camera.zoom, camera.zoom);
            sctx.translate(-scLeft, -scTop);

            // Temporarily widen camera so render functions see the full scene cache area
            var savedCamX2 = camera.x;
            var savedCamY2 = camera.y;
            var savedCamW = camera.width;
            var savedCamH = camera.height;
            var savedCtx = ctx;
            ctx = sctx;
            camera.x = (scLeft + scRight) / 2;
            camera.y = (scTop + scBottom) / 2;
            camera.width = sceneW;
            camera.height = sceneH;

            // Overlay layers only — much faster than full scene with terrain
            renderKingdomTerritories();
            renderRoads();
            renderSeaRoutes();
            renderTowns();
            if (mapMode === 1) renderStrategicTownOverlays();
            renderCaravansSimple(player);
            renderArmiesSimple();
            sctx.restore();

            // Restore main ctx and camera
            ctx = savedCtx;
            camera.x = savedCamX2;
            camera.y = savedCamY2;
            camera.width = savedCamW;
            camera.height = savedCamH;

            _sceneCacheLeft = scLeft;
            _sceneCacheTop = scTop;
            _sceneCacheRight = scRight;
            _sceneCacheBottom = scBottom;
            _sceneCacheZoom = camera.zoom;
            _sceneCacheCamX = camera.x;
            _sceneCacheCamY = camera.y;
            _sceneCacheDirty = false;
        }

        // Render frame: terrain (own cache) + overlay (scene cache) + dynamic elements
        ctx.save();
        ctx.translate(camera.width / 2, camera.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);

        // 1. Terrain — uses its own offscreen cache with margin-based invalidation
        renderTerrain();

        ctx.restore();

        // 2. Blit cached overlay (territories + roads + towns) on top of terrain
        var sx = (vb.left - _sceneCacheLeft) * camera.zoom;
        var sy = (vb.top - _sceneCacheTop) * camera.zoom;
        ctx.drawImage(_sceneCache, sx, sy, camera.width, camera.height, 0, 0, camera.width, camera.height);

        // 3. Dynamic elements on top (player marker + hover)
        ctx.save();
        ctx.translate(camera.width / 2, camera.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);
        renderPlayerMarker(player);
        renderHoverHighlight();
        ctx.restore();

        // Seasonal tint overlay
        renderSeasonOverlay();

        // Minimap
        renderMinimap(player);
    }

    // ═══════════════════════════════════════════════════════════
    //  1. TERRAIN
    // ═══════════════════════════════════════════════════════════

    function renderTerrain() {
        var terrain = worldData.terrain;
        if (!terrain || !terrain.length) return;

        var ts = CONFIG.TILE_SIZE;
        var terrainWidth = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
        var terrainHeight = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);
        var vb = getVisibleBounds();

        var startCol = Math.max(0, Math.floor(vb.left / ts));
        var endCol = Math.min(terrainWidth - 1, Math.ceil(vb.right / ts));
        var startRow = Math.max(0, Math.floor(vb.top / ts));
        var endRow = Math.min(terrainHeight - 1, Math.ceil(vb.bottom / ts));

        // Check if viewport is still within cached overscroll region
        var needsRedraw = terrainDirty || !offscreenTerrain;
        if (!needsRedraw && (
            startCol < _terrainCacheStartCol || endCol > _terrainCacheEndCol ||
            startRow < _terrainCacheStartRow || endRow > _terrainCacheEndRow
        )) {
            needsRedraw = true;
        }

        if (needsRedraw) {
            // Render with overscroll margin so small pans are free (no redraw)
            var marginTiles = camera.zoom < 0.5 ? CONFIG.TERRAIN_MARGIN_EXTREME : camera.zoom < 0.7 ? CONFIG.TERRAIN_MARGIN_LOW : camera.zoom < 1.0 ? CONFIG.TERRAIN_MARGIN_MEDIUM : camera.zoom < 1.5 ? CONFIG.TERRAIN_MARGIN_NORMAL : CONFIG.TERRAIN_MARGIN_HIGH;
            var cSC = Math.max(0, startCol - marginTiles);
            var cEC = Math.min(terrainWidth - 1, endCol + marginTiles);
            var cSR = Math.max(0, startRow - marginTiles);
            var cER = Math.min(terrainHeight - 1, endRow + marginTiles);

            var drawW = (cEC - cSC + 1) * ts;
            var drawH = (cER - cSR + 1) * ts;

            if (!offscreenTerrain) {
                offscreenTerrain = document.createElement('canvas');
                offscreenCtx = offscreenTerrain.getContext('2d');
            }
            if (offscreenTerrain.width !== drawW || offscreenTerrain.height !== drawH) {
                offscreenTerrain.width = drawW;
                offscreenTerrain.height = drawH;
            }

            var lowZoom = camera.zoom < CONFIG.DECORATION_SKIP_ZOOM;
            var _isWinterSeason = (typeof Engine !== 'undefined' && Engine.getSeason && Engine.getSeason() === 'Winter');

            for (var r = cSR; r <= cER; r++) {
                for (var c = cSC; c <= cEC; c++) {
                    var tileId = terrain[r * terrainWidth + c];
                    var baseColor = getTerrainColor(tileId);
                    var h = tileHash(c, r);
                    var shift = Math.floor((h - 0.5) * 20);
                    var x = (c - cSC) * ts;
                    var y = (r - cSR) * ts;

                    offscreenCtx.fillStyle = rgbShift(baseColor, shift);
                    offscreenCtx.fillRect(x, y, ts, ts);

                    // Skip decorations at very low zoom — barely visible
                    if (lowZoom) continue;

                    if (tileId === 1) { // Forest
                        var treeCount = 1 + Math.floor(h * 2);
                        offscreenCtx.fillStyle = rgbShift(_isWinterSeason ? '#3a5a48' : '#1a4020', shift);
                        for (var t = 0; t < treeCount; t++) {
                            var tx = x + (h * 37 + t * 5.7) % ts;
                            var ty = y + (h * 23 + t * 7.3) % ts;
                            var sz = 3 + h * 3;
                            offscreenCtx.beginPath();
                            offscreenCtx.moveTo(tx, ty - sz);
                            offscreenCtx.lineTo(tx - sz * 0.6, ty + sz * 0.4);
                            offscreenCtx.lineTo(tx + sz * 0.6, ty + sz * 0.4);
                            offscreenCtx.closePath();
                            offscreenCtx.fill();
                        }
                    } else if (tileId === 2) { // Water — static overlay (no wave anim in cache)
                        offscreenCtx.fillStyle = 'rgba(180,220,255,0.08)';
                        offscreenCtx.fillRect(x, y, ts, ts);
                    } else if (tileId === 3) { // Mountain
                        offscreenCtx.fillStyle = rgbShift('#6b5b4f', shift);
                        var mx = x + ts * 0.5;
                        var my = y + ts * 0.2;
                        offscreenCtx.beginPath();
                        offscreenCtx.moveTo(mx, my);
                        offscreenCtx.lineTo(x + ts * 0.2, y + ts * 0.9);
                        offscreenCtx.lineTo(x + ts * 0.8, y + ts * 0.9);
                        offscreenCtx.closePath();
                        offscreenCtx.fill();
                        if (_isWinterSeason || h > 0.6) {
                            offscreenCtx.fillStyle = 'rgba(240,240,255,0.6)';
                            offscreenCtx.beginPath();
                            offscreenCtx.moveTo(mx, my);
                            offscreenCtx.lineTo(mx - ts * 0.12, my + ts * 0.2);
                            offscreenCtx.lineTo(mx + ts * 0.12, my + ts * 0.2);
                            offscreenCtx.closePath();
                            offscreenCtx.fill();
                        }
                    } else if (tileId === 4) { // Hills
                        offscreenCtx.fillStyle = rgbShift(_isWinterSeason ? '#7a8a6a' : '#5a7a42', shift - 8);
                        offscreenCtx.beginPath();
                        offscreenCtx.arc(x + ts * 0.35, y + ts * 0.65, ts * 0.25, Math.PI, 0);
                        offscreenCtx.fill();
                        offscreenCtx.beginPath();
                        offscreenCtx.arc(x + ts * 0.7, y + ts * 0.55, ts * 0.2, Math.PI, 0);
                        offscreenCtx.fill();
                    }
                }
            }

            _terrainCacheStartCol = cSC;
            _terrainCacheEndCol = cEC;
            _terrainCacheStartRow = cSR;
            _terrainCacheEndRow = cER;

            terrainDirty = false;
            lastTerrainZoom = camera.zoom;
            lastTerrainCamX = camera.x;
            lastTerrainCamY = camera.y;
        }

        // Blit cached terrain to main canvas (offset by cache origin)
        ctx.drawImage(offscreenTerrain, _terrainCacheStartCol * ts, _terrainCacheStartRow * ts);
    }

    // ═══════════════════════════════════════════════════════════
    //  2. KINGDOM TERRITORIES
    // ═══════════════════════════════════════════════════════════

    function renderKingdomTerritories() {
        const kingdoms = _frameKingdoms;
        if (!kingdoms || !kingdoms.length) return;

        const towns = _frameTowns;
        if (!towns || !towns.length) return;

        const ts = CONFIG.TILE_SIZE;
        const vb = getVisibleBounds();
        const radius = 12; // territory radius in tiles around each town
        const lowZoom = camera.zoom < 1.0; // Perf opt: use arc fill instead of per-tile at low zoom

        for (const kingdom of kingdoms) {
            const kColor = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];
            const kTowns = towns.filter(t => t.kingdomId === kingdom.id);

            ctx.fillStyle = colorWithAlpha(kColor, mapMode === 1 ? 0.18 : 0.10);

            if (lowZoom) {
                // Perf opt 1: single arc fill per town instead of per-tile fillRect
                for (const town of kTowns) {
                    const tr = (radius + Math.floor((town.population || 100) / 80)) * ts;
                    if (!isVisible(town.x, town.y, tr + 100)) continue;
                    ctx.beginPath();
                    ctx.arc(town.x, town.y, tr, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                const terrainWidth = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / ts);
                const terrainHeight = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / ts);

                for (const town of kTowns) {
                    const tcx = Math.floor(town.x / ts);
                    const tcy = Math.floor(town.y / ts);
                    const r = radius + Math.floor((town.population || 100) / 80);

                    const startC = Math.max(0, tcx - r);
                    const endC = Math.min(terrainWidth - 1, tcx + r);
                    const startR = Math.max(0, tcy - r);
                    const endR = Math.min(terrainHeight - 1, tcy + r);

                    for (let row = startR; row <= endR; row++) {
                        for (let col = startC; col <= endC; col++) {
                            const px = col * ts;
                            const py = row * ts;
                            if (px < vb.left - ts || px > vb.right + ts ||
                                py < vb.top - ts || py > vb.bottom + ts) continue;

                            const dist = Math.sqrt((col - tcx) ** 2 + (row - tcy) ** 2);
                            if (dist <= r) {
                                ctx.fillRect(px, py, ts, ts);
                            }
                        }
                    }
                }
            }

            // Territory border — draw dotted outline around outermost territory tiles
            ctx.strokeStyle = colorWithAlpha(kColor, 0.35);
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1.5;

            for (const town of kTowns) {
                const cx = town.x;
                const cy = town.y;
                const tr = (radius + Math.floor((town.population || 100) / 80)) * ts;
                if (!isVisible(cx, cy, tr + 100)) continue;

                ctx.beginPath();
                ctx.arc(cx, cy, tr, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  3. ROADS
    // ═══════════════════════════════════════════════════════════

    function renderRoads() {
        let roads;
        try { roads = Engine.getRoads(); } catch (e) { return; }
        if (!roads) return;

        const towns = _frameTowns;
        if (!towns) return;

        const townMap = _frameTownMap;
        const ts = CONFIG.TILE_SIZE;

        // Helper: draw a Catmull-Rom spline through waypoints
        function drawWaypointPath(pts) {
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            if (pts.length === 2) {
                ctx.lineTo(pts[1].x, pts[1].y);
            } else {
                for (var i = 0; i < pts.length - 1; i++) {
                    var p0 = pts[i === 0 ? 0 : i - 1];
                    var p1 = pts[i];
                    var p2 = pts[i + 1];
                    var p3 = pts[i + 1 >= pts.length - 1 ? pts.length - 1 : i + 2];
                    var cp1x = p1.x + (p2.x - p0.x) / 6;
                    var cp1y = p1.y + (p2.y - p0.y) / 6;
                    var cp2x = p2.x - (p3.x - p1.x) / 6;
                    var cp2y = p2.y - (p3.y - p1.y) / 6;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                }
            }
            ctx.stroke();
        }

        // Draw waypoint path but skip segments that overlap bridge t-ranges
        function drawWaypointPathSkipBridges(pts, bridgeSegs) {
            if (pts.length < 2 || !bridgeSegs || bridgeSegs.length === 0) {
                drawWaypointPath(pts);
                return;
            }
            var n = pts.length - 1;
            // Pre-compute which segments are inside bridges
            var skipSeg = new Array(n);
            var bridgeMargin = 0.5 / n;
            for (var i = 0; i < n; i++) {
                var segStart = i / n;
                var segEnd = (i + 1) / n;
                skipSeg[i] = false;
                for (var b = 0; b < bridgeSegs.length; b++) {
                    var bs = bridgeSegs[b];
                    if (bs.startT !== undefined && segStart >= (bs.startT + bridgeMargin) && segEnd <= (bs.endT - bridgeMargin)) {
                        skipSeg[i] = true;
                        break;
                    }
                }
            }
            var drawing = false;
            for (var i = 0; i < n; i++) {
                if (skipSeg[i]) {
                    if (drawing) { ctx.stroke(); drawing = false; }
                    continue;
                }
                var p1 = pts[i];
                var p2 = pts[i + 1];
                if (!drawing) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    drawing = true;
                }
                // Clamp p0/p3 so bezier control points don't reach into skipped bridge segments
                var p0 = (i === 0 || skipSeg[i - 1]) ? p1 : pts[i - 1];
                var p3 = (i + 1 >= n || skipSeg[i]) ? p2 : (i + 2 > n ? pts[n] : ((i + 1 < n && skipSeg[i + 1]) ? p2 : pts[i + 2]));
                var cp1x = p1.x + (p2.x - p0.x) / 6;
                var cp1y = p1.y + (p2.y - p0.y) / 6;
                var cp2x = p2.x - (p3.x - p1.x) / 6;
                var cp2y = p2.y - (p3.y - p1.y) / 6;
                ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
            if (drawing) ctx.stroke();
        }

        for (const road of roads) {
            const from = townMap[road.fromTownId];
            const to = townMap[road.toTownId];
            if (!from || !to) continue;

            const fx = from.x;
            const fy = from.y;
            const tx = to.x;
            const ty = to.y;

            // skip if road bounding box (endpoints + waypoints) is entirely off-screen
            var _rdMinX = Math.min(fx, tx), _rdMaxX = Math.max(fx, tx);
            var _rdMinY = Math.min(fy, ty), _rdMaxY = Math.max(fy, ty);
            if (road.waypoints) {
                for (var _rwi = 0; _rwi < road.waypoints.length; _rwi++) {
                    var _rwp = road.waypoints[_rwi];
                    if (_rwp.x < _rdMinX) _rdMinX = _rwp.x;
                    if (_rwp.x > _rdMaxX) _rdMaxX = _rwp.x;
                    if (_rwp.y < _rdMinY) _rdMinY = _rwp.y;
                    if (_rwp.y > _rdMaxY) _rdMaxY = _rwp.y;
                }
            }
            var _rdVb = getVisibleBounds();
            if (_rdMaxX < _rdVb.left - 200 || _rdMinX > _rdVb.right + 200 ||
                _rdMaxY < _rdVb.top - 200 || _rdMinY > _rdVb.bottom + 200) continue;

            const quality = road.quality || 1;
            const safe = road.safe !== false;
            const width = quality * 1.5 + 0.5;

            let hasWP = road.waypoints && road.waypoints.length >= 2;

            // Legacy fallback: compute waypoints via A* if missing
            if (!hasWP) {
                if (!road._waypointLookupDone) {
                    road._waypointLookupDone = true;
                    try {
                        const pathResult = Engine.findTerrainPath(fx, fy, tx, ty, 'land');
                        if (pathResult && pathResult.waypoints && pathResult.waypoints.length >= 2) {
                            road.waypoints = pathResult.waypoints;
                            hasWP = true;
                        }
                    } catch (e) {
                        // pathfinding unavailable — skip this road
                    }
                }
                if (!hasWP) continue; // no valid path — don't render through water
            }

            ctx.lineWidth = width;

            // Draw road with real-time terrain check: bridge over water, road over land
            var _wps = road.waypoints;
            // Check if road has any bridge data (even if some are destroyed)
            var _hasBridgeData = (road.hasBridge || false) && _wps.length >= 2;
            // Build a lookup of which waypoint indices are in a destroyed bridge
            var _destroyedWpSet = null;
            if (_hasBridgeData && road.bridges && road.bridges.length > 0) {
                _destroyedWpSet = {};
                for (var _dbi = 0; _dbi < road.bridges.length; _dbi++) {
                    if (road.bridges[_dbi].destroyed) {
                        for (var _dwi = road.bridges[_dbi].startWpIdx; _dwi <= road.bridges[_dbi].endWpIdx; _dwi++) {
                            _destroyedWpSet[_dwi] = true;
                        }
                    }
                }
            }
            if (_hasBridgeData) {
                // Per-segment terrain-aware rendering
                var _roadColor = quality >= 3 ? '#a08050' : quality >= 2 ? '#8b7355' : '#6b5b4f';
                var _inWaterRun = false;
                var _waterRunStart = -1;

                // First pass: draw road segments (only over land)
                if (!safe) {
                    ctx.strokeStyle = '#8b4513';
                    ctx.setLineDash([6, 4]);
                } else {
                    ctx.strokeStyle = _roadColor;
                    ctx.setLineDash([]);
                }
                ctx.lineWidth = width;
                var _drawing = false;
                for (var _si = 0; _si < _wps.length - 1; _si++) {
                    var _mx = (_wps[_si].x + _wps[_si+1].x) / 2;
                    var _my = (_wps[_si].y + _wps[_si+1].y) / 2;
                    var _terr = Engine.getTerrainAtPixel(_mx, _my);
                    if (_terr === 2) { // water
                        if (_drawing) { ctx.stroke(); _drawing = false; }
                    } else {
                        if (!_drawing) {
                            ctx.beginPath();
                            ctx.moveTo(_wps[_si].x, _wps[_si].y);
                            _drawing = true;
                        }
                        ctx.lineTo(_wps[_si+1].x, _wps[_si+1].y);
                    }
                }
                if (_drawing) ctx.stroke();
                ctx.setLineDash([]);

                if (!safe) {
                    // Red overlay for unsafe (land only)
                    ctx.strokeStyle = 'rgba(180,40,30,0.45)';
                    ctx.lineWidth = width + 1;
                    _drawing = false;
                    for (var _si = 0; _si < _wps.length - 1; _si++) {
                        var _mx = (_wps[_si].x + _wps[_si+1].x) / 2;
                        var _my = (_wps[_si].y + _wps[_si+1].y) / 2;
                        var _terr = Engine.getTerrainAtPixel(_mx, _my);
                        if (_terr === 2) {
                            if (_drawing) { ctx.stroke(); _drawing = false; }
                        } else {
                            if (!_drawing) { ctx.beginPath(); ctx.moveTo(_wps[_si].x, _wps[_si].y); _drawing = true; }
                            ctx.lineTo(_wps[_si+1].x, _wps[_si+1].y);
                        }
                    }
                    if (_drawing) ctx.stroke();
                }

                // Second pass: draw bridge segments (only over water)
                // Separate intact and destroyed bridge segments
                _drawing = false;
                var _bridgeSegs = []; // intact water runs for planks
                var _destroyedSegs = []; // destroyed water runs for X markers
                var _curBridge = [];
                var _curDestroyed = [];
                var _lastWasDestroyed = false;
                for (var _si = 0; _si < _wps.length - 1; _si++) {
                    var _mx = (_wps[_si].x + _wps[_si+1].x) / 2;
                    var _my = (_wps[_si].y + _wps[_si+1].y) / 2;
                    var _terr = Engine.getTerrainAtPixel(_mx, _my);
                    var _segDestroyed = _destroyedWpSet && (_destroyedWpSet[_si] || _destroyedWpSet[_si+1]);
                    if (_terr === 2) { // water
                        if (_segDestroyed) {
                            // Flush intact run
                            if (_curBridge.length >= 2) _bridgeSegs.push(_curBridge);
                            _curBridge = [];
                            if (_curDestroyed.length === 0) _curDestroyed.push(_wps[_si]);
                            _curDestroyed.push(_wps[_si+1]);
                        } else {
                            // Flush destroyed run
                            if (_curDestroyed.length >= 2) _destroyedSegs.push(_curDestroyed);
                            _curDestroyed = [];
                            if (_curBridge.length === 0) _curBridge.push(_wps[_si]);
                            _curBridge.push(_wps[_si+1]);
                        }
                    } else {
                        if (_curBridge.length >= 2) _bridgeSegs.push(_curBridge);
                        if (_curDestroyed.length >= 2) _destroyedSegs.push(_curDestroyed);
                        _curBridge = [];
                        _curDestroyed = [];
                    }
                }
                if (_curBridge.length >= 2) _bridgeSegs.push(_curBridge);
                if (_curDestroyed.length >= 2) _destroyedSegs.push(_curDestroyed);

                // Draw intact bridges (brown) with shadow and rails
                // #9: Bridge shadow underneath
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = width + 5;
                ctx.setLineDash([]);
                for (var _ib = 0; _ib < _bridgeSegs.length; _ib++) {
                    var _pts = _bridgeSegs[_ib];
                    ctx.beginPath();
                    ctx.moveTo(_pts[0].x + 1, _pts[0].y + 2);
                    for (var _ip = 1; _ip < _pts.length; _ip++) ctx.lineTo(_pts[_ip].x + 1, _pts[_ip].y + 2);
                    ctx.stroke();
                }
                // Main bridge body
                ctx.strokeStyle = '#8B6914';
                ctx.lineWidth = width + 3;
                for (var _ib = 0; _ib < _bridgeSegs.length; _ib++) {
                    var _pts = _bridgeSegs[_ib];
                    ctx.beginPath();
                    ctx.moveTo(_pts[0].x, _pts[0].y);
                    for (var _ip = 1; _ip < _pts.length; _ip++) ctx.lineTo(_pts[_ip].x, _pts[_ip].y);
                    ctx.stroke();
                }
                // #9: Rail posts on bridge sides
                if (camera.zoom > 0.7) {
                    ctx.fillStyle = '#5a4010';
                    for (var _ib = 0; _ib < _bridgeSegs.length; _ib++) {
                        var _pts = _bridgeSegs[_ib];
                        var _bTotalLen = 0;
                        for (var _bj = 1; _bj < _pts.length; _bj++) {
                            _bTotalLen += Math.hypot(_pts[_bj].x - _pts[_bj-1].x, _pts[_bj].y - _pts[_bj-1].y);
                        }
                        if (_bTotalLen <= 0) continue;
                        var _postSpacing = Math.max(8, 12 / camera.zoom);
                        var _nPosts = Math.max(2, Math.floor(_bTotalLen / _postSpacing));
                        for (var _pp = 0; _pp <= _nPosts; _pp++) {
                            var _pTarget = (_pp / _nPosts) * _bTotalLen;
                            var _pWalked = 0;
                            for (var _pk = 1; _pk < _pts.length; _pk++) {
                                var _pdx = _pts[_pk].x - _pts[_pk-1].x;
                                var _pdy = _pts[_pk].y - _pts[_pk-1].y;
                                var _pLen = Math.hypot(_pdx, _pdy);
                                if (_pWalked + _pLen >= _pTarget || _pk === _pts.length - 1) {
                                    var _pf = _pLen > 0 ? (_pTarget - _pWalked) / _pLen : 0;
                                    var _ppx = _pts[_pk-1].x + _pdx * _pf;
                                    var _ppy = _pts[_pk-1].y + _pdy * _pf;
                                    var _perpX = _pLen > 0 ? -(_pdy / _pLen) * (width/2 + 2.5) : 0;
                                    var _perpY = _pLen > 0 ? (_pdx / _pLen) * (width/2 + 2.5) : 0;
                                    ctx.fillRect(_ppx + _perpX - 0.8, _ppy + _perpY - 0.8, 1.6, 1.6);
                                    ctx.fillRect(_ppx - _perpX - 0.8, _ppy - _perpY - 0.8, 1.6, 1.6);
                                    break;
                                }
                                _pWalked += _pLen;
                            }
                        }
                    }
                }

                // Draw destroyed bridges (red dashed)
                ctx.strokeStyle = '#c44e52';
                ctx.lineWidth = width + 2;
                ctx.setLineDash([6, 4]);
                for (var _db = 0; _db < _destroyedSegs.length; _db++) {
                    var _dpts = _destroyedSegs[_db];
                    ctx.beginPath();
                    ctx.moveTo(_dpts[0].x, _dpts[0].y);
                    for (var _dp = 1; _dp < _dpts.length; _dp++) ctx.lineTo(_dpts[_dp].x, _dpts[_dp].y);
                    ctx.stroke();
                }
                ctx.setLineDash([]);

                // Draw ❌ markers at center of destroyed bridges
                for (var _dm = 0; _dm < _destroyedSegs.length; _dm++) {
                    var _dms = _destroyedSegs[_dm];
                    var _midIdx = Math.floor(_dms.length / 2);
                    var _cmx = _dms[_midIdx].x, _cmy = _dms[_midIdx].y;
                    var _markSize = Math.max(6, width + 2);
                    ctx.strokeStyle = '#ff3333';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(_cmx - _markSize, _cmy - _markSize);
                    ctx.lineTo(_cmx + _markSize, _cmy + _markSize);
                    ctx.moveTo(_cmx + _markSize, _cmy - _markSize);
                    ctx.lineTo(_cmx - _markSize, _cmy + _markSize);
                    ctx.stroke();
                }

                // Draw planks on each water bridge run
                ctx.strokeStyle = '#6B4F12';
                ctx.lineWidth = 1;
                for (var _bi = 0; _bi < _bridgeSegs.length; _bi++) {
                    var _bpts = _bridgeSegs[_bi];
                    var _tLen = 0;
                    for (var _bj = 1; _bj < _bpts.length; _bj++) {
                        _tLen += Math.hypot(_bpts[_bj].x - _bpts[_bj-1].x, _bpts[_bj].y - _bpts[_bj-1].y);
                    }
                    if (_tLen <= 0) continue;
                    var _nPlanks = Math.max(2, Math.floor(_tLen / 4));
                    for (var _pl = 0; _pl <= _nPlanks; _pl++) {
                        var _target = (_pl / _nPlanks) * _tLen;
                        var _walked = 0;
                        for (var _bk = 1; _bk < _bpts.length; _bk++) {
                            var _dx = _bpts[_bk].x - _bpts[_bk-1].x;
                            var _dy = _bpts[_bk].y - _bpts[_bk-1].y;
                            var _sLen = Math.hypot(_dx, _dy);
                            if (_walked + _sLen >= _target || _bk === _bpts.length - 1) {
                                var _f = _sLen > 0 ? (_target - _walked) / _sLen : 0;
                                var _px = _bpts[_bk-1].x + _dx * _f;
                                var _py = _bpts[_bk-1].y + _dy * _f;
                                var _prpX = _sLen > 0 ? -(_dy / _sLen) * (width/2 + 2) : 0;
                                var _prpY = _sLen > 0 ? (_dx / _sLen) * (width/2 + 2) : 0;
                                ctx.beginPath();
                                ctx.moveTo(_px + _prpX, _py + _prpY);
                                ctx.lineTo(_px - _prpX, _py - _prpY);
                                ctx.stroke();
                                break;
                            }
                            _walked += _sLen;
                        }
                    }
                }
            } else {
                // No bridge data — normal road rendering
                if (!safe) {
                    ctx.strokeStyle = '#8b4513';
                    ctx.setLineDash([6, 4]);
                    drawWaypointPath(road.waypoints);
                    ctx.strokeStyle = 'rgba(180,40,30,0.45)';
                    ctx.lineWidth = width + 1;
                    drawWaypointPath(road.waypoints);
                    ctx.setLineDash([]);
                } else {
                    ctx.strokeStyle = quality >= 3 ? '#a08050' : quality >= 2 ? '#8b7355' : '#6b5b4f';
                    ctx.setLineDash([]);
                    drawWaypointPath(road.waypoints);
                }
            }

            // Gold overlay for player-owned toll roads
            if (road.isTollRoad && road.ownerId === 'player') {
                ctx.save();
                ctx.strokeStyle = 'rgba(212,175,55,0.45)';
                ctx.lineWidth = width + 2;
                ctx.setLineDash([8, 4]);
                drawWaypointPath(road.waypoints);
                ctx.setLineDash([]);
                ctx.restore();
            }

            // Bandit threat indicator for high-threat roads — subtle, only at higher zoom
            const threat = road.banditThreat || 0;
            if (threat > CONFIG.BANDIT_THREAT_DANGER_THRESHOLD && camera.zoom > 0.8) {
                const threatAlpha = Math.min(0.4, (threat - CONFIG.BANDIT_THREAT_DANGER_THRESHOLD) / 120);
                const mx = (fx + tx) / 2;
                const my = (fy + ty) / 2;

                ctx.save();
                ctx.globalAlpha = threatAlpha * (0.6 + 0.4 * Math.sin(frameCount * 0.05));
                ctx.fillStyle = 'rgba(200,40,30,0.7)';
                ctx.font = `${Math.max(8, 10 * camera.zoom)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('☠', mx, my);
                if (threat > 75 && camera.zoom > 1.2) {
                    ctx.fillText('☠', (fx + mx) / 2, (fy + my) / 2);
                    ctx.fillText('☠', (tx + mx) / 2, (ty + my) / 2);
                }
                ctx.restore();
            }
        }
        ctx.setLineDash([]);
    }

    // ═══════════════════════════════════════════════════════════
    //  3b. SEA ROUTES
    // ═══════════════════════════════════════════════════════════

    function renderSeaRoutes() {
        let seaRoutes;
        try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { return; }
        if (!seaRoutes || !seaRoutes.length) return;

        const towns = _frameTowns;
        if (!towns) return;

        const townMap = _frameTownMap;

        // Helper: draw dashed Catmull-Rom spline through waypoints
        function drawSeaWaypointPath(pts) {
            if (pts.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            if (pts.length === 2) {
                ctx.lineTo(pts[1].x, pts[1].y);
            } else {
                for (var i = 0; i < pts.length - 1; i++) {
                    var p0 = pts[i === 0 ? 0 : i - 1];
                    var p1 = pts[i];
                    var p2 = pts[i + 1];
                    var p3 = pts[i + 1 >= pts.length - 1 ? pts.length - 1 : i + 2];
                    var cp1x = p1.x + (p2.x - p0.x) / 6;
                    var cp1y = p1.y + (p2.y - p0.y) / 6;
                    var cp2x = p2.x - (p3.x - p1.x) / 6;
                    var cp2y = p2.y - (p3.y - p1.y) / 6;
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                }
            }
            ctx.stroke();
        }

        for (const route of seaRoutes) {
            const from = townMap[route.fromTownId];
            const to = townMap[route.toTownId];
            if (!from || !to) continue;

            const fx = from.x;
            const fy = from.y;
            const tx = to.x;
            const ty = to.y;

            // skip if route bounding box is entirely off-screen
            var _srMinX = Math.min(fx, tx), _srMaxX = Math.max(fx, tx);
            var _srMinY = Math.min(fy, ty), _srMaxY = Math.max(fy, ty);
            if (route.waypoints) {
                for (var _swi = 0; _swi < route.waypoints.length; _swi++) {
                    var _swp = route.waypoints[_swi];
                    if (_swp.x < _srMinX) _srMinX = _swp.x;
                    if (_swp.x > _srMaxX) _srMaxX = _swp.x;
                    if (_swp.y < _srMinY) _srMinY = _swp.y;
                    if (_swp.y > _srMaxY) _srMaxY = _swp.y;
                }
            }
            var _srVb = getVisibleBounds();
            if (_srMaxX < _srVb.left - 200 || _srMinX > _srVb.right + 200 ||
                _srMaxY < _srVb.top - 200 || _srMinY > _srVb.bottom + 200) continue;
            ctx.strokeStyle = 'rgba(255,200,50,0.7)';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([10, 6]);

            const hasWP = route.waypoints && route.waypoints.length >= 2;

            if (hasWP) {
                drawSeaWaypointPath(route.waypoints);
            } else {
                // Legacy fallback: gentle arc
                const midX = (fx + tx) / 2;
                const midY = (fy + ty) / 2;
                const perpX = -(ty - fy);
                const perpY = tx - fx;
                const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
                const bendAmount = 30;
                const cpx = midX + (perpX / len) * bendAmount;
                const cpy = midY + (perpY / len) * bendAmount;

                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.quadraticCurveTo(cpx, cpy, tx, ty);
                ctx.stroke();
            }

            // Small wave marks along the route
            if (camera.zoom > 0.6) {
                const animTime = frameCount * 0.03;
                ctx.fillStyle = 'rgba(255,220,80,0.4)';
                if (hasWP) {
                    // Place wave marks at evenly spaced waypoints
                    var wpLen = route.waypoints.length;
                    var waveStep = Math.max(1, Math.floor(wpLen / 5));
                    for (var wi = waveStep; wi < wpLen - 1; wi += waveStep) {
                        var wp = route.waypoints[wi];
                        var wave = Math.sin(animTime + wi * 0.5) * 3;
                        ctx.beginPath();
                        ctx.arc(wp.x + wave, wp.y + wave, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    // Legacy bezier wave marks
                    const midX2 = (fx + tx) / 2;
                    const midY2 = (fy + ty) / 2;
                    const perpX2 = -(ty - fy);
                    const perpY2 = tx - fx;
                    const len2 = Math.sqrt(perpX2 * perpX2 + perpY2 * perpY2) || 1;
                    const cpx2 = midX2 + (perpX2 / len2) * 30;
                    const cpy2 = midY2 + (perpY2 / len2) * 30;
                    for (let s = 0.2; s <= 0.8; s += 0.2) {
                        const t2 = s;
                        const px = fx * (1 - t2) * (1 - t2) + 2 * cpx2 * t2 * (1 - t2) + tx * t2 * t2;
                        const py = fy * (1 - t2) * (1 - t2) + 2 * cpy2 * t2 * (1 - t2) + ty * t2 * t2;
                        const wave = Math.sin(animTime + s * 10) * 3;
                        ctx.beginPath();
                        ctx.arc(px + wave, py + wave, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            ctx.setLineDash([]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════

    function renderTowns() {
        const towns = _frameTowns;
        if (!towns) return;

        const ts = CONFIG.TILE_SIZE;
        const kingdoms = _frameKingdoms;
        const kingdomMap = {};
        if (kingdoms) kingdoms.forEach(k => kingdomMap[k.id] = k);

        for (const town of towns) {
            const cx = town.x;
            const cy = town.y;
            if (!isVisible(cx, cy, 200)) continue;
            if (town.isJunction) continue;

            const pop = town.population || 100;
            const kingdom = kingdomMap[town.kingdomId];
            let kColor = kingdom ? (kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length]) : '#888';
            const prosperity = town.prosperity || 50;

            // Desaturate destroyed or struggling towns
            const isRuined = pop <= 0;
            const isStruggling = pop > 0 && pop < 20;
            if (isRuined) {
                kColor = '#555';
            } else if (isStruggling) {
                kColor = '#8a7a64';
            }

            if (camera.zoom < 0.6) {
                // Zoomed out: shape varies by category
                const cat = town.category || 'village';

                // Outpost: small tent/camp icon
                if (cat === 'outpost') {
                    const r = 5;
                    // Tent shape
                    ctx.fillStyle = '#8a7a5a';
                    ctx.beginPath();
                    ctx.moveTo(cx - r, cy + r * 0.5);
                    ctx.lineTo(cx, cy - r);
                    ctx.lineTo(cx + r, cy + r * 0.5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // Small flag
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - r);
                    ctx.lineTo(cx, cy - r - 6);
                    ctx.stroke();
                    ctx.fillStyle = kColor;
                    ctx.fillRect(cx, cy - r - 6, 4, 3);
                    // Outpost name
                    if (camera.zoom > 0.35) {
                        ctx.fillStyle = '#c8b888';
                        ctx.font = `bold ${Math.max(7, 9 / camera.zoom * 0.5)}px serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText(town.name, cx, cy - 8);
                    }
                } else {
                const r = cat === 'capital_city' ? 10 + Math.sqrt(pop) * 0.4
                         : cat === 'city' ? 8 + Math.sqrt(pop) * 0.38
                         : cat === 'town' ? 6 + Math.sqrt(pop) * 0.35
                         : 5 + Math.sqrt(pop) * 0.3; // village

                // Island beach ring
                if (town.isIsland) {
                    ctx.fillStyle = 'rgba(210,190,140,0.4)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = kColor;
                if (cat === 'capital_city') {
                    // Star/diamond shape for capitals
                    ctx.beginPath();
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
                        const rad = i % 2 === 0 ? r : r * 0.55;
                        const px = cx + Math.cos(angle) * rad;
                        const py = cy + Math.sin(angle) * rad;
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                } else if (cat === 'city') {
                    // Square with notched corners for cities
                    ctx.fillRect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
                } else if (cat === 'town') {
                    // Rounded square for towns
                    const half = r * 0.75;
                    ctx.beginPath();
                    ctx.moveTo(cx - half + 2, cy - half);
                    ctx.lineTo(cx + half - 2, cy - half);
                    ctx.quadraticCurveTo(cx + half, cy - half, cx + half, cy - half + 2);
                    ctx.lineTo(cx + half, cy + half - 2);
                    ctx.quadraticCurveTo(cx + half, cy + half, cx + half - 2, cy + half);
                    ctx.lineTo(cx - half + 2, cy + half);
                    ctx.quadraticCurveTo(cx - half, cy + half, cx - half, cy + half - 2);
                    ctx.lineTo(cx - half, cy - half + 2);
                    ctx.quadraticCurveTo(cx - half, cy - half, cx - half + 2, cy - half);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    // Circle for villages
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // Port indicator
                if (town.isPort && camera.zoom > 0.3) {
                    ctx.fillStyle = 'rgba(0,180,200,0.8)';
                    ctx.font = `${Math.max(6, 8)}px serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText('⚓', cx + r + 4, cy + 3);
                }

                // Name
                if (camera.zoom > 0.35) {
                    ctx.fillStyle = '#e8dcc8';
                    ctx.font = `bold ${Math.max(8, 10 / camera.zoom * 0.5)}px serif`;
                    ctx.textAlign = 'center';
                    ctx.fillText(town.name, cx, cy - r - 4);

                    // Event indicators (festival, feast, court, tournament)
                    const _evtInd = _getTownEventIndicators(town.id);
                    if (_evtInd) {
                        ctx.font = `${Math.max(7, 9)}px sans-serif`;
                        ctx.fillText(_evtInd, cx, cy - r - 14);
                    }

                    // Security warning for low-security towns
                    if ((town.security || 0) < 25) {
                        ctx.font = `${Math.max(8, 10 * camera.zoom)}px sans-serif`;
                        ctx.fillStyle = 'rgba(200,40,30,0.8)';
                        ctx.fillText('⚠️', cx + r + 10, cy);
                    }

                    // Destroyed town indicator
                    if (isRuined && camera.zoom > 0.3) {
                        ctx.font = `${Math.max(8, 10)}px sans-serif`;
                        ctx.fillStyle = 'rgba(180,40,30,0.9)';
                        ctx.fillText('💀', cx - r - 8, cy + 3);
                    }
                    }
                }
            } else {
                // Detailed town rendering — distinct graphics per category
                const cat = town.category || 'village';

                // ── OUTPOST: Small camp with tents, fence, flag ──
                if (cat === 'outpost') {
                    const baseSize = 12;
                    // Cleared ground circle
                    ctx.fillStyle = 'rgba(120,100,70,0.25)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 4, 0, Math.PI * 2);
                    ctx.fill();
                    // Wooden fence/palisade ring
                    ctx.strokeStyle = '#6b5b4f';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([3, 2]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 2, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Main tent (large)
                    ctx.fillStyle = '#8a7a5a';
                    ctx.beginPath();
                    ctx.moveTo(cx - 8, cy + 4);
                    ctx.lineTo(cx, cy - 8);
                    ctx.lineTo(cx + 8, cy + 4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    // Tent entrance flap
                    ctx.fillStyle = '#6b5b4f';
                    ctx.beginPath();
                    ctx.moveTo(cx - 2, cy + 4);
                    ctx.lineTo(cx, cy);
                    ctx.lineTo(cx + 2, cy + 4);
                    ctx.closePath();
                    ctx.fill();
                    // Small side tent
                    ctx.fillStyle = '#7a6a4a';
                    ctx.beginPath();
                    ctx.moveTo(cx + 6, cy + 2);
                    ctx.lineTo(cx + 10, cy - 3);
                    ctx.lineTo(cx + 14, cy + 2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 0.8;
                    ctx.stroke();
                    // Storage crate
                    ctx.fillStyle = '#5a4a38';
                    ctx.fillRect(cx - 12, cy - 1, 5, 4);
                    ctx.strokeStyle = '#3a2a1e';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(cx - 12, cy - 1, 5, 4);
                    // Flag pole and banner
                    const flagX = cx + baseSize + 4;
                    const flagY = cy - baseSize - 4;
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(flagX, flagY + 14);
                    ctx.lineTo(flagX, flagY);
                    ctx.stroke();
                    ctx.fillStyle = kColor;
                    ctx.beginPath();
                    ctx.moveTo(flagX, flagY);
                    ctx.lineTo(flagX + 8, flagY + 3);
                    ctx.lineTo(flagX, flagY + 6);
                    ctx.closePath();
                    ctx.fill();
                    // Outpost name
                    ctx.fillStyle = '#c8b888';
                    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                    ctx.lineWidth = 2;
                    ctx.font = `bold 9px 'Cinzel', serif`;
                    ctx.textAlign = 'center';
                    const opLabel = '⛺ ' + town.name;
                    ctx.strokeText(opLabel, cx, cy - baseSize - 8);
                    ctx.fillText(opLabel, cx, cy - baseSize - 8);
                } else {

                const baseSize = cat === 'capital_city' ? 18 + Math.sqrt(pop) * 0.7
                               : cat === 'city' ? 15 + Math.sqrt(pop) * 0.65
                               : cat === 'town' ? 12 + Math.sqrt(pop) * 0.6
                               : 9 + Math.sqrt(pop) * 0.5; // village

                // Island beach ring
                if (town.isIsland) {
                    ctx.fillStyle = 'rgba(210,190,140,0.35)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 14, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(194,178,128,0.5)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 14, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // ── VILLAGE: Scattered huts, thatched roofs, dirt feel ──
                if (cat === 'village') {
                    const buildingCount = Math.min(10, 3 + Math.floor(pop / 25));
                    const bColors = ['#5a4a38', '#6b5b4f', '#4a3a2e'];
                    for (let i = 0; i < buildingCount; i++) {
                        const angle = (i / buildingCount) * Math.PI * 2 + tileHash(town.x + i, town.y) * 0.8;
                        const dist = 5 + tileHash(i * 3, town.y * 7) * baseSize * 0.7;
                        const bx = cx + Math.cos(angle) * dist;
                        const by = cy + Math.sin(angle) * dist;
                        const bw = 4 + tileHash(i, town.x) * 4;
                        const bh = 4 + tileHash(town.x, i) * 5;
                        ctx.fillStyle = bColors[i % bColors.length];
                        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                        // Thatched roof (yellow-brown triangle)
                        ctx.fillStyle = '#a0884e';
                        ctx.beginPath();
                        ctx.moveTo(bx - bw / 2 - 1, by - bh / 2);
                        ctx.lineTo(bx, by - bh / 2 - 4);
                        ctx.lineTo(bx + bw / 2 + 1, by - bh / 2);
                        ctx.closePath();
                        ctx.fill();
                    }
                    // Small well/pond at center
                    ctx.fillStyle = 'rgba(80,120,170,0.5)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

                // ── TOWN: More buildings, timber frames, small market square ──
                else if (cat === 'town') {
                    const buildingCount = Math.min(18, 6 + Math.floor(pop / 18));
                    const bColors = ['#5a4a38', '#6b5b4f', '#4a3a2e', '#7b6b55'];
                    for (let i = 0; i < buildingCount; i++) {
                        const angle = (i / buildingCount) * Math.PI * 2 + tileHash(town.x + i, town.y) * 0.6;
                        const dist = 6 + tileHash(i * 3, town.y * 7) * baseSize * 0.72;
                        const bx = cx + Math.cos(angle) * dist;
                        const by = cy + Math.sin(angle) * dist;
                        const bw = 5 + tileHash(i, town.x) * 5;
                        const bh = 5 + tileHash(town.x, i) * 6;
                        // Timber-frame walls
                        ctx.fillStyle = bColors[i % bColors.length];
                        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                        // Timber frame lines
                        ctx.strokeStyle = '#3a2a1e';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
                        // Pitched roof
                        ctx.fillStyle = '#8b4513';
                        ctx.beginPath();
                        ctx.moveTo(bx - bw / 2 - 1, by - bh / 2);
                        ctx.lineTo(bx, by - bh / 2 - 4);
                        ctx.lineTo(bx + bw / 2 + 1, by - bh / 2);
                        ctx.closePath();
                        ctx.fill();
                    }
                    // Market square at center
                    ctx.fillStyle = 'rgba(160,140,100,0.4)';
                    ctx.fillRect(cx - 5, cy - 5, 10, 10);
                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 0.8;
                    ctx.strokeRect(cx - 5, cy - 5, 10, 10);
                }

                // ── CITY: Dense buildings, stone structures, church spire, market ──
                else if (cat === 'city') {
                    const buildingCount = Math.min(28, 10 + Math.floor(pop / 14));
                    const bColors = ['#5a4a38', '#6b5b4f', '#7b6b55', '#8a7a64', '#555'];
                    for (let i = 0; i < buildingCount; i++) {
                        const ring = i < buildingCount * 0.4 ? 0.4 : 0.85;
                        const angle = (i / buildingCount) * Math.PI * 2 + tileHash(town.x + i, town.y) * 0.5;
                        const dist = 5 + tileHash(i * 3, town.y * 7) * baseSize * ring;
                        const bx = cx + Math.cos(angle) * dist;
                        const by = cy + Math.sin(angle) * dist;
                        const bw = 5 + tileHash(i, town.x) * 6;
                        const bh = 5 + tileHash(town.x, i) * 7;
                        // Stone / timber walls
                        ctx.fillStyle = bColors[i % bColors.length];
                        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                        ctx.strokeStyle = '#3a2a1e';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
                        // Slate roof
                        ctx.fillStyle = i % 3 === 0 ? '#5a5a5a' : '#8b4513';
                        ctx.beginPath();
                        ctx.moveTo(bx - bw / 2 - 1, by - bh / 2);
                        ctx.lineTo(bx, by - bh / 2 - 4);
                        ctx.lineTo(bx + bw / 2 + 1, by - bh / 2);
                        ctx.closePath();
                        ctx.fill();
                    }
                    // Church/cathedral spire
                    const spireX = cx + tileHash(town.x, town.y * 3) * 6 - 3;
                    const spireY = cy - 4;
                    ctx.fillStyle = '#777';
                    ctx.fillRect(spireX - 2, spireY - 4, 4, 10);
                    ctx.fillStyle = '#999';
                    ctx.beginPath();
                    ctx.moveTo(spireX - 3, spireY - 4);
                    ctx.lineTo(spireX, spireY - 12);
                    ctx.lineTo(spireX + 3, spireY - 4);
                    ctx.closePath();
                    ctx.fill();
                    // Cross on top
                    ctx.strokeStyle = '#ddd';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(spireX, spireY - 14);
                    ctx.lineTo(spireX, spireY - 11);
                    ctx.moveTo(spireX - 1.5, spireY - 12.5);
                    ctx.lineTo(spireX + 1.5, spireY - 12.5);
                    ctx.stroke();
                    // Larger market square
                    ctx.fillStyle = 'rgba(170,150,110,0.35)';
                    ctx.fillRect(cx - 7, cy - 7, 14, 14);
                    ctx.strokeStyle = '#6a5a48';
                    ctx.lineWidth = 0.8;
                    ctx.strokeRect(cx - 7, cy - 7, 14, 14);
                }

                // ── CAPITAL CITY: Grand structures, castle keep, inner/outer walls feel ──
                else if (cat === 'capital_city') {
                    // Outer ring — larger, denser buildings
                    const outerCount = Math.min(22, 8 + Math.floor(pop / 20));
                    const outerColors = ['#5a4a38', '#6b5b4f', '#7b6b55', '#8a7a64'];
                    for (let i = 0; i < outerCount; i++) {
                        const angle = (i / outerCount) * Math.PI * 2 + tileHash(town.x + i, town.y) * 0.4;
                        const dist = baseSize * 0.55 + tileHash(i * 3, town.y * 7) * baseSize * 0.35;
                        const bx = cx + Math.cos(angle) * dist;
                        const by = cy + Math.sin(angle) * dist;
                        const bw = 6 + tileHash(i, town.x) * 5;
                        const bh = 6 + tileHash(town.x, i) * 6;
                        ctx.fillStyle = outerColors[i % outerColors.length];
                        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                        ctx.strokeStyle = '#3a2a1e';
                        ctx.lineWidth = 0.5;
                        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
                        ctx.fillStyle = i % 4 === 0 ? '#5a5a5a' : '#8b4513';
                        ctx.beginPath();
                        ctx.moveTo(bx - bw / 2 - 1, by - bh / 2);
                        ctx.lineTo(bx, by - bh / 2 - 4);
                        ctx.lineTo(bx + bw / 2 + 1, by - bh / 2);
                        ctx.closePath();
                        ctx.fill();
                    }
                    // Inner ring — castle/palace buildings
                    const innerCount = Math.min(8, 3 + Math.floor(pop / 80));
                    for (let i = 0; i < innerCount; i++) {
                        const angle = (i / innerCount) * Math.PI * 2 + tileHash(town.x * 2 + i, town.y) * 0.5;
                        const dist = 4 + tileHash(i * 5, town.y * 3) * baseSize * 0.25;
                        const bx = cx + Math.cos(angle) * dist;
                        const by = cy + Math.sin(angle) * dist;
                        const bw = 6 + tileHash(i * 2, town.x) * 4;
                        const bh = 7 + tileHash(town.x, i * 2) * 5;
                        // Stone walls
                        ctx.fillStyle = '#888';
                        ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
                        ctx.strokeStyle = '#555';
                        ctx.lineWidth = 0.8;
                        ctx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);
                        // Flat stone roof
                        ctx.fillStyle = '#6a6a6a';
                        ctx.fillRect(bx - bw / 2 - 1, by - bh / 2 - 2, bw + 2, 2);
                    }
                    // Castle keep — central tower
                    ctx.fillStyle = '#777';
                    ctx.fillRect(cx - 4, cy - 6, 8, 12);
                    ctx.strokeStyle = '#555';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cx - 4, cy - 6, 8, 12);
                    // Battlements on keep
                    for (let b = 0; b < 4; b++) {
                        ctx.fillStyle = '#888';
                        ctx.fillRect(cx - 5 + b * 3, cy - 8, 2, 2);
                    }
                    // Keep spire
                    ctx.fillStyle = kColor;
                    ctx.beginPath();
                    ctx.moveTo(cx - 3, cy - 8);
                    ctx.lineTo(cx, cy - 15);
                    ctx.lineTo(cx + 3, cy - 8);
                    ctx.closePath();
                    ctx.fill();
                    // Royal banner on spire
                    ctx.fillStyle = kColor;
                    ctx.fillRect(cx + 1, cy - 14, 5, 3);
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(cx + 1, cy - 15);
                    ctx.lineTo(cx + 1, cy - 11);
                    ctx.stroke();
                    // Grand cathedral
                    const catX = cx + 10, catY = cy - 2;
                    ctx.fillStyle = '#777';
                    ctx.fillRect(catX - 3, catY - 3, 6, 8);
                    ctx.fillStyle = '#999';
                    ctx.beginPath();
                    ctx.moveTo(catX - 4, catY - 3);
                    ctx.lineTo(catX, catY - 14);
                    ctx.lineTo(catX + 4, catY - 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#ddd';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(catX, catY - 16);
                    ctx.lineTo(catX, catY - 13);
                    ctx.moveTo(catX - 2, catY - 14.5);
                    ctx.lineTo(catX + 2, catY - 14.5);
                    ctx.stroke();
                    // Inner wall ring (stone)
                    ctx.strokeStyle = 'rgba(120,120,120,0.6)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 2]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize * 0.45, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Watchtower rendering
                if (town.towers && town.towers > 0) {
                    for (let tw = 0; tw < Math.min(town.towers, 4); tw++) {
                        const tAngle = (tw / Math.max(town.towers, 4)) * Math.PI * 2 + Math.PI * 0.25;
                        const tDist = baseSize + 8;
                        const twx = cx + Math.cos(tAngle) * tDist;
                        const twy = cy + Math.sin(tAngle) * tDist;
                        // Tower base
                        ctx.fillStyle = '#666';
                        ctx.fillRect(twx - 3, twy - 6, 6, 10);
                        // Tower top
                        ctx.fillStyle = '#888';
                        ctx.fillRect(twx - 4, twy - 8, 8, 3);
                        // Flag
                        ctx.fillStyle = '#c00';
                        ctx.fillRect(twx + 1, twy - 12, 5, 3);
                        ctx.strokeStyle = '#555';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(twx + 1, twy - 12);
                        ctx.lineTo(twx + 1, twy - 8);
                        ctx.stroke();
                    }
                }

                // Livestock indicators (small icons near town)
                if (town.livestock) {
                    const totalLivestock = (town.livestock.livestock_cow || 0) + (town.livestock.livestock_pig || 0) + (town.livestock.livestock_chicken || 0);
                    if (totalLivestock > 0) {
                        ctx.font = '8px sans-serif';
                        ctx.fillStyle = 'rgba(60,40,20,0.9)';
                        const lvY = cy + baseSize + 22;
                        let lvIcons = '';
                        if (town.livestock.livestock_cow > 0) lvIcons += '🐄';
                        if (town.livestock.livestock_pig > 0) lvIcons += '🐷';
                        if (town.livestock.livestock_chicken > 0) lvIcons += '🐔';
                        ctx.fillText(lvIcons, cx - ctx.measureText(lvIcons).width / 2, lvY);
                    }
                }

                // Port dock/pier (brown rectangle extending toward water)
                if (town.isPort) {
                    // Find nearest water direction
                    const ttx = Math.floor(cx / CONFIG.TILE_SIZE);
                    const tty = Math.floor(cy / CONFIG.TILE_SIZE);
                    const terrainWidth = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
                    const terrainHeight = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);
                    let waterDirX = 0, waterDirY = 1; // default: south
                    const searchRadius = 5;
                    let minWaterDist = Infinity;
                    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                            const wx = ttx + dx;
                            const wy = tty + dy;
                            if (wx >= 0 && wx < terrainWidth && wy >= 0 && wy < terrainHeight) {
                                if (worldData.terrain && worldData.terrain[wy * terrainWidth + wx] === TERRAIN.WATER.id) {
                                    const d = Math.sqrt(dx * dx + dy * dy);
                                    if (d < minWaterDist && d > 0) {
                                        minWaterDist = d;
                                        waterDirX = dx / d;
                                        waterDirY = dy / d;
                                    }
                                }
                            }
                        }
                    }

                    // Draw pier
                    const pierLen = baseSize + 8;
                    const pierStartX = cx + waterDirX * (baseSize * 0.5);
                    const pierStartY = cy + waterDirY * (baseSize * 0.5);
                    const pierEndX = cx + waterDirX * pierLen;
                    const pierEndY = cy + waterDirY * pierLen;

                    ctx.strokeStyle = '#5a4a38';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(pierStartX, pierStartY);
                    ctx.lineTo(pierEndX, pierEndY);
                    ctx.stroke();

                    // Pier platform at end
                    ctx.fillStyle = '#6b5b4f';
                    ctx.fillRect(pierEndX - 4, pierEndY - 4, 8, 8);

                    // Anchor icon
                    ctx.fillStyle = 'rgba(0,180,200,0.8)';
                    ctx.font = '10px serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚓', pierEndX, pierEndY - 6);

                    // If player is here with a ship, show boat icon
                    if (typeof Player !== 'undefined' && Player.townId === town.id && Player.ships && Player.ships.length > 0) {
                        ctx.font = '12px serif';
                        ctx.fillText('⛵', pierEndX + 8, pierEndY + 2);
                    }
                }

                // Walls outline
                const walls = town.walls || 0;
                if (walls > 0) {
                    ctx.strokeStyle = walls >= 3 ? '#888' : walls >= 2 ? '#777' : '#666';
                    ctx.lineWidth = walls;
                    ctx.setLineDash(walls >= 2 ? [] : [3, 3]);
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Ruins overlay for destroyed towns
                if (isRuined) {
                    ctx.fillStyle = 'rgba(60,50,40,0.5)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, baseSize + 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.font = `${Math.max(12, baseSize * 0.6)}px sans-serif`;
                    ctx.fillStyle = 'rgba(180,40,30,0.9)';
                    ctx.textAlign = 'center';
                    ctx.fillText('💀', cx, cy + 4);
                }

                // Kingdom flag / banner
                const flagX = cx + baseSize + 4;
                const flagY = cy - baseSize - 8;
                ctx.strokeStyle = '#5a4a38';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(flagX, flagY + 14);
                ctx.lineTo(flagX, flagY);
                ctx.stroke();
                ctx.fillStyle = kColor;
                ctx.beginPath();
                ctx.moveTo(flagX, flagY);
                ctx.lineTo(flagX + 8, flagY + 3);
                ctx.lineTo(flagX, flagY + 6);
                ctx.closePath();
                ctx.fill();

                // Town name — size varies by category
                ctx.fillStyle = cat === 'capital_city' ? '#ffd700' : cat === 'city' ? '#e8dcc8' : '#d0c8b0';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2.5;
                const fontSize = cat === 'capital_city' ? 14 : cat === 'city' ? 12 : cat === 'town' ? 11 : 9;
                ctx.font = `bold ${fontSize}px 'Cinzel', serif`;
                ctx.textAlign = 'center';
                const nameLabel = cat === 'capital_city' ? `👑 ${town.name}` : (town.isFrontline ? `⚔️ ${town.name}` : town.name);
                ctx.strokeText(nameLabel, cx, cy - baseSize - 12);
                ctx.fillText(nameLabel, cx, cy - baseSize - 12);

                // Security indicator — subtle red dot, only at higher zoom
                const securityLevel = town.security || 0;
                if (securityLevel < 25 && camera.zoom > 1.5) {
                    ctx.save();
                    ctx.globalAlpha = 0.35;
                    ctx.fillStyle = 'rgba(200,40,30,0.9)';
                    ctx.font = '8px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠', cx, cy + baseSize + 22);
                    ctx.restore();
                }

                // Port/Island indicators next to town name
                if (camera.zoom > 1.0) {
                    let indicators = '';
                    if (town.isPort) indicators += ' ⚓';
                    if (town.isIsland) indicators = ' 🏝' + indicators;
                    if (indicators) {
                        ctx.fillStyle = 'rgba(200,190,170,0.7)';
                        ctx.font = '8px serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(indicators, cx, cy + baseSize + (securityLevel < 25 && camera.zoom > 1.5 ? 36 : 24));
                    }
                }
                } // close non-outpost else block
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════
    //  4d. SOIL FERTILITY OVERLAY
    // ═══════════════════════════════════════════════════════════

    function _fertColor(fert) {
        var r, g, b;
        if (fert <= 50) {
            var t = fert / 50;
            r = Math.round(180 * (1 - t) + 200 * t);
            g = Math.round(40 * (1 - t) + 180 * t);
            b = Math.round(40 * (1 - t) + 0 * t);
        } else {
            var t2 = (fert - 50) / 50;
            r = Math.round(200 * (1 - t2) + 30 * t2);
            g = Math.round(180 * (1 - t2) + 160 * t2);
            b = Math.round(0 * (1 - t2) + 30 * t2);
        }
        return { r: r, g: g, b: b };
    }

    function renderFertility() {
        if (!showFertility) return;
        const towns = _frameTowns;
        if (!towns) return;
        if (typeof Player === 'undefined' || !Player.hasSkill || !Player.hasSkill('soil_knowledge')) return;

        for (var i = 0; i < towns.length; i++) {
            var town = towns[i];
            if (!isVisible(town.x, town.y, 400)) continue;
            var fert = town.soilFertilityRating != null ? town.soilFertilityRating : (town.soilFertility != null ? Math.round(town.soilFertility * 50) : 50);
            var c = _fertColor(fert);
            var pop = town.population || 100;
            var territoryR = Math.max(50, 30 + Math.sqrt(pop) * 4);

            // Large territory fill
            var grad = ctx.createRadialGradient(town.x, town.y, territoryR * 0.2, town.x, town.y, territoryR);
            grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.30)');
            grad.addColorStop(0.7, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.15)');
            grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(town.x, town.y, territoryR, 0, Math.PI * 2);
            ctx.fill();

            // Border ring
            ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(town.x, town.y, territoryR * 0.85, 0, Math.PI * 2);
            ctx.stroke();

            // Fertility label
            var _fLabel = fert <= 25 ? 'Barren' : fert <= 40 ? 'Poor' : fert <= 55 ? 'Fair' : fert <= 70 ? 'Good' : fert <= 85 ? 'Rich' : 'Lush';
            var fontSize = Math.max(8, Math.min(14, 11 * camera.zoom));
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.95)';
            var labelY = town.y - territoryR * 0.65;
            ctx.strokeText('🌾 ' + fert + ' ' + _fLabel, town.x, labelY);
            ctx.fillText('🌾 ' + fert + ' ' + _fLabel, town.x, labelY);
        }
        ctx.textBaseline = 'alphabetic';
    }

    //  4c. RESOURCE DEPOSITS OVERLAY
    // ═══════════════════════════════════════════════════════════

    function renderDeposits() {
        if (!showDeposits) return;
        const towns = _frameTowns;
        if (!towns) return;
        if (typeof Player === 'undefined' || !Player.hasSkill) return;
        var hasRegional = Player.hasSkill('regional_survey');
        var hasWorld = Player.hasSkill('world_survey');
        if (!hasRegional && !hasWorld) return;

        var playerKingdom = Player.kingdomId;
        var depositIcons = {
            wheat: '🌾', iron_ore: '⛏', wood: '🪵',
            stone: '🪨', wool: '🐑', hide: '🐄',
            grapes: '🍇', gold_ore: '✨', hemp: '🌿',
            clay: '🏺', salt: '🧂', fish: '🐟',
            herbs: '🌿', honey: '🍯', silk: '🧣',
            pearls: '🫧', coal: '⬛', copper_ore: '🟤'
        };

        for (var t = 0; t < towns.length; t++) {
            var town = towns[t];
            if (!town.naturalDeposits) continue;
            if (!hasWorld) {
                if (town.kingdomId !== playerKingdom && Player.townId !== town.id) continue;
            }
            if (!isVisible(town.x, town.y, 300)) continue;

            var keys = Object.keys(town.naturalDeposits);
            var resources = [];
            for (var k = 0; k < keys.length; k++) {
                var amt = town.naturalDeposits[keys[k]];
                if (amt > 0) {
                    resources.push({ id: keys[k], amount: amt });
                }
            }
            if (resources.length === 0) continue;

            // Compact label rows below town: icon pct%  icon pct% ...
            var fontSize = Math.max(8, Math.min(11, 9 * camera.zoom));
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            var rowSize = 4;
            var yOff = 18;
            for (var row = 0; row < Math.ceil(resources.length / rowSize); row++) {
                var rowItems = resources.slice(row * rowSize, (row + 1) * rowSize);
                var label = '';
                for (var ri = 0; ri < rowItems.length; ri++) {
                    var r = rowItems[ri];
                    var icon = depositIcons[r.id] || '📦';
                    var amt = r.amount >= 1000 ? Math.round(r.amount / 1000) + 'k' : r.amount;
                    label += (ri > 0 ? '  ' : '') + icon + amt;
                }
                var ly = town.y + yOff + row * (fontSize + 3);
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = 2.5;
                ctx.fillStyle = 'rgba(220,210,180,0.95)';
                ctx.strokeText(label, town.x, ly);
                ctx.fillText(label, town.x, ly);
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    // ═══════════════════════════════════════════════════════════
    //  4e. SURVEY CIRCLE (right-click "Check Fertility" / "Find Deposits")
    // ═══════════════════════════════════════════════════════════

    function _surveyTerrainFertility(wx, wy, radius) {
        if (typeof Engine !== 'undefined' && Engine.surveyFertilityAtPoint) {
            return Engine.surveyFertilityAtPoint(wx, wy, radius);
        }
        return 50;
    }

    function _surveyTerrainDeposits(wx, wy, radius) {
        if (typeof Engine !== 'undefined' && Engine.surveyDepositsAtPoint) {
            return Engine.surveyDepositsAtPoint(wx, wy, radius);
        }
        return {};
    }

    function startFertilitySurvey(wx, wy) {
        _surveyCircle = { type: 'fertility', wx: wx, wy: wy, startFrame: frameCount, duration: 600 };
    }

    function startDepositSurvey(wx, wy) {
        _surveyCircle = { type: 'deposits', wx: wx, wy: wy, startFrame: frameCount, duration: 600 };
    }

    function renderSurveyCircle() {
        if (!_surveyCircle) return;
        var elapsed = frameCount - _surveyCircle.startFrame;
        if (elapsed > _surveyCircle.duration) { _surveyCircle = null; return; }

        var wx = _surveyCircle.wx, wy = _surveyCircle.wy;
        if (!isVisible(wx, wy, 500)) return;

        // Fade in/out
        var alpha = 1.0;
        if (elapsed < 20) alpha = elapsed / 20;
        else if (elapsed > _surveyCircle.duration - 60) alpha = (_surveyCircle.duration - elapsed) / 60;

        var surveyR = 200; // world-unit radius of the survey circle

        if (_surveyCircle.type === 'fertility') {
            var fert = _surveyTerrainFertility(wx, wy, surveyR);
            var c = _fertColor(fert);
            var _fLabel = fert <= 25 ? 'Barren' : fert <= 40 ? 'Poor' : fert <= 55 ? 'Fair' : fert <= 70 ? 'Good' : fert <= 85 ? 'Rich' : 'Lush';

            // Large survey circle
            var grad = ctx.createRadialGradient(wx, wy, surveyR * 0.1, wx, wy, surveyR);
            grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (0.35 * alpha) + ')');
            grad.addColorStop(0.7, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (0.18 * alpha) + ')');
            grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(wx, wy, surveyR, 0, Math.PI * 2);
            ctx.fill();

            // Dashed border
            ctx.save();
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (0.7 * alpha) + ')';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(wx, wy, surveyR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Center label
            var fontSize = Math.max(12, Math.min(20, 16 * camera.zoom));
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 3;
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.strokeText('🌾 Fertility: ' + fert + ' (' + _fLabel + ')', wx, wy);
            ctx.fillText('🌾 Fertility: ' + fert + ' (' + _fLabel + ')', wx, wy);
            ctx.globalAlpha = 1.0;

        } else if (_surveyCircle.type === 'deposits') {
            var deposits = _surveyTerrainDeposits(wx, wy, surveyR);
            var depositIcons = {
                wheat: '🌾', iron_ore: '⛏', wood: '🪵', stone: '🪨', wool: '🐑', hide: '🐄',
                grapes: '🍇', gold_ore: '✨', hemp: '🌿', clay: '🏺', salt: '🧂', fish: '🐟',
                herbs: '🌿', honey: '🍯', silk: '🧣', pearls: '🫧', coal: '⬛', copper_ore: '🟤'
            };
            var depositColors = {
                iron_ore: '#8b7355', stone: '#9a9a9a', gold_ore: '#ffd700', wheat: '#c8a84e',
                wood: '#2d6b2d', wool: '#d0c8b0', hide: '#8b6914', grapes: '#6a3d9a',
                hemp: '#4a7a3a', clay: '#b87333', salt: '#e8e8e8', fish: '#4a90c4',
                herbs: '#3a8a3a', honey: '#daa520', silk: '#c0a0d0', pearls: '#b0c4de',
                coal: '#333', copper_ore: '#b87333'
            };

            // Survey circle outline
            ctx.save();
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = 'rgba(200,180,120,' + (0.7 * alpha) + ')';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(wx, wy, surveyR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Subtle fill
            var dGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, surveyR);
            dGrad.addColorStop(0, 'rgba(180,160,100,' + (0.12 * alpha) + ')');
            dGrad.addColorStop(1, 'rgba(180,160,100,0)');
            ctx.fillStyle = dGrad;
            ctx.beginPath();
            ctx.arc(wx, wy, surveyR, 0, Math.PI * 2);
            ctx.fill();

            var depKeys = Object.keys(deposits);
            if (depKeys.length === 0) {
                // No deposits label
                var fontSize2 = Math.max(10, Math.min(16, 13 * camera.zoom));
                ctx.font = 'bold ' + fontSize2 + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2.5;
                ctx.fillStyle = '#aaa';
                ctx.strokeText('⛏ No deposits found nearby', wx, wy);
                ctx.fillText('⛏ No deposits found nearby', wx, wy);
                ctx.globalAlpha = 1.0;
            } else {
                // Show deposit icons in a ring around the center
                var dAngleStep = (Math.PI * 2) / depKeys.length;
                var dRingR = surveyR * 0.45;
                var dFontSize = Math.max(11, Math.min(18, 14 * camera.zoom));
                ctx.font = dFontSize + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = alpha;

                for (var di = 0; di < depKeys.length; di++) {
                    var dKey = depKeys[di];
                    var dIcon = depositIcons[dKey] || '📦';
                    var dColor = depositColors[dKey] || '#888';
                    var dAngle = -Math.PI / 2 + di * dAngleStep;
                    var dx = wx + Math.cos(dAngle) * dRingR;
                    var dy = wy + Math.sin(dAngle) * dRingR;

                    // Background circle
                    ctx.fillStyle = 'rgba(20,20,15,0.75)';
                    ctx.beginPath();
                    ctx.arc(dx, dy, dFontSize * 0.85, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = dColor;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(dx, dy, dFontSize * 0.85, 0, Math.PI * 2);
                    ctx.stroke();

                    // Icon
                    ctx.fillStyle = '#fff';
                    ctx.fillText(dIcon, dx, dy);

                    // Amount label below
                    ctx.font = 'bold ' + Math.max(8, dFontSize * 0.65) + 'px sans-serif';
                    ctx.fillStyle = dColor;
                    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                    ctx.lineWidth = 2;
                    var dName = dKey.replace(/_/g, ' ');
                    var dAmt = deposits[dKey] >= 1000 ? Math.round(deposits[dKey] / 1000) + 'k' : deposits[dKey];
                    ctx.strokeText(dAmt + ' ' + dName, dx, dy + dFontSize * 1.1);
                    ctx.fillText(dAmt + ' ' + dName, dx, dy + dFontSize * 1.1);
                    ctx.font = dFontSize + 'px sans-serif';
                }

                // Center header
                var hFontSize = Math.max(10, Math.min(15, 12 * camera.zoom));
                ctx.font = 'bold ' + hFontSize + 'px sans-serif';
                ctx.fillStyle = 'rgba(220,200,150,' + alpha + ')';
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2.5;
                ctx.strokeText('⛏ Deposits Survey', wx, wy);
                ctx.fillText('⛏ Deposits Survey', wx, wy);
                ctx.globalAlpha = 1.0;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  5. PEOPLE
    // ═══════════════════════════════════════════════════════════

    // Extract numeric ID from string IDs like "p_38" for stable hashing
    function _npcNumId(p, i) {
        if (typeof p.id === 'number') return p.id;
        if (typeof p.id === 'string') {
            var match = p.id.match(/\d+/);
            if (match) return parseInt(match[0], 10);
        }
        return i * 137;
    }

    // Compute NPC world position — shared by rendering and hit testing
    // Uses hash-based random walk: each NPC picks unique waypoints and walks between them
    function _npcPosition(numId, cx, cy, animTime) {
        var baseSeed  = tileHash(numId * 3 + 1, numId * 5 + 7);
        var baseSeed2 = tileHash(numId * 7 + 13, numId * 11 + 3);

        // Base position spread around town center
        var angle = baseSeed * Math.PI * 2;
        var dist  = 10 + baseSeed2 * 35;
        var baseX = cx + Math.cos(angle) * dist;
        var baseY = cy + Math.sin(angle) * dist;

        // Each NPC has a unique step duration (how long between direction changes)
        var stepLen = 1.8 + tileHash(numId * 19 + 5, numId * 23 + 11) * 3.5;
        var currentStep = Math.floor(animTime / stepLen);
        var frac = (animTime - currentStep * stepLen) / stepLen;
        // Smoothstep for natural decel/accel between waypoints
        frac = frac * frac * (3 - 2 * frac);

        // Wander radius from base position
        var wander = 5 + baseSeed2 * 8;

        // Waypoint A (current) and B (next) — each fully unique per NPC + step
        var dirA  = tileHash(numId * 41 + currentStep * 13, currentStep * 29 + numId * 7) * Math.PI * 2;
        var distA = tileHash(numId * 53 + currentStep * 17, currentStep * 37 + numId * 11) * wander;
        var dirB  = tileHash(numId * 41 + (currentStep + 1) * 13, (currentStep + 1) * 29 + numId * 7) * Math.PI * 2;
        var distB = tileHash(numId * 53 + (currentStep + 1) * 17, (currentStep + 1) * 37 + numId * 11) * wander;

        // Lerp between waypoints
        var wx = Math.cos(dirA) * distA + (Math.cos(dirB) * distB - Math.cos(dirA) * distA) * frac;
        var wy = Math.sin(dirA) * distA + (Math.sin(dirB) * distB - Math.sin(dirA) * distA) * frac;

        return { x: baseX + wx, y: baseY + wy };
    }

    function renderPeople() {
        const towns = _frameTowns;
        if (!towns) return;

        const ts = CONFIG.TILE_SIZE;
        const vb = getVisibleBounds();

        const occColors = {
            farmer: '#55a868',
            miner: '#8b7355',
            woodcutter: '#4a7c3f',
            craftsman: '#ccb974',
            merchant: '#c4a35a',
            soldier: '#c44e52',
            guard: '#8b2500',
            noble: '#8172b2',
            laborer: '#888',
            none: '#666',
        };

        for (const town of towns) {
            const cx = town.x;
            const cy = town.y;
            if (!isVisible(cx, cy, 150)) continue;

            let people;
            try { people = Engine.getPeopleCached(town.id); } catch (e) { continue; }
            if (!people || !people.length) continue;

            // Stable selection: sort alive NPCs by ID so the same ones render each frame
            var alivePeople = [];
            for (var pi = 0; pi < people.length; pi++) {
                if (people[pi].alive) alivePeople.push(people[pi]);
            }
            if (!alivePeople.length) continue;
            alivePeople.sort(function(a, b) { return _npcNumId(a, 0) - _npcNumId(b, 0); });
            if (alivePeople.length > 50) alivePeople.length = 50;

            for (let i = 0; i < alivePeople.length; i++) {
                const p = alivePeople[i];

                var numId = _npcNumId(p, i);
                var pos = _npcPosition(numId, cx, cy, _npcAnimTime);

                if (p.isEliteMerchant) {
                    // Elite merchants get a distinct gold dot, slightly larger
                    ctx.fillStyle = '#FFD700';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#8B6914';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                } else {
                    const occ = (p.occupation || 'none').toLowerCase();
                    ctx.fillStyle = occColors[occ] || '#888';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  6. CARAVANS
    // ═══════════════════════════════════════════════════════════

    // Simplified caravan rendering for low zoom — just colored dots
    function renderCaravansSimple(player) {
        _caravanPositions = [];
        if (!player || !player.caravans) return;
        const townMap = _frameTownMap;
        if (!townMap) return;

        for (const caravan of player.caravans) {
            if (caravan.status !== 'traveling') continue;
            const from = townMap[caravan.fromTownId];
            const to = townMap[caravan.toTownId];
            if (!from || !to) continue;
            const progress = Math.min(1.0, Math.max(0, caravan.progress || 0));
            var startTown = caravan.returnTrip ? to : from;
            var endTown = caravan.returnTrip ? from : to;
            var cx = startTown.x + (endTown.x - startTown.x) * progress;
            var cy = startTown.y + (endTown.y - startTown.y) * progress;

            ctx.fillStyle = caravan.routeType === 'sea' ? '#4488cc' : '#c4a35a';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            _caravanPositions.push({ x: cx, y: cy, caravan: caravan });
        }
    }

    function renderCaravans(player) {
        _caravanPositions = [];
        if (!player || !player.caravans) return;

        const towns = _frameTowns;
        if (!towns) return;
        const townMap = _frameTownMap;

        // Get roads/sea routes for waypoint lookup
        var roads = null;
        var seaRoutes = null;
        try { roads = Engine.getRoads(); } catch (e) { /* no-op */ }
        try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { /* no-op */ }

        for (const caravan of player.caravans) {
            if (caravan.status !== 'traveling') continue;
            const from = townMap[caravan.fromTownId];
            const to = townMap[caravan.toTownId];
            if (!from || !to) continue;

            const progress = Math.min(1.0, Math.max(0, caravan.progress || 0));

            // Determine actual start/end based on return trip
            var startTown, endTown;
            if (caravan.returnTrip) {
                startTown = to; endTown = from;
            } else {
                startTown = from; endTown = to;
            }

            // Build complete polyline of waypoints (same logic as player marker)
            var allWaypoints = [];

            if (caravan.route && caravan.route.length > 0) {
                for (var ri = 0; ri < caravan.route.length; ri++) {
                    var seg = caravan.route[ri];
                    var segFrom = townMap[seg.fromTownId];
                    var segTo = townMap[seg.toTownId];
                    if (!segFrom || !segTo) continue;

                    // Determine direction
                    var lastWP = allWaypoints.length > 0 ? allWaypoints[allWaypoints.length - 1] : null;
                    var forward = true;
                    if (lastWP) {
                        var dFrom = Math.hypot(lastWP.x - segFrom.x, lastWP.y - segFrom.y);
                        var dTo = Math.hypot(lastWP.x - segTo.x, lastWP.y - segTo.y);
                        forward = dFrom <= dTo;
                    } else {
                        forward = seg.fromTownId === (caravan.returnTrip ? caravan.toTownId : caravan.fromTownId);
                    }

                    // Look for waypoints in segment data or engine roads
                    var roadWaypoints = null;
                    if (seg.waypoints && seg.waypoints.length > 0) {
                        roadWaypoints = seg.waypoints;
                    } else {
                        var routeList = seg.type === 'sea' ? seaRoutes : roads;
                        if (routeList) {
                            for (var rri = 0; rri < routeList.length; rri++) {
                                var rd = routeList[rri];
                                if ((rd.fromTownId === seg.fromTownId && rd.toTownId === seg.toTownId) ||
                                    (rd.toTownId === seg.fromTownId && rd.fromTownId === seg.toTownId)) {
                                    if (rd.waypoints && rd.waypoints.length > 0) {
                                        roadWaypoints = rd.waypoints;
                                        if (rd.fromTownId !== seg.fromTownId) {
                                            roadWaypoints = roadWaypoints.slice().reverse();
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    if (roadWaypoints && roadWaypoints.length > 1) {
                        var wp = forward ? roadWaypoints : roadWaypoints.slice().reverse();
                        var startIdx = allWaypoints.length > 0 ? 1 : 0;
                        for (var wi = startIdx; wi < wp.length; wi++) {
                            allWaypoints.push({ x: wp[wi].x || wp[wi][0], y: wp[wi].y || wp[wi][1] });
                        }
                    } else {
                        var sPt = forward ? segFrom : segTo;
                        var ePt = forward ? segTo : segFrom;
                        if (allWaypoints.length === 0) {
                            allWaypoints.push({ x: sPt.x, y: sPt.y });
                        }
                        allWaypoints.push({ x: ePt.x, y: ePt.y });
                    }
                }
            }

            // Fallback if no waypoints gathered
            if (allWaypoints.length < 2) {
                allWaypoints = [
                    { x: startTown.x, y: startTown.y },
                    { x: endTown.x, y: endTown.y }
                ];
            }

            // Calculate position along polyline at progress
            var totalLen = 0;
            var segLens = [];
            for (var si = 1; si < allWaypoints.length; si++) {
                var dx = allWaypoints[si].x - allWaypoints[si-1].x;
                var dy = allWaypoints[si].y - allWaypoints[si-1].y;
                var sl = Math.sqrt(dx*dx + dy*dy);
                segLens.push(sl);
                totalLen += sl;
            }

            var cx, cy;
            if (totalLen > 0) {
                var targetDist = progress * totalLen;
                var cumDist = 0;
                cx = allWaypoints[0].x;
                cy = allWaypoints[0].y;
                for (var si2 = 0; si2 < segLens.length; si2++) {
                    if (cumDist + segLens[si2] >= targetDist) {
                        var t = segLens[si2] > 0 ? (targetDist - cumDist) / segLens[si2] : 0;
                        cx = allWaypoints[si2].x + (allWaypoints[si2+1].x - allWaypoints[si2].x) * t;
                        cy = allWaypoints[si2].y + (allWaypoints[si2+1].y - allWaypoints[si2].y) * t;
                        break;
                    }
                    cumDist += segLens[si2];
                    cx = allWaypoints[si2 + 1].x;
                    cy = allWaypoints[si2 + 1].y;
                }
            } else {
                cx = startTown.x;
                cy = startTown.y;
            }

            // Store position for hit testing
            _caravanPositions.push({ id: caravan.id, x: cx, y: cy, caravan: caravan });

            if (!isVisible(cx, cy, 50)) continue;

            // Draw caravan marker
            var pulse = Math.sin(frameCount * 0.06) * 0.8;
            var sc = (camera.zoom > 0.5 ? 1.0 : 0.7) + pulse * 0.05;
            var isSea = caravan.routeType === 'sea';

            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(sc, sc);

            if (isSea) {
                // ─── SHIP SPRITE for sea caravans ───
                var sColor = caravan.disbanding ? '#c06060' : '#2a6496';
                var sLight = caravan.disbanding ? '#e0a0a0' : '#4a94c8';
                var sDark  = caravan.disbanding ? '#802020' : '#1a3a5a';
                var sAccent = caravan.disbanding ? '#c08080' : '#c2a050';

                // Subtle water glow
                ctx.shadowColor = '#2080c0';
                ctx.shadowBlur = 8;

                // Hull (elongated boat shape)
                ctx.fillStyle = sColor;
                ctx.beginPath();
                ctx.moveTo(-10, 2);
                ctx.quadraticCurveTo(-10, 5, -6, 6);
                ctx.lineTo(6, 6);
                ctx.quadraticCurveTo(11, 5, 12, 2);
                ctx.lineTo(10, -1);
                ctx.lineTo(-8, -1);
                ctx.closePath();
                ctx.fill();

                ctx.shadowBlur = 0;

                // Hull outline
                ctx.strokeStyle = sDark;
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(-10, 2);
                ctx.quadraticCurveTo(-10, 5, -6, 6);
                ctx.lineTo(6, 6);
                ctx.quadraticCurveTo(11, 5, 12, 2);
                ctx.lineTo(10, -1);
                ctx.lineTo(-8, -1);
                ctx.closePath();
                ctx.stroke();

                // Hull stripe
                ctx.strokeStyle = sLight;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(-8, 2);
                ctx.lineTo(10, 2);
                ctx.stroke();

                // Mast
                ctx.strokeStyle = sAccent;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(1, -1);
                ctx.lineTo(1, -14);
                ctx.stroke();

                // Sail (triangle, flutters slightly)
                var sailFlutter = Math.sin(frameCount * 0.04) * 0.8;
                ctx.fillStyle = '#e8dcc8';
                ctx.beginPath();
                ctx.moveTo(1, -13);
                ctx.quadraticCurveTo(8 + sailFlutter, -8, 2, -2);
                ctx.lineTo(1, -2);
                ctx.closePath();
                ctx.fill();

                // Sail outline
                ctx.strokeStyle = sDark;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(1, -13);
                ctx.quadraticCurveTo(8 + sailFlutter, -8, 2, -2);
                ctx.lineTo(1, -2);
                ctx.closePath();
                ctx.stroke();

                // Sail line across
                ctx.strokeStyle = 'rgba(100,80,60,0.3)';
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(1, -9);
                ctx.lineTo(5 + sailFlutter * 0.5, -7);
                ctx.stroke();

                // Bow flag
                ctx.strokeStyle = sAccent;
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.moveTo(1, -14);
                ctx.lineTo(4, -14);
                ctx.lineTo(2.5, -12.5);
                ctx.lineTo(4, -11);
                ctx.stroke();

                // Small wake lines behind ship
                ctx.strokeStyle = 'rgba(180,220,255,0.35)';
                ctx.lineWidth = 0.5;
                var waveOff = Math.sin(frameCount * 0.08) * 1.5;
                ctx.beginPath();
                ctx.moveTo(-10, 4 + waveOff);
                ctx.lineTo(-14, 5 + waveOff);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-9, 6 + waveOff * 0.7);
                ctx.lineTo(-13, 7 + waveOff * 0.7);
                ctx.stroke();
            } else {
                // ─── WAGON SPRITE for land caravans ───
                var cColor = caravan.disbanding ? '#c06060' : '#8b6914';
                var cLight = caravan.disbanding ? '#e0a0a0' : '#c2a050';
                var cDark = caravan.disbanding ? '#802020' : '#5a3e0a';

                // Subtle glow beneath
                ctx.shadowColor = cColor;
                ctx.shadowBlur = 6;

                // Wagon body (rounded rectangle)
                ctx.fillStyle = cColor;
                ctx.beginPath();
                ctx.moveTo(-7, -2);
                ctx.lineTo(7, -2);
                ctx.lineTo(8, -1);
                ctx.lineTo(8, 3);
                ctx.lineTo(-8, 3);
                ctx.lineTo(-8, -1);
                ctx.closePath();
                ctx.fill();

                ctx.shadowBlur = 0;

                // Canopy / cover (arched top)
                ctx.fillStyle = cLight;
                ctx.beginPath();
                ctx.moveTo(-6, -2);
                ctx.quadraticCurveTo(-6, -8, 0, -9);
                ctx.quadraticCurveTo(6, -8, 6, -2);
                ctx.closePath();
                ctx.fill();

                // Canopy outline
                ctx.strokeStyle = cDark;
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(-6, -2);
                ctx.quadraticCurveTo(-6, -8, 0, -9);
                ctx.quadraticCurveTo(6, -8, 6, -2);
                ctx.stroke();

                // Canopy ribs
                ctx.strokeStyle = cDark;
                ctx.lineWidth = 0.4;
                ctx.beginPath();
                ctx.moveTo(-3, -2); ctx.quadraticCurveTo(-3, -7, 0, -8);
                ctx.moveTo(3, -2); ctx.quadraticCurveTo(3, -7, 0, -8);
                ctx.stroke();

                // Wagon body outline
                ctx.strokeStyle = cDark;
                ctx.lineWidth = 0.7;
                ctx.strokeRect(-8, -2, 16, 5);

                // Wheels (two circles)
                var wheelY = 4;
                // Left wheel
                ctx.fillStyle = cDark;
                ctx.beginPath();
                ctx.arc(-5, wheelY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = cLight;
                ctx.beginPath();
                ctx.arc(-5, wheelY, 1.5, 0, Math.PI * 2);
                ctx.fill();
                // Spokes
                ctx.strokeStyle = cLight;
                ctx.lineWidth = 0.4;
                for (var sp = 0; sp < 4; sp++) {
                    var ang = sp * Math.PI / 4 + frameCount * 0.03;
                    ctx.beginPath();
                    ctx.moveTo(-5 + Math.cos(ang) * 1.2, wheelY + Math.sin(ang) * 1.2);
                    ctx.lineTo(-5 + Math.cos(ang) * 2.8, wheelY + Math.sin(ang) * 2.8);
                    ctx.stroke();
                }

                // Right wheel
                ctx.fillStyle = cDark;
                ctx.beginPath();
                ctx.arc(5, wheelY, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = cLight;
                ctx.beginPath();
                ctx.arc(5, wheelY, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = cLight;
                ctx.lineWidth = 0.4;
                for (var sp2 = 0; sp2 < 4; sp2++) {
                    var ang2 = sp2 * Math.PI / 4 + frameCount * 0.03;
                    ctx.beginPath();
                    ctx.moveTo(5 + Math.cos(ang2) * 1.2, wheelY + Math.sin(ang2) * 1.2);
                    ctx.lineTo(5 + Math.cos(ang2) * 2.8, wheelY + Math.sin(ang2) * 2.8);
                    ctx.stroke();
                }
            }

            // Caravan name / goods at higher zoom
            if (camera.zoom > 1.0) {
                var goodsCount = caravan.goods ? Object.values(caravan.goods).reduce(function(a, b) { return a + b; }, 0) : 0;
                ctx.font = '7px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillStyle = '#e8dcc8';
                var fromName = caravan.returnTrip ? (to ? to.name : '?') : (from ? from.name : '?');
                var toName = caravan.returnTrip ? (from ? from.name : '?') : (to ? to.name : '?');
                var labelY = isSea ? 9 : 10;
                ctx.fillText(fromName + '\u2192' + toName, 0, labelY);
                if (goodsCount > 0) {
                    ctx.fillText((isSea ? '\u2693' : '\uD83D\uDCE6') + goodsCount, 0, labelY + 9);
                }
            }

            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  6b. ARMY MARKERS (marching armies on the map)
    // ═══════════════════════════════════════════════════════════

    // Helper: interpolate position along road waypoints
    function _getPositionOnRoad(road, fromId, progress) {
        if (!road || !road.waypoints || road.waypoints.length < 2) return null;
        var wp = road.waypoints;
        // Reverse waypoints if army is going from road.toTownId → road.fromTownId
        if (road.toTownId === fromId) {
            wp = wp.slice().reverse();
        }
        var totalLen = 0;
        for (var i = 1; i < wp.length; i++) {
            totalLen += Math.hypot(wp[i].x - wp[i-1].x, wp[i].y - wp[i-1].y);
        }
        if (totalLen === 0) return { x: wp[0].x, y: wp[0].y };
        var targetLen = Math.min(1, Math.max(0, progress)) * totalLen;
        var accum = 0;
        for (var j = 1; j < wp.length; j++) {
            var segLen = Math.hypot(wp[j].x - wp[j-1].x, wp[j].y - wp[j-1].y);
            if (accum + segLen >= targetLen) {
                var t = segLen > 0 ? (targetLen - accum) / segLen : 0;
                return { x: wp[j-1].x + (wp[j].x - wp[j-1].x) * t, y: wp[j-1].y + (wp[j].y - wp[j-1].y) * t };
            }
            accum += segLen;
        }
        return { x: wp[wp.length-1].x, y: wp[wp.length-1].y };
    }

    // Build road lookup for army rendering
    function _buildArmyRoadMap() {
        var roadMap = {};
        var roads = null;
        try { roads = Engine.getRoads(); } catch(e) {}
        if (roads) {
            for (var i = 0; i < roads.length; i++) {
                var rd = roads[i];
                if (!rd.waypoints || rd.waypoints.length < 2) continue;
                roadMap[rd.fromTownId + '_' + rd.toTownId] = rd;
                roadMap[rd.toTownId + '_' + rd.fromTownId] = rd;
            }
        }
        return roadMap;
    }

    function renderArmies() {
        var armies = null;
        try { armies = Engine.getArmies(); } catch(e) { return; }
        if (!armies || armies.length === 0) return;
        var townMap = _frameTownMap;
        if (!townMap) return;
        var roadMap = _buildArmyRoadMap();

        for (var ai = 0; ai < armies.length; ai++) {
            var army = armies[ai];
            if (army._retreating) continue;

            var isBesieging = !!army._besieging;

            var fromT = townMap[army.fromTownId];
            var toT = townMap[army.toTownId];
            if (!fromT || !toT) continue;

            // Calculate position along route (besieging armies sit at destination)
            var ax, ay;
            if (isBesieging) {
                ax = toT.x;
                ay = toT.y;
            } else if (army.route && army.route.legs && army.route.legs.length > 0) {
                var legIdx = army.legIndex || 0;
                var legProg = army.legProgress || 0;
                if (legIdx >= army.route.legs.length) legIdx = army.route.legs.length - 1;
                var leg = army.route.legs[legIdx];
                var legFrom = townMap[leg.from];
                var legTo = townMap[leg.to];
                if (legFrom && legTo) {
                    // Try to follow road waypoints for road legs
                    var _roadKey = leg.from + '_' + leg.to;
                    var _road = roadMap ? roadMap[_roadKey] : null;
                    if (_road && (leg.type === 'road' || leg.type === 'road_destroyed_bridge')) {
                        var _pos = _getPositionOnRoad(_road, leg.from, legProg);
                        if (_pos) { ax = _pos.x; ay = _pos.y; }
                    }
                    // Fallback: straight line between towns
                    if (ax == null) {
                        ax = legFrom.x + (legTo.x - legFrom.x) * Math.min(1, legProg);
                        ay = legFrom.y + (legTo.y - legFrom.y) * Math.min(1, legProg);
                    }
                } else {
                    var p = army.progress || 0;
                    ax = fromT.x + (toT.x - fromT.x) * p;
                    ay = fromT.y + (toT.y - fromT.y) * p;
                }
            } else {
                var p2 = army.progress || 0;
                ax = fromT.x + (toT.x - fromT.x) * p2;
                ay = fromT.y + (toT.y - fromT.y) * p2;
            }

            // Determine army color by kingdom
            var armyColor = '#c44e52';
            var armyBorder = '#802020';
            var isPlayerArmy = false;
            try {
                var aK = Engine.findKingdom(army.kingdomId);
                if (aK && aK.color) { armyColor = aK.color; }
                if (typeof Player !== 'undefined' && Player.state && Player.state.kingState &&
                    Player.state.kingState.kingdomId === army.kingdomId) {
                    armyColor = '#55a868';
                    armyBorder = '#2d6e3f';
                    isPlayerArmy = true;
                }
            } catch(e) {}

            var sc = 1.0 / Math.max(camera.zoom, 0.5);

            ctx.save();
            ctx.translate(ax, ay);
            ctx.scale(sc, sc);

            // Offset besieging marker so it doesn't overlap the town icon
            if (isBesieging) ctx.translate(18, -18);

            // Shield shape (3× larger: was ±6/10, now ±18/30)
            ctx.fillStyle = armyColor;
            ctx.strokeStyle = armyBorder;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -24);
            ctx.lineTo(18, -12);
            ctx.lineTo(18, 6);
            ctx.quadraticCurveTo(18, 21, 0, 30);
            ctx.quadraticCurveTo(-18, 21, -18, 6);
            ctx.lineTo(-18, -12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Crossed swords icon on shield (3× larger)
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-8, -9); ctx.lineTo(8, 15);
            ctx.moveTo(8, -9); ctx.lineTo(-8, 15);
            ctx.stroke();
            // Sword hilts
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-11, -6); ctx.lineTo(-5, -12);
            ctx.moveTo(11, -6); ctx.lineTo(5, -12);
            ctx.stroke();

            // Besieging indicator — pulsing ring
            if (isBesieging) {
                ctx.strokeStyle = '#ff6666';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(0, 3, 26, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Soldier count label (3× larger: was 7px, now 18px)
            var soldierText = '' + (army.soldiers || '?');
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            // Shadow for readability
            ctx.fillStyle = '#000';
            ctx.fillText(soldierText, 1, 32);
            ctx.fillStyle = '#fff';
            ctx.fillText(soldierText, 0, 31);

            // Status label beneath count
            if (isBesieging) {
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = '#ff6666';
                ctx.fillText('SIEGE', 0, 50);
            } else if (army.mounted) {
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = '#d4a843';
                ctx.fillText('🐴', 0, 50);
            }

            ctx.restore();
        }
    }

    function renderArmiesSimple() {
        var armies = null;
        try { armies = Engine.getArmies(); } catch(e) { return; }
        if (!armies || armies.length === 0) return;
        var townMap = _frameTownMap;
        if (!townMap) return;
        var roadMap = _buildArmyRoadMap();

        for (var ai = 0; ai < armies.length; ai++) {
            var army = armies[ai];
            if (army._retreating) continue;

            var isBesieging = !!army._besieging;
            var fromT = townMap[army.fromTownId];
            var toT = townMap[army.toTownId];
            if (!fromT || !toT) continue;

            var cx, cy;
            if (isBesieging) {
                cx = toT.x + 10;
                cy = toT.y - 10;
            } else if (army.route && army.route.legs && army.route.legs.length > 0) {
                var legIdx = army.legIndex || 0;
                var legProg = army.legProgress || 0;
                if (legIdx < army.route.legs.length) {
                    var leg = army.route.legs[legIdx];
                    var lf = townMap[leg.from]; var lt = townMap[leg.to];
                    if (lf && lt) {
                        // Follow road waypoints
                        var _sKey = leg.from + '_' + leg.to;
                        var _sRoad = roadMap ? roadMap[_sKey] : null;
                        if (_sRoad && (leg.type === 'road' || leg.type === 'road_destroyed_bridge')) {
                            var _sPos = _getPositionOnRoad(_sRoad, leg.from, legProg);
                            if (_sPos) { cx = _sPos.x; cy = _sPos.y; }
                        }
                        if (cx == null) {
                            cx = lf.x + (lt.x - lf.x) * Math.min(1, legProg);
                            cy = lf.y + (lt.y - lf.y) * Math.min(1, legProg);
                        }
                    }
                }
            }
            if (cx == null) {
                var p = army.progress || 0;
                cx = fromT.x + (toT.x - fromT.x) * p;
                cy = fromT.y + (toT.y - fromT.y) * p;
            }

            var sc = 1.0 / Math.max(camera.zoom, 0.5);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(sc, sc);

            // Larger dot (was 5px radius)
            ctx.fillStyle = isBesieging ? '#ff6666' : '#c44e52';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#802020';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Soldier count text
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText('' + (army.soldiers || '?'), 0, 0);

            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  7. PLAYER MARKER
    // ═══════════════════════════════════════════════════════════

    function renderPlayerMarker(player) {
        if (!player) return;

        let px, py;

        // Waypoint-based free travel rendering
        if (player.traveling && player.travelWaypoints && player.travelWaypoints.length >= 2) {
            var wps = player.travelWaypoints;
            var totalPathDist = 0;
            var wpDists = [];
            for (var wi = 1; wi < wps.length; wi++) {
                var wd = Math.hypot(wps[wi].x - wps[wi-1].x, wps[wi].y - wps[wi-1].y);
                wpDists.push(wd);
                totalPathDist += wd;
            }
            var wpProgress = player.travelProgress || 0;
            var targetWpDist = wpProgress * totalPathDist;
            var accWpDist = 0;
            px = wps[0].x;
            py = wps[0].y;
            for (var wj = 0; wj < wpDists.length; wj++) {
                if (accWpDist + wpDists[wj] >= targetWpDist) {
                    var wt = (targetWpDist - accWpDist) / wpDists[wj];
                    px = wps[wj].x + (wps[wj+1].x - wps[wj].x) * wt;
                    py = wps[wj].y + (wps[wj+1].y - wps[wj].y) * wt;
                    break;
                }
                accWpDist += wpDists[wj];
                px = wps[wj + 1].x;
                py = wps[wj + 1].y;
            }
        } else if (player.traveling && player.travelRoute && player.travelRoute.length > 0) {
            // Interpolate position along travel route based on travelProgress (0-1)
            const progress = player.travelProgress || 0;
            const route = player.travelRoute;
            const towns = _frameTowns;
            const townMap = _frameTownMap;

            // Build complete polyline of waypoints, using road waypoints when available
            const allWaypoints = [];

            // Determine origin town for first waypoint
            let originId = player.travelOrigin || player.townId;

            // Try to get road/sea route waypoint data from Engine
            let roads = null;
            let seaRoutes = null;
            try { roads = Engine.getRoads(); } catch (e) { /* no-op */ }
            try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { /* no-op */ }

            for (let ri = 0; ri < route.length; ri++) {
                const seg = route[ri];
                const from = townMap[seg.fromTownId];
                const to = townMap[seg.toTownId];
                if (!from || !to) continue;

                // Determine direction for this segment
                const lastWP = allWaypoints.length > 0 ? allWaypoints[allWaypoints.length - 1] : null;
                let forward = true; // from → to
                if (lastWP) {
                    const dFrom = Math.hypot(lastWP.x - from.x, lastWP.y - from.y);
                    const dTo = Math.hypot(lastWP.x - to.x, lastWP.y - to.y);
                    forward = dFrom <= dTo;
                } else if (originId) {
                    forward = seg.fromTownId === originId;
                }

                // Look for road/sea route waypoints
                let roadWaypoints = null;
                if (seg.waypoints && seg.waypoints.length > 0) {
                    roadWaypoints = seg.waypoints;
                } else {
                    // Search engine roads for waypoint data
                    const routeList = seg.type === 'sea' ? seaRoutes : roads;
                    if (routeList) {
                        for (let rri = 0; rri < routeList.length; rri++) {
                            const rd = routeList[rri];
                            if ((rd.fromTownId === seg.fromTownId && rd.toTownId === seg.toTownId) ||
                                (rd.toTownId === seg.fromTownId && rd.fromTownId === seg.toTownId)) {
                                if (rd.waypoints && rd.waypoints.length > 0) {
                                    roadWaypoints = rd.waypoints;
                                    // Adjust direction if the road's from/to is swapped relative to our segment
                                    if (rd.fromTownId !== seg.fromTownId) {
                                        roadWaypoints = roadWaypoints.slice().reverse();
                                    }
                                }
                                break;
                            }
                        }
                    }
                }

                if (roadWaypoints && roadWaypoints.length > 1) {
                    // Use actual road waypoints — reverse if needed
                    let wp = forward ? roadWaypoints : roadWaypoints.slice().reverse();
                    var startIdx = allWaypoints.length > 0 ? 1 : 0;
                    for (var wi = startIdx; wi < wp.length; wi++) {
                        allWaypoints.push({ x: wp[wi].x || wp[wi][0], y: wp[wi].y || wp[wi][1] });
                    }
                } else {
                    // Fallback to town centers
                    let startPt = forward ? from : to;
                    let endPt = forward ? to : from;
                    if (allWaypoints.length === 0) {
                        allWaypoints.push({ x: startPt.x, y: startPt.y });
                    }
                    allWaypoints.push({ x: endPt.x, y: endPt.y });
                }
            }

            // Calculate cumulative distances along the polyline
            let totalDist = 0;
            const segDists = [];
            for (let i = 1; i < allWaypoints.length; i++) {
                const d = Math.hypot(allWaypoints[i].x - allWaypoints[i - 1].x, allWaypoints[i].y - allWaypoints[i - 1].y);
                segDists.push(d);
                totalDist += d;
            }

            if (allWaypoints.length >= 2 && totalDist > 0) {
                // Find position at progress along total distance
                let targetDist = progress * totalDist;
                let accumulated = 0;
                px = allWaypoints[0].x;
                py = allWaypoints[0].y;

                for (let i = 0; i < segDists.length; i++) {
                    if (accumulated + segDists[i] >= targetDist) {
                        const segProgress = (targetDist - accumulated) / segDists[i];
                        px = allWaypoints[i].x + (allWaypoints[i + 1].x - allWaypoints[i].x) * segProgress;
                        py = allWaypoints[i].y + (allWaypoints[i + 1].y - allWaypoints[i].y) * segProgress;
                        break;
                    }
                    accumulated += segDists[i];
                    px = allWaypoints[i + 1].x;
                    py = allWaypoints[i + 1].y;
                }
            } else {
                // Fallback: linear interpolation between origin and destination
                let originTown, destTown;
                try { originTown = Engine.getTown(player.travelOrigin || player.townId); } catch (e) { /* no-op */ }
                try { destTown = Engine.getTown(player.travelDestination); } catch (e) { /* no-op */ }
                if (originTown && destTown) {
                    px = originTown.x + (destTown.x - originTown.x) * progress;
                    py = originTown.y + (destTown.y - originTown.y) * progress;
                } else if (originTown) {
                    px = originTown.x;
                    py = originTown.y;
                } else {
                    return;
                }
            }
        } else if (player.townId != null) {
            let town;
            try { town = Engine.getTown(player.townId); } catch (e) { /* no-op */ }
            if (!town) {
                const towns = _frameTowns;
                town = towns ? towns.find(t => t.id === player.townId) : null;
            }
            if (!town) return;
            px = town.x;
            py = town.y;
        } else if (player.worldX != null && player.worldY != null) {
            // Player is in the wilderness (not at a town)
            px = player.worldX;
            py = player.worldY;
        } else {
            return;
        }

        if (!isVisible(px, py, 100)) return;

        // Off-sea travel: draw a ship sprite instead of diamond marker
        if (player.travelOffSea) {
            ctx.save();
            ctx.translate(px, py);

            // Determine heading for ship rotation
            var heading = 0;
            if (player.travelWaypoints && player.travelWaypoints.length >= 2) {
                var wp0 = player.travelWaypoints[0];
                var wp1 = player.travelWaypoints[player.travelWaypoints.length - 1];
                heading = Math.atan2(wp1.y - wp0.y, wp1.x - wp0.x);
            }
            ctx.rotate(heading + Math.PI / 2);

            var sz = 10;
            var flutter = Math.sin(frameCount * 0.04) * 1.5;

            // Glow
            ctx.shadowColor = '#c4a35a';
            ctx.shadowBlur = 10;

            // Hull (gold-tinted)
            ctx.fillStyle = '#c4a35a';
            ctx.beginPath();
            ctx.moveTo(-sz * 0.6, sz * 0.3);
            ctx.quadraticCurveTo(-sz * 0.7, -sz * 0.2, -sz * 0.3, -sz * 0.7);
            ctx.lineTo(sz * 0.3, -sz * 0.7);
            ctx.quadraticCurveTo(sz * 0.7, -sz * 0.2, sz * 0.6, sz * 0.3);
            ctx.lineTo(0, sz * 0.5);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;

            // Mast
            ctx.strokeStyle = '#8b7355';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, sz * 0.2);
            ctx.lineTo(0, -sz);
            ctx.stroke();

            // Sail (white with gold tint)
            ctx.fillStyle = 'rgba(255,248,230,0.9)';
            ctx.beginPath();
            ctx.moveTo(0, -sz * 0.9);
            ctx.quadraticCurveTo(sz * 0.5 + flutter, -sz * 0.3, 0, sz * 0.1);
            ctx.closePath();
            ctx.fill();

            // Wake lines
            ctx.strokeStyle = 'rgba(200,200,255,0.3)';
            ctx.lineWidth = 1;
            var waveOff = Math.sin(frameCount * 0.06) * 2;
            ctx.beginPath();
            ctx.moveTo(-sz * 0.3, sz * 0.4);
            ctx.lineTo(-sz * 0.5 + waveOff, sz * 0.8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sz * 0.3, sz * 0.4);
            ctx.lineTo(sz * 0.5 - waveOff, sz * 0.8);
            ctx.stroke();

            // Progress text
            if (player.traveling) {
                ctx.rotate(-(heading + Math.PI / 2));
                ctx.fillStyle = 'rgba(196,163,90,0.9)';
                ctx.font = Math.max(8, 10) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round((player.travelProgress || 0) * 100) + '%', 0, -sz - 8);
            }

            ctx.restore();
            return;
        }

        // Golden diamond marker
        const pulse = Math.sin(frameCount * 0.08) * 2;
        const size = 8 + pulse;

        ctx.save();
        ctx.translate(px, py);

        // Glow
        ctx.shadowColor = '#c4a35a';
        ctx.shadowBlur = 12 + pulse;

        ctx.fillStyle = '#c4a35a';
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.6, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.6, 0);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;

        // Inner lighter diamond
        ctx.fillStyle = '#e8d48b';
        const inner = size * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -inner);
        ctx.lineTo(inner * 0.6, 0);
        ctx.lineTo(0, inner);
        ctx.lineTo(-inner * 0.6, 0);
        ctx.closePath();
        ctx.fill();

        // Show travel indicator text when traveling
        if (player.traveling) {
            ctx.fillStyle = 'rgba(196,163,90,0.9)';
            ctx.font = `${Math.max(8, 10)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round((player.travelProgress || 0) * 100)}%`, 0, -size - 6);
        }

        ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════
    //  8. AI MERCHANTS
    // ═══════════════════════════════════════════════════════════

    function renderAIMerchants() {
        // UNIFIED: AI merchants are now elite merchants in world.people.
        // They render as gold dots in renderPeople() and heraldry flags in renderEliteMerchantIcons().
        // This function is intentionally a no-op.
    }

    // ═══════════════════════════════════════════════════════════
    //  9. WAR INDICATORS
    // ═══════════════════════════════════════════════════════════

    function renderWarIndicators() {
        const kingdoms = _frameKingdoms;
        if (!kingdoms) return;

        const towns = _frameTowns;
        if (!towns) return;
        const ts = CONFIG.TILE_SIZE;

        for (const kingdom of kingdoms) {
            if (!kingdom.atWar || !(kingdom.atWar instanceof Set ? kingdom.atWar.size : kingdom.atWar.length)) continue;

            // Find center of this kingdom
            const kTowns = towns.filter(t => t.kingdomId === kingdom.id);
            if (!kTowns.length) continue;
            const kcx = kTowns.reduce((s, t) => s + t.x, 0) / kTowns.length;
            const kcy = kTowns.reduce((s, t) => s + t.y, 0) / kTowns.length;

            for (const enemyId of kingdom.atWar) {
                const enemyTowns = towns.filter(t => t.kingdomId === enemyId);
                if (!enemyTowns.length) continue;
                const ecx = enemyTowns.reduce((s, t) => s + t.x, 0) / enemyTowns.length;
                const ecy = enemyTowns.reduce((s, t) => s + t.y, 0) / enemyTowns.length;

                const midX = (kcx + ecx) / 2;
                const midY = (kcy + ecy) / 2;

                if (!isVisible(midX, midY, 200)) continue;

                // Crossed swords symbol
                ctx.save();
                ctx.translate(midX, midY);
                ctx.fillStyle = 'rgba(200,40,30,0.8)';
                ctx.font = `bold ${Math.max(14, 18)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('⚔', 0, 0);
                ctx.restore();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  10. EVENT EFFECTS
    // ═══════════════════════════════════════════════════════════

    function renderEventEffects() {
        let events;
        try { events = Engine.getEvents(); } catch (e) { return; }
        if (!events || !events.length) return;

        const towns = _frameTowns;
        if (!towns) return;
        const townMap = _frameTownMap;
        const ts = CONFIG.TILE_SIZE;
        const currentDay = (typeof Engine !== 'undefined' && Engine.getDay) ? Engine.getDay() : 0;

        // Only show recent events (within 30 days)
        const recentEvents = events.filter(e => (currentDay - (e.day || 0)) < 30);

        for (const event of recentEvents) {
            if (!event.townId) continue;
            const town = townMap[event.townId];
            if (!town) continue;

            const cx = town.x;
            const cy = town.y;
            if (!isVisible(cx, cy, 100)) continue;

            const type = (event.type || '').toLowerCase();

            ctx.save();
            ctx.font = '12px serif';
            ctx.textAlign = 'center';

            if (type.includes('plague')) {
                ctx.fillStyle = 'rgba(100,200,100,0.6)';
                ctx.fillText('☠', cx - 15, cy + 25);
                ctx.fillText('☠', cx + 15, cy + 30);
            } else if (type.includes('drought')) {
                // Dry tint around town
                ctx.fillStyle = 'rgba(180,150,80,0.15)';
                ctx.beginPath();
                ctx.arc(cx, cy, 50, 0, Math.PI * 2);
                ctx.fill();
            } else if (type.includes('festival') || type.includes('bountiful') || type.includes('wedding')) {
                const bob = Math.sin(frameCount * 0.1) * 3;
                ctx.fillText('🎉', cx - 20, cy - 25 + bob);
                ctx.fillText('🎊', cx + 20, cy - 28 + bob);
            } else if (type.includes('bandit')) {
                ctx.fillStyle = 'rgba(200,40,30,0.6)';
                ctx.fillText('🗡', cx - 25, cy + 20);
            } else if (type.includes('flood')) {
                ctx.fillStyle = 'rgba(60,120,200,0.2)';
                ctx.beginPath();
                ctx.arc(cx, cy, 40, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  HOVER HIGHLIGHT
    // ═══════════════════════════════════════════════════════════

    function renderHoverHighlight() {
        if (!hoverTarget) return;
        const ts = CONFIG.TILE_SIZE;

        if (hoverTarget.type === 'town') {
            const town = hoverTarget.data;
            if (!town) return;
            const cx = town.x;
            const cy = town.y;
            const r = 10 + Math.sqrt(town.population || 100) * 0.35;

            ctx.strokeStyle = 'rgba(232,212,139,0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  SEASON OVERLAY
    // ═══════════════════════════════════════════════════════════

    function renderSeasonOverlay() {
        const tint = getSeasonTint();
        if (!tint) return;
        ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Winter snow specks
        if (typeof Engine !== 'undefined' && Engine.getSeason && Engine.getSeason() === 'Winter') {
            ctx.fillStyle = 'rgba(240,240,255,0.3)';
            for (let i = 0; i < 40; i++) {
                const sx = (tileHash(i, frameCount % 200) * canvas.width);
                const sy = (tileHash(frameCount % 200, i) * canvas.height);
                ctx.beginPath();
                ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  MINIMAP
    // ═══════════════════════════════════════════════════════════

    // Pre-computed RGB values for each terrain type (populated on first call)
    const _terrainRGB = {};
    function _getTerrainRGB(id) {
        if (_terrainRGB[id]) return _terrainRGB[id];
        const hex = getTerrainColor(id);
        const rgb = hexToRgb(hex);
        _terrainRGB[id] = rgb;
        return rgb;
    }

    // Build a pixel-perfect terrain image for the minimap (called once, never changes)
    function _buildMinimapTerrain() {
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        const terrain = worldData.terrain;
        if (!terrain || !terrain.length) return;

        const ts = CONFIG.TILE_SIZE;
        const cols = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / ts);
        const rows = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / ts);
        const worldPxW = CONFIG.WORLD_WIDTH;
        const worldPxH = CONFIG.WORLD_HEIGHT;

        _minimapTerrainCanvas = document.createElement('canvas');
        _minimapTerrainCanvas.width = mw;
        _minimapTerrainCanvas.height = mh;
        const tctx = _minimapTerrainCanvas.getContext('2d');
        const imageData = tctx.createImageData(mw, mh);
        const data = imageData.data;

        // WASM fast path — generate entire minimap pixel buffer
        var _usedWasm = false;
        if (typeof WASM !== 'undefined' && WASM.ready() && WASM.buildMinimapTerrain && terrain instanceof Uint8Array) {
            try {
                var _isWinter = (typeof Engine !== 'undefined' && Engine.getSeason && Engine.getSeason() === 'Winter');
                var _rgbaData = WASM.buildMinimapTerrain(terrain, cols, rows, mw, mh, _isWinter);
                if (_rgbaData && _rgbaData.length === mw * mh * 4) {
                    data.set(new Uint8ClampedArray(_rgbaData.buffer, _rgbaData.byteOffset, _rgbaData.length));
                    _usedWasm = true;
                }
            } catch (_wasmErr) {
                // Fallback to JS
            }
        }

        if (!_usedWasm) {
            for (let py = 0; py < mh; py++) {
                // Map minimap pixel Y to terrain row
                const worldY = (py / mh) * worldPxH;
                const tileRow = Math.min(rows - 1, Math.floor(worldY / ts));
                for (let px = 0; px < mw; px++) {
                    // Map minimap pixel X to terrain column
                    const worldX = (px / mw) * worldPxW;
                    const tileCol = Math.min(cols - 1, Math.floor(worldX / ts));
                    const tileId = terrain[tileRow * cols + tileCol];
                    const rgb = _getTerrainRGB(tileId);
                    const idx = (py * mw + px) * 4;
                    data[idx] = rgb.r;
                    data[idx + 1] = rgb.g;
                    data[idx + 2] = rgb.b;
                    data[idx + 3] = 255;
                }
            }
        }
        tctx.putImageData(imageData, 0, 0);
    }

    function _renderMinimapBase() {
        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        if (!_minimapCacheCanvas) {
            _minimapCacheCanvas = document.createElement('canvas');
            _minimapCacheCanvas.width = mw;
            _minimapCacheCanvas.height = mh;
        }
        if (_minimapCacheCanvas.width !== mw || _minimapCacheCanvas.height !== mh) {
            _minimapCacheCanvas.width = mw;
            _minimapCacheCanvas.height = mh;
        }
        const mctx = _minimapCacheCanvas.getContext('2d');

        const worldPxW = CONFIG.WORLD_WIDTH;
        const worldPxH = CONFIG.WORLD_HEIGHT;
        const scaleX = mw / worldPxW;
        const scaleY = mh / worldPxH;
        const ts = CONFIG.TILE_SIZE;

        mctx.clearRect(0, 0, mw, mh);

        // Background
        mctx.fillStyle = '#0d0a06';
        mctx.fillRect(0, 0, mw, mh);

        // Terrain — blit the permanent pixel-perfect terrain cache
        if (!_minimapTerrainCanvas) _buildMinimapTerrain();
        if (_minimapTerrainCanvas) {
            mctx.drawImage(_minimapTerrainCanvas, 0, 0);
        }

        // Kingdom territory colors
        const kingdoms = _frameKingdoms;
        const towns = _frameTowns;

        if (kingdoms && towns) {
            for (const kingdom of kingdoms) {
                const kColor = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];
                const kTowns = towns.filter(t => t.kingdomId === kingdom.id);
                mctx.fillStyle = colorWithAlpha(kColor, 0.25);
                for (const town of kTowns) {
                    const px = town.x * scaleX;
                    const py = town.y * scaleY;
                    mctx.beginPath();
                    mctx.arc(px, py, 8, 0, Math.PI * 2);
                    mctx.fill();
                }
            }
        }

        // Town dots
        if (towns) {
            // Draw ALL land roads on minimap (black/dark)
            let minimapRoadsAll;
            try { minimapRoadsAll = Engine.getRoads(); } catch (e) { minimapRoadsAll = null; }
            if (minimapRoadsAll) {
                const townMap2 = _frameTownMap;
                mctx.lineWidth = 1;
                for (const road of minimapRoadsAll) {
                    const from = townMap2[road.fromTownId];
                    const to = townMap2[road.toTownId];
                    if (!from || !to) continue;
                    // Skip roads without valid waypoints (they aren't rendered on main map either)
                    if (!road.waypoints || road.waypoints.length < 2) continue;
                    mctx.strokeStyle = road.safe === false ? 'rgba(180,40,30,0.6)' : 'rgba(0,0,0,0.7)';
                    mctx.beginPath();
                    // Draw simplified waypoint path on minimap
                    mctx.moveTo(road.waypoints[0].x * scaleX, road.waypoints[0].y * scaleY);
                    var wpStep = Math.max(1, Math.floor(road.waypoints.length / 6));
                    for (var mri = wpStep; mri < road.waypoints.length - 1; mri += wpStep) {
                        mctx.lineTo(road.waypoints[mri].x * scaleX, road.waypoints[mri].y * scaleY);
                    }
                    mctx.lineTo(road.waypoints[road.waypoints.length - 1].x * scaleX, road.waypoints[road.waypoints.length - 1].y * scaleY);
                    mctx.stroke();
                }
            }

            // Draw sea routes on minimap (dotted black)
            let seaRoutes;
            try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { seaRoutes = null; }
            if (seaRoutes) {
                mctx.strokeStyle = '#000';
                mctx.lineWidth = 1;
                mctx.setLineDash([1, 3]);
                for (const route of seaRoutes) {
                    const from = towns.find(t => t.id === route.fromTownId);
                    const to = towns.find(t => t.id === route.toTownId);
                    if (!from || !to) continue;
                    mctx.beginPath();
                    if (route.waypoints && route.waypoints.length >= 2) {
                        mctx.moveTo(route.waypoints[0].x * scaleX, route.waypoints[0].y * scaleY);
                        var seaStep = Math.max(1, Math.floor(route.waypoints.length / 6));
                        for (var msi = seaStep; msi < route.waypoints.length - 1; msi += seaStep) {
                            mctx.lineTo(route.waypoints[msi].x * scaleX, route.waypoints[msi].y * scaleY);
                        }
                        mctx.lineTo(route.waypoints[route.waypoints.length - 1].x * scaleX, route.waypoints[route.waypoints.length - 1].y * scaleY);
                    } else {
                        mctx.moveTo(from.x * scaleX, from.y * scaleY);
                        mctx.lineTo(to.x * scaleX, to.y * scaleY);
                    }
                    mctx.stroke();
                }
                mctx.setLineDash([]);
            }

            // Town dots with black outline
            for (const town of towns) {
                if (town.isJunction) continue;
                const kingdom = kingdoms ? kingdoms.find(k => k.id === town.kingdomId) : null;
                const kColor = kingdom ? (kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length]) : '#ccc';
                const px = town.x * scaleX;
                const py = town.y * scaleY;
                // Black outline
                mctx.beginPath();
                mctx.arc(px, py, 3.5, 0, Math.PI * 2);
                mctx.fillStyle = '#000';
                mctx.fill();
                // Kingdom-colored center
                mctx.beginPath();
                mctx.arc(px, py, 2.5, 0, Math.PI * 2);
                mctx.fillStyle = kColor;
                mctx.fill();
            }
        }

        // Draw bandit threat on high-danger roads
        let minimapRoads;
        try { minimapRoads = Engine.getRoads(); } catch (e) { minimapRoads = null; }
        if (minimapRoads && towns) {
            const townMap = _frameTownMap;
            for (const road of minimapRoads) {
                const from = townMap[road.fromTownId];
                const to = townMap[road.toTownId];
                if (!from || !to) continue;
                const threat = road.banditThreat || 0;
                if (threat <= CONFIG.BANDIT_THREAT_DANGER_THRESHOLD) continue;

                const fx = from.x * scaleX;
                const fy = from.y * scaleY;
                const tx = to.x * scaleX;
                const ty = to.y * scaleY;

                mctx.beginPath();
                mctx.strokeStyle = `rgba(200,40,30,${Math.min(0.8, threat / 100)})`;
                mctx.lineWidth = 2;
                mctx.moveTo(fx, fy);
                mctx.lineTo(tx, ty);
                mctx.stroke();
            }
        }

        _minimapCacheDirty = false;
        _minimapCacheDay = Engine.getDay ? Engine.getDay() : 0;
    }

    function markMinimapDirty() { _minimapCacheDirty = true; }

    function renderMinimap(player) {
        if (!minimapCtx || !worldData) return;

        const mw = minimapCanvas.width;
        const mh = minimapCanvas.height;
        const worldPxW = CONFIG.WORLD_WIDTH;
        const worldPxH = CONFIG.WORLD_HEIGHT;
        const scaleX = mw / worldPxW;
        const scaleY = mh / worldPxH;

        // Check if cache needs rebuild (once per game day)
        const currentDay = Engine.getDay ? Engine.getDay() : 0;
        if (_minimapCacheDirty || _minimapCacheDay !== currentDay || !_minimapCacheCanvas) {
            _renderMinimapBase();
        }

        // Blit cached base
        minimapCtx.clearRect(0, 0, mw, mh);
        minimapCtx.drawImage(_minimapCacheCanvas, 0, 0);

        // Player position (blinking gold dot — follows player diamond)
        if (player) {
            let ppx = null, ppy = null;

            if (player.traveling && player.travelProgress != null) {
                // Traveling: interpolate along route (same logic as main diamond)
                let originTown, destTown;
                try { originTown = Engine.getTown(player.travelOrigin || player.townId); } catch (e) { /* no-op */ }
                try { destTown = Engine.getTown(player.travelDestination); } catch (e) { /* no-op */ }
                const route = player.travelRoute || [];
                const progress = player.travelProgress || 0;

                if (route.length >= 2) {
                    let totalDist = 0;
                    const segDists = [];
                    for (let i = 1; i < route.length; i++) {
                        const d = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
                        segDists.push(d);
                        totalDist += d;
                    }
                    if (totalDist > 0) {
                        let targetDist = progress * totalDist;
                        let accumulated = 0;
                        let wx = route[0].x, wy = route[0].y;
                        for (let i = 0; i < segDists.length; i++) {
                            if (accumulated + segDists[i] >= targetDist) {
                                const sp = (targetDist - accumulated) / segDists[i];
                                wx = route[i].x + (route[i + 1].x - route[i].x) * sp;
                                wy = route[i].y + (route[i + 1].y - route[i].y) * sp;
                                break;
                            }
                            accumulated += segDists[i];
                            wx = route[i + 1].x;
                            wy = route[i + 1].y;
                        }
                        ppx = wx * scaleX;
                        ppy = wy * scaleY;
                    }
                }
                if (ppx == null && originTown && destTown) {
                    ppx = (originTown.x + (destTown.x - originTown.x) * progress) * scaleX;
                    ppy = (originTown.y + (destTown.y - originTown.y) * progress) * scaleY;
                }
            }

            if (ppx == null && player.worldX != null && player.worldY != null) {
                ppx = player.worldX * scaleX;
                ppy = player.worldY * scaleY;
            }

            if (ppx == null && player.townId != null) {
                let playerTown;
                try { playerTown = Engine.getTown(player.townId); } catch (e) { /* no-op */ }
                if (!playerTown && _frameTowns) playerTown = _frameTowns.find(t => t.id === player.townId);
                if (playerTown) {
                    ppx = playerTown.x * scaleX;
                    ppy = playerTown.y * scaleY;
                }
            }

            if (ppx != null && ppy != null) {
                const blink = Math.sin(frameCount * 0.1) > 0;
                if (blink) {
                    minimapCtx.fillStyle = '#e8d48b';
                    minimapCtx.beginPath();
                    minimapCtx.arc(ppx, ppy, 4, 0, Math.PI * 2);
                    minimapCtx.fill();
                    minimapCtx.strokeStyle = '#c4a35a';
                    minimapCtx.lineWidth = 1;
                    minimapCtx.stroke();
                }
            }
        }

        // Camera viewport rectangle
        const vb = getVisibleBounds();
        minimapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(
            vb.left * scaleX,
            vb.top * scaleY,
            (vb.right - vb.left) * scaleX,
            (vb.bottom - vb.top) * scaleY
        );

        // Border
        minimapCtx.strokeStyle = 'rgba(196,163,90,0.4)';
        minimapCtx.lineWidth = 1;
        minimapCtx.strokeRect(0, 0, mw, mh);
    }

    // ═══════════════════════════════════════════════════════════
    //  HIT TESTING — What did the user click?
    // ═══════════════════════════════════════════════════════════

    function hitTest(screenX, screenY, options = {}) {
        const w = screenToWorld(screenX, screenY);
        const ts = CONFIG.TILE_SIZE;

        // When shift is held, prioritize people over towns
        const prioritizePeople = options.shiftKey || false;

        // Check caravans first — they're small clickable icons on roads
        for (var ci = 0; ci < _caravanPositions.length; ci++) {
            var cp = _caravanPositions[ci];
            var cdist = Math.sqrt((w.x - cp.x) * (w.x - cp.x) + (w.y - cp.y) * (w.y - cp.y));
            if (cdist < 12) {
                return { type: 'caravan', data: cp.caravan };
            }
        }

        if (!prioritizePeople) {
            // Check towns first (normal behavior)
            const towns = Engine.getTowns();
            if (towns) {
                for (const town of towns) {
                    if (town.isJunction) continue;
                    const cx = town.x;
                    const cy = town.y;
                    const r = 10 + Math.sqrt(town.population || 100) * 0.35;
                    const dist = Math.sqrt((w.x - cx) ** 2 + (w.y - cy) ** 2);
                    if (dist < r + 8) {
                        return { type: 'town', data: town };
                    }
                }
            }
        }

        // Check people (only when zoomed in)
        const towns = Engine.getTowns();
        if (camera.zoom > 1.5 && towns) {
            for (const town of towns) {
                const cx = town.x;
                const cy = town.y;
                if (Math.abs(w.x - cx) > 100 || Math.abs(w.y - cy) > 100) continue;

                let people;
                try { people = Engine.getPeopleCached(town.id); } catch (e) { continue; }
                if (!people) continue;

                const maxShow = Math.min(people.length, 50);
                var hitAlive = [];
                for (var pi = 0; pi < people.length; pi++) {
                    if (people[pi].alive) hitAlive.push(people[pi]);
                }
                hitAlive.sort(function(a, b) { return _npcNumId(a, 0) - _npcNumId(b, 0); });
                if (hitAlive.length > 50) hitAlive.length = 50;
                var hitRadius = prioritizePeople ? 14 : 7;
                for (let i = 0; i < hitAlive.length; i++) {
                    const p = hitAlive[i];
                    var numId = _npcNumId(p, i);
                    var pos = _npcPosition(numId, cx, cy, _npcAnimTime);
                    const d = Math.sqrt((w.x - pos.x) ** 2 + (w.y - pos.y) ** 2);
                    if (d < hitRadius) {
                        return { type: 'person', data: p };
                    }
                }
            }
        }

        // Check elite merchant heraldry flag icons (always clickable, no zoom requirement)
        if (towns && typeof Player !== 'undefined' && Player.canSeeEliteMerchantLocations && Player.canSeeEliteMerchantLocations()) {
            var emWorld = typeof Engine !== 'undefined' ? Engine.getWorld() : null;
            if (emWorld && emWorld.people) {
                var playerTownHit = typeof Player !== 'undefined' ? Player.townId : null;
                var roadsHit = typeof Engine !== 'undefined' ? Engine.getRoads() : [];
                var connTownsHit = {};
                if (playerTownHit != null) connTownsHit[playerTownHit] = true;
                for (var rhi = 0; rhi < roadsHit.length; rhi++) {
                    if (roadsHit[rhi].fromTownId === playerTownHit) connTownsHit[roadsHit[rhi].toTownId] = true;
                    if (roadsHit[rhi].toTownId === playerTownHit) connTownsHit[roadsHit[rhi].fromTownId] = true;
                }
                var hitElites = emWorld.people.filter(function(p) { return p.alive && p.isEliteMerchant && p.heraldry; });
                var hitEliteIdx = 0;
                for (var hei = 0; hei < hitElites.length; hei++) {
                    var hem = hitElites[hei];
                    if (!hem.townId) continue;
                    var hemVisible = !!connTownsHit[hem.townId] ||
                        (hem.traveling && (connTownsHit[hem.travelDestination] || connTownsHit[hem.travelOrigin]));
                    if (!hemVisible) continue;
                    var hemTown = typeof Engine !== 'undefined' ? Engine.findTown(hem.townId) : null;
                    if (!hemTown) continue;
                    var flagHitX = hemTown.x + 15 + (hitEliteIdx % 4) * 18 + 7;
                    var flagHitY = hemTown.y - 20 - Math.floor(hitEliteIdx / 4) * 18 - 3;
                    hitEliteIdx++;
                    var flagDist = Math.sqrt((w.x - flagHitX) ** 2 + (w.y - flagHitY) ** 2);
                    if (flagDist < 12) {
                        return { type: 'person', data: hem };
                    }
                }
            }
        }

        // If shift was held and we didn't find a person, only fall through to town
        // if we're NOT in the NPC rendering zone (prevents tooltip flickering)
        if (prioritizePeople) {
            // Check if cursor is near any town's NPC zone — if so, return 'none'
            // to keep the tooltip stable instead of flipping to the town tooltip
            var inNpcZone = false;
            if (camera.zoom > 1.5 && towns) {
                for (var ti = 0; ti < towns.length; ti++) {
                    var td = Math.sqrt((w.x - towns[ti].x) ** 2 + (w.y - towns[ti].y) ** 2);
                    if (td < 60) { inNpcZone = true; break; }
                }
            }
            if (!inNpcZone && towns) {
                for (const town of towns) {
                    if (town.isJunction) continue;
                    const cx = town.x;
                    const cy = town.y;
                    const r = 10 + Math.sqrt(town.population || 100) * 0.35;
                    const dist = Math.sqrt((w.x - cx) ** 2 + (w.y - cy) ** 2);
                    if (dist < r + 8) {
                        return { type: 'town', data: town };
                    }
                }
            }
        }

        // Check roads — test against waypoint polyline, not just town-to-town straight line
        let roads;
        try { roads = Engine.getRoads(); } catch (e) { roads = null; }
        if (roads && towns) {
            const townMap = {};
            for (const t of towns) townMap[t.id] = t;

            for (const road of roads) {
                const from = townMap[road.fromTownId];
                const to = townMap[road.toTownId];
                if (!from || !to) continue;

                var minDist = Infinity;
                if (road.waypoints && road.waypoints.length >= 2) {
                    // Check each segment of the waypoint polyline
                    for (var ri = 0; ri < road.waypoints.length - 1; ri++) {
                        var d = pointToSegmentDist(w.x, w.y, road.waypoints[ri].x, road.waypoints[ri].y, road.waypoints[ri + 1].x, road.waypoints[ri + 1].y);
                        if (d < minDist) minDist = d;
                        if (minDist < 8) break;
                    }
                } else {
                    // Fallback to straight line between towns
                    minDist = pointToSegmentDist(w.x, w.y, from.x, from.y, to.x, to.y);
                }
                if (minDist < 8) {
                    return { type: 'road', data: { ...road, fromTown: from, toTown: to } };
                }
            }
        }

        // Check sea routes — test against waypoint polyline
        let seaRoutes;
        try { seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : []; } catch (e) { seaRoutes = []; }
        if (seaRoutes.length > 0 && towns) {
            const townMap = {};
            for (const t of towns) townMap[t.id] = t;

            for (const route of seaRoutes) {
                const from = townMap[route.fromTownId];
                const to = townMap[route.toTownId];
                if (!from || !to) continue;

                var minDist = Infinity;
                if (route.waypoints && route.waypoints.length >= 2) {
                    for (var si = 0; si < route.waypoints.length - 1; si++) {
                        var d = pointToSegmentDist(w.x, w.y, route.waypoints[si].x, route.waypoints[si].y, route.waypoints[si + 1].x, route.waypoints[si + 1].y);
                        if (d < minDist) minDist = d;
                        if (minDist < 12) break;
                    }
                } else {
                    // Fallback to straight line for routes without waypoints
                    minDist = pointToSegmentDist(w.x, w.y, from.x, from.y, to.x, to.y);
                }
                if (minDist < 12) {
                    return { type: 'seaRoute', data: { ...route, fromTown: from, toTown: to } };
                }
            }
        }

        return { type: 'empty', data: { worldX: w.x, worldY: w.y } };
    }

    function pointToSegmentDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
        let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    // ═══════════════════════════════════════════════════════════
    //  MINIMAP CLICK → CAMERA
    // ═══════════════════════════════════════════════════════════

    function minimapClick(mx, my) {
        const rect = minimapCanvas.getBoundingClientRect();
        const x = mx - rect.left;
        const y = my - rect.top;
        const worldPxW = CONFIG.WORLD_WIDTH;
        const worldPxH = CONFIG.WORLD_HEIGHT;
        camera.targetX = (x / minimapCanvas.width) * worldPxW;
        camera.targetY = (y / minimapCanvas.height) * worldPxH;
    }

    function isMinimapClick(screenX, screenY) {
        const rect = minimapCanvas.getBoundingClientRect();
        return screenX >= rect.left && screenX <= rect.right &&
               screenY >= rect.top && screenY <= rect.bottom;
    }

    // ═══════════════════════════════════════════════════════════
    //  ELITE MERCHANT HERALDRY FLAGS
    // ═══════════════════════════════════════════════════════════

    function renderEliteMerchantIcons() {
        if (typeof Player === 'undefined' || !Player.canSeeEliteMerchantLocations || !Player.canSeeEliteMerchantLocations()) return;

        var w = typeof Engine !== 'undefined' ? Engine.getWorld() : null;
        if (!w || !w.people) return;
        var playerTown = Player.townId;

        // Get connected towns (1 hop)
        var roads = typeof Engine !== 'undefined' ? Engine.getRoads() : [];
        var connectedTowns = {};
        if (playerTown != null) connectedTowns[playerTown] = true;
        for (var ri = 0; ri < roads.length; ri++) {
            var r = roads[ri];
            if (r.fromTownId === playerTown) connectedTowns[r.toTownId] = true;
            if (r.toTownId === playerTown) connectedTowns[r.fromTownId] = true;
        }

        var elites = w.people.filter(function(p) { return p.alive && p.isEliteMerchant && p.heraldry; });
        var eliteIdx = 0;
        for (var ei = 0; ei < elites.length; ei++) {
            var m = elites[ei];
            if (!m.townId) continue;

            var visible = !!connectedTowns[m.townId] ||
                (m.traveling && (connectedTowns[m.travelDestination] || connectedTowns[m.travelOrigin]));
            if (!visible) continue;

            var town = typeof Engine !== 'undefined' ? Engine.findTown(m.townId) : null;
            if (!town) continue;

            if (!isVisible(town.x, town.y, 200)) continue;

            // World-space coordinates — the render function has already applied the camera transform
            var flagX = town.x + 15 + (eliteIdx % 4) * 18;
            var flagY = town.y - 20 - Math.floor(eliteIdx / 4) * 18;
            eliteIdx++;

            var colors = m.heraldry.colors || ['#888', '#444'];

            // Flag pole
            ctx.strokeStyle = '#8B7355';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(flagX, flagY + 12);
            ctx.lineTo(flagX, flagY - 8);
            ctx.stroke();

            // Flag background (shield shape)
            ctx.fillStyle = colors[0];
            ctx.fillRect(flagX, flagY - 8, 14, 10);
            ctx.fillStyle = colors[1];
            ctx.fillRect(flagX + 7, flagY - 8, 7, 10);

            // Flag border
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(flagX, flagY - 8, 14, 10);

            // Symbol
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fff';
            ctx.fillText(m.heraldry.symbol, flagX + 7, flagY - 3);
        }

        // Render tracked merchant stars
        if (typeof Player !== 'undefined' && Player.trackedMerchants) {
            var tracked = Player.trackedMerchants;
            for (var ti = 0; ti < tracked.length; ti++) {
                var trackedEm = null;
                for (var tei = 0; tei < (w.eliteMerchants || []).length; tei++) {
                    if (w.eliteMerchants[tei].id === tracked[ti]) { trackedEm = w.eliteMerchants[tei]; break; }
                }
                if (!trackedEm || !trackedEm.alive) continue;
                var emTown = null;
                for (var tti = 0; tti < w.towns.length; tti++) {
                    if (w.towns[tti].id === trackedEm.townId) { emTown = w.towns[tti]; break; }
                }
                if (!emTown) continue;
                if (!isVisible(emTown.x, emTown.y, 200)) continue;
                // Draw pulsing star in world-space (camera transform already applied)
                ctx.save();
                ctx.font = Math.max(16, 20 / camera.zoom) + 'px serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8;
                ctx.fillText('⭐', emTown.x, emTown.y - 30);
                // Name label
                ctx.font = Math.max(10, 12 / camera.zoom) + 'px sans-serif';
                ctx.fillStyle = '#FFF';
                ctx.shadowColor = '#000';
                ctx.shadowBlur = 3;
                ctx.fillText(trackedEm.firstName || 'Unknown', emTown.x, emTown.y - 42);
                ctx.restore();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  MAP MODES — Strategic & World Map
    // ═══════════════════════════════════════════════════════════

    function setMapMode(mode) {
        if (mode === mapMode) return;

        if (mode === 1) {
            // Entering strategic map — save current camera state
            if (mapMode === 0) {
                savedZoom = camera.targetZoom;
                savedCamX = camera.targetX;
                savedCamY = camera.targetY;
            }
            camera.targetZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, 0.3));
        } else if (mode === 2) {
            // Entering world map — save state if not already saved
            if (mapMode === 0) {
                savedZoom = camera.targetZoom;
                savedCamX = camera.targetX;
                savedCamY = camera.targetY;
            }
            showWorldMap();
        } else if (mode === 0) {
            // Returning to normal — restore camera, hide world map
            if (mapMode === 2) {
                hideWorldMap();
            }
            camera.targetZoom = savedZoom;
            camera.targetX = savedCamX;
            camera.targetY = savedCamY;
        }

        mapMode = mode;
    }

    function getMapMode() { return mapMode; }

    function locatePlayer() {
        if (mapMode === 2) {
            hideWorldMap();
        }
        mapMode = 0;
        centerOnPlayer();
        camera.targetZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, 1.6));
    }

    function toggleDeposits() {
        if (typeof Player === 'undefined' || !Player.hasSkill || !Player.hasSkill('regional_survey')) {
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('You need the Regional Survey skill to view deposits.', 'warning');
            return false;
        }
        showDeposits = !showDeposits;
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Resource deposits ' + (showDeposits ? 'shown' : 'hidden') + '.', 'info');
        }
        return showDeposits;
    }

    function toggleFertility() {
        if (typeof Player === 'undefined' || !Player.hasSkill || !Player.hasSkill('soil_knowledge')) {
            if (typeof UI !== 'undefined' && UI.toast) UI.toast('You need the Soil Knowledge skill to view fertility.', 'warning');
            return false;
        }
        showFertility = !showFertility;
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Soil fertility overlay ' + (showFertility ? 'shown' : 'hidden') + '.', 'info');
        }
        return showFertility;
    }

    // ── Strategic Map (Mode 1): enhanced town labels ──

    function renderStrategicTownOverlays() {
        if (mapMode !== 1) return;
        const towns = _frameTowns;
        if (!towns) return;

        const kingdoms = _frameKingdoms;
        const kingdomMap = {};
        if (kingdoms) kingdoms.forEach(function(k) { kingdomMap[k.id] = k; });

        var labelScale = Math.max(1.5, 1 / camera.zoom);

        for (var i = 0; i < towns.length; i++) {
            var town = towns[i];
            var cx = town.x;
            var cy = town.y;
            if (!isVisible(cx, cy, 300)) continue;

            var pop = town.population || 100;
            var cat = town.category || 'village';
            var catLabel = cat === 'capital_city' ? 'Capital' : cat.charAt(0).toUpperCase() + cat.slice(1);
            var kingdom = kingdomMap[town.kingdomId];
            var kColor = kingdom ? (kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length]) : '#888';

            // Info box background
            var boxW = 70 * labelScale;
            var boxH = 38 * labelScale;
            var boxX = cx - boxW / 2;
            var boxY = cy + 12 * labelScale;

            ctx.fillStyle = 'rgba(20,15,8,0.75)';
            ctx.strokeStyle = colorWithAlpha(kColor, 0.6);
            ctx.lineWidth = 1.5;
            roundRect(ctx, boxX, boxY, boxW, boxH, 3 * labelScale);

            // Town name (large)
            ctx.fillStyle = cat === 'capital_city' ? '#ffd700' : '#e8dcc8';
            ctx.font = 'bold ' + Math.round(10 * labelScale) + 'px "Cinzel", serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(town.name, cx, boxY + 2 * labelScale);

            // Event indicators
            const _sEvtInd = _getTownEventIndicators(town.id);
            if (_sEvtInd) {
                ctx.fillStyle = '#f0e0a0';
                ctx.font = Math.round(8 * labelScale) + 'px sans-serif';
                ctx.fillText(_sEvtInd, cx, boxY - 10 * labelScale);
            }

            // Category + population
            ctx.fillStyle = '#b8a87a';
            ctx.font = Math.round(7 * labelScale) + 'px sans-serif';
            ctx.fillText(catLabel + ' · Pop: ' + pop, cx, boxY + 14 * labelScale);

            // Port indicator
            if (town.isPort) {
                ctx.fillStyle = 'rgba(0,180,200,0.9)';
                ctx.font = Math.round(7 * labelScale) + 'px sans-serif';
                ctx.fillText('⚓ Port', cx, boxY + 24 * labelScale);
            }
        }
    }

    function roundRect(context, x, y, w, h, r) {
        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + w - r, y);
        context.quadraticCurveTo(x + w, y, x + w, y + r);
        context.lineTo(x + w, y + h - r);
        context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        context.lineTo(x + r, y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
        context.fill();
        context.stroke();
    }

    // ── World Map (Mode 2): full-screen overlay ──

    var worldMapContainer = null;

    function buildWorldMapInfoPanels() {
        var panelStyle = 'position:absolute;top:60px;width:260px;max-height:calc(100vh - 120px);overflow-y:auto;' +
            'background:rgba(30,22,12,0.88);border:2px solid #8a7232;border-radius:8px;padding:14px 12px;' +
            'color:#d4c5a0;font-family:"Cinzel",serif;font-size:13px;z-index:502;scrollbar-width:thin;';

        // ── Left Panel: World Overview ──
        var leftPanel = document.createElement('div');
        leftPanel.id = 'worldMapLeftPanel';
        leftPanel.style.cssText = panelStyle + 'left:12px;';

        var world = null, kingdoms = null, towns = null, roads = null, seaRoutes = null, ems = null, people = null;
        try {
            world = Engine.getWorld();
            kingdoms = Engine.getKingdoms();
            towns = Engine.getTowns();
            roads = Engine.getRoads ? Engine.getRoads() : (world.roads || []);
            seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : (world.seaRoutes || []);
            ems = world.eliteMerchants || [];
            people = Engine.getPeopleCached();
        } catch (e) { /* ignore */ }

        var day = 0, year = 1, season = 'Spring';
        try { day = Engine.getDay(); year = Engine.getYear(); season = Engine.getSeason(); } catch (e) {}

        var totalPop = 0, portCount = 0, capitalCount = 0;
        if (towns) {
            for (var ti = 0; ti < towns.length; ti++) {
                totalPop += towns[ti].population || 0;
                if (towns[ti].isPort || towns[ti].hasPort) portCount++;
                if (towns[ti].isCapital) capitalCount++;
            }
        }

        var activeRoads = 0, destroyedRoads = 0;
        if (roads) {
            for (var ri = 0; ri < roads.length; ri++) {
                if (roads[ri].condition === 'destroyed') destroyedRoads++;
                else activeRoads++;
            }
        }

        var activeWars = 0;
        if (world && world.wars) {
            for (var wi = 0; wi < world.wars.length; wi++) {
                if (world.wars[wi].active !== false) activeWars++;
            }
        }

        var html = '<div style="text-align:center;margin-bottom:10px;">' +
            '<div style="font-size:16px;color:#c4a35a;font-weight:bold;">⚜ World Overview</div>' +
            '<div style="font-size:11px;color:#a89870;">Year ' + year + ' · ' + season + ' · Day ' + day + '</div></div>';

        html += '<div style="border-top:1px solid #5a4530;padding-top:8px;">';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>🏘️ Towns</span><span style="color:#c4a35a;">' + (towns ? towns.length : '?') + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>👥 Population</span><span style="color:#c4a35a;">' + totalPop.toLocaleString() + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>👑 Kingdoms</span><span style="color:#c4a35a;">' + (kingdoms ? kingdoms.length : '?') + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>⚓ Port Towns</span><span style="color:#c4a35a;">' + portCount + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>🏰 Capitals</span><span style="color:#c4a35a;">' + capitalCount + '</span></div>';
        html += '</div>';

        html += '<div style="border-top:1px solid #5a4530;padding-top:8px;margin-top:8px;">';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>🛤️ Roads</span><span style="color:#c4a35a;">' + activeRoads + ' active</span></div>';
        if (destroyedRoads > 0) html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>💀 Destroyed</span><span style="color:#a05a3a;">' + destroyedRoads + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>⛵ Sea Routes</span><span style="color:#c4a35a;">' + (seaRoutes ? seaRoutes.length : '?') + '</span></div>';
        html += '</div>';

        html += '<div style="border-top:1px solid #5a4530;padding-top:8px;margin-top:8px;">';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>💰 Elite Merchants</span><span style="color:#c4a35a;">' + (ems ? ems.length : '?') + '</span></div>';
        html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>👤 NPCs</span><span style="color:#c4a35a;">' + (people ? people.length.toLocaleString() : '?') + '</span></div>';
        if (activeWars > 0) html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>⚔️ Active Wars</span><span style="color:#e05a3a;font-weight:bold;">' + activeWars + '</span></div>';
        else html += '<div style="display:flex;justify-content:space-between;margin:4px 0;"><span>☮️ Wars</span><span style="color:#6a9a5a;">Peace</span></div>';
        html += '</div>';

        leftPanel.innerHTML = html;

        // ── Right Panel: Kingdom Details ──
        var rightPanel = document.createElement('div');
        rightPanel.id = 'worldMapRightPanel';
        rightPanel.style.cssText = panelStyle + 'right:12px;';

        var rhtml = '<div style="text-align:center;margin-bottom:10px;">' +
            '<div style="font-size:16px;color:#c4a35a;font-weight:bold;">👑 Kingdoms</div></div>';

        if (kingdoms) {
            for (var ki2 = 0; ki2 < kingdoms.length; ki2++) {
                var k = kingdoms[ki2];
                var kColor = k.color || '#888';
                var kTowns = towns ? towns.filter(function(t) { return t.kingdomId === k.id; }) : [];
                var kPop = 0;
                for (var kti = 0; kti < kTowns.length; kti++) kPop += kTowns[kti].population || 0;

                var kingName = '???';
                try {
                    var kingPerson = Engine.getPerson(k.king);
                    if (kingPerson) kingName = (kingPerson.firstName || '') + ' ' + (kingPerson.lastName || '');
                } catch (e) {}

                var kGold = typeof k.gold === 'number' ? Math.floor(k.gold).toLocaleString() : '?';

                rhtml += '<div style="border-top:1px solid #5a4530;padding:8px 0;' + (ki2 === 0 ? '' : 'margin-top:4px;') + '">';
                rhtml += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
                    '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + kColor + ';border:1px solid rgba(255,255,255,0.3);"></span>' +
                    '<span style="font-size:14px;font-weight:bold;color:#d4c5a0;">' + (k.name || 'Unknown') + '</span></div>';
                rhtml += '<div style="font-size:11px;color:#a89870;margin-bottom:4px;">King: ' + kingName + '</div>';
                rhtml += '<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0;"><span>Towns</span><span style="color:#c4a35a;">' + kTowns.length + '</span></div>';
                rhtml += '<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0;"><span>Population</span><span style="color:#c4a35a;">' + kPop.toLocaleString() + '</span></div>';
                rhtml += '<div style="display:flex;justify-content:space-between;font-size:12px;margin:2px 0;"><span>Treasury</span><span style="color:#c4a35a;">' + kGold + 'g</span></div>';

                // Show capital
                var capital = kTowns.find(function(t) { return t.isCapital; });
                if (capital) rhtml += '<div style="font-size:11px;color:#a89870;margin-top:2px;">🏰 ' + capital.name + '</div>';
                rhtml += '</div>';
            }
        }

        rightPanel.innerHTML = rhtml;
        return { left: leftPanel, right: rightPanel };
    }

    function showWorldMap() {
        if (worldMapCanvas) return; // already visible

        // Create container overlay
        worldMapContainer = document.createElement('div');
        worldMapContainer.id = 'worldMapContainer';
        worldMapContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:500;';

        worldMapCanvas = document.createElement('canvas');
        worldMapCanvas.id = 'worldMapOverlay';
        worldMapCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;cursor:default;';
        worldMapContainer.appendChild(worldMapCanvas);
        worldMapCtx = worldMapCanvas.getContext('2d');
        worldMapDirty = true;

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.id = 'worldMapCloseBtn';
        closeBtn.innerHTML = '✕ Close Map';
        closeBtn.style.cssText = 'position:absolute;top:12px;right:12px;z-index:510;padding:8px 18px;' +
            'background:rgba(30,22,12,0.9);color:#d4c5a0;border:2px solid #8a7232;border-radius:6px;' +
            'font-family:"Cinzel",serif;font-size:14px;cursor:pointer;transition:all 0.2s;';
        closeBtn.onmouseenter = function() { this.style.background = '#5a4530'; this.style.color = '#fff'; };
        closeBtn.onmouseleave = function() { this.style.background = 'rgba(30,22,12,0.9)'; this.style.color = '#d4c5a0'; };
        closeBtn.addEventListener('click', function() {
            if (typeof UI !== 'undefined' && UI.closeMapView) UI.closeMapView();
        });
        worldMapContainer.appendChild(closeBtn);

        // Info panels
        var panels = buildWorldMapInfoPanels();
        worldMapContainer.appendChild(panels.left);
        worldMapContainer.appendChild(panels.right);

        document.body.appendChild(worldMapContainer);

        var resizeWM = function() {
            worldMapCanvas.width = window.innerWidth;
            worldMapCanvas.height = window.innerHeight;
            worldMapDirty = true;
            drawWorldMap();
        };
        worldMapCanvas._resizeHandler = resizeWM;
        window.addEventListener('resize', resizeWM);
        resizeWM();
    }

    function hideWorldMap() {
        if (!worldMapCanvas) return;
        window.removeEventListener('resize', worldMapCanvas._resizeHandler);
        if (worldMapContainer) {
            worldMapContainer.parentNode.removeChild(worldMapContainer);
            worldMapContainer = null;
        } else {
            worldMapCanvas.parentNode.removeChild(worldMapCanvas);
        }
        worldMapCanvas = null;
        worldMapCtx = null;
        worldMapCached = null;
    }

    function renderWorldMap() {
        if (worldMapCanvas && worldMapDirty) {
            drawWorldMap();
        }
    }

    function drawWorldMap() {
        if (!worldMapCtx || !worldData) return;

        var cw = worldMapCanvas.width;
        var ch = worldMapCanvas.height;
        var wctx = worldMapCtx;

        // Determine drawing area with padding for parchment border
        var pad = Math.min(40, Math.min(cw, ch) * 0.04);
        var drawW = cw - pad * 2;
        var drawH = ch - pad * 2;

        var worldPxW = CONFIG.WORLD_WIDTH;
        var worldPxH = CONFIG.WORLD_HEIGHT;

        // Maintain aspect ratio
        var aspect = worldPxW / worldPxH;
        var fitW, fitH;
        if (drawW / drawH > aspect) {
            fitH = drawH;
            fitW = fitH * aspect;
        } else {
            fitW = drawW;
            fitH = fitW / aspect;
        }

        var offsetX = pad + (drawW - fitW) / 2;
        var offsetY = pad + (drawH - fitH) / 2;
        var scaleX = fitW / worldPxW;
        var scaleY = fitH / worldPxH;

        // Parchment background
        wctx.fillStyle = '#d4c5a0';
        wctx.fillRect(0, 0, cw, ch);

        // Darker border area
        wctx.fillStyle = '#b8a87a';
        wctx.fillRect(0, 0, cw, pad);
        wctx.fillRect(0, ch - pad, cw, pad);
        wctx.fillRect(0, 0, pad, ch);
        wctx.fillRect(cw - pad, 0, pad, ch);

        // Inner border line
        wctx.strokeStyle = '#8a7232';
        wctx.lineWidth = 2;
        wctx.strokeRect(offsetX - 2, offsetY - 2, fitW + 4, fitH + 4);
        wctx.strokeStyle = '#5a4530';
        wctx.lineWidth = 1;
        wctx.strokeRect(offsetX - 4, offsetY - 4, fitW + 8, fitH + 8);

        // ── Terrain (sampled at low resolution) ──
        var terrain = worldData.terrain;
        if (terrain && terrain.length) {
            var ts = CONFIG.TILE_SIZE;
            var cols = worldData.gridCols || Math.floor(worldPxW / ts);
            var rows = worldData.gridRows || Math.floor(worldPxH / ts);
            var sampleStep = Math.max(1, Math.floor(Math.min(cols, rows) / Math.min(fitW, fitH) * ts * 0.5));
            if (sampleStep < 2) sampleStep = 2;

            var parchmentTerrainColors = {};
            parchmentTerrainColors[TERRAIN.GRASS.id] = '#8aab6e';
            parchmentTerrainColors[TERRAIN.FOREST.id] = '#5a7a44';
            parchmentTerrainColors[TERRAIN.WATER.id] = '#6a99b8';
            parchmentTerrainColors[TERRAIN.MOUNTAIN.id] = '#9a8a72';
            parchmentTerrainColors[TERRAIN.HILLS.id] = '#7a9a5e';
            parchmentTerrainColors[TERRAIN.SAND.id] = '#c8b888';

            var cellW = Math.ceil(ts * sampleStep * scaleX) + 1;
            var cellH = Math.ceil(ts * sampleStep * scaleY) + 1;

            for (var r = 0; r < rows; r += sampleStep) {
                for (var c = 0; c < cols; c += sampleStep) {
                    var tileId = terrain[r * cols + c];
                    wctx.fillStyle = parchmentTerrainColors[tileId] || '#8aab6e';
                    var px = offsetX + c * ts * scaleX;
                    var py = offsetY + r * ts * scaleY;
                    wctx.fillRect(px, py, cellW, cellH);
                }
            }
        }

        // ── Kingdom territory overlays ──
        var kingdoms;
        try { kingdoms = Engine.getKingdoms(); } catch (e) { kingdoms = null; }
        var towns = Engine.getTowns();

        if (kingdoms && towns) {
            var tsTerr = CONFIG.TILE_SIZE;
            var colsTerr = worldData.gridCols || Math.floor(worldPxW / tsTerr);
            var radiusTerr = 12;

            for (var ki = 0; ki < kingdoms.length; ki++) {
                var kingdom = kingdoms[ki];
                var kColor = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];
                var kTowns = towns.filter(function(t) { return t.kingdomId === kingdom.id; });

                wctx.fillStyle = colorWithAlpha(kColor, 0.12);

                // Draw territory circles (simplified)
                for (var kti = 0; kti < kTowns.length; kti++) {
                    var kt = kTowns[kti];
                    var tr = (radiusTerr + Math.floor((kt.population || 100) / 80)) * tsTerr * scaleX;
                    var tx = offsetX + kt.x * scaleX;
                    var ty = offsetY + kt.y * scaleY;
                    wctx.beginPath();
                    wctx.arc(tx, ty, tr, 0, Math.PI * 2);
                    wctx.fill();
                }

                // Territory border
                wctx.strokeStyle = colorWithAlpha(kColor, 0.3);
                wctx.setLineDash([4, 4]);
                wctx.lineWidth = 1;
                for (var kti2 = 0; kti2 < kTowns.length; kti2++) {
                    var kt2 = kTowns[kti2];
                    var tr2 = (radiusTerr + Math.floor((kt2.population || 100) / 80)) * tsTerr * scaleX;
                    var tx2 = offsetX + kt2.x * scaleX;
                    var ty2 = offsetY + kt2.y * scaleY;
                    wctx.beginPath();
                    wctx.arc(tx2, ty2, tr2, 0, Math.PI * 2);
                    wctx.stroke();
                }
                wctx.setLineDash([]);

                // Kingdom name in center of territory
                if (kTowns.length > 0) {
                    var avgX = 0, avgY = 0;
                    for (var j = 0; j < kTowns.length; j++) {
                        avgX += kTowns[j].x;
                        avgY += kTowns[j].y;
                    }
                    avgX = offsetX + (avgX / kTowns.length) * scaleX;
                    avgY = offsetY + (avgY / kTowns.length) * scaleY;

                    wctx.save();
                    wctx.font = 'bold ' + Math.max(14, Math.round(fitW / 40)) + 'px "Cinzel", serif';
                    wctx.textAlign = 'center';
                    wctx.textBaseline = 'middle';
                    wctx.fillStyle = colorWithAlpha(kColor, 0.5);
                    wctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    wctx.lineWidth = 2;
                    wctx.strokeText(kingdom.name, avgX, avgY);
                    wctx.fillText(kingdom.name, avgX, avgY);
                    wctx.restore();
                }
            }
        }

        // ── Roads ──
        var roads;
        try { roads = Engine.getRoads(); } catch (e) { roads = null; }
        if (roads && towns) {
            var townMap = {};
            for (var ti = 0; ti < towns.length; ti++) townMap[towns[ti].id] = towns[ti];

            wctx.lineWidth = Math.max(1, fitW / 800);
            wctx.setLineDash([]);

            for (var ri = 0; ri < roads.length; ri++) {
                var road = roads[ri];
                var from = townMap[road.fromTownId];
                var to = townMap[road.toTownId];
                if (!from || !to) continue;
                if (!road.waypoints || road.waypoints.length < 2) continue;

                wctx.strokeStyle = road.safe === false ? 'rgba(180,40,30,0.5)' : '#8b7355';
                wctx.beginPath();
                wctx.moveTo(offsetX + road.waypoints[0].x * scaleX, offsetY + road.waypoints[0].y * scaleY);
                var rwStep = Math.max(1, Math.floor(road.waypoints.length / 8));
                for (var rwi = rwStep; rwi < road.waypoints.length - 1; rwi += rwStep) {
                    wctx.lineTo(offsetX + road.waypoints[rwi].x * scaleX, offsetY + road.waypoints[rwi].y * scaleY);
                }
                wctx.lineTo(offsetX + road.waypoints[road.waypoints.length - 1].x * scaleX, offsetY + road.waypoints[road.waypoints.length - 1].y * scaleY);
                wctx.stroke();
            }
        }

        // ── Sea routes ──
        var seaRoutes;
        try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { seaRoutes = null; }
        if (seaRoutes && towns) {
            var townMap2 = {};
            for (var ti2 = 0; ti2 < towns.length; ti2++) townMap2[towns[ti2].id] = towns[ti2];

            wctx.strokeStyle = '#4c72b0';
            wctx.lineWidth = Math.max(1, fitW / 1000);
            wctx.setLineDash([6, 4]);

            for (var si = 0; si < seaRoutes.length; si++) {
                var route = seaRoutes[si];
                var sfrom = townMap2[route.fromTownId];
                var sto = townMap2[route.toTownId];
                if (!sfrom || !sto) continue;

                wctx.beginPath();
                if (route.waypoints && route.waypoints.length >= 2) {
                    wctx.moveTo(offsetX + route.waypoints[0].x * scaleX, offsetY + route.waypoints[0].y * scaleY);
                    var swStep = Math.max(1, Math.floor(route.waypoints.length / 8));
                    for (var swi = swStep; swi < route.waypoints.length - 1; swi += swStep) {
                        wctx.lineTo(offsetX + route.waypoints[swi].x * scaleX, offsetY + route.waypoints[swi].y * scaleY);
                    }
                    wctx.lineTo(offsetX + route.waypoints[route.waypoints.length - 1].x * scaleX, offsetY + route.waypoints[route.waypoints.length - 1].y * scaleY);
                } else {
                    wctx.moveTo(offsetX + sfrom.x * scaleX, offsetY + sfrom.y * scaleY);
                    wctx.lineTo(offsetX + sto.x * scaleX, offsetY + sto.y * scaleY);
                }
                wctx.stroke();
            }
            wctx.setLineDash([]);
        }

        // ── Town markers ──
        if (towns) {
            var baseFontSize = Math.max(8, Math.round(fitW / 100));

            for (var tni = 0; tni < towns.length; tni++) {
                var town = towns[tni];
                var tpx = offsetX + town.x * scaleX;
                var tpy = offsetY + town.y * scaleY;
                var tpop = town.population || 100;
                var tcat = town.category || 'village';
                var tkingdom2 = kingdoms ? kingdoms.find(function(k) { return k.id === town.kingdomId; }) : null;
                var tkColor = tkingdom2 ? (tkingdom2.color || CONFIG.KINGDOM_COLORS[tkingdom2.id % CONFIG.KINGDOM_COLORS.length]) : '#888';

                // Marker size based on population/category
                var markerR = tcat === 'capital_city' ? 5 + Math.sqrt(tpop) * 0.15
                            : tcat === 'city' ? 4 + Math.sqrt(tpop) * 0.12
                            : tcat === 'town' ? 3 + Math.sqrt(tpop) * 0.1
                            : 2.5 + Math.sqrt(tpop) * 0.08;
                markerR = Math.max(2, markerR * Math.min(scaleX, scaleY) * 12);

                // Draw marker
                wctx.fillStyle = tkColor;
                if (tcat === 'capital_city') {
                    // Star shape for capitals
                    wctx.beginPath();
                    for (var si2 = 0; si2 < 8; si2++) {
                        var angle = (si2 / 8) * Math.PI * 2 - Math.PI / 2;
                        var rad = si2 % 2 === 0 ? markerR : markerR * 0.5;
                        var spx = tpx + Math.cos(angle) * rad;
                        var spy = tpy + Math.sin(angle) * rad;
                        if (si2 === 0) wctx.moveTo(spx, spy); else wctx.lineTo(spx, spy);
                    }
                    wctx.closePath();
                    wctx.fill();
                    wctx.strokeStyle = '#ffd700';
                    wctx.lineWidth = 1;
                    wctx.stroke();
                } else if (tcat === 'city') {
                    wctx.fillRect(tpx - markerR * 0.7, tpy - markerR * 0.7, markerR * 1.4, markerR * 1.4);
                    wctx.strokeStyle = 'rgba(0,0,0,0.4)';
                    wctx.lineWidth = 0.5;
                    wctx.strokeRect(tpx - markerR * 0.7, tpy - markerR * 0.7, markerR * 1.4, markerR * 1.4);
                } else {
                    wctx.beginPath();
                    wctx.arc(tpx, tpy, markerR, 0, Math.PI * 2);
                    wctx.fill();
                    wctx.strokeStyle = 'rgba(0,0,0,0.4)';
                    wctx.lineWidth = 0.5;
                    wctx.stroke();
                }

                // Town name
                var nameFontSize = tcat === 'capital_city' ? baseFontSize
                                 : tcat === 'city' ? baseFontSize * 0.85
                                 : baseFontSize * 0.7;
                wctx.font = (tcat === 'capital_city' ? 'bold ' : '') + Math.round(nameFontSize) + 'px "Cinzel", serif';
                wctx.textAlign = 'center';
                wctx.textBaseline = 'top';
                wctx.fillStyle = '#2a1f14';
                wctx.strokeStyle = 'rgba(212,197,160,0.7)';
                wctx.lineWidth = 2;
                wctx.strokeText(town.name, tpx, tpy + markerR + 2);
                wctx.fillText(town.name, tpx, tpy + markerR + 2);

                // Event indicators on world map
                const _wEvtInd = _getTownEventIndicators(town.id);
                if (_wEvtInd) {
                    wctx.font = Math.round(nameFontSize * 0.7) + 'px sans-serif';
                    wctx.fillStyle = '#f0c040';
                    wctx.fillText(_wEvtInd, tpx, tpy - markerR - 4);
                }

                // Port indicator
                if (town.isPort) {
                    wctx.font = Math.round(nameFontSize * 0.8) + 'px serif';
                    wctx.fillStyle = '#4c72b0';
                    wctx.fillText('⚓', tpx + markerR + 4, tpy - 3);
                }
            }
        }

        // ── Player position ──
        if (typeof Player !== 'undefined' && Player.townId != null) {
            var playerTown = null;
            try { playerTown = Engine.getTown(Player.townId); } catch (e) { /* no-op */ }
            if (!playerTown && towns) playerTown = towns.find(function(t) { return t.id === Player.townId; });

            if (playerTown) {
                var ppx = offsetX + playerTown.x * scaleX;
                var ppy = offsetY + playerTown.y * scaleY;

                // Gold pulsing marker
                wctx.fillStyle = '#e8d48b';
                wctx.strokeStyle = '#8a7232';
                wctx.lineWidth = 2;
                wctx.beginPath();
                wctx.arc(ppx, ppy, 8, 0, Math.PI * 2);
                wctx.fill();
                wctx.stroke();

                wctx.font = 'bold ' + Math.round(baseFontSize * 1.1) + 'px "Cinzel", serif';
                wctx.fillStyle = '#8a7232';
                wctx.textAlign = 'center';
                wctx.textBaseline = 'bottom';
                wctx.strokeStyle = 'rgba(212,197,160,0.8)';
                wctx.lineWidth = 2;
                var playerLabel = '📍 You';
                wctx.strokeText(playerLabel, ppx, ppy - 10);
                wctx.fillText(playerLabel, ppx, ppy - 10);
            }
        }

        // ── Legend ──
        if (kingdoms && kingdoms.length > 0) {
            var legendPad = 10;
            var legendLineH = Math.max(16, Math.round(fitW / 60));
            var legendW = Math.max(120, Math.round(fitW / 5));
            var legendH = legendPad * 2 + kingdoms.length * legendLineH + legendLineH;
            var legendX = cw - legendW - pad - 10;
            var legendY = offsetY + 10;

            wctx.fillStyle = 'rgba(30,22,12,0.8)';
            wctx.strokeStyle = '#8a7232';
            wctx.lineWidth = 1;
            wctx.fillRect(legendX, legendY, legendW, legendH);
            wctx.strokeRect(legendX, legendY, legendW, legendH);

            wctx.font = 'bold ' + Math.round(legendLineH * 0.7) + 'px "Cinzel", serif';
            wctx.fillStyle = '#c4a35a';
            wctx.textAlign = 'left';
            wctx.textBaseline = 'top';
            wctx.fillText('Kingdoms', legendX + legendPad, legendY + legendPad);

            for (var li = 0; li < kingdoms.length; li++) {
                var lk = kingdoms[li];
                var lkColor = lk.color || CONFIG.KINGDOM_COLORS[lk.id % CONFIG.KINGDOM_COLORS.length];
                var ly = legendY + legendPad + legendLineH + li * legendLineH;

                wctx.fillStyle = lkColor;
                wctx.fillRect(legendX + legendPad, ly + 2, legendLineH * 0.6, legendLineH * 0.6);
                wctx.strokeStyle = 'rgba(255,255,255,0.3)';
                wctx.lineWidth = 0.5;
                wctx.strokeRect(legendX + legendPad, ly + 2, legendLineH * 0.6, legendLineH * 0.6);

                wctx.font = Math.round(legendLineH * 0.6) + 'px sans-serif';
                wctx.fillStyle = '#d4c5a0';
                wctx.fillText(lk.name, legendX + legendPad + legendLineH, ly + 2);
            }
        }

        // ── Title ──
        wctx.font = 'bold ' + Math.max(18, Math.round(fitW / 30)) + 'px "Cinzel", serif';
        wctx.textAlign = 'center';
        wctx.textBaseline = 'top';
        wctx.fillStyle = '#5a4530';
        wctx.strokeStyle = 'rgba(212,197,160,0.5)';
        wctx.lineWidth = 1;
        var title = 'World Map';
        wctx.fillText(title, cw / 2, pad / 2 - 6);

        // Subtle vignette effect
        var grad = wctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.15)');
        wctx.fillStyle = grad;
        wctx.fillRect(0, 0, cw, ch);

        worldMapDirty = false;
    }

    // ═══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    function setHover(target) { hoverTarget = target; }
    function setSelected(target) { selectedTarget = target; }
    function getCamera() { return camera; }
    function getFrameCount() { return frameCount; }

    return {
        init,
        render,
        resize,
        pan,
        zoomAt,
        setZoom,
        panTo,
        centerOnPlayer,
        screenToWorld,
        worldToScreen,
        hitTest,
        minimapClick,
        isMinimapClick,
        setHover,
        setSelected,
        getCamera,
        getFrameCount,
        getVisibleBounds,
        setMapMode,
        getMapMode,
        renderWorldMap,
        hideWorldMap,
        locatePlayer,
        markMinimapDirty,
        toggleDeposits,
        toggleFertility,
        isDepositsOn() { return showDeposits; },
        isFertilityOn() { return showFertility; },
        startFertilitySurvey,
        startDepositSurvey,
    };
})();
