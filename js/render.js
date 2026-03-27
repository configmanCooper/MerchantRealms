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
        zoom: 1.2,
        targetZoom: 1.2,
        minZoom: 0.5,
        maxZoom: 3.0,
        lerpSpeed: 0.12,
        width: 0,
        height: 0,
    };

    // ── Map mode state ──
    let mapMode = 0; // 0=normal, 1=strategic, 2=world
    let savedZoom = 1.2;
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
    let worldData = null;
    let frameCount = 0;
    let _npcAnimTime = 0; // Game-speed-driven animation clock for NPC movement
    let _lastFrameTimestamp = 0;
    let hoverTarget = null; // { type, id, x, y }
    let selectedTarget = null;

    // ── Minimap cache (redrawn once per game day) ──
    let _minimapCacheCanvas = null;
    let _minimapCacheDirty = true;
    let _minimapCacheDay = -1;
    let showDeposits = false; // toggled by player with Regional Survey skill

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
    function getTerrainColor(id) {
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
        ctx = canvas.getContext('2d');
        minimapCanvas = document.getElementById('minimapCanvas');
        if (minimapCanvas) minimapCtx = minimapCanvas.getContext('2d');

        worldData = world;
        resize();
        window.removeEventListener('resize', resize);
        window.addEventListener('resize', resize);

        // Center camera on player town
        centerOnPlayer();

        terrainDirty = true;
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        camera.width = canvas.width;
        camera.height = canvas.height;
        terrainDirty = true;
    }

    function centerOnPlayer() {
        if (typeof Player === 'undefined') return;
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
        // Lerp towards target
        camera.x += (camera.targetX - camera.x) * camera.lerpSpeed;
        camera.y += (camera.targetY - camera.y) * camera.lerpSpeed;
        camera.zoom += (camera.targetZoom - camera.zoom) * camera.lerpSpeed;

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
        if (dz > 0.005 || dx > 2 || dy > 2) {
            terrainDirty = true;
        }
    }

    function pan(dx, dy) {
        camera.targetX += dx / camera.zoom;
        camera.targetY += dy / camera.zoom;
    }

    function zoomAt(delta, mx, my) {
        const factor = delta > 0 ? 0.9 : 1.1;
        camera.targetZoom = Math.max(camera.minZoom,
            Math.min(camera.maxZoom, camera.targetZoom * factor));
    }

    function setZoom(z) {
        camera.targetZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, z));
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

    // ═══════════════════════════════════════════════════════════
    //  RENDER — MAIN ENTRY
    // ═══════════════════════════════════════════════════════════

    function render(world, player) {
        worldData = world || worldData;
        if (!worldData || !ctx) return;

        frameCount++;
        // Advance NPC animation clock based on game speed (NPCs freeze when paused)
        var now = performance.now();
        if (_lastFrameTimestamp > 0) {
            var dt = (now - _lastFrameTimestamp) / 1000; // seconds since last frame
            var gameSpeed = (typeof Game !== 'undefined' && Game.getSpeed) ? Game.getSpeed() : 0;
            if (gameSpeed > 0) {
                // Scale so current visual speed at 1x is 1/16th of old speed
                // Old: animT = frameCount * 0.015 (~0.9/sec at 60fps)
                // New at 1x: ~0.056/sec, at 16x: ~0.9/sec (matches old), at 60x: ~3.4/sec
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

        // 4b. Elite merchant heraldry flags
        renderEliteMerchantIcons();

        // 4c. Resource deposits overlay (Regional Survey skill)
        if (camera.zoom > 0.5) {
            renderDeposits();
        }

        // 5. People (only when zoomed in)
        if (camera.zoom > 1.5) {
            renderPeople();
        }

        // 6. Caravans
        renderCaravans(player);

        // 7. Player marker
        renderPlayerMarker(player);

        // 8. AI Merchants
        renderAIMerchants();

        // 9. War indicators
        renderWarIndicators();

        // 10. Event effects
        renderEventEffects();

        // Hover highlight
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
        const terrain = worldData.terrain;
        if (!terrain || !terrain.length) return;

        const ts = CONFIG.TILE_SIZE;
        const terrainWidth = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
        const terrainHeight = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);
        const vb = getVisibleBounds();

        const startCol = Math.max(0, Math.floor(vb.left / ts));
        const endCol = Math.min(terrainWidth - 1, Math.ceil(vb.right / ts));
        const startRow = Math.max(0, Math.floor(vb.top / ts));
        const endRow = Math.min(terrainHeight - 1, Math.ceil(vb.bottom / ts));

        const drawW = (endCol - startCol + 1) * ts;
        const drawH = (endRow - startRow + 1) * ts;

        if (terrainDirty || !offscreenTerrain ||
            offscreenTerrain.width !== drawW || offscreenTerrain.height !== drawH) {
            // Recreate offscreen canvas sized to visible area
            if (!offscreenTerrain) {
                offscreenTerrain = document.createElement('canvas');
                offscreenCtx = offscreenTerrain.getContext('2d');
            }
            offscreenTerrain.width = drawW;
            offscreenTerrain.height = drawH;

            const animTime = frameCount * 0.03;

            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const tileId = terrain[r * terrainWidth + c];
                    const baseColor = getTerrainColor(tileId);
                    const h = tileHash(c, r);
                    const shift = Math.floor((h - 0.5) * 20);
                    const color = rgbShift(baseColor, shift);

                    const x = (c - startCol) * ts;
                    const y = (r - startRow) * ts;

                    offscreenCtx.fillStyle = color;
                    offscreenCtx.fillRect(x, y, ts, ts);

                    // Special terrain decorations
                    if (tileId === 1) { // Forest — small tree triangles
                        const treeCount = 1 + Math.floor(h * 2);
                        offscreenCtx.fillStyle = rgbShift('#1a4020', shift);
                        for (let t = 0; t < treeCount; t++) {
                            const tx = x + (h * 37 + t * 5.7) % ts;
                            const ty = y + (h * 23 + t * 7.3) % ts;
                            const sz = 3 + h * 3;
                            offscreenCtx.beginPath();
                            offscreenCtx.moveTo(tx, ty - sz);
                            offscreenCtx.lineTo(tx - sz * 0.6, ty + sz * 0.4);
                            offscreenCtx.lineTo(tx + sz * 0.6, ty + sz * 0.4);
                            offscreenCtx.closePath();
                            offscreenCtx.fill();
                        }
                    } else if (tileId === 2) { // Water — wave animation
                        const wave = Math.sin(animTime + c * 0.7 + r * 0.5) * 0.08;
                        offscreenCtx.fillStyle = `rgba(180,220,255,${0.08 + wave})`;
                        offscreenCtx.fillRect(x, y, ts, ts);
                        // small wave lines
                        offscreenCtx.strokeStyle = `rgba(150,200,240,${0.15 + wave})`;
                        offscreenCtx.lineWidth = 0.5;
                        const wy = y + ts * 0.5 + Math.sin(animTime + c * 1.2) * 2;
                        offscreenCtx.beginPath();
                        offscreenCtx.moveTo(x + 2, wy);
                        offscreenCtx.quadraticCurveTo(x + ts * 0.5, wy - 2, x + ts - 2, wy);
                        offscreenCtx.stroke();
                    } else if (tileId === 3) { // Mountain — triangle peaks
                        offscreenCtx.fillStyle = rgbShift('#6b5b4f', shift);
                        const mx = x + ts * 0.5;
                        const my = y + ts * 0.2;
                        offscreenCtx.beginPath();
                        offscreenCtx.moveTo(mx, my);
                        offscreenCtx.lineTo(x + ts * 0.2, y + ts * 0.9);
                        offscreenCtx.lineTo(x + ts * 0.8, y + ts * 0.9);
                        offscreenCtx.closePath();
                        offscreenCtx.fill();
                        // Snow cap (winter or high mountain)
                        const season = (typeof Engine !== 'undefined' && Engine.getSeason) ? Engine.getSeason() : '';
                        if (season === 'Winter' || h > 0.6) {
                            offscreenCtx.fillStyle = 'rgba(240,240,255,0.6)';
                            offscreenCtx.beginPath();
                            offscreenCtx.moveTo(mx, my);
                            offscreenCtx.lineTo(mx - ts * 0.12, my + ts * 0.2);
                            offscreenCtx.lineTo(mx + ts * 0.12, my + ts * 0.2);
                            offscreenCtx.closePath();
                            offscreenCtx.fill();
                        }
                    } else if (tileId === 4) { // Hills — gentle bumps
                        offscreenCtx.fillStyle = rgbShift('#5a7a42', shift - 8);
                        offscreenCtx.beginPath();
                        offscreenCtx.arc(x + ts * 0.35, y + ts * 0.65, ts * 0.25, Math.PI, 0);
                        offscreenCtx.fill();
                        offscreenCtx.beginPath();
                        offscreenCtx.arc(x + ts * 0.7, y + ts * 0.55, ts * 0.2, Math.PI, 0);
                        offscreenCtx.fill();
                    }
                }
            }

            terrainDirty = false;
            lastTerrainZoom = camera.zoom;
            lastTerrainCamX = camera.x;
            lastTerrainCamY = camera.y;
        }

        // Blit offscreen terrain to main canvas
        ctx.drawImage(offscreenTerrain, startCol * ts, startRow * ts);
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

        for (const kingdom of kingdoms) {
            const kColor = kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length];
            const kTowns = towns.filter(t => t.kingdomId === kingdom.id);

            ctx.fillStyle = colorWithAlpha(kColor, mapMode === 1 ? 0.18 : 0.10);

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

        for (const road of roads) {
            const from = townMap[road.fromTownId];
            const to = townMap[road.toTownId];
            if (!from || !to) continue;

            const fx = from.x;
            const fy = from.y;
            const tx = to.x;
            const ty = to.y;

            // skip if entirely off-screen
            if (!isVisible(fx, fy, 200) && !isVisible(tx, ty, 200)) continue;

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

            if (!safe) {
                ctx.strokeStyle = '#8b4513';
                ctx.setLineDash([6, 4]);
                drawWaypointPath(road.waypoints);

                // Red overlay for unsafe
                ctx.strokeStyle = 'rgba(180,40,30,0.45)';
                ctx.lineWidth = width + 1;
                drawWaypointPath(road.waypoints);
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = quality >= 3 ? '#a08050' : quality >= 2 ? '#8b7355' : '#6b5b4f';
                ctx.setLineDash([]);
                drawWaypointPath(road.waypoints);
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

            // Draw bridge segments
            if ((road.hasBridge || false) && road.bridgeSegments && road.bridgeSegments.length > 0) {
                for (const seg of road.bridgeSegments) {
                    let bStart, bEnd;

                    if (seg.startIdx !== undefined) {
                        // Waypoint-indexed bridge segments
                        bStart = road.waypoints[seg.startIdx] || road.waypoints[0];
                        bEnd = road.waypoints[seg.endIdx] || road.waypoints[road.waypoints.length - 1];
                    } else if (seg.startT !== undefined) {
                        // Legacy t-value bridge segments — interpolate along waypoints
                        function wpLerp(t) {
                            var wps = road.waypoints;
                            var idx = t * (wps.length - 1);
                            var i = Math.min(Math.floor(idx), wps.length - 2);
                            var frac = idx - i;
                            return {
                                x: wps[i].x + (wps[i+1].x - wps[i].x) * frac,
                                y: wps[i].y + (wps[i+1].y - wps[i].y) * frac,
                            };
                        }
                        bStart = wpLerp(seg.startT);
                        bEnd = wpLerp(seg.endT);
                    } else {
                        continue;
                    }

                    if (road.bridgeDestroyed) {
                        // Destroyed bridge: red dashed line + X
                        ctx.strokeStyle = '#cc3333';
                        ctx.lineWidth = width + 2;
                        ctx.setLineDash([3, 3]);
                        ctx.beginPath();
                        ctx.moveTo(bStart.x, bStart.y);
                        ctx.lineTo(bEnd.x, bEnd.y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        // Red X at midpoint
                        const bmx = (bStart.x + bEnd.x) / 2;
                        const bmy = (bStart.y + bEnd.y) / 2;
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(bmx - 4, bmy - 4); ctx.lineTo(bmx + 4, bmy + 4);
                        ctx.moveTo(bmx + 4, bmy - 4); ctx.lineTo(bmx - 4, bmy + 4);
                        ctx.stroke();
                    } else {
                        // Intact bridge: brown wooden planks look
                        ctx.strokeStyle = '#8B6914';
                        ctx.lineWidth = width + 3;
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(bStart.x, bStart.y);
                        ctx.lineTo(bEnd.x, bEnd.y);
                        ctx.stroke();
                        // Plank lines perpendicular
                        ctx.strokeStyle = '#6B4F12';
                        ctx.lineWidth = 1;
                        const bLen = Math.hypot(bEnd.x - bStart.x, bEnd.y - bStart.y);
                        if (bLen > 0) {
                            const numPlanks = Math.max(2, Math.floor(bLen / 4));
                            for (let pl = 0; pl <= numPlanks; pl++) {
                                const pt = pl / numPlanks;
                                const ppx = bStart.x + (bEnd.x - bStart.x) * pt;
                                const ppy = bStart.y + (bEnd.y - bStart.y) * pt;
                                const perpX = -(bEnd.y - bStart.y) / bLen * (width/2 + 2);
                                const perpY = (bEnd.x - bStart.x) / bLen * (width/2 + 2);
                                ctx.beginPath();
                                ctx.moveTo(ppx + perpX, ppy + perpY);
                                ctx.lineTo(ppx - perpX, ppy - perpY);
                                ctx.stroke();
                            }
                        }
                    }
                }
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

            // skip if entirely off-screen
            if (!isVisible(fx, fy, 200) && !isVisible(tx, ty, 200)) continue;

            // Dashed line — bright yellow-gold stands out over water
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
            } else {
                // Detailed town rendering — distinct graphics per category
                const cat = town.category || 'village';
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
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  4c. RESOURCE DEPOSITS OVERLAY
    // ═══════════════════════════════════════════════════════════

    function renderDeposits() {
        if (!showDeposits) return;
        const towns = _frameTowns;
        if (!towns) return;
        if (typeof Player === 'undefined' || !Player.hasSkill || !Player.hasSkill('regional_survey')) return;

        var playerKingdom = Player.kingdomId;
        var depositIcons = {
            wheat: '\uD83C\uDF3E', iron_ore: '\u26CF', wood: '\uD83E\uDEB5',
            stone: '\uD83E\uDEA8', wool: '\uD83D\uDC11', hide: '\uD83D\uDC04',
            grapes: '\uD83C\uDF47', gold_ore: '\u2728', hemp: '\uD83C\uDF3F',
            clay: '\uD83C\uDFFA', salt: '\uD83E\uDDC2', fish: '\uD83D\uDC1F',
            herbs: '\uD83C\uDF3F', honey: '\uD83C\uDF6F', silk: '\uD83E\uDDE3',
            pearls: '\uD83E\uDEE7'
        };

        for (var t = 0; t < towns.length; t++) {
            var town = towns[t];
            if (!town.naturalDeposits) continue;
            // Only show for player's kingdom or towns the player is in
            if (town.kingdomId !== playerKingdom && Player.townId !== town.id) continue;
            if (!isVisible(town.x, town.y, 200)) continue;

            var keys = Object.keys(town.naturalDeposits);
            var icons = '';
            for (var k = 0; k < keys.length; k++) {
                if (town.naturalDeposits[keys[k]] > 0 && depositIcons[keys[k]]) {
                    icons += depositIcons[keys[k]];
                }
            }
            if (!icons) continue;

            var baseSize = (town.category === 'city' ? 14 : town.category === 'town' ? 11 : 8);
            var yOff = town.y - baseSize - 12;
            ctx.font = '7px sans-serif';
            ctx.fillStyle = 'rgba(40,80,40,0.95)';
            ctx.fillText(icons, town.x - ctx.measureText(icons).width / 2, yOff);
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

                const occ = (p.occupation || 'none').toLowerCase();
                ctx.fillStyle = occColors[occ] || '#888';
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  6. CARAVANS
    // ═══════════════════════════════════════════════════════════

    function renderCaravans(player) {
        if (!player || !player.caravans) return;

        const towns = _frameTowns;
        if (!towns) return;
        const townMap = _frameTownMap;
        const ts = CONFIG.TILE_SIZE;

        for (const caravan of player.caravans) {
            const from = townMap[caravan.fromTownId];
            const to = townMap[caravan.toTownId];
            if (!from || !to) continue;

            const progress = caravan.progress || 0;
            const fx = from.x;
            const fy = from.y;
            const tx = to.x;
            const ty = to.y;

            // Position along the road
            const cx = fx + (tx - fx) * progress;
            const cy = fy + (ty - fy) * progress;

            if (!isVisible(cx, cy, 50)) continue;

            // Cart body
            ctx.fillStyle = '#8b6914';
            ctx.fillRect(cx - 6, cy - 3, 12, 6);

            // Wheels
            ctx.fillStyle = '#5a4a38';
            ctx.beginPath();
            ctx.arc(cx - 4, cy + 4, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + 4, cy + 4, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Canvas cover
            ctx.fillStyle = '#c2b280';
            ctx.beginPath();
            ctx.arc(cx, cy - 3, 6, Math.PI, 0);
            ctx.fill();

            // Goods / guard indicators
            if (camera.zoom > 0.8) {
                const goodsCount = caravan.goods ? Object.values(caravan.goods).reduce((a, b) => a + b, 0) : 0;
                const guards = caravan.guards || 0;
                ctx.fillStyle = '#e8dcc8';
                ctx.font = '7px serif';
                ctx.textAlign = 'center';
                ctx.fillText(`📦${goodsCount} 🛡${guards}`, cx, cy - 10);
            }

            // Status colors
            if (caravan.status === 'attacked') {
                ctx.strokeStyle = 'rgba(200,40,30,0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 12, 0, Math.PI * 2);
                ctx.stroke();
            }
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
        } else if (player.worldX && player.worldY) {
            // Player is in the wilderness (not at a town)
            px = player.worldX;
            py = player.worldY;
        } else {
            return;
        }

        if (!isVisible(px, py, 100)) return;

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
        if (typeof AIMerchants === 'undefined' || !AIMerchants) return;

        const towns = _frameTowns;
        if (!towns) return;
        const townMap = _frameTownMap;
        const ts = CONFIG.TILE_SIZE;

        for (const merchant of AIMerchants) {
            const town = townMap[merchant.townId];
            if (!town) continue;

            const mx = town.x + 15;
            const my = town.y + 10;
            if (!isVisible(mx, my, 50)) continue;

            // Small merchant marker
            ctx.fillStyle = '#8172b2';
            ctx.beginPath();
            ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            if (camera.zoom > 1.0) {
                ctx.fillStyle = 'rgba(200,190,170,0.7)';
                ctx.font = '7px serif';
                ctx.textAlign = 'left';
                ctx.fillText(merchant.name, mx + 6, my + 3);
            }
        }
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
            if (!kingdom.atWar || !kingdom.atWar.length) continue;

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

        // Terrain (sampled — draw every Nth tile)
        const terrain = worldData.terrain;
        if (terrain && terrain.length) {
            const cols = worldData.gridCols || Math.floor(CONFIG.WORLD_WIDTH / ts);
            const rows = worldData.gridRows || Math.floor(CONFIG.WORLD_HEIGHT / ts);
            const step = Math.max(1, Math.floor(3 / Math.max(scaleX, scaleY)));

            for (let r = 0; r < rows; r += step) {
                for (let c = 0; c < cols; c += step) {
                    const tileId = terrain[r * cols + c];
                    mctx.fillStyle = getTerrainColor(tileId);
                    const px = c * ts * scaleX;
                    const py = r * ts * scaleY;
                    const pw = Math.max(1, ts * step * scaleX);
                    const ph = Math.max(1, ts * step * scaleY);
                    mctx.fillRect(px, py, pw, ph);
                }
            }
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
            // Draw sea routes on minimap
            let seaRoutes;
            try { seaRoutes = Engine.getSeaRoutes(); } catch (e) { seaRoutes = null; }
            if (seaRoutes) {
                mctx.strokeStyle = 'rgba(255,200,50,0.5)';
                mctx.lineWidth = 0.5;
                mctx.setLineDash([2, 2]);
                for (const route of seaRoutes) {
                    const from = towns.find(t => t.id === route.fromTownId);
                    const to = towns.find(t => t.id === route.toTownId);
                    if (!from || !to) continue;
                    mctx.beginPath();
                    mctx.moveTo(from.x * scaleX, from.y * scaleY);
                    mctx.lineTo(to.x * scaleX, to.y * scaleY);
                    mctx.stroke();
                }
                mctx.setLineDash([]);
            }

            for (const town of towns) {
                const kingdom = kingdoms ? kingdoms.find(k => k.id === town.kingdomId) : null;
                const kColor = kingdom ? (kingdom.color || CONFIG.KINGDOM_COLORS[kingdom.id % CONFIG.KINGDOM_COLORS.length]) : '#ccc';
                mctx.fillStyle = kColor;
                const px = town.x * scaleX;
                const py = town.y * scaleY;
                mctx.beginPath();
                mctx.arc(px, py, 2.5, 0, Math.PI * 2);
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

        // Player position (blinking gold)
        if (player && player.townId != null) {
            let playerTown;
            try { playerTown = Engine.getTown(player.townId); } catch (e) { /* no-op */ }
            if (!playerTown && _frameTowns) playerTown = _frameTowns.find(t => t.id === player.townId);

            if (playerTown) {
                const blink = Math.sin(frameCount * 0.1) > 0;
                if (blink) {
                    minimapCtx.fillStyle = '#e8d48b';
                    const ppx = playerTown.x * scaleX;
                    const ppy = playerTown.y * scaleY;
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

        if (!prioritizePeople) {
            // Check towns first (normal behavior)
            const towns = Engine.getTowns();
            if (towns) {
                for (const town of towns) {
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

        // Check roads
        let roads;
        try { roads = Engine.getRoads(); } catch (e) { roads = null; }
        if (roads && towns) {
            const townMap = {};
            for (const t of towns) townMap[t.id] = t;

            for (const road of roads) {
                const from = townMap[road.fromTownId];
                const to = townMap[road.toTownId];
                if (!from || !to) continue;

                const fx = from.x;
                const fy = from.y;
                const tx = to.x;
                const ty = to.y;

                // Point-to-segment distance
                const segDist = pointToSegmentDist(w.x, w.y, fx, fy, tx, ty);
                if (segDist < 8) {
                    return { type: 'road', data: { ...road, fromTown: from, toTown: to } };
                }
            }
        }

        // Check sea routes
        let seaRoutes;
        try { seaRoutes = Engine.getSeaRoutes ? Engine.getSeaRoutes() : []; } catch (e) { seaRoutes = []; }
        if (seaRoutes.length > 0 && towns) {
            const townMap = {};
            for (const t of towns) townMap[t.id] = t;

            for (const route of seaRoutes) {
                const from = townMap[route.fromTownId];
                const to = townMap[route.toTownId];
                if (!from || !to) continue;

                const segDist = pointToSegmentDist(w.x, w.y, from.x, from.y, to.x, to.y);
                if (segDist < 10) {
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
        closeBtn.onclick = function() {
            if (typeof UI !== 'undefined' && UI.closeMapView) UI.closeMapView();
        };
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

            wctx.strokeStyle = '#8b7355';
            wctx.lineWidth = Math.max(1, fitW / 800);
            wctx.setLineDash([]);

            for (var ri = 0; ri < roads.length; ri++) {
                var road = roads[ri];
                var from = townMap[road.fromTownId];
                var to = townMap[road.toTownId];
                if (!from || !to) continue;

                wctx.beginPath();
                wctx.moveTo(offsetX + from.x * scaleX, offsetY + from.y * scaleY);
                wctx.lineTo(offsetX + to.x * scaleX, offsetY + to.y * scaleY);
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
                wctx.moveTo(offsetX + sfrom.x * scaleX, offsetY + sfrom.y * scaleY);
                wctx.lineTo(offsetX + sto.x * scaleX, offsetY + sto.y * scaleY);
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
    };
})();
