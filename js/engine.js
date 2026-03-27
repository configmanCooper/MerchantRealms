// ============================================================
// Merchant Realms — Engine.js
// World Generation, Person Simulation, Kingdom AI, Diplomacy,
// Military, Economy, and Random Events
// ============================================================
(function () {
    'use strict';

    // ── Performance: lookup maps for findBuildingType / findResourceById ──
    var _buildingTypeMap = null;
    var _resourceTypeMap = null;

    function _ensureLookupMaps() {
        if (!_buildingTypeMap) {
            _buildingTypeMap = {};
            for (var _lk in BUILDING_TYPES) {
                if (BUILDING_TYPES[_lk] && BUILDING_TYPES[_lk].id) {
                    _buildingTypeMap[BUILDING_TYPES[_lk].id] = BUILDING_TYPES[_lk];
                }
            }
        }
        if (!_resourceTypeMap) {
            _resourceTypeMap = {};
            for (var _lk in RESOURCE_TYPES) {
                if (RESOURCE_TYPES[_lk] && RESOURCE_TYPES[_lk].id) {
                    _resourceTypeMap[RESOURCE_TYPES[_lk].id] = RESOURCE_TYPES[_lk];
                }
            }
        }
    }

    // ── Performance: tick-scoped people cache ──
    var _tickCache = { peopleByTown: {}, peopleByKingdom: {}, soldiersByKingdom: {}, aliveCount: 0 };

    // ── Performance: render-scoped people cache ──
    var _renderPeopleCache = null;
    var _renderPeopleCacheDay = -1;

    // ========================================================
    // §1  SEEDED PSEUDO-RANDOM NUMBER GENERATOR (xoshiro128**)
    // ========================================================
    function createRNG(seed) {
        // Convert any seed into four 32-bit state values
        function splitmix32(a) {
            return function () {
                a |= 0; a = (a + 0x9e3779b9) | 0;
                let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
                t = t ^ (t >>> 15); t = Math.imul(t, 0x735a2d97);
                return ((t ^ (t >>> 15)) >>> 0);
            };
        }
        const sm = splitmix32(seed);
        let s0 = sm(), s1 = sm(), s2 = sm(), s3 = sm();

        function next() {
            const result = (Math.imul(s1 * 5, 1 << 7 | 1) >>> 0);
            const t = s1 << 9;
            s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3;
            s2 ^= t; s3 = (s3 << 11 | s3 >>> 21);
            return result;
        }

        const rng = {
            /** 0-1 float */
            random() { return (next() >>> 0) / 0x100000000; },
            /** integer in [min, max] inclusive */
            randInt(min, max) { return min + ((next() >>> 0) % (max - min + 1)); },
            /** float in [min, max) */
            randFloat(min, max) { return min + rng.random() * (max - min); },
            /** pick random element */
            pick(arr) { if (!arr || arr.length === 0) return undefined; return arr[(next() >>> 0) % arr.length]; },
            /** shuffle in place (Fisher-Yates) */
            shuffle(arr) {
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = (next() >>> 0) % (i + 1);
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            },
            /** true with given probability 0-1 */
            chance(p) { return rng.random() < p; },
        };
        return rng;
    }

    // ========================================================
    // §2  SIMPLE 2-D VALUE NOISE (gradient-like)
    // ========================================================
    function createNoise(seed) {
        const SIZE = 256;
        const perm = new Uint8Array(SIZE * 2);
        const grad = new Float32Array(SIZE * 2);
        const sm = createRNG(seed);

        for (let i = 0; i < SIZE; i++) perm[i] = i;
        for (let i = SIZE - 1; i > 0; i--) {
            const j = sm.randInt(0, i);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
        for (let i = 0; i < SIZE * 2; i++) grad[i] = sm.randFloat(-1, 1);

        function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        function lerp(a, b, t) { return a + t * (b - a); }

        function noise2d(x, y) {
            const X = Math.floor(x) & (SIZE - 1);
            const Y = Math.floor(y) & (SIZE - 1);
            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);
            const u = fade(xf), v = fade(yf);
            const aa = perm[perm[X] + Y];
            const ab = perm[perm[X] + Y + 1];
            const ba = perm[perm[X + 1] + Y];
            const bb = perm[perm[X + 1] + Y + 1];
            const g = (idx, fx, fy) => grad[idx * 2] * fx + grad[idx * 2 + 1] * fy;
            return lerp(
                lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u),
                lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u),
                v
            );
        }

        /** Multi-octave fractal noise in [-1, 1] */
        return function fbm(x, y, octaves = 4) {
            let val = 0, amp = 1, freq = 1, max = 0;
            for (let i = 0; i < octaves; i++) {
                val += noise2d(x * freq, y * freq) * amp;
                max += amp;
                amp *= 0.5;
                freq *= 2;
            }
            return val / max;
        };
    }

    // ========================================================
    // §3  ID GENERATION
    // ========================================================
    let _nextId = 1;
    function uid(prefix) { return prefix + '_' + (_nextId++); }

    // ========================================================
    // §4  INTERNAL WORLD STATE
    // ========================================================
    let world = null; // set by generate()

    function defaultWorld() {
        return {
            seed: 42,
            day: 1,
            hour: 0,            // 0-23 hour of day cycle
            terrain: null,      // Uint8Array (grid cols × rows)
            gridCols: 0,
            gridRows: 0,
            kingdoms: [],       // kingdom objects
            towns: [],          // town objects
            roads: [],          // road objects
            seaRoutes: [],      // sea route objects
            people: [],         // person objects
            events: [],         // active & recent events
            eventLog: [],       // last 90 days of event messages
            majorEventHistory: [], // permanent history of major events
            armies: [],         // active army objects
            fashionTrends: [], // active fashion/luxury trends
            eliteMerchants: [], // tracked elite merchant references (dynamic: 20-100)
            npcCaravans: [], // EM and kingdom caravans
        };
    }

    // ========================================================
    // §5  TERRAIN GENERATION
    // ========================================================
    function generateTerrain(rng, seed) {
        const cols = Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
        const rows = Math.floor(CONFIG.WORLD_HEIGHT / CONFIG.TILE_SIZE);
        const grid = new Uint8Array(cols * rows);

        const elevation = createNoise(seed);
        const moisture = createNoise(seed + 9999);

         for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const nx = x / cols;
                const ny = y / rows;
                let e = elevation(nx * 8, ny * 8, 6);     // more octaves + higher freq = more variation
                let m = moisture(nx * 7 + 100, ny * 7 + 100, 5);

                // Add medium-scale detail
                e += elevation(nx * 20, ny * 20, 3) * 0.25;

                // Land bias — shift elevation up so ~80% is land
                e += 0.35;

                // Create border ocean fade (narrow coastal strip)
                const dx = Math.abs(nx - 0.5) * 2;
                const dy = Math.abs(ny - 0.5) * 2;
                const edgeDist = Math.max(dx, dy);
                if (edgeDist > 0.90) e -= (edgeDist - 0.90) * 8;

                // Inland lakes — small scattered depressions
                const lakeNoise = elevation(nx * 25 + 300, ny * 25 + 300, 2);
                const isLake = (lakeNoise > 0.55) && (e < 0.25);

                // Rivers — thin sinuous water channels
                const riverNoise = elevation(nx * 3 + 50, ny * 12 + 50, 3);
                const river2 = elevation(nx * 12 + 200, ny * 3 + 200, 3);
                const isRiver = (Math.abs(riverNoise) < 0.03) || (Math.abs(river2) < 0.03);

                let terrain;
                if (e < -0.15) terrain = TERRAIN.WATER.id;
                else if (isLake) terrain = TERRAIN.WATER.id;
                else if (isRiver && e < 0.4) terrain = TERRAIN.WATER.id;
                else if (e < 0.05) terrain = m > 0.1 ? TERRAIN.GRASS.id : TERRAIN.SAND.id;
                else if (e < 0.25) terrain = m > -0.15 ? TERRAIN.GRASS.id : TERRAIN.SAND.id;
                else if (e < 0.50) terrain = m > 0.0 ? TERRAIN.FOREST.id : TERRAIN.HILLS.id;
                else if (e < 0.65) terrain = TERRAIN.HILLS.id;
                else terrain = TERRAIN.MOUNTAIN.id;

                grid[y * cols + x] = terrain;
            }
        }

        // Carve a few rivers
        for (let r = 0; r < 3; r++) {
            let rx = rng.randInt(Math.floor(cols * 0.2), Math.floor(cols * 0.8));
            let ry = rng.randInt(0, Math.floor(rows * 0.15));
            for (let step = 0; step < rows * 2 && ry < rows; step++) {
                if (rx >= 0 && rx < cols && ry >= 0 && ry < rows) {
                    grid[ry * cols + rx] = TERRAIN.WATER.id;
                    if (rx + 1 < cols) grid[ry * cols + rx + 1] = TERRAIN.WATER.id;
                }
                ry++;
                rx += rng.randInt(-1, 1);
                rx = Math.max(0, Math.min(cols - 1, rx));
            }
        }

        return { grid, cols, rows };
    }

    // ========================================================
    // §6  HELPER: TERRAIN QUERIES
    // ========================================================
    function terrainAt(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= world.gridCols || ty >= world.gridRows) return TERRAIN.WATER.id;
        return world.terrain[ty * world.gridCols + tx];
    }

    // ========================================================
    // §6b  HELPER: TERRAIN-BASED TOWN CLASSIFICATION
    // ========================================================

    /**
     * Classify a town's terrain type by inspecting surrounding tiles.
     * Returns one of: 'island', 'coastal', 'mountain', 'forest', 'plains'.
     */
    function classifyTownTerrain(town) {
        if (town.isIsland === true) return 'island';
        if (town.isPort === true) return 'coastal';

        const cols = world.gridCols;
        const centerTx = Math.floor(town.x / CONFIG.TILE_SIZE);
        const centerTy = Math.floor(town.y / CONFIG.TILE_SIZE);

        let mountainCount = 0;
        let forestCount = 0;
        let total = 0;

        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const tx = centerTx + dx;
                const ty = centerTy + dy;
                const tid = terrainAt(tx, ty);
                total++;
                if (tid === TERRAIN.MOUNTAIN.id || tid === TERRAIN.HILLS.id) {
                    mountainCount++;
                } else if (tid === TERRAIN.FOREST.id) {
                    forestCount++;
                }
            }
        }

        if (mountainCount / total > 0.40) return 'mountain';
        if (forestCount / total > 0.40) return 'forest';
        return 'plains';
    }

    /**
     * Compute local base prices for a town based on its terrain type.
     * Populates town.localBasePrice with terrain-adjusted prices.
     */
    function computeLocalBasePrices(town) {
        town.localBasePrice = {};
        const modifiers = CONFIG.TERRAIN_PRICE_MODIFIERS[town.terrainType] || {};
        for (const key in RESOURCE_TYPES) {
            const r = RESOURCE_TYPES[key];
            town.localBasePrice[r.id] = r.basePrice * (modifiers[r.id] || 1.0);
        }
    }

    // --- A* Pathfinding with binary min-heap ---

    function findTerrainPath(startPx, startPy, endPx, endPy, mode) {
        const TS = CONFIG.TILE_SIZE;
        const step = CONFIG.PATHFIND_STEP || 2;
        const maxNodes = CONFIG.PATHFIND_MAX_NODES || 50000;
        const cols = world.gridCols;
        const rows = world.gridRows;

        // Convert pixel coordinates to tile coordinates (snapped to step grid)
        const sx = Math.min(Math.max(Math.round(startPx / TS / step) * step, 0), cols - 1);
        const sy = Math.min(Math.max(Math.round(startPy / TS / step) * step, 0), rows - 1);
        const ex = Math.min(Math.max(Math.round(endPx / TS / step) * step, 0), cols - 1);
        const ey = Math.min(Math.max(Math.round(endPy / TS / step) * step, 0), rows - 1);

        // Terrain cost lookup by mode
        function tileCost(tx, ty) {
            const t = terrainAt(tx, ty);
            if (mode === 'sea') {
                if (t === TERRAIN.WATER.id) return 1.0;
                if (t === TERRAIN.SAND.id) return 50.0;
                return 999.0;
            } else {
                // land mode
                if (t === TERRAIN.GRASS.id) return 1.0;
                if (t === TERRAIN.HILLS.id) return 1.5;
                if (t === TERRAIN.SAND.id) return 1.3;
                if (t === TERRAIN.FOREST.id) return 2.0;
                if (t === TERRAIN.MOUNTAIN.id) return 8.0;
                if (t === TERRAIN.WATER.id) return 15.0;
                return 1.0;
            }
        }

        // Octile distance heuristic
        var SQRT2 = 1.41421356;
        function heuristic(ax, ay, bx, by) {
            var dx = Math.abs(ax - bx);
            var dy = Math.abs(ay - by);
            return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
        }

        // 8 directional neighbors (dx, dy, moveCostMultiplier)
        var dirs = [
            [-step, 0, step], [step, 0, step], [0, -step, step], [0, step, step],
            [-step, -step, step * SQRT2], [step, -step, step * SQRT2],
            [-step, step, step * SQRT2], [step, step, step * SQRT2]
        ];

        // Binary min-heap keyed on f-score
        function MinHeap() {
            this.data = [];
        }
        MinHeap.prototype.push = function(item) {
            this.data.push(item);
            var i = this.data.length - 1;
            while (i > 0) {
                var parent = (i - 1) >> 1;
                if (this.data[parent].f <= this.data[i].f) break;
                var tmp = this.data[parent];
                this.data[parent] = this.data[i];
                this.data[i] = tmp;
                i = parent;
            }
        };
        MinHeap.prototype.pop = function() {
            var top = this.data[0];
            var last = this.data.pop();
            if (this.data.length > 0) {
                this.data[0] = last;
                var i = 0;
                var len = this.data.length;
                for (;;) {
                    var left = 2 * i + 1, right = 2 * i + 2, smallest = i;
                    if (left < len && this.data[left].f < this.data[smallest].f) smallest = left;
                    if (right < len && this.data[right].f < this.data[smallest].f) smallest = right;
                    if (smallest === i) break;
                    var tmp = this.data[smallest];
                    this.data[smallest] = this.data[i];
                    this.data[i] = tmp;
                    i = smallest;
                }
            }
            return top;
        };
        MinHeap.prototype.size = function() { return this.data.length; };

        // A* search
        var open = new MinHeap();
        var gScore = {};
        var cameFrom = {};
        var closedSet = {};

        function key(x, y) { return y * cols + x; }

        var startKey = key(sx, sy);
        gScore[startKey] = 0;
        open.push({ x: sx, y: sy, f: heuristic(sx, sy, ex, ey) });

        var explored = 0;
        var found = false;
        var endKey = key(ex, ey);

        while (open.size() > 0 && explored < maxNodes) {
            var current = open.pop();
            var cx = current.x, cy = current.y;
            var ck = key(cx, cy);

            if (closedSet[ck]) continue;
            closedSet[ck] = true;
            explored++;

            if (cx === ex && cy === ey) { found = true; break; }

            var currentG = gScore[ck];

            for (var d = 0; d < 8; d++) {
                var nx = cx + dirs[d][0];
                var ny = cy + dirs[d][1];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

                var nk = key(nx, ny);
                if (closedSet[nk]) continue;

                var cost = tileCost(nx, ny);
                if (cost >= 999) continue;

                var moveCost = dirs[d][2] * cost;
                var tentativeG = currentG + moveCost;

                if (gScore[nk] === undefined || tentativeG < gScore[nk]) {
                    gScore[nk] = tentativeG;
                    cameFrom[nk] = ck;
                    open.push({ x: nx, y: ny, f: tentativeG + heuristic(nx, ny, ex, ey) });
                }
            }
        }

        if (!found) return null;

        // Reconstruct path in tile coordinates
        var rawPath = [];
        var ck2 = endKey;
        while (ck2 !== undefined) {
            var py2 = Math.floor(ck2 / cols);
            var px2 = ck2 - py2 * cols;
            rawPath.push({ tx: px2, ty: py2 });
            ck2 = cameFrom[ck2];
        }
        rawPath.reverse();

        // Convert to pixel coordinates (tile center)
        var half = TS / 2;
        var pixelPath = [];
        for (var i = 0; i < rawPath.length; i++) {
            pixelPath.push({ x: rawPath[i].tx * TS + half, y: rawPath[i].ty * TS + half });
        }

        // Ensure path starts and ends at exact pixel positions
        pixelPath[0] = { x: startPx, y: startPy };
        pixelPath[pixelPath.length - 1] = { x: endPx, y: endPy };

        // Douglas-Peucker simplification
        function perpendicularDist(p, a, b) {
            var dx = b.x - a.x, dy = b.y - a.y;
            var lenSq = dx * dx + dy * dy;
            if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
            var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
        }

        function douglasPeucker(pts, epsilon) {
            if (pts.length <= 2) return pts;
            var maxDist = 0, maxIdx = 0;
            for (var i2 = 1; i2 < pts.length - 1; i2++) {
                var d = perpendicularDist(pts[i2], pts[0], pts[pts.length - 1]);
                if (d > maxDist) { maxDist = d; maxIdx = i2; }
            }
            if (maxDist > epsilon) {
                var left = douglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
                var right = douglasPeucker(pts.slice(maxIdx), epsilon);
                return left.slice(0, left.length - 1).concat(right);
            }
            return [pts[0], pts[pts.length - 1]];
        }

        var simplified = douglasPeucker(pixelPath, TS);

        // Compute water fraction from raw path for validation
        var waterTiles = 0;
        var rawBridgeSpans = [];
        var inWaterRaw = false;
        var rawBridgeStart = 0;
        for (var ri = 0; ri < rawPath.length; ri++) {
            var isWaterRaw = terrainAt(rawPath[ri].tx, rawPath[ri].ty) === TERRAIN.WATER.id;
            if (isWaterRaw) {
                waterTiles++;
                if (!inWaterRaw) { rawBridgeStart = ri; inWaterRaw = true; }
            } else {
                if (inWaterRaw) {
                    rawBridgeSpans.push(ri - rawBridgeStart);
                    inWaterRaw = false;
                }
            }
        }
        if (inWaterRaw) rawBridgeSpans.push(rawPath.length - rawBridgeStart);

        var waterFraction = rawPath.length > 0 ? waterTiles / rawPath.length : 0;

        // For land mode: validate constraints using raw path data
        if (mode === 'land') {
            var maxWF = CONFIG.ROAD_MAX_WATER_FRACTION || 0.30;
            if (waterFraction > maxWF) return null;

            var maxBridge = CONFIG.BRIDGE_MAX_WATER_TILES || 8;
            for (var bi = 0; bi < rawBridgeSpans.length; bi++) {
                if (rawBridgeSpans[bi] > maxBridge) return null;
            }
        }

        // Augment simplified path: insert waypoints at water/land boundaries
        // This ensures bridge segments align precisely with actual terrain
        var augmented = [simplified[0]];
        for (var si = 0; si < simplified.length - 1; si++) {
            var sp1 = simplified[si];
            var sp2 = simplified[si + 1];
            var segLen = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y);
            var numSamples = Math.max(2, Math.ceil(segLen / TS));
            var prevSampleWater = terrainAt(
                Math.floor(sp1.x / TS), Math.floor(sp1.y / TS)
            ) === TERRAIN.WATER.id;

            for (var ss = 1; ss <= numSamples; ss++) {
                var st = ss / numSamples;
                var sampX = sp1.x + (sp2.x - sp1.x) * st;
                var sampY = sp1.y + (sp2.y - sp1.y) * st;
                var curSampleWater = terrainAt(
                    Math.floor(sampX / TS), Math.floor(sampY / TS)
                ) === TERRAIN.WATER.id;

                if (curSampleWater !== prevSampleWater) {
                    // Terrain transition — insert boundary waypoint
                    // Place it at the midpoint between previous and current sample
                    var midT = (ss - 0.5) / numSamples;
                    augmented.push({
                        x: sp1.x + (sp2.x - sp1.x) * midT,
                        y: sp1.y + (sp2.y - sp1.y) * midT
                    });
                }
                prevSampleWater = curSampleWater;
            }
            augmented.push(sp2);
        }

        // Detect bridge segments directly on the augmented waypoint path
        var mappedBridges = [];
        var inBridgeWater = false;
        var bridgeStartIdx = 0;
        for (var ai = 0; ai < augmented.length; ai++) {
            var wp = augmented[ai];
            var wpIsWater = terrainAt(
                Math.floor(wp.x / TS), Math.floor(wp.y / TS)
            ) === TERRAIN.WATER.id;

            if (wpIsWater && !inBridgeWater) {
                // Entering water — bridge starts 1 waypoint back (slight land overhang)
                bridgeStartIdx = Math.max(0, ai - 1);
                inBridgeWater = true;
            } else if (!wpIsWater && inBridgeWater) {
                // Leaving water — bridge ends at this waypoint (slight land overhang)
                mappedBridges.push({
                    startIdx: bridgeStartIdx,
                    endIdx: Math.min(augmented.length - 1, ai)
                });
                inBridgeWater = false;
            }
        }
        if (inBridgeWater) {
            mappedBridges.push({ startIdx: bridgeStartIdx, endIdx: augmented.length - 1 });
        }

        return {
            waypoints: augmented,
            waterFraction: waterFraction,
            bridgeSegments: mappedBridges
        };
    }

    function isBuildable(tx, ty) {
        const t = terrainAt(tx, ty);
        for (const key in TERRAIN) {
            if (TERRAIN[key].id === t) return TERRAIN[key].buildable;
        }
        return false;
    }

    function worldToTile(px, py) {
        return {
            tx: Math.floor(px / CONFIG.TILE_SIZE),
            ty: Math.floor(py / CONFIG.TILE_SIZE),
        };
    }

    // ========================================================
    // §6B  KINGDOM FLAVOR TEXT GENERATION
    // ========================================================
    function generateKingdomFlavor(kingdom, rng) {
        const name = kingdom.name;
        const culture = kingdom.culture;
        const mil = kingdom.kingPersonality.militarism;
        const gen = kingdom.kingPersonality.generosity;
        const jus = kingdom.kingPersonality.justice;
        const trad = kingdom.kingPersonality.tradition;

        const openers = {
            'agricultural_peaceful': 'The ancient kingdom of ' + name + ' has tilled these lands for generations. Its people honor the harvest and live in quiet prosperity.',
            'agricultural_defensive': name + ' is a land of golden fields guarded by steadfast walls. Its farmers are proud and its soldiers vigilant.',
            'agricultural_aggressive': 'Once a peaceful farming realm, ' + name + ' has turned its plowshares into swords. Its armies march on full bellies.',
            'agricultural_warlike': name + ' feeds its war machine with the bounty of its fertile lands. Every harvest fuels another campaign.',
            'military_peaceful': 'Despite its fearsome reputation, ' + name + ' has kept the peace for a generation. Its soldiers train but rarely march.',
            'military_defensive': 'The fortress-kingdom of ' + name + ' is an impregnable bastion. Its people value discipline and duty above all.',
            'military_aggressive': 'Founded by iron-fisted warlords, ' + name + ' is a kingdom of forges and armies. Its people value strength above all.',
            'military_warlike': name + ' knows only the language of steel. Its king dreams of conquest and its people are born to fight.',
            'mercantile_peaceful': name + ' has long been the crossroads of trade. Its merchants are renowned, and its king prizes prosperity over conquest.',
            'mercantile_defensive': 'The merchant-lords of ' + name + ' protect their trade routes with well-paid guards. Gold flows freely behind strong walls.',
            'mercantile_aggressive': name + ' uses its vast wealth to fund armies and buy influence. What cannot be bought, it takes by force.',
            'mercantile_warlike': 'The war-coffers of ' + name + ' are bottomless. Its merchant-princes wage war as a business venture.',
            'industrial_peaceful': name + ' is a kingdom of smoke and innovation. Its workshops produce wonders, and its people dream of progress.',
            'industrial_defensive': 'The forges of ' + name + ' never sleep. Behind its iron walls, craftsmen build both tools and weapons.',
            'industrial_aggressive': name + ' is a kingdom of forges and ambition. Its factories arm its soldiers with the finest weapons.',
            'industrial_warlike': 'The furnaces of ' + name + ' burn day and night, forging weapons for its endless campaigns.',
        };

        const key = culture + '_' + mil;
        let text = openers[key] || (name + ' is a proud kingdom with a rich and storied history.');

        // Add detail based on other traits
        if (gen === 'generous') text += ' The crown is known for its generosity to the common folk.';
        else if (gen === 'miserly') text += ' The crown hoards its wealth jealously.';

        if (jus === 'just') text += ' Justice is swift and fair in these lands.';
        else if (jus === 'corrupt') text += ' Corruption runs deep in its courts.';

        if (trad === 'progressive') text += ' New ideas and foreign customs are welcomed.';
        else if (trad === 'traditional') text += ' Ancient customs and traditions are fiercely upheld.';

        return text;
    }

    // ========================================================
    // §7  KINGDOM GENERATION
    // ========================================================
    function generateKingdoms(rng) {
        const n = CONFIG.NUM_KINGDOMS;
        const namePool = rng.shuffle([...NAMES.kingdoms]);
        const kingdoms = [];
        for (let i = 0; i < n; i++) {
            // Generate kingdom laws
            const bannableGoods = ['swords', 'armor', 'wine', 'jewelry', 'horses', 'blasting_powder', 'demolition_tools'];
            const shuffledBannable = rng.shuffle([...bannableGoods]);
            const numBanned = rng.randInt(0, CONFIG.MAX_BANNED_GOODS);
            const bannedGoods = shuffledBannable.slice(0, numBanned);

            // Generate goods-specific taxes (1-3 goods taxed)
            const taxableGoods = ['swords', 'armor', 'wine', 'jewelry', 'horses', 'cloth', 'tools', 'salt'];
            const shuffledTaxable = rng.shuffle([...taxableGoods]);
            const numGoodsTaxed = rng.randInt(CONFIG.GOODS_TAX_COUNT_MIN, CONFIG.GOODS_TAX_COUNT_MAX);
            const goodsTaxes = {};
            for (let gt = 0; gt < numGoodsTaxed; gt++) {
                goodsTaxes[shuffledTaxable[gt]] = Math.round(rng.randFloat(CONFIG.GOODS_TAX_MIN, CONFIG.GOODS_TAX_MAX) * 1000) / 1000;
            }

            // Generate restricted goods (1-3, different from banned)
            const restrictableGoods = taxableGoods.filter(g => !bannedGoods.includes(g));
            const shuffledRestrictable = rng.shuffle([...restrictableGoods]);
            const numRestricted = rng.randInt(CONFIG.RESTRICTED_GOODS_COUNT_MIN, CONFIG.RESTRICTED_GOODS_COUNT_MAX);
            const restrictedGoods = shuffledRestrictable.slice(0, numRestricted);

            // Generate king personality
            const generosity = rng.pick(['generous', 'fair', 'miserly']);
            const militarism = rng.pick(['peaceful', 'defensive', 'aggressive', 'warlike']);
            const justice = rng.pick(['just', 'pragmatic', 'corrupt']);
            const tradition = rng.pick(['progressive', 'moderate', 'traditional']);
            let kingIcon = '👑';
            if (militarism === 'warlike' || militarism === 'aggressive') kingIcon = '⚔️';
            else if (generosity === 'generous') kingIcon = '🤲';
            else if (justice === 'just') kingIcon = '⚖️';
            else if (tradition === 'traditional') kingIcon = '📜';

            // Generate special laws (2-4 from SPECIAL_LAWS)
            const shuffledLaws = rng.shuffle([...SPECIAL_LAWS]);
            const numSpecialLaws = rng.randInt(2, 4);
            const specialLaws = shuffledLaws.slice(0, numSpecialLaws);

            const culture = rng.pick(KINGDOM_CULTURES);

            // Deep king personality dimensions
            const intelligence = rng.pick(['brilliant', 'clever', 'average', 'dim', 'foolish']);
            const temperament = rng.pick(['kind', 'fair', 'stern', 'cruel']);
            const ambition = rng.pick(['ambitious', 'content', 'lazy']);
            const greed = rng.pick(['generous', 'fair', 'greedy', 'corrupt']);
            const courage = rng.pick(['brave', 'cautious', 'cowardly']);

            kingdoms.push({
                id: uid('k'),
                name: namePool[i],
                color: CONFIG.KINGDOM_COLORS[i],
                culture: culture,
                king: null,         // filled after people generation
                kingPersonality: {
                    generosity: generosity,
                    militarism: militarism,
                    justice: justice,
                    tradition: tradition,
                    icon: kingIcon,
                    intelligence: intelligence,
                    temperament: temperament,
                    ambition: ambition,
                    greed: greed,
                    courage: courage,
                },
                gold: rng.randInt(CONFIG.KINGDOM_STARTING_TREASURY_MIN || 8000, CONFIG.KINGDOM_STARTING_TREASURY_MAX || 25000) + (culture === 'mercantile' ? 5000 : 0),
                _startingGold: 0, // set after creation
                _lastCrisisCheck: 0,
                taxRevenue: 0,
                guardBudget: rng.randFloat(0.1, 0.3),
                taxRate: rng.randFloat(0.05, 0.20),
                propertyTaxRate: rng.randFloat(CONFIG.KINGDOM_PROPERTY_TAX_MIN || 0.01, CONFIG.KINGDOM_DEFAULT_PROPERTY_TAX_RATE || 0.02),
                incomeTaxRate: rng.randFloat(CONFIG.KINGDOM_INCOME_TAX_MIN || 0.01, CONFIG.KINGDOM_DEFAULT_INCOME_TAX_RATE || 0.05),
                tradeTaxRevenue: 0,
                propertyTaxRevenue: 0,
                incomeTaxRevenue: 0,
                _lastPropertyTaxDay: 0,
                _lastIncomeTaxDay: 0,
                _lastFinancialStrategyDay: 0,
                _financialActions: [],
                _currencyDebased: false,
                _debasementInflation: 0,
                militaryStrength: 0,
                prosperity: 50,
                happiness: 50,          // kingdom-wide happiness (average of citizen happiness)
                peaceTreaties: {},       // { kingdomId: expiresDay } — forced peace treaties
                relations: {},      // filled below
                atWar: new Set(),
                alliances: new Set(),    // Formal alliance partners (mutual defense)
                succession: [],
                territories: new Set(),
                laws: {
                    bannedGoods: bannedGoods,
                    tradeTariff: rng.randFloat(CONFIG.TRADE_TARIFF_MIN, CONFIG.TRADE_TARIFF_MAX),
                    conscription: rng.chance(0.3),
                    guildRestrictions: rng.chance(0.5),
                    goodsTaxes: goodsTaxes,
                    restrictedGoods: restrictedGoods,
                    specialLaws: specialLaws,
                    freeWellWater: rng.chance(0.65), // 65% of kingdoms offer free well water
                    kingdomTransport: rng.chance(0.4), // 40% chance of public transport service
                    transportRate: rng.randInt(10, 25), // Rate charged to travelers
                },
                flavorText: '',     // filled below
                crimePunishments: {},  // filled below
                procurement: {
                    orders: [],
                    deals: [],
                    needs: {},
                    preferredMerchants: {},
                    lastAssessmentDay: 0,
                },
                militaryStockpile: { swords: 0, armor: 0, bows: 0, arrows: 0, horses: 0 },
                lastTaxIncreaseDay: 0,  // day of most recent tax increase (for tax collector job availability)
                tournament: null,       // { active, startDay, entryFee, townId } or null — king-sponsored tournament
                kingMood: { current: 'content', since: 0, reason: '' },
                kingActionLog: [],
                successionCrisis: null,
                immigrationPolicy: 'open',
                warExhaustion: 0,           // 0-100 scale, accumulates during war, recovers during peace
            });
            // Bug 5: store starting gold for crisis detection
            kingdoms[kingdoms.length - 1]._startingGold = kingdoms[kingdoms.length - 1].gold;
            kingdoms[kingdoms.length - 1]._startingTowns = 0; // updated after town assignment
        }
        for (const kingdom of kingdoms) {
            if (CONFIG.CRIME_TYPES) {
                for (const crime of CONFIG.CRIME_TYPES) {
                    const roll = rng.random();
                    if (roll < 0.3) {
                        // Harsher than default
                        if (crime.defaultPunishment === 'fine') {
                            kingdom.crimePunishments[crime.id] = { type: 'jail', jailDays: crime.defaultJailDays || 5, fine: Math.floor(crime.defaultFine * 1.5) };
                        } else if (crime.defaultPunishment === 'jail') {
                            kingdom.crimePunishments[crime.id] = { type: 'jail', jailDays: Math.floor((crime.defaultJailDays || 7) * 1.5), fine: crime.defaultFine };
                        } else {
                            kingdom.crimePunishments[crime.id] = { type: 'execution', jailDays: 0, fine: 0 };
                        }
                    } else if (roll < 0.5) {
                        // More lenient than default
                        if (crime.defaultPunishment === 'execution') {
                            kingdom.crimePunishments[crime.id] = { type: 'jail', jailDays: Math.floor((crime.defaultJailDays || 180) * 0.7), fine: crime.defaultFine };
                        } else if (crime.defaultPunishment === 'jail') {
                            kingdom.crimePunishments[crime.id] = { type: 'fine', jailDays: 0, fine: Math.floor((crime.defaultFine || 200) * 2) };
                        } else {
                            kingdom.crimePunishments[crime.id] = { type: 'fine', jailDays: 0, fine: Math.floor((crime.defaultFine || 100) * 0.7) };
                        }
                    }
                    // else: use defaults (don't store override)
                }
            }
        }
        // Generate flavor text for each kingdom
        for (const k of kingdoms) {
            k.flavorText = generateKingdomFlavor(k, rng);
        }
        // Initialize relations symmetrically
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                if (kingdoms[i].relations[kingdoms[j].id] === undefined) {
                    const val = rng.randInt(-20, 40);
                    kingdoms[i].relations[kingdoms[j].id] = val;
                    kingdoms[j].relations[kingdoms[i].id] = val;
                }
            }
        }

        // === Force interesting starting conditions ===
        // At least 2 kingdoms at war at game start
        if (n >= 2) {
            // Pick the pair with the worst relations for the first war
            let worstPair = [0, 1];
            let worstRel = 999;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const rel = kingdoms[i].relations[kingdoms[j].id] || 0;
                    if (rel < worstRel) {
                        worstRel = rel;
                        worstPair = [i, j];
                    }
                }
            }
            // Force relations below war threshold and start a war
            const warA = kingdoms[worstPair[0]];
            const warB = kingdoms[worstPair[1]];
            warA.relations[warB.id] = rng.randInt(-60, -40);
            warB.relations[warA.id] = warA.relations[warB.id];
            // Mark them at war (actual war declaration happens after world.day is set)
            warA._startWarWith = warB.id;
        }

        // At least 2 kingdoms allied at game start
        if (n >= 3) {
            // Pick two kingdoms not involved in the starting war
            const warKingdoms = new Set();
            for (const k of kingdoms) {
                if (k._startWarWith) { warKingdoms.add(k.id); warKingdoms.add(k._startWarWith); }
            }
            const nonWarKingdoms = kingdoms.filter(k => !warKingdoms.has(k.id));
            let allyA, allyB;
            if (nonWarKingdoms.length >= 2) {
                allyA = nonWarKingdoms[0];
                allyB = nonWarKingdoms[1];
            } else {
                // If not enough non-war kingdoms, pick any two that aren't fighting each other
                const available = kingdoms.filter(k => !k._startWarWith);
                if (available.length >= 2) {
                    allyA = available[0];
                    allyB = available[1];
                } else if (kingdoms.length >= 4) {
                    allyA = kingdoms[2];
                    allyB = kingdoms[3];
                }
            }
            if (allyA && allyB) {
                const allianceRel = rng.randInt(75, 90);
                allyA.relations[allyB.id] = allianceRel;
                allyB.relations[allyA.id] = allianceRel;
                allyA.alliances.add(allyB.id);
                allyB.alliances.add(allyA.id);
            }
        }

        return kingdoms;
    }

    // ========================================================
    // §8  TOWN GENERATION
    // ========================================================
    function generateTowns(rng, kingdoms, cols, rows) {
        const towns = [];
        const namePool = rng.shuffle([...NAMES.towns]);
        let nameIdx = 0;

        // Assign each kingdom a center region on the map
        const regionCenters = distributeRegions(kingdoms.length, cols, rows, rng);

        for (let ki = 0; ki < kingdoms.length; ki++) {
            const k = kingdoms[ki];
            const cx = regionCenters[ki].x;
            const cy = regionCenters[ki].y;
            const numTowns = CONFIG.TOWNS_PER_KINGDOM;

            for (let t = 0; t < numTowns; t++) {
                let px, py, tx, ty;
                let attempts = 0;
                do {
                    tx = cx + rng.randInt(-Math.floor(cols * 0.12), Math.floor(cols * 0.12));
                    ty = cy + rng.randInt(-Math.floor(rows * 0.12), Math.floor(rows * 0.12));
                    tx = Math.max(2, Math.min(cols - 3, tx));
                    ty = Math.max(2, Math.min(rows - 3, ty));
                    px = tx * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
                    py = ty * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
                    attempts++;
                } while (
                    attempts < 500 &&
                    (!isBuildable(tx, ty) || tooCloseToExisting(towns, px, py, CONFIG.TILE_SIZE * 12))
                );

                const isCapital = (t === 0);

                // Detect port status early so building generation can use terrain
                let isPort = false;
                const portProx = CONFIG.PORT_WATER_PROXIMITY || 3;
                for (let dy2 = -portProx; dy2 <= portProx && !isPort; dy2++) {
                    for (let dx2 = -portProx; dx2 <= portProx && !isPort; dx2++) {
                        const wx = tx + dx2;
                        const wy = ty + dy2;
                        if (wx >= 0 && wx < cols && wy >= 0 && wy < rows) {
                            if (world.terrain[wy * cols + wx] === TERRAIN.WATER.id) {
                                isPort = true;
                            }
                        }
                    }
                }

                // Assign population based on settlement hierarchy:
                // capital → city → town → village
                let popOverride;
                let tier;
                if (isCapital) {
                    popOverride = rng.randInt(CONFIG.CAPITAL_POP_MIN, CONFIG.CAPITAL_POP_MAX);
                    tier = 'capital';
                } else if (t === 1 && numTowns >= 3) {
                    popOverride = rng.randInt(CONFIG.CITY_POP_MIN, CONFIG.CITY_POP_MAX);
                    tier = 'city';
                } else if (t >= numTowns - 1) {
                    popOverride = rng.randInt(CONFIG.VILLAGE_POP_MIN, CONFIG.VILLAGE_POP_MAX);
                    tier = 'village';
                } else {
                    popOverride = rng.randInt(CONFIG.REGULAR_POP_MIN, CONFIG.REGULAR_POP_MAX);
                    tier = 'town';
                }

                const town = {
                    id: uid('town'),
                    name: namePool[nameIdx++] || ('Town_' + nameIdx),
                    x: px,
                    y: py,
                    kingdomId: k.id,
                    isCapital: isCapital,
                    tier: tier,
                    population: 0,  // set after people generation
                    buildings: [],  // filled below after town object exists
                    market: createMarket(1, tier),
                    prosperity: rng.randInt(40, 65),
                    walls: rng.randInt(0, 2),
                    garrison: rng.randInt(CONFIG.GARRISON_MIN, CONFIG.GARRISON_MIN + 20),
                    happiness: rng.randInt(50, 75),
                    isPort: isPort,
                    isIsland: false,
                    towers: 0,
                    livestock: { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 },
                    _popOverride: popOverride,
                };
                town.terrainType = classifyTownTerrain(town);
                computeLocalBasePrices(town);
                // Update initial market prices based on terrain
                for (const rid in town.localBasePrice) {
                    town.market.prices[rid] = town.localBasePrice[rid];
                }
                // Port towns get extra shipbuilding materials
                if (isPort) {
                    town.market.supply.wood = (town.market.supply.wood || 0) + 150;
                    town.market.supply.rope = (town.market.supply.rope || 0) + 60;
                    town.market.supply.planks = (town.market.supply.planks || 0) + 80;
                    town.market.supply.cloth = (town.market.supply.cloth || 0) + 40;
                }
                town.buildings = generateStartingBuildings(rng, town, k);
                towns.push(town);
                k.territories.add(town.id);
            }
        }

        // Port status detected inline during town creation above

        // Generate island towns (2-3)
        const islandNames = rng.shuffle([...(NAMES.islands || [])]);
        const numIslands = rng.randInt(2, 3);
        let islandsPlaced = 0;

        for (let attempt = 0; attempt < 200 && islandsPlaced < numIslands; attempt++) {
            // Find a large water area
            const sx = rng.randInt(Math.floor(cols * 0.1), Math.floor(cols * 0.9));
            const sy = rng.randInt(Math.floor(rows * 0.1), Math.floor(rows * 0.9));

            // Check if there's a cluster of water tiles (at least 5x5)
            let waterCount = 0;
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                    const cx = sx + dx;
                    const cy = sy + dy;
                    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                        if (world.terrain[cy * cols + cx] === TERRAIN.WATER.id) waterCount++;
                    }
                }
            }

            if (waterCount < 30) continue; // Need mostly water

            // Check not too close to existing towns
            const ipx = sx * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const ipy = sy * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            if (tooCloseToExisting(towns, ipx, ipy, CONFIG.TILE_SIZE * 10)) continue;

            // Create a small island: set a ~3x3 area to SAND/GRASS
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const cx = sx + dx;
                    const cy = sy + dy;
                    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                        // Ring of sand, center is grass
                        if (dx === 0 && dy === 0) {
                            world.terrain[cy * cols + cx] = TERRAIN.GRASS.id;
                        } else {
                            world.terrain[cy * cols + cx] = TERRAIN.SAND.id;
                        }
                    }
                }
            }

            // Find nearest kingdom to assign to (use region centers as fallback)
            let nearestK = kingdoms[0];
            let nearestDist = Infinity;
            for (let ki = 0; ki < kingdoms.length; ki++) {
                const k = kingdoms[ki];
                const kTowns = towns.filter(t => t.kingdomId === k.id);
                if (kTowns.length === 0) {
                    // Fallback: use region center if kingdom has no towns yet
                    if (regionCenters && regionCenters[ki]) {
                        const rcx = regionCenters[ki].x * CONFIG.TILE_SIZE;
                        const rcy = regionCenters[ki].y * CONFIG.TILE_SIZE;
                        const d = Math.hypot(rcx - ipx, rcy - ipy);
                        if (d < nearestDist) {
                            nearestDist = d;
                            nearestK = k;
                        }
                    }
                } else {
                    for (const t of kTowns) {
                        const d = Math.hypot(t.x - ipx, t.y - ipy);
                        if (d < nearestDist) {
                            nearestDist = d;
                            nearestK = k;
                        }
                    }
                }
            }

            const islandTown = {
                id: uid('town'),
                name: islandNames[islandsPlaced] || ('Island_' + islandsPlaced),
                x: ipx,
                y: ipy,
                kingdomId: nearestK.id,
                tier: 'village',
                population: 0,
                buildings: generateIslandBuildings(rng),
                market: createMarket(1, 'village'),
                prosperity: rng.randInt(30, 50),
                walls: 0,
                garrison: rng.randInt(5, 15),
                happiness: rng.randInt(55, 80),
                isPort: true,
                isIsland: true,
                towers: 0,
                livestock: { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 },
            };

            islandTown.terrainType = classifyTownTerrain(islandTown);
            computeLocalBasePrices(islandTown);
            // Update initial market prices based on terrain
            for (const rid in islandTown.localBasePrice) {
                islandTown.market.prices[rid] = islandTown.localBasePrice[rid];
            }

            // Island-specific resources
            islandTown.market.supply.fish = (islandTown.market.supply.fish || 0) + 120;
            islandTown.market.supply.salt = (islandTown.market.supply.salt || 0) + 60;
            islandTown.market.supply.pearls = (islandTown.market.supply.pearls || 0) + 15;

            towns.push(islandTown);
            nearestK.territories.add(islandTown.id);
            islandsPlaced++;
        }

        return towns;
    }

    function distributeRegions(n, cols, rows, rng) {
        // Spread kingdom centers evenly across the map
        const centers = [];
        const margin = 0.15;
        const usableW = cols * (1 - 2 * margin);
        const usableH = rows * (1 - 2 * margin);
        const offsetX = Math.floor(cols * margin);
        const offsetY = Math.floor(rows * margin);

        if (n <= 2) {
            for (let i = 0; i < n; i++) {
                centers.push({
                    x: offsetX + Math.floor(usableW * (i + 0.5) / n),
                    y: offsetY + Math.floor(usableH * 0.5),
                });
            }
        } else {
            // Arrange in a rough grid
            const gridCols = Math.ceil(Math.sqrt(n));
            const gridRows = Math.ceil(n / gridCols);
            let idx = 0;
            for (let r = 0; r < gridRows && idx < n; r++) {
                for (let c = 0; c < gridCols && idx < n; c++) {
                    centers.push({
                        x: offsetX + Math.floor(usableW * (c + 0.5) / gridCols) + rng.randInt(-5, 5),
                        y: offsetY + Math.floor(usableH * (r + 0.5) / gridRows) + rng.randInt(-5, 5),
                    });
                    idx++;
                }
            }
        }
        return centers;
    }

    function tooCloseToExisting(towns, px, py, minDist) {
        for (const t of towns) {
            const dx = t.x - px, dy = t.y - py;
            if (Math.sqrt(dx * dx + dy * dy) < minDist) return true;
        }
        return false;
    }

    function generateStartingBuildings(rng, town, kingdom) {
        const buildings = [];
        const add = (type, lvl) => buildings.push({ type, level: lvl || 1, ownerId: null });
        // Kingdom-owned buildings (military production controlled by the crown)
        const addKingdom = (type, lvl) => buildings.push({ type, level: lvl || 1, ownerId: kingdom ? kingdom.id : null });

        // Determine town wealth tier
        const wealthRoll = rng.randFloat(0, 1);
        let wealthTier; // 'rich', 'average', 'poor'
        if (wealthRoll < 0.2) { wealthTier = 'poor'; }
        else if (wealthRoll < 0.8) { wealthTier = 'average'; }
        else { wealthTier = 'rich'; }

        // Set prosperity based on wealth
        if (town) {
            if (wealthTier === 'rich') town.prosperity = rng.randInt(60, 80);
            else if (wealthTier === 'poor') town.prosperity = rng.randInt(20, 40);
            else town.prosperity = rng.randInt(40, 60);
        }

        const culture = (kingdom && kingdom.culture) || 'agricultural';

        // Determine terrain bias from town location
        let terrainBias = 'grassland'; // default
        if (town) {
            const ttx = Math.floor(town.x / CONFIG.TILE_SIZE);
            const tty = Math.floor(town.y / CONFIG.TILE_SIZE);
            const gridCols = Math.floor(CONFIG.WORLD_WIDTH / CONFIG.TILE_SIZE);
            if (world.terrain) {
                const idx = tty * gridCols + ttx;
                const t = world.terrain[idx];
                if (t === TERRAIN.MOUNTAIN.id) terrainBias = 'mountain';
                else if (t === TERRAIN.FOREST.id) terrainBias = 'forest';
                else if (t === TERRAIN.WATER.id || (town.isPort)) terrainBias = 'coastal';
            }
        }

        // Determine size category from expected population
        const expectedPop = (town && town._popOverride) || CONFIG.PEOPLE_PER_TOWN;
        let sizeCategory = getTownCategory(expectedPop);
        if (town && town.isCapital) sizeCategory = 'capital_city';

        // ================================================================
        // VILLAGE: Food-focused, minimal processing (4-6 buildings)
        // Economy: food surplus → exports food, imports tools/clothes
        // ================================================================
        if (sizeCategory === 'village') {
            // Primary: food production (always present)
            add('wheat_farm', 2);
            add('wheat_farm');
            add('bakery');
            add('chicken_farm');
            if (terrainBias === 'coastal') add('fishery');

            // Secondary: 1-2 non-food based on terrain
            if (terrainBias === 'mountain') {
                add('quarry');
                if (rng.chance(0.3)) add('iron_mine'); // raw ore, no smelter = opportunity
            } else if (terrainBias === 'forest') {
                add('lumber_camp');
                if (rng.chance(0.3)) add('hunting_lodge');
            } else if (terrainBias === 'coastal') {
                if (rng.chance(0.25)) add('salt_works');
            } else {
                // grassland
                if (rng.chance(0.5)) add('hemp_farm');
                if (rng.chance(0.4)) add('sheep_farm');
                if (rng.chance(0.3)) add('lumber_camp');
            }

            add('market_stall');

            // Wells (all settlements have at least 1)
            add('well');

        // ================================================================
        // TOWN: Mixed food + processing (8-12 buildings)
        // Economy: roughly balanced, specializes in 1-2 terrain goods
        // ================================================================
        } else if (sizeCategory === 'town') {
            // Food: moderate production
            add('wheat_farm', 2);
            add('wheat_farm');
            add('flour_mill');
            add('bakery');
            if (rng.chance(0.6)) add('chicken_farm');
            if (wealthTier !== 'poor' && rng.chance(0.4)) add('cattle_ranch');

            // Terrain-based production (2-4 buildings)
            if (terrainBias === 'mountain') {
                add('iron_mine');
                if (rng.chance(0.4)) add('smelter'); // sometimes missing = opportunity
                add('quarry');
                if (rng.chance(0.3)) add('clay_pit');
            } else if (terrainBias === 'forest') {
                add('lumber_camp');
                add('lumber_camp');
                add('sawmill');
                if (rng.chance(0.4)) add('hemp_farm');
                if (rng.chance(0.3)) add('carpenter');
            } else if (terrainBias === 'coastal') {
                add('fishery');
                if (rng.chance(0.6)) add('fishery');
                if (rng.chance(0.4)) add('salt_works'); // sometimes missing = opportunity
                add('rope_maker'); // Port towns always have rope production
                add('dock');
                add('lumber_camp'); // Port towns need wood for shipbuilding
            } else {
                // grassland
                add('sheep_farm');
                if (rng.chance(0.5)) add('cattle_ranch');
                if (rng.chance(0.4)) add('pig_farm');
                add('lumber_camp');
            }

            // Additional processing (1-2 buildings)
            if (rng.chance(0.3)) add('weaver');
            if (rng.chance(0.3)) add('tanner');
            if (rng.chance(0.2)) add('smokehouse');
            if (rng.chance(0.15)) add('string_maker');

            // Culture-based minor additions
            if (culture === 'agricultural' && rng.chance(0.4)) add('pasture');
            else if (culture === 'military' && rng.chance(0.3)) add('blacksmith');
            else if (culture === 'mercantile' && rng.chance(0.3)) add('warehouse');
            else if (culture === 'industrial') {
                if (!buildings.some(b => b.type === 'smelter') && rng.chance(0.3)) add('smelter');
                if (rng.chance(0.3)) add('toolsmith');
            }

            // Interesting imbalance: grapes but no winery
            if (terrainBias === 'grassland' && rng.chance(0.2)) add('vineyard');

            add('market_stall');
            if (wealthTier === 'rich' && rng.chance(0.5)) add('warehouse');

            // Wells and water infrastructure
            add('well');
            if (rng.chance(0.3)) add('well');
            if (terrainBias === 'coastal' && rng.chance(0.3)) add('cistern');

            // Retail (towns can have 1-2 shops)
            if (rng.chance(0.4)) add('tavern');
            if (wealthTier === 'rich' && rng.chance(0.25)) add('general_store');

        // ================================================================
        // CITY: Diverse production, limited food (14-20 buildings)
        // Economy: net food importer, net goods exporter
        // ================================================================
        } else if (sizeCategory === 'city') {
            // Food: intentionally LIMITED for population size
            add('wheat_farm', 2);
            if (wealthTier !== 'poor') add('wheat_farm');
            add('flour_mill');
            add('bakery');
            // Deliberately few food buildings — creates import demand

            // Diverse terrain-based production
            if (terrainBias === 'mountain') {
                add('iron_mine');
                add('iron_mine');
                add('smelter');
                add('quarry');
                if (rng.chance(0.4)) add('gold_mine');
                if (rng.chance(0.3)) add('clay_pit');
            } else if (terrainBias === 'forest') {
                add('lumber_camp');
                add('lumber_camp');
                add('sawmill');
                add('carpenter');
                if (rng.chance(0.4)) add('hemp_farm');
                if (rng.chance(0.3)) add('hunting_lodge');
            } else if (terrainBias === 'coastal') {
                add('fishery');
                add('fishery');
                add('salt_works');
                add('dock');
                if (rng.chance(0.4)) add('rope_maker');
                if (rng.chance(0.3)) add('pearl_diver');
            } else {
                // grassland
                add('sheep_farm');
                add('cattle_ranch');
                if (rng.chance(0.4)) add('pig_farm');
                add('lumber_camp');
                if (rng.chance(0.3)) add('pasture');
            }

            // Processing chain
            if (!buildings.some(b => b.type === 'lumber_camp') && rng.chance(0.6)) add('lumber_camp');
            if (!buildings.some(b => b.type === 'sawmill') && rng.chance(0.7)) add('sawmill');
            if (!buildings.some(b => b.type === 'smelter') && rng.chance(0.6)) add('smelter');
            add('weaver');
            add('tanner');
            if (rng.chance(0.4)) add('toolsmith');
            if (rng.chance(0.5)) add('brick_kiln');
            if (rng.chance(0.3)) add('smokehouse');
            if (!buildings.some(b => b.type === 'rope_maker') && rng.chance(0.4)) add('rope_maker');
            if (rng.chance(0.15)) add('string_maker');

            // Culture-based additions
            if (culture === 'agricultural') {
                if (rng.chance(0.5)) add('horse_ranch');
                if (rng.chance(0.4)) add('pasture');
            } else if (culture === 'military') {
                addKingdom('blacksmith');
                if (rng.chance(0.5)) addKingdom('armorer');
                if (rng.chance(0.4)) addKingdom('fletcher');
                if (rng.chance(0.3)) add('watchtower');
                if (!buildings.some(b => b.type === 'iron_mine')) add('iron_mine');
                if (!buildings.some(b => b.type === 'smelter')) add('smelter');
            } else if (culture === 'mercantile') {
                add('warehouse');
                if (rng.chance(0.5)) add('vineyard');
            } else if (culture === 'industrial') {
                if (!buildings.some(b => b.type === 'iron_mine')) add('iron_mine');
                if (!buildings.some(b => b.type === 'smelter')) add('smelter');
                if (!buildings.some(b => b.type === 'sawmill')) add('sawmill');
                if (rng.chance(0.5)) add('brick_kiln');
                if (rng.chance(0.4)) add('toolsmith');
            }

            // Luxury buildings (30% chance each)
            if (rng.chance(0.3)) add('winery');
            if (rng.chance(0.3)) add('jeweler');
            if (rng.chance(0.3)) add('tailor');

            add('market_stall');
            add('market_stall');
            if (wealthTier === 'rich') {
                if (rng.chance(0.5)) add('warehouse');
                if (rng.chance(0.4)) add('saddler');
                if (rng.chance(0.3)) add('carpenter');
            }

            // Wells and water (cities need multiple)
            add('well');
            add('well');
            if (rng.chance(0.5)) add('cistern');
            if (rng.chance(0.3)) add('brewery');

            // Retail buildings (cities have shops)
            if (rng.chance(0.6)) add('tavern');
            if (rng.chance(0.4)) add('restaurant');
            if (rng.chance(0.35)) add('general_store');
            if (rng.chance(0.25)) add('clothing_shop');
            if (rng.chance(0.2)) add('clinic');

        // ================================================================
        // CAPITAL CITY: Luxury + military focus, food deficit (20-30 buildings)
        // Economy: highest demand, food importer, luxury/military exporter
        // ================================================================
        } else {
            // Food: MINIMAL for huge population — significant food deficit
            add('wheat_farm', 2);
            add('flour_mill');
            add('bakery');

            // Military production (kingdom-owned, guaranteed)
            addKingdom('blacksmith');
            addKingdom('armorer');
            addKingdom('fletcher');
            addKingdom('arrow_maker');
            addKingdom('barracks');
            addKingdom('watchtower');

            // Iron production chain (guaranteed)
            add('iron_mine');
            add('smelter');

            // Terrain-based
            if (terrainBias === 'mountain') {
                add('iron_mine');
                add('quarry');
                if (rng.chance(0.4)) add('gold_mine');
            } else if (terrainBias === 'forest') {
                add('lumber_camp');
                add('lumber_camp');
                add('sawmill');
            } else if (terrainBias === 'coastal') {
                add('fishery');
                add('dock');
                if (rng.chance(0.3)) add('pearl_diver');
            } else {
                // grassland
                add('sheep_farm');
                add('lumber_camp');
                if (rng.chance(0.3)) add('cattle_ranch');
            }

            // Processing
            if (!buildings.some(b => b.type === 'lumber_camp') && rng.chance(0.6)) add('lumber_camp');
            if (!buildings.some(b => b.type === 'sawmill')) add('sawmill');
            add('weaver');
            add('tanner');
            if (!buildings.some(b => b.type === 'brick_kiln')) add('brick_kiln');
            if (rng.chance(0.5)) add('toolsmith');
            if (rng.chance(0.3)) add('smokehouse');

            // Luxury (guaranteed base + random extras)
            add('jeweler');
            add('winery');
            if (rng.chance(0.6)) add('silk_weaver');
            if (rng.chance(0.5)) add('fine_tailor');
            if (rng.chance(0.4)) add('goldsmith');
            if (rng.chance(0.3)) add('tapestry_loom');
            if (rng.chance(0.3)) add('instrument_workshop');

            // Culture-based
            if (culture === 'agricultural') {
                if (rng.chance(0.5)) add('horse_ranch');
                if (rng.chance(0.4)) add('pasture');
            } else if (culture === 'mercantile') {
                add('warehouse');
                if (rng.chance(0.5)) add('vineyard');
                if (!buildings.some(b => b.type === 'tailor') && rng.chance(0.3)) add('tailor');
            } else if (culture === 'industrial') {
                if (!buildings.some(b => b.type === 'sawmill')) add('sawmill');
                if (rng.chance(0.5)) add('clay_pit');
                if (rng.chance(0.4)) add('rope_maker');
            }

            add('market_stall');
            add('market_stall');
            add('warehouse');
            if (wealthTier === 'rich') {
                if (rng.chance(0.5)) add('saddler');
                if (rng.chance(0.4)) add('carpenter');
            }

            // Wells and water (capitals have the most)
            add('well');
            add('well');
            add('well');
            add('cistern');
            if (rng.chance(0.6)) add('brewery');

            // Retail buildings (capitals always have shops)
            add('tavern');
            if (rng.chance(0.7)) add('restaurant');
            if (rng.chance(0.6)) add('general_store');
            if (rng.chance(0.5)) add('clothing_shop');
            if (rng.chance(0.4)) add('armory_shop');
            if (rng.chance(0.35)) add('jewelers_boutique');
            if (rng.chance(0.4)) add('clinic');
            if (rng.chance(0.25)) add('bathhouse');

            // Banned goods production — kingdom owns the facilities in capital
            if (kingdom && kingdom.laws && kingdom.laws.bannedGoods) {
                const bannedGoods = kingdom.laws.bannedGoods;
                const bannedBuildingMap = {
                    'swords': 'blacksmith',
                    'armor': 'armorer',
                    'wine': 'winery',
                    'jewelry': 'jeweler',
                    'horses': 'horse_breeder'
                };
                for (let bi = 0; bi < bannedGoods.length; bi++) {
                    const buildingType = bannedBuildingMap[bannedGoods[bi]];
                    if (buildingType) {
                        const alreadyExists = buildings.some(function(b) { return b.type === buildingType; });
                        if (!alreadyExists) {
                            buildings.push({
                                type: buildingType,
                                level: 2,
                                ownerId: kingdom.id,
                                workers: [],
                                builtDay: -rng.randInt(30, 180),
                                condition: rng.randInt(70, 100),
                                bannedGoodsProducer: true
                            });
                        }
                    }
                }

                // Kingdom has some banned goods stockpiled in capital
                if (town && town.market && town.market.supply) {
                    for (let bsi = 0; bsi < bannedGoods.length; bsi++) {
                        const bg = bannedGoods[bsi];
                        town.market.supply[bg] = (town.market.supply[bg] || 0) + rng.randInt(5, 15);
                    }
                }
            }
        }

        // Assign natural deposits
        if (town) {
            town.naturalDeposits = {};
            town.soilFertility = 1.0;
            const depRng = rng;
            const ND = CONFIG.NATURAL_DEPOSITS;
            if (terrainBias === 'mountain') {
                town.naturalDeposits.iron_ore = depRng.randInt(ND.iron_ore.min, ND.iron_ore.max);
                town.naturalDeposits.gold_ore = depRng.randInt(ND.gold_ore.min, ND.gold_ore.max);
                town.naturalDeposits.stone = depRng.randInt(ND.stone.min, ND.stone.max);
            } else if (terrainBias === 'forest') {
                town.naturalDeposits.wood = depRng.randInt(ND.wood.min, ND.wood.max);
            } else if (terrainBias === 'coastal') {
                town.naturalDeposits.fish = depRng.randInt(ND.fish.min, ND.fish.max);
                town.naturalDeposits.salt = depRng.randInt(ND.salt.min, ND.salt.max);
            }
            // All towns can have clay
            town.naturalDeposits.clay = depRng.randInt(ND.clay.min, ND.clay.max);

            // Wildlife abundance — affects hunting lodge output
            // Forest and hills have most wildlife, grassland moderate, mountain/coastal less
            if (terrainBias === 'forest') {
                town.wildlifeAbundance = 1.2 + depRng.random() * 0.6; // 1.2-1.8
            } else if (terrainBias === 'mountain') {
                town.wildlifeAbundance = 0.3 + depRng.random() * 0.4; // 0.3-0.7
            } else if (terrainBias === 'coastal') {
                town.wildlifeAbundance = 0.4 + depRng.random() * 0.4; // 0.4-0.8
            } else {
                // grassland/plains
                town.wildlifeAbundance = 0.7 + depRng.random() * 0.6; // 0.7-1.3
            }
        }

        return buildings;
    }

    function seedMarketFromBuildings(town) {
        const cat = town.category || getTownCategory(town.population);

        // Reset all supply — rebuild based on buildings and town category
        for (const key in RESOURCE_TYPES) {
            town.market.supply[RESOURCE_TYPES[key].id] = 0;
        }

        // Add supply from local building production
        for (const building of town.buildings) {
            const bt = findBuildingType(building.type);
            if (bt && bt.produces) {
                town.market.supply[bt.produces] = (town.market.supply[bt.produces] || 0) + bt.rate * 10 * (building.level || 1);
            }
        }

        // Category-specific market seeding — creates natural trade incentives
        if (cat === 'village') {
            // Villages: food SURPLUS — cheap food drives exports to cities
            town.market.supply.wheat = Math.max(town.market.supply.wheat, town.population * 6);
            town.market.supply.bread = Math.max(town.market.supply.bread, town.population * 4);
            town.market.supply.eggs  = Math.max(town.market.supply.eggs,  town.population * 3);
        } else if (cat === 'town') {
            // Towns: moderate food + processed goods
            town.market.supply.wheat = Math.max(town.market.supply.wheat, town.population * 3);
            town.market.supply.bread = Math.max(town.market.supply.bread, town.population * 2);
            town.market.supply.eggs  = Math.max(town.market.supply.eggs,  town.population);
        } else if (cat === 'city') {
            // Cities: diverse goods, LIMITED food → must import
            town.market.supply.wheat = Math.max(town.market.supply.wheat, town.population);
            town.market.supply.bread = Math.max(town.market.supply.bread, Math.round(town.population * 0.5));
        } else if (cat === 'capital_city') {
            // Capitals: luxury & military goods, food SCARCITY → heavy import dependency
            town.market.supply.wheat = Math.max(town.market.supply.wheat, Math.round(town.population * 0.5));
            town.market.supply.bread = Math.max(town.market.supply.bread, Math.round(town.population * 0.3));
            // Seed luxury and military goods
            town.market.supply.wine    = Math.max(town.market.supply.wine    || 0, 30);
            town.market.supply.jewelry = Math.max(town.market.supply.jewelry || 0, 10);
            town.market.supply.swords  = Math.max(town.market.supply.swords  || 0, 20);
            town.market.supply.armor   = Math.max(town.market.supply.armor   || 0, 10);
            town.market.supply.arrows  = Math.max(town.market.supply.arrows  || 0, 40);
        }

        // Boost supply for towns with production chain buildings
        const buildingSupplyBoost = {
            'sawmill': { planks: 30 },
            'smelter': { iron: 20 },
            'brick_kiln': { bricks: 25 },
            'weaver': { cloth: 20 },
            'rope_maker': { rope: 15 },
            'tanner': { leather: 15 },
            'blacksmith': { swords: 5, tools: 10 },
            'armorer': { armor: 5 },
            'winery': { wine: 15 },
            'jeweler': { jewelry: 3 },
            'tailor': { clothes: 15 },
            'brewery': { ale: 20 },
            'carpenter': { furniture: 10 },
            'smokehouse': { preserved_food: 15 },
        };

        const popScale = Math.max(town.population / 100, 0.3);
        for (let bIdx = 0; bIdx < (town.buildings || []).length; bIdx++) {
            const bld = town.buildings[bIdx];
            const boosts = buildingSupplyBoost[bld.type];
            if (boosts) {
                for (const resId in boosts) {
                    town.market.supply[resId] = (town.market.supply[resId] || 0) + Math.round(boosts[resId] * popScale);
                }
            }
        }
    }

    function createMarket(popScale, tier) {
        const supply = {}, demand = {}, prices = {};
        for (const key in RESOURCE_TYPES) {
            const r = RESOURCE_TYPES[key];
            supply[r.id] = 0;
            demand[r.id] = 0;
            prices[r.id] = r.basePrice;
        }
        // Starting reserves scaled by population (popScale = population / 100, default 1)
        const s = popScale || 1;
        const t = tier || 'town';

        // Base staples (all settlements)
        supply.wheat = Math.round(600 * s);
        supply.wood = Math.round(100 * s);
        supply.stone = Math.round(50 * s);
        supply.bread = Math.round(250 * s);
        supply.flour = Math.round(100 * s);
        supply.meat = Math.round(80 * s);
        supply.eggs = Math.round(40 * s);
        // Water & beverages — all towns have some water from wells
        supply.water = Math.round(200 * s);
        supply.ale = Math.round(30 * s);
        supply.honey = Math.round(10 * s);
        // Garden produce
        supply.herbs = Math.round(15 * s);
        supply.vegetables = Math.round(25 * s);

        // Building materials — scaled by town size
        supply.planks = Math.round((t === 'capital' ? 120 : t === 'city' ? 80 : t === 'town' ? 40 : 15) * s);
        supply.iron = Math.round((t === 'capital' ? 60 : t === 'city' ? 35 : t === 'town' ? 15 : 5) * s);
        supply.bricks = Math.round((t === 'capital' ? 80 : t === 'city' ? 50 : t === 'town' ? 20 : 0) * s);
        supply.cloth = Math.round((t === 'capital' ? 70 : t === 'city' ? 45 : t === 'town' ? 20 : 8) * s);
        supply.rope = Math.round((t === 'capital' ? 40 : t === 'city' ? 25 : t === 'town' ? 10 : 3) * s);
        supply.tools = Math.round((t === 'capital' ? 50 : t === 'city' ? 30 : t === 'town' ? 15 : 5) * s);
        supply.wool = Math.round((t === 'capital' ? 40 : t === 'city' ? 25 : t === 'town' ? 10 : 5) * s);

        // Additional goods for cities and capitals
        if (t === 'city' || t === 'capital') {
            supply.salt = Math.round((t === 'capital' ? 40 : 25) * s);
            supply.leather = Math.round((t === 'capital' ? 30 : 15) * s);
            supply.furniture = Math.round((t === 'capital' ? 20 : 10) * s);
            supply.clothes = Math.round((t === 'capital' ? 40 : 20) * s);
            supply.preserved_food = Math.round((t === 'capital' ? 50 : 25) * s);
        }

        // Weapons and armor for cities and capitals (minor amounts)
        if (t === 'city' || t === 'capital') {
            supply.swords = Math.round((t === 'capital' ? 25 : 10) * s);
            supply.armor = Math.round((t === 'capital' ? 15 : 6) * s);
            supply.arrows = Math.round((t === 'capital' ? 40 : 20) * s);
        }

        // Luxury goods for capitals
        if (t === 'capital') {
            supply.wine = Math.round(30 * s);
            supply.jewelry = Math.round(8 * s);
            supply.silk = Math.round(10 * s);
        }

        return { supply, demand, prices };
    }

    function generateIslandBuildings(rng) {
        const buildings = [];
        const add = (type, lvl) => buildings.push({ type, level: lvl || 1, ownerId: null });
        // Islands have smaller, port-focused economies
        add('dock');
        add('fishery');
        add('fishery');
        add('salt_works');
        add('wheat_farm');
        add('wheat_farm');
        add('bakery');
        add('market_stall');
        if (rng.chance(0.5)) add('lumber_camp');
        if (rng.chance(0.3)) add('jeweler'); // pearls → jewelry
        return buildings;
    }

    // ========================================================
    // §9B SEA ROUTE GENERATION
    // ========================================================
    function generateSeaRoutes(rng, towns) {
        const seaRoutes = [];
        const connected = new Set();
        const portTowns = towns.filter(t => t.isPort);
        const maxDist = CONFIG.SEA_ROUTE_MAX_DISTANCE || 3000;

        for (let i = 0; i < portTowns.length; i++) {
            for (let j = i + 1; j < portTowns.length; j++) {
                const a = portTowns[i];
                const b = portTowns[j];
                // Enforce per-town route limits (counts roads + sea routes)
                if (townAtRouteLimit(a) || townAtRouteLimit(b)) continue;
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist > maxDist) continue;

                // Use A* pathfinding for sea route
                const pathResult = findTerrainPath(a.x, a.y, b.x, b.y, 'sea');
                if (!pathResult) continue;
                if (pathResult.waterFraction < (CONFIG.SEA_ROUTE_MIN_WATER_FRACTION || 0.95)) continue;

                const key = [a.id, b.id].sort().join('-');
                if (connected.has(key)) continue;
                connected.add(key);
                a.routeCount = (a.routeCount || 0) + 1;
                b.routeCount = (b.routeCount || 0) + 1;

                seaRoutes.push({
                    fromTownId: a.id,
                    toTownId: b.id,
                    type: 'sea',
                    distance: dist,
                    safe: true,
                    waypoints: pathResult.waypoints,
                });
            }
        }

        // Ensure ALL port towns have at least one sea route (not just islands)
        for (const port of portTowns) {
            const hasRoute = seaRoutes.some(r =>
                r.fromTownId === port.id || r.toTownId === port.id
            );
            if (!hasRoute) {
                // Connect to nearest port that already has a route (prefer connected), else nearest port
                let nearest = null;
                let nearDist = Infinity;
                const connectedPorts = portTowns.filter(p => p.id !== port.id && seaRoutes.some(r => r.fromTownId === p.id || r.toTownId === p.id));
                const candidates = connectedPorts.length > 0 ? connectedPorts : portTowns.filter(p => p.id !== port.id);
                for (const p of candidates) {
                    const d = Math.hypot(p.x - port.x, p.y - port.y);
                    if (d < nearDist) {
                        nearDist = d;
                        nearest = p;
                    }
                }
                if (nearest) {
                    const key = [port.id, nearest.id].sort().join('-');
                    if (!connected.has(key)) {
                        connected.add(key);
                        const seaPath = findTerrainPath(port.x, port.y, nearest.x, nearest.y, 'sea');
                        seaRoutes.push({
                            fromTownId: port.id,
                            toTownId: nearest.id,
                            type: 'sea',
                            distance: nearDist,
                            safe: true,
                            waypoints: seaPath ? seaPath.waypoints : [],
                        });
                    }
                }
            }
        }

        return seaRoutes;
    }

    function checkWaterPath(x1, y1, x2, y2) {
        // Sample tiles along the line and check what fraction is water
        const steps = 20;
        let waterCount = 0;
        for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            const tx = Math.floor(px / CONFIG.TILE_SIZE);
            const ty = Math.floor(py / CONFIG.TILE_SIZE);
            if (terrainAt(tx, ty) === TERRAIN.WATER.id) waterCount++;
        }
        return waterCount / (steps - 1);
    }

    // Analyze water tiles along a road path; returns { waterFraction, waterTileCount, bridgeSegments }
    function analyzeRoadWater(ax, ay, bx, by) {
        const steps = 40;
        let waterCount = 0;
        const bridgeSegments = [];
        let inWater = false;
        let segStart = 0;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = ax + (bx - ax) * t;
            const py = ay + (by - ay) * t;
            const tx = Math.floor(px / CONFIG.TILE_SIZE);
            const ty = Math.floor(py / CONFIG.TILE_SIZE);
            const isWater = terrainAt(tx, ty) === TERRAIN.WATER.id;
            if (isWater) {
                waterCount++;
                if (!inWater) { segStart = t; inWater = true; }
            } else {
                if (inWater) {
                    bridgeSegments.push({ startT: segStart, endT: t });
                    inWater = false;
                }
            }
        }
        if (inWater) bridgeSegments.push({ startT: segStart, endT: 1.0 });
        return { waterFraction: waterCount / (steps + 1), waterTileCount: waterCount, bridgeSegments };
    }

    // Compute terrain-aware off-road travel cost between two pixel positions
    function getOffroadCost(ax, ay, bx, by) {
        const steps = 30;
        let totalCost = 0;
        let passable = true;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = ax + (bx - ax) * t;
            const py = ay + (by - ay) * t;
            const tx = Math.floor(px / CONFIG.TILE_SIZE);
            const ty = Math.floor(py / CONFIG.TILE_SIZE);
            const terrain = terrainAt(tx, ty);
            if (terrain === TERRAIN.WATER.id) { passable = false; break; }
            else if (terrain === TERRAIN.MOUNTAIN.id) totalCost += 12.5;  // 1/0.08
            else if (terrain === TERRAIN.FOREST.id) totalCost += 6.67;    // 1/0.15
            else if (terrain === TERRAIN.HILLS.id) totalCost += 5.0;      // 1/0.20
            else if (terrain === TERRAIN.SAND.id) totalCost += 4.0;       // 1/0.25
            else totalCost += 2.86;                                        // grassland 1/0.35
        }
        if (!passable) return null;
        return totalCost / (steps + 1);
    }

    // Return dominant terrain type along a path (for off-road discovery events)
    function getDominantTerrain(ax, ay, bx, by) {
        const steps = 20;
        const counts = {};
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const px = ax + (bx - ax) * t;
            const py = ay + (by - ay) * t;
            const tx = Math.floor(px / CONFIG.TILE_SIZE);
            const ty = Math.floor(py / CONFIG.TILE_SIZE);
            const terrain = terrainAt(tx, ty);
            counts[terrain] = (counts[terrain] || 0) + 1;
        }
        let maxId = TERRAIN.GRASS.id, maxCount = 0;
        for (const id in counts) {
            if (counts[id] > maxCount) { maxCount = counts[id]; maxId = parseInt(id); }
        }
        return maxId;
    }

    // ========================================================
    // §8b  ROAD IMPORTANCE SCORING
    // ========================================================
    function computeRoadImportance(townA, townB) {
        if (!townA || !townB) return 0;
        var score = 0;
        // Population: bigger towns = more important roads
        score += (townA.population || 0) * 0.02 + (townB.population || 0) * 0.02;
        // Prosperity: wealthier towns generate more trade traffic
        score += ((townA.prosperity || 0) + (townB.prosperity || 0)) * 0.3;
        // Capital bonus: connecting to a capital is strategically vital
        if (townA.isCapital) score += 30;
        if (townB.isCapital) score += 30;
        // City/town tier bonus
        var tierBonus = { village: 0, town: 5, city: 15, capital_city: 25 };
        score += (tierBonus[townA.tier] || 0) + (tierBonus[townB.tier] || 0);
        // Cross-kingdom: border roads are strategically important
        if (townA.kingdomId && townB.kingdomId && townA.kingdomId !== townB.kingdomId) {
            score += 20;
            // Extra importance if kingdoms are at war
            var kA = findKingdom(townA.kingdomId);
            if (kA && kA.atWar && kA.atWar.has(townB.kingdomId)) score += 40;
        }
        // Port bonus: connecting ports is important for trade
        if (townA.isPort || townB.isPort) score += 10;
        // Distance penalty: very long roads are less attractive to build
        var dist = Math.hypot((townA.x || 0) - (townB.x || 0), (townA.y || 0) - (townB.y || 0));
        score -= dist * 0.005;
        return Math.max(0, score);
    }

    // ========================================================
    // §8c  ARMY INTELLIGENT ROUTING (Dijkstra over town graph)
    // ========================================================
    function findArmyRoute(fromTownId, toTownId) {
        var fromTown = findTown(fromTownId);
        var toTown = findTown(toTownId);
        if (!fromTown || !toTown) return null;

        var baseSpeed = CONFIG.CARAVAN_BASE_SPEED * 0.5;
        var roadMult = CONFIG.ARMY_ROAD_SPEED_MULT || 1.0;
        var offroadMult = CONFIG.ARMY_OFFROAD_SPEED_MULT || 0.3;
        var seaMult = CONFIG.ARMY_SEA_SPEED_MULT || 0.6;
        var maxOffroadRange = CONFIG.ARMY_MAX_OFFROAD_RANGE || 4000;

        // Build weighted graph: edges are {to, dist, type, travelTime}
        var graph = {};
        var allTowns = world.towns.filter(function(t) { return !t.destroyed && !t.abandoned; });
        for (var ti = 0; ti < allTowns.length; ti++) {
            graph[allTowns[ti].id] = [];
        }

        // Road edges (fastest)
        for (var ri = 0; ri < world.roads.length; ri++) {
            var road = world.roads[ri];
            if (road.condition === 'destroyed') continue;
            var rFrom = findTown(road.fromTownId);
            var rTo = findTown(road.toTownId);
            if (!rFrom || !rTo) continue;
            var rDist = Math.hypot(rTo.x - rFrom.x, rTo.y - rFrom.y);
            var rTime = rDist / (baseSpeed * roadMult);
            if (graph[road.fromTownId]) graph[road.fromTownId].push({ to: road.toTownId, dist: rDist, type: 'road', time: rTime });
            if (graph[road.toTownId]) graph[road.toTownId].push({ to: road.fromTownId, dist: rDist, type: 'road', time: rTime });
        }

        // Sea route edges (need ports)
        for (var si = 0; si < world.seaRoutes.length; si++) {
            var sr = world.seaRoutes[si];
            var sFrom = findTown(sr.fromTownId || sr.from);
            var sTo = findTown(sr.toTownId || sr.to);
            if (!sFrom || !sTo) continue;
            var sDist = Math.hypot(sTo.x - sFrom.x, sTo.y - sFrom.y);
            var sTime = sDist / (baseSpeed * seaMult);
            var sFromId = sr.fromTownId || sr.from;
            var sToId = sr.toTownId || sr.to;
            if (graph[sFromId]) graph[sFromId].push({ to: sToId, dist: sDist, type: 'sea', time: sTime });
            if (graph[sToId]) graph[sToId].push({ to: sFromId, dist: sDist, type: 'sea', time: sTime });
        }

        // Offroad edges: nearby towns reachable by land (slow but always available)
        for (var ai = 0; ai < allTowns.length; ai++) {
            var tA = allTowns[ai];
            for (var bi = ai + 1; bi < allTowns.length; bi++) {
                var tB = allTowns[bi];
                var oDist = Math.hypot(tB.x - tA.x, tB.y - tA.y);
                if (oDist > maxOffroadRange) continue;
                // Check if already have a road/sea edge (skip offroad for those)
                var hasDirectEdge = false;
                if (graph[tA.id]) {
                    for (var ei = 0; ei < graph[tA.id].length; ei++) {
                        if (graph[tA.id][ei].to === tB.id) { hasDirectEdge = true; break; }
                    }
                }
                if (hasDirectEdge) continue;
                // Check terrain passability (no water crossing)
                var offroadCost = getOffroadCost(tA.x, tA.y, tB.x, tB.y);
                if (offroadCost === null) continue; // water blocking
                var oTime = oDist / (baseSpeed * offroadMult);
                if (graph[tA.id]) graph[tA.id].push({ to: tB.id, dist: oDist, type: 'offroad', time: oTime });
                if (graph[tB.id]) graph[tB.id].push({ to: tA.id, dist: oDist, type: 'offroad', time: oTime });
            }
        }

        // Dijkstra
        var dist = {};
        var prev = {};
        var edgeUsed = {};
        var visited = {};
        dist[fromTownId] = 0;

        // Simple priority queue (array-based for simplicity)
        var pq = [{ id: fromTownId, time: 0 }];

        while (pq.length > 0) {
            // Extract min
            var minIdx = 0;
            for (var pi = 1; pi < pq.length; pi++) {
                if (pq[pi].time < pq[minIdx].time) minIdx = pi;
            }
            var cur = pq.splice(minIdx, 1)[0];
            if (visited[cur.id]) continue;
            visited[cur.id] = true;

            if (cur.id === toTownId) break;

            var edges = graph[cur.id] || [];
            for (var ej = 0; ej < edges.length; ej++) {
                var edge = edges[ej];
                if (visited[edge.to]) continue;
                var newTime = cur.time + edge.time;
                if (dist[edge.to] === undefined || newTime < dist[edge.to]) {
                    dist[edge.to] = newTime;
                    prev[edge.to] = cur.id;
                    edgeUsed[edge.to] = edge;
                    pq.push({ id: edge.to, time: newTime });
                }
            }
        }

        // Reconstruct path
        if (dist[toTownId] === undefined) return null; // No route found
        var route = [];
        var cur = toTownId;
        while (cur !== fromTownId) {
            var edge = edgeUsed[cur];
            route.unshift({
                from: prev[cur],
                to: cur,
                type: edge.type,
                dist: edge.dist,
                time: edge.time
            });
            cur = prev[cur];
            if (!cur) return null; // broken path
        }
        return {
            legs: route,
            totalTime: dist[toTownId],
            totalDist: route.reduce(function(s, l) { return s + l.dist; }, 0)
        };
    }

    // Get the current world position of an army following a multi-leg route
    function getArmyWorldPosition(army) {
        if (!army.route || !army.route.legs || army.route.legs.length === 0) {
            // Legacy fallback: straight-line interpolation
            var fromT = findTown(army.fromTownId);
            var toT = findTown(army.toTownId);
            if (!fromT || !toT) return { x: 0, y: 0 };
            return {
                x: fromT.x + (toT.x - fromT.x) * (army.progress || 0),
                y: fromT.y + (toT.y - fromT.y) * (army.progress || 0)
            };
        }
        var legIdx = army.legIndex || 0;
        if (legIdx >= army.route.legs.length) legIdx = army.route.legs.length - 1;
        var leg = army.route.legs[legIdx];
        var legFrom = findTown(leg.from);
        var legTo = findTown(leg.to);
        if (!legFrom || !legTo) return { x: 0, y: 0 };
        var legProg = army.legProgress || 0;
        return {
            x: legFrom.x + (legTo.x - legFrom.x) * legProg,
            y: legFrom.y + (legTo.y - legFrom.y) * legProg
        };
    }
    function getMaxRoutes(town) {
        const tierKey = 'MAX_ROUTES_' + (town.tier || 'town').toUpperCase();
        const base = CONFIG[tierKey] || 6;
        return town.isPort ? base + (CONFIG.MAX_ROUTES_PORT_BONUS || 2) : base;
    }

    function townAtRouteLimit(town) {
        return (town.routeCount || 0) >= getMaxRoutes(town);
    }

    // ========================================================
    // §9b ROAD GENERATION
    // ========================================================
    function generateRoads(rng, towns, kingdoms) {
        const roads = [];
        const connected = new Set();

        function dist(a, b) {
            const dx = a.x - b.x, dy = a.y - b.y;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function addRoad(a, b, skipLimitCheck) {
            if (a.isIsland || b.isIsland) return false;
            // Enforce per-town route limits (skip for fallback connectivity)
            if (!skipLimitCheck) {
                if (townAtRouteLimit(a) || townAtRouteLimit(b)) return false;
            }
            const key = [a.id, b.id].sort().join('-');
            if (connected.has(key)) return false;

            // A* pathfinding for land route
            const pathResult = findTerrainPath(a.x, a.y, b.x, b.y, 'land');
            if (!pathResult) return false;

            connected.add(key);
            a.routeCount = (a.routeCount || 0) + 1;
            b.routeCount = (b.routeCount || 0) + 1;
            const hasBridge = pathResult.bridgeSegments.length > 0;
            roads.push({
                fromTownId: a.id,
                toTownId: b.id,
                quality: rng.randInt(1, 3),
                safe: true,
                hasBridge: hasBridge,
                bridgeDestroyed: false,
                bridgeSegments: hasBridge ? pathResult.bridgeSegments : [],
                waypoints: pathResult.waypoints,
            });
            return true;
        }

        // Connect each town to its nearest in-kingdom neighbor
        for (const k of kingdoms) {
            const kTowns = towns.filter(t => t.kingdomId === k.id);
            for (const t of kTowns) {
                const nearest = kTowns
                    .filter(o => o.id !== t.id)
                    .sort((a, b) => dist(t, a) - dist(t, b))[0];
                if (nearest) addRoad(t, nearest);
            }
            // Ensure all kingdom towns form a connected graph (MST-like)
            if (kTowns.length > 2) {
                const sorted = kTowns.slice().sort((a, b) => dist(a, kTowns[0]) - dist(b, kTowns[0]));
                for (let i = 1; i < sorted.length; i++) {
                    addRoad(sorted[i - 1], sorted[i]);
                }
            }
        }

        // Cross-kingdom roads: connect nearest towns across borders (skip water-heavy)
        const crossPairs = [];
        for (let i = 0; i < towns.length; i++) {
            for (let j = i + 1; j < towns.length; j++) {
                if (towns[i].kingdomId !== towns[j].kingdomId) {
                    crossPairs.push({ a: towns[i], b: towns[j], d: dist(towns[i], towns[j]) });
                }
            }
        }
        crossPairs.sort((a, b) => a.d - b.d);
        let crossAdded = 0;
        for (let i = 0; i < crossPairs.length && crossAdded < CONFIG.NUM_ROADS_EXTRA; i++) {
            if (addRoad(crossPairs[i].a, crossPairs[i].b)) crossAdded++;
        }

        // Ensure every non-island town has at least one road (islands use sea routes)
        // Skip route limit check — connectivity is more important than caps
        for (const t of towns) {
            if (t.isIsland) continue;
            const hasRoad = roads.some(r => r.fromTownId === t.id || r.toTownId === t.id);
            if (!hasRoad) {
                // Try nearest towns, skip if all cross too much water
                const candidates = towns
                    .filter(o => o.id !== t.id && !o.isIsland)
                    .sort((a, b) => dist(t, a) - dist(t, b));
                for (const cand of candidates) {
                    if (addRoad(t, cand, true)) break;
                }
            }
        }

        return roads;
    }

    // ========================================================
    // §10 PERSON GENERATION
    // ========================================================
    function assignRandomQuirks(rng) {
        if (typeof SPOUSE_QUIRKS === 'undefined' || !SPOUSE_QUIRKS.length) return [];
        var n = rng.randInt(1, 2);
        var shuffled = SPOUSE_QUIRKS.slice();
        rng.shuffle(shuffled);
        return shuffled.slice(0, n).map(function(q) { return q.id; });
    }

    function generatePeople(rng, towns, kingdoms) {
        const people = [];
        const occupationWeights = [
            { occ: 'farmer',     w: 0.40 },
            { occ: 'laborer',    w: 0.15 },
            { occ: 'soldier',    w: 0.10 },
            { occ: 'craftsman',  w: 0.10 },
            { occ: 'merchant',   w: 0.05 },
            { occ: 'miner',      w: 0.05 },
            { occ: 'woodcutter', w: 0.05 },
            { occ: 'guard',      w: 0.05 },
            { occ: 'none',       w: 0.05 },
        ];

        function pickOccupation() {
            let r = rng.random();
            for (const o of occupationWeights) {
                r -= o.w;
                if (r <= 0) return o.occ;
            }
            return 'laborer';
        }

        function skillsForOccupation(occ) {
            const s = { farming: 5, mining: 5, crafting: 5, trading: 5, combat: 5 };
            switch (occ) {
                case 'farmer': s.farming = rng.randInt(30, 70); break;
                case 'miner': s.mining = rng.randInt(30, 70); break;
                case 'woodcutter': s.farming = rng.randInt(20, 50); s.crafting = rng.randInt(10, 30); break;
                case 'craftsman': s.crafting = rng.randInt(30, 70); break;
                case 'merchant': s.trading = rng.randInt(30, 70); break;
                case 'soldier': s.combat = rng.randInt(30, 70); break;
                case 'guard': s.combat = rng.randInt(25, 60); break;
                case 'laborer': s.farming = rng.randInt(10, 30); s.mining = rng.randInt(10, 30); break;
                case 'noble': s.trading = rng.randInt(20, 50); s.combat = rng.randInt(10, 30); break;
            }
            return s;
        }

        function generateWorkerSkill(rng) {
            const roll = rng.random();
            if (roll < 0.70) return rng.randInt(0, 30);
            if (roll < 0.90) return rng.randInt(31, 60);
            if (roll < 0.98) return rng.randInt(61, 80);
            return rng.randInt(81, 100);
        }

        for (const town of towns) {
            const townPeople = [];
            const count = town._popOverride || town._islandPopOverride || CONFIG.PEOPLE_PER_TOWN;
            delete town._popOverride;
            delete town._islandPopOverride;

            for (let i = 0; i < count; i++) {
                const sex = rng.chance(0.5) ? 'M' : 'F';
                const firstName = sex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
                const lastName = rng.pick(NAMES.surnames);
                const age = rng.randInt(14, 65);
                const occ = age < CONFIG.COMING_OF_AGE ? 'none' : pickOccupation();
                const person = {
                    id: uid('p'),
                    firstName,
                    lastName,
                    age,
                    sex,
                    alive: true,
                    townId: town.id,
                    kingdomId: town.kingdomId,
                    occupation: occ,
                    employerId: null,
                    needs: {
                        food: rng.randInt(50, 80),
                        shelter: rng.randInt(55, 85),
                        safety: rng.randInt(50, 80),
                        wealth: rng.randInt(40, 70),
                        happiness: rng.randInt(50, 75),
                    },
                    gold: occ === 'merchant' ? rng.randInt(20, 50) : rng.randInt(0, 20),
                    skills: skillsForOccupation(occ),
                    workerSkill: generateWorkerSkill(rng),
                    spouseId: null,
                    childrenIds: [],
                    parentIds: [],
                };

                // Assign wealth class based on occupation
                if (occ === 'noble') {
                    person.wealthClass = 'upper';
                    person.gold = rng.randInt(100, 500);
                } else if (occ === 'merchant' || occ === 'craftsman') {
                    person.wealthClass = rng.chance(0.5) ? 'middle' : 'lower';
                    if (person.wealthClass === 'middle') person.gold = rng.randInt(20, 100);
                } else if (occ === 'guard' || occ === 'soldier') {
                    person.wealthClass = rng.chance(0.3) ? 'middle' : 'lower';
                    if (person.wealthClass === 'middle') person.gold = rng.randInt(20, 100);
                } else {
                    person.wealthClass = 'lower';
                }

                // Assign NPC housing based on wealth class / occupation
                if (occ === 'noble') person.houseType = rng.pick(['manor', 'townhouse']);
                else if (person.wealthClass === 'upper') person.houseType = rng.pick(['townhouse', 'merchant_house']);
                else if (person.wealthClass === 'middle') person.houseType = rng.pick(['cottage', 'townhouse']);
                else person.houseType = rng.chance(0.7) ? rng.pick(['shack', 'cottage']) : null;

                // Give merchant NPCs starting inventory and buildings array
                if (occ === 'merchant') {
                    // Mark elite merchant candidates (will be curated to dynamic count after generation)
                    if (rng.chance(0.15)) {
                        person.wealthClass = 'upper';
                        person.gold = rng.randInt(100, 300);
                        person._eliteCandidate = true;
                    }
                    person.npcMerchantInventory = {};
                    const tradableGoods = ['wheat', 'bread', 'cloth', 'tools', 'iron', 'wood', 'wool'];
                    const numGoods = rng.randInt(1, 3);
                    for (let g = 0; g < numGoods; g++) {
                        const goodId = rng.pick(tradableGoods);
                        person.npcMerchantInventory[goodId] = (person.npcMerchantInventory[goodId] || 0) + rng.randInt(2, 10);
                    }
                    person.buildings = [];
                    person.npcMerchantCooldown = rng.randInt(0, 5);
                }

                // Generate personality traits (bell curve 0-100)
                person.personality = {
                    loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                };

                person.quirks = assignRandomQuirks(rng);

                // Food preferences
                person.foodPreferences = {};
                const foods = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'];
                for (const f of foods) {
                    person.foodPreferences[f] = 0.7 + rng.randFloat(0, 0.8);
                }
                if (town && town.isPort) person.foodPreferences.fish = Math.min(1.5, (person.foodPreferences.fish || 1) + 0.3);
                if (person.gold > 200) {
                    person.foodPreferences.meat = Math.min(1.5, (person.foodPreferences.meat || 1) + 0.2);
                    person.foodPreferences.poultry = Math.min(1.5, (person.foodPreferences.poultry || 1) + 0.2);
                }
                person.recentFoods = [];

                people.push(person);
                townPeople.push(person);
            }

            // Create marriages (~40% of adults paired)
            const men = townPeople.filter(p => p.sex === 'M' && p.age >= CONFIG.MARRIAGE_MIN_AGE);
            const women = townPeople.filter(p => p.sex === 'F' && p.age >= CONFIG.MARRIAGE_MIN_AGE);
            const marriageCount = Math.min(men.length, women.length, Math.floor(count * 0.20));
            rng.shuffle(men);
            rng.shuffle(women);
            for (let m = 0; m < marriageCount; m++) {
                men[m].spouseId = women[m].id;
                women[m].spouseId = men[m].id;
            }

            // Generate NPC children for married couples at game start
            // Target: ~50% of adult count as children, distributed across ages 0-13
            const childRatio = CONFIG.STARTING_CHILD_RATIO || 0.50;
            const targetChildren = Math.floor(count * childRatio);
            let childrenGenerated = 0;
            const marriedPairs = [];
            for (let m = 0; m < marriageCount; m++) {
                marriedPairs.push({ father: men[m], mother: women[m] });
            }
            rng.shuffle(marriedPairs);

            let pairIdx = 0;
            while (childrenGenerated < targetChildren && marriedPairs.length > 0) {
                const pair = marriedPairs[pairIdx % marriedPairs.length];
                // Each couple gets 1-3 children per pass
                const numKids = Math.min(rng.randInt(1, 3), targetChildren - childrenGenerated);
                for (let c = 0; c < numKids && childrenGenerated < targetChildren; c++) {
                    // Skip if couple already has max children
                    if (pair.mother.childrenIds.length >= (CONFIG.MAX_CHILDREN || 8)) break;

                    const childSex = rng.chance(0.5) ? 'M' : 'F';
                    const childFirstName = childSex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
                    // Children aged 0-13 with distribution weighted toward younger
                    const childAge = rng.randInt(0, 13);
                    const child = {
                        id: uid('p_child'),
                        firstName: childFirstName,
                        lastName: pair.father.lastName,
                        age: childAge,
                        sex: childSex,
                        alive: true,
                        townId: town.id,
                        kingdomId: town.kingdomId,
                        occupation: 'none',
                        employerId: null,
                        needs: {
                            food: rng.randInt(60, 90),
                            shelter: rng.randInt(60, 90),
                            safety: rng.randInt(60, 90),
                            wealth: rng.randInt(20, 40),
                            happiness: rng.randInt(60, 85),
                        },
                        gold: 0,
                        skills: { farming: 0, mining: 0, crafting: 0, trading: 0, combat: 0 },
                        workerSkill: 0,
                        spouseId: null,
                        childrenIds: [],
                        parentIds: [pair.father.id, pair.mother.id],
                        wealthClass: pair.father.wealthClass || 'lower',
                        personality: {
                            loyalty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            ambition: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            frugality: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            intelligence: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            warmth: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            honesty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                        },
                        quirks: assignRandomQuirks(rng),
                        foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                        recentFoods: [],
                        birthDay: -(childAge * 360 + rng.randInt(0, 359)), // Negative = born before game start
                    };
                    // Link parent-child
                    pair.father.childrenIds.push(child.id);
                    pair.mother.childrenIds.push(child.id);
                    people.push(child);
                    townPeople.push(child);
                    childrenGenerated++;
                }
                pairIdx++;
                // Break if we've gone through all pairs multiple times
                if (pairIdx > marriedPairs.length * 4) break;
            }

            town.population = count + childrenGenerated;
        }

        // === Curate elite merchants — scaled by world size ===
        var initialEmCount = Math.max(CONFIG.ELITE_MERCHANT_MIN, Math.min(CONFIG.ELITE_MERCHANT_MAX, Math.ceil(world.towns.length / CONFIG.ELITE_MERCHANT_PER_TOWNS)));
        const eliteCandidates = people.filter(p => p._eliteCandidate && p.alive);
        eliteCandidates.sort((a, b) => (b.gold || 0) - (a.gold || 0));

        // Select top candidates; if fewer, promote other merchants
        const eliteMerchants = [];
        for (let ei = 0; ei < Math.min(eliteCandidates.length, initialEmCount); ei++) {
            eliteCandidates[ei].isEliteMerchant = true;
            delete eliteCandidates[ei]._eliteCandidate;
            eliteMerchants.push(eliteCandidates[ei]);
        }
        // Fill remaining slots from non-elite merchants
        if (eliteMerchants.length < initialEmCount) {
            const otherMerchants = people.filter(p => p.alive && p.occupation === 'merchant' && !p.isEliteMerchant && !p._eliteCandidate);
            otherMerchants.sort((a, b) => (b.gold || 0) - (a.gold || 0));
            for (let fi = 0; fi < otherMerchants.length && eliteMerchants.length < initialEmCount; fi++) {
                otherMerchants[fi].isEliteMerchant = true;
                otherMerchants[fi].wealthClass = 'upper';
                eliteMerchants.push(otherMerchants[fi]);
            }
        }
        // Clear leftover candidate flags
        for (const p of people) { delete p._eliteCandidate; }

        // Age diversity: weighted distribution (young 25-35, middle 35-55, elder 55-65)
        for (const em of eliteMerchants) {
            const roll = rng.random();
            if (roll < 0.2) {
                em.age = rng.randInt(25, 35);       // 20% young ambitious
            } else if (roll < 0.8) {
                em.age = rng.randInt(35, 55);       // 60% middle-aged
            } else {
                em.age = rng.randInt(55, 65);       // 20% elder
            }
        }

        // Wealth diversity based on age
        for (const em of eliteMerchants) {
            if (em.age <= 35) {
                em.gold = rng.randInt(500, 2000);
            } else if (em.age <= 50) {
                em.gold = rng.randInt(2000, 8000);
            } else {
                em.gold = rng.randInt(5000, 15000);
            }
        }

        const productionBuildingTypes = [
            'wheat_farm', 'flour_mill', 'bakery', 'cattle_ranch', 'sheep_farm',
            'lumber_camp', 'sawmill', 'weaver', 'tanner', 'tailor', 'toolsmith',
            'vineyard', 'winery', 'smokehouse', 'smelter', 'blacksmith',
            'iron_mine', 'carpenter', 'jeweler', 'brick_kiln', 'fishery',
            'salt_works', 'rope_maker', 'hemp_farm', 'pig_farm',
            // Retail & service buildings
            'tavern', 'restaurant', 'general_store', 'clothing_shop',
            'armory_shop', 'jewelers_boutique', 'clinic', 'bathhouse',
            // Water production
            'brewery', 'apiary', 'herbalist_hut'
        ];

        // Building assignment based on age/wealth tier
        for (let ei = 0; ei < eliteMerchants.length; ei++) {
            const em = eliteMerchants[ei];
            const emTown = towns.find(t => t.id === em.townId);
            if (!emTown) continue;

            var numBuildings;
            if (em.age <= 35) {
                numBuildings = rng.randInt(0, 1);
            } else if (em.age <= 50) {
                numBuildings = rng.randInt(1, 3);
            } else {
                numBuildings = rng.randInt(2, 5);
            }

            if (!em.buildings) em.buildings = [];
            if (!em.npcMerchantInventory) em.npcMerchantInventory = {};
            if (em.npcMerchantCooldown == null) em.npcMerchantCooldown = rng.randInt(0, 5);

            for (let b = 0; b < numBuildings; b++) {
                const existingTypes = (emTown.buildings || []).map(bl => bl.type);
                const candidates = productionBuildingTypes.filter(bt =>
                    existingTypes.includes(bt) || rng.chance(0.3)
                );
                var buildingType = candidates.length > 0 ? rng.pick(candidates) : rng.pick(productionBuildingTypes);

                const newBuilding = {
                    type: buildingType,
                    level: 1,
                    ownerId: em.id,
                    builtDay: -rng.randInt(30, 360),
                    condition: 'new',
                    workers: [],
                    productionTier: '',
                    upgrades: [],
                    apprenticePairs: [],
                    productionChoice: '',
                    depositDepleted: false,
                    fallow: false,
                    breedProgress: 0,
                    securityUpgrades: [],
                };
                emTown.buildings.push(newBuilding);
                em.buildings.push({ townId: emTown.id, type: buildingType });
            }

            // Vary inventory size by age
            const tradableGoods = ['wheat', 'bread', 'cloth', 'tools', 'iron', 'wood', 'wool', 'wine', 'jewelry', 'salt'];
            var invSize;
            if (em.age <= 35) invSize = rng.randInt(1, 3);
            else if (em.age <= 50) invSize = rng.randInt(2, 5);
            else invSize = rng.randInt(3, 7);
            for (let g = 0; g < invSize; g++) {
                const goodId = rng.pick(tradableGoods);
                em.npcMerchantInventory[goodId] = (em.npcMerchantInventory[goodId] || 0) + rng.randInt(5, 30);
            }

            // Housing
            if (em.gold > 5000) em.houseType = rng.pick(['merchant_house', 'manor']);
            else if (em.gold > 1000) em.houseType = 'townhouse';
            else em.houseType = 'cottage';
        }

        // Give some elite merchants permits for banned/restricted goods
        for (let emi = 0; emi < eliteMerchants.length; emi++) {
            const em = eliteMerchants[emi];
            const emTown = towns.find(function(t) { return t.id === em.townId; });
            if (!emTown) continue;
            const emKingdom = kingdoms.find(function(k) { return k.id === emTown.kingdomId; });
            if (!emKingdom) continue;

            // 20% of wealthy EMs (gold > 3000) get a production permit for one banned good
            if ((em.gold || 0) > 3000 && rng.chance(0.2)) {
                const emBanned = emKingdom.laws && emKingdom.laws.bannedGoods ? emKingdom.laws.bannedGoods : [];
                if (emBanned.length > 0) {
                    const permitGood = rng.pick(emBanned);
                    if (!em.productionPermits) em.productionPermits = {};
                    if (!em.productionPermits[emKingdom.id]) em.productionPermits[emKingdom.id] = [];
                    em.productionPermits[emKingdom.id].push(permitGood);
                }
            }

            // 30% of EMs get trade licenses for restricted goods
            const restricted = emKingdom.laws && emKingdom.laws.restrictedGoods ? emKingdom.laws.restrictedGoods : [];
            if (restricted.length > 0 && rng.chance(0.3)) {
                const licenseGood = rng.pick(restricted);
                if (!em.licenses) em.licenses = {};
                if (!em.licenses[emKingdom.id]) em.licenses[emKingdom.id] = [];
                em.licenses[emKingdom.id].push(licenseGood);
            }

            // 25% of EMs in kingdoms with guild restrictions get guild membership
            if (emKingdom.laws && emKingdom.laws.guildRestrictions && rng.chance(0.25)) {
                if (!em.guilds) em.guilds = {};
                em.guilds[emKingdom.id] = true;
            }
        }

        // === Spouse and children generation for elite merchants ===
        for (const em of eliteMerchants) {
            const emTown = towns.find(t => t.id === em.townId);
            if (!emTown) continue;

            // Spouse probability based on age
            var spouseChance;
            if (em.age <= 30) spouseChance = 0.30;
            else if (em.age <= 40) spouseChance = 0.60;
            else if (em.age <= 50) spouseChance = 0.80;
            else spouseChance = 0.85;

            if (rng.chance(spouseChance) && !em.spouseId) {
                // Create spouse NPC
                const spouseSex = em.sex === 'M' ? 'F' : 'M';
                const spouseFirst = spouseSex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
                const ageDiff = rng.randInt(-15, 15);
                const spouseAge = Math.max(18, Math.min(70, em.age + ageDiff));
                const spouse = {
                    id: uid('p'),
                    firstName: spouseFirst,
                    lastName: em.lastName,
                    age: spouseAge,
                    sex: spouseSex,
                    alive: true,
                    townId: em.townId,
                    kingdomId: em.kingdomId,
                    occupation: rng.pick(['none', 'merchant', 'craftsman']),
                    employerId: null,
                    needs: {
                        food: rng.randInt(50, 80),
                        shelter: rng.randInt(55, 85),
                        safety: rng.randInt(50, 80),
                        wealth: rng.randInt(40, 70),
                        happiness: rng.randInt(50, 75),
                    },
                    gold: rng.randInt(10, 100),
                    skills: { farming: 5, mining: 5, crafting: rng.randInt(10, 40), trading: rng.randInt(10, 40), combat: 5 },
                    workerSkill: generateWorkerSkill(rng),
                    spouseId: em.id,
                    childrenIds: [],
                    parentIds: [],
                    wealthClass: 'upper',
                    personality: {
                        loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                        honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    },
                    quirks: assignRandomQuirks(rng),
                    foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                    recentFoods: [],
                    houseType: em.houseType,
                };
                em.spouseId = spouse.id;
                people.push(spouse);
                if (emTown) emTown.population++;

                // Children generation: if has spouse and age 28+
                if (em.age >= 28) {
                    var numChildren = Math.min(rng.randInt(0, Math.floor((em.age - 25) / 8)), 5);
                    for (let ci = 0; ci < numChildren; ci++) {
                        var maxChildAge = Math.max(0, em.age - 18);
                        var childAge = rng.randInt(0, maxChildAge);
                        var childSex = rng.chance(0.5) ? 'M' : 'F';
                        var childFirstName = childSex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
                        var childOcc = 'none';
                        if (childAge >= 16) {
                            childOcc = rng.pick(['merchant', 'laborer', 'craftsman', 'none']);
                        }
                        var child = {
                            id: uid('p_child'),
                            firstName: childFirstName,
                            lastName: em.lastName,
                            age: childAge,
                            sex: childSex,
                            alive: true,
                            townId: em.townId,
                            kingdomId: em.kingdomId,
                            occupation: childOcc,
                            employerId: null,
                            needs: {
                                food: rng.randInt(60, 90),
                                shelter: rng.randInt(60, 90),
                                safety: rng.randInt(60, 90),
                                wealth: rng.randInt(20, 40),
                                happiness: rng.randInt(60, 85),
                            },
                            gold: childAge >= 16 ? rng.randInt(0, 30) : 0,
                            skills: childAge >= 16 ? skillsForOccupation(childOcc) : { farming: 0, mining: 0, crafting: 0, trading: 0, combat: 0 },
                            workerSkill: childAge >= 16 ? generateWorkerSkill(rng) : 0,
                            spouseId: null,
                            childrenIds: [],
                            parentIds: [em.id, spouse.id],
                            wealthClass: em.wealthClass || 'upper',
                            personality: {
                                loyalty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                ambition: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                frugality: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                intelligence: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                warmth: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                honesty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                            },
                            quirks: assignRandomQuirks(rng),
                            foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                            recentFoods: [],
                            birthDay: -(childAge * 360 + rng.randInt(0, 359)),
                        };
                        em.childrenIds.push(child.id);
                        spouse.childrenIds.push(child.id);
                        people.push(child);
                        if (emTown) emTown.population++;
                    }
                }
            }
        }

        // Assign heraldry to elite merchants (shuffle and pick unique ones)
        if (typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            const heraldryPool = [...ELITE_MERCHANT_HERALDRY];
            for (let hi = heraldryPool.length - 1; hi > 0; hi--) {
                const hj = Math.floor(rng.random() * (hi + 1));
                [heraldryPool[hi], heraldryPool[hj]] = [heraldryPool[hj], heraldryPool[hi]];
            }
            eliteMerchants.forEach((m, idx) => {
                m.heraldry = heraldryPool[idx % heraldryPool.length];
            });
        }

        // Assign NPC-owned retail stores — wealthy/middle-class NPCs in towns+
        var retailTypes = ['tavern', 'restaurant', 'general_store', 'clothing_shop', 'clinic'];
        for (var ri = 0; ri < towns.length; ri++) {
            var rTown = towns[ri];
            if (rTown.category === 'village') continue; // retail only in towns+

            // Find wealthy and middle-class NPCs in this town
            var wealthyNPCs = people.filter(function(p) {
                return p.alive && p.townId === rTown.id && !p.isEliteMerchant &&
                    (p.wealthClass === 'upper' || p.wealthClass === 'middle') &&
                    p.age >= 18 && p.occupation !== 'noble';
            });

            // Assign existing unowned retail buildings to NPCs
            for (var bi2 = 0; bi2 < rTown.buildings.length; bi2++) {
                var bld2 = rTown.buildings[bi2];
                var bt2 = findBuildingType(bld2.type);
                if (!bt2 || !bt2.retailConfig || bld2.ownerId) continue; // skip non-retail or already owned

                // 60% chance an NPC owns an existing retail building
                if (wealthyNPCs.length > 0 && rng.chance(0.6)) {
                    var npcOwner = wealthyNPCs.splice(Math.floor(rng.random() * wealthyNPCs.length), 1)[0];
                    bld2.ownerId = npcOwner.id;
                    bld2.retailStock = {};
                    bld2.retailRevenue = 0;
                    if (!npcOwner.buildings) npcOwner.buildings = [];
                    npcOwner.buildings.push({ type: bld2.type, townId: rTown.id });
                }
            }

            // Wealthy NPCs may build additional retail stores (10% chance per NPC)
            for (var wi = 0; wi < wealthyNPCs.length; wi++) {
                var wNpc = wealthyNPCs[wi];
                var buildChance = wNpc.wealthClass === 'upper' ? 0.10 : 0.03;
                if (!rng.chance(buildChance)) continue;

                var maxSlots = CONFIG.TOWN_CATEGORIES[rTown.category] ? CONFIG.TOWN_CATEGORIES[rTown.category].maxBuildingSlots : 10;
                if (rTown.buildings.length >= maxSlots) continue;

                var shopType = rng.pick(retailTypes);
                var shopBt = findBuildingType(shopType);
                if (!shopBt || (wNpc.gold || 0) < (shopBt.cost || 100)) continue;

                wNpc.gold -= shopBt.cost;
                var newShop = { type: shopType, level: 1, ownerId: wNpc.id, townId: rTown.id, workers: [], upgrades: [], builtDay: -rng.randInt(30, 180), retailStock: {}, retailRevenue: 0 };
                rTown.buildings.push(newShop);
                if (!wNpc.buildings) wNpc.buildings = [];
                wNpc.buildings.push({ type: shopType, townId: rTown.id });
            }
        }

        // Seed markets based on buildings now that population is known
        for (const town of towns) {
            seedMarketFromBuildings(town);
            // Start some towns with livestock
            const pastureCount = town.buildings.filter(b => b.type === 'pasture').length;
            if (pastureCount > 0) {
                town.livestock.livestock_cow = rng.randInt(2, pastureCount * 5);
                town.livestock.livestock_chicken = rng.randInt(3, pastureCount * 6);
                if (rng.chance(0.4)) town.livestock.livestock_pig = rng.randInt(1, pastureCount * 4);
            } else if (town.buildings.some(b => b.type === 'cattle_ranch')) {
                town.livestock.livestock_cow = rng.randInt(2, 6);
            }
        }

        // Assign kings
        for (const k of kingdoms) {
            const kTowns = towns.filter(t => t.kingdomId === k.id);
            const kPeople = people.filter(p => p.kingdomId === k.id && p.alive);
            if (kPeople.length === 0) continue;
            // Pick a suitable male age 30-60
            let king = kPeople.find(p => p.sex === 'M' && p.age >= 30 && p.age <= 60);
            if (!king) king = kPeople.find(p => p.sex === 'M' && p.age >= 20);
            if (!king) king = kPeople[0]; // fallback
            king.occupation = 'noble';
            king.gold = rng.randInt(200, 500);
            king.skills = { farming: 5, mining: 5, crafting: 10, trading: rng.randInt(30, 60), combat: rng.randInt(20, 50) };
            k.king = king.id;

            // Generate a proper royal family for this king
            generateRoyalFamily(rng, king, people, kTowns);

            // Build succession list: sons, then brothers, then other males
            const allKPeople = people.filter(p => p.kingdomId === k.id && p.alive);
            const males = allKPeople.filter(p => p.sex === 'M' && p.id !== king.id && p.age >= 14);
            rng.shuffle(males);
            // Prefer younger nobles/soldiers
            males.sort((a, b) => {
                const aN = a.occupation === 'noble' ? 0 : 1;
                const bN = b.occupation === 'noble' ? 0 : 1;
                if (aN !== bN) return aN - bN;
                return a.age - b.age;
            });
            k.succession = males.slice(0, 5).map(p => p.id);
        }

        return people;
    }

    /**
     * Generate a royal family for a king: spouse, siblings (with their families), and children.
     * @param {object} rng - Seeded RNG
     * @param {object} king - The king person object
     * @param {Array} people - The world people array (mutated — new NPCs pushed)
     * @param {Array} kTowns - Towns in this kingdom
     */
    function generateRoyalFamily(rng, king, people, kTowns) {
        const capitalTown = kTowns.find(t => t.isCapital) || kTowns[0];
        if (!capitalTown) return;

        // Deceased parent IDs shared by king and siblings
        const fatherId = uid('p_royal');
        const motherId = uid('p_royal');
        king.parentIds = [fatherId, motherId];

        function makeRoyalPerson(overrides) {
            const sex = overrides.sex || (rng.chance(0.5) ? 'M' : 'F');
            const firstName = sex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
            const age = overrides.age != null ? overrides.age : rng.randInt(18, 50);
            const isAdult = age >= (CONFIG.COMING_OF_AGE || 14);
            const person = {
                id: uid('p'),
                firstName: firstName,
                lastName: king.lastName,
                age: age,
                sex: sex,
                alive: true,
                townId: overrides.townId || capitalTown.id,
                kingdomId: king.kingdomId,
                occupation: isAdult ? 'noble' : 'none',
                employerId: null,
                needs: {
                    food: rng.randInt(50, 80),
                    shelter: rng.randInt(55, 85),
                    safety: rng.randInt(50, 80),
                    wealth: rng.randInt(40, 70),
                    happiness: rng.randInt(50, 75),
                },
                gold: isAdult ? rng.randInt(overrides.goldMin || 30, overrides.goldMax || 100) : 0,
                skills: { farming: 5, mining: 5, crafting: 5, trading: rng.randInt(10, 30), combat: rng.randInt(10, 30) },
                workerSkill: 0,
                spouseId: null,
                childrenIds: [],
                parentIds: overrides.parentIds || [],
                wealthClass: 'upper',
                houseType: rng.pick(['manor', 'townhouse']),
                personality: {
                    loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                    honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                },
                quirks: assignRandomQuirks(rng),
                foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                recentFoods: [],
            };
            // Apply explicit overrides for sex/firstName/occupation/gold
            if (overrides.sex) person.sex = overrides.sex;
            if (overrides.firstName) person.firstName = overrides.firstName;
            if (overrides.occupation) person.occupation = overrides.occupation;
            if (overrides.gold != null) person.gold = overrides.gold;
            if (overrides.spouseId) person.spouseId = overrides.spouseId;
            if (overrides.parentIds) person.parentIds = overrides.parentIds;
            return person;
        }

        // --- A. King's Spouse ---
        if (!king.spouseId) {
            const spouseSex = king.sex === 'M' ? 'F' : 'M';
            const spouseAge = Math.max(18, Math.min(65, king.age + rng.randInt(-5, 5)));
            const spouse = makeRoyalPerson({
                sex: spouseSex,
                age: spouseAge,
                goldMin: 50, goldMax: 150,
                spouseId: king.id,
            });
            king.spouseId = spouse.id;
            people.push(spouse);
            if (capitalTown) capitalTown.population = (capitalTown.population || 0) + 1;

            // --- C. King's Children (0-4) ---
            const maxChildAge = Math.max(0, king.age - 18);
            const numChildren = maxChildAge >= 2 ? rng.randInt(0, 4) : 0;
            for (let ci = 0; ci < numChildren; ci++) {
                const childAge = rng.randInt(2, Math.min(maxChildAge, 40));
                const childSex = rng.chance(0.5) ? 'M' : 'F';
                const isChildAdult = childAge >= 18;
                const child = makeRoyalPerson({
                    sex: childSex,
                    age: childAge,
                    parentIds: [king.id, spouse.id],
                    occupation: isChildAdult ? 'noble' : 'none',
                    goldMin: isChildAdult ? 30 : 0,
                    goldMax: isChildAdult ? 100 : 0,
                    gold: isChildAdult ? undefined : 0,
                });
                if (!isChildAdult) child.gold = 0;
                king.childrenIds.push(child.id);
                spouse.childrenIds.push(child.id);
                people.push(child);
                if (capitalTown) capitalTown.population = (capitalTown.population || 0) + 1;
            }
        }

        // --- B. King's Siblings (1-3) ---
        const numSiblings = rng.randInt(1, 3);
        for (let si = 0; si < numSiblings; si++) {
            const sibSex = rng.chance(0.5) ? 'M' : 'F';
            const sibAge = Math.max(16, Math.min(65, king.age + rng.randInt(-10, 10)));
            const sibTown = rng.chance(0.6) ? capitalTown : rng.pick(kTowns);
            const sibling = makeRoyalPerson({
                sex: sibSex,
                age: sibAge,
                townId: sibTown.id,
                parentIds: [fatherId, motherId],
                goldMin: 50, goldMax: 200,
            });
            people.push(sibling);
            sibTown.population = (sibTown.population || 0) + 1;

            // 40% chance sibling is married
            if (rng.chance(0.4) && sibAge >= 18) {
                const sibSpouseSex = sibSex === 'M' ? 'F' : 'M';
                const sibSpouseAge = Math.max(18, Math.min(65, sibAge + rng.randInt(-5, 5)));
                const sibSpouse = makeRoyalPerson({
                    sex: sibSpouseSex,
                    age: sibSpouseAge,
                    townId: sibTown.id,
                    spouseId: sibling.id,
                    goldMin: 30, goldMax: 100,
                });
                sibling.spouseId = sibSpouse.id;
                people.push(sibSpouse);
                sibTown.population = (sibTown.population || 0) + 1;

                // 30% chance married sibling has 1-2 children
                if (rng.chance(0.3)) {
                    const sibMaxChildAge = Math.max(0, sibAge - 18);
                    const sibNumKids = sibMaxChildAge >= 2 ? rng.randInt(1, 2) : 0;
                    for (let nci = 0; nci < sibNumKids; nci++) {
                        const nephewAge = rng.randInt(2, Math.min(sibMaxChildAge, 30));
                        const nephewSex = rng.chance(0.5) ? 'M' : 'F';
                        const isNephewAdult = nephewAge >= 18;
                        const nephew = makeRoyalPerson({
                            sex: nephewSex,
                            age: nephewAge,
                            townId: sibTown.id,
                            parentIds: [sibling.id, sibSpouse.id],
                            occupation: isNephewAdult ? 'noble' : 'none',
                            goldMin: isNephewAdult ? 20 : 0,
                            goldMax: isNephewAdult ? 80 : 0,
                            gold: isNephewAdult ? undefined : 0,
                        });
                        if (!isNephewAdult) nephew.gold = 0;
                        sibling.childrenIds.push(nephew.id);
                        sibSpouse.childrenIds.push(nephew.id);
                        people.push(nephew);
                        sibTown.population = (sibTown.population || 0) + 1;
                    }
                }
            }
        }
    }

    // ========================================================
    // §11 SEASON / TIME HELPERS
    // ========================================================
    function getSeason(day) {
        const idx = Math.floor((day % (CONFIG.DAYS_PER_SEASON * 4)) / CONFIG.DAYS_PER_SEASON);
        return CONFIG.SEASONS[idx];
    }

    function getYear(day) {
        return Math.floor(day / (CONFIG.DAYS_PER_SEASON * 4)) + 1;
    }

    function isWinter(day) { return getSeason(day) === 'Winter'; }
    function isFarmSeason(day) {
        const s = getSeason(day);
        return s === 'Spring' || s === 'Summer';
    }

    // ========================================================
    // §12 ECONOMY TICK
    // ========================================================
    function tickEconomy() {
        const day = world.day;
        const winter = isWinter(day);
        const farmBoost = isFarmSeason(day);

        for (const town of world.towns) {
            // ---- Production from buildings ----
            for (const bld of town.buildings) {
                const bt = findBuildingType(bld.type);
                if (!bt || !bt.produces) continue;

                // Skip NPC-owned buildings if industry is nationalized
                const kingdom = findKingdom(town.kingdomId);
                if (kingdom && kingdom.nationalizedIndustries && kingdom.nationalizedIndustries.includes(bld.type)) {
                    if (bld.ownerId && bld.ownerId !== kingdom.id && bld.ownerId !== 'player') continue;
                }

                // Determine effective worker fraction
                const requiredWorkers = bt.workers;
                const assignedWorkers = countWorkersForBuilding(town, bld);
                const workerFraction = Math.min(1, assignedWorkers / Math.max(1, requiredWorkers));
                if (workerFraction <= 0) continue;

                // Seasonal modifier for farms
                let seasonMod = 1;
                if (bt.category === 'farm') {
                    if (winter) seasonMod = 0.5;
                    else if (farmBoost) seasonMod = 1.2;
                }

                // Check active event modifiers
                seasonMod *= getEventProductionMod(town.id, bt);

                // Multi-product building support (canProduce + availableProducts)
                let activeProduces = bt.produces;
                let activeConsumes = bt.consumes;
                let activeRate = bt.rate;
                // Check canProduce / currentProduct first
                if (bld.currentProduct && bld.currentProduct !== bt.produces) {
                    if (bt.availableProducts && bt.availableProducts[bld.currentProduct]) {
                        const recipe = bt.availableProducts[bld.currentProduct];
                        activeProduces = recipe.produces;
                        activeConsumes = recipe.consumes;
                        activeRate = recipe.rate;
                    } else if (bt.canProduce && bt.canProduce.includes(bld.currentProduct)) {
                        activeProduces = bld.currentProduct;
                    }
                } else if (bt.availableProducts && bld.productionChoice && bt.availableProducts[bld.productionChoice]) {
                    const recipe = bt.availableProducts[bld.productionChoice];
                    activeProduces = recipe.produces;
                    activeConsumes = recipe.consumes;
                    activeRate = recipe.rate;
                }

                // Check building can actually produce before consuming inputs
                const conditionEff = CONFIG.CONDITION_LEVELS[bld.condition || 'new'] ? CONFIG.CONDITION_LEVELS[bld.condition || 'new'].efficiency : 1.0;
                if (conditionEff <= 0) continue;

                // Strike/abandonment check — building halted by worker action
                if (bld._strikeUntil && bld._strikeUntil > world.day) continue;

                // Fallow check — only applies to farms
                if (bld.fallow && bt.category === 'farm') { continue; }
                // Deposit depletion — only applies to extraction buildings
                if (bld.depositDepleted) { continue; }

                // Check inputs available
                let canProduce = true;
                for (const [resId, qty] of Object.entries(activeConsumes)) {
                    if ((town.market.supply[resId] || 0) < qty) {
                        canProduce = false;
                        break;
                    }
                }
                if (!canProduce) continue;

                // Consume inputs
                for (const [resId, qty] of Object.entries(activeConsumes)) {
                    var consumeQty = qty;
                    // Efficient Logistics: player buildings consume 10% fewer inputs
                    if (bld.ownerId === 'player' && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('efficient_logistics')) {
                        consumeQty = Math.max(1, Math.ceil(qty * 0.90));
                    }
                    town.market.supply[resId] -= consumeQty;
                    // Bug 1 fix: collect trade tax on building input consumption
                    collectTradeTax(town.kingdomId, consumeQty * getMarketPrice(town, resId), resId);
                }

                // Produce output

                // --- WAR ZONE & POST-WAR RECOVERY: reduced production ---
                let warZonePenalty = 1.0;
                if (town.isFrontline) {
                    warZonePenalty = 0.5; // -50% production in active war zones
                } else if (town._postWarRecovery && world.day < town._postWarRecovery) {
                    warZonePenalty = 0.7; // -30% production during post-war recovery
                }

                // --- HAPPINESS PRODUCTIVITY MODIFIER ---
                var happyMod = 1.0;
                var townHappy = town.happiness || 50;
                if (townHappy > (CONFIG.TOWN_HAPPINESS_THRIVING || 75)) {
                    happyMod = 1.0 + happinessScaledBonus(townHappy, CONFIG.TOWN_HAPPINESS_THRIVING || 75, CONFIG.TOWN_THRIVING_PRODUCTIVITY_BONUS || 0.20);
                } else if (townHappy > (CONFIG.TOWN_HAPPINESS_CONTENT || 55)) {
                    happyMod = 1.0 + happinessScaledBonus(townHappy, CONFIG.TOWN_HAPPINESS_CONTENT || 55, CONFIG.TOWN_CONTENT_PRODUCTIVITY_BONUS || 0.08);
                } else if (townHappy < (CONFIG.TOWN_HAPPINESS_CRISIS || 18)) {
                    happyMod = 1.0 - happinessScaledChance(townHappy, CONFIG.TOWN_HAPPINESS_CRISIS || 18, CONFIG.TOWN_CRISIS_PRODUCTIVITY_PENALTY || 0.45);
                } else if (townHappy < (CONFIG.TOWN_HAPPINESS_UNREST || 35)) {
                    happyMod = 1.0 - happinessScaledChance(townHappy, CONFIG.TOWN_HAPPINESS_UNREST || 35, CONFIG.TOWN_UNREST_PRODUCTIVITY_PENALTY || 0.20);
                }
                happyMod = Math.max(0.3, happyMod); // Floor at 30% production

                // --- WORKER QUIRK MODIFIER (player buildings only) ---
                var quirkMod = 1.0;
                if (bld.ownerId === 'player' && bld.workers && bld.workers.length > 0 && typeof SPOUSE_QUIRKS !== 'undefined') {
                    var qTotal = 0;
                    var qCount = 0;
                    for (var wi = 0; wi < bld.workers.length; wi++) {
                        var w = findPerson(bld.workers[wi]);
                        if (!w || !w.alive || !w.quirks) continue;
                        for (var qi = 0; qi < w.quirks.length; qi++) {
                            var qDef = SPOUSE_QUIRKS.find(function(q) { return q.id === w.quirks[qi]; });
                            if (qDef && qDef.workerMod) { qTotal += qDef.workerMod; qCount++; }
                        }
                    }
                    if (qCount > 0) quirkMod = Math.max(0.5, 1.0 + qTotal);
                }

                // Apprenticeship: master produces 50% less, apprentice gains 3x XP
                let apprenticePenalty = 1.0;
                if (bld.apprenticePairs && bld.apprenticePairs.length > 0) {
                    const masterCount = bld.apprenticePairs.length;
                    const totalWorkers = bld.workers ? bld.workers.length : requiredWorkers;
                    if (totalWorkers > 0) {
                        apprenticePenalty = 1.0 - (masterCount * 0.5 / totalWorkers);
                        apprenticePenalty = Math.max(0.25, apprenticePenalty);
                    }
                }

                const isMilitaryProduction = (bt.category === 'military' && bt.produces);
                const militaryBuildingTypes = ['blacksmith', 'armorer', 'fletcher', 'arrow_maker'];
                const isMilitaryBuilding = militaryBuildingTypes.includes(bld.type);

                // Bug 3 fix: track actual output for owner revenue calculation
                let actualOutput = 0;
                let actualOutputId = activeProduces;

                if (isMilitaryBuilding) {
                    // Quality tier production for military buildings
                    const targetTier = bld.productionTier || 'basic';
                    const avgSkill = getAverageWorkerSkill(bld, town);

                    let successRate;
                    if (targetTier === 'basic') {
                        successRate = Math.min(1.0, 0.95 + avgSkill * 0.0005);
                    } else if (targetTier === 'good') {
                        successRate = Math.min(1.0, 0.30 + avgSkill * 0.00875);
                    } else {
                        successRate = Math.min(1.0, 0.05 + avgSkill * 0.00944);
                    }

                    const baseOutput = Math.floor(activeRate * workerFraction * seasonMod * (bld.level || 1) * conditionEff * apprenticePenalty * warZonePenalty * happyMod);
                    let produced = 0;
                    let failed = 0;
                    for (let u = 0; u < baseOutput; u++) {
                        if (world.rng.chance(successRate)) {
                            produced++;
                        } else {
                            failed++;
                        }
                    }

                    // Determine output resource ID based on tier
                    let outputId = activeProduces;
                    if (targetTier === 'good') outputId = activeProduces + '_good';
                    else if (targetTier === 'excellent') outputId = activeProduces + '_excellent';
                    // Arrows have no excellent tier — fall back to good
                    if (outputId === 'arrows_excellent') { outputId = 'arrows_good'; }

                    if (produced > 0) {
                        town.market.supply[outputId] = (town.market.supply[outputId] || 0) + produced;
                        actualOutput = produced;
                        actualOutputId = outputId;
                    }

                    // Worker XP gain
                    applyWorkerXP(bld, town, targetTier, produced, failed);
                } else {
                    // Standard production
                    // Soil fertility modifier for farms
                    let fertilityMod = 1.0;
                    if (bt.category === 'farm' && town.soilFertility != null) {
                        fertilityMod = town.soilFertility;
                    }
                    // Wildlife abundance modifier for hunting lodges
                    let wildlifeMod = 1.0;
                    if (bld.type === 'hunting_lodge' && town.wildlifeAbundance != null) {
                        wildlifeMod = town.wildlifeAbundance;
                    }
                    const output = Math.floor(activeRate * workerFraction * seasonMod * (bld.level || 1) * conditionEff * apprenticePenalty * fertilityMod * wildlifeMod * warZonePenalty * happyMod);
                    // Animal Husbandry: player livestock buildings produce 10% more
                    var livestockTypes = ['cattle_ranch', 'sheep_farm', 'chicken_farm', 'pig_farm', 'horse_ranch'];
                    var animalBonus = 0;
                    if (bld.ownerId === 'player' && livestockTypes.indexOf(bld.type) >= 0 && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('animal_husbandry')) {
                        animalBonus = Math.max(1, Math.floor(output * 0.10));
                    }
                    actualOutput = output + animalBonus;
                    town.market.supply[activeProduces] = (town.market.supply[activeProduces] || 0) + output + animalBonus;

                    // Cattle Ranch secondary output: hide from slaughter
                    if (bld.type === 'cattle_ranch' && output > 0) {
                        var hideOutput = Math.max(1, Math.floor(output * 0.4));
                        town.market.supply.hide = (town.market.supply.hide || 0) + hideOutput;
                    }

                    // Minor XP for non-military work
                    applyWorkerXP(bld, town, 'basic', output, 0);
                }

                // --- Worker wage payment & goods flow ---
                if (bld.ownerId && bld.ownerId !== 'player') {
                    const kingdom = findKingdom(town.kingdomId);
                    const isKingdomOwned = kingdom && bld.ownerId === kingdom.id;
                    const workerIds = bld.workers || [];
                    const wagePerWorker = CONFIG.BASE_WAGE || 4;

                    for (const wId of workerIds) {
                        const worker = findPerson(wId);
                        if (!worker || !worker.alive) continue;

                        if (isKingdomOwned) {
                            // Kingdom pays workers from treasury
                            if (kingdom.gold >= wagePerWorker) {
                                kingdom.gold -= wagePerWorker;
                                worker.gold = (worker.gold || 0) + wagePerWorker;
                            } else {
                                // Kingdom can't pay — worker may quit
                                if (world.rng.chance(0.1)) {
                                    worker.occupation = 'laborer';
                                    worker.employerId = null;
                                    const idx = workerIds.indexOf(wId);
                                    if (idx >= 0) workerIds.splice(idx, 1);
                                }
                            }
                        } else {
                            // NPC owner pays from personal gold
                            const owner = findPerson(bld.ownerId);
                            if (owner && owner.alive && owner.gold >= wagePerWorker) {
                                owner.gold -= wagePerWorker;
                                worker.gold = (worker.gold || 0) + wagePerWorker;
                            } else if (owner && owner.alive && world.rng.chance(0.1)) {
                                // Owner can't pay — worker may quit
                                worker.occupation = 'laborer';
                                worker.employerId = null;
                                const idx = workerIds.indexOf(wId);
                                if (idx >= 0) workerIds.splice(idx, 1);
                            }
                        }
                    }

                    // NPC building owners sell produced goods to market
                    if (!isKingdomOwned && bld._profitTracker) {
                        const owner = findPerson(bld.ownerId);
                        if (owner && owner.alive) {
                            // Bug 3 fix: use actual production output for revenue
                            const sellingPrice = getMarketPrice(town, actualOutputId);
                            const earnedFromSales = Math.floor(sellingPrice * actualOutput);
                            owner.gold = (owner.gold || 0) + earnedFromSales;
                        }
                    }
                }
            }

            // ---- Horse farm productivity bonus ----
            const hasHorses = (town.market.supply.horses || 0) > 0;
            const hasSaddles = (town.market.supply.saddles || 0) > 0;
            if (hasHorses) {
                let horseBonus = CONFIG.HORSE_FARM_BONUS;
                if (hasSaddles) horseBonus *= CONFIG.SADDLE_BONUS_MULTIPLIER;
                const farmTypes = ['wheat_farm', 'sheep_farm', 'cattle_ranch', 'chicken_farm', 'pig_farm', 'hemp_farm'];
                for (const bld of town.buildings) {
                    if (farmTypes.includes(bld.type)) {
                        const bt = findBuildingType(bld.type);
                        if (bt && bt.produces) {
                            const bonus = Math.floor(bt.rate * horseBonus * bld.level);
                            if (bonus > 0) {
                                town.market.supply[bt.produces] = (town.market.supply[bt.produces] || 0) + bonus;
                            }
                        }
                    }
                }
            }

            // ---- Livestock simulation ----
            if (!town.livestock) town.livestock = { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 };
            const pastureCapacity = town.buildings
                .filter(b => b.type === 'pasture')
                .reduce((sum, b) => sum + (findBuildingType('pasture').livestockCapacity || 10) * (b.level || 1), 0);
            const totalLivestock = (town.livestock.livestock_cow || 0) + (town.livestock.livestock_pig || 0) + (town.livestock.livestock_chicken || 0);

            if (totalLivestock > 0 && pastureCapacity > 0) {
                const cows = Math.min(town.livestock.livestock_cow || 0, pastureCapacity);
                const chickens = Math.min(town.livestock.livestock_chicken || 0, Math.max(0, pastureCapacity - cows));
                // Cows produce hide
                if (cows > 0) {
                    town.market.supply.hide = (town.market.supply.hide || 0) + cows;
                }
                // Chickens produce eggs
                if (chickens > 0) {
                    town.market.supply.eggs = (town.market.supply.eggs || 0) + chickens * 2;
                }
                // Pigs produce meat from pasture
                const pigs = Math.min(town.livestock.livestock_pig || 0, Math.max(0, pastureCapacity - cows - chickens));
                if (pigs > 0) {
                    var pigMeat = Math.floor(pigs * 0.3);
                    if (pigMeat > 0) {
                        town.market.supply.meat = (town.market.supply.meat || 0) + pigMeat;
                    }
                }
            }

            // ---- Count watchtowers for tower bonus ----
            town.towers = town.buildings.filter(b => b.type === 'watchtower').length;

            // ---- Reset demand to zero each tick (BUG 10 fix: prevent tick-over-tick accumulation) ----
            for (var dKey in town.market.demand) { town.market.demand[dKey] = 0; }

            // ---- Building maintenance demand ----
            for (const bld of town.buildings) {
                if (bld.condition === 'used' || bld.condition === 'breaking') {
                    const bt = findBuildingType(bld.type);
                    if (bt && bt.materials) {
                        for (const [matId, qty] of Object.entries(bt.materials)) {
                            town.market.demand[matId] = (town.market.demand[matId] || 0) + qty * 0.02;
                        }
                    }
                }
            }

            // ---- Population-driven consumption ----
            // Count adults vs children for differentiated food consumption
            var townPeople = (_tickCache.peopleByTown[town.id] || []);
            const adultCount = townPeople.filter(p => p.age >= CONFIG.COMING_OF_AGE).length;
            const childCount = townPeople.filter(p => p.age < CONFIG.COMING_OF_AGE).length;
            const childMult = CONFIG.CHILD_FOOD_MULTIPLIER || 0.25;
            const totalFoodNeeded = Math.ceil((adultCount + childCount * childMult) * CONFIG.FOOD_CONSUMPTION_PER_DAY);
            const pop = town.population; // Used for demand calculations below

            // Most townspeople grow their own food (gardens, foraging, subsistence)
            // ~60% is self-sufficient in growing seasons; winter drops to ~35%
            // This means cutting off trade routes CAN starve towns, especially in winter
            const season = getSeason(day);
            const selfSufficiencyRate = season === 'Winter' ? 0.35 :
                                        season === 'Autumn' ? 0.55 : 0.65;
            const selfSufficient = Math.floor(totalFoodNeeded * selfSufficiencyRate);
            const foodNeeded = totalFoodNeeded - selfSufficient;

            // Baseline subsistence farming — farmers produce food outside of buildings
            var farmers = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
                return p.occupation === 'farmer';
            });
            const subsistenceWheat = Math.floor(farmers.length * 1.5);
            town.market.supply.wheat = (town.market.supply.wheat || 0) + subsistenceWheat;

            // People eat from available food proportionally (based on supply)
            const foodTypes = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food', 'wheat'];
            let foodRemaining = foodNeeded;
            let totalAvailableFood = 0;
            for (const fType of foodTypes) {
                totalAvailableFood += (town.market.supply[fType] || 0);
            }
            if (totalAvailableFood > 0 && foodRemaining > 0) {
                const consumeRatio = Math.min(1, foodRemaining / totalAvailableFood);
                for (const fType of foodTypes) {
                    const available = town.market.supply[fType] || 0;
                    if (available <= 0) continue;
                    const consumed = Math.min(available, Math.ceil(available * consumeRatio));
                    if (consumed > 0) {
                        town.market.supply[fType] -= consumed;
                        collectTradeTax(town.kingdomId, consumed * getMarketPrice(town, fType), fType);
                        foodRemaining -= consumed;
                    }
                }
            }

            // Happiness and prosperity adjustment from food satisfaction
            const foodSatisfaction = 1 - (foodRemaining / Math.max(1, foodNeeded));
            town.happiness = Math.max(0, Math.min(100,
                town.happiness + (foodSatisfaction > 0.8 ? 0.5 : -1) * (1 - foodSatisfaction)
            ));

            // ── Water & beverage consumption ──
            // NPCs drink water daily (1 per 5 people)
            var waterNeeded = Math.ceil(pop * 0.2);
            var waterAvail = town.market.supply.water || 0;
            var waterConsumed = Math.min(waterAvail, waterNeeded);
            town.market.supply.water = Math.max(0, waterAvail - waterConsumed);

            // NPCs also drink ale/mead from market (small amount)
            var aleConsumed = Math.min(town.market.supply.ale || 0, Math.ceil(pop * 0.03));
            town.market.supply.ale = Math.max(0, (town.market.supply.ale || 0) - aleConsumed);

            // Wells produce water daily (each well adds water to market)
            var wellCount = town.buildings ? town.buildings.filter(function(b) { return b.type === 'well'; }).length : 0;
            var cisternCount = town.buildings ? town.buildings.filter(function(b) { return b.type === 'cistern'; }).length : 0;
            var wellProduction = wellCount * 15 + cisternCount * 8; // matches BUILDING_TYPES rates
            town.market.supply.water = (town.market.supply.water || 0) + wellProduction;
            // Track water supply level for fire/plague use
            town.waterSupply = (town.market.supply.water || 0);

            // War consumption (military goods)
            const kingdom = findKingdom(town.kingdomId);
            if (kingdom && kingdom.atWar.size > 0) {
                const garrisonConsuming = Math.ceil(town.garrison * 0.05);
                consumeFromMarket(town, 'swords', garrisonConsuming);
                consumeFromMarket(town, 'armor', Math.ceil(garrisonConsuming * 0.5));
                consumeFromMarket(town, 'arrows', Math.ceil(garrisonConsuming * 2));
                consumeFromMarket(town, 'bows', Math.ceil(garrisonConsuming * 0.3));
            }

            // ---- Seasonal demand modifiers ----
            const currentSeason = getSeason(day);
            const seasonDemandMods = CONFIG.SEASONAL_DEMAND[currentSeason] || {};
            for (const [resId, mod] of Object.entries(seasonDemandMods)) {
                if (town.market.demand[resId] != null) {
                    town.market.demand[resId] = Math.ceil(town.market.demand[resId] * mod);
                }
            }

            // ---- Fashion trend demand modifiers ----
            if (world.fashionTrends) {
                const townKingdom = findKingdom(town.kingdomId);
                if (townKingdom && (town.category === 'city' || town.category === 'capital_city')) {
                    for (const trend of world.fashionTrends) {
                        if (!trend.active) continue;
                        if (trend.originKingdomId === town.kingdomId || (trend.spreadTo && trend.spreadTo.includes(town.kingdomId))) {
                            const resId = trend.goodId;
                            town.market.demand[resId] = Math.ceil((town.market.demand[resId] || 0) * (1 + trend.demandBonus));
                        }
                    }
                }
            }

            // ---- Market price recalculation ----
            for (const key in RESOURCE_TYPES) {
                const r = RESOURCE_TYPES[key];
                const bp = (town.localBasePrice && town.localBasePrice[r.id]) || r.basePrice;
                const s = town.market.supply[r.id] || 0;
                const d = town.market.demand[r.id] || 0;
                let price;
                if (s === 0 && d > 0) {
                    price = bp * 3.0;
                } else if (s === 0) {
                    price = bp * 1.5;
                } else {
                    price = bp * (1 + (d - s) * CONFIG.SUPPLY_DEMAND_FACTOR);
                }
                if (typeof town.prosperity === 'number') {
                    var prospFactor = 1 + (town.prosperity - 50) * 0.002;
                    price *= prospFactor;
                }
                price = Math.max(bp * 0.25, Math.min(bp * 4, price));
                town.market.prices[r.id] = Math.round(price * 100) / 100;
            }

            // ---- Background peddler trade convergence ----
            // Simulates unseen small traders (peddlers, farmers, tinkers) moving goods between connected towns
            // Prices slowly converge between connected settlements
            if (town.connectedTowns && town.connectedTowns.length > 0) {
                for (var ci = 0; ci < town.connectedTowns.length; ci++) {
                    var neighbor = findTown(town.connectedTowns[ci]);
                    if (!neighbor || !neighbor.market || !neighbor.market.prices) continue;

                    // Base convergence rate from config
                    var bgTradeRate = CONFIG.BACKGROUND_TRADE_RATE;

                    // Reduce convergence if kingdoms are at war
                    if (town.kingdomId !== neighbor.kingdomId) {
                        var townK = findKingdom(town.kingdomId);
                        var neighborK = findKingdom(neighbor.kingdomId);
                        if (townK && townK.atWar && townK.atWar.has(neighbor.kingdomId)) {
                            bgTradeRate *= 0.1; // 90% reduction during war
                        }
                        // Cross-kingdom base reduction (borders slow trade)
                        bgTradeRate *= 0.6;
                    }

                    // Reduce if town is a frontline in a war
                    if (town.isFrontline || neighbor.isFrontline) {
                        bgTradeRate *= 0.3;
                    }

                    // Apply convergence to each resource
                    for (var rk in town.market.prices) {
                        var localPrice = town.market.prices[rk];
                        var neighborPrice = neighbor.market.prices[rk];
                        if (typeof localPrice === 'number' && typeof neighborPrice === 'number' && localPrice > 0 && neighborPrice > 0) {
                            var pull = (neighborPrice - localPrice) * bgTradeRate;
                            town.market.prices[rk] = Math.round((localPrice + pull) * 100) / 100;
                        }
                    }
                }
            }

            // Natural demand (pop-based)— comprehensive for all goods
            // Food
            town.market.demand.bread = Math.ceil(pop * 0.8);
            town.market.demand.meat = Math.ceil(pop * 0.25);
            town.market.demand.poultry = Math.ceil(pop * 0.1);
            town.market.demand.eggs = Math.ceil(pop * 0.15);
            town.market.demand.fish = Math.ceil(pop * (town.isPort ? 0.3 : 0.05));
            town.market.demand.preserved_food = Math.ceil(pop * 0.05);

            // Raw material population demand
            town.market.demand.wheat = Math.ceil(pop * 0.05);
            town.market.demand.wood = Math.ceil(pop * 0.02);
            town.market.demand.wool = Math.ceil(pop * 0.01);

            // Livestock demand
            town.market.demand.livestock_cow = Math.ceil(pop * 0.002);
            town.market.demand.livestock_pig = Math.ceil(pop * 0.003);

            // Materials & daily needs
            town.market.demand.clothes = Math.ceil(pop * 0.05);
            town.market.demand.tools = Math.ceil(pop * 0.03);
            town.market.demand.furniture = Math.ceil(pop * 0.01);
            town.market.demand.rope = Math.ceil(pop * 0.01);

            // Luxury & comfort
            town.market.demand.wine = Math.ceil(pop * 0.03);
            town.market.demand.salt = Math.ceil(pop * 0.04);
            town.market.demand.jewelry = Math.ceil(pop * 0.005);

            // Construction
            town.market.demand.planks = Math.ceil(pop * 0.02);
            town.market.demand.bricks = Math.ceil(pop * 0.015);
            town.market.demand.stone = Math.ceil(pop * 0.01);

            // Military (scales with garrison and war status)
            const atWar = kingdom && kingdom.atWar && kingdom.atWar.size > 0;
            const militaryDemand = atWar ? 3 : 1;
            town.market.demand.swords = Math.ceil(town.garrison * 0.1 * militaryDemand);
            town.market.demand.armor = Math.ceil(town.garrison * 0.08 * militaryDemand);
            town.market.demand.bows = Math.ceil(town.garrison * 0.06 * militaryDemand);
            town.market.demand.arrows = Math.ceil(town.garrison * 0.3 * militaryDemand);
            town.market.demand.horses = Math.ceil(town.garrison * 0.03 * militaryDemand);
            town.market.demand.saddles = Math.ceil(town.garrison * 0.02 * militaryDemand);

            // Quality-tiered military demand (higher during war)
            if (atWar) {
                town.market.demand.swords_good = Math.ceil(town.garrison * 0.03);
                town.market.demand.armor_good = Math.ceil(town.garrison * 0.02);
                town.market.demand.bows_good = Math.ceil(town.garrison * 0.02);
                town.market.demand.arrows_good = Math.ceil(town.garrison * 0.05);
            }

            // Excellent-tier military demand (elite guard units)
            town.market.demand.swords_excellent = Math.ceil(town.garrison * 0.01 * militaryDemand);
            town.market.demand.armor_excellent = Math.ceil(town.garrison * 0.01 * militaryDemand);
            town.market.demand.bows_excellent = Math.ceil(town.garrison * 0.005 * militaryDemand);

            // Musical instruments demand
            const hasFestival = world.events.some(ev => ev.active &&
                (ev.type === 'trade_festival' || ev.type === 'instrument_festival') && ev.townId === town.id);
            const festivalMod = hasFestival ? 2.0 : 1.0;
            let instrumentMod = 1.0;
            if (town.isCapital) instrumentMod = 1.5;
            else if (town.category === 'city' || town.category === 'capital_city') instrumentMod = 1.25;
            else if (town.category === 'village') instrumentMod = 0.5;
            town.market.demand.drum = Math.ceil(pop * 0.005 * instrumentMod * festivalMod);
            town.market.demand.flute = Math.ceil(pop * 0.004 * instrumentMod * festivalMod);
            town.market.demand.lute = Math.ceil(pop * 0.003 * instrumentMod * festivalMod);
            town.market.demand.harp = Math.ceil(pop * 0.001 * instrumentMod * festivalMod);
            town.market.demand.hurdy_gurdy = Math.ceil(pop * 0.001 * instrumentMod * festivalMod);
            town.market.demand.gut_string = Math.ceil(pop * 0.002 * instrumentMod);

            // New luxury goods demand
            town.market.demand.silk = Math.ceil(pop * 0.003);
            town.market.demand.perfume = Math.ceil(pop * 0.002);
            town.market.demand.fine_clothes = Math.ceil(pop * 0.002);
            town.market.demand.tapestry = Math.ceil(pop * 0.001);
            town.market.demand.gold_goblet = Math.ceil(pop * 0.001);

            // Safety cap: prevent demand from exceeding reasonable population-based maximum
            var demandCap = Math.max(pop * 10, 100);
            for (var capKey in town.market.demand) {
                if (town.market.demand[capKey] > demandCap) {
                    town.market.demand[capKey] = demandCap;
                }
            }

            // Luxury demand: high-prosperity towns demand luxuries, low-prosperity don't
            var luxuryGoods = ['jewelry', 'wine', 'silk', 'fine_clothes', 'instruments', 'spices', 'perfume'];
            var prosperityLevel = town.prosperity || 50;
            for (var li = 0; li < luxuryGoods.length; li++) {
                var luxId = luxuryGoods[li];
                if (town.market.demand[luxId] !== undefined) {
                    if (prosperityLevel > 70) {
                        var luxBonus = (prosperityLevel - 70) / 30;
                        town.market.demand[luxId] = Math.ceil((town.market.demand[luxId] || 0) * (1 + luxBonus * 0.5));
                    } else if (prosperityLevel < 30) {
                        var luxPenalty = (30 - prosperityLevel) / 30;
                        town.market.demand[luxId] = Math.floor((town.market.demand[luxId] || 0) * (1 - luxPenalty * 0.8));
                    }
                }
            }

            // Prosperity update
            const tradeActivity = Object.values(town.market.supply).reduce((a, b) => a + b, 0);
            const buildingCount = town.buildings.length;
            town.prosperity = Math.max(0, Math.min(100,
                town.prosperity * 0.995 +
                0.005 * foodSatisfaction * 50 +
                0.002 * Math.min(buildingCount, 20) +
                0.001 * Math.min(tradeActivity, 500) * 0.1
            ));

            // Prosperity momentum
            if (!town._prevProsperity) town._prevProsperity = town.prosperity;
            var delta = town.prosperity - town._prevProsperity;
            if (delta > 0) town.prosperity += 0.3;  // Boom bonus
            else if (delta < 0) town.prosperity -= 0.2;  // Bust penalty
            town._prevProsperity = town.prosperity;
            town.prosperity = Math.max(0, Math.min(100, town.prosperity));

            // Player building prosperity boost
            if (typeof Player !== 'undefined') {
                try {
                    var playerBuildings = (town.buildings || []).filter(function(b) {
                        return b.ownerId === 'player';
                    });
                    if (playerBuildings.length > 0) {
                        var buildingBoost = playerBuildings.length * 0.1;
                        if (Player.hasSkill && Player.hasSkill('town_benefactor')) {
                            buildingBoost *= 2;
                        }
                        town.prosperity = Math.min(100, town.prosperity + buildingBoost);
                    }
                } catch(e) { /* player building boost failed silently */ }
            }

            // Player employer prosperity boost
            if (typeof Player !== 'undefined') {
                try {
                    var playerWorkers = (town.buildings || []).reduce(function(sum, b) {
                        return sum + (b.ownerId === 'player' && b.workers ? b.workers.length : 0);
                    }, 0);
                    if (playerWorkers > 0) {
                        town.prosperity = Math.min(100, town.prosperity + playerWorkers * 0.2);
                    }
                } catch(e) {}
            }

            // Player warehouse prosperity boost
            if (typeof Player !== 'undefined' && Player.warehouses) {
                try {
                    var warehouses = Player.warehouses;
                    if (Array.isArray(warehouses)) {
                        for (var wi = 0; wi < warehouses.length; wi++) {
                            var wh = warehouses[wi];
                            if (wh.townId === town.id && wh.inventory) {
                                var totalGoods = 0;
                                for (var gid in wh.inventory) {
                                    totalGoods += (wh.inventory[gid] || 0);
                                }
                                if (totalGoods > 10) {
                                    town.prosperity = Math.min(100, town.prosperity + 0.15);
                                }
                            }
                        }
                    }
                } catch(e) {}
            }

            // ---- Spoilage / decay system ----
            // Prevents infinite warehouse accumulation of perishable goods
            var popCap = (town.population || 50) * 20;
            for (var goodId in town.market.supply) {
                var qty = town.market.supply[goodId];
                if (qty <= 0) continue;

                // Hard cap: no single good exceeds population * 20
                if (qty > popCap) {
                    town.market.supply[goodId] = popCap;
                    qty = popCap;
                }

                var good = findResourceById(goodId);
                var decayRate = 0;

                if (good && good.category === 'food') {
                    decayRate = 0.02; // 2% per day for food
                } else if (good && good.category === 'raw') {
                    decayRate = 0.02; // 2% per day for raw goods
                } else if (good && good.category === 'processed') {
                    decayRate = 0.005; // 0.5% per day for processed
                } else if (good && good.category === 'finished') {
                    decayRate = 0.01; // 1% per day for finished goods (tools break, clothes wear out)
                }
                // Military, luxury goods don't decay

                if (decayRate > 0) {
                    var decay = Math.max(1, Math.floor(qty * decayRate));
                    town.market.supply[goodId] = Math.max(0, qty - decay);
                }
            }
            // Safety clamp: prevent negative and non-integer supply values
            for (var key in town.market.supply) {
                var sv = town.market.supply[key];
                if (sv < 0) { town.market.supply[key] = 0; }
                else if (sv !== (sv | 0)) { town.market.supply[key] = Math.floor(sv); }
            }
        }

        // ---- Production diagnostic log (end of daily tick) ----
        if (world.day % 30 === 0) {
            var diagTotals = {};
            for (var di = 0; di < world.towns.length; di++) {
                var dt = world.towns[di];
                for (var dKey in dt.market.supply) {
                    diagTotals[dKey] = (diagTotals[dKey] || 0) + (dt.market.supply[dKey] || 0);
                }
            }
            var diagParts = [];
            var diagKeys = Object.keys(diagTotals).sort();
            for (var dk = 0; dk < diagKeys.length; dk++) {
                if (diagTotals[diagKeys[dk]] > 0) {
                    diagParts.push(diagKeys[dk] + ':' + diagTotals[diagKeys[dk]]);
                }
            }
            if (typeof console !== 'undefined' && console.log) {
                console.log('[EconDiag] Day ' + world.day + ' global supply: ' + diagParts.join(', '));
            }
        }
    }

    function findBuildingType(typeId) {
        _ensureLookupMaps();
        return _buildingTypeMap[typeId] || null;
    }

    // Helper: Kingdom/NPC builds a building, checking materials & paying dynamic cost
    function kingdomBuild(kingdom, town, buildingTypeId, rng) {
        var bt = findBuildingType(buildingTypeId);
        if (!bt) return false;
        // Check material availability in town market
        var matCost = 0;
        if (bt.materials) {
            for (var matId in bt.materials) {
                var qty = bt.materials[matId];
                if ((town.market.supply[matId] || 0) < qty) return false;
                matCost += qty * (getMarketPrice(town, matId) || 5);
            }
        }
        var totalCost = (bt.cost || 0) + matCost;
        if (kingdom.gold < totalCost) return false;
        // Consume materials
        if (bt.materials) {
            for (var matId2 in bt.materials) {
                town.market.supply[matId2] = Math.max(0, (town.market.supply[matId2] || 0) - bt.materials[matId2]);
            }
        }
        kingdom.gold -= totalCost;
        town.buildings.push({ type: buildingTypeId, level: 1, ownerId: null, builtDay: world.day, condition: 'new', lastRepairDay: 0 });
        return true;
    }

    function countWorkersForBuilding(town, bld) {
        // Town-owned buildings auto-staff from townsfolk
        if (bld.ownerId === null) {
            const bt = findBuildingType(bld.type);
            return bt ? bt.workers : 0; // assume fully staffed for town buildings
        }
        // Player buildings track workers explicitly — handled by player.js
        if (bld.ownerId === 'player') {
            return bld.workers ? bld.workers.length : 0;
        }
        // Bug 3/4 fix: Kingdom-owned and NPC-owned buildings use explicit
        // workers if assigned, otherwise auto-staff from community
        if (bld.workers && bld.workers.length > 0) {
            return bld.workers.length;
        }
        const bt = findBuildingType(bld.type);
        return bt ? bt.workers : 0;
    }

    function consumeFromMarket(town, resId, qty) {
        const available = town.market.supply[resId] || 0;
        const consumed = Math.min(available, qty);
        if (consumed > 0) {
            town.market.supply[resId] -= consumed;
            // Bug 1 fix: collect trade tax on market consumption
            const price = getMarketPrice(town, resId);
            collectTradeTax(town.kingdomId, consumed * price, resId);
        }
        return consumed;
    }

    // ---- Worker skill helpers ----

    function getWorkerSkillTier(skill) {
        if (skill >= 81) return 'master';
        if (skill >= 61) return 'expert';
        if (skill >= 31) return 'skilled';
        return 'unskilled';
    }

    function getAverageWorkerSkill(bld, town) {
        if (bld.ownerId === null) {
            // Town buildings: estimate from town population
            var townPeople = (_tickCache.peopleByTown[town.id] || []);
            if (townPeople.length === 0) return 20;
            let total = 0, count = 0;
            for (const p of townPeople) {
                if (p.workerSkill != null) { total += p.workerSkill; count++; }
            }
            return count > 0 ? total / count : 20;
        }
        if (!bld.workers || bld.workers.length === 0) return 0;
        let total = 0, count = 0;
        for (const wid of bld.workers) {
            const w = findPerson(wid);
            if (w && w.alive && w.workerSkill != null) {
                total += w.workerSkill;
                count++;
            }
        }
        return count > 0 ? total / count : 0;
    }

    function applyWorkerXP(bld, town, targetTier, successes, failures) {
        // Compute learning bonus from upgrades
        let learningMult = 1.0;
        if (bld.upgrades && bld.upgrades.length > 0) {
            for (const upId of bld.upgrades) {
                const upg = CONFIG.WORKSHOP_UPGRADES[upId];
                if (upg) learningMult += upg.learningBonus;
            }
        }

        let baseXP;
        if (targetTier === 'basic') baseXP = 0.1;
        else if (targetTier === 'good') baseXP = 0.3;
        else baseXP = 0.5;

        const successXP = successes * baseXP * learningMult;
        const failXP = failures * (baseXP + 0.2) * learningMult;
        const totalXP = successXP + failXP;
        if (totalXP <= 0) return;

        if (bld.ownerId === null) return; // skip XP for town buildings

        if (!bld.workers || bld.workers.length === 0) return;
        const xpPerWorker = totalXP / bld.workers.length;

        for (const wid of bld.workers) {
            const w = findPerson(wid);
            if (!w || !w.alive) continue;
            if (w.workerSkill == null) w.workerSkill = 0;

            let personalXP = xpPerWorker;

            // Check if this worker is an apprentice (3x XP)
            if (bld.apprenticePairs) {
                const isApprentice = bld.apprenticePairs.some(pair => pair.apprenticeWorkerId === wid);
                if (isApprentice) personalXP *= 3;
            }

            w.workerSkill = Math.min(100, w.workerSkill + personalXP);
        }
    }

    function getAvailableWorkers(townId) {
        if (!world) return [];
        return world.people.filter(p =>
            p.alive && p.townId === townId &&
            !p.employerId &&
            p.age >= (CONFIG.COMING_OF_AGE || 14) &&
            (p.occupation === 'laborer' || p.occupation === 'craftsman' || p.occupation === 'farmer' || p.occupation === 'none') &&
            !p.trainingUntilDay
        ).map(p => ({
            id: p.id,
            name: p.firstName + ' ' + p.lastName,
            workerSkill: p.workerSkill || 0,
            skillTier: getWorkerSkillTier(p.workerSkill || 0),
            hireCost: CONFIG.WORKER_HIRE_COSTS[getWorkerSkillTier(p.workerSkill || 0)],
            weeklyWage: CONFIG.WORKER_WEEKLY_WAGES[getWorkerSkillTier(p.workerSkill || 0)],
            age: p.age,
            occupation: p.occupation,
        }));
    }

    function getWorkerHireCost(personId) {
        const p = findPerson(personId);
        if (!p) return 0;
        const tier = getWorkerSkillTier(p.workerSkill || 0);
        return CONFIG.WORKER_HIRE_COSTS[tier] || 10;
    }

    function getEventProductionMod(townId, bt) {
        let mod = 1;
        for (const ev of world.events) {
            if (!ev.active) continue;
            if (ev.townId && ev.townId !== townId) continue;
            if (ev.type === 'drought' && bt.category === 'farm') mod *= 0.5;
            if (ev.type === 'bountiful' && bt.category === 'farm') mod *= 2;
            if (ev.type === 'blight' && bt.category === 'farm') mod *= 0; // farms produce nothing during blight
            if (ev.type === 'trade_festival') mod *= 1.3;
        }
        return mod;
    }

    // ========================================================
    // §13 PERSON SIMULATION TICK
    // ========================================================
    function tickPeople() {
        const day = world.day;
        const newPeople = [];

        for (let i = 0; i < world.people.length; i++) {
            const p = world.people[i];
            if (!p.alive) continue;

            // ---- Needs decay ----
            if (!p.needs) p.needs = { food: 80, shelter: 80, safety: 80, wealth: 50 };
            p.needs.food = Math.max(0, p.needs.food - CONFIG.NEED_DECAY_RATE);
            p.needs.shelter = Math.max(0, p.needs.shelter - CONFIG.NEED_DECAY_RATE * 0.5);
            p.needs.safety = Math.max(0, p.needs.safety - CONFIG.NEED_DECAY_RATE * 0.3);
            p.needs.wealth = Math.max(0, p.needs.wealth - CONFIG.NEED_DECAY_RATE * 0.2);

            // ---- Gold floor (prevent floating-point drift below 0) ----
            if (p.gold < 0) p.gold = 0;

            // ---- Employment income ----
            const town = findTown(p.townId);
            if (p.occupation !== 'none' && p.occupation !== 'noble' && !p.employerId) {
                const occData = OCCUPATIONS[p.occupation.toUpperCase()];
                if (occData && town) {
                    // Indentured servants: wages go to kingdom treasury
                    if (p.status === 'indentured' && p.servitudeKingdomId) {
                        const servK = findKingdom(p.servitudeKingdomId);
                        if (servK) servK.gold += occData.wage;
                    } else {
                        p.gold += occData.wage;
                    }
                    // Restore food need if town has food
                    if (p.gold >= 1) {
                        const foodAvail = (town.market.supply.bread || 0) + (town.market.supply.wheat || 0);
                        if (foodAvail > 0) {
                            p.needs.food = Math.min(100, p.needs.food + 15);
                            p.gold -= 1;
                        }
                    }
                }
            }

            // Track unemployment for migration
            if (p.occupation === 'none' || p.occupation === 'laborer') {
                p._unemployedDays = (p._unemployedDays || 0) + 1;
            } else {
                p._unemployedDays = 0;
            }

            // ---- Shelter/safety needs from town ----
            if (town) {
                p.needs.shelter = Math.min(100, p.needs.shelter + 5);
                p.needs.safety = Math.min(100, p.needs.safety + (town.garrison > 5 ? 5 : 2));
                // Town food safety net: subsistence farming/foraging keeps people alive
                if (p.needs.food < 20 && p.gold < 1) {
                    p.needs.food = Math.min(100, p.needs.food + 5);
                }
            }

            // ---- Starvation ----
            if (p.needs.food <= 0) {
                if (world.rng.chance(0.003)) {
                    killPerson(p, 'starvation');
                    continue;
                }
                // Starving people try to migrate more urgently
                if (world.rng.chance(0.02) && town) {
                    // Never migrate the player's spouse or children
                    const isPlayerFamily = p.spouseId === 'player' || (p.parentIds && p.parentIds.includes('player'));
                    if (!isPlayerFamily) {
                    const betterTowns = world.towns.filter(t =>
                        t.id !== p.townId && t.prosperity > 20
                    );
                    if (betterTowns.length > 0) {
                        const dest = world.rng.pick(betterTowns);
                        town.population--;
                        p.townId = dest.id;
                        p.kingdomId = dest.kingdomId;
                        dest.population++;
                        p.needs.food = 30;
                    }
                    }
                }
            }

            // ---- Happiness ----
            // Citizen happiness drifts toward a blend of their basic needs and their town's happiness
            const avgNeeds = (p.needs.food + p.needs.shelter + p.needs.safety + p.needs.wealth) / 4;
            const townObj = findTown(p.townId);
            const townHappy = townObj ? (townObj.happiness || 50) : 50;
            const needsTarget = avgNeeds * 0.6 + townHappy * 0.4;
            p.needs.happiness = Math.max(0, Math.min(100,
                p.needs.happiness * 0.93 + needsTarget * 0.07
            ));

            // ---- Wealth class update (every 30 days) ----
            if (day % 30 === 0) {
                if (p.gold >= 500) p.wealthClass = 'upper';
                else if (p.gold >= 100) p.wealthClass = 'middle';
                else p.wealthClass = 'lower';
            }

            // ---- Aging ----
            if (day % (CONFIG.DAYS_PER_SEASON * 4) === 0) {
                p.age++;
                // Children come of age
                if (p.age === CONFIG.COMING_OF_AGE) {
                    p.occupation = world.rng.pick(['farmer', 'laborer', 'craftsman', 'miner', 'woodcutter']);
                    p.skills = { farming: 10, mining: 10, crafting: 10, trading: 10, combat: 10 };
                    if (p.workerSkill == null) p.workerSkill = world.rng.randInt(5, 20);
                    // Starting gold for newly adult NPCs
                    p.gold = (p.gold || 0) + 20;
                    // Elite merchant children get a head start
                    if (p.parentIds && p.parentIds.length > 0) {
                        var hasEliteParent = p.parentIds.some(function(pid) {
                            var par = findPerson(pid);
                            return par && par.isEliteMerchant;
                        });
                        if (hasEliteParent) {
                            p.skills.trading = Math.min(100, p.skills.trading + 20);
                            p.gold = (p.gold || 0) + 50;
                        }
                    }
                }
                // Old age death
                if (p.age >= CONFIG.DEATH_AGE_MIN) {
                    // Use same gentle curve as player: 0.05% per year over min age, per day
                    const deathChance = 0.0005 * (p.age - CONFIG.DEATH_AGE_MIN);
                    if (p.age >= CONFIG.DEATH_AGE_MAX || world.rng.chance(deathChance)) {
                        killPerson(p, 'old age');
                        continue;
                    }
                }
                // Worker retirement
                if (p.age >= CONFIG.WORKER_RETIRE_AGE_MIN && p.employerId) {
                    const retireAge = CONFIG.WORKER_RETIRE_AGE_MIN + world.rng.randInt(0, CONFIG.WORKER_RETIRE_AGE_MAX - CONFIG.WORKER_RETIRE_AGE_MIN);
                    if (p.age >= retireAge) {
                        removeWorkerFromBuilding(p);
                        p.employerId = null;
                        logEvent(`${p.firstName} ${p.lastName} has retired from work.`);
                    }
                }
            }

            // ---- Training completion ----
            if (p.trainingUntilDay && day >= p.trainingUntilDay) {
                if (p.workerSkill == null) p.workerSkill = 0;
                p.workerSkill = Math.min(100, p.workerSkill + CONFIG.WORKER_TRAINING_SKILL_GAIN);
                delete p.trainingUntilDay;
                logEvent(`${p.firstName} ${p.lastName} returned from training (skill: ${Math.floor(p.workerSkill)}).`);
            }

            // ---- Wage demands (skilled workers periodically demand raises) ----
            if (p.employerId && (p.workerSkill || 0) >= CONFIG.WORKER_WAGE_DEMAND_MIN_SKILL && !p.wageDemand) {
                if (!p._nextWageDemandDay) {
                    p._nextWageDemandDay = day + world.rng.randInt(CONFIG.WORKER_WAGE_DEMAND_MIN_INTERVAL, CONFIG.WORKER_WAGE_DEMAND_MAX_INTERVAL);
                }
                if (day >= p._nextWageDemandDay) {
                    const tier = getWorkerSkillTier(p.workerSkill || 0);
                    const baseWage = CONFIG.WORKER_WEEKLY_WAGES[tier] || 2;
                    const currentWage = p.currentWage || baseWage;
                    const demandIncrease = 1 + world.rng.randFloat(0.10, 0.25);
                    p.wageDemand = {
                        amount: Math.ceil(currentWage * demandIncrease),
                        deadline: day + 14,
                    };
                    p._nextWageDemandDay = null;
                }
            }

            // ---- Wage demand deadline reached without response ----
            if (p.wageDemand && day >= p.wageDemand.deadline) {
                const roll = world.rng.random();
                if (roll < 0.50) {
                    // Leave
                    removeWorkerFromBuilding(p);
                    p.employerId = null;
                    logEvent(`${p.firstName} ${p.lastName} quit over wages.`);
                } else if (roll < 0.80) {
                    // Stay unhappy — productivity penalty for 30 days
                    p.unhappyUntilDay = day + 30;
                }
                // 20% just accept
                delete p.wageDemand;
                p._nextWageDemandDay = day + world.rng.randInt(CONFIG.WORKER_WAGE_DEMAND_MIN_INTERVAL, CONFIG.WORKER_WAGE_DEMAND_MAX_INTERVAL);
            }

            // ---- Marriage ----
            // Skip if player is currently courting this NPC (relationship >= 20 and romantic type)
            let isPlayerTarget = false;
            if (typeof Player !== 'undefined' && Player.getRelationship) {
                const pRel = Player.getRelationship(p.id);
                if (pRel && pRel.level >= 20 && Player.state && !Player.state.spouseId) {
                    isPlayerTarget = true;
                }
            }
            if (!isPlayerTarget && !p.spouseId && p.age >= CONFIG.MARRIAGE_MIN_AGE && world.rng.chance(0.002)) {
                const candidates = world.people.filter(c =>
                    c.alive && !c.spouseId &&
                    c.sex !== p.sex &&
                    c.townId === p.townId &&
                    c.age >= CONFIG.MARRIAGE_MIN_AGE &&
                    c.id !== p.id
                );
                if (candidates.length > 0) {
                    const spouse = world.rng.pick(candidates);
                    p.spouseId = spouse.id;
                    spouse.spouseId = p.id;
                }
            }

            // ---- Elite Merchant Marriage (higher chance, logged) ----
            if (p.isEliteMerchant && !p.spouseId && p.age >= 18 && p.age <= 50) {
                if (world.rng.chance(0.005)) {
                    var emCandidates = world.people.filter(function(c) {
                        return c.alive && c.townId === p.townId && c.sex !== p.sex &&
                               !c.spouseId && c.age >= 16 && c.age <= 50 && c.id !== p.id;
                    });
                    if (emCandidates.length > 0) {
                        var emSpouse = emCandidates[Math.floor(world.rng.random() * emCandidates.length)];
                        p.spouseId = emSpouse.id;
                        emSpouse.spouseId = p.id;
                        var emTown = findTown(p.townId);
                        logEvent(p.firstName + ' ' + (p.lastName || '') + ' married ' + emSpouse.firstName + ' in ' + (emTown ? emTown.name : 'town') + '.');
                    }
                }
            }

            // ---- Children ----
            // NPC pregnancy: cooldown after birth (270 days), enforce MAX_CHILDREN (8)
            if (p.spouseId && p.sex === 'F' && p.age >= CONFIG.MARRIAGE_MIN_AGE && p.age <= 45) {
                const aliveChildren = p.childrenIds ? p.childrenIds.filter(cid => { const c = findPerson(cid); return c && c.alive; }).length : 0;
                const pastCooldown = !p._lastBirthDay || (day - p._lastBirthDay) >= 270;
                if (pastCooldown && aliveChildren < (CONFIG.MAX_CHILDREN || 8)) {
                // Soft cap: reduce birth probability as population approaches cap
                var totalPop = world._alivePopCount || 0;
                var popRatio = totalPop / CONFIG.WORLD_POP_CAP;
                var adjustedProb = CONFIG.CHILD_PROBABILITY * Math.max(0.1, 1 - popRatio * 0.8);
                if (world.rng.chance(adjustedProb)) {
                // World population cap check (uses cached alive count)
                if (totalPop >= CONFIG.WORLD_POP_CAP) { /* skip birth */ }
                else {
                const father = findPerson(p.spouseId);
                if (father && father.alive && father.townId === p.townId) {
                    const childSex = world.rng.chance(0.5) ? 'M' : 'F';
                    const child = {
                        id: uid('p'),
                        firstName: childSex === 'M' ? world.rng.pick(NAMES.male) : world.rng.pick(NAMES.female),
                        lastName: father.lastName,
                        age: 0,
                        sex: childSex,
                        alive: true,
                        townId: p.townId,
                        kingdomId: p.kingdomId,
                        occupation: 'none',
                        employerId: null,
                        needs: { food: 80, shelter: 80, safety: 80, wealth: 50, happiness: 80 },
                        gold: 0,
                        wealthClass: p.wealthClass || 'lower',
                        skills: { farming: 0, mining: 0, crafting: 0, trading: 0, combat: 0 },
                        workerSkill: 0,
                        spouseId: null,
                        childrenIds: [],
                        parentIds: [p.id, father.id],
                    };
                    p.childrenIds.push(child.id);
                    father.childrenIds.push(child.id);
                    p._lastBirthDay = day; // 270-day cooldown starts
                    newPeople.push(child);
                    if (town) town.population++;
                    if (world._alivePopCount != null) world._alivePopCount++;
                }
                } // end pop cap else
                } // end chance check
                }
            }

            // ---- Migration (enhanced with disaster/war triggers) ----
            if (town) {
                // Never migrate the player's spouse or children
                const isPlayerFamily = p.spouseId === 'player' || (p.parentIds && p.parentIds.includes('player'));

                let migrateChance = 0;
                let migrateReason = '';

                // Plague migration — flee plague-stricken towns
                const hasPlague = world.events.some(ev => ev.active &&
                    (ev.type === 'plague' || ev.type === 'plague_disaster') && ev.townId === town.id);
                if (hasPlague) {
                    migrateChance = Math.max(migrateChance, CONFIG.MIGRATION_PLAGUE_CHANCE);
                    migrateReason = 'plague';
                }

                // War migration — flee recently attacked/warring towns
                const kingdom = findKingdom(town.kingdomId);
                if (kingdom && kingdom.atWar && kingdom.atWar.size > 0) {
                    migrateChance = Math.max(migrateChance, CONFIG.MIGRATION_WAR_CHANCE);
                    migrateReason = migrateReason || 'war';
                }

                // Starvation migration
                if (p.needs.food <= 10) {
                    migrateChance = Math.max(migrateChance, CONFIG.MIGRATION_HUNGER_CHANCE);
                    migrateReason = migrateReason || 'famine';
                }

                // Low happiness migration (original behavior)
                if (p.needs.happiness < 20) {
                    migrateChance = Math.max(migrateChance, CONFIG.MIGRATION_LOW_HAPPINESS_CHANCE);
                    migrateReason = migrateReason || 'unhappiness';
                }

                if (migrateChance > 0 && !isPlayerFamily && world.rng.chance(migrateChance)) {
                    // Pick destination: safe towns with higher prosperity
                    const safeTowns = world.towns.filter(t => {
                        if (t.id === p.townId) return false;
                        if (t.prosperity < 15) return false;
                        // Avoid plague towns
                        const destPlague = world.events.some(ev => ev.active &&
                            (ev.type === 'plague' || ev.type === 'plague_disaster') && ev.townId === t.id);
                        if (destPlague) return false;
                        // Prefer peaceful kingdoms
                        const destK = findKingdom(t.kingdomId);
                        if (migrateReason === 'war' && destK && destK.atWar && destK.atWar.size > 0) return false;
                        return true;
                    });
                    if (safeTowns.length > 0) {
                        // Prefer higher prosperity destinations
                        safeTowns.sort((a, b) => b.prosperity - a.prosperity);
                        const dest = safeTowns.length > 3 ? world.rng.pick(safeTowns.slice(0, 3)) : world.rng.pick(safeTowns);
                        town.population--;
                        p.townId = dest.id;
                        p.kingdomId = dest.kingdomId;
                        dest.population++;
                        if (p.needs.food <= 10) p.needs.food = 30;

                        // Track migration for wave events
                        if (!town._migrationCount) town._migrationCount = { day: world.day, count: 0, dest: dest.id };
                        if (town._migrationCount.day === world.day) {
                            town._migrationCount.count++;
                            if (town._migrationCount.count === CONFIG.MIGRATION_WAVE_THRESHOLD) {
                                logEvent(`🏃 Refugees from ${town.name} are flooding into ${dest.name}!`, {
                                    type: 'refugees',
                                    townId: dest.id,
                                    cause: hasPlague ? 'A plague in ' + town.name + ' is driving people away.' :
                                           migrateReason === 'war' ? 'War threatens ' + town.name + ', forcing civilians to flee.' :
                                           migrateReason === 'famine' ? 'Famine in ' + town.name + ' \u2014 people seek food elsewhere.' :
                                           'Low happiness in ' + town.name + ' (' + Math.round(town.happiness || 0) + '%) is causing an exodus.',
                                    effects: [
                                        dest.name + ' population is increasing rapidly',
                                        town.name + ' is losing workers and tax base',
                                        'Increased food demand in ' + dest.name,
                                        'Housing pressure in ' + dest.name + ' may rise',
                                        'Some refugees may bring skills and trade goods'
                                    ]
                                }, 'local_town');
                            }
                        } else {
                            town._migrationCount = { day: world.day, count: 1, dest: dest.id };
                        }
                    }
                }
            }

            // Update town happiness (reduced from 0.01 to 0.002 per person to prevent lock-at-100)
            if (town) {
                town.happiness = Math.max(0, Math.min(100,
                    town.happiness + (p.needs.happiness > 50 ? 0.002 : -0.005)
                ));
            }
        }

        // Add newborn people
        for (const np of newPeople) world.people.push(np);
    }

    function removeWorkerFromBuilding(p) {
        if (!p) return;
        // Remove from any building's worker list and apprentice pairs
        for (const town of world.towns) {
            for (const bld of town.buildings) {
                if (bld.workers) {
                    const idx = bld.workers.indexOf(p.id);
                    if (idx !== -1) bld.workers.splice(idx, 1);
                }
                if (bld.apprenticePairs) {
                    bld.apprenticePairs = bld.apprenticePairs.filter(
                        pair => pair.masterWorkerId !== p.id && pair.apprenticeWorkerId !== p.id
                    );
                }
            }
        }
    }

    function killPerson(p, cause) {
        // Child protection system — children are much harder to kill
        if (cause !== 'old age') {
            const isPlayerChild = p.id && p.id.startsWith('p_child_');
            const isPlayerSpouse = p.spouseId === 'player';
            const isUnderAge = p.age != null && p.age < CONFIG.COMING_OF_AGE;

            // Player's spouse: very high protection (95% chance to survive)
            if (isPlayerSpouse) {
                if (world.rng.chance(0.95)) return;
            }
            // Player children under 18: fully immune
            if (isPlayerChild && isUnderAge) return;
            // Player children 18+: very high protection (95%)
            if (isPlayerChild && !isUnderAge) {
                if (world.rng.chance(0.95)) return;
            }

            // Elite merchant children under 18: near-immune
            if (isUnderAge && p.parentIds && p.parentIds.length > 0) {
                const hasEliteParent = p.parentIds.some(function(pid) {
                    const par = findPerson(pid);
                    return par && par.isEliteMerchant;
                });
                if (hasEliteParent && world.rng.chance(0.995)) return;
            }

            // All other NPC children under 18: decent protection
            if (isUnderAge && !isPlayerChild) {
                if (world.rng.chance(0.85)) return;
            }
        }
        p.alive = false;
        const town = findTown(p.townId);
        if (town) town.population = Math.max(0, town.population - 1);
        if (world._alivePopCount != null) world._alivePopCount--;

        // Remove from building workers
        removeWorkerFromBuilding(p);

        // Elite merchant dynasty inheritance
        if (p.isEliteMerchant) {
            p._deathDay = world.day;
            var heir = null;
            // Priority 1: chosen heir
            if (p.heirId) {
                var chosenHeir = findPerson(p.heirId);
                if (chosenHeir && chosenHeir.alive && chosenHeir.age >= 16) heir = chosenHeir;
            }
            // Priority 2: eldest living child aged 16+
            if (!heir && p.childrenIds && p.childrenIds.length > 0) {
                var eligibleChildren = p.childrenIds
                    .map(function(cid) { return findPerson(cid); })
                    .filter(function(c) { return c && c.alive && c.age >= 16; })
                    .sort(function(a, b) { return b.age - a.age; });
                if (eligibleChildren.length > 0) heir = eligibleChildren[0];
            }
            // Priority 3: spouse
            if (!heir && p.spouseId) {
                var sp = findPerson(p.spouseId);
                if (sp && sp.alive) heir = sp;
            }
            // Priority 4: eldest living sibling
            if (!heir && p.parentIds && p.parentIds.length > 0) {
                for (var pi = 0; pi < p.parentIds.length && !heir; pi++) {
                    var parent = findPerson(p.parentIds[pi]);
                    if (parent && parent.childrenIds) {
                        var eligibleSiblings = parent.childrenIds
                            .map(function(sid) { return findPerson(sid); })
                            .filter(function(s) { return s && s.alive && s.id !== p.id && s.age >= 16; })
                            .sort(function(a, b) { return b.age - a.age; });
                        if (eligibleSiblings.length > 0) heir = eligibleSiblings[0];
                    }
                }
            }

            // Find index in world.eliteMerchants
            var eliteIdx = -1;
            if (world.eliteMerchants) {
                for (var emi = 0; emi < world.eliteMerchants.length; emi++) {
                    if (world.eliteMerchants[emi].id === p.id) { eliteIdx = emi; break; }
                }
            }

            if (heir) {
                // 15% death tax
                var inheritedGold = Math.floor((p.gold || 0) * 0.85);
                heir.gold = (heir.gold || 0) + inheritedGold;
                heir.isEliteMerchant = true;
                heir.occupation = 'merchant';
                heir.wealthClass = 'upper';
                heir.npcMerchantInventory = p.npcMerchantInventory || {};
                heir.npcMerchantCooldown = p.npcMerchantCooldown || 0;
                // Transfer heraldry
                heir.heraldry = p.heraldry;
                // Transfer building ownership
                if (p.buildings && p.buildings.length > 0) {
                    heir.buildings = (heir.buildings || []).concat(p.buildings);
                    // Update ownerId on actual town buildings across all towns
                    var processedTowns = {};
                    for (var bi = 0; bi < p.buildings.length; bi++) {
                        var bRef = p.buildings[bi];
                        var tId = bRef.townId || (town ? town.id : null);
                        if (tId && !processedTowns[tId]) {
                            processedTowns[tId] = true;
                            var bTown = findTown(tId);
                            if (bTown) {
                                for (var bj = 0; bj < bTown.buildings.length; bj++) {
                                    if (bTown.buildings[bj].ownerId === p.id) {
                                        bTown.buildings[bj].ownerId = heir.id;
                                    }
                                }
                            }
                        }
                    }
                }
                // Heir personality: influenced by parent but partially randomized
                if (p.personality && world.rng) {
                    var pp = p.personality;
                    heir.personality = heir.personality || {};
                    var traits = ['ambition', 'greed', 'risk_tolerance', 'honesty', 'social', 'loyalty', 'militarism', 'patience'];
                    for (var ti2 = 0; ti2 < traits.length; ti2++) {
                        var t = traits[ti2];
                        var parentVal = pp[t] || 50;
                        var heirVal = Math.floor(parentVal * 0.5 + (world.rng.random() + world.rng.random()) / 2 * 100 * 0.5);
                        heir.personality[t] = Math.max(0, Math.min(100, heirVal));
                    }
                }
                // Heir may inherit strategy or pick new one
                if (world.rng && world.rng.chance(0.6)) {
                    heir.strategy = p.strategy;
                } else {
                    heir.strategy = null;
                    heir._eliteFieldsInit = false;
                }
                // Relationships reset: 15% retention toward baseline
                heir.relationships = {};
                if (p.relationships) {
                    for (var relId in p.relationships) {
                        var oldLevel = p.relationships[relId].level || 0;
                        if (oldLevel > 20) {
                            heir.relationships[relId] = { level: Math.floor(oldLevel * 0.15), type: 'acquaintance' };
                        }
                    }
                }
                // Transfer social rank & reputation
                heir.socialRank = p.socialRank || {};
                heir.reputation = p.reputation || {};
                heir.citizenshipKingdomId = p.citizenshipKingdomId;
                heir.familyName = p.familyName || p.lastName;

                p.buildings = [];
                p.npcMerchantInventory = {};
                p.isEliteMerchant = false;

                // Replace in world.eliteMerchants at same index
                if (eliteIdx >= 0 && world.eliteMerchants) {
                    world.eliteMerchants[eliteIdx] = heir;
                }

                logEvent('The merchant dynasty of ' + (p.lastName || p.firstName) + ' passes to ' + heir.firstName + ' ' + (heir.lastName || '') + '.', {
                    type: 'elite_succession',
                    cause: p.firstName + ' ' + (p.lastName || '') + ' has died at age ' + p.age + '.',
                    effects: [
                        heir.firstName + ' inherits ' + Math.floor(inheritedGold) + 'g (after 15% death tax)',
                        'Buildings and inventory transferred to heir',
                        'The merchant dynasty continues under new leadership'
                    ]
                });
            } else {
                // No heir — estate liquidated
                if (p.buildings && p.buildings.length > 0 && town) {
                    var processedTowns2 = {};
                    for (var ui = 0; ui < p.buildings.length; ui++) {
                        var ubRef = p.buildings[ui];
                        var utId = ubRef.townId || town.id;
                        if (!processedTowns2[utId]) {
                            processedTowns2[utId] = true;
                            var uTown = findTown(utId);
                            if (uTown) {
                                for (var uj = 0; uj < uTown.buildings.length; uj++) {
                                    if (uTown.buildings[uj].ownerId === p.id) {
                                        uTown.buildings[uj].ownerId = null;
                                    }
                                }
                            }
                        }
                    }
                }
                // Gold distributed to kingdom treasury
                var kingdom2 = findKingdom(p.kingdomId);
                if (kingdom2) kingdom2.gold = (kingdom2.gold || 0) + Math.floor((p.gold || 0) * 0.5);
                p.buildings = [];
                p.npcMerchantInventory = {};
                p.isEliteMerchant = false;

                // Remove from world.eliteMerchants (ensureEliteMerchantCount will refill)
                if (eliteIdx >= 0 && world.eliteMerchants) {
                    world.eliteMerchants.splice(eliteIdx, 1);
                }

                logEvent('The ' + (p.lastName || p.firstName) + ' merchant empire has collapsed \u2014 their buildings are now for sale!', {
                    type: 'elite_collapse',
                    cause: p.firstName + ' ' + (p.lastName || '') + ' died with no eligible heir.',
                    effects: [
                        'Buildings are now available for purchase',
                        '50% of estate (' + Math.floor((p.gold || 0) * 0.5) + 'g) goes to kingdom treasury',
                        'A new elite merchant will eventually rise to fill the void'
                    ]
                }, 'npc_activity');
            }
        }

        // Widower
        if (p.spouseId) {
            const spouse = findPerson(p.spouseId);
            if (spouse) spouse.spouseId = null;
        }

        // Check if this person was a king
        for (const k of world.kingdoms) {
            if (k.king === p.id) {
                handleKingDeath(k, cause);
            }
        }
    }

    function hasSpecialLaw(kingdom, lawId) {
        if (!kingdom || !kingdom.laws || !kingdom.laws.specialLaws) return false;
        return kingdom.laws.specialLaws.some(l => l.id === lawId);
    }

    function handleKingDeath(kingdom, cause) {
        const rng = world.rng;
        const deadKing = findPerson(kingdom.king);
        const kingName = deadKing ? (deadKing.firstName + ' ' + deadKing.lastName) : 'The King';
        logEvent(`${kingName} of ${kingdom.name} has died (${cause})! Succession triggered.`, null, 'sensitive_intel');
        // Heir dies → grieving mood for new king
        kingdom._kingDeathCause = cause;
        var allowFemaleHeirs = hasSpecialLaw(kingdom, 'female_heir_law');

        // --- PROPER SUCCESSION ORDER ---
        let newKing = null;

        // 1. King's eldest living child (age 18+)
        if (deadKing && deadKing.childrenIds && deadKing.childrenIds.length > 0) {
            const children = deadKing.childrenIds
                .map(id => findPerson(id))
                .filter(c => c && c.alive && c.age >= CONFIG.COMING_OF_AGE && (allowFemaleHeirs || c.sex === 'M'))
                .sort((a, b) => b.age - a.age); // eldest first
            if (children.length > 0) {
                newKing = children[0];
            }
        }

        // 2. King's siblings (via shared parentIds OR shared last name in same kingdom)
        if (!newKing && deadKing) {
            let siblings = [];
            // Try parentIds match first
            if (deadKing.parentIds && deadKing.parentIds.length > 0) {
                siblings = world.people.filter(p =>
                    p.alive && p.id !== deadKing.id &&
                    p.age >= CONFIG.COMING_OF_AGE &&
                    p.parentIds && p.parentIds.some(pid => deadKing.parentIds.includes(pid))
                ).sort((a, b) => b.age - a.age);
            }
            // Fallback: same last name + same kingdom (catches royal family even with dead parent IDs)
            if (siblings.length === 0 && deadKing.lastName) {
                siblings = world.people.filter(p =>
                    p.alive && p.id !== deadKing.id &&
                    p.age >= CONFIG.COMING_OF_AGE &&
                    p.lastName === deadKing.lastName &&
                    p.kingdomId === kingdom.id
                ).sort((a, b) => b.age - a.age);
            }
            if (siblings.length > 0) {
                newKing = siblings[0];
            }
        }

        // 3. Royal Advisor Election (if no family heir)
        if (!newKing) {
            updateRoyalAdvisors(kingdom);
            const advisors = (kingdom.royalAdvisors || [])
                .map(id => findPerson(id))
                .filter(a => a && a.alive);

            if (advisors.length > 0) {
                logEvent(`${kingName} has died with no heir. The Royal Council of ${kingdom.name} convenes to elect a new ruler.`);

                // Check if player is an advisor in this kingdom
                const playerAdvisorId = _checkPlayerIsAdvisor(kingdom);

                // Advisors vote: each votes for the advisor with highest combined score
                const scores = {};
                for (const adv of advisors) {
                    scores[adv.id] = (adv.gold || 0) * 0.001 +
                        (adv.personality ? adv.personality.intelligence || 0 : 50) * 0.5 +
                        (adv.personality ? adv.personality.ambition || 0 : 50) * 0.3 +
                        rng.randFloat(0, 20);
                }
                // If player is advisor, boost their score
                if (playerAdvisorId) {
                    scores[playerAdvisorId] = (scores[playerAdvisorId] || 0) + 30;
                }

                // Multiple rounds until majority
                let elected = null;
                for (let round = 0; round < CONFIG.SUCCESSION_ELECTION_ROUNDS_MAX; round++) {
                    const votes = {};
                    for (const voter of advisors) {
                        // Each advisor votes for the highest-scoring other advisor
                        let bestId = null;
                        let bestScore = -1;
                        for (const candidate of advisors) {
                            if (candidate.id === voter.id) continue;
                            const s = (scores[candidate.id] || 0) + rng.randFloat(-5, 5);
                            if (s > bestScore) { bestScore = s; bestId = candidate.id; }
                        }
                        if (bestId) votes[bestId] = (votes[bestId] || 0) + 1;
                    }
                    // Check for majority
                    const majority = Math.ceil(advisors.length / 2);
                    for (const [id, count] of Object.entries(votes)) {
                        if (count >= majority) {
                            elected = findPerson(id);
                            break;
                        }
                    }
                    if (elected) break;
                    // Eliminate lowest vote-getter for next round
                    let lowestId = null, lowestVotes = Infinity;
                    for (const adv of advisors) {
                        const v = votes[adv.id] || 0;
                        if (v < lowestVotes) { lowestVotes = v; lowestId = adv.id; }
                    }
                    if (lowestId) {
                        const idx = advisors.findIndex(a => a.id === lowestId);
                        if (idx >= 0) advisors.splice(idx, 1);
                    }
                    if (advisors.length <= 1) { elected = advisors[0] || null; break; }
                }

                if (!elected && advisors.length > 0) {
                    elected = advisors.sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))[0];
                }

                if (elected) {
                    // Check if the elected advisor is the player
                    if (playerAdvisorId && elected.id === playerAdvisorId) {
                        // Player wins the election! Trigger player-as-king
                        logEvent(`${elected.firstName} ${elected.lastName} (YOU) has been elected King/Queen of ${kingdom.name}!`);
                        if (typeof Player !== 'undefined' && Player.becomeKing) {
                            Player.becomeKing(kingdom.id);
                        }
                        return;
                    }
                    newKing = elected;
                    logEvent(`${elected.firstName} ${elected.lastName} has been elected King/Queen of ${kingdom.name}!`);
                }
            }
        }

        // 4. Fallback: find best suitable person (prefer nobles, wealthy, older)
        if (!newKing) {
            const fallbackCandidates = world.people.filter(p =>
                p.alive && p.kingdomId === kingdom.id && p.age >= CONFIG.COMING_OF_AGE && !isAlreadyKing(p.id)
            );
            if (fallbackCandidates.length > 0) {
                fallbackCandidates.sort((a, b) => {
                    let sa = 0, sb = 0;
                    if (a.occupation === 'noble') sa += 50;
                    if (b.occupation === 'noble') sb += 50;
                    if (a.occupation === 'elite_merchant') sa += 30;
                    if (b.occupation === 'elite_merchant') sb += 30;
                    sa += Math.min(a.age, 60); sb += Math.min(b.age, 60);
                    sa += Math.min((a.gold || 0), 5000) * 0.01;
                    sb += Math.min((b.gold || 0), 5000) * 0.01;
                    return sb - sa;
                });
                newKing = fallbackCandidates[0];
            }
        }

        // Determine succession crisis severity
        var crisisSeverity = 'minor'; // default: heir exists
        
        if (!newKing) {
            crisisSeverity = 'extreme'; // no heir at all
        } else if (newKing.sex === 'F' && !allowFemaleHeirs) {
            // Only a female heir but kingdom doesn't allow female succession
            crisisSeverity = 'extreme';
            newKing = null; // reject the female heir
            logEvent('⚠️ ' + kingdom.name + ' does not recognize female succession! The throne is contested.', null, 'sensitive_intel');
        } else if (newKing.age < CONFIG.COMING_OF_AGE) {
            crisisSeverity = 'major'; // child heir = regency contest
        }

        // Trigger crisis
        triggerSuccessionCrisis(kingdom, crisisSeverity, deadKing);

        if (newKing) {
            installNewKing(kingdom, newKing, cause);
        } else {
            kingdom.king = null;
            logEvent(`${kingdom.name} has no heir! The kingdom falls into chaos.`);
        }
    }

    // Emergency succession recovery for kingless kingdoms
    function attemptEmergencySuccession(kingdom) {
        // Also fire if king ID is set but person doesn't exist (ghost king)
        if (kingdom.king && findPerson(kingdom.king) && findPerson(kingdom.king).alive) return;
        const rng = world.rng;

        // Find the best candidate from kingdom's living adults
        const candidates = world.people.filter(p =>
            p.alive && p.kingdomId === kingdom.id && p.age >= (CONFIG.COMING_OF_AGE || 18) && !isAlreadyKing(p.id)
        );
        if (candidates.length === 0) return; // Kingdom is truly empty

        // Score candidates: prefer nobles, wealthy, high reputation, older
        const scored = candidates.map(p => {
            let score = 0;
            if (p.occupation === 'noble') score += 50;
            if (p.occupation === 'elite_merchant') score += 30;
            score += Math.min(p.age, 60) * 0.5; // Prefer mature but not ancient
            score += Math.min((p.gold || 0), 5000) * 0.01; // Wealth matters
            if (p.socialRank && p.socialRank[kingdom.id]) score += p.socialRank[kingdom.id] * 10;
            return { person: p, score: score };
        }).sort((a, b) => b.score - a.score);

        if (scored.length === 0) return; // Safety: no viable candidates
        const newKing = scored[0].person;
        installNewKing(kingdom, newKing, 'emergency');
        // Generate royal family with proper arguments
        const kTowns = world.towns.filter(t => t.kingdomId === kingdom.id);
        generateRoyalFamily(world.rng, newKing, world.people, kTowns);
        logEvent(`👑 After a period of chaos, ${newKing.firstName} ${newKing.lastName} has seized the throne of ${kingdom.name}!`, null, 'kingdom');
        setKingMood(kingdom, 'ambitious', 'seized power during interregnum');
    }

    function isAlreadyKing(personId) {
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            if (world.kingdoms[ki].king === personId) return true;
        }
        return false;
    }

    function installNewKing(kingdom, newKing, cause) {
        const rng = world.rng;
        // Prevent dual kingship: if this person is already king elsewhere, abdicate there first
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var otherK = world.kingdoms[ki];
            if (otherK !== kingdom && otherK.king === newKing.id) {
                otherK.king = null;
                logEvent(newKing.firstName + ' ' + newKing.lastName + ' abdicates ' + otherK.name + ' to rule ' + kingdom.name + '.', null, 'kingdom');
                // Trigger emergency succession for the vacated kingdom
                setTimeout(function() { attemptEmergencySuccession(otherK); }, 0);
            }
        }
        kingdom.king = newKing.id;
        newKing.occupation = 'noble';
        newKing.gold += 100;
        if (!cause || cause !== 'election') {
            logEvent(`${newKing.firstName} ${newKing.lastName} becomes the new ruler of ${kingdom.name}.`);
        }

        // Generate new personality for new king
        kingdom.kingPersonality = {
            ...kingdom.kingPersonality,
            intelligence: rng.pick(['brilliant', 'clever', 'average', 'dim', 'foolish']),
            temperament: rng.pick(['kind', 'fair', 'stern', 'cruel']),
            ambition: rng.pick(['ambitious', 'content', 'lazy']),
            greed: rng.pick(['generous', 'fair', 'greedy', 'corrupt']),
            courage: rng.pick(['brave', 'cautious', 'cowardly']),
        };

        // New king changes diplomacy
        for (const otherId in kingdom.relations) {
            kingdom.relations[otherId] += rng.randInt(-20, 20);
            kingdom.relations[otherId] = Math.max(-100, Math.min(100, kingdom.relations[otherId]));
        }

        // Rebuild succession from king's children
        const kingChildren = (newKing.childrenIds || [])
            .map(id => findPerson(id))
            .filter(c => c && c.alive)
            .sort((a, b) => b.age - a.age);
        kingdom.succession = kingChildren.map(c => c.id);

        // If no children, add siblings
        if (kingdom.succession.length === 0 && newKing.parentIds && newKing.parentIds.length > 0) {
            const siblings = world.people.filter(p =>
                p.alive && p.id !== newKing.id &&
                p.parentIds && p.parentIds.some(pid => newKing.parentIds.includes(pid))
            ).sort((a, b) => b.age - a.age);
            kingdom.succession = siblings.slice(0, 5).map(p => p.id);
        }

        // Update royal advisors
        updateRoyalAdvisors(kingdom);
        // New king starts with mood based on how they came to power
        if (kingdom._kingDeathCause === 'assassination') {
            setKingMood(kingdom, 'fearful', 'predecessor was assassinated');
        } else if (kingdom._kingDeathCause === 'old age') {
            setKingMood(kingdom, 'content', 'peaceful succession');
        } else {
            setKingMood(kingdom, 'worried', 'uncertain times');
        }
        kingdom._kingDeathCause = null;
    }

    function _checkPlayerIsAdvisor(kingdom) {
        if (typeof Player === 'undefined') return null;
        const p = Player.state;
        if (!p || !p.alive) return null;
        const rankIdx = (p.socialRank && p.socialRank[kingdom.id]) || 0;
        if (rankIdx >= 6) { // Royal Advisor rank
            // Find or create a person entry for the player in this kingdom
            const playerPerson = world.people.find(pp =>
                pp.alive && pp.firstName === p.firstName && pp.lastName === p.lastName &&
                pp.townId === p.townId
            );
            return playerPerson ? playerPerson.id : null;
        }
        return null;
    }

    function updateRoyalAdvisors(kingdom) {
        // Pick top 3-5 NPCs by wealth + social standing in kingdom
        const candidates = world.people.filter(p =>
            p.alive && p.kingdomId === kingdom.id &&
            p.id !== kingdom.king &&
            p.age >= CONFIG.COMING_OF_AGE &&
            (p.occupation === 'merchant' || p.occupation === 'noble' || p.wealthClass === 'upper')
        );
        candidates.sort((a, b) => {
            const scoreA = (a.gold || 0) + (a.personality ? (a.personality.intelligence || 0) * 10 : 0);
            const scoreB = (b.gold || 0) + (b.personality ? (b.personality.intelligence || 0) * 10 : 0);
            return scoreB - scoreA;
        });
        const count = Math.min(
            Math.max(CONFIG.ROYAL_ADVISOR_COUNT_MIN, Math.floor(candidates.length * 0.1)),
            CONFIG.ROYAL_ADVISOR_COUNT_MAX
        );
        kingdom.royalAdvisors = candidates.slice(0, count).map(p => p.id);
    }

    // ========================================================
    // §13B SECURITY TICK
    // ========================================================
    function tickSecurity() {
        // Calculate town security ratings
        for (const town of world.towns) {
            var guards = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
                return p.occupation === 'guard';
            });
            const guardRatio = guards.length / Math.max(1, town.population);
            town.security = Math.min(100, Math.floor(
                guardRatio * CONFIG.SECURITY_GUARD_WEIGHT +
                town.prosperity * CONFIG.SECURITY_PROSPERITY_WEIGHT +
                (town.walls >= 2 ? CONFIG.SECURITY_WALLS_BONUS : 0)
            ));
        }

        // Update road bandit threat levels
        for (const road of world.roads) {
            const fromTown = findTown(road.fromTownId);
            const toTown = findTown(road.toTownId);
            if (!fromTown || !toTown) continue;

            let threat = road.banditThreat || 0;

            // War zone bonus
            if (fromTown.kingdomId !== toTown.kingdomId) {
                const kA = findKingdom(fromTown.kingdomId);
                if (kA && kA.atWar.has(toTown.kingdomId)) {
                    threat += CONFIG.BANDIT_WAR_ZONE_BONUS * 0.1;
                }
            }

            // Low-security towns nearby increase threat
            const avgSecurity = ((fromTown.security || 0) + (toTown.security || 0)) / 2;
            if (avgSecurity < 30) {
                threat += CONFIG.BANDIT_LOW_SECURITY_BONUS * 0.05;
            }

            // Kingdom patrols reduce threat
            const kFrom = findKingdom(fromTown.kingdomId);
            if (kFrom && kFrom.gold > CONFIG.KINGDOM_GUARD_HIRE_THRESHOLD) {
                threat -= CONFIG.BANDIT_PATROL_REDUCTION * 0.1;
            }

            // High security nearby reduces threat
            if (avgSecurity > 60) {
                threat -= CONFIG.BANDIT_HIGH_SECURITY_REDUCTION * 0.1;
            }

            road.banditThreat = Math.max(0, Math.min(100, threat));
        }
    }

    // ========================================================
    // §13b WAR EXHAUSTION
    // ========================================================
    function tickWarExhaustion(k) {
        if (typeof k.warExhaustion !== 'number') k.warExhaustion = 0;
        if (k.atWar.size === 0) {
            // Recover during peacetime
            k.warExhaustion = Math.max(0, k.warExhaustion - 0.5);
            return;
        }
        // Accumulate: base + per-war + treasury pressure + bankruptcy
        var gain = 0.15 + (k.atWar.size * 0.1);
        var startGold = k._startingGold || 10000;
        if (k.gold < startGold * 0.25) gain += 0.2;
        if (k._bankruptDays > 0) gain += 0.3;
        k.warExhaustion = Math.min(100, k.warExhaustion + gain);
    }

    // Called when a kingdom loses a battle
    function addBattleLossExhaustion(k) {
        if (!k) return;
        if (typeof k.warExhaustion !== 'number') k.warExhaustion = 0;
        k.warExhaustion = Math.min(100, k.warExhaustion + 5);
    }

    // Called when a kingdom loses a town
    function addTownLossExhaustion(k) {
        if (!k) return;
        if (typeof k.warExhaustion !== 'number') k.warExhaustion = 0;
        k.warExhaustion = Math.min(100, k.warExhaustion + 10);
    }

    // Apply war exhaustion effects (called each day per kingdom)
    function applyWarExhaustionEffects(k, rng) {
        var we = k.warExhaustion || 0;
        if (we <= 25) return; // Normal — no effects

        // Tier 2 (25-50): happiness drain
        if (we > 25 && we <= 50) {
            k.happiness = Math.max(0, (k.happiness || 50) - 0.1);
        }
        // Tier 3 (50-75): stronger happiness drain
        else if (we > 50 && we <= 75) {
            k.happiness = Math.max(0, (k.happiness || 50) - 0.3);
        }
        // Tier 4 (75-100): severe effects
        else if (we > 75) {
            k.happiness = Math.max(0, (k.happiness || 50) - 0.5);
            // Soldiers desert at 1%/day
            if (rng.chance(0.01)) {
                for (var ti = 0; ti < world.towns.length; ti++) {
                    var town = world.towns[ti];
                    if (town.kingdomId !== k.id || !town.garrison || town.garrison <= 1) continue;
                    var deserters = Math.max(1, Math.floor(town.garrison * 0.01));
                    town.garrison = Math.max(1, town.garrison - deserters);
                    // Convert deserters back to civilians
                    var townSoldiers = (world.people || []).filter(function(p) {
                        return p.alive && p.townId === town.id && p.occupation === 'soldier';
                    });
                    for (var di = 0; di < Math.min(deserters, townSoldiers.length); di++) {
                        townSoldiers[di].occupation = 'laborer';
                    }
                }
                logEvent('🏃‍♂️ Soldiers are deserting ' + k.name + '\'s exhausted army!', {
                    type: 'war_exhaustion_desertion', cause: 'War exhaustion at ' + Math.round(we) + '%',
                    effects: ['Garrison strength reduced across all towns'],
                    kingdoms: [k.id]
                }, 'military');
            }
        }
    }

    // Get recruitment modifier based on war exhaustion (1.0 = normal, 0 = halted)
    function getWarExhaustionRecruitMod(k) {
        var we = k.warExhaustion || 0;
        if (we <= 50) return 1.0;
        if (we <= 75) return 0.5; // 50% recruitment
        return 0;                  // Recruitment halted
    }

    // Get surrender bonus from war exhaustion
    function getWarExhaustionSurrenderBonus(k) {
        var we = k.warExhaustion || 0;
        if (we > 75) return 0.40;
        if (we > 50) return 0.15;
        return 0;
    }

    // ========================================================
    // §14 DIPLOMACY & KINGDOM AI TICK
    // ========================================================
    function tickDiplomacy() {
        const rng = world.rng;

        for (const k of world.kingdoms) {
            // ---- War exhaustion tick ----
            tickWarExhaustion(k);
            applyWarExhaustionEffects(k, rng);

            // ---- Relation drift toward 0 ----
            for (const otherId in k.relations) {
                const val = k.relations[otherId];
                if (val > 0) k.relations[otherId] = Math.max(0, val - CONFIG.RELATION_DECAY_RATE);
                else if (val < 0) k.relations[otherId] = Math.min(0, val + CONFIG.RELATION_DECAY_RATE);
            }

            // ---- Random relation shifts (border disputes / trade agreements) ----
            if (rng.chance(CONFIG.DISPUTE_CHANCE || 0.03)) {
                const otherKingdoms = world.kingdoms.filter(o => o.id !== k.id);
                if (otherKingdoms.length > 0) {
                    const other = rng.pick(otherKingdoms);
                    if (rng.chance(0.6)) {
                        // Border dispute (60% of events — disputes more common than agreements)
                        const shift = -rng.randInt(CONFIG.DISPUTE_MIN || 8, CONFIG.DISPUTE_MAX || 25);
                        k.relations[other.id] = Math.max(-100, (k.relations[other.id] || 0) + shift);
                        other.relations[k.id] = Math.max(-100, (other.relations[k.id] || 0) + shift);
                        logEvent(`Border dispute between ${k.name} and ${other.name}! Relations worsen.`, {
                            type: 'border_dispute',
                            cause: 'A territorial disagreement has flared up along the border.',
                            effects: [
                                'Relations dropped by ' + Math.abs(shift) + ' points',
                                'Current relations: ' + Math.round(k.relations[other.id]),
                                (k.relations[other.id] || 0) < CONFIG.RELATION_WAR_THRESHOLD ? '\u26A0\uFE0F Relations are dangerously close to war!' : 'Risk of further escalation exists'
                            ],
                            kingdoms: [k.id, other.id]
                        });
                    } else {
                        // Trade agreement (40% of events)
                        const shift = rng.randInt(CONFIG.AGREEMENT_MIN || 5, CONFIG.AGREEMENT_MAX || 12);
                        k.relations[other.id] = Math.min(100, (k.relations[other.id] || 0) + shift);
                        other.relations[k.id] = Math.min(100, (other.relations[k.id] || 0) + shift);
                        logEvent(`Trade agreement between ${k.name} and ${other.name}. Relations improve.`, {
                            type: 'trade_agreement',
                            cause: 'Merchants from both kingdoms negotiated favorable trade terms.',
                            effects: [
                                'Relations improved by ' + shift + ' points',
                                'Current relations: ' + Math.round(k.relations[other.id]),
                                'Trade between the kingdoms may increase'
                            ],
                            kingdoms: [k.id, other.id]
                        });
                    }
                }
            }

            // ---- War declaration ----
            for (const other of world.kingdoms) {
                if (other.id === k.id || k.atWar.has(other.id)) continue;
                // Enforce peace treaties
                if (k.peaceTreaties && k.peaceTreaties[other.id] && world.day < k.peaceTreaties[other.id]) continue;
                // Enforce war immunity (devastated kingdoms get recovery time)
                if (other.warImmunityUntil && world.day < other.warImmunityUntil) continue;
                const rel = k.relations[other.id] || 0;
                let warChance = 0;
                if (rel < CONFIG.RELATION_WAR_THRESHOLD) {
                    warChance = CONFIG.WAR_CHANCE_PER_DAY;
                    // Marriage alliance halves war chance
                    if (k._marriageAlliances && k._marriageAlliances[other.id] && world.day < k._marriageAlliances[other.id]) {
                        warChance *= 0.5;
                    }
                }
                // Prosperity jealousy: ambitious kings may attack much more prosperous neighbors
                if (k.personality && k.personality.ambition > 65) {
                    var ourAvgProsp = 0, ourTownCount = 0;
                    for (var oti = 0; oti < (k.territories || []).length; oti++) {
                        var ot = findTown(k.territories[oti]);
                        if (ot) { ourAvgProsp += (ot.prosperity || 50); ourTownCount++; }
                    }
                    ourAvgProsp = ourTownCount > 0 ? ourAvgProsp / ourTownCount : 50;
                    var theirAvgProsp = 0, theirTownCount = 0;
                    for (var tti = 0; tti < (other.territories || []).length; tti++) {
                        var tt = findTown(other.territories[tti]);
                        if (tt) { theirAvgProsp += (tt.prosperity || 50); theirTownCount++; }
                    }
                    theirAvgProsp = theirTownCount > 0 ? theirAvgProsp / theirTownCount : 50;
                    if (theirAvgProsp > ourAvgProsp + 25) {
                        warChance += CONFIG.WAR_CHANCE_PER_DAY * 0.5; // Jealousy boost
                    }
                }
                if (warChance > 0 && rng.chance(warChance)) {
                    declareWar(k, other);
                }
            }

            // ---- Alliance formation (relations >= threshold) ----
            if (!k.alliances) k.alliances = new Set();
            for (const other of world.kingdoms) {
                if (other.id === k.id) continue;
                if (!other.alliances) other.alliances = new Set();
                const rel = k.relations[other.id] || 0;
                if (rel >= CONFIG.RELATION_ALLIANCE_THRESHOLD && !k.alliances.has(other.id) && !k.atWar.has(other.id)) {
                    // Form alliance
                    k.alliances.add(other.id);
                    other.alliances.add(k.id);
                    logEvent(`🤝 ${k.name} and ${other.name} have formed a formal alliance!`, {
                        type: 'alliance_formed',
                        cause: 'Relations between ' + k.name + ' and ' + other.name + ' reached ' + Math.round(rel) + ' (threshold: ' + CONFIG.RELATION_ALLIANCE_THRESHOLD + ').',
                        effects: [
                            'Both kingdoms will defend each other in wars (after 30-day delay)',
                            'Trade between allied kingdoms is boosted',
                            'Diplomatic relations are strengthened'
                        ],
                        kingdoms: [k.id, other.id]
                    });
                }
                // Alliance breaks if relations drop too low
                if (k.alliances.has(other.id) && rel < (CONFIG.ALLIANCE_BREAK_THRESHOLD || 40)) {
                    k.alliances.delete(other.id);
                    other.alliances.delete(k.id);
                    logEvent(`💔 The alliance between ${k.name} and ${other.name} has been dissolved!`, {
                        type: 'alliance_dissolved',
                        cause: 'Relations between ' + k.name + ' and ' + other.name + ' dropped to ' + Math.round(rel) + ', below the alliance maintenance threshold.',
                        effects: [
                            'Mutual defense pact no longer applies',
                            'Trade bonuses between the kingdoms are lost',
                            'Risk of future conflict increases'
                        ],
                        kingdoms: [k.id, other.id]
                    });
                }
            }

            // ---- Alliance Call to Arms (replaces auto-join) ----
            for (const allyId of k.alliances) {
                const ally = findKingdom(allyId);
                if (!ally) continue;
                for (const enemyId of ally.atWar) {
                    if (enemyId === k.id) continue;
                    if (k.atWar.has(enemyId)) continue;
                    if (k.alliances.has(enemyId)) continue;
                    if (k.peaceTreaties && k.peaceTreaties[enemyId] && world.day < k.peaceTreaties[enemyId]) continue;
                    const enemy = findKingdom(enemyId);
                    if (!enemy) continue;

                    // War age check (ally must have been at war for 30+ days before call)
                    const war = Object.values(world.activeWars || {}).find(w =>
                        (w.kingdomA === allyId && w.kingdomB === enemyId) ||
                        (w.kingdomB === allyId && w.kingdomA === enemyId)
                    );
                    const warAge = war ? world.day - war.startDay : 999;
                    if (warAge < (CONFIG.ALLIANCE_WAR_JOIN_DELAY || 30)) continue;

                    // Determine if this is a defensive war for the ally (they were attacked)
                    var isDefensive = war && war.aggressor === enemyId;

                    // Check if alliance is strong enough for this type of call
                    if (!shouldCallToArms(k, ally, isDefensive)) continue;

                    // Process the call to arms — ally decides whether to join
                    processCallToArms(k, ally, enemy);
                }
            }

            // ---- Peace offering (enhanced negotiation) ----
            for (const warTargetId of k.atWar) {
                const other = findKingdom(warTargetId);
                if (!other) continue;
                // Minimum war duration: no peace for first 90 days
                const warKey = Object.keys(world.activeWars || {}).find(wk => {
                    const w = world.activeWars[wk];
                    return (w.kingdomA === k.id && w.kingdomB === other.id) ||
                           (w.kingdomA === other.id && w.kingdomB === k.id);
                });
                const warData = warKey ? world.activeWars[warKey] : null;
                const warAge = warData ? world.day - warData.startDay : 999;
                if (warAge < 90) continue; // wars must last at least 90 days
                // Higher chance of peace if losing
                const myStrength = computeMilitaryStrength(k);
                const theirStrength = computeMilitaryStrength(other);
                const losingFactor = myStrength < theirStrength ? 3 : 1;
                // Duration factor: ramps from 1 to 3 over 360 days past the 90-day minimum
                const durationFactor = Math.min(3, 1 + Math.max(0, warAge - 90) / 180);
                // War exhaustion factor: up to 5× at exhaustion 100
                const exhaustionFactor = 1 + (k.warExhaustion || 0) / 25;
                if (rng.chance(CONFIG.PEACE_CHANCE_PER_DAY * losingFactor * durationFactor * exhaustionFactor)) {
                    // Use enhanced peace negotiation
                    const loser = myStrength < theirStrength ? k : other;
                    const winner = loser === k ? other : k;
                    const result = evaluatePeaceTerms(loser, winner);

                    if (result.accepted) {
                        // Apply peace terms
                        loser.gold -= result.offer.gold;
                        winner.gold += result.offer.gold;

                        // Transfer ceded towns
                        for (const cededTownId of result.offer.towns) {
                            const cededTown = transferTown(cededTownId, loser.id, winner.id, 'peace_deal');
                            if (cededTown) {
                                // Update people in ceded town
                                for (const p of world.people) {
                                    if (p.alive && p.townId === cededTownId) {
                                        p.kingdomId = winner.id;
                                    }
                                }
                                // Apply servitude if negotiated
                                if (result.offer.concessions.includes('servitude_of_ceded')) {
                                    imposeServitude(cededTown, winner);
                                } else {
                                    grantCitizenship(cededTown, winner);
                                }
                            }
                        }

                        // Apply trade concessions
                        if (result.offer.concessions.includes('lower_tariffs') && loser.laws) {
                            loser.laws.tradeTariff = Math.round(Math.max(0, (loser.laws.tradeTariff || 0.05) * 0.5) * 10000) / 10000;
                        }

                        makePeace(k, other, result.level >= 3, result.level >= 3 ? loser : null);
                    }
                }
            }

            // ---- Mutual exhaustion peace (both sides too tired to fight) ----
            for (const warTargetId of k.atWar) {
                const other = findKingdom(warTargetId);
                if (!other) continue;
                if ((k.warExhaustion > 60 && (other.warExhaustion || 0) > 60) ||
                    (k._bankruptDays > 60 && (other._bankruptDays || 0) > 60)) {
                    logEvent('🕊️ ' + k.name + ' and ' + other.name + ' agree to a white peace — both sides are exhausted from the war.', {
                        type: 'mutual_exhaustion_peace',
                        cause: 'Both kingdoms have war exhaustion above 60 or have been bankrupt for over 60 days.',
                        effects: ['War ends with no tribute or concessions', 'Both kingdoms begin recovery'],
                        kingdoms: [k.id, other.id]
                    }, 'military');
                    makePeace(k, other, false, null); // White peace — no terms
                    break;
                }
            }

            // ---- Multi-front war prioritization: seek peace with weakest enemy ----
            if (k.atWar.size > 1) {
                var enemies = [];
                for (const eid of k.atWar) {
                    var eK = findKingdom(eid);
                    if (eK) enemies.push({ id: eid, strength: computeMilitaryStrength(eK) });
                }
                enemies.sort(function(a, b) { return a.strength - b.strength; });
                // If losing overall, increase desire to peace the weakest enemy
                if (enemies.length > 1 && k.warExhaustion > 30) {
                    var weakest = findKingdom(enemies[0].id);
                    if (weakest && rng.chance(0.02 * (k.warExhaustion / 50))) {
                        logEvent('🕊️ ' + k.name + ' sues for peace with ' + weakest.name + ' to focus on other fronts.', {
                            type: 'multi_front_peace', cause: 'Multi-front war pressure',
                            effects: [k.name + ' seeks to consolidate forces'], kingdoms: [k.id, weakest.id]
                        }, 'military');
                        makePeace(k, weakest, false, null);
                    }
                }
            }

            // ---- Tax collection (once per season) ----
            // Skip if kingdom is under tax revolt
            if (world.day % CONFIG.DAYS_PER_SEASON === 0 && !(k._taxRevoltUntil && world.day < k._taxRevoltUntil)) {
                // Seasonal base tax from population (minimal — supplements trade taxes)
                let baseTaxRevenue = 0;
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (town) {
                        const tradeBonus = Object.values(town.market.supply).reduce((a, b) => a + b, 0) * 0.05;
                        const rev = Math.floor(town.population * k.taxRate * 5 + tradeBonus);
                        baseTaxRevenue += rev;
                    }
                }
                k.gold += baseTaxRevenue;

                // Enforce tariff collection on foreign trade (accumulated)
                let tariffRevenue = 0;
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    // Estimate tariff from foreign traders who visited
                    var foreignTraders = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
                        return p.kingdomId !== k.id &&
                        (p.occupation === 'merchant' || p.isEliteMerchant);
                    });
                    const tariffRate = (k.laws && k.laws.tradeTariff) || 0;
                    for (const ft of foreignTraders) {
                        const tariff = Math.floor((ft.gold || 0) * tariffRate * 0.1);
                        if (tariff > 0 && (ft.gold || 0) >= tariff) {
                            ft.gold -= tariff;
                            tariffRevenue += tariff;
                        }
                    }
                }
                k.gold += tariffRevenue;

                // Log total seasonal revenue
                const seasonalTotal = baseTaxRevenue + tariffRevenue + (k.tradeTaxRevenue || 0);
                k.taxRevenue = seasonalTotal;
                k._lastSeasonTaxRevenue = seasonalTotal; // Used by happiness consequences
                k.tradeTaxRevenue = 0; // reset for next season

                // Pay soldiers
                var soldiers = (_tickCache.soldiersByKingdom[k.id] || []);
                const soldierCost = soldiers.length * CONFIG.SOLDIER_UPKEEP;
                k.gold = Math.max(0, k.gold - soldierCost);

                // Kingdom hires guards when wealthy
                if (k.gold > CONFIG.KINGDOM_GUARD_HIRE_THRESHOLD) {
                    const guardBudgetGold = Math.floor(k.gold * (k.guardBudget || 0.15));
                    const guardsToHire = Math.floor(guardBudgetGold / CONFIG.KINGDOM_GUARD_COST);
                    let hired = 0;
                    for (const townId of k.territories) {
                        if (hired >= guardsToHire) break;
                        const town = findTown(townId);
                        if (!town) continue;
                        var idle = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
                            return (p.occupation === 'laborer' || p.occupation === 'none') &&
                            p.age >= CONFIG.COMING_OF_AGE && p.age <= 50;
                        });
                        for (const p of idle) {
                            if (hired >= guardsToHire) break;
                            p.occupation = 'guard';
                            p.skills.combat = Math.max(p.skills.combat, 15);
                            hired++;
                            k.gold -= CONFIG.KINGDOM_GUARD_COST;
                        }
                    }
                }
            }

            // ---- Kingdom AI priorities ----
            // Run more frequently during wartime (every 7 days vs 30 in peace)
            const aiInterval = k.atWar.size > 0 ? 7 : 30;
            if (world.day % aiInterval === 0) {
                kingdomAI(k);
                tickTownFounding(k);
            }

            // ---- Update kingdom happiness ----
            k.happiness = getKingdomHappiness(k);

            // ---- King decisions & rebellion (once per season) ----
            if (world.day % CONFIG.DAYS_PER_SEASON === 0 && world.day > 0) {
                // Recovery: if kingdom has no king or king person is missing/dead, attempt emergency succession
                if (!k.king || !findPerson(k.king) || !findPerson(k.king).alive) {
                    attemptEmergencySuccession(k);
                }
                tickKingMood(k);
                tickSuccessionCrisis(k);
                tickKingDecisions(k);
                tickRebellion(k);
                tickKingdomHappinessConsequences(k);
                tickSurrender(k);
            }

            // ---- Kingdom purchasing from market (daily) ----
            tickKingdomPurchasing(k);

            // ---- Update military strength and soldier count ----
            k.militaryStrength = computeMilitaryStrength(k);
            k.soldiers = (_tickCache.soldiersByKingdom[k.id] || []).length;

            // ---- Update prosperity ----
            const kTowns = world.towns.filter(t => t.kingdomId === k.id);
            if (kTowns.length > 0) {
                k.prosperity = kTowns.reduce((s, t) => s + t.prosperity, 0) / kTowns.length;
            }
        }

        // ---- Tick treaties (reparations, violations, expiry) ----
        tickTreaties();

        // ---- Check war goals for auto-peace ----
        checkWarGoals();
    }

    function declareWar(a, b) {
        // --- CHECK NON-AGGRESSION PACT ---
        var napTreaty = wouldViolateNonAggression(a.id, b.id);
        if (napTreaty) {
            handleNonAggressionViolation(a, napTreaty);
        }

        // --- WAR DECLARATION COST (aggressor pays upfront) ---
        var soldiers = (_tickCache.soldiersByKingdom[a.id] || []);
        const warDeclarationCost = Math.min(2000, Math.max(500, soldiers.length * 10));
        if (a.gold < warDeclarationCost) {
            logEvent(`${a.name} cannot afford to declare war on ${b.name} (need ${warDeclarationCost}g).`);
            return;
        }
        a.gold -= warDeclarationCost;

        a.atWar.add(b.id);
        b.atWar.add(a.id);

        // Generate unique war ID and record war metadata
        const warId = 'war_' + a.id + '_' + b.id + '_day' + world.day;
        if (!world.activeWars) world.activeWars = {};
        const strengthA = computeMilitaryStrength(a);
        const strengthB = computeMilitaryStrength(b);
        world.activeWars[warId] = {
            id: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            startDay: world.day,
            aggressor: a.id,
            strengthAtStart: { [a.id]: strengthA, [b.id]: strengthB },
            originalTowns: { [a.id]: a.territories.size, [b.id]: b.territories.size },
            warGoals: generateWarGoals(a, b, world.rng),
        };

        logEvent(`WAR! ${a.name} declares war on ${b.name}! (War chest: -${warDeclarationCost}g)`, {
            type: 'war_declared',
            cause: 'Relations between ' + a.name + ' and ' + b.name + ' have deteriorated to ' + Math.round(a.relations[b.id] || 0) + '. The threshold for war is ' + CONFIG.RELATION_WAR_THRESHOLD + '.',
            effects: [
                'War declaration cost: ' + warDeclarationCost + 'g deducted from ' + a.name + ' treasury',
                'Ongoing supply costs: 5g per soldier per day',
                'Trade embargoes may be enacted between the kingdoms',
                'Roads between the kingdoms become dangerous',
                'Military recruitment costs doubled during wartime (75g vs 50g)',
                'Merchants traveling between these kingdoms face ambush risk'
            ],
            kingdoms: [a.id, b.id]
        }, 'military');

        // Trade embargo — war often triggers an embargo
        if (world.rng.chance(0.7)) {
            declareEmbargo(a, b);
        }

        // Fire warDeclared event for UI to catch
        world.eventLog.push({
            day: world.day,
            message: `WAR DECLARED: ${a.name} vs ${b.name}`,
            type: 'warDeclared',
            warId: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            nameA: a.name,
            nameB: b.name,
            strengthA: strengthA,
            strengthB: strengthB,
        });

        // Mark roads between warring kingdoms as unsafe
        for (const road of world.roads) {
            const fromTown = findTown(road.fromTownId);
            const toTown = findTown(road.toTownId);
            if (fromTown && toTown) {
                if ((fromTown.kingdomId === a.id && toTown.kingdomId === b.id) ||
                    (fromTown.kingdomId === b.id && toTown.kingdomId === a.id)) {
                    road.safe = false;
                }
            }
        }
        // Mood: defender becomes fearful, aggressor becomes ambitious
        setKingMood(b, 'fearful', 'war declared by ' + a.name);
        if (a.kingPersonality && a.kingPersonality.courage === 'brave') {
            setKingMood(a, 'ambitious', 'declared war on ' + b.name);
        }
    }

    function makePeace(a, b, isSurrender, loser) {
        a.atWar.delete(b.id);
        b.atWar.delete(a.id);
        a.relations[b.id] = 0;
        b.relations[a.id] = 0;

        // Lift trade embargo on peace
        if (hasEmbargo(a.id, b.id)) {
            liftEmbargo(a, b);
        }

        // Find and close the active war
        let warId = null;
        let winner = null;
        if (world.activeWars) {
            for (const wid in world.activeWars) {
                const w = world.activeWars[wid];
                if ((w.kingdomA === a.id && w.kingdomB === b.id) ||
                    (w.kingdomA === b.id && w.kingdomB === a.id)) {
                    warId = wid;
                    if (isSurrender && loser) {
                        winner = loser.id === a.id ? b.id : a.id;
                    }
                    break;
                }
            }
        }

        if (isSurrender && loser) {
            const winnerK = loser.id === a.id ? b : a;

            // Tribute: loser pays 50% of treasury
            const tribute = Math.floor(loser.gold * 0.5);
            loser.gold -= tribute;
            winnerK.gold += tribute;

            logEvent(`${loser.name} surrenders to ${winnerK.name}! The war is over.`, {
                type: 'surrender',
                cause: loser.name + '\'s military was defeated and could no longer sustain the war.',
                effects: [
                    loser.name + ' pays ' + tribute + 'g tribute (50% of treasury)',
                    '720-day peace treaty enforced',
                    'Towns may be ceded to ' + winnerK.name,
                    loser.name + '\'s international reputation suffers'
                ],
                kingdoms: [loser.id, winnerK.id]
            }, 'military');

            // Forced peace treaty for 2 in-game years (720 days)
            if (!a.peaceTreaties) a.peaceTreaties = {};
            if (!b.peaceTreaties) b.peaceTreaties = {};
            a.peaceTreaties[b.id] = world.day + 720;
            b.peaceTreaties[a.id] = world.day + 720;

            // Cede one town if loser lost any
            if (world.activeWars && warId) {
                const warData = world.activeWars[warId];
                const originalTowns = warData.originalTowns[loser.id] || 0;
                if (loser.territories.size < originalTowns && loser.territories.size > 1) {
                    // Already lost towns, no additional cession needed
                } else if (loser.territories.size > 1) {
                    // Cede a random border town using transferTown
                    const loserTowns = [...loser.territories].map(tid => findTown(tid)).filter(t => t);
                    if (loserTowns.length > 1) {
                        const cedeTown = loserTowns[loserTowns.length - 1];
                        const transferred = transferTown(cedeTown.id, loser.id, winnerK.id, 'peace_deal');
                        if (transferred) {
                            grantCitizenship(transferred, winnerK);
                        }
                    }
                }
            }
        } else {
            logEvent(`Peace! ${a.name} and ${b.name} have ended their war.`, {
                type: 'peace',
                cause: 'Both kingdoms agreed to end hostilities.',
                effects: [
                    'Trade routes between kingdoms reopen',
                    'Road safety improves',
                    'Military demobilization begins'
                ],
                kingdoms: [a.id, b.id]
            }, 'military');
        }

        // Fire warEnded event
        world.eventLog.push({
            day: world.day,
            message: isSurrender ? `${loser ? loser.name : 'A kingdom'} surrenders!` : `Peace between ${a.name} and ${b.name}`,
            type: 'warEnded',
            warId: warId,
            kingdomA: a.id,
            kingdomB: b.id,
            winner: winner,
            isSurrender: !!isSurrender,
        });

        // Mood: victor becomes jubilant, loser becomes wrathful
        setKingMood(a, 'jubilant', 'won the war against ' + b.name);
        setKingMood(b, 'wrathful', 'lost the war against ' + a.name);

        // Clean up active war
        if (world.activeWars && warId) {
            delete world.activeWars[warId];
        }

        // Restore road safety
        for (const road of world.roads) {
            road.safe = isRoadSafe(road);
        }

        // Remove armies targeting the other
        world.armies = world.armies.filter(army =>
            !(army.kingdomId === a.id && army.targetKingdomId === b.id) &&
            !(army.kingdomId === b.id && army.targetKingdomId === a.id)
        );

        // Create binding peace treaty
        createTreaty(a, b, isSurrender, loser, null);

        // Reset war exhaustion partially on peace
        a.warExhaustion = Math.max(0, (a.warExhaustion || 0) - 20);
        b.warExhaustion = Math.max(0, (b.warExhaustion || 0) - 20);
    }

    // ========================================================
    // §14b TREATY SYSTEM
    // ========================================================
    function createTreaty(a, b, isSurrender, loser, terms) {
        if (!world.treaties) world.treaties = [];
        var treaty = {
            id: 'treaty_' + a.id + '_' + b.id + '_' + world.day,
            type: 'peace_treaty',
            signatories: [a.id, b.id],
            terms: {
                reparations: null,
                cededTowns: [],
                tradeAgreement: null,
                nonAggression: { duration: isSurrender ? 720 : 360 },
                demilitarizedZone: null,
                tributeSchedule: null,
            },
            signedDay: world.day,
            expiresDay: world.day + (isSurrender ? 720 : 360),
            violations: [],
            active: true,
        };

        // Apply passed-in terms or generate default terms
        if (terms) {
            for (var key in terms) {
                if (terms.hasOwnProperty(key)) treaty.terms[key] = terms[key];
            }
        }

        // Surrender generates harsher default terms
        if (isSurrender && loser) {
            var winner = loser.id === a.id ? b : a;
            // Reparation schedule: 20% of loser treasury over 4 seasons
            var totalRep = Math.floor((loser.gold || 0) * 0.2);
            if (totalRep > 100) {
                treaty.terms.reparations = {
                    payer: loser.id, receiver: winner.id,
                    totalAmount: totalRep,
                    paidPerSeason: Math.ceil(totalRep / 4),
                    paid: 0, lastPayDay: world.day
                };
            }
            // Forced trade agreement with reduced tariffs
            treaty.terms.tradeAgreement = {
                duration: 360, tariffCap: 0.03,
                beneficiary: winner.id, target: loser.id
            };
        }

        world.treaties.push(treaty);
        return treaty;
    }

    function tickTreaties() {
        if (!world.treaties) return;
        var rng = world.rng;
        var toRemove = [];

        for (var i = 0; i < world.treaties.length; i++) {
            var treaty = world.treaties[i];
            if (!treaty.active) { toRemove.push(i); continue; }

            // Check expiry
            if (world.day >= treaty.expiresDay) {
                treaty.active = false;
                logEvent('📜 Treaty between ' + getKingdomName(treaty.signatories[0]) + ' and ' + getKingdomName(treaty.signatories[1]) + ' has expired.', {
                    type: 'treaty_expired', kingdoms: treaty.signatories
                });
                toRemove.push(i);
                continue;
            }

            // Process reparation payments (every 90 days)
            if (treaty.terms.reparations && world.day % 90 === 0) {
                var rep = treaty.terms.reparations;
                if (rep.paid < rep.totalAmount) {
                    var payer = findKingdom(rep.payer);
                    var receiver = findKingdom(rep.receiver);
                    if (payer && receiver) {
                        var payment = Math.min(rep.paidPerSeason, rep.totalAmount - rep.paid);
                        if (payer.gold >= payment) {
                            payer.gold -= payment;
                            receiver.gold += payment;
                            rep.paid += payment;
                            rep.lastPayDay = world.day;
                            logEvent('💰 ' + payer.name + ' pays ' + payment + 'g in war reparations to ' + receiver.name + '. (' + rep.paid + '/' + rep.totalAmount + 'g)', {
                                type: 'reparation_payment', kingdoms: [rep.payer, rep.receiver]
                            });
                        } else {
                            // Failed to pay — treaty violation
                            treaty.violations.push({ day: world.day, type: 'missed_reparation', by: rep.payer });
                            logEvent('⚠️ ' + payer.name + ' failed to pay reparations to ' + receiver.name + '! (' + Math.floor(payer.gold) + 'g available, ' + payment + 'g owed)', {
                                type: 'treaty_violation', cause: 'Insufficient gold for reparation payment',
                                effects: [receiver.name + ' may resume hostilities without war declaration cost'],
                                kingdoms: [rep.payer, rep.receiver]
                            }, 'military');
                            // Receiver can resume war without cost
                            if (receiver.peaceTreaties) receiver.peaceTreaties[payer.id] = 0;
                        }
                    }
                }
            }

            // Enforce trade agreement tariff cap
            if (treaty.terms.tradeAgreement) {
                var ta = treaty.terms.tradeAgreement;
                var target = findKingdom(ta.target);
                if (target && target.laws && target.laws.tradeTariff > ta.tariffCap) {
                    target.laws.tradeTariff = ta.tariffCap;
                }
            }

            // Check DMZ violations
            if (treaty.terms.demilitarizedZone) {
                var dmz = treaty.terms.demilitarizedZone;
                for (var di = 0; di < (dmz.townIds || []).length; di++) {
                    var dmzTown = findTown(dmz.townIds[di]);
                    if (dmzTown && (dmzTown.garrison || 0) > (dmz.maxGarrison || 10)) {
                        var violator = findKingdom(dmzTown.kingdomId);
                        if (violator && treaty.signatories.includes(violator.id)) {
                            treaty.violations.push({ day: world.day, type: 'dmz_violation', by: violator.id, townId: dmzTown.id });
                            logEvent('⚠️ ' + violator.name + ' violates the demilitarized zone in ' + dmzTown.name + '!', {
                                type: 'treaty_violation', cause: 'Garrison exceeds ' + dmz.maxGarrison + ' in DMZ town',
                                effects: ['Relations damaged with all kingdoms', 'War may resume'],
                                kingdoms: treaty.signatories
                            }, 'military');
                            // Penalty: -30 relations with ALL other kingdoms
                            for (var ki = 0; ki < world.kingdoms.length; ki++) {
                                var otherK = world.kingdoms[ki];
                                if (otherK.id !== violator.id) {
                                    otherK.relations[violator.id] = (otherK.relations[violator.id] || 0) - 30;
                                }
                            }
                        }
                    }
                }
            }

            // Check non-aggression pact violations (handled in declareWar)
        }

        // Clean up expired treaties
        for (var r = toRemove.length - 1; r >= 0; r--) {
            world.treaties.splice(toRemove[r], 1);
        }
    }

    function getKingdomName(id) {
        var k = findKingdom(id);
        return k ? k.name : 'Unknown';
    }

    // Check if declaring war would violate a non-aggression pact
    function wouldViolateNonAggression(aId, bId) {
        if (!world.treaties) return null;
        for (var i = 0; i < world.treaties.length; i++) {
            var t = world.treaties[i];
            if (!t.active || !t.terms.nonAggression) continue;
            if (t.signatories.includes(aId) && t.signatories.includes(bId)) {
                return t;
            }
        }
        return null;
    }

    function handleNonAggressionViolation(violator, treaty) {
        treaty.violations.push({ day: world.day, type: 'non_aggression_broken', by: violator.id });
        // -50 relations with ALL kingdoms
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            if (k.id !== violator.id) {
                k.relations[violator.id] = Math.max(-100, (k.relations[violator.id] || 0) - 50);
            }
        }
        treaty.active = false;
        logEvent('💀 ' + violator.name + ' breaks their non-aggression pact! All kingdoms are outraged.', {
            type: 'treaty_violation', cause: 'Non-aggression pact broken',
            effects: ['-50 relations with all kingdoms', 'Treaty voided'],
            kingdoms: treaty.signatories
        }, 'military');
    }

    // ========================================================
    // §14c WAR GOALS SYSTEM
    // ========================================================
    function generateWarGoals(aggressor, defender, rng) {
        var goals = [];
        var p = aggressor.kingPersonality || {};

        // Every war: conquer at least one town
        var borderTowns = [];
        for (var tid of defender.territories) {
            var t = findTown(tid);
            if (!t) continue;
            // Check if adjacent to aggressor territory
            for (var road of world.roads) {
                if ((road.fromTownId === tid || road.toTownId === tid)) {
                    var otherTid = road.fromTownId === tid ? road.toTownId : road.fromTownId;
                    if (aggressor.territories.has(otherTid)) {
                        borderTowns.push(tid);
                        break;
                    }
                }
            }
        }
        if (borderTowns.length > 0) {
            goals.push({
                type: 'conquer_town',
                targetTownId: borderTowns[Math.floor(rng.randFloat(0, borderTowns.length))],
                achieved: false
            });
        }

        // Ambitious or greedy kings: economic dominance
        if (p.temperament === 'greedy' || p.courage === 'brave') {
            goals.push({ type: 'economic_dominance', targetGoldRatio: 2.0, achieved: false });
        }

        // Cruel or proud kings: humiliate
        if (p.temperament === 'cruel' || rng.chance(0.3)) {
            goals.push({ type: 'humiliate', requiredBattlesWon: 3, battlesWon: 0, achieved: false });
        }

        return goals;
    }

    function checkWarGoals() {
        if (!world.activeWars) return;
        for (var warId in world.activeWars) {
            var war = world.activeWars[warId];
            if (!war.warGoals || war._goalsAchieved) continue;

            var aggressor = findKingdom(war.aggressor);
            var defender = findKingdom(war.kingdomA === war.aggressor ? war.kingdomB : war.kingdomA);
            if (!aggressor || !defender) continue;

            var allAchieved = true;
            for (var g = 0; g < war.warGoals.length; g++) {
                var goal = war.warGoals[g];
                if (goal.achieved) continue;

                if (goal.type === 'conquer_town') {
                    var town = findTown(goal.targetTownId);
                    if (town && town.kingdomId === aggressor.id) {
                        goal.achieved = true;
                        logEvent('🎯 ' + aggressor.name + ' achieved war goal: conquered ' + town.name + '!');
                    } else {
                        allAchieved = false;
                    }
                } else if (goal.type === 'economic_dominance') {
                    if ((aggressor.gold || 0) > (defender.gold || 1) * goal.targetGoldRatio) {
                        goal.achieved = true;
                        logEvent('🎯 ' + aggressor.name + ' achieved war goal: economic dominance over ' + defender.name + '!');
                    } else {
                        allAchieved = false;
                    }
                } else if (goal.type === 'humiliate') {
                    if ((goal.battlesWon || 0) >= goal.requiredBattlesWon) {
                        goal.achieved = true;
                        logEvent('🎯 ' + aggressor.name + ' achieved war goal: humiliated ' + defender.name + '!');
                    } else {
                        allAchieved = false;
                    }
                }
            }

            // If all goals achieved, auto-trigger favorable peace
            if (allAchieved && war.warGoals.length > 0) {
                war._goalsAchieved = true;
                logEvent('🏆 ' + aggressor.name + ' has achieved all war goals against ' + defender.name + '. Seeking favorable peace terms.');
                // Boost peace chance dramatically
                if (aggressor.relations) {
                    aggressor.relations[defender.id] = Math.max(aggressor.relations[defender.id] || 0, -10);
                }
                makePeace(aggressor, defender, true, defender);
            }
        }
    }

    // Increment humiliate counter on battle win
    function incrementWarGoalBattles(winnerK, loserK) {
        if (!world.activeWars || !winnerK || !loserK) return;
        for (var warId in world.activeWars) {
            var war = world.activeWars[warId];
            if (!war.warGoals) continue;
            if (war.aggressor === winnerK.id &&
                ((war.kingdomA === loserK.id || war.kingdomB === loserK.id))) {
                for (var g = 0; g < war.warGoals.length; g++) {
                    if (war.warGoals[g].type === 'humiliate' && !war.warGoals[g].achieved) {
                        war.warGoals[g].battlesWon = (war.warGoals[g].battlesWon || 0) + 1;
                    }
                }
            }
        }
    }

    // ========================================================
    // §14d ALLIANCE DYNAMICS
    // ========================================================
    function processCallToArms(ally, caller, enemyK) {
        if (!ally || !caller || !enemyK) return false;
        var p = ally.kingPersonality || {};
        var rng = world.rng;

        // Evaluate whether to join
        var joinScore = 0;

        // Alliance strength base
        var allianceStrength = ally.relations[caller.id] || 0;
        joinScore += (allianceStrength - 50) * 0.5; // higher relations = more likely

        // Brave kings always join (mostly)
        if (p.courage === 'brave') joinScore += 30;
        if (p.courage === 'cautious') joinScore -= 20;
        if (p.courage === 'cowardly') joinScore -= 40;

        // Treasury health: poor kingdoms hesitate
        if (ally.gold < 500) joinScore -= 20;
        if (ally.gold > 2000) joinScore += 10;

        // War exhaustion penalty
        joinScore -= (ally.warExhaustion || 0) * 0.5;

        // Already in too many wars: alliance fatigue
        joinScore -= ally.atWar.size * 15;

        // Do we border the enemy? (more relevant if yes)
        var bordersEnemy = false;
        for (var tid of ally.territories) {
            for (var road of world.roads) {
                var otherTid = road.fromTownId === tid ? road.toTownId : road.fromTownId;
                if (road.fromTownId === tid || road.toTownId === tid) {
                    var otherTown = findTown(otherTid);
                    if (otherTown && otherTown.kingdomId === enemyK.id) {
                        bordersEnemy = true;
                        break;
                    }
                }
            }
            if (bordersEnemy) break;
        }
        if (bordersEnemy) joinScore += 15;
        if (!bordersEnemy) joinScore -= 10;

        // Decide
        var threshold = 20; // base threshold to join
        if (joinScore >= threshold) {
            // Accept call to arms
            declareWar(ally, enemyK);
            logEvent('⚔️ ' + ally.name + ' answers ' + caller.name + "'s call to arms against " + enemyK.name + '!', {
                type: 'call_to_arms_accepted', kingdoms: [ally.id, caller.id, enemyK.id]
            }, 'military');
            return true;
        } else {
            // Decline — damages relations
            ally.relations[caller.id] = Math.max(-100, (ally.relations[caller.id] || 0) - 20);
            caller.relations[ally.id] = Math.max(-100, (caller.relations[ally.id] || 0) - 15);
            logEvent('🕊️ ' + ally.name + ' declines ' + caller.name + "'s call to arms. Relations damaged.", {
                type: 'call_to_arms_declined', kingdoms: [ally.id, caller.id]
            }, 'military');
            return false;
        }
    }

    // Check if alliance is strong enough to trigger call to arms
    function shouldCallToArms(ally, caller, isDefensive) {
        var allianceStrength = ally.relations[caller.id] || 0;
        var threshold = isDefensive ? 55 : 85; // Offensive alliances need much higher relations
        threshold += ally.atWar.size * 15; // Alliance fatigue
        return allianceStrength >= threshold;
    }

    function isRoadSafe(road) {
        const fromTown = findTown(road.fromTownId);
        const toTown = findTown(road.toTownId);
        if (!fromTown || !toTown) return false;
        // Unsafe if kingdoms are at war
        if (fromTown.kingdomId !== toTown.kingdomId) {
            const kA = findKingdom(fromTown.kingdomId);
            if (kA && kA.atWar.has(toTown.kingdomId)) return false;
        }
        // Unsafe near bandit events
        for (const ev of world.events) {
            if (ev.active && ev.type === 'bandit_surge') {
                if (ev.townId === road.fromTownId || ev.townId === road.toTownId) return false;
            }
        }
        return true;
    }

    // ========================================================
    // §14A KINGDOM HAPPINESS
    // ========================================================
    // Helper: linearly scale a chance from 0 at threshold to maxChance at extreme
    // For penalties: happinessScaledChance(happiness, threshold, maxChance) where happiness < threshold
    // For bonuses: happinessScaledBonus(happiness, threshold, maxChance) where happiness > threshold
    function happinessScaledChance(happiness, threshold, maxChance) {
        if (happiness >= threshold) return 0;
        var ratio = (threshold - happiness) / Math.max(1, threshold);
        return maxChance * Math.min(1, ratio);
    }
    function happinessScaledBonus(happiness, threshold, maxChance) {
        if (happiness <= threshold) return 0;
        var ratio = (happiness - threshold) / Math.max(1, 100 - threshold);
        return maxChance * Math.min(1, ratio);
    }

    function getKingdomHappiness(k) {
        // Population-weighted average of town happiness + kingdom-level modifiers
        var totalPop = 0;
        var weightedSum = 0;
        for (var i = 0; i < world.towns.length; i++) {
            var t = world.towns[i];
            if (t.kingdomId !== k.id) continue;
            if (t._abandoned) continue;
            var pop = typeof t.population === 'number' ? t.population : 0;
            if (pop <= 0) continue;
            weightedSum += (t.happiness || 50) * pop;
            totalPop += pop;
        }
        var baseHappiness = totalPop > 0 ? weightedSum / totalPop : 50;

        // Kingdom-level modifiers
        var modifier = 0;

        // War penalty
        if (k.atWar && k.atWar.size > 0) {
            modifier -= (CONFIG.KINGDOM_HAPPINESS_WAR_PENALTY || 3) * k.atWar.size;
        }

        // Bankruptcy penalty
        if (k._bankruptDays > 0) {
            modifier -= (CONFIG.KINGDOM_HAPPINESS_BANKRUPT_PENALTY || 8);
        }

        // Long peace bonus (360+ days)
        if (k.atWar && k.atWar.size === 0) {
            var lastWarEnd = 0;
            if (k.peaceTreaties) {
                for (var kId in k.peaceTreaties) {
                    var warEnd = (k.peaceTreaties[kId] || 0) - (CONFIG.PEACE_TREATY_DURATION || 720);
                    if (warEnd > lastWarEnd) lastWarEnd = warEnd;
                }
            }
            if (world.day - lastWarEnd > 360) {
                modifier += (CONFIG.KINGDOM_HAPPINESS_PEACE_BONUS || 4);
            }
        }

        // King personality modifier
        var p = k.kingPersonality;
        if (p) {
            if (p.temperament === 'kind' || p.generosity === 'generous') {
                modifier += (CONFIG.KINGDOM_HAPPINESS_KIND_KING_BONUS || 3);
            }
            if (p.temperament === 'cruel' || p.greed === 'corrupt') {
                modifier -= (CONFIG.KINGDOM_HAPPINESS_CRUEL_KING_PENALTY || 4);
            }
        }

        // Wealthy treasury bonus
        if (k.gold > 10000) {
            modifier += (CONFIG.KINGDOM_HAPPINESS_WEALTHY_BONUS || 2);
        }

        return Math.max(0, Math.min(100, baseHappiness + modifier));
    }

    // ============================================================
    // §KM — KING MOOD SYSTEM
    // ============================================================
    function setKingMood(k, mood, reason) {
        if (!CONFIG.KING_MOOD || !CONFIG.KING_MOOD.moods[mood]) return;
        var oldMood = k.kingMood ? k.kingMood.current : 'content';
        if (!k.kingMood) k.kingMood = { current: 'content', since: 0, reason: '' };
        k.kingMood.current = mood;
        k.kingMood.since = world.day;
        k.kingMood.reason = reason || '';
        if (oldMood !== mood) {
            var moodInfo = CONFIG.KING_MOOD.moods[mood];
            logKingAction(k, moodInfo.icon + ' King\'s mood: ' + moodInfo.desc + (reason ? ' (' + reason + ')' : ''));
            logEvent(moodInfo.icon + ' The ruler of ' + k.name + ' is now ' + mood + (reason ? ': ' + reason : '') + '.');
        }
    }

    function getKingMoodModifiers(k) {
        if (!k.kingMood || !CONFIG.KING_MOOD) return { taxMod: 0, festivalMod: 1, petitionMod: 1, warMod: 1, conscriptMod: 1 };
        var moodData = CONFIG.KING_MOOD.moods[k.kingMood.current];
        return moodData || CONFIG.KING_MOOD.moods.content;
    }

    function tickKingMood(k) {
        if (!CONFIG.KING_MOOD) return;
        if (!k.king) return; // Guard: skip kingless kingdoms
        if (!k.kingMood) k.kingMood = { current: 'content', since: 0, reason: '' };
        var mood = k.kingMood.current;
        var duration = CONFIG.KING_MOOD.moodDuration[mood] || 60;
        var daysSince = world.day - (k.kingMood.since || 0);

        // Mood decay — moods decay toward 'content' after their duration
        if (mood !== 'content' && daysSince > duration) {
            setKingMood(k, 'content', 'mood has settled');
            return;
        }

        // Event-driven mood triggers (check conditions)
        var rng = world.rng;
        var p = k.kingPersonality || {};

        // Treasury crisis → worried/paranoid
        if (k.gold < 500) {
            if (mood !== 'paranoid' && mood !== 'fearful') {
                setKingMood(k, 'paranoid', 'treasury is nearly empty');
            }
        } else if (k.gold < 2000 && mood === 'content') {
            if (rng.chance(0.1)) setKingMood(k, 'worried', 'treasury is low');
        }

        // High happiness → jubilant (if not already in a strong mood)
        if (k.happiness > 75 && (mood === 'content' || mood === 'worried')) {
            if (rng.chance(0.05)) setKingMood(k, 'jubilant', 'the people are happy');
        }

        // Low happiness → worried
        if (k.happiness < 30 && mood === 'content') {
            if (rng.chance(0.1)) setKingMood(k, 'worried', 'the people are unhappy');
        }

        // At war → fearful (cowardly) or ambitious (brave)
        if (k.atWar && k.atWar.size > 0) {
            if (mood === 'content') {
                if (p.courage === 'cowardly') {
                    setKingMood(k, 'fearful', 'war rages');
                } else if (p.courage === 'brave' && p.ambition === 'ambitious') {
                    setKingMood(k, 'ambitious', 'victory is within reach');
                }
            }
        }

        // Check for plague events
        if (world.events) {
            for (var ei = 0; ei < world.events.length; ei++) {
                var ev = world.events[ei];
                if (ev.type === 'plague' && ev.kingdomId === k.id && mood !== 'fearful') {
                    setKingMood(k, 'fearful', 'plague ravages the kingdom');
                    break;
                }
            }
        }
    }

    function logKingAction(k, message) {
        if (!k.kingActionLog) k.kingActionLog = [];
        k.kingActionLog.push({ day: world.day, message: message });
        // Keep last 50 entries
        if (k.kingActionLog.length > 50) k.kingActionLog.shift();
    }

    // ============================================================
    // §SC — SUCCESSION CRISIS SYSTEM
    // ============================================================
    function triggerSuccessionCrisis(kingdom, severity, deadKing) {
        var cfg = CONFIG.SUCCESSION_CRISIS;
        if (!cfg) return;
        var rng = world.rng;

        var crisisDays = severity === 'extreme' ? cfg.extremeCrisisDays :
                         severity === 'major' ? cfg.majorCrisisDays : cfg.minorCrisisDays;

        // Build pretender list for major/extreme crises
        var pretenders = [];
        if (severity !== 'minor') {
            // Royal family members
            if (deadKing && deadKing.childrenIds) {
                var royalKids = deadKing.childrenIds.map(function(id) { return findPerson(id); })
                    .filter(function(c) { return c && c.alive && c.age >= 14; });
                for (var ri = 0; ri < royalKids.length; ri++) {
                    pretenders.push({
                        id: royalKids[ri].id, name: royalKids[ri].firstName + ' ' + royalKids[ri].lastName,
                        type: 'royal', support: 30 + rng.randInt(0, 30), gold: royalKids[ri].gold || 0,
                        sex: royalKids[ri].sex
                    });
                }
            }
            // Siblings of dead king
            if (deadKing && deadKing.parentIds) {
                var siblings = world.people.filter(function(p) {
                    return p.alive && p.id !== deadKing.id && p.age >= 18 &&
                        p.parentIds && p.parentIds.some(function(pid) { return deadKing.parentIds.includes(pid); });
                });
                for (var si = 0; si < Math.min(siblings.length, 2); si++) {
                    pretenders.push({
                        id: siblings[si].id, name: siblings[si].firstName + ' ' + siblings[si].lastName,
                        type: 'family', support: 20 + rng.randInt(0, 25), gold: siblings[si].gold || 0,
                        sex: siblings[si].sex
                    });
                }
            }
            // Top elite merchants in the kingdom (wealth = power)
            var elites = (world.eliteMerchants || []).filter(function(em) {
                return em.alive && em.homeKingdomId === kingdom.id && em.gold > 5000;
            }).sort(function(a, b) { return b.gold - a.gold; }).slice(0, 2);
            for (var ei = 0; ei < elites.length; ei++) {
                pretenders.push({
                    id: elites[ei].id, name: elites[ei].name,
                    type: 'merchant', support: 10 + Math.floor(elites[ei].gold / 500), gold: elites[ei].gold,
                    sex: 'M'
                });
            }
            // Military commander (highest-rank soldier)
            var soldiers = (_tickCache.soldiersByKingdom[kingdom.id] || []).filter(function(p) {
                return p.occupation === 'soldier';
            }).sort(function(a, b) { return (b.skills ? b.skills.combat || 0 : 0) - (a.skills ? a.skills.combat || 0 : 0); });
            if (soldiers.length > 0 && soldiers[0]) {
                pretenders.push({
                    id: soldiers[0].id, name: (soldiers[0].firstName || 'Unknown') + ' ' + (soldiers[0].lastName || ''),
                    type: 'military', support: 15 + rng.randInt(5, 20), gold: soldiers[0].gold || 0,
                    sex: soldiers[0].sex || 'M'
                });
            }

            // Filter by female heir law
            var allowFemale = hasSpecialLaw(kingdom, 'female_heir_law');
            if (!allowFemale) {
                pretenders = pretenders.filter(function(pr) { return pr.sex === 'M'; });
            }

            // Cap pretenders
            pretenders = pretenders.slice(0, cfg.maxPretenders);
        }

        kingdom.successionCrisis = {
            active: true,
            severity: severity,
            startDay: world.day,
            endDay: world.day + crisisDays,
            pretenders: pretenders,
            playerBacking: null,    // which pretender player supports
            playerInvested: 0,      // gold invested
            resolved: false,
        };

        // Immediate effects
        var happinessDrop = severity === 'extreme' ? cfg.majorHappinessDrop : cfg.happinessDrop;
        boostKingdomHappiness(kingdom, -happinessDrop);

        // Tax spike chance
        if (rng.chance(cfg.taxSpikeChance)) {
            kingdom.taxRate = Math.min(0.25, kingdom.taxRate + cfg.taxSpikeAmount);
            logKingAction(kingdom, '📈 Taxes spiked during succession crisis');
        }

        // Log the crisis
        var crisisMsg = severity === 'extreme'
            ? '⚠️💀 ' + kingdom.name + ' plunges into chaos! No clear heir — ' + pretenders.length + ' pretenders vie for the throne!'
            : severity === 'major'
                ? '⚠️ ' + kingdom.name + ' faces a succession crisis! The throne is contested by ' + pretenders.length + ' claimants.'
                : '👑 ' + kingdom.name + ' undergoes a succession. The new ruler consolidates power.';

        logEvent(crisisMsg, {
            type: 'succession_crisis', severity: severity,
            effects: ['Happiness -' + happinessDrop, 'Trade disrupted', pretenders.length + ' pretenders']
        });
    }

    function tickSuccessionCrisis(k) {
        if (!k.successionCrisis || !k.successionCrisis.active) return;
        var crisis = k.successionCrisis;
        var rng = world.rng;
        var cfg = CONFIG.SUCCESSION_CRISIS;
        if (!cfg) return;

        // Crisis resolved?
        if (world.day >= crisis.endDay) {
            resolveSuccessionCrisis(k);
            return;
        }

        // Daily crisis effects
        if (crisis.severity === 'extreme') {
            // Pretender skirmishes
            if (crisis.pretenders.length > 1 && rng.chance(cfg.pretenderWarChance)) {
                var fighter1 = rng.pick(crisis.pretenders);
                var fighter2 = rng.pick(crisis.pretenders.filter(function(p) { return p.id !== fighter1.id; }));
                if (fighter2) {
                    var winner = (fighter1.support + rng.randInt(-10, 10)) > (fighter2.support + rng.randInt(-10, 10)) ? fighter1 : fighter2;
                    var loser = winner === fighter1 ? fighter2 : fighter1;
                    winner.support += 10;
                    loser.support = Math.max(0, loser.support - 15);
                    logEvent('⚔️ ' + winner.name + ' defeats ' + loser.name + ' in a skirmish for the throne of ' + k.name + '!');
                    // Eliminate pretenders with 0 support
                    if (loser.support <= 0) {
                        crisis.pretenders = crisis.pretenders.filter(function(p) { return p.id !== loser.id; });
                        logEvent('💀 ' + loser.name + '\'s claim to the throne of ' + k.name + ' has collapsed.', null, 'sensitive_intel');
                    }
                }
            }
            // Happiness bleeds during extreme crisis
            if (world.day % 7 === 0) boostKingdomHappiness(k, -2);
        } else if (crisis.severity === 'major') {
            if (world.day % 14 === 0) boostKingdomHappiness(k, -1);
        }
    }

    function resolveSuccessionCrisis(k) {
        var crisis = k.successionCrisis;
        if (!crisis) return;
        var rng = world.rng;
        var cfg = CONFIG.SUCCESSION_CRISIS;

        if (crisis.pretenders && crisis.pretenders.length > 0) {
            // Sort by support — winner takes the throne
            crisis.pretenders.sort(function(a, b) { return b.support - a.support; });
            var winner = crisis.pretenders[0];

            var winnerPerson = findPerson(winner.id);
            if (winnerPerson && winnerPerson.alive) {
                installNewKing(k, winnerPerson, 'succession_crisis');
                logEvent('👑 ' + winner.name + ' emerges victorious and claims the throne of ' + k.name + '!');
                setKingMood(k, 'ambitious', 'seized the throne');
            }

            // Reward/penalize player if they backed someone
            if (crisis.playerBacking && typeof Player !== 'undefined') {
                if (crisis.playerBacking === winner.id) {
                    // Player backed the winner!
                    logEvent('🎉 Your claimant ' + winner.name + ' won the throne! You are greatly rewarded.');
                    if (Player.state) {
                        Player.state.gold += cfg.winnerGoldReward;
                        Player.state.reputation[k.id] = Math.min(100, (Player.state.reputation[k.id] || 50) + cfg.winnerRepBoost);
                        var currentRank = Player.state.socialRank[k.id] || 0;
                        if (currentRank < 6) {
                            Player.state.socialRank[k.id] = currentRank + cfg.winnerRankBoost;
                        }
                    }
                } else {
                    // Player backed a loser
                    logEvent('😞 Your claimant lost. You lose reputation and some of your investment.');
                    if (Player.state) {
                        Player.state.reputation[k.id] = Math.max(0, (Player.state.reputation[k.id] || 50) - cfg.loserRepPenalty);
                        Player.state.gold -= Math.floor(crisis.playerInvested * cfg.loserGoldLoss);
                        if (Player.state.gold < 0) Player.state.gold = 0;
                    }
                }
            }
        }

        // Restore stability
        boostKingdomHappiness(k, 5);
        crisis.active = false;
        crisis.resolved = true;
        k.successionCrisis = null;
        logEvent('✅ The succession crisis in ' + k.name + ' has been resolved.', null, 'sensitive_intel');
    }

    // ============================================================
    // §RC — ROYAL COMMISSIONS SYSTEM
    // ============================================================
    function tickRoyalCommissions(k) {
        var cfg = CONFIG.ROYAL_COMMISSIONS;
        if (!cfg) return;
        if (!k.royalCommissions) k.royalCommissions = [];
        var rng = world.rng;
        var p = k.kingPersonality || {};
        var mood = getKingMoodModifiers(k);

        // Expire old commissions
        for (var ci = k.royalCommissions.length - 1; ci >= 0; ci--) {
            var comm = k.royalCommissions[ci];
            if (comm.status === 'open' && world.day > comm.expiresDay) {
                comm.status = 'expired';
                logKingAction(k, '📜 Royal commission expired: ' + comm.description);
                k.royalCommissions.splice(ci, 1);
            }
        }

        // Generate new commissions (check interval)
        if (world.day % cfg.checkInterval !== 0) return;
        var openCount = k.royalCommissions.filter(function(c) { return c.status === 'open'; }).length;
        if (openCount >= cfg.maxActivePerKingdom) return;

        // Don't issue commissions during extreme crisis
        if (k.successionCrisis && k.successionCrisis.active && k.successionCrisis.severity === 'extreme') return;

        // Paranoid/fearful kings issue military commissions, jubilant kings issue trade commissions
        var moodCurrent = k.kingMood ? k.kingMood.current : 'content';
        var commissionTypes = [];

        // Military needs
        if (k.atWar && k.atWar.size > 0) {
            var milGoods = ['swords', 'armor', 'bows', 'arrows'];
            for (var mi = 0; mi < milGoods.length; mi++) {
                var stock = k.militaryStockpile ? (k.militaryStockpile[milGoods[mi]] || 0) : 0;
                if (stock < 50) {
                    commissionTypes.push({
                        type: 'military_supply',
                        resourceId: milGoods[mi],
                        quantity: rng.randInt(20, 100),
                        priority: 'high',
                    });
                }
            }
        }

        // Food needs based on population
        var totalPop = 0;
        for (var ti of k.territories) {
            var town = findTown(ti);
            if (town) totalPop += town.population || 0;
        }
        var foodGoods = ['bread', 'wheat', 'meat', 'fish', 'preserved_food'];
        if (k.gold > 2000) {
            var food = rng.pick(foodGoods);
            commissionTypes.push({
                type: 'goods_delivery',
                resourceId: food,
                quantity: rng.randInt(30, Math.max(50, Math.floor(totalPop * 0.5))),
                priority: 'normal',
            });
        }

        // Luxury/trade goods (wealthy kingdoms)
        if (k.gold > 5000 && (moodCurrent === 'jubilant' || moodCurrent === 'content')) {
            var luxGoods = ['jewelry', 'wine', 'cloth', 'spices', 'silk'];
            commissionTypes.push({
                type: 'goods_delivery',
                resourceId: rng.pick(luxGoods),
                quantity: rng.randInt(10, 40),
                priority: 'low',
            });
        }

        // Building requests (intelligent kings)
        if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && k.gold > 3000) {
            var neededBuildings = ['hospital', 'granary', 'university', 'library'];
            var kTowns = world.towns.filter(function(t) { return k.territories.has(t.id); });
            for (var bi = 0; bi < neededBuildings.length; bi++) {
                var bt = neededBuildings[bi];
                var hasIt = kTowns.some(function(t) { return t.buildings.some(function(b) { return b.type === bt; }); });
                if (!hasIt) {
                    commissionTypes.push({
                        type: 'building_request',
                        buildingType: bt,
                        townId: kTowns.length > 0 ? rng.pick(kTowns).id : null,
                        priority: 'normal',
                    });
                    break;
                }
            }
        }

        // Pick one commission to issue
        if (commissionTypes.length === 0) return;
        var highPriority = commissionTypes.filter(function(c) { return c.priority === 'high'; });
        var chosen = highPriority.length > 0 ? rng.pick(highPriority) : rng.pick(commissionTypes);

        var res = chosen.resourceId ? findResourceById(chosen.resourceId) : null;
        var baseValue = res ? (res.basePrice || 5) * (chosen.quantity || 1) : 500;
        var reward = Math.floor(baseValue * cfg.baseReward);

        var commission = {
            id: 'rc_' + k.id + '_' + world.day,
            kingdomId: k.id,
            type: chosen.type,
            resourceId: chosen.resourceId || null,
            buildingType: chosen.buildingType || null,
            townId: chosen.townId || null,
            quantity: chosen.quantity || 0,
            reward: reward,
            repReward: cfg.repReward,
            issuedDay: world.day,
            expiresDay: world.day + cfg.expirationDays,
            status: 'open',
            fulfilledBy: null,
            description: chosen.type === 'goods_delivery'
                ? 'Deliver ' + chosen.quantity + ' ' + (res ? res.name : chosen.resourceId) + ' to the crown'
                : chosen.type === 'military_supply'
                    ? 'Supply ' + chosen.quantity + ' ' + (res ? res.name : chosen.resourceId) + ' for the army'
                    : 'Build a ' + (chosen.buildingType || 'workshop') + ' in ' + (findTown(chosen.townId) ? findTown(chosen.townId).name : 'a town'),
        };

        k.royalCommissions.push(commission);
        logKingAction(k, '📜 Royal commission posted: ' + commission.description + ' (reward: ' + reward + 'g)');
        logEvent('📜 ' + k.name + ' seeks: ' + commission.description + ' — Reward: ' + reward + 'g + reputation!');
    }

    // ========================================================
    // §14B KING DECISIONS (called each season)
    // ========================================================
    function tickKingDecisions(k) {
        if (!k.king) return; // Guard: skip kingless kingdoms
        const rng = world.rng;
        const treasury = k.gold;
        const happiness = k.happiness != null ? k.happiness : 50;
        const atWar = k.atWar.size > 0;
        const p = k.kingPersonality;
        if (!p) return; // Guard: no personality data
        // King mood modifiers affect all decisions
        var mood = getKingMoodModifiers(k);

        // 1. TAX ADJUSTMENT
        // Personality-based max tax caps
        let maxTaxRate = 0.25;
        if (p.greed === 'generous') maxTaxRate = 0.10;
        else if (p.greed === 'fair') maxTaxRate = 0.15;
        else if (p.greed === 'greedy') maxTaxRate = 0.20;
        else if (p.greed === 'corrupt') maxTaxRate = 0.25;

        if (p.greed === 'greedy' || p.greed === 'corrupt') {
            var _oldRate = k.taxRate;
            if (rng.chance(0.3)) k.taxRate = Math.min(maxTaxRate, k.taxRate + 0.02 + (mood.taxMod || 0));
            if (k.taxRate > _oldRate) k.lastTaxIncreaseDay = world.day;
            if (k.taxRate > _oldRate) logKingAction(k, '📈 Raised taxes to ' + Math.round(k.taxRate * 100) + '%');
        } else if (p.greed === 'generous' && happiness < 50) {
            if (rng.chance(0.4)) {
                k.taxRate = Math.max(0.02, k.taxRate - 0.02);
                logKingAction(k, '📉 Lowered taxes to ' + Math.round(k.taxRate * 100) + '%');
            }
        }

        // Enforce personality cap
        k.taxRate = Math.min(k.taxRate, maxTaxRate);

        // Smart kings adjust taxes based on happiness
        if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && happiness < 40) {
            k.taxRate = Math.max(0.02, k.taxRate - 0.02);
        }

        // Mood-driven tax adjustment
        if (mood.taxMod > 0 && k.kingMood && k.kingMood.current !== 'content') {
            k.taxRate = Math.min(maxTaxRate, k.taxRate + mood.taxMod);
            if (mood.taxMod >= 0.03) logKingAction(k, '📈 Raised taxes due to ' + (k.kingMood.reason || 'unrest'));
        } else if (mood.taxMod < 0) {
            k.taxRate = Math.max(0.02, k.taxRate + mood.taxMod);
            logKingAction(k, '📉 Lowered taxes — the king is in a generous mood');
        }

        // 2. MILITARY(ambitious/brave kings build more military)
        if (p.ambition === 'ambitious' && !atWar && rng.chance(0.3)) {
            // Recruit in peacetime
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                var idle = (_tickCache.peopleByTown[town.id] || []).filter(function(pp) {
                    return (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                    pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 50;
                });
                if (idle.length > 0 && k.gold > 200) {
                    const recruit = idle[0];
                    recruit.occupation = 'soldier';
                    recruit.skills.combat = Math.max(recruit.skills.combat, 20);
                    town.garrison++;
                    k.gold -= 50;
                    break;
                }
            }
        }

        // 3. INFRASTRUCTURE (clever/brilliant kings invest wisely)
        if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && treasury > 1000 && rng.chance(0.2)) {
            // Build missing essential buildings in towns that lack them
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                const hasType = (type) => town.buildings.some(b => b.type === type);
                if (!hasType('bakery') && kingdomBuild(k, town, 'bakery', rng)) {
                    logKingAction(k, '🏗️ Built a bakery in ' + town.name);
                    break;
                }
                if (!hasType('blacksmith') && kingdomBuild(k, town, 'blacksmith', rng)) {
                    logKingAction(k, '🏗️ Built a blacksmith in ' + town.name);
                    break;
                }
            }
        } else if (p.intelligence === 'foolish' && rng.chance(0.15) && k.gold > 500) {
            // Foolish kings waste money on vanity projects
            var wasteAmount = Math.min(200, Math.floor(k.gold * 0.1));
            k.gold -= wasteAmount;
            logEvent('\uD83E\uDD34 The foolish ruler of ' + k.name + ' wastes ' + wasteAmount + 'g on a vanity project.', {
                type: 'vanity_project', cause: 'Poor judgment by dim ruler',
                effects: ['Treasury -' + wasteAmount + 'g', 'No benefit to the kingdom']
            });
        }

        // 3a. NATIONALIZATION — greedy/corrupt kings may nationalize industries (rare, seasonal)
        if (!k.nationalizedIndustries) k.nationalizedIndustries = [];
        if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.10) && k.nationalizedIndustries.length < 3) {
            const candidates = (CONFIG.KINGDOM_BUILDING_TYPES || []).filter(
                bt => !k.nationalizedIndustries.includes(bt) && !(CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bt)
            );
            if (candidates.length > 0) {
                const target = rng.pick(candidates);
                k.nationalizedIndustries.push(target);
                logEvent(`👑 ${k.name} has nationalized all ${target} operations! NPC-owned ${target}s can no longer produce.`);
                // Kingdom builds nationalized buildings in towns that lack them
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const hasOwned = town.buildings.some(b => b.type === target && b.ownerId === k.id);
                    if (!hasOwned) {
                        if (kingdomBuild(k, town, target, rng)) {
                            // Override ownerId to kingdom
                            var lastBld = town.buildings[town.buildings.length - 1];
                            if (lastBld) lastBld.ownerId = k.id;
                        }
                    }
                }
            }
        }

        // 3b. MAINTENANCE — repair degraded buildings, walls, and roads
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;

            // Building maintenance
            for (const bld of town.buildings) {
                if (bld.ownerId === 'player') continue; // player repairs their own
                const repairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
                if (p.intelligence === 'foolish' || p.intelligence === 'dim') continue; // neglectful kings skip maintenance
                if (bld.condition === repairThreshold || bld.condition === 'breaking' || bld.condition === 'destroyed') {
                    const bt = findBuildingType(bld.type);
                    const repairCost = bld.condition === 'destroyed' ? Math.floor((bt ? bt.cost : 200) * 0.5)
                                     : bld.condition === 'breaking' ? Math.floor((bt ? bt.cost : 200) * 0.3)
                                     : Math.floor((bt ? bt.cost : 200) * 0.2);
                    if (k.gold >= repairCost) {
                        bld.condition = 'new';
                        bld.lastRepairDay = world.day;
                        k.gold -= repairCost;
                    }
                }
            }

            // Wall maintenance
            if (town.walls > 0 && town.wallCondition) {
                const wallRepairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
                if (p.intelligence !== 'foolish' && p.intelligence !== 'dim') {
                    if (town.wallCondition === wallRepairThreshold || town.wallCondition === 'breaking' || town.wallCondition === 'destroyed') {
                        const wallCfg = CONFIG.WALL_LEVELS[town.walls];
                        const wallRepairCost = town.wallCondition === 'destroyed' ? Math.floor((wallCfg ? wallCfg.cost : 200) * 0.5)
                                             : town.wallCondition === 'breaking' ? Math.floor((wallCfg ? wallCfg.cost : 200) * 0.3)
                                             : Math.floor((wallCfg ? wallCfg.cost : 200) * 0.2);
                        if (k.gold >= wallRepairCost) {
                            town.wallCondition = 'new';
                            town.wallLastRepair = world.day;
                            k.gold -= wallRepairCost;
                        }
                    }
                }
            }
        }

        // Road maintenance — all kings do some road repair, smarter kings are more thorough
        {
            const isDimOrFoolish = p.intelligence === 'foolish' || p.intelligence === 'dim';
            const repairThreshold = (p.intelligence === 'brilliant' || p.intelligence === 'clever') ? 'used' : 'breaking';
            let repairsThisTick = 0;
            // Dim/foolish kings: only repair 1 destroyed road per tick, 30%/15% chance
            const dimRepairChance = p.intelligence === 'dim' ? 0.30 : p.intelligence === 'foolish' ? 0.15 : 1;
            const dimMaxRepairs = isDimOrFoolish ? 1 : 999;

            if (!isDimOrFoolish || rng.chance(dimRepairChance)) {
                for (const road of world.roads) {
                    if (repairsThisTick >= dimMaxRepairs) break;
                    const fromT = findTown(road.fromTownId);
                    const toT = findTown(road.toTownId);
                    if (!fromT && !toT) continue;
                    if ((fromT && k.territories.has(fromT.id)) || (toT && k.territories.has(toT.id))) {
                        // Dim/foolish: only repair destroyed roads; smart kings: repair at their threshold
                        const shouldRepair = isDimOrFoolish
                            ? road.condition === 'destroyed'
                            : (road.condition === repairThreshold || road.condition === 'breaking' || road.condition === 'destroyed');
                        if (shouldRepair) {
                            const roadRepairCost = road.condition === 'destroyed' ? 150 : road.condition === 'breaking' ? 80 : 40;
                            if (k.gold >= roadRepairCost) {
                                road.condition = 'new';
                                road.lastRepairDay = world.day;
                                k.gold -= roadRepairCost;
                                repairsThisTick++;
                            }
                        }
                    }
                }
            }
        }

        // Kings rebuild destroyed bridges
        if (p.intelligence !== 'foolish' && p.intelligence !== 'dim') {
            for (let ri = 0; ri < world.roads.length; ri++) {
                const road = world.roads[ri];
                if (!(road.hasBridge || false) || !road.bridgeDestroyed) continue;
                const fromT = findTown(road.fromTownId);
                const toT = findTown(road.toTownId);
                if (!fromT && !toT) continue;
                if ((fromT && k.territories.has(fromT.id)) || (toT && k.territories.has(toT.id))) {
                    const rebuildCost = CONFIG.BRIDGE_REBUILD_COST || 1000;
                    const daysSinceDestroyed = world.day - (road.bridgeDestroyedDay || 0);
                    if (daysSinceDestroyed >= (CONFIG.BRIDGE_REBUILD_DAYS || 30) && k.gold >= rebuildCost) {
                        k.gold -= rebuildCost;
                        rebuildBridge(ri);
                    }
                }
            }
        }

        // Urgent: reconnect isolated towns (guaranteed, not random)
        if (k.gold >= 300) {
            var kTerrSet = k.territories instanceof Set ? k.territories : new Set(k.territories || []);
            var kTownsAll = world.towns.filter(function(t) { return kTerrSet.has(t.id) && !t.destroyed && !t.abandoned; });
            for (var iti = 0; iti < kTownsAll.length; iti++) {
                var isolatedTown = kTownsAll[iti];
                var hasRoad = world.roads.some(function(r) {
                    return (r.fromTownId === isolatedTown.id || r.toTownId === isolatedTown.id) && r.condition !== 'destroyed';
                });
                if (hasRoad) continue;
                // Also check sea routes
                var hasSea = (world.seaRoutes || []).some(function(sr) {
                    return (sr.fromTownId === isolatedTown.id || sr.from === isolatedTown.id) ||
                           (sr.toTownId === isolatedTown.id || sr.to === isolatedTown.id);
                });
                if (hasSea) continue;

                // Find nearest connected town
                var bestTarget = null, bestDist = Infinity;
                for (var itj = 0; itj < world.towns.length; itj++) {
                    var cand = world.towns[itj];
                    if (cand.id === isolatedTown.id || cand.destroyed || cand.abandoned) continue;
                    var candHasRoad = world.roads.some(function(r) {
                        return (r.fromTownId === cand.id || r.toTownId === cand.id) && r.condition !== 'destroyed';
                    });
                    if (!candHasRoad) continue;
                    var d = Math.hypot((cand.x || 0) - (isolatedTown.x || 0), (cand.y || 0) - (isolatedTown.y || 0));
                    if (d < bestDist) { bestDist = d; bestTarget = cand; }
                }
                if (bestTarget && bestDist < 3000) {
                    // First try to repair existing destroyed road
                    var existingDestroyed = world.roads.find(function(r) {
                        return ((r.fromTownId === isolatedTown.id && r.toTownId === bestTarget.id) ||
                                (r.fromTownId === bestTarget.id && r.toTownId === isolatedTown.id)) &&
                               r.condition === 'destroyed';
                    });
                    if (existingDestroyed) {
                        existingDestroyed.condition = 'used';
                        existingDestroyed.lastRepairDay = world.day;
                        k.gold -= 150;
                    } else {
                        var buildCost = Math.floor(300 + bestDist * 0.5);
                        if (k.gold >= buildCost) {
                            k.gold -= buildCost;
                            buildNewRoad(isolatedTown.id, bestTarget.id, k.id);
                        }
                    }
                    break; // Only fix 1 per tick per kingdom
                }
            }
        }

        // Kingdom road construction — kings build new roads for economic benefit
        // All non-foolish kings build roads; smarter kings build more frequently
        // Road importance factors into pair selection
        var roadBuildChance = p.intelligence === 'brilliant' ? 0.02 : p.intelligence === 'clever' ? 0.01 : p.intelligence === 'average' ? 0.005 : p.intelligence === 'dim' ? 0.002 : 0.001;
        if (roadBuildChance > 0 && k.gold >= 2000 && rng.chance(roadBuildChance)) {
            const kTowns = world.towns.filter(t => k.territories.has(t.id) && !t.destroyed && !t.abandoned);
            // Priority: connect roadless towns first
            var roadlessTowns = kTowns.filter(t => {
                return !world.roads.some(r =>
                    ((r.fromTownId === t.id || r.toTownId === t.id) && r.condition !== 'destroyed')
                );
            });
            var candidateTowns = roadlessTowns.length > 0 ? roadlessTowns : kTowns;
            let bestPair = null, bestPairScore = -Infinity;
            for (let ci = 0; ci < candidateTowns.length; ci++) {
                var connectedTargets = roadlessTowns.length > 0 ? kTowns : kTowns;
                for (let cj = 0; cj < connectedTargets.length; cj++) {
                    const a = candidateTowns[ci], b = connectedTargets[cj];
                    if (a.id === b.id) continue;
                    const directRoad = world.roads.find(r =>
                        ((r.fromTownId === a.id && r.toTownId === b.id) ||
                        (r.fromTownId === b.id && r.toTownId === a.id)) &&
                        r.condition !== 'destroyed'
                    );
                    if (directRoad) continue;
                    const waterFrac = checkWaterPath(a.x, a.y, b.x, b.y);
                    if (waterFrac > (CONFIG.ROAD_MAX_WATER_FRACTION || 0.15)) continue;
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d > 2000) continue;
                    // Score by road importance (population, prosperity, strategic value)
                    var pairScore = computeRoadImportance(a, b);
                    if (pairScore > bestPairScore) { bestPairScore = pairScore; bestPair = { a, b, dist: d }; }
                }
            }
            if (bestPair) {
                const buildCost = Math.floor(500 + bestPair.dist);
                if (k.gold >= buildCost) {
                    k.gold -= buildCost;
                    buildNewRoad(bestPair.a.id, bestPair.b.id, k.id);
                    logEvent(`\uD83D\uDC51 ${k.name} has commissioned a new road between ${bestPair.a.name} and ${bestPair.b.name}!`);
                }
            }
        }

        // 4. HAPPINESS MANAGEMENT
        if (happiness < 40 && p.temperament !== 'cruel') {
            if (p.intelligence === 'brilliant' || p.intelligence === 'clever') {
                // Smart: lower taxes, hold festival
                k.taxRate = Math.max(0.02, k.taxRate - 0.01);
                if (k.gold > 2000 && rng.chance(0.3)) {
                    k.gold -= 200;
                    boostKingdomHappiness(k, 10);
                    // Mark towns for festival afterglow
                    for (const tid of k.territories) { const t = findTown(tid); if (t) t._festivalDay = world.day; }
                    logEvent(`${k.name} holds a royal festival! Citizens rejoice.`, {
                        type: 'festival',
                        cause: 'The ruler of ' + k.name + ' noticed low happiness (' + Math.round(happiness) + '%) and spent 200g to boost morale.',
                        effects: [
                            'Kingdom happiness increased by 10 points',
                            'Treasury decreased by 200g (now ' + Math.floor(k.gold) + 'g)',
                            'Citizens feel more loyal to the crown'
                        ]
                    });
                    logKingAction(k, '🎉 Held a festival (-200g, +10 happiness)');
                }
            } else if (p.intelligence === 'dim' || p.intelligence === 'foolish') {
                // Dim kings increase guards (makes it worse if already unhappy)
                if (rng.chance(0.3)) {
                    for (const townId of k.territories) {
                        const town = findTown(townId);
                        if (!town || town.garrison > 30) continue;
                        town.garrison = Math.min(50, town.garrison + 2);
                        break;
                    }
                }
            }
        }

        // 5. FORCED REQUISITION (corrupt/greedy kings only)
        if (p.greed === 'corrupt' && rng.chance(0.2)) {
            const hasReq = k.laws.specialLaws && k.laws.specialLaws.some(l => l.id === 'forced_requisition');
            if (!hasReq) {
                if (!k.laws.specialLaws) k.laws.specialLaws = [];
                k.laws.specialLaws.push({ id: 'forced_requisition', name: 'Forced Requisition', desc: 'Guards may seize goods from merchants.' });
                logEvent(`${k.name} enacts Forced Requisition laws!`, {
                    type: 'forced_requisition',
                    cause: 'The corrupt ruler of ' + k.name + ' has authorized the seizure of merchant goods.',
                    effects: [
                        'Guards may seize goods from merchants',
                        'Merchant profits at risk in ' + k.name,
                        'Trade in the kingdom becomes more dangerous',
                        'Kingdom happiness may decrease'
                    ]
                });
                logKingAction(k, '⚠️ Enacted Forced Requisition');
            }
        }

        // 6. FESTIVALS (kind kings — foolish/generous kings may party while broke, smart kings require 2000g)
        var festGate = (p.intelligence === 'foolish' || p.intelligence === 'dim') ? 100 : 2000;
        if (p.greed === 'greedy' || p.greed === 'corrupt') festGate = Infinity; // greedy kings never hold festivals
        if (p.temperament === 'kind' && k.gold > festGate && rng.chance(0.15)) {
            k.gold -= 200;
            boostKingdomHappiness(k, 10);
            for (const tid of k.territories) { const t = findTown(tid); if (t) t._festivalDay = world.day; }
            logEvent(`The kind ruler of ${k.name} holds a festival for the people.`, {
                type: 'festival',
                cause: 'The generous ruler of ' + k.name + ' decided to celebrate with the people.',
                effects: [
                    'Kingdom happiness increased by 10 points',
                    'Treasury decreased by 200g (now ' + Math.floor(k.gold) + 'g)',
                    'Citizens feel more loyal to the crown'
                ]
            });
        }

        // 6b. ROYAL TOURNAMENT — king sponsors a tournament at the capital
        // Expire any finished tournament (lasts 30 days)
        if (k.tournament && k.tournament.active && (world.day - k.tournament.startDay) > 30) {
            k.tournament.active = false;
            logEvent(`🏟️ The royal tournament in ${k.name} has concluded.`);
        }
        // Kings can sponsor new tournaments when not at war, treasury > 1000g, no active tournament
        // Higher chance for ambitious/brave kings, lower for miserly/cowardly
        if (!atWar && k.gold > 1000 && (!k.tournament || !k.tournament.active)) {
            var tournamentChance = 0.02; // base 2% per tick
            if (p.ambition === 'ambitious') tournamentChance += 0.02;
            if (p.courage === 'brave') tournamentChance += 0.01;
            if (p.greed === 'generous' || p.greed === 'fair') tournamentChance += 0.01;
            if (p.greed === 'greedy' || p.greed === 'corrupt') tournamentChance -= 0.02;
            if (p.temperament === 'cruel') tournamentChance -= 0.01;
            if (tournamentChance > 0 && rng.chance(tournamentChance)) {
                var capitalTown = null;
                for (var _tid of k.territories) {
                    var _t = findTown(_tid);
                    if (_t && _t.isCapital) { capitalTown = _t; break; }
                }
                if (capitalTown) {
                    var entryFee = rng.randInt(5, 20);
                    var tournamentCost = 300 + entryFee * 10; // kingdom pays to organize
                    k.gold -= tournamentCost;
                    k.tournament = {
                        active: true,
                        startDay: world.day,
                        entryFee: entryFee,
                        townId: capitalTown.id,
                    };
                    boostKingdomHappiness(k, 5);
                    logEvent(`🏟️ The ruler of ${k.name} has announced a Royal Tournament in ${capitalTown.name}! Entry fee: ${entryFee}g.`, {
                        type: 'tournament', cause: 'Royal decree',
                        effects: ['Fighters from across the land gather', 'Kingdom happiness +5', 'Grand prizes for the champion']
                    });
                    logKingAction(k, '🏟️ Sponsored a royal tournament');
                }
            }
        }

        // 7. LAW CHANGES
        if (p.ambition === 'ambitious' && rng.chance(0.1)) {
            // Ambitious kings may add restrictive trade laws
            if (k.laws.tradeTariff < 0.15) {
                k.laws.tradeTariff = Math.min(0.15, k.laws.tradeTariff + 0.01);
                logKingAction(k, '📈 Raised trade tariff to ' + Math.round(k.laws.tradeTariff * 100) + '%');
            }
        }
        if (p.temperament === 'cruel' && rng.chance(0.1)) {
            k.taxRate = Math.min(0.25, k.taxRate + 0.01);
            k.lastTaxIncreaseDay = world.day;
            logKingAction(k, '📈 Cruel king raised taxes to ' + Math.round(k.taxRate * 100) + '%');
        }

        // =============================================
        // 8. WARTIME MILITARY DECISIONS
        // =============================================
        if (atWar) {
            // a. MASS RECRUITMENT — recruit aggressively during war
            // War exhaustion reduces or halts recruitment
            var recruitMod = getWarExhaustionRecruitMod(k);
            const recruitLimit = Math.floor((p.courage === 'brave' ? 5 :
                                 p.courage === 'cautious' ? 2 : 1) * recruitMod);
            let recruited = 0;
            for (const townId of k.territories) {
                if (recruited >= recruitLimit) break;
                const town = findTown(townId);
                if (!town) continue;
                var idle = (_tickCache.peopleByTown[town.id] || []).filter(function(pp) {
                    return (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                    pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 50;
                });
                for (const person of idle) {
                    if (recruited >= recruitLimit) break;
                    if (k.gold < 75) break; // Wartime recruitment costs 2× (75g vs 50g peacetime)
                    person.occupation = 'soldier';
                    person.skills.combat = Math.max(person.skills.combat, 20);
                    town.garrison++;
                    k.gold -= 75;
                    recruited++;
                }
            }

            // b. BUY WEAPONS FROM MARKET — creates real demand (including quality tiers)
            const weaponGoods = ['swords', 'armor', 'bows', 'arrows', 'horses'];
            // Smart kings also buy quality weapons during war
            const qualityGoods = (p.intelligence === 'brilliant' || p.intelligence === 'clever')
                ? ['swords_good', 'armor_good', 'bows_good', 'arrows_good'] : [];
            const allWeaponGoods = weaponGoods.concat(qualityGoods);
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                for (const good of allWeaponGoods) {
                    const available = town.market.supply[good] || 0;
                    const price = town.market.prices[good] || 20;
                    const toBuy = Math.min(available, Math.floor(k.gold / price), 5);
                    if (toBuy > 0 && k.gold >= toBuy * price) {
                        town.market.supply[good] = Math.max(0, available - toBuy);
                        k.gold -= toBuy * price;
                        town.market.demand[good] = (town.market.demand[good] || 0) + toBuy;
                    }
                }

                // Smart kings set military buildings to produce quality weapons
                for (const bld of town.buildings) {
                    const militaryTypes = ['blacksmith', 'armorer', 'fletcher', 'arrow_maker'];
                    if (militaryTypes.includes(bld.type) && bld.ownerId === null) {
                        if (p.intelligence === 'brilliant') {
                            bld.productionTier = 'good';
                        } else if (p.intelligence === 'clever') {
                            bld.productionTier = rng.chance(0.5) ? 'good' : 'basic';
                        }
                    }
                }
            }

            // c. FORTIFY THREATENED TOWNS — build/upgrade walls
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                const wallLevel = town.walls || 0;
                if (wallLevel >= 3) continue;
                const nextLevel = wallLevel + 1;
                const wallConfig = CONFIG.WALL_LEVELS[nextLevel];
                if (!wallConfig) continue;
                // Check if town is near enemy
                const nearEnemy = world.towns.some(t =>
                    k.atWar.has(t.kingdomId) && Math.hypot(t.x - town.x, t.y - town.y) < 2000
                );
                if (!nearEnemy && !town.isCapital) continue;
                if (k.gold < wallConfig.cost) continue;
                // Check materials
                let hasMats = true;
                for (const [matId, qty] of Object.entries(wallConfig.materials)) {
                    if ((town.market.supply[matId] || 0) < qty) { hasMats = false; break; }
                }
                if (hasMats && rng.chance(0.2)) {
                    for (const [matId, qty] of Object.entries(wallConfig.materials)) {
                        town.market.supply[matId] -= qty;
                    }
                    town.walls = nextLevel;
                    k.gold -= wallConfig.cost;
                    logEvent(`${kingdom_name(k)} has built ${wallConfig.name} around ${town.name}!`);
                }
            }

            // d. DISPATCH ARMIES — handled in kingdomAI, but smart/aggressive kings target differently
            // (Already handled in kingdomAI function)

            // e. REINFORCE TOWNS — move garrison from safe towns to threatened ones
            if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && rng.chance(0.3)) {
                const safeTowns = [];
                const threatenedTowns = [];
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const nearEnemy = world.towns.some(t =>
                        k.atWar.has(t.kingdomId) && Math.hypot(t.x - town.x, t.y - town.y) < 1500
                    );
                    if (nearEnemy) threatenedTowns.push(town);
                    else safeTowns.push(town);
                }
                for (const safe of safeTowns) {
                    if (safe.garrison <= CONFIG.GARRISON_MIN + 5) continue;
                    for (const threatened of threatenedTowns) {
                        if (threatened.garrison < CONFIG.GARRISON_MIN + 10) {
                            const transfer = Math.min(5, safe.garrison - CONFIG.GARRISON_MIN);
                            if (transfer > 0) {
                                safe.garrison -= transfer;
                                threatened.garrison += transfer;
                            }
                        }
                    }
                }
            }

            // f. BUILD MILITARY BUILDINGS
            if (k.gold > 800 && rng.chance(0.15)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const hasBarracks = town.buildings.some(b => b.type === 'barracks');
                    if (!hasBarracks && k.gold >= 600) {
                        if (kingdomBuild(k, town, 'barracks', rng)) {
                            logKingAction(k, '🏗️ Built barracks in ' + town.name);
                            break;
                        }
                    }
                }
            }

            // g. NEGOTIATE PEACE — if losing badly or war-exhausted
            for (const enemyId of k.atWar) {
                const enemy = findKingdom(enemyId);
                if (!enemy) continue;
                const myStr = computeMilitaryStrength(k);
                const theirStr = computeMilitaryStrength(enemy);
                const losing = myStr < theirStr * 0.6;
                const lostTowns = (kingdom => {
                    if (!world.activeWars) return 0;
                    for (const wid in world.activeWars) {
                        const w = world.activeWars[wid];
                        if ((w.kingdomA === k.id || w.kingdomB === k.id) &&
                            (w.kingdomA === enemyId || w.kingdomB === enemyId)) {
                            const origCount = w.originalTowns[k.id] || k.territories.size;
                            return origCount - k.territories.size;
                        }
                    }
                    return 0;
                })(k);

                var exhaustion = k.warExhaustion || 0;
                var highExhaustion = exhaustion > 50;
                var criticalExhaustion = exhaustion > 75;

                const wantsPeace = (losing && lostTowns >= 2 && p.courage !== 'brave') ||
                                   (p.courage === 'cowardly' && losing) ||
                                   (p.intelligence === 'brilliant' && losing && lostTowns >= 1) ||
                                   (highExhaustion && p.courage !== 'brave') ||
                                   (criticalExhaustion) || // even brave kings consider peace at critical exhaustion
                                   (k.gold < 200 && (k._bankruptDays || 0) > 30);

                var peaceChance = 0.1;
                if (criticalExhaustion) peaceChance = 0.4;
                else if (highExhaustion) peaceChance = 0.2;
                if (k.atWar.size > 1) peaceChance += 0.1; // multi-front pressure

                if (wantsPeace && rng.chance(peaceChance)) {
                    makePeace(k, enemy, true, k);
                    break;
                }
            }
        }

        // Peacetime: reset military buildings to basic production
        if (!atWar) {
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                for (const bld of town.buildings) {
                    if (['blacksmith', 'armorer', 'fletcher', 'arrow_maker'].includes(bld.type) && bld.ownerId === null) {
                        bld.productionTier = 'basic';
                    }
                }
            }
        }

        // =============================================
        // 9. DIPLOMATIC ACTIONS (enhanced king decisions)
        // =============================================
        // a. Propose trade agreements — reduce tariffs with ally
        if (rng.chance(p.intelligence === 'brilliant' ? 0.3 : 0.10)) {
            const potentialPartners = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) && (k.relations[o.id] || 0) > 20
            );
            if (potentialPartners.length > 0) {
                const partner = rng.pick(potentialPartners);
                k.relations[partner.id] = Math.min(100, (k.relations[partner.id] || 0) + 5);
                partner.relations[k.id] = Math.min(100, (partner.relations[k.id] || 0) + 5);
                logEvent(`🤝 ${k.name} proposes a trade agreement with ${partner.name}. Relations improve.`, {
                    type: 'trade_proposal', cause: 'Diplomatic initiative', effects: ['Relations +5 both ways', 'Trade may increase']
                });
            }
        }

        // b. Send diplomatic gifts
        if (treasury > (CONFIG.KINGDOM_GIFT_DIPLOMACY_COST || 500) && rng.chance(p.generosity === 'generous' ? 0.2 : 0.05)) {
            const worstRelation = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                .sort((a, b) => (k.relations[a.id] || 0) - (k.relations[b.id] || 0))[0];
            if (worstRelation && (k.relations[worstRelation.id] || 0) < 30) {
                const giftCost = CONFIG.KINGDOM_GIFT_DIPLOMACY_COST || 500;
                k.gold -= giftCost;
                const relBoost = CONFIG.KINGDOM_GIFT_DIPLOMACY_RELATION || 15;
                k.relations[worstRelation.id] = Math.min(100, (k.relations[worstRelation.id] || 0) + relBoost);
                worstRelation.relations[k.id] = Math.min(100, (worstRelation.relations[k.id] || 0) + Math.floor(relBoost * 0.5));
                logEvent(`🎁 ${k.name} sends a diplomatic gift to ${worstRelation.name} (${giftCost}g).`, {
                    type: 'diplomatic_gift', cause: 'Improving strained relations', effects: ['Relations +' + relBoost, 'Treasury -' + giftCost + 'g']
                });
            }
        }

        // c. Arrange royal marriage (rare, big impact — +30 relations, -50% war chance)
        if (!atWar && rng.chance(0.02) && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) {
            const marriageTarget = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) && (k.relations[o.id] || 0) > 10 && (k.relations[o.id] || 0) < 70
            );
            if (marriageTarget.length > 0) {
                const target = rng.pick(marriageTarget);
                const relBoost = 30;
                k.relations[target.id] = Math.min(100, (k.relations[target.id] || 0) + relBoost);
                target.relations[k.id] = Math.min(100, (target.relations[k.id] || 0) + relBoost);
                // Marriage alliance: mark to reduce war probability
                if (!k._marriageAlliances) k._marriageAlliances = {};
                if (!target._marriageAlliances) target._marriageAlliances = {};
                k._marriageAlliances[target.id] = world.day + 720; // lasts 2 years
                target._marriageAlliances[k.id] = world.day + 720;
                logEvent(`💒 A royal marriage is arranged between ${k.name} and ${target.name}! Relations soar.`, {
                    type: 'royal_marriage', cause: 'Diplomatic alliance through marriage',
                    effects: ['Relations +' + relBoost + ' both ways', 'War probability halved for 2 years', 'Alliance more likely']
                });
            }
        }

        // d. Demand tribute from weaker kingdoms
        if ((p.ambition === 'ambitious' || p.greed === 'greedy') && rng.chance(0.05)) {
            const myStr = computeMilitaryStrength(k);
            const weakerKingdoms = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) &&
                computeMilitaryStrength(o) < myStr * (CONFIG.KINGDOM_TRIBUTE_DEMAND_THRESHOLD || 0.5)
            );
            if (weakerKingdoms.length > 0) {
                const target = rng.pick(weakerKingdoms);
                const tributeAmount = rng.randInt(200, 500);
                if (target.gold >= tributeAmount && rng.chance(0.4)) {
                    target.gold -= tributeAmount;
                    k.gold += tributeAmount;
                    target.relations[k.id] = Math.max(-100, (target.relations[k.id] || 0) - 15);
                    logEvent(`💰 ${k.name} demands and receives ${tributeAmount}g tribute from ${target.name}!`, {
                        type: 'tribute_demand', cause: 'Military dominance', effects: ['Treasury +' + tributeAmount + 'g', 'Target kingdom resentful']
                    });
                } else {
                    target.relations[k.id] = Math.max(-100, (target.relations[k.id] || 0) - 10);
                    logEvent(`😤 ${target.name} refuses ${k.name}'s demand for tribute!`, {
                        type: 'tribute_refused', cause: 'Pride or lack of funds', effects: ['Relations worsen']
                    });
                }
            }
        }

        // e. Economic embargo
        if ((p.temperament === 'stern' || p.temperament === 'cruel') && rng.chance(0.03)) {
            const enemies = world.kingdoms.filter(o =>
                o.id !== k.id && (k.relations[o.id] || 0) < -30 && !k.atWar.has(o.id)
            );
            if (enemies.length > 0) {
                const target = rng.pick(enemies);
                if (!hasEmbargo(k.id, target.id)) {
                    declareEmbargo(k, target);
                    logEvent(`🚫 ${k.name} declares an economic embargo against ${target.name}!`, {
                        type: 'embargo_declared', cause: 'Poor relations and hostile policy', effects: ['Trade banned between kingdoms', 'Smuggling opportunities arise']
                    });
                }
            }
        }

        // f. HIRE MERCENARIES FOR DEFENSE (rich kingdoms can buy soldiers, 500g for 20 soldiers, 30 days)
        if (!atWar && k.gold > 2000 && rng.chance(0.08) && (p.courage === 'cautious' || p.courage === 'cowardly' || p.temperament === 'kind')) {
            const mercCost = 500;
            const mercCount = 20;
            k.gold -= mercCost;
            // Add mercenaries to the kingdom's least-defended towns
            const kTowns2 = world.towns.filter(t => k.territories.has(t.id)).sort((a, b) => a.garrison - b.garrison);
            if (kTowns2.length > 0) {
                kTowns2[0].garrison += mercCount;
                kTowns2[0]._mercenaryExpiry = world.day + 30; // mercenaries leave after 30 days
                kTowns2[0]._mercenaryCount = (kTowns2[0]._mercenaryCount || 0) + mercCount;
                logEvent(`🛡️ ${k.name} hires ${mercCount} mercenaries for defense of ${kTowns2[0].name} (-${mercCost}g, 30 days).`, {
                    type: 'mercenary_hire', cause: 'Preventive defense investment',
                    effects: ['Garrison +' + mercCount + ' in ' + kTowns2[0].name, 'Mercenaries serve for 30 days', 'Treasury -' + mercCost + 'g']
                });
            }
        }

        // g. PAY TRIBUTE TO AVOID WAR (weaker kingdoms pay 10-20% treasury to stronger neighbors)
        if (!atWar && (p.courage === 'cautious' || p.courage === 'cowardly') && rng.chance(0.05)) {
            const myStr = computeMilitaryStrength(k);
            const threats = world.kingdoms.filter(o =>
                o.id !== k.id && !k.atWar.has(o.id) &&
                (k.relations[o.id] || 0) < -20 &&
                computeMilitaryStrength(o) > myStr * 1.5
            );
            if (threats.length > 0) {
                const threat = rng.pick(threats);
                const tributeRate = rng.randFloat(0.10, 0.20);
                const tributeAmount = Math.floor(k.gold * tributeRate);
                if (tributeAmount > 50 && k.gold > tributeAmount * 2) {
                    k.gold -= tributeAmount;
                    threat.gold += tributeAmount;
                    k.relations[threat.id] = Math.min(100, (k.relations[threat.id] || 0) + 20);
                    threat.relations[k.id] = Math.min(100, (threat.relations[k.id] || 0) + 15);
                    logEvent(`💰 ${k.name} pays ${tributeAmount}g tribute to ${threat.name} to maintain peace.`, {
                        type: 'tribute_paid', cause: 'Fear of military aggression',
                        effects: ['Treasury -' + tributeAmount + 'g', 'Relations improved', 'War less likely']
                    }, 'military');
                }
            }
        }

        // =============================================
        // 10. ECONOMIC ACTIONS
        // =============================================
        // a. Commission construction projects
        if (treasury > 1500 && rng.chance(p.intelligence === 'brilliant' ? 0.25 : 0.08)) {
            const priorities = [];
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            for (const town of kTowns) {
                const hasType = (type) => town.buildings.some(b => b.type === type);
                // Prioritize buildings based on needs
                if (!hasType('hospital') && k.gold >= 1200) priorities.push({ town, type: 'hospital', cost: 1200 });
                if (!hasType('granary') && k.gold >= 500) priorities.push({ town, type: 'granary', cost: 500 });
                if (!hasType('guild_hall') && k.gold >= 700) priorities.push({ town, type: 'guild_hall', cost: 700 });
                if (!hasType('marketplace_royal') && k.gold >= 600) priorities.push({ town, type: 'marketplace_royal', cost: 600 });
                if (!hasType('courthouse') && k.gold >= 800 && (p.justice === 'just')) priorities.push({ town, type: 'courthouse', cost: 800 });
                if (!hasType('treasury_vault') && k.gold >= 1500 && town.isCapital) priorities.push({ town, type: 'treasury_vault', cost: 1500 });
                if (!hasType('cathedral') && k.gold >= 2000 && town.isCapital) priorities.push({ town, type: 'cathedral', cost: 2000 });
                if (!hasType('university') && k.gold >= 1500 && (p.intelligence === 'brilliant' || p.intelligence === 'clever')) priorities.push({ town, type: 'university', cost: 1500 });
                if (!hasType('training_grounds') && k.gold >= 800 && atWar) priorities.push({ town, type: 'training_grounds', cost: 800 });
                if (!hasType('stables') && k.gold >= 600 && (p.militarism === 'aggressive' || p.militarism === 'warlike')) priorities.push({ town, type: 'stables', cost: 600 });
                if (!hasType('castle') && town.isCapital && k.gold >= 3000) priorities.push({ town, type: 'castle', cost: 3000 });
                if (!hasType('clinic') && k.gold >= 400) priorities.push({ town, type: 'clinic', cost: 400 });
            }
            if (priorities.length > 0) {
                const chosen = rng.pick(priorities);
                const bt = findBuildingType(chosen.type);
                let canBuild = true;
                if (bt && bt.materials) {
                    for (const [matId, qty] of Object.entries(bt.materials)) {
                        if ((chosen.town.market.supply[matId] || 0) < qty) { canBuild = false; break; }
                    }
                    if (canBuild) {
                        for (const [matId, qty] of Object.entries(bt.materials)) {
                            chosen.town.market.supply[matId] -= qty;
                        }
                    }
                }
                if (canBuild && k.gold >= chosen.cost) {
                    chosen.town.buildings.push({ type: chosen.type, level: 1, ownerId: k.id, builtDay: world.day, condition: 'new', lastRepairDay: 0 });
                    k.gold -= chosen.cost;
                    logEvent(`🏗️ ${k.name} commissions a new ${bt ? bt.name : chosen.type} in ${chosen.town.name}!`, {
                        type: 'construction_project', cause: 'Royal investment in infrastructure', effects: ['New building provides benefits', 'Treasury -' + chosen.cost + 'g']
                    });
                }
            }
        }

        // b. Create stockpile reserves (buy food/weapons when cheap)
        if (treasury > 2000 && rng.chance(0.15)) {
            if (!k.militaryStockpile) k.militaryStockpile = { swords: 0, armor: 0, bows: 0, arrows: 0, horses: 0 };
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            const essentials = ['bread', 'wheat', 'meat'];
            for (const town of kTowns) {
                for (const food of essentials) {
                    const avail = town.market.supply[food] || 0;
                    const price = town.market.prices[food] || 5;
                    if (avail > 20 && price < 8) {
                        const toBuy = Math.min(10, avail - 10);
                        if (k.gold >= toBuy * price) {
                            town.market.supply[food] -= toBuy;
                            k.gold -= toBuy * price;
                        }
                    }
                }
            }
        }

        // c. Set price controls (intelligent kings only)
        if ((p.intelligence === 'brilliant') && rng.chance(0.05) && happiness < 35) {
            logEvent(`📜 ${k.name}'s wise king sets price controls on essential goods to protect citizens.`, {
                type: 'price_controls', cause: 'Protecting citizens from price gouging', effects: ['Essential goods prices capped', 'Merchants may be discouraged']
            });
            const kTowns = world.towns.filter(t => k.territories.has(t.id));
            for (const town of kTowns) {
                const essentials = ['bread', 'wheat', 'meat', 'fish'];
                for (const food of essentials) {
                    if (town.market.prices[food] > 15) {
                        town.market.prices[food] = Math.max(5, Math.floor(town.market.prices[food] * 0.7));
                    }
                }
            }
            boostKingdomHappiness(k, 3);
        }

        // =============================================
        // 11. SOCIAL/CIVIC ACTIONS
        // =============================================
        // a. Hold festivals (foolish/dim kings may party while broke, smart kings need healthy treasury, greedy never)
        var festCostCheck = CONFIG.KINGDOM_FESTIVAL_COST || 300;
        var grandFestGate = (p.intelligence === 'foolish' || p.intelligence === 'dim') ? festCostCheck : Math.max(2000, festCostCheck * 5);
        if (p.greed === 'greedy' || p.greed === 'corrupt') grandFestGate = Infinity;
        if (k.gold > grandFestGate && rng.chance(0.08)) {
            const festCost = festCostCheck;
            const festHappy = CONFIG.KINGDOM_FESTIVAL_HAPPINESS || 8;
            k.gold -= festCost;
            boostKingdomHappiness(k, festHappy);
            for (const tid of k.territories) { const t = findTown(tid); if (t) t._festivalDay = world.day; }
            logEvent(`🎉 ${k.name} holds a grand festival! The people celebrate. (+${festHappy} happiness, -${festCost}g)`, {
                type: 'grand_festival', cause: 'Royal celebration to boost morale', effects: ['Happiness +' + festHappy, 'Treasury -' + festCost + 'g']
            });
        }

        // b. Issue pardons (just/kind kings)
        if ((p.justice === 'just' || p.temperament === 'kind') && rng.chance(0.05)) {
            boostKingdomHappiness(k, 3);
            logEvent(`⚖️ The king of ${k.name} issues royal pardons. Prisoners are freed. (+3 happiness)`, {
                type: 'royal_pardon', cause: 'Act of mercy and justice', effects: ['Happiness +3', 'Some criminals released']
            });
        }

        // c. Crack down on crime (stern/just kings)
        if ((p.temperament === 'stern' || p.justice === 'just') && rng.chance(0.08) && treasury > 200) {
            k.gold -= 200;
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) town.security = Math.min(100, (town.security || 50) + 10);
            }
            logEvent(`🛡️ ${k.name} cracks down on crime! Guards patrol the streets. (-200g, +10 security)`, {
                type: 'crime_crackdown', cause: 'Royal order to restore order', effects: ['Security +10 in all towns', 'Treasury -200g']
            });
        }

        // d. Fund public works (require healthy treasury)
        if (k.gold > Math.max(2000, (CONFIG.KINGDOM_PUBLIC_WORKS_COST || 200) * 5) && rng.chance(0.06)) {
            const cost = CONFIG.KINGDOM_PUBLIC_WORKS_COST || 200;
            const happyBoost = CONFIG.KINGDOM_PUBLIC_WORKS_HAPPINESS || 3;
            k.gold -= cost;
            boostKingdomHappiness(k, happyBoost);
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) town.prosperity = Math.min(100, town.prosperity + 2);
            }
            logEvent(`🏗️ ${k.name} funds public works projects. Roads and buildings are improved.`, {
                type: 'public_works', cause: 'Investment in infrastructure', effects: ['Happiness +' + happyBoost, 'Prosperity +2', 'Treasury -' + cost + 'g']
            });
        }

        // e. Establish welfare (generous/kind kings — require healthy treasury)
        if ((p.generosity === 'generous' || p.temperament === 'kind') && k.gold > Math.max(2000, (CONFIG.KINGDOM_WELFARE_COST || 150) * 5) && happiness < 40 && rng.chance(0.10)) {
            const cost = CONFIG.KINGDOM_WELFARE_COST || 150;
            const happyBoost = CONFIG.KINGDOM_WELFARE_HAPPINESS || 5;
            k.gold -= cost;
            boostKingdomHappiness(k, happyBoost);
            logEvent(`🤲 ${k.name}'s kind ruler distributes gold to the poorest citizens. (+${happyBoost} happiness)`, {
                type: 'welfare_distribution', cause: 'Compassion for the less fortunate', effects: ['Happiness +' + happyBoost, 'Treasury -' + cost + 'g']
            });
            logKingAction(k, '🤲 Distributed gold to the poor (-' + cost + 'g, +' + happyBoost + ' happiness)');
        }

        // 12. UPDATE ROYAL ADVISORS periodically
        if (world.day % CONFIG.ROYAL_ADVISOR_UPDATE_INTERVAL === 0) {
            updateRoyalAdvisors(k);
        }

        // =============================================
        // 13. NEW LAW AI — Kings enact/repeal new laws based on mood and personality
        // =============================================
        var moodCurrent = k.kingMood ? k.kingMood.current : 'content';

        // a. Price Controls — brilliant kings enact during crises, repeal when stable
        if (!hasSpecialLaw(k, 'price_controls') && (p.intelligence === 'brilliant' || p.intelligence === 'clever')
            && happiness < 30 && rng.chance(0.15 * (mood.conscriptMod || 1))) {
            k.laws.specialLaws.push({ id: 'price_controls', name: 'Price Controls', desc: 'Maximum prices on essential goods.', icon: '📊' });
            logKingAction(k, '📊 Enacted Price Controls to protect citizens');
            logEvent('📊 ' + k.name + ' enacts price controls on essential goods!');
        } else if (hasSpecialLaw(k, 'price_controls') && happiness > 60 && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'price_controls'; });
            logKingAction(k, '📊 Repealed Price Controls — economy is stable');
            logEvent('📊 ' + k.name + ' lifts price controls as prosperity returns.');
        }

        // b. Immigration Policy — traditionalist/paranoid kings close borders
        if (!hasSpecialLaw(k, 'immigration_policy') && (p.tradition === 'traditional' || moodCurrent === 'paranoid')
            && rng.chance(0.08)) {
            k.laws.specialLaws.push({ id: 'immigration_policy', name: 'Closed Borders', desc: 'Foreigners need citizenship to settle.', icon: '🚧' });
            k.immigrationPolicy = 'closed';
            logKingAction(k, '🚧 Closed borders to foreigners');
            logEvent('🚧 ' + k.name + ' closes its borders! Foreigners must earn citizenship.');
        } else if (hasSpecialLaw(k, 'immigration_policy') && (p.tradition === 'progressive' || moodCurrent === 'jubilant')
            && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'immigration_policy'; });
            k.immigrationPolicy = 'open';
            logKingAction(k, '🚧 Opened borders to foreigners');
            logEvent('🚧 ' + k.name + ' opens its borders! All are welcome.');
        }

        // c. Inheritance Tax — greedy/corrupt kings impose, generous repeal
        if (!hasSpecialLaw(k, 'inheritance_tax') && (p.greed === 'greedy' || p.greed === 'corrupt')
            && rng.chance(0.06)) {
            var taxRate = p.greed === 'corrupt'
                ? rng.randFloat(CONFIG.INHERITANCE_TAX.minRate + 0.05, CONFIG.INHERITANCE_TAX.maxRate)
                : rng.randFloat(CONFIG.INHERITANCE_TAX.minRate, CONFIG.INHERITANCE_TAX.maxRate - 0.05);
            k.laws.specialLaws.push({
                id: 'inheritance_tax', name: 'Inheritance Tax', desc: Math.round(taxRate * 100) + '% tax on inherited wealth.',
                icon: '💀', rate: taxRate
            });
            logKingAction(k, '💀 Imposed ' + Math.round(taxRate * 100) + '% inheritance tax');
            logEvent('💀 ' + k.name + ' enacts inheritance tax: ' + Math.round(taxRate * 100) + '% of inherited wealth goes to the crown!');
        } else if (hasSpecialLaw(k, 'inheritance_tax') && p.greed === 'generous' && rng.chance(0.12)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'inheritance_tax'; });
            logKingAction(k, '💀 Repealed inheritance tax');
            logEvent('💀 ' + k.name + ' abolishes the inheritance tax!');
        }

        // d. Draft Animal Law — traditionalist kings restrict horse ownership
        if (!hasSpecialLaw(k, 'draft_animal_law') && p.tradition === 'traditional'
            && (p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.05)) {
            k.laws.specialLaws.push({ id: 'draft_animal_law', name: 'Draft Animal Permits', desc: 'Commoners need permits for horses.', icon: '🐴' });
            logKingAction(k, '🐴 Restricted horse ownership — permits required');
            logEvent('🐴 ' + k.name + ' now requires permits for horse ownership by commoners!');
        } else if (hasSpecialLaw(k, 'draft_animal_law') && (p.tradition === 'progressive' || p.greed === 'generous')
            && rng.chance(0.1)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'draft_animal_law'; });
            logKingAction(k, '🐴 Lifted horse ownership restrictions');
            logEvent('🐴 ' + k.name + ' lifts restrictions on horse ownership!');
        }

        // e. Female Succession — progressive kings may allow, traditional may block
        if (!hasSpecialLaw(k, 'female_heir_law') && p.tradition === 'progressive'
            && rng.chance(0.03)) {
            k.laws.specialLaws.push({ id: 'female_heir_law', name: 'Female Succession', desc: 'Women may inherit the throne.', icon: '👑' });
            logKingAction(k, '👑 Enacted female succession law');
            logEvent('👑 ' + k.name + ' now allows women to inherit the throne!');
        }

        // f. Exclusive Citizenship — paranoid/traditional kings may forbid dual citizenship
        if (!hasSpecialLaw(k, 'no_dual_citizenship') && (p.tradition === 'traditional' || moodCurrent === 'paranoid')
            && rng.chance(0.04)) {
            k.laws.specialLaws.push({ id: 'no_dual_citizenship', name: 'Exclusive Citizenship', desc: 'Citizens may not hold citizenship in other kingdoms.', icon: '🛡️' });
            logKingAction(k, '🛡️ Enacted exclusive citizenship law');
            logEvent('🛡️ ' + k.name + ' now forbids dual citizenship!', 'kingdom_politics', k.id);
        } else if (hasSpecialLaw(k, 'no_dual_citizenship') && (p.tradition === 'progressive' || moodCurrent === 'jubilant')
            && rng.chance(0.08)) {
            k.laws.specialLaws = k.laws.specialLaws.filter(function(l) { return l.id !== 'no_dual_citizenship'; });
            logKingAction(k, '🛡️ Repealed exclusive citizenship law');
            logEvent('🛡️ ' + k.name + ' now allows dual citizenship!', 'kingdom_politics', k.id);
        }

        // ── Kingdom Transport Decision (every 30 days) ──
        if (world.day % 30 === 0) {
            var hasTransport = k.laws && k.laws.kingdomTransport;
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
            var numTowns = kTowns.length;
            var setupCost = 500 * numTowns;
            var seasonalCost = (CONFIG.KINGDOM_TRANSPORT ? CONFIG.KINGDOM_TRANSPORT.baseCostPerTown : 50) * numTowns;

            if (!hasTransport) {
                // Consider implementing transport
                var wantTransport = false;

                // Progressive kings more likely
                if (p.tradition === 'progressive' && rng.chance(0.15)) wantTransport = true;
                // Generous kings want it for the people
                if (p.greed === 'generous' && p.temperament === 'kind' && rng.chance(0.12)) wantTransport = true;
                // Clever kings analyze cost/benefit
                if ((p.intelligence === 'brilliant' || p.intelligence === 'clever') && k.gold > setupCost * 2 && rng.chance(0.10)) wantTransport = true;
                // Ambitious kings see it as modernization
                if (p.ambition === 'ambitious' && k.gold > setupCost * 1.5 && rng.chance(0.08)) wantTransport = true;

                // Can they afford the setup cost?
                if (wantTransport && k.gold >= setupCost) {
                    k.gold -= setupCost;
                    if (!k.laws) k.laws = {};
                    k.laws.kingdomTransport = true;
                    if (!k.laws.transportRate) k.laws.transportRate = rng.randInt(10, 25);
                    logEvent('👑 ' + k.name + ' has established a kingdom transport service! Setup cost: ' + setupCost + 'g',
                        { type: 'law_change', kingdomId: k.id }, 'my_kingdom');
                }
            } else {
                // Consider ending transport
                var wantEnd = false;

                // Treasury is too low
                if (k.gold < seasonalCost * 2) wantEnd = true;
                // Greedy/corrupt kings may end it to save money
                if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.08)) wantEnd = true;
                // At war — divert funds
                if (k.atWar && k.atWar.size > 0 && k.gold < 2000 && rng.chance(0.20)) wantEnd = true;
                // Foolish king random cancelation
                if (p.intelligence === 'foolish' && rng.chance(0.05)) wantEnd = true;

                // Kings who like it keep it
                if (p.tradition === 'progressive' || p.greed === 'generous') wantEnd = false;
                // Override: bankruptcy forces it
                if (k.gold < seasonalCost) wantEnd = true;

                if (wantEnd) {
                    k.laws.kingdomTransport = false;
                    logEvent('📢 ' + k.name + ' has ended its kingdom transport service.',
                        { type: 'law_change', kingdomId: k.id }, 'my_kingdom');
                }
            }
        }

        // Adjust transport rate (every 60 days)
        if (world.day % 60 === 0 && k.laws && k.laws.kingdomTransport) {
            var currentRate = k.laws.transportRate || 15;
            if (p.greed === 'greedy' || p.greed === 'corrupt') {
                // Increase rate
                k.laws.transportRate = Math.min(40, currentRate + rng.randInt(1, 5));
            } else if (p.greed === 'generous' && currentRate > 8) {
                // Decrease rate
                k.laws.transportRate = Math.max(5, currentRate - rng.randInt(1, 3));
            }
        }
    }

    function kingdom_name(k) { return k.name || 'Unknown Kingdom'; }

    function boostKingdomHappiness(k, amount) {
        // Apply happiness change to all towns in this kingdom
        for (var i = 0; i < world.towns.length; i++) {
            var t = world.towns[i];
            if (t.kingdomId !== k.id) continue;
            t.happiness = Math.max(0, Math.min(100, (t.happiness || 50) + amount));
        }
        // Also nudge citizen happiness so it stays in sync
        var citizens = (_tickCache.peopleByKingdom[k.id] || []);
        for (var ci = 0; ci < citizens.length; ci++) {
            citizens[ci].needs.happiness = Math.max(0, Math.min(100, citizens[ci].needs.happiness + amount * 0.5));
        }
    }

    // ========================================================
    // §14A2 DAILY HAPPINESS FLUCTUATION SYSTEM
    // ========================================================
    function tickHappinessFluctuation() {
        const rng = world.rng;

        for (const town of world.towns) {
            const kingdom = findKingdom(town.kingdomId);
            if (!kingdom) continue;
            const taxRate = kingdom.taxRate || 0.10;
            const taxPct = taxRate * 100; // e.g. 15 for 15%

            let happinessDelta = 0;

            // --- DRAINS ---

            // Base happiness decay: proportional drift toward 50
            const currentHappiness = town.happiness || 50;
            if (currentHappiness > 50) {
                happinessDelta -= (currentHappiness - 50) * 0.08;
            } else if (currentHappiness < 50) {
                happinessDelta += (50 - currentHappiness) * 0.08;
            }

            // High tax drain (escalating brackets)
            if (taxPct > 20) {
                happinessDelta -= 2.0;
            } else if (taxPct > 15) {
                happinessDelta -= 1.0;
            } else if (taxPct > 10) {
                happinessDelta -= 0.3;
            }

            // Food shortage: check bread/food supply
            const foodTypes = ['bread', 'meat', 'fish', 'wheat', 'eggs'];
            let totalFood = 0;
            for (const f of foodTypes) {
                totalFood += (town.market.supply[f] || 0);
            }
            const foodDemand = (town.population || 10) * 0.5;
            if (totalFood < foodDemand) {
                happinessDelta -= 3.0; // food shortage
            }

            // War penalty
            if (kingdom.atWar.size > 0) {
                happinessDelta -= kingdom.atWar.size * 1.5;
            }

            // Crime penalty
            if ((town.security || 50) < 30) {
                happinessDelta -= 0.5;
            }

            // Overcrowding (absolute population thresholds)
            var pop = typeof town.population === 'number' ? town.population : (town.population || []).length;
            if (pop > 400) happinessDelta -= (pop - 400) * 0.01;
            if (pop > 700) happinessDelta -= (pop - 700) * 0.03;

            // Unemployment: check idle workers
            var townPeople = (_tickCache.peopleByTown[town.id] || []);
            const idleCount = townPeople.filter(p => p.occupation === 'laborer' || p.occupation === 'none').length;
            if (townPeople.length > 0 && idleCount / townPeople.length > 0.20) {
                happinessDelta -= 0.5;
            }

            // --- BOOSTS ---

            // Prosperity bonus
            if ((town.prosperity || 50) > 60) {
                happinessDelta += 1.0;
            } else if ((town.prosperity || 50) > 40) {
                happinessDelta += 0.5;
            }

            // Food surplus
            if (totalFood > foodDemand * 2) {
                happinessDelta += 1.0;
            }

            // Peace bonus: +0.8/day if kingdom not at war for 90+ days
            if (kingdom.atWar.size === 0) {
                let lastWarEndDay = 0;
                if (kingdom.peaceTreaties) {
                    for (const kId in kingdom.peaceTreaties) {
                        const treatyEnd = kingdom.peaceTreaties[kId];
                        const warEnd = treatyEnd - 720; // treaties last 720 days after war
                        if (warEnd > lastWarEndDay) lastWarEndDay = warEnd;
                    }
                }
                if (world.day - lastWarEndDay > 90) {
                    happinessDelta += 0.8;
                }
            }

            // Low tax bonus
            if (taxPct < 5) {
                happinessDelta += 1.5;
            } else if (taxPct <= 10) {
                happinessDelta += 0.5; // moderate tax bonus
            }

            // Festival afterglow: +2/day for 15 days after festival
            if (town._festivalDay && (world.day - town._festivalDay) < 15) {
                happinessDelta += 2.0;
            }

            // Recovery boost for struggling towns — stronger at lower happiness to prevent death spirals
            var townPop = typeof town.population === 'number' ? town.population : 0;
            if (currentHappiness < 40 && townPop > 20) {
                // Scales: +0.3 at happiness 39, up to +2.0 at happiness 0
                happinessDelta += 0.3 + (40 - currentHappiness) * 0.04;
            }

            // Prosperity-based floor: prosperous towns don't drop below 35
            var newHappiness = currentHappiness + happinessDelta;
            if ((town.prosperity || 0) > 60 && newHappiness < 35) newHappiness = 35;

            // Abandoned towns (pop < 5) are flagged and excluded from averages
            if (townPop < 5) {
                town._abandoned = true;
            } else {
                town._abandoned = false;
            }

            // Apply delta, clamp to 0-100
            town.happiness = Math.max(0, Math.min(100, newHappiness));
        }
    }

    // ========================================================
    // §14A2b TOWN HAPPINESS CONSEQUENCES (called daily)
    // Percentage chances SCALE linearly with distance from threshold
    // ========================================================
    function tickTownHappinessConsequences() {
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            var h = town.happiness || 50;
            var pop = typeof town.population === 'number' ? town.population : 0;
            if (pop < 3) continue; // skip near-empty towns

            // ── THRIVING (happiness > 75) ──
            if (h > (CONFIG.TOWN_HAPPINESS_THRIVING || 75)) {
                var thrivingIntensity = happinessScaledBonus(h, CONFIG.TOWN_HAPPINESS_THRIVING || 75, 1.0);

                // Immigration: attract people from less happy towns
                var immChance = (CONFIG.TOWN_THRIVING_IMMIGRATION_CHANCE || 0.008) * thrivingIntensity;
                if (rng.chance(immChance)) {
                    // Find a less happy town to pull from
                    var sourceTowns = world.towns.filter(function(st) {
                        return st.id !== town.id && (st.happiness || 50) < 40 && (typeof st.population === 'number' ? st.population : 0) > 10;
                    });
                    if (sourceTowns.length > 0) {
                        var source = sourceTowns[rng.randInt(0, sourceTowns.length - 1)];
                        var migrants = world.people.filter(function(p) {
                            return p.alive && p.townId === source.id && p.occupation !== 'soldier' && p.occupation !== 'guard' && !p.isKing;
                        });
                        if (migrants.length > 0) {
                            var migrant = migrants[rng.randInt(0, migrants.length - 1)];
                            migrant.townId = town.id;
                            migrant.kingdomId = town.kingdomId;
                            if (typeof source.population === 'number') source.population = Math.max(0, source.population - 1);
                            if (typeof town.population === 'number') town.population += 1;
                        }
                    }
                }

                // Crime reduction in thriving towns
                var crimeDecay = (CONFIG.TOWN_THRIVING_CRIME_DECAY || 0.8) * thrivingIntensity;
                town.crime = Math.max(0, (town.crime || 0) - crimeDecay);

            // ── CONTENT (happiness 55-75) ──
            } else if (h > (CONFIG.TOWN_HAPPINESS_CONTENT || 55)) {
                var contentIntensity = happinessScaledBonus(h, CONFIG.TOWN_HAPPINESS_CONTENT || 55, 1.0);

                // Mild crime reduction
                town.crime = Math.max(0, (town.crime || 0) - 0.2 * contentIntensity);
            }

            // ── NATURAL POPULATION GROWTH (every 3 ticks, non-abandoned towns with pop >= 10) ──
            if (!town.abandoned && !town.destroyed && pop >= 10 && world.day % 3 === 0) {
                // Birth rate scaled 3x to compensate for running every 3 ticks
                var birthRate = 0.0024;
                if (h > 60) birthRate = 0.0036;
                if (h > 75) birthRate = 0.0054;
                var expectedBirths = pop * birthRate;
                var births = Math.floor(expectedBirths);
                if (rng.chance(expectedBirths - births)) births++;
                births = Math.min(births, 3); // cap at 3 births per cycle
                if (births > 0) {
                    // Natural population death rate to balance: 0.04% per day (scaled 3x)
                    var deathRate = 0.0012;
                    if (h < 30) deathRate = 0.003;
                    var expectedDeaths = pop * deathRate;
                    var deaths = Math.floor(expectedDeaths);
                    if (rng.chance(expectedDeaths - deaths)) deaths++;
                    var netGrowth = births - deaths; // allow negative (natural decline)

                    // Per-town population cap — skip growth if at or above cap
                    var townCatCfg = CONFIG.TOWN_CATEGORIES[town.category || 'town'] || CONFIG.TOWN_CATEGORIES['town'];
                    var townPopCap = (CONFIG.TOWN_POP_CAP || {})[town.category || 'town'] || (townCatCfg.maxPop || 9999);
                    if (town.isIsland && CONFIG.TOWN_POP_CAP && CONFIG.TOWN_POP_CAP.island) {
                        townPopCap = Math.min(townPopCap, CONFIG.TOWN_POP_CAP.island);
                    }
                    if (netGrowth > 0 && pop >= townPopCap) netGrowth = 0;

                    if (netGrowth > 0) {
                        town.population += netGrowth;
                        // Spawn actual people for the births
                        var firstNames_m = ['Aldric','Rowan','Cedric','Edmund','Gareth','Hadrian','Leoric','Theron','Victor','Owen','Bram','Elias','Hugo','Jonas','Nolan'];
                        var firstNames_f = ['Mira','Elara','Helena','Willa','Astrid','Brigid','Celeste','Keira','Isolde','Lyra','Ada','Clara','Faye','Roslyn','Daphne'];
                        var townPeople = (_tickCache.peopleByTown[town.id] || []);
                        var lastPool = townPeople.length > 0 ? townPeople.map(function(p) { return p.lastName; }).filter(Boolean) : ['Smith','Baker','Fletcher'];
                        for (var bi = 0; bi < netGrowth; bi++) {
                            var bSex = rng.random() < 0.5 ? 'M' : 'F';
                            var bNames = bSex === 'M' ? firstNames_m : firstNames_f;
                            var newborn = {
                                id: 'p_birth_' + world.day + '_' + town.id + '_' + bi,
                                firstName: bNames[rng.randInt(0, bNames.length - 1)],
                                lastName: lastPool[rng.randInt(0, lastPool.length - 1)],
                                age: 18,
                                sex: bSex,
                                alive: true,
                                townId: town.id,
                                kingdomId: town.kingdomId,
                                occupation: rng.pick(['farmer','farmer','laborer','laborer','craftsman','merchant']),
                                employerId: null,
                                needs: { food: 70, shelter: 50, safety: 50, wealth: 30, happiness: 60 },
                                gold: rng.randInt(5, 30),
                                wealthClass: 'lower',
                                skills: { farming: rng.randInt(0, 20), mining: rng.randInt(0, 10), crafting: rng.randInt(0, 15), trading: rng.randInt(0, 10), combat: rng.randInt(0, 10) },
                                workerSkill: rng.randInt(5, 25),
                                spouseId: null,
                                childrenIds: [],
                                parentIds: [],
                                personality: {
                                    loyalty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                    ambition: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                    frugality: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                    intelligence: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                    warmth: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                    honesty: Math.floor((rng.random()+rng.random()+rng.random())/3*100),
                                },
                                quirks: assignRandomQuirks(rng),
                                foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                                recentFoods: [],
                            };
                            world.people.push(newborn);
                            if (typeof registerPerson === 'function') registerPerson(newborn);
                        }
                    } else if (netGrowth < 0) {
                        // Natural decline — kill elderly/sick people via killPerson for proper bookkeeping
                        var toKill = Math.min(Math.abs(netGrowth), Math.floor(pop * 0.01) || 1);
                        var elderly = (_tickCache.peopleByTown[town.id] || [])
                            .filter(function(p) { return p.alive && p.age >= 50; })
                            .sort(function(a, b) { return b.age - a.age; });
                        for (var ki = 0; ki < Math.min(toKill, elderly.length); ki++) {
                            killPerson(elderly[ki], 'natural causes');
                        }
                    }
                }
            }

            // ── UNREST (happiness < 35) ──
            if (h < (CONFIG.TOWN_HAPPINESS_UNREST || 35)) {
                var unrestIntensity = happinessScaledChance(h, CONFIG.TOWN_HAPPINESS_UNREST || 35, 1.0);

                // Crime growth
                var crimeGrowth = (CONFIG.TOWN_UNREST_CRIME_GROWTH || 0.4) * unrestIntensity;
                town.crime = Math.min(100, (town.crime || 0) + crimeGrowth);

                // Emigration pressure (per-person check, batch for performance)
                var emChance = (CONFIG.TOWN_UNREST_EMIGRATION_CHANCE || 0.003) * unrestIntensity;
                var emigrantCount = 0;
                if (emChance > 0 && pop > 20) {
                    // Approximate: expected emigrants = pop * chance, use binomial approx
                    var expected = Math.floor(pop * emChance);
                    if (expected < 1 && rng.chance(pop * emChance)) expected = 1;
                    if (expected > 0) {
                        var availPeople = world.people.filter(function(p) {
                            return p.alive && p.townId === town.id && p.occupation !== 'soldier' && p.occupation !== 'guard' && !p.isKing;
                        });
                        for (var ei = 0; ei < Math.min(expected, availPeople.length, 2); ei++) {
                            var emigrant = availPeople[rng.randInt(0, availPeople.length - 1)];
                            // Move to a random happier town
                            var betterTowns = world.towns.filter(function(bt) {
                                return bt.id !== town.id && (bt.happiness || 50) > h + 10;
                            });
                            if (betterTowns.length > 0) {
                                var dest = betterTowns[rng.randInt(0, betterTowns.length - 1)];
                                emigrant.townId = dest.id;
                                emigrant.kingdomId = dest.kingdomId;
                                if (typeof town.population === 'number') town.population = Math.max(0, town.population - 1);
                                if (typeof dest.population === 'number') dest.population += 1;
                                emigrantCount++;
                            }
                        }
                    }
                }
                if (emigrantCount >= 3) {
                    logEvent('😞 Citizens are fleeing ' + town.name + ' due to poor conditions. (' + emigrantCount + ' left)', {
                        type: 'unhappiness_emigration', cause: 'Low town happiness (' + Math.round(h) + '%)', effects: [emigrantCount + ' people emigrated']
                    });
                }

                // Protests (event only, no damage)
                var protestChance = (CONFIG.TOWN_UNREST_PROTEST_CHANCE || 0.03) * unrestIntensity;
                if (rng.chance(protestChance)) {
                    logEvent('📢 Protests in ' + town.name + '! Citizens demand better conditions. (Happiness: ' + Math.round(h) + '%)', {
                        type: 'protest', cause: 'Unhappy populace', effects: ['Public unrest', 'King may respond']
                    });
                    // Small happiness recovery if king is responsive (handled by king AI)
                }

                // Worker strikes (a random building stops producing for 7 days)
                var strikeChance = (CONFIG.TOWN_UNREST_STRIKE_CHANCE || 0.008) * unrestIntensity;
                if (rng.chance(strikeChance) && town.buildings && town.buildings.length > 0) {
                    var strikeable = town.buildings.filter(function(b) { return !b._strikeUntil || b._strikeUntil <= world.day; });
                    if (strikeable.length > 0) {
                        var strikeBuilding = strikeable[rng.randInt(0, strikeable.length - 1)];
                        strikeBuilding._strikeUntil = world.day + 7;
                        var bName = (BUILDING_TYPES[strikeBuilding.type] || {}).name || strikeBuilding.type;
                        logEvent('🪧 Workers strike at ' + bName + ' in ' + town.name + '! Production halted for 7 days.', {
                            type: 'strike', cause: 'Low happiness (' + Math.round(h) + '%) and poor working conditions', effects: ['Building production halted 7 days']
                        });
                    }
                }
            }

            // ── CRISIS (happiness < 18) ──
            if (h < (CONFIG.TOWN_HAPPINESS_CRISIS || 18)) {
                var crisisIntensity = happinessScaledChance(h, CONFIG.TOWN_HAPPINESS_CRISIS || 18, 1.0);

                // Crime spike (on top of unrest crime)
                var crimeSpike = (CONFIG.TOWN_CRISIS_CRIME_SPIKE || 1.2) * crisisIntensity;
                town.crime = Math.min(100, (town.crime || 0) + crimeSpike);

                // Mass exodus (stronger than unrest emigration)
                var exodusChance = (CONFIG.TOWN_CRISIS_EXODUS_CHANCE || 0.015) * crisisIntensity;
                if (pop > 10) {
                    var exodusCount = Math.floor(pop * exodusChance);
                    if (exodusCount < 1 && rng.chance(pop * exodusChance)) exodusCount = 1;
                    if (exodusCount > 0) {
                        var fleeingPeople = world.people.filter(function(p) {
                            return p.alive && p.townId === town.id && p.occupation !== 'soldier' && !p.isKing;
                        });
                        var fled = 0;
                        for (var fi = 0; fi < Math.min(exodusCount, fleeingPeople.length, 5); fi++) {
                            var refugee = fleeingPeople[rng.randInt(0, fleeingPeople.length - 1)];
                            var safeTowns = world.towns.filter(function(st) {
                                return st.id !== town.id && (st.happiness || 50) > 30;
                            });
                            if (safeTowns.length > 0) {
                                var safeDest = safeTowns[rng.randInt(0, safeTowns.length - 1)];
                                refugee.townId = safeDest.id;
                                refugee.kingdomId = safeDest.kingdomId;
                                if (typeof town.population === 'number') town.population = Math.max(0, town.population - 1);
                                if (typeof safeDest.population === 'number') safeDest.population += 1;
                                fled++;
                            }
                        }
                        if (fled >= 2) {
                            logEvent('🏃 Mass exodus from ' + town.name + '! ' + fled + ' people fled the crisis. (Happiness: ' + Math.round(h) + '%)', {
                                type: 'mass_exodus', cause: 'Town in crisis', effects: [fled + ' citizens fled', 'Population declining rapidly']
                            });
                        }
                    }
                }

                // Riots (damage buildings, reduce garrison)
                var riotChance = (CONFIG.TOWN_CRISIS_RIOT_CHANCE || 0.04) * crisisIntensity;
                if (rng.chance(riotChance)) {
                    town.prosperity = Math.max(0, (town.prosperity || 50) - rng.randInt(3, 8));
                    town.garrison = Math.max(0, (town.garrison || 0) - rng.randInt(1, 3));
                    if (town.buildings && town.buildings.length > 0) {
                        var damaged = town.buildings[rng.randInt(0, town.buildings.length - 1)];
                        damaged.condition = Math.max(0, (damaged.condition || 100) - rng.randInt(15, 30));
                    }
                    logEvent('🔥 Riots in ' + town.name + '! Buildings damaged, garrison overwhelmed. (Happiness: ' + Math.round(h) + '%)', {
                        type: 'riot', cause: 'Town happiness in crisis (' + Math.round(h) + '%)',
                        effects: ['Prosperity drops', 'Garrison reduced', 'Building damaged', 'Crime surges']
                    });
                }

                // Building abandonment
                var abandonChance = (CONFIG.TOWN_CRISIS_BUILDING_ABANDON_CHANCE || 0.006) * crisisIntensity;
                if (town.buildings && town.buildings.length > 0 && rng.chance(abandonChance)) {
                    var abandonable = town.buildings.filter(function(b) { return !b._abandoned; });
                    if (abandonable.length > 0) {
                        var abandoned = abandonable[rng.randInt(0, abandonable.length - 1)];
                        abandoned._abandoned = true;
                        abandoned._strikeUntil = world.day + 90; // stops producing for 90 days
                        var abName = (BUILDING_TYPES[abandoned.type] || {}).name || abandoned.type;
                        logEvent('🏚️ ' + abName + ' in ' + town.name + ' has been abandoned by its workers.', {
                            type: 'building_abandoned', cause: 'Crisis conditions', effects: ['Building non-functional for 90 days']
                        });
                    }
                }

                // Disease outbreak — reduced severity, only in larger towns
                var diseaseChance = (CONFIG.TOWN_CRISIS_DISEASE_CHANCE || 0.002) * crisisIntensity;
                if (rng.chance(diseaseChance) && pop > 40) {
                    var infected = rng.randInt(Math.ceil(pop * 0.03), Math.ceil(pop * 0.08));
                    var deaths = Math.floor(infected * rng.randFloat(0.1, 0.2));
                    deaths = Math.min(deaths, Math.floor(pop * 0.05)); // cap at 5% of population
                    // Use killPerson for proper population tracking (fixes desync)
                    var townPeople = (_tickCache.peopleByTown[town.id] || []).filter(function(pp) { return pp.alive; });
                    var shuffled = rng.shuffle([...townPeople]);
                    var killed = 0;
                    for (var di = 0; di < shuffled.length && killed < deaths; di++) {
                        killPerson(shuffled[di], 'disease');
                        killed++;
                    }
                    town.prosperity = Math.max(0, (town.prosperity || 50) - 5);
                    logEvent('🦠 Disease outbreak in ' + town.name + '! ' + killed + ' dead. Poor conditions breed illness. (Happiness: ' + Math.round(h) + '%)', {
                        type: 'disease_outbreak', cause: 'Crisis conditions and poor sanitation',
                        effects: [killed + ' people died', infected + ' infected', 'Prosperity drops']
                    });
                }
            }

            // Store the consequence tier on the town for UI display
            if (h >= (CONFIG.TOWN_HAPPINESS_THRIVING || 75)) {
                town._happinessTier = 'thriving';
            } else if (h >= (CONFIG.TOWN_HAPPINESS_CONTENT || 55)) {
                town._happinessTier = 'content';
            } else if (h >= (CONFIG.TOWN_HAPPINESS_UNREST || 35)) {
                town._happinessTier = 'neutral';
            } else if (h >= (CONFIG.TOWN_HAPPINESS_CRISIS || 18)) {
                town._happinessTier = 'unrest';
            } else {
                town._happinessTier = 'crisis';
            }
        }
    }

    // ========================================================
    // §14A2c KINGDOM HAPPINESS CONSEQUENCES (called each season)
    // ========================================================
    function tickKingdomHappinessConsequences(k) {
        var rng = world.rng;
        var h = k.happiness != null ? k.happiness : 50;
        var p = k.kingPersonality || {};

        // ── GOLDEN AGE (happiness > 75) ──
        if (h > (CONFIG.KINGDOM_HAPPINESS_GOLDEN || 75)) {
            var goldenIntensity = happinessScaledBonus(h, CONFIG.KINGDOM_HAPPINESS_GOLDEN || 75, 1.0);

            // Diplomatic reputation boost
            var dipBonus = Math.round((CONFIG.KINGDOM_GOLDEN_DIPLOMACY_BONUS || 5) * goldenIntensity);
            if (dipBonus > 0 && k.relations) {
                for (var kId in k.relations) {
                    k.relations[kId] = Math.min(100, (k.relations[kId] || 50) + dipBonus);
                }
            }

            // Volunteer soldiers
            var recruitChance = (CONFIG.KINGDOM_GOLDEN_RECRUIT_CHANCE || 0.04) * goldenIntensity;
            if (rng.chance(recruitChance)) {
                // Find a town to add a soldier
                var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id && (typeof t.population === 'number' ? t.population : 0) > 20; });
                if (kTowns.length > 0) {
                    var recruitTown = kTowns[rng.randInt(0, kTowns.length - 1)];
                    recruitTown.garrison = (recruitTown.garrison || 0) + 1;
                }
            }

            // Store tier
            k._happinessTier = 'golden_age';
        } else if (h > (CONFIG.KINGDOM_HAPPINESS_STABLE || 55)) {
            k._happinessTier = 'stable';
        } else if (h >= (CONFIG.KINGDOM_HAPPINESS_DISCONTENT || 35)) {
            k._happinessTier = 'neutral';

        // ── DISCONTENT (happiness < 35) ──
        } else if (h >= (CONFIG.KINGDOM_HAPPINESS_REBELLION || 18)) {
            var discontentIntensity = happinessScaledChance(h, CONFIG.KINGDOM_HAPPINESS_DISCONTENT || 35, 1.0);
            k._happinessTier = 'discontent';

            // Tax evasion (reduce gold collected from taxes this cycle)
            var evasionRate = (CONFIG.KINGDOM_DISCONTENT_TAX_EVASION || 0.15) * discontentIntensity;
            var taxLoss = Math.floor((k._lastSeasonTaxRevenue || 0) * evasionRate);
            if (taxLoss > 0) {
                k.gold = Math.max(0, k.gold - taxLoss);
            }

            // Military desertion
            var desertionRate = (CONFIG.KINGDOM_DISCONTENT_DESERTION_RATE || 0.004) * discontentIntensity;
            var soldiers = k.soldiers || 0;
            var deserters = Math.floor(soldiers * desertionRate * 90); // seasonal (90 days)
            if (deserters > 0) {
                // Remove soldiers from garrison across towns
                var remaining = deserters;
                for (var di = 0; di < world.towns.length && remaining > 0; di++) {
                    var dTown = world.towns[di];
                    if (dTown.kingdomId !== k.id) continue;
                    var lose = Math.min(remaining, Math.ceil((dTown.garrison || 0) * 0.2));
                    dTown.garrison = Math.max(0, (dTown.garrison || 0) - lose);
                    remaining -= lose;
                }
                if (deserters >= 3) {
                    logEvent('🏃‍♂️ ' + deserters + ' soldiers desert from ' + k.name + '\'s army due to low morale.', {
                        type: 'desertion', cause: 'Kingdom discontent (happiness ' + Math.round(h) + '%)',
                        effects: [deserters + ' soldiers lost', 'Military strength reduced']
                    });
                }
            }

            // Revolt chance (monthly equivalent — check once per season with scaled chance)
            var revoltChance = (CONFIG.KINGDOM_DISCONTENT_REVOLT_CHANCE || 0.06) * discontentIntensity;
            if (rng.chance(revoltChance)) {
                var revoltDamage = rng.randInt(100, 800);
                k.gold = Math.max(0, k.gold - revoltDamage);
                k._taxRevoltUntil = world.day + 30;
                boostKingdomHappiness(k, -5);
                logEvent('🔥 REVOLT in ' + k.name + '! Citizens refuse to comply with the crown. (-' + revoltDamage + 'g)', {
                    type: 'revolt', cause: 'Kingdom discontent (happiness ' + Math.round(h) + '%)',
                    effects: ['Tax collection halted 30 days', revoltDamage + 'g in damages', 'Happiness drops further']
                }, 'sensitive_intel');
            }

        // ── REBELLION (happiness < 18) ──
        } else {
            var rebellionIntensity = happinessScaledChance(h, CONFIG.KINGDOM_HAPPINESS_REBELLION || 18, 1.0);
            k._happinessTier = 'rebellion';

            // Severe tax evasion
            var severeEvasion = (CONFIG.KINGDOM_REBELLION_TAX_EVASION || 0.45) * rebellionIntensity;
            var severeTaxLoss = Math.floor((k._lastSeasonTaxRevenue || 0) * severeEvasion);
            if (severeTaxLoss > 0) {
                k.gold = Math.max(0, k.gold - severeTaxLoss);
            }

            // Mass desertion
            var massDesertRate = (CONFIG.KINGDOM_REBELLION_DESERTION_RATE || 0.015) * rebellionIntensity;
            var massSoldiers = k.soldiers || 0;
            var massDeserters = Math.floor(massSoldiers * massDesertRate * 90);
            if (massDeserters > 0) {
                var rem = massDeserters;
                for (var mdi = 0; mdi < world.towns.length && rem > 0; mdi++) {
                    var mdTown = world.towns[mdi];
                    if (mdTown.kingdomId !== k.id) continue;
                    var mLose = Math.min(rem, Math.ceil((mdTown.garrison || 0) * 0.3));
                    mdTown.garrison = Math.max(0, (mdTown.garrison || 0) - mLose);
                    rem -= mLose;
                }
                if (massDeserters >= 2) {
                    logEvent('💀 ' + massDeserters + ' soldiers abandon ' + k.name + '! The army is collapsing.', {
                        type: 'mass_desertion', cause: 'Kingdom in rebellion (happiness ' + Math.round(h) + '%)',
                        effects: [massDeserters + ' soldiers lost', 'Kingdom defense crippled']
                    });
                }
            }

            // Coup attempt
            var coupChance = (CONFIG.KINGDOM_REBELLION_COUP_CHANCE || 0.15) * rebellionIntensity;
            if (rng.chance(coupChance)) {
                var king = findPerson(k.king);
                if (king && king.alive) {
                    logEvent('⚔️ COUP ATTEMPT in ' + k.name + '! Rebels storm the palace!', {
                        type: 'coup_attempt', cause: 'Kingdom in open rebellion (happiness ' + Math.round(h) + '%)',
                        effects: ['King\'s life at risk', 'Kingdom stability threatened']
                    }, 'sensitive_intel');
                    if (rng.chance(0.4 + rebellionIntensity * 0.2)) {
                        killPerson(king, 'coup');
                        handleKingDeath(k, 'coup');
                        logEvent('👑 The king of ' + k.name + ' has been overthrown! A new ruler rises.', {
                            type: 'king_overthrown', cause: 'Successful coup', effects: ['New king installed', 'Policies may change']
                        }, 'sensitive_intel');
                        boostKingdomHappiness(k, 15); // New king brings hope
                    } else {
                        logEvent('🛡️ The coup in ' + k.name + ' has failed. The king purges dissenters.', {
                            type: 'coup_failed', cause: 'King survived', effects: ['Happiness drops further', 'Purges follow']
                        }, 'sensitive_intel');
                        boostKingdomHappiness(k, -8);
                    }
                }
            }

            // Town secession (a town may declare independence or join another kingdom)
            var secessionChance = (CONFIG.KINGDOM_REBELLION_SECESSION_CHANCE || 0.03) * rebellionIntensity;
            if (k.territories && k.territories.size > 1) {
                for (var secTownId of k.territories) {
                    if (rng.chance(secessionChance)) {
                        var secTown = findTown(secTownId);
                        if (!secTown || secTown.isCapital) continue;
                        // Find a neighboring kingdom to join
                        var neighborKingdoms = world.kingdoms.filter(function(nk) {
                            return nk.id !== k.id && nk.happiness > h + 15;
                        });
                        if (neighborKingdoms.length > 0) {
                            var newKingdom = neighborKingdoms[rng.randInt(0, neighborKingdoms.length - 1)];
                            k.territories.delete(secTownId);
                            newKingdom.territories.add(secTownId);
                            secTown.kingdomId = newKingdom.id;
                            // Update citizens
                            var secCitizens = (_tickCache.peopleByTown[secTownId] || []);
                            for (var sci = 0; sci < secCitizens.length; sci++) {
                                secCitizens[sci].kingdomId = newKingdom.id;
                            }
                            logEvent('🏴 ' + secTown.name + ' has SECEDED from ' + k.name + ' and joined ' + newKingdom.name + '!', {
                                type: 'secession', cause: 'Kingdom in rebellion (happiness ' + Math.round(h) + '%)',
                                effects: ['Territory lost', 'Citizens change allegiance', 'Kingdom weakened']
                            });
                            break; // Only one secession per season
                        }
                    }
                }
            }

            // Kingdom collapse (if also bankrupt)
            if (k._bankruptDays > 30) {
                var collapseChance = (CONFIG.KINGDOM_REBELLION_COLLAPSE_CHANCE || 0.12) * rebellionIntensity;
                if (rng.chance(collapseChance)) {
                    logEvent('💀 ' + k.name + ' is on the brink of total collapse! Bankrupt and in rebellion!', {
                        type: 'kingdom_collapse_warning', cause: 'Bankruptcy + rebellion',
                        effects: ['Kingdom may fragment', 'Towns may declare independence']
                    }, 'sensitive_intel');
                    // Trigger economic collapse if the function exists
                    if (typeof triggerEconomicCollapse === 'function') {
                        triggerEconomicCollapse(k);
                    }
                }
            }
        }
    }

    // ========================================================
    // §14A3 TAX CONSEQUENCES SYSTEM (called daily)
    // ========================================================
    function tickTaxConsequences() {
        const rng = world.rng;

        for (const k of world.kingdoms) {
            const taxPct = (k.taxRate || 0.10) * 100;

            // --- MERCHANT FLIGHT (monthly check) ---
            if (world.day % 30 === 0) {
                let flightChance = 0;
                if (taxPct > 20) flightChance = 0.10;
                else if (taxPct > 15) flightChance = 0.05;
                else if (taxPct > 10) flightChance = 0.02;

                if (flightChance > 0) {
                    // Elite merchants may leave high-tax kingdoms
                    const kingdomElites = world.people.filter(p =>
                        p.alive && p.isEliteMerchant && p.kingdomId === k.id
                    );
                    for (const em of kingdomElites) {
                        if (rng.chance(flightChance)) {
                            // Find a lower-tax kingdom to flee to
                            const lowerTaxKingdoms = world.kingdoms.filter(o =>
                                o.id !== k.id && o.taxRate < k.taxRate - 0.05 && o.territories.size > 0
                            );
                            if (lowerTaxKingdoms.length > 0) {
                                const dest = rng.pick(lowerTaxKingdoms);
                                const destTownId = rng.pick([...dest.territories]);
                                const destTown = findTown(destTownId);
                                if (destTown) {
                                    const oldTown = findTown(em.townId);
                                    em.townId = destTown.id;
                                    em.kingdomId = dest.id;
                                    logEvent(`📦 An elite merchant has left ${k.name} for ${dest.name} due to high taxes (${Math.round(taxPct)}%)!`, {
                                        type: 'merchant_flight', cause: 'Excessive taxation driving merchants away',
                                        effects: ['Kingdom loses tax revenue', 'Destination kingdom gains trade', k.name + ' economy weakened']
                                    }, 'npc_activity');
                                }
                            }
                        }
                    }

                    // NPC merchants with buildings may abandon them
                    const merchantCitizens = world.people.filter(p =>
                        p.alive && p.kingdomId === k.id && p.occupation === 'merchant' && !p.isEliteMerchant
                    );
                    for (const m of merchantCitizens) {
                        if (rng.chance(flightChance * 0.5)) {
                            const lowerTaxKingdoms = world.kingdoms.filter(o =>
                                o.id !== k.id && o.taxRate < k.taxRate - 0.05 && o.territories.size > 0
                            );
                            if (lowerTaxKingdoms.length > 0) {
                                const dest = rng.pick(lowerTaxKingdoms);
                                const destTownId = rng.pick([...dest.territories]);
                                const destTown = findTown(destTownId);
                                if (destTown) {
                                    m.townId = destTown.id;
                                    m.kingdomId = dest.id;
                                }
                            }
                        }
                    }
                }
            }

            // --- POPULATION GROWTH PENALTY ---
            if (taxPct > 15) {
                // Reduce population growth: fewer births in high-tax kingdoms
                // (Applied as emigration pressure — handled by happiness drains which trigger migration)
            }

            // --- TAX REVOLT (monthly check, taxes > 20% AND happiness < 30) ---
            if (world.day % 30 === 0 && taxPct > 20) {
                const kingdomHappiness = k.happiness != null ? k.happiness : 50;
                if (kingdomHappiness < 30 && rng.chance(0.05)) {
                    // Tax revolt!
                    const revoltDamage = rng.randInt(50, 500);
                    k.gold = Math.max(0, k.gold - revoltDamage);

                    // No tax collection for 30 days
                    k._taxRevoltUntil = world.day + 30;

                    // Further happiness drop
                    boostKingdomHappiness(k, -10);

                    logEvent(`🔥 TAX REVOLT in ${k.name}! Citizens refuse to pay the ${Math.round(taxPct)}% tax rate!`, {
                        type: 'tax_revolt',
                        cause: 'Excessive taxation (' + Math.round(taxPct) + '%) combined with low happiness (' + Math.round(kingdomHappiness) + '%) has driven the people to revolt.',
                        effects: [
                            'Tax collection suspended for 30 days',
                            revoltDamage + 'g in property damage',
                            'Kingdom happiness drops further (-10)',
                            'Tax infrastructure must be rebuilt'
                        ]
                    }, 'sensitive_intel');
                }
            }
        }
    }

    // ========================================================
    // §14A4 MERCENARY EXPIRY & WAR ZONE SUPPLY TICK
    // ========================================================
    function tickMercenaryExpiry() {
        for (const town of world.towns) {
            // Expire mercenaries
            if (town._mercenaryExpiry && world.day >= town._mercenaryExpiry && town._mercenaryCount > 0) {
                town.garrison = Math.max(0, town.garrison - town._mercenaryCount);
                logEvent(`⏳ Mercenaries in ${town.name} have completed their contract and departed.`);
                town._mercenaryCount = 0;
                delete town._mercenaryExpiry;
            }

            // War zone: -50% supply replenishment (reduce incoming supply)
            if (town.isFrontline) {
                for (const resId in town.market.supply) {
                    // Gradually reduce supply in war zones
                    if (town.market.supply[resId] > 5) {
                        town.market.supply[resId] = Math.max(0, Math.floor(town.market.supply[resId] * 0.995));
                    }
                }
            }
        }
    }

    // ========================================================
    // §14B2 TOWN FOUNDING SYSTEM
    // ========================================================
    const TOWN_NAME_PREFIXES = ['North', 'South', 'East', 'West', 'New', 'Old', 'Upper', 'Lower', 'Fort', 'Port', 'Great', 'Little', 'Kings', 'Cross'];
    const TOWN_NAME_ROOTS = ['haven', 'bridge', 'ford', 'ton', 'bury', 'dale', 'field', 'wood', 'gate', 'marsh', 'moor', 'cliff', 'holm', 'vale', 'crest', 'wick', 'thorpe', 'stead'];

    function generateSettlementName(rng) {
        const usedNames = new Set(world.towns.map(t => t.name));
        for (let attempt = 0; attempt < 50; attempt++) {
            let name;
            if (rng.chance(0.6)) {
                name = rng.pick(TOWN_NAME_PREFIXES) + rng.pick(TOWN_NAME_ROOTS);
            } else {
                const root = rng.pick(TOWN_NAME_ROOTS);
                name = rng.pick(TOWN_NAME_PREFIXES) + ' ' + root.charAt(0).toUpperCase() + root.slice(1);
            }
            if (!usedNames.has(name)) return name;
        }
        return 'Settlement_' + world.towns.length;
    }

    function tickTownFounding(k) {
        if (!k.king) return; // Guard: skip kingless kingdoms
        const rng = world.rng;
        const p = k.kingPersonality;
        if (!p) return;

        // Check cooldown
        if (k._lastTownFounded && (world.day - k._lastTownFounded) < CONFIG.TOWN_FOUNDING_COOLDOWN) return;

        // Check treasury
        if (k.gold < CONFIG.TOWN_FOUNDING_MIN_TREASURY) return;

        // Check kingdom population
        var kPop = (_tickCache.peopleByKingdom[k.id] || []).length;
        if (kPop < CONFIG.TOWN_FOUNDING_MIN_POP) return;

        // Check town cap
        const kTowns = world.towns.filter(t => t.kingdomId === k.id);
        if (kTowns.length >= CONFIG.MAX_TOWNS_PER_KINGDOM) return;

        // King personality affects likelihood
        let chance = 0.15;
        if (p.ambition === 'ambitious') chance = 0.35;
        else if (p.ambition === 'lazy') chance = 0.05;
        if (p.intelligence === 'brilliant' || p.intelligence === 'clever') chance += 0.10;
        if (p.greed === 'generous') chance += 0.05;
        if (!rng.chance(chance)) return;

        // Find valid location near existing kingdom towns
        const cols = world.gridCols;
        const rows = world.gridRows;
        let foundX = -1, foundY = -1;

        for (let attempt = 0; attempt < 300; attempt++) {
            // Pick a random existing kingdom town as reference
            const refTown = rng.pick(kTowns);
            const refTx = Math.floor(refTown.x / CONFIG.TILE_SIZE);
            const refTy = Math.floor(refTown.y / CONFIG.TILE_SIZE);

            // Random offset within ~80-150 tiles
            const offsetRange = Math.floor(cols * 0.08);
            const tx = refTx + rng.randInt(-offsetRange, offsetRange);
            const ty = refTy + rng.randInt(-offsetRange, offsetRange);

            if (tx < 2 || tx >= cols - 2 || ty < 2 || ty >= rows - 2) continue;
            if (!isBuildable(tx, ty)) continue;

            const px = tx * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const py = ty * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

            // Must be at least 800px from all existing towns
            if (tooCloseToExisting(world.towns, px, py, 800)) continue;

            foundX = px;
            foundY = py;
            break;
        }

        if (foundX < 0) return; // No valid location found

        // Found a valid location — create the town
        const townName = generateSettlementName(rng);
        const newTown = {
            id: uid('town'),
            name: townName,
            x: foundX,
            y: foundY,
            kingdomId: k.id,
            isCapital: false,
            population: 0,
            buildings: [],
            market: createMarket(0.3, 'village'), // small starting supply
            prosperity: rng.randInt(25, 40),
            walls: 0,
            garrison: rng.randInt(3, 8),
            happiness: rng.randInt(55, 70),
            isPort: false,
            isIsland: false,
            towers: 0,
            livestock: { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 },
        };

        // Give basic starting buildings
        newTown.buildings.push({ type: 'wheat_farm', level: 1, ownerId: null });
        newTown.buildings.push({ type: 'lumber_camp', level: 1, ownerId: null });
        newTown.buildings.push({ type: 'market_stall', level: 1, ownerId: null });

        // Check if coastal
        const ttx = Math.floor(foundX / CONFIG.TILE_SIZE);
        const tty = Math.floor(foundY / CONFIG.TILE_SIZE);
        const proximity = CONFIG.PORT_WATER_PROXIMITY || 3;
        let nearWater = false;
        for (let dy = -proximity; dy <= proximity && !nearWater; dy++) {
            for (let dx = -proximity; dx <= proximity && !nearWater; dx++) {
                const cx = ttx + dx;
                const cy = tty + dy;
                if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
                    if (world.terrain[cy * cols + cx] === TERRAIN.WATER.id) {
                        nearWater = true;
                    }
                }
            }
        }
        if (nearWater) {
            newTown.isPort = true;
            newTown.buildings.push({ type: 'dock', level: 1, ownerId: null });
            newTown.buildings.push({ type: 'fishery', level: 1, ownerId: null });
            newTown.market.supply.fish = (newTown.market.supply.fish || 0) + 40;
            newTown.market.supply.salt = (newTown.market.supply.salt || 0) + 20;
        }

        // Add town to world
        world.towns.push(newTown);
        townIndex[newTown.id] = newTown;
        k.territories.add(newTown.id);

        // Classify terrain and compute local prices for new town
        classifyTownTerrain(newTown);
        computeLocalBasePrices(newTown);

        // Transfer settlers from most populated kingdom town
        const sourceTown = kTowns
            .filter(t => t.population > CONFIG.TOWN_FOUNDING_STARTING_POP + 10)
            .sort((a, b) => b.population - a.population)[0];

        if (sourceTown) {
            const settlers = world.people
                .filter(pp => pp.alive && pp.townId === sourceTown.id && pp.age >= 16 && pp.age <= 50)
                .slice(0, CONFIG.TOWN_FOUNDING_STARTING_POP);
            for (const settler of settlers) {
                settler.townId = newTown.id;
                sourceTown.population--;
                newTown.population++;
            }
        }

        // Generate roads to nearest 1-2 kingdom towns
        const kTownsSorted = kTowns
            .sort((a, b) => Math.hypot(a.x - foundX, a.y - foundY) - Math.hypot(b.x - foundX, b.y - foundY));
        const roadTargets = kTownsSorted.slice(0, Math.min(2, kTownsSorted.length));
        for (const target of roadTargets) {
            const key = [newTown.id, target.id].sort().join('-');
            const alreadyConnected = world.roads.some(r =>
                ((r.fromTownId === newTown.id && r.toTownId === target.id) ||
                 (r.fromTownId === target.id && r.toTownId === newTown.id)) &&
                r.condition !== 'destroyed'
            );
            if (!alreadyConnected) {
                buildNewRoad(newTown.id, target.id, k.id);
            }
        }

        // If port, add sea routes to nearby ports
        if (newTown.isPort) {
            const portTowns = world.towns.filter(t => t.isPort && t.id !== newTown.id);
            const maxDist = CONFIG.SEA_ROUTE_MAX_DISTANCE || 3000;
            for (const pt of portTowns) {
                const dist = Math.hypot(pt.x - newTown.x, pt.y - newTown.y);
                if (dist <= maxDist) {
                    const waterFraction = checkWaterPath(newTown.x, newTown.y, pt.x, pt.y);
                    if (waterFraction >= 0.3) {
                        world.seaRoutes.push({
                            fromTownId: newTown.id,
                            toTownId: pt.id,
                            type: 'sea',
                            distance: dist,
                            safe: true,
                        });
                    }
                }
            }
        }

        // Deduct cost from treasury
        k.gold -= CONFIG.TOWN_FOUNDING_COST;

        // Rebuild connected towns for new town and its neighbors
        newTown.connectedTowns = [];
        for (var ri = 0; ri < world.roads.length; ri++) {
            var rd = world.roads[ri];
            if (rd.fromTownId === newTown.id && newTown.connectedTowns.indexOf(rd.toTownId) === -1) newTown.connectedTowns.push(rd.toTownId);
            if (rd.toTownId === newTown.id && newTown.connectedTowns.indexOf(rd.fromTownId) === -1) newTown.connectedTowns.push(rd.fromTownId);
        }
        for (var sri = 0; sri < (world.seaRoutes || []).length; sri++) {
            var sr = world.seaRoutes[sri];
            if (sr.fromTownId === newTown.id && newTown.connectedTowns.indexOf(sr.toTownId) === -1) newTown.connectedTowns.push(sr.toTownId);
            if (sr.toTownId === newTown.id && newTown.connectedTowns.indexOf(sr.fromTownId) === -1) newTown.connectedTowns.push(sr.fromTownId);
        }
        // Also update neighbors' connectedTowns to include this new town
        for (var nci = 0; nci < newTown.connectedTowns.length; nci++) {
            var neighbor = findTown(newTown.connectedTowns[nci]);
            if (neighbor && neighbor.connectedTowns && neighbor.connectedTowns.indexOf(newTown.id) === -1) {
                neighbor.connectedTowns.push(newTown.id);
            }
        }
        k._lastTownFounded = world.day;

        logEvent(`The Kingdom of ${k.name} has founded a new settlement: ${townName}!`);
    }

    // ========================================================
    // §14C REBELLION SYSTEM (now uses scaled kingdom happiness consequences)
    // This function is kept for backward compatibility but the heavy
    // lifting is done by tickKingdomHappinessConsequences()
    // ========================================================
    function tickRebellion(k) {
        // Rebellion consequences are now handled by the scaled
        // tickKingdomHappinessConsequences() system called alongside this.
        // This stub remains so any code calling tickRebellion() still works.
        // The new system provides percentage-based scaling instead of
        // hard thresholds at 30/20/10.
    }

    // ========================================================
    // §14D SURRENDER MECHANIC (called each season during war)
    // ========================================================
    function tickSurrender(k) {
        if (k.atWar.size === 0) return;
        const rng = world.rng;
        if (!world.activeWars) return;

        for (const enemyId of k.atWar) {
            // Find active war
            let warData = null;
            for (const wid in world.activeWars) {
                const w = world.activeWars[wid];
                if ((w.kingdomA === k.id && w.kingdomB === enemyId) ||
                    (w.kingdomA === enemyId && w.kingdomB === k.id)) {
                    warData = w;
                    break;
                }
            }
            if (!warData) continue;

            const originalTowns = warData.originalTowns[k.id] || k.territories.size;
            const currentTowns = k.territories.size;
            if (originalTowns <= 0) continue;

            const townLossRatio = 1 - (currentTowns / originalTowns);
            let surrenderChance = 0;

            if (townLossRatio >= 0.75) surrenderChance = 0.70;
            else if (townLossRatio >= 0.50) surrenderChance = 0.40;
            else if (townLossRatio >= 0.25) surrenderChance = 0.15;
            else if (k.gold < 100 && (k._bankruptDays || 0) > 30) surrenderChance = 0.10;
            else continue; // Not losing badly enough

            // Treasury modifier
            if (k.gold < 100) surrenderChance += 0.20;

            // War exhaustion modifier
            surrenderChance += getWarExhaustionSurrenderBonus(k);

            // King personality modifier
            const p = k.kingPersonality;
            if (p) {
                if (p.courage === 'brave' || p.ambition === 'ambitious') surrenderChance -= 0.20;
                if (p.courage === 'cowardly') surrenderChance += 0.30;
            }

            surrenderChance = Math.max(0, Math.min(1, surrenderChance));

            if (rng.chance(surrenderChance)) {
                const enemy = findKingdom(enemyId);
                if (enemy) {
                    makePeace(k, enemy, true, k);
                }
                break; // Only one surrender per tick
            }
        }
    }

    // ========================================================
    // §14E KINGDOM PURCHASING FROM MARKET (daily)
    // ========================================================
    function tickKingdomPurchasing(k) {
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;

            // Buy food for garrison
            const garrisonFood = Math.ceil(town.garrison * 0.5);
            if (garrisonFood > 0 && k.gold > 0) {
                const foodTypes = ['bread', 'meat', 'wheat'];
                for (const foodId of foodTypes) {
                    const avail = town.market.supply[foodId] || 0;
                    const toBuy = Math.min(garrisonFood, avail);
                    if (toBuy > 0) {
                        const price = (town.market.prices[foodId] || 1) * toBuy;
                        if (k.gold >= price) {
                            town.market.supply[foodId] -= toBuy;
                            k.gold -= price;
                        }
                        break;
                    }
                }
            }

            // Buy weapons for garrison maintenance
            const swordNeed = Math.ceil(town.garrison * 0.02);
            if (swordNeed > 0 && k.gold > 0) {
                const avail = town.market.supply.swords || 0;
                const toBuy = Math.min(swordNeed, avail);
                if (toBuy > 0) {
                    const price = (town.market.prices.swords || 35) * toBuy;
                    if (k.gold >= price) {
                        town.market.supply.swords -= toBuy;
                        k.gold -= price;
                    }
                }
            }
        }
    }

    function computeMilitaryStrength(k) {
        var soldiers = (_tickCache.soldiersByKingdom[k.id] || []);
        let totalInfantry = 0, totalArchers = 0, totalCavalry = 0;
        let strength = soldiers.length;

        // Count unit types based on equipment available across kingdom towns
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const swords = town.market.supply.swords || 0;
            const armor = town.market.supply.armor || 0;
            const bows = town.market.supply.bows || 0;
            const arrows = town.market.supply.arrows || 0;
            const horses = town.market.supply.horses || 0;
            const saddles = town.market.supply.saddles || 0;

            // Cavalry: needs horse + sword + saddle
            const cavCount = Math.min(horses, saddles, Math.floor(swords * 0.3));
            totalCavalry += cavCount;

            // Archers: needs bow + arrows (at least 5 arrows per archer)
            const archCount = Math.min(bows, Math.floor(arrows / 5));
            totalArchers += archCount;

            // Infantry: swords + armor (remaining swords after cavalry)
            const infCount = Math.max(0, Math.min(swords - cavCount, armor));
            totalInfantry += infCount;

            strength += town.garrison;
        }

        // Unit-type weighted strength
        strength += totalInfantry * MILITARY_UNITS.infantry.attackMult;
        strength += totalArchers * MILITARY_UNITS.archer.defenseMult;
        strength += totalCavalry * MILITARY_UNITS.cavalry.attackMult;

        return Math.floor(strength);
    }

    function kingdomAI(k) {
        const rng = world.rng;

        if (k.atWar.size > 0) {
            // Wartime AI: recruit soldiers, buy weapons, build balanced armies
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;

                // Recruit idle people as soldiers
                var idle = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
                    return (p.occupation === 'laborer' || p.occupation === 'none') &&
                    p.age >= CONFIG.COMING_OF_AGE && p.age <= 50;
                });
                const toRecruit = Math.min(idle.length, 8);
                for (let i = 0; i < toRecruit; i++) {
                    idle[i].occupation = 'soldier';
                    idle[i].skills.combat = Math.max(idle[i].skills.combat, 20);
                    town.garrison++;
                }

                // Build watchtowers in border towns
                const isNearEnemy = world.towns.some(t =>
                    k.atWar.has(t.kingdomId) && Math.hypot(t.x - town.x, t.y - town.y) < 1500
                );
                if (isNearEnemy && !(town.towers > 0) && k.gold > 500 && rng.chance(0.1)) {
                    const bt = findBuildingType('watchtower');
                    if (bt) {
                        // AI checks materials + calculates dynamic cost
                        let canBuildMat = true;
                        let matCost = 0;
                        if (bt.materials) {
                            for (const [matId, qty] of Object.entries(bt.materials)) {
                                if ((town.market.supply[matId] || 0) < qty) { canBuildMat = false; break; }
                                matCost += qty * (getMarketPrice(town, matId) || 5);
                            }
                        }
                        var totalBuildCost = (bt.cost || 0) + matCost;
                        if (canBuildMat && k.gold >= totalBuildCost) {
                            if (bt.materials) {
                                for (const [matId, qty] of Object.entries(bt.materials)) {
                                    town.market.supply[matId] -= qty;
                                }
                            }
                            town.buildings.push({ type: 'watchtower', level: 1, ownerId: null });
                            k.gold -= totalBuildCost;
                        }
                    }
                }

                // Try to raise an army if enough soldiers (balanced composition)
                // Garrison management: keep minimum ratio to defend
                var minGarrison = Math.max(CONFIG.GARRISON_MIN, Math.floor(town.garrison * (CONFIG.ARMY_MIN_GARRISON_RATIO || 0.4)));
                var availableSoldiers = town.garrison - minGarrison;
                if (availableSoldiers > 5 && rng.chance(0.3)) {
                    const armySize = Math.min(Math.floor(town.garrison * 0.5), availableSoldiers);
                    town.garrison -= armySize;

                    // Calculate unit composition: 60% infantry, 25% archers, 15% cavalry
                    const targetInf = Math.floor(armySize * 0.6);
                    const targetArch = Math.floor(armySize * 0.25);
                    const targetCav = Math.floor(armySize * 0.15);

                    // Equip based on available resources
                    const swords = town.market.supply.swords || 0;
                    const armor = town.market.supply.armor || 0;
                    const bows = town.market.supply.bows || 0;
                    const arrows = town.market.supply.arrows || 0;
                    const horses = town.market.supply.horses || 0;
                    const saddles = town.market.supply.saddles || 0;

                    const actualCav = Math.min(targetCav, horses, saddles, swords);
                    const actualArch = Math.min(targetArch, bows, Math.floor(arrows / 5));
                    const actualInf = Math.min(targetInf, swords - actualCav, armor);

                    // Find target using intelligent routing (not just straight-line distance)
                    const enemyTowns = world.towns.filter(t => k.atWar.has(t.kingdomId) && !t.destroyed && !t.abandoned);
                    if (enemyTowns.length > 0) {
                        // Score targets by route quality and strategic value
                        var bestTarget = null;
                        var bestRouteScore = -Infinity;
                        var bestRoute = null;
                        // Evaluate up to 8 enemy targets (nearest by straight line as candidates)
                        var candidates = enemyTowns.sort((a, b) => {
                            const da = Math.hypot(a.x - town.x, a.y - town.y);
                            const db = Math.hypot(b.x - town.x, b.y - town.y);
                            return da - db;
                        }).slice(0, 8);

                        for (var ci = 0; ci < candidates.length; ci++) {
                            var cand = candidates[ci];
                            var route = findArmyRoute(town.id, cand.id);
                            if (!route) continue; // unreachable

                            // Score: prefer short routes, weak garrisons, high-value targets
                            var routeScore = 100;
                            routeScore -= route.totalTime * 2; // Faster routes preferred
                            routeScore -= (cand.garrison || 0) * 0.5; // Weaker targets preferred
                            routeScore += (cand.population || 0) * 0.01; // Higher pop = more valuable
                            routeScore += cand.isCapital ? 30 : 0; // Capitals are high-value
                            // Penalize routes with lots of offroad legs
                            var offroadLegs = route.legs.filter(function(l) { return l.type === 'offroad'; }).length;
                            routeScore -= offroadLegs * 10;

                            if (routeScore > bestRouteScore) {
                                bestRouteScore = routeScore;
                                bestTarget = cand;
                                bestRoute = route;
                            }
                        }

                        if (bestTarget) {
                            var armyObj = {
                                id: uid('army'),
                                kingdomId: k.id,
                                targetKingdomId: bestTarget.kingdomId,
                                soldiers: armySize,
                                fromTownId: town.id,
                                toTownId: bestTarget.id,
                                progress: 0,
                                equipment: Math.min(swords, armySize),
                                infantry: Math.max(0, actualInf),
                                archers: Math.max(0, actualArch),
                                cavalry: Math.max(0, actualCav),
                                morale: CONFIG.ARMY_DEFAULT_MORALE,
                                supplies: CONFIG.ARMY_DEFAULT_SUPPLIES,
                            };

                            // Attach route if multi-leg routing found
                            if (bestRoute && bestRoute.legs.length > 0) {
                                armyObj.route = bestRoute;
                                armyObj.legIndex = 0;
                                armyObj.legProgress = 0;
                            }

                            world.armies.push(armyObj);

                            // Consume equipment
                            const swordsUsed = Math.min(swords, actualInf + actualCav);
                            town.market.supply.swords = Math.max(0, (town.market.supply.swords || 0) - swordsUsed);
                            const armorUsed = Math.min(armor, actualInf);
                            town.market.supply.armor = Math.max(0, (town.market.supply.armor || 0) - armorUsed);
                            const bowsUsed = actualArch;
                            town.market.supply.bows = Math.max(0, (town.market.supply.bows || 0) - bowsUsed);
                            const arrowsUsed = actualArch * 5;
                            town.market.supply.arrows = Math.max(0, (town.market.supply.arrows || 0) - arrowsUsed);
                            const horsesUsed = actualCav;
                            town.market.supply.horses = Math.max(0, (town.market.supply.horses || 0) - horsesUsed);
                            const saddlesUsed = actualCav;
                            town.market.supply.saddles = Math.max(0, (town.market.supply.saddles || 0) - saddlesUsed);
                        }
                    }
                }
            }
        } else {
            // Peacetime AI: improve prosperity, invest in buildings
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;

                // Upgrade walls if affordable
                if (town.walls < 3 && k.gold > 500 && rng.chance(0.1)) {
                    town.walls++;
                    k.gold -= 300;
                }

                // Build missing infrastructure (culture-aware) — uses material system
                if (k.gold > 400 && rng.chance(0.05)) {
                    const hasTypes = new Set(town.buildings.map(b => b.type));
                    let needed = ['wheat_farm', 'bakery', 'lumber_camp', 'sawmill', 'iron_mine', 'smelter'];
                    if (k.culture === 'military') needed.push('blacksmith', 'armorer', 'fletcher');
                    else if (k.culture === 'mercantile') needed.push('market_stall', 'warehouse', 'tailor');
                    else if (k.culture === 'industrial') needed.push('brick_kiln', 'toolsmith', 'clay_pit');
                    else if (k.culture === 'agricultural') needed.push('pig_farm', 'pasture', 'smokehouse');

                    for (const n of needed) {
                        if (!hasTypes.has(n)) {
                            if (kingdomBuild(k, town, n, rng)) break;
                        }
                    }
                }
            }

            // Upgrade road quality
            if (k.gold > 200 && rng.chance(0.02)) {
                const kRoads = world.roads.filter(r => {
                    const ft = findTown(r.fromTownId);
                    return ft && ft.kingdomId === k.id && r.quality < 3;
                });
                if (kRoads.length > 0) {
                    const road = rng.pick(kRoads);
                    road.quality++;
                    k.gold -= 150;
                }
            }

            // Build docks at port towns without them
            if (k.gold > 400 && rng.chance(0.03)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town || !town.isPort) continue;
                    const hasDock = town.buildings.some(b => b.type === 'dock');
                    if (!hasDock) {
                        if (kingdomBuild(k, town, 'dock', rng)) break;
                    }
                }
            }
        }

        // ---- Dynamic Law Changes ----
        const rngLocal = world.rng;

        if (k.atWar.size > 0) {
            // Wartime: consider restricting weapon/armor exports
            if (!k.laws.bannedGoods.includes('swords') && !k.laws.restrictedGoods.includes('swords') && rngLocal.chance(0.15)) {
                k.laws.restrictedGoods.push('swords');
                logEvent(`${k.name} has restricted sword exports during wartime!`);
            }
            // Increase military goods taxes
            if (!k.laws.goodsTaxes['armor'] && rngLocal.chance(0.1)) {
                k.laws.goodsTaxes['armor'] = Math.round(rngLocal.randFloat(0.15, 0.25) * 1000) / 1000;
                logEvent(`${k.name} has imposed a heavy tax on armor.`);
            }
        } else {
            // Peacetime: consider relaxing restrictions
            const swordsIdx = k.laws.restrictedGoods.indexOf('swords');
            if (swordsIdx !== -1 && rngLocal.chance(0.2)) {
                k.laws.restrictedGoods.splice(swordsIdx, 1);
                logEvent(`${k.name} has lifted restrictions on sword trade.`);
            }
        }

        // Prosperity-based tax adjustments (nuanced)
        var kingTemperament = (k.personality && k.personality.temperament) || 'moderate';
        var kingAmbition = (k.personality && k.personality.ambition) || 50;
        if (k.prosperity > 70) {
            if (k.gold < (k._startingGold || 10000) * 0.5 && k.taxRate > 0.06 && rngLocal.chance(0.03)) {
                // High prosperity + low treasury: small raise is tolerable
                k.taxRate = Math.min(0.15, k.taxRate + 0.01);
                k.lastTaxIncreaseDay = world.day;
                logEvent(`${k.name} modestly raised taxes — the prosperous economy can absorb it.`);
            } else if (k.gold > (k._startingGold || 10000) * 1.5 && rngLocal.chance(0.04)) {
                // High prosperity + healthy treasury: invest in infrastructure
                for (var tiIdx = 0; tiIdx < k.territories.length; tiIdx++) {
                    var investTown = findTown(k.territories[tiIdx]);
                    if (investTown && investTown.prosperity < 80) {
                        investTown.prosperity = Math.min(100, investTown.prosperity + 2);
                        break;
                    }
                }
                logEvent(`${k.name} invests treasury surplus into infrastructure improvements!`);
            } else if (k.taxRate > 0.06 && rngLocal.chance(0.05)) {
                k.taxRate = Math.max(0.05, k.taxRate - 0.02);
                logEvent(`${k.name} has lowered taxes due to high prosperity!`);
            }
        } else if (k.prosperity < 30) {
            // Low prosperity: aggressively lower taxes to stimulate economy
            if (k.taxRate > 0.08 && rngLocal.chance(0.12)) {
                k.taxRate = Math.max(0.05, k.taxRate - 0.03);
                logEvent(`${k.name} has slashed taxes to stimulate the struggling economy!`);
            } else if (k.taxRate <= 0.08 && k.taxRate < 0.19 && rngLocal.chance(0.04)) {
                // Desperate: taxes already low, try raising slightly for revenue
                k.taxRate = Math.min(0.20, k.taxRate + 0.01);
                k.lastTaxIncreaseDay = world.day;
                logEvent(`${k.name} has reluctantly raised taxes despite low prosperity.`);
            }
        } else {
            // Moderate prosperity (30-70): personality-driven
            if (kingAmbition > 65 && k.taxRate < 0.18 && rngLocal.chance(0.04)) {
                k.taxRate = Math.min(0.20, k.taxRate + 0.02);
                k.lastTaxIncreaseDay = world.day;
                logEvent(`${k.name}'s ambitious ruler has raised taxes to fund expansion.`);
            } else if (kingAmbition < 35 && k.taxRate > 0.06 && rngLocal.chance(0.04)) {
                k.taxRate = Math.max(0.05, k.taxRate - 0.01);
                logEvent(`${k.name}'s cautious ruler has lowered taxes slightly.`);
            }
        }
    }

    // ========================================================
    // §14X  TERRITORY TRANSFER & CONQUEST OPTIONS
    // ========================================================

    function transferTown(townId, fromKingdomId, toKingdomId, method) {
        const town = findTown(townId);
        const fromK = findKingdom(fromKingdomId);
        const toK = findKingdom(toKingdomId);
        if (!town || !toK) return null;

        // 1. Update town ownership
        const oldKingdomId = town.kingdomId;
        town.kingdomId = toKingdomId;

        // 2. Update kingdom territories
        if (fromK) fromK.territories.delete(townId);
        toK.territories.add(townId);

        // 3. Handle garrison — old soldiers leave, new kingdom assigns garrison
        const oldGarrison = town.garrison || 0;
        if (method === 'conquest') {
            town.garrison = Math.max(CONFIG.GARRISON_MIN, Math.floor(oldGarrison * 0.3));
        } else {
            town.garrison = Math.max(CONFIG.GARRISON_MIN, Math.floor(oldGarrison * 0.5));
        }

        // 4. Update town market tariffs to new kingdom rates
        if (toK.laws) {
            town._tariffRate = toK.laws.tradeTariff || 0.05;
        }

        // 5. Kingdom-exclusive buildings: transfer ownership or demolish
        for (const bld of town.buildings) {
            if (bld.ownerKingdomId && bld.ownerKingdomId === fromKingdomId) {
                if (method === 'conquest' || method === 'peace_deal') {
                    bld.ownerKingdomId = toKingdomId;
                } else {
                    bld.ownerKingdomId = toKingdomId;
                }
            }
        }

        // 6. Log rich event
        const methodLabels = {
            'peace_deal': 'as part of a peace treaty',
            'conquest': 'by military conquest',
            'sale': 'through territorial sale',
            'trade': 'through a diplomatic trade',
        };
        logEvent(`${town.name} has been transferred to ${toK.name} ${methodLabels[method] || ''}!`, {
            type: 'territory_transfer',
            cause: method === 'conquest'
                ? toK.name + '\'s forces have taken ' + town.name + ' by force.'
                : toK.name + ' has acquired ' + town.name + ' ' + (methodLabels[method] || '') + '.',
            effects: [
                town.name + ' is now part of ' + toK.name,
                'Garrison reduced from ' + oldGarrison + ' to ' + town.garrison,
                'Town tariffs updated to ' + toK.name + ' rates',
                method === 'conquest' ? 'Citizens await their fate under new rule' : 'Transition proceeding peacefully',
            ],
            kingdoms: fromK ? [fromKingdomId, toKingdomId] : [toKingdomId],
            townId: townId,
        });

        // 7. Grant war immunity if kingdom lost more than half its starting towns
        if (fromK && fromK._startingTowns) {
            if (fromK.territories.size <= Math.floor(fromK._startingTowns / 2)) {
                fromK.warImmunityUntil = world.day + 360;
                logEvent('🛡️ ' + fromK.name + ' has been granted war immunity for 1 year after devastating losses.', {
                    type: 'war_immunity',
                    cause: fromK.name + ' lost more than half its original territories.',
                    effects: ['No kingdom can declare war on ' + fromK.name + ' for 360 days']
                });
            }
        }

        // 8. Return the town for further processing
        return town;
    }

    function applyConquestDecision(town, kingdom) {
        const rng = world.rng;
        const p = kingdom.kingPersonality || {};

        // Determine conquest choice based on king personality
        let choice;
        const temp = p.temperament || 'fair';
        const greed = p.greed || 'fair';
        const intel = p.intelligence || 'average';
        const courage = p.courage || 'cautious';

        // Generous/just/kind → citizenship
        if (temp === 'kind' || greed === 'generous') {
            choice = rng.chance(0.80) ? 'citizenship' : 'servitude';
        }
        // Cruel/warlike → raid
        else if (temp === 'cruel') {
            if (intel === 'brilliant') {
                // Brilliant kings never raid (wasteful long-term)
                choice = rng.chance(0.50) ? 'servitude' : 'citizenship';
            } else {
                choice = rng.chance(0.50) ? 'raid' : 'servitude';
            }
        }
        // Pragmatic/greedy/stern → servitude
        else if (temp === 'stern' || greed === 'greedy' || greed === 'corrupt') {
            choice = rng.chance(0.60) ? 'servitude' : 'citizenship';
        }
        // Foolish kings may raid even when it's stupid
        else if (intel === 'foolish' || intel === 'dim') {
            const roll = rng.random();
            if (roll < 0.25) choice = 'raid';
            else if (roll < 0.60) choice = 'servitude';
            else choice = 'citizenship';
        }
        // Default: fair distribution
        else {
            const roll = rng.random();
            if (roll < 0.50) choice = 'citizenship';
            else if (roll < 0.85) choice = 'servitude';
            else choice = 'raid';
        }

        // Apply the decision
        if (choice === 'citizenship') {
            grantCitizenship(town, kingdom);
        } else if (choice === 'servitude') {
            imposeServitude(town, kingdom);
        } else {
            raidTown(town, kingdom);
        }

        return choice;
    }

    function grantCitizenship(town, kingdom) {
        var townPeople = (_tickCache.peopleByTown[town.id] || []);
        for (const person of townPeople) {
            person.citizenshipKingdomId = kingdom.id;
            person.kingdomId = kingdom.id;
        }
        town.happiness = Math.min(100, (town.happiness || 50) + CONFIG.CONQUEST_CITIZENSHIP_HAPPINESS);

        const king = kingdom.king ? findPerson(kingdom.king) : null;
        const kingName = king ? (king.firstName + ' ' + king.lastName) : 'The ruler';
        logEvent(`${kingName} graciously grants citizenship to the people of ${town.name}.`, {
            type: 'conquest_citizenship',
            cause: kingdom.name + ' has chosen to welcome the people of ' + town.name + ' as full citizens.',
            effects: [
                'All ' + townPeople.length + ' residents receive citizenship in ' + kingdom.name,
                'Town happiness +' + CONFIG.CONQUEST_CITIZENSHIP_HAPPINESS,
                'Town functions normally under new administration',
            ],
            kingdoms: [kingdom.id],
            townId: town.id,
        });
    }

    function imposeServitude(town, kingdom) {
        var townPeople = (_tickCache.peopleByTown[town.id] || []);
        for (const person of townPeople) {
            person.kingdomId = kingdom.id;
            person.status = 'indentured';
            person.servitudeEndDay = world.day + CONFIG.SERVITUDE_DURATION_DAYS;
            person.servitudeFreedomCost = CONFIG.SERVITUDE_FREEDOM_COST;
            person.servitudeKingdomId = kingdom.id;
        }
        town.happiness = Math.max(0, (town.happiness || 50) + CONFIG.CONQUEST_SERVITUDE_HAPPINESS);

        const king = kingdom.king ? findPerson(kingdom.king) : null;
        const kingName = king ? (king.firstName + ' ' + king.lastName) : 'The ruler';
        logEvent(`${kingName} imposes 7 years of servitude on the people of ${town.name}.`, {
            type: 'conquest_servitude',
            cause: kingdom.name + ' has decided to impose indentured servitude on the conquered population.',
            effects: [
                townPeople.length + ' residents become indentured servants',
                'Servitude lasts ' + CONFIG.SERVITUDE_DURATION_DAYS + ' days (7 years)',
                'Freedom can be purchased for ' + CONFIG.SERVITUDE_FREEDOM_COST + 'g',
                'Wages go to ' + kingdom.name + '\'s treasury',
                'Town happiness ' + CONFIG.CONQUEST_SERVITUDE_HAPPINESS,
            ],
            kingdoms: [kingdom.id],
            townId: town.id,
        });
    }

    function raidTown(town, kingdom) {
        const rng = world.rng;
        var townPeople = (_tickCache.peopleByTown[town.id] || []);
        const origPop = townPeople.length;

        // 30-50% killed
        const killRate = rng.randFloat(CONFIG.RAID_KILL_RATE_MIN, CONFIG.RAID_KILL_RATE_MAX);
        const toKill = Math.floor(origPop * killRate);
        const shuffled = rng.shuffle([...townPeople]);
        let killed = 0;
        for (let i = 0; i < toKill && i < shuffled.length; i++) {
            killPerson(shuffled[i], 'raid');
            killed++;
        }

        // 20% of survivors injured
        const survivors = world.people.filter(p => p.alive && p.townId === town.id);
        const toInjure = Math.floor(survivors.length * CONFIG.RAID_INJURY_RATE);
        const injuredSurvivors = rng.shuffle([...survivors]);
        for (let i = 0; i < toInjure && i < injuredSurvivors.length; i++) {
            injuredSurvivors[i].injured = true;
            injuredSurvivors[i].injuryDay = world.day;
        }

        // Loot gold
        const lootPerPerson = rng.randInt(CONFIG.RAID_GOLD_PER_PERSON_MIN, CONFIG.RAID_GOLD_PER_PERSON_MAX);
        const totalLoot = origPop * lootPerPerson;
        kingdom.gold += totalLoot;

        // 20-40% of buildings damaged/destroyed
        const buildDamageRate = rng.randFloat(CONFIG.RAID_BUILDING_DAMAGE_RATE_MIN, CONFIG.RAID_BUILDING_DAMAGE_RATE_MAX);
        const buildingsToDestroy = Math.floor(town.buildings.length * buildDamageRate);
        const bldShuffled = rng.shuffle([...town.buildings]);
        for (let i = 0; i < buildingsToDestroy && i < bldShuffled.length; i++) {
            bldShuffled[i].condition = 'destroyed';
        }

        // All survivors become indentured servants
        const aliveSurvivors = world.people.filter(p => p.alive && p.townId === town.id);
        for (const person of aliveSurvivors) {
            person.kingdomId = kingdom.id;
            person.status = 'indentured';
            person.servitudeEndDay = world.day + CONFIG.SERVITUDE_DURATION_DAYS;
            person.servitudeFreedomCost = CONFIG.SERVITUDE_FREEDOM_COST;
            person.servitudeKingdomId = kingdom.id;
        }

        // Town effects
        town.happiness = Math.max(0, (town.happiness || 50) + CONFIG.CONQUEST_RAID_HAPPINESS);
        town.prosperity = 10;
        town.crime = Math.min(100, Math.max(80, (town.crime || 0) + 40));

        // Kingdom-wide horror: all other kingdom towns lose happiness
        for (const tid of kingdom.territories) {
            if (tid === town.id) continue;
            const otherTown = findTown(tid);
            if (otherTown) {
                otherTown.happiness = Math.max(0, (otherTown.happiness || 50) + CONFIG.CONQUEST_RAID_KINGDOM_HAPPINESS);
            }
        }

        const king = kingdom.king ? findPerson(kingdom.king) : null;
        const kingName = king ? (king.firstName + ' ' + king.lastName) : 'The ruler';
        logEvent(`⚔️ ${kingName} orders the sacking of ${town.name}! Terrible losses reported.`, {
            type: 'conquest_raid',
            cause: kingdom.name + '\'s forces have brutally sacked ' + town.name + '.',
            effects: [
                killed + ' people killed (' + Math.round(killRate * 100) + '% of population)',
                toInjure + ' survivors injured',
                totalLoot + 'g looted for ' + kingdom.name + '\'s treasury',
                buildingsToDestroy + ' buildings destroyed (' + Math.round(buildDamageRate * 100) + '%)',
                aliveSurvivors.length + ' survivors enslaved for 7 years',
                'Town prosperity collapsed to 10, crime spiked to ' + town.crime,
                'Citizens of ' + kingdom.name + ' are horrified (happiness -5 kingdom-wide)',
            ],
            kingdoms: [kingdom.id],
            townId: town.id,
        });
    }

    // ========================================================
    // §14Y  INDENTURED SERVITUDE TICK (NPC)
    // ========================================================

    function tickServitude() {
        const rng = world.rng;
        for (const person of world.people) {
            if (!person.alive || person.status !== 'indentured') continue;

            // Auto-release when servitude period ends
            if (world.day >= (person.servitudeEndDay || Infinity)) {
                person.status = 'citizen';
                delete person.servitudeEndDay;
                delete person.servitudeFreedomCost;
                delete person.servitudeKingdomId;
                logEvent(`${person.firstName} ${person.lastName} has completed their period of servitude.`, {
                    type: 'servitude_release',
                    cause: person.firstName + '\'s indentured servitude term has expired.',
                    effects: ['Status changed to citizen', 'Free to work and earn wages normally'],
                });
                continue;
            }

            // Rich NPCs auto-buy freedom 70% of the time
            if ((person.gold || 0) >= (person.servitudeFreedomCost || CONFIG.SERVITUDE_FREEDOM_COST)) {
                const isProud = person.personality && (
                    (person.personality.ambition || 0) > 60 ||
                    (person.personality.independence || 0) > 60
                );
                const buyChance = isProud ? 0.85 : 0.70;
                if (rng.chance(buyChance)) {
                    person.gold -= (person.servitudeFreedomCost || CONFIG.SERVITUDE_FREEDOM_COST);
                    const servKingdom = findKingdom(person.servitudeKingdomId);
                    if (servKingdom) {
                        servKingdom.gold += (person.servitudeFreedomCost || CONFIG.SERVITUDE_FREEDOM_COST);
                    }
                    person.status = 'citizen';
                    delete person.servitudeEndDay;
                    delete person.servitudeFreedomCost;
                    delete person.servitudeKingdomId;
                    logEvent(`${person.firstName} ${person.lastName} has bought their freedom!`, {
                        type: 'servitude_buyout',
                        cause: person.firstName + ' paid ' + CONFIG.SERVITUDE_FREEDOM_COST + 'g to buy their freedom.',
                        effects: ['Status changed to citizen', 'Kingdom treasury increased'],
                    });
                }
            }
        }
    }

    // ========================================================
    // §14Z  PEACE NEGOTIATION AI
    // ========================================================

    function evaluatePeaceTerms(loser, winner) {
        const rng = world.rng;
        const strengthRatio = computeMilitaryStrength(winner) / Math.max(1, computeMilitaryStrength(loser));
        const loserDesperation = loser._bankruptDays > 0 ? 2.0 : (loser.gold < 1000 ? 1.5 : 1.0);

        // Determine escalation level
        let level = 1;
        if (strengthRatio >= 4.0 || loserDesperation >= 2.0) level = 5;
        else if (strengthRatio >= 3.0) level = 4;
        else if (strengthRatio >= 2.0) level = 3;
        else if (strengthRatio >= 1.5) level = 2;

        // Personality modifiers
        const loserP = loser.kingPersonality || {};
        const winnerP = winner.kingPersonality || {};

        // Brave/proud kings demand more rounds before offering towns
        if (loserP.courage === 'brave' || loserP.ambition === 'ambitious') {
            level = Math.max(1, level - 1);
        }
        // Cowardly/pragmatic kings offer towns quickly
        if (loserP.courage === 'cowardly') {
            level = Math.min(5, level + 1);
        }

        // Build offer
        const tributePercents = CONFIG.PEACE_TRIBUTE_PERCENT || [0.10, 0.15, 0.20, 0.25, 0.30];
        const tributePercent = tributePercents[Math.min(level - 1, tributePercents.length - 1)];
        let goldOffer = Math.floor(loser.gold * tributePercent);

        // Greedy winners demand more
        if (winnerP.greed === 'greedy' || winnerP.greed === 'corrupt') {
            goldOffer = Math.floor(goldOffer * 1.5);
        }
        // Content winners accept less
        if (winnerP.ambition === 'content') {
            goldOffer = Math.floor(goldOffer * 0.7);
        }

        const offer = { gold: goldOffer, towns: [], concessions: [] };

        // Level 2+: Trade concessions
        if (level >= 2) {
            offer.concessions.push('lower_tariffs');
        }

        // Level 3+: Cede 1 border town
        if (level >= 3 && loser.territories.size > 1) {
            const loserTowns = [...loser.territories].map(tid => findTown(tid)).filter(t => t);
            // Pick non-capital border towns
            const cedeCandidates = loserTowns.filter(t => !t.isCapital);
            if (cedeCandidates.length > 0) {
                offer.towns.push(rng.pick(cedeCandidates).id);
            }
        }

        // Level 4+: Cede 2 towns
        if (level >= 4 && loser.territories.size > 2) {
            const loserTowns = [...loser.territories].map(tid => findTown(tid)).filter(t => t);
            const cedeCandidates = loserTowns.filter(t => !t.isCapital && !offer.towns.includes(t.id));
            if (cedeCandidates.length > 0) {
                offer.towns.push(rng.pick(cedeCandidates).id);
            }
        }

        // Level 5: Also servitude of people in ceded towns
        if (level >= 5) {
            offer.concessions.push('servitude_of_ceded');
        }

        // Determine acceptance
        let acceptChance = 0.3 + level * 0.12;
        if (winnerP.ambition === 'content') acceptChance += 0.15;
        if (winnerP.greed === 'greedy') acceptChance -= 0.10;
        if (winnerP.ambition === 'ambitious') acceptChance -= 0.10;
        acceptChance = Math.max(0.1, Math.min(0.85, acceptChance));

        const accepted = rng.chance(acceptChance);

        return { offer, accepted, level };
    }

    // ========================================================
    // §14ZA  NPC MIGRATION SYSTEM
    // ========================================================

    function calculateMigrationDesire(person, town) {
        let score = 0;

        // Factors that increase desire to leave
        if ((town.happiness || 50) < 25) score += 30;
        if ((town.prosperity || 50) < 15) score += 20;
        if (town.isFrontline) score += 40;
        if (town._justConquered) score += 30;
        if ((town.crime || 0) > 70) score += 15;

        // No job for extended period
        if (person.occupation === 'none' || person.occupation === 'laborer') {
            if ((person._unemployedDays || 0) > 60) score += 20;
        }

        // Famine indicator
        const foodSupply = (town.market && town.market.supply) ?
            ((town.market.supply.bread || 0) + (town.market.supply.meat || 0) + (town.market.supply.wheat || 0)) : 999;
        if (foodSupply < (town.population || 50) * 0.5) score += 35;

        // Factors that reduce desire to leave
        if (person.status === 'indentured') score -= 100; // Can't leave!

        // Owns buildings in town
        const ownedBuildings = town.buildings.filter(b => b.ownerId === person.id);
        if (ownedBuildings.length > 0) score -= 30;

        // Has family in town
        const hasFamily = world.people.some(p =>
            p.alive && p.townId === town.id && p.id !== person.id &&
            (p.spouseId === person.id || (person.childrenIds && person.childrenIds.includes(p.id)) ||
             (person.parentIds && person.parentIds.includes(p.id)))
        );
        if (hasFamily) score -= 20;

        // Has good job
        if (person.occupation === 'merchant' || person.occupation === 'craftsman' || person.isEliteMerchant) {
            score -= 25;
        }

        // High personal happiness
        if (person.needs && (person.needs.happiness || 50) > 70) score -= 20;

        return score;
    }

    function findBestMigrationTown(person, currentTown) {
        const rng = world.rng;
        let bestTown = null;
        let bestScore = -Infinity;

        for (const town of world.towns) {
            if (town.id === currentTown.id) continue;

            // Prefer same kingdom, or friendly kingdoms
            const sameKingdom = town.kingdomId === person.kingdomId;
            let kingdomBonus = sameKingdom ? 20 : 0;
            if (!sameKingdom) {
                const personK = findKingdom(person.kingdomId);
                const townK = findKingdom(town.kingdomId);
                if (personK && townK && personK.atWar.has(town.kingdomId)) continue; // Don't migrate to enemy
                if (personK && personK.relations && (personK.relations[town.kingdomId] || 0) > 30) {
                    kingdomBonus = 10;
                }
            }

            const score = (town.happiness || 50) + (town.prosperity || 50) + kingdomBonus
                         - (town.crime || 0) * 0.5
                         - (town.isFrontline ? 30 : 0);

            if (score > bestScore) {
                bestScore = score;
                bestTown = town;
            }
        }
        return bestTown;
    }

    function tickMigration() {
        const rng = world.rng;

        for (const town of world.towns) {
            const townPeople = world.people.filter(p =>
                p.alive && p.townId === town.id && p.age >= CONFIG.COMING_OF_AGE
            );
            if (townPeople.length === 0) continue;

            // Determine max migrants this cycle
            const isWarOrFamine = town.isFrontline || town._justConquered ||
                ((town.happiness || 50) < 15 && (town.prosperity || 50) < 15);
            const maxPercent = isWarOrFamine ? CONFIG.MIGRATION_WAR_MAX_PERCENT : CONFIG.MIGRATION_MAX_PERCENT;
            const maxMigrants = Math.max(1, Math.floor(townPeople.length * maxPercent));
            let migrated = 0;

            for (const person of townPeople) {
                if (migrated >= maxMigrants) break;
                if (person.status === 'indentured') continue;

                const migScore = calculateMigrationDesire(person, town);
                if (migScore <= CONFIG.MIGRATION_SCORE_THRESHOLD) continue;
                if ((person.gold || 0) < CONFIG.MIGRATION_BASE_COST) continue;

                const destTown = findBestMigrationTown(person, town);
                if (!destTown) continue;

                // Move person
                person.gold -= CONFIG.MIGRATION_BASE_COST;
                person.townId = destTown.id;
                if (destTown.kingdomId !== person.kingdomId) {
                    person.kingdomId = destTown.kingdomId;
                }

                // Move family together
                const familyMembers = world.people.filter(p =>
                    p.alive && p.townId === town.id && p.id !== person.id &&
                    (p.spouseId === person.id || (person.childrenIds && person.childrenIds.includes(p.id)))
                );
                for (const fm of familyMembers) {
                    fm.townId = destTown.id;
                    if (destTown.kingdomId !== fm.kingdomId) {
                        fm.kingdomId = destTown.kingdomId;
                    }
                }

                // Mark buildings left behind as for sale
                for (const bld of town.buildings) {
                    if (bld.ownerId === person.id) {
                        bld.forSale = true;
                    }
                }

                migrated += 1 + familyMembers.length;

                // Log notable migrations
                if (person.isEliteMerchant || (person.gold || 0) > 500 || person.occupation === 'merchant') {
                    logEvent(`${person.firstName} ${person.lastName} has migrated from ${town.name} to ${destTown.name}.`, {
                        type: 'migration',
                        cause: 'Poor conditions in ' + town.name + ' drove ' + person.firstName + ' to seek a better life.',
                        effects: [
                            person.firstName + ' relocated to ' + destTown.name,
                            familyMembers.length > 0 ? (familyMembers.length + ' family member(s) followed') : 'Traveled alone',
                        ],
                        townId: town.id,
                    });
                }
            }

            // Update population counts
            town.population = world.people.filter(p => p.alive && p.townId === town.id).length;

            // Track migration for UI
            if (migrated > 0) {
                if (!town.migrationLog) town.migrationLog = [];
                town.migrationLog.push({ day: world.day, out: migrated });
                while (town.migrationLog.length > 10) town.migrationLog.shift();
            }

            // Clear conquest flag after one migration cycle
            if (town._justConquered) delete town._justConquered;
        }

        // Update destination town populations
        for (const town of world.towns) {
            const newPop = world.people.filter(p => p.alive && p.townId === town.id).length;
            if (newPop > (town.population || 0)) {
                if (!town.migrationLog) town.migrationLog = [];
                town.migrationLog.push({ day: world.day, in: newPop - (town.population || 0) });
                while (town.migrationLog.length > 10) town.migrationLog.shift();
            }
            town.population = newPop;
        }
    }

    // ========================================================
    // §14ZB  FRONTLINE TOWN MECHANICS
    // ========================================================

    function updateFrontlineTowns() {
        for (const town of world.towns) {
            town.isFrontline = false;
        }

        if (!world.activeWars) return;

        for (const warId in world.activeWars) {
            const war = world.activeWars[warId];
            const kA = findKingdom(war.kingdomA);
            const kB = findKingdom(war.kingdomB);
            if (!kA || !kB) continue;

            const aTowns = world.towns.filter(t => t.kingdomId === kA.id);
            const bTowns = world.towns.filter(t => t.kingdomId === kB.id);

            for (const aT of aTowns) {
                for (const bT of bTowns) {
                    // Check if connected by road or within frontline distance
                    const dist = Math.hypot((aT.x || 0) - (bT.x || 0), (aT.y || 0) - (bT.y || 0));
                    if (dist < (CONFIG.WARTIME_FRONTLINE_DISTANCE || 500)) {
                        aT.isFrontline = true;
                        bT.isFrontline = true;
                    }
                }
            }
        }

        // Apply frontline effects
        for (const town of world.towns) {
            if (town.isFrontline) {
                town.happiness = Math.max(0, (town.happiness || 50) - CONFIG.FRONTLINE_HAPPINESS_DRAIN);
                // Crime increases
                town.crime = Math.min(100, (town.crime || 0) + 0.5);
            }
        }
    }

    // ========================================================
    // §15 MILITARY TICK
    // ========================================================
    function tickMilitary() {
        const rng = world.rng;
        const toRemove = [];

        // --- WARTIME SUPPLY LINE COSTS (configurable per soldier per day for kingdoms at war) ---
        for (const k of world.kingdoms) {
            if (k.atWar.size > 0) {
                var soldiers = (_tickCache.soldiersByKingdom[k.id] || []);
                const costPerSoldier = CONFIG.WARTIME_SUPPLY_COST_PER_SOLDIER || 2;
                const supplyLineCost = soldiers.length * costPerSoldier;
                if (supplyLineCost > 0) {
                    k.gold = Math.max(0, k.gold - supplyLineCost);
                }
            }
        }

        for (const army of world.armies) {
            // Advance army along route
            const fromTown = findTown(army.fromTownId);
            const toTown = findTown(army.toTownId);
            if (!fromTown || !toTown) { toRemove.push(army.id); continue; }

            if (army.route && army.route.legs && army.route.legs.length > 0) {
                // Multi-leg routing: advance through route legs
                var legIdx = army.legIndex || 0;
                if (legIdx >= army.route.legs.length) {
                    // Already at destination
                    resolveBattle(army, toTown);
                    toRemove.push(army.id);
                    continue;
                }
                var leg = army.route.legs[legIdx];
                var legFrom = findTown(leg.from);
                var legTo = findTown(leg.to);
                if (!legFrom || !legTo) { toRemove.push(army.id); continue; }

                var legDist = Math.hypot(legTo.x - legFrom.x, legTo.y - legFrom.y);
                var baseSpeed = (army.speed || CONFIG.CARAVAN_BASE_SPEED * 0.5);
                // Apply speed modifier based on leg type
                var speedMult = leg.type === 'offroad' ? (CONFIG.ARMY_OFFROAD_SPEED_MULT || 0.3) :
                                leg.type === 'sea' ? (CONFIG.ARMY_SEA_SPEED_MULT || 0.6) :
                                (CONFIG.ARMY_ROAD_SPEED_MULT || 1.0);
                var legSpeed = baseSpeed * speedMult;
                army.legProgress = (army.legProgress || 0) + legSpeed / Math.max(legDist, 1);

                if (army.legProgress >= 1.0) {
                    // Completed this leg, move to next
                    army.legIndex = legIdx + 1;
                    army.legProgress = 0;
                    // Update overall progress for compatibility
                    army.progress = army.legIndex / army.route.legs.length;

                    if (army.legIndex >= army.route.legs.length) {
                        // Arrived at final destination
                        resolveBattle(army, toTown);
                        toRemove.push(army.id);
                        continue;
                    }
                }
            } else {
                // Legacy: straight-line movement (backwards compatible)
                const dist = Math.hypot(toTown.x - fromTown.x, toTown.y - fromTown.y);
                const speed = (army.speed || CONFIG.CARAVAN_BASE_SPEED * 0.5);
                army.progress += speed / Math.max(dist, 1);

                if (army.progress >= 1.0) {
                    resolveBattle(army, toTown);
                    toRemove.push(army.id);
                    continue;
                }
            }
            if (army.supplies == null) army.supplies = CONFIG.ARMY_DEFAULT_SUPPLIES;
            if (army.morale == null) army.morale = CONFIG.ARMY_DEFAULT_MORALE;
            // Consume supplies (1 per tick per 10 soldiers)
            const supplyConsumption = Math.max(1, Math.floor(army.soldiers / 10)) * CONFIG.ARMY_SUPPLY_CONSUMPTION_PER_10;
            army.supplies = Math.max(0, army.supplies - supplyConsumption * 0.1);
            // Low supplies → morale drops
            if (army.supplies <= 0) {
                army.morale = Math.max(0, army.morale - CONFIG.ARMY_LOW_SUPPLY_MORALE_LOSS);
            }
            // Army with 0 morale deserts
            if (army.morale <= 0) {
                logEvent('An army has deserted due to starvation and low morale!');
                toRemove.push(army.id);
                continue;
            }

            if (army.progress >= 1.0) {
                // Army arrives — battle!
                resolveBattle(army, toTown);
                toRemove.push(army.id);
            }

            // Check for opposing armies en route (meeting battle)
            for (const other of world.armies) {
                if (other.id === army.id || other.kingdomId === army.kingdomId) continue;
                // Use route-aware position for both armies
                var armyPos = getArmyWorldPosition(army);
                var otherPos = getArmyWorldPosition(other);

                if (Math.hypot(armyPos.x - otherPos.x, armyPos.y - otherPos.y) < 100) {
                    resolveFieldBattle(army, other);
                    if (army.soldiers <= 0) toRemove.push(army.id);
                    if (other.soldiers <= 0) toRemove.push(other.id);
                }
            }
        }

        world.armies = world.armies.filter(a => !toRemove.includes(a.id));

        // --- NAVAL WARFARE TICK ---
        tickNavalWarfare();
    }

    function getKingdomWeaponQualityBonus(kingdom) {
        if (!kingdom) return 0;
        let totalBonus = 0, totalItems = 0;
        const qualityGoods = ['swords', 'armor', 'bows', 'arrows'];
        for (const townId of kingdom.territories) {
            const town = findTown(townId);
            if (!town) continue;
            for (const baseGood of qualityGoods) {
                const basicQty = town.market.supply[baseGood] || 0;
                const goodQty = town.market.supply[baseGood + '_good'] || 0;
                const excelQty = (baseGood !== 'arrows') ? (town.market.supply[baseGood + '_excellent'] || 0) : 0;
                totalItems += basicQty + goodQty + excelQty;
                totalBonus += goodQty * (CONFIG.QUALITY_TIERS.good.effectivenessBonus) +
                              excelQty * (CONFIG.QUALITY_TIERS.excellent.effectivenessBonus);
            }
        }
        return totalItems > 0 ? totalBonus / totalItems : 0;
    }

    function resolveBattle(army, town) {
        const rng = world.rng;
        const attackK = findKingdom(army.kingdomId);
        const defendK = findKingdom(town.kingdomId);
        if (!attackK || !defendK) return;

        // --- SIEGE COST: attacker pays 100-500g per siege attempt ---
        const siegeCost = Math.min(500, Math.max(100, army.soldiers * 5));
        attackK.gold = Math.max(0, attackK.gold - siegeCost);

        // Army unit composition (with fallback for legacy armies)
        const atkInf = army.infantry || Math.floor(army.soldiers * 0.6);
        const atkArch = army.archers || Math.floor(army.soldiers * 0.25);
        const atkCav = army.cavalry || Math.floor(army.soldiers * 0.15);

        // Attack strength by unit type
        let attackStrength = atkInf * MILITARY_UNITS.infantry.attackMult
                           + atkArch * MILITARY_UNITS.archer.attackMult
                           + atkCav * MILITARY_UNITS.cavalry.attackMult;
        // Apply weapon quality bonus from attacking kingdom stockpile
        attackStrength *= (1 + getKingdomWeaponQualityBonus(attackK));
        // Apply morale modifier
        const moraleMod = (army.morale != null) ? Math.max(CONFIG.ARMY_LOW_MORALE_COMBAT_PENALTY, army.morale / 100) : 1.0;
        attackStrength *= moraleMod;
        attackStrength *= (1 + rng.randFloat(-CONFIG.BATTLE_RANDOMNESS, CONFIG.BATTLE_RANDOMNESS));

        // Defense garrison composition (estimated from town supply)
        const defTotal = Math.max(1, town.garrison);
        const defBows = town.market.supply.bows || 0;
        const defArrows = town.market.supply.arrows || 0;
        const defHorses = town.market.supply.horses || 0;
        const defSaddles = town.market.supply.saddles || 0;
        const defArchCount = Math.min(Math.floor(defTotal * 0.25), defBows, Math.floor(defArrows / 5));
        const defCavCount = Math.min(Math.floor(defTotal * 0.1), defHorses, defSaddles);
        const defInfCount = defTotal - defArchCount - defCavCount;

        // Tower bonus for defending archers
        const towerBonus = (town.towers || 0) * (findBuildingType('watchtower') || { archerBonus: 0.5 }).archerBonus;

        let defenseStrength = defInfCount * MILITARY_UNITS.infantry.defenseMult
                            + defArchCount * MILITARY_UNITS.archer.defenseMult * (1 + towerBonus)
                            + defCavCount * MILITARY_UNITS.cavalry.defenseMult;
        // Apply defending kingdom's weapon quality bonus
        defenseStrength *= (1 + getKingdomWeaponQualityBonus(defendK));

        // --- ENHANCED WALL DEFENSE MULTIPLIER ---
        const wallLevel = town.walls || 0;
        const wallDefenseMultipliers = { 0: 1.0, 1: 1.3, 2: 1.6, 3: 2.0 };
        const wallMult = wallDefenseMultipliers[wallLevel] || 1.0;
        const wallEff = CONFIG.CONDITION_LEVELS[town.wallCondition || 'new'] ? CONFIG.CONDITION_LEVELS[town.wallCondition || 'new'].efficiency : 1.0;
        // Blend the wall multiplier with condition: mult of 2.0 at 50% condition → 1.5×
        const effectiveWallMult = 1.0 + (wallMult - 1.0) * wallEff;
        defenseStrength *= effectiveWallMult;

        // --- DEFENDER HOME TERRITORY BONUS (+25% combat effectiveness) ---
        defenseStrength *= 1.25;

        // --- MILITIA: 10% of civilian population fights as militia (combat skill 10) ---
        var civilians = (_tickCache.peopleByTown[town.id] || []).filter(function(p) {
            return p.occupation !== 'soldier' && p.occupation !== 'guard' &&
            p.age >= CONFIG.COMING_OF_AGE && p.age <= 55;
        });
        const militiaCount = Math.floor(civilians.length * 0.10);
        const militiaStrength = militiaCount * 0.4; // militia fight at 40% of infantry effectiveness
        defenseStrength += militiaStrength;

        defenseStrength *= (1 + rng.randFloat(-CONFIG.BATTLE_RANDOMNESS, CONFIG.BATTLE_RANDOMNESS));

        // Consume arrows during battle (archers use 5 arrows each)
        const defArrowsUsed = defArchCount * 5;
        town.market.supply.arrows = Math.max(0, (town.market.supply.arrows || 0) - defArrowsUsed);

        if (attackStrength > defenseStrength) {
            // Attacker wins — conquer town
            const casualties = Math.floor(army.soldiers * rng.randFloat(0.2, 0.5));
            army.soldiers -= casualties;
            town.garrison = Math.max(0, Math.floor(town.garrison * 0.3));

            // --- MILITIA CASUALTIES (2-5% of civilian population killed in siege) ---
            const civKillRate = rng.randFloat(0.02, 0.05);
            const civsToKill = Math.floor(civilians.length * civKillRate);
            const shuffledCivs = rng.shuffle([...civilians]);
            for (let i = 0; i < civsToKill && i < shuffledCivs.length; i++) {
                killPerson(shuffledCivs[i], 'siege');
            }

            // --- WAR DAMAGE: buildings have 10-30% chance of being destroyed ---
            let buildingsDestroyed = 0;
            for (const bld of town.buildings) {
                if (bld.condition !== 'destroyed' && rng.chance(rng.randFloat(0.10, 0.30))) {
                    bld.condition = 'destroyed';
                    buildingsDestroyed++;
                }
            }

            // --- INFRASTRUCTURE DAMAGE: walls and roads damaged ---
            if (town.walls > 0 && rng.chance(0.5)) {
                town.walls = Math.max(0, town.walls - 1);
                town.wallCondition = 'breaking';
            }
            // Damage roads connected to this town
            for (const road of world.roads) {
                if ((road.fromTownId === town.id || road.toTownId === town.id) && rng.chance(0.3)) {
                    road.quality = Math.max(0, (road.quality || 1) - 1);
                }
            }

            // --- POST-WAR RECOVERY: 90 days of reduced production ---
            town._postWarRecovery = world.day + 90;

            // Transfer town using the new system
            const transferredTown = transferTown(town.id, defendK ? defendK.id : null, army.kingdomId, 'conquest');
            if (transferredTown) {
                transferredTown.garrison += Math.max(0, army.soldiers);
                transferredTown.prosperity = Math.max(0, transferredTown.prosperity - 20);
                transferredTown._justConquered = true;

                // Apply conquest decision (citizenship/servitude/raid)
                applyConquestDecision(transferredTown, attackK);
            }

            logEvent(`${attackK ? attackK.name : 'An army'} conquers ${town.name}!`);

            // War exhaustion: defender loses a town and a battle
            if (defendK) {
                addBattleLossExhaustion(defendK);
                addTownLossExhaustion(defendK);
            }
            // War goals: attacker wins battle and potentially conquers target town
            if (attackK && defendK) incrementWarGoalBattles(attackK, defendK);

            if (defendK && defendK.territories.size === 0) {
                logEvent(`${defendK.name} has been completely conquered by ${attackK ? attackK.name : 'invaders'}!`);
                if (attackK) {
                    // Fire warEnded for complete conquest
                    let warId = null;
                    if (world.activeWars) {
                        for (const wid in world.activeWars) {
                            const w = world.activeWars[wid];
                            if ((w.kingdomA === attackK.id && w.kingdomB === defendK.id) ||
                                (w.kingdomA === defendK.id && w.kingdomB === attackK.id)) {
                                warId = wid;
                                break;
                            }
                        }
                    }
                    world.eventLog.push({
                        day: world.day,
                        message: `${defendK.name} has been completely conquered!`,
                        type: 'warEnded',
                        warId: warId,
                        kingdomA: attackK.id,
                        kingdomB: defendK.id,
                        winner: attackK.id,
                        isSurrender: false,
                    });
                    if (world.activeWars && warId) delete world.activeWars[warId];
                    attackK.atWar.delete(defendK.id);
                    defendK.atWar.delete(attackK.id);
                }
            }
        } else {
            // Defender wins
            const attackerLoss = Math.floor(army.soldiers * rng.randFloat(0.4, 0.8));
            army.soldiers -= attackerLoss;
            town.garrison = Math.max(0, town.garrison - Math.floor(town.garrison * rng.randFloat(0.1, 0.3)));
            logEvent(`Attack on ${town.name} repelled! The garrison holds.`);
            // War exhaustion: attacker loses a battle
            if (attackK) addBattleLossExhaustion(attackK);
            // War goals: defender wins
            if (defendK && attackK) incrementWarGoalBattles(defendK, attackK);
        }
    }

    function resolveFieldBattle(a, b) {
        const rng = world.rng;
        const aInf = a.infantry || Math.floor(a.soldiers * 0.6);
        const aArch = a.archers || Math.floor(a.soldiers * 0.25);
        const aCav = a.cavalry || Math.floor(a.soldiers * 0.15);
        const bInf = b.infantry || Math.floor(b.soldiers * 0.6);
        const bArch = b.archers || Math.floor(b.soldiers * 0.25);
        const bCav = b.cavalry || Math.floor(b.soldiers * 0.15);

        const aK = findKingdom(a.kingdomId);
        const bK = findKingdom(b.kingdomId);
        const aQualityBonus = aK ? getKingdomWeaponQualityBonus(aK) : 0;
        const bQualityBonus = bK ? getKingdomWeaponQualityBonus(bK) : 0;

        const aStr = (aInf * 1.0 + aArch * 0.7 + aCav * 1.8) * (1 + aQualityBonus) *
            (1 + rng.randFloat(-CONFIG.BATTLE_RANDOMNESS, CONFIG.BATTLE_RANDOMNESS));
        const bStr = (bInf * 1.0 + bArch * 0.7 + bCav * 1.8) * (1 + bQualityBonus) *
            (1 + rng.randFloat(-CONFIG.BATTLE_RANDOMNESS, CONFIG.BATTLE_RANDOMNESS));

        if (aStr > bStr) {
            a.soldiers -= Math.floor(a.soldiers * rng.randFloat(0.1, 0.3));
            b.soldiers = 0;
            logEvent('Armies clashed in the field! One force was routed.');
            if (bK) addBattleLossExhaustion(bK);
            if (aK && bK) incrementWarGoalBattles(aK, bK);
        } else {
            b.soldiers -= Math.floor(b.soldiers * rng.randFloat(0.1, 0.3));
            a.soldiers = 0;
            logEvent('Armies clashed in the field! One force was routed.');
            if (aK) addBattleLossExhaustion(aK);
            if (bK && aK) incrementWarGoalBattles(bK, aK);
        }
    }

    // ========================================================
    // §15B TOWN CATEGORY SYSTEM
    // ========================================================
    function getTownCategory(population) {
        // Note: outposts are set explicitly — this function only handles
        // natural settlements. Outposts upgrade to village via annexation, not population.
        if (population >= 300) return 'capital_city';
        if (population >= 150) return 'city';
        if (population >= 60) return 'town';
        return 'village';
    }

    function tickTownCategories() {
        if (world.day % CONFIG.TOWN_CATEGORY_CHECK_INTERVAL !== 0) return;
        for (const town of world.towns) {
            // Outposts upgrade via annexation, not population thresholds
            if (town.category === 'outpost') continue;
            const newCat = getTownCategory(town.population);
            const oldCat = town.category || getTownCategory(town.population);
            if (newCat !== oldCat) {
                // Check if threshold has been crossed for long enough
                if (!town._categoryHoldStart) {
                    town._categoryHoldStart = world.day;
                } else if (world.day - town._categoryHoldStart >= CONFIG.TOWN_CATEGORY_UPGRADE_HOLD_DAYS) {
                    const oldLabel = CONFIG.TOWN_CATEGORIES[oldCat] ? CONFIG.TOWN_CATEGORIES[oldCat].label : oldCat;
                    const newLabel = CONFIG.TOWN_CATEGORIES[newCat] ? CONFIG.TOWN_CATEGORIES[newCat].label : newCat;
                    const isUpgrade = (CONFIG.TOWN_CATEGORIES[newCat] || {}).minPop > (CONFIG.TOWN_CATEGORIES[oldCat] || {}).minPop;
                    if (isUpgrade) {
                        logEvent(`🏘️ The ${oldLabel.toLowerCase()} of ${town.name} has grown into a thriving ${newLabel.toLowerCase()}!`);
                    } else {
                        logEvent(`📉 The ${oldLabel.toLowerCase()} of ${town.name} has declined to a ${newLabel.toLowerCase()}.`);
                    }
                    town.category = newCat;
                    town.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[newCat].maxBuildingSlots;
                    town._categoryHoldStart = null;
                }
            } else {
                town._categoryHoldStart = null;
            }
            // Ensure category is always set
            if (!town.category) {
                town.category = getTownCategory(town.population);
                town.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots;
            }

            // Town abandonment — population below 8 triggers collapse (capitals are protected)
            var isCapital = false;
            for (var ki = 0; ki < world.kingdoms.length; ki++) {
                if (world.kingdoms[ki].capitalTownId === town.id) { isCapital = true; break; }
            }
            if (town.population < 8 && !town.abandoned && !town.destroyed && !isCapital) {
                town.abandoned = true;
                town.abandonedDay = world.day;
                town.category = 'abandoned';
                town.maxBuildingSlots = 0;
                logEvent(`💀 ${town.name} has been abandoned! The remaining ${town.population} souls scatter to nearby settlements.`);
                // Migrate remaining people to nearest non-abandoned town
                const nearbyTowns = world.towns.filter(t => t.id !== town.id && !t.abandoned && !t.destroyed && t.population > 10);
                if (nearbyTowns.length > 0) {
                    var migrants = (_tickCache.peopleByTown[town.id] || []);
                    for (const p of migrants) {
                        const dest = nearbyTowns[world.rng.randInt(0, nearbyTowns.length - 1)];
                        p.townId = dest.id;
                        dest.population++;
                    }
                    town.population = 0;
                }
                // Close all buildings
                for (const bld of town.buildings) {
                    bld.condition = 'destroyed';
                }
            }

            // Town destruction — abandoned for 360 days (1 year) = destroyed permanently
            if (town.abandoned && !town.destroyed && town.abandonedDay) {
                const daysSinceAbandoned = world.day - town.abandonedDay;
                if (daysSinceAbandoned >= 360) {
                    town.destroyed = true;
                    town.category = 'destroyed';
                    logEvent(`🏚️ The ruins of ${town.name} have crumbled beyond recognition. The settlement is lost to history.`);
                    // Migrate ALL remaining people to nearest non-destroyed town
                    const nearbyTowns = world.towns.filter(t => t.id !== town.id && !t.destroyed && t.population > 10);
                    if (nearbyTowns.length > 0) {
                        const remainingPeople = world.people.filter(p => p.alive && p.townId === town.id);
                        for (const p of remainingPeople) {
                            const dest = nearbyTowns[world.rng.randInt(0, nearbyTowns.length - 1)];
                            p.townId = dest.id;
                            p.kingdomId = dest.kingdomId;
                            dest.population++;
                        }
                    }
                    // Force population to 0
                    town.population = 0;
                    // Remove roads to this town
                    for (const road of world.roads) {
                        if (road.fromTownId === town.id || road.toTownId === town.id) {
                            road.condition = 'destroyed';
                            road._destroyedByAbandonment = true;
                        }
                    }
                    // Clear market
                    for (const key in town.market.supply) {
                        town.market.supply[key] = 0;
                    }
                }
            }

            // Town revitalization — requires deliberate investment (kingdom, elite merchant, or player)
            // Abandoned (but not destroyed) towns can be resettled if revitalization is triggered
            if (town.abandoned && !town.destroyed && town._revitalizing) {
                town._revitalizeProgress = (town._revitalizeProgress || 0) + 1;
                // Takes 90 days of active investment to revitalize
                if (town._revitalizeProgress >= 90) {
                    town.abandoned = false;
                    town.abandonedDay = null;
                    town._revitalizing = false;
                    town._revitalizeProgress = 0;
                    town.category = 'village';
                    town.maxBuildingSlots = CONFIG.TOWN_CATEGORIES['village'].maxBuildingSlots;
                    // Spawn settlers using same pattern as birth system
                    const occupations = ['farmer','farmer','farmer','laborer','laborer','craftsman','merchant'];
                    const firstNames_m = ['Aldric','Rowan','Cedric','Edmund','Gareth','Hadrian','Leoric','Theron','Victor','Owen'];
                    const firstNames_f = ['Mira','Elara','Helena','Willa','Astrid','Brigid','Celeste','Keira','Isolde','Lyra'];
                    const lastNames = ['Settler','Ashford','Thornbury','Moorfield','Ironwood','Langley','Whitfield'];
                    let settlerCount = 0;
                    for (let s = 0; s < 25; s++) {
                        const sex = world.rng.random() < 0.5 ? 'M' : 'F';
                        const names = sex === 'M' ? firstNames_m : firstNames_f;
                        const settler = {
                            id: 'p_' + (world.people.length + s + 1),
                            firstName: names[world.rng.randInt(0, names.length - 1)],
                            lastName: lastNames[world.rng.randInt(0, lastNames.length - 1)],
                            age: world.rng.randInt(18, 40),
                            sex: sex,
                            alive: true,
                            townId: town.id,
                            kingdomId: town.kingdomId,
                            occupation: occupations[world.rng.randInt(0, occupations.length - 1)],
                            employerId: null,
                            needs: { food: 80, shelter: 50, safety: 50, wealth: 30, happiness: 60 },
                            gold: world.rng.randInt(10, 50),
                            wealthClass: 'lower',
                            skills: { farming: world.rng.randInt(0, 30), mining: world.rng.randInt(0, 10), crafting: world.rng.randInt(0, 20), trading: world.rng.randInt(0, 15), combat: world.rng.randInt(0, 10) },
                            workerSkill: world.rng.randInt(5, 30),
                            spouseId: null,
                            childrenIds: [],
                            parentIds: [],
                            personality: {
                                loyalty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                                ambition: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                                frugality: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                                intelligence: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                                warmth: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                                honesty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                            },
                            quirks: assignRandomQuirks(world.rng),
                            foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                            recentFoods: [],
                        };
                        world.people.push(settler);
                        if (typeof registerPerson === 'function') registerPerson(settler);
                        settlerCount++;
                    }
                    town.population = settlerCount;
                    // Restore basic buildings
                    town.buildings = [];
                    const basics = ['wheat_farm', 'bakery', 'market_stall'];
                    for (const bt of basics) {
                        town.buildings.push({ type: bt, id: 'bld_' + world.rng.randInt(10000,99999), ownerId: null, condition: 'new', builtDay: world.day, workers: [] });
                    }
                    // Restore basic market supply
                    town.market.supply.wheat = 300;
                    town.market.supply.bread = 100;
                    logEvent(`🏘️ ${town.name} has been revitalized! ${settlerCount} brave settlers establish a new community in the ruins.`);
                }
            }

            // Kingdom-driven revitalization — kingdoms may invest in abandoned towns
            if (town.abandoned && !town.destroyed && !town._revitalizing) {
                const kingdom = findKingdom(town.kingdomId);
                // 3% daily base, higher for capitals and wealthy kingdoms
                var revitalChance = 0.03;
                if (kingdom && kingdom.capitalTownId === town.id) revitalChance = 0.15;
                if (kingdom && kingdom.gold > 5000) revitalChance += 0.02;
                if (kingdom && kingdom.gold > 500 && world.rng.random() < revitalChance) {
                    town._revitalizing = true;
                    town._revitalizeProgress = 0;
                    town._revitalizedBy = 'kingdom';
                    kingdom.gold -= Math.min(1000, Math.floor(kingdom.gold * 0.05));
                    logEvent(`👑 The crown of ${kingdom.name} has ordered the resettlement of ${town.name}!`);
                }
            }
        }
    }

    // ========================================================
    // §15B-2 WILDERNESS OUTPOST SYSTEM
    // ========================================================

    /**
     * Found a new wilderness outpost.
     * @param {object} opts - { founderId, founderType ('player'|'elite'|'npc'), x, y, name, kingdomId, nearRoadId }
     * @returns {{ success: boolean, message: string, outpost?: object }}
     */
    function foundOutpost(opts) {
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (!opts || !opts.founderId || !opts.name) return { success: false, message: 'Invalid outpost parameters.' };

        // Determine nearest kingdom for jurisdiction
        var kingdomId = opts.kingdomId;
        if (!kingdomId) {
            // Find nearest town's kingdom
            var nearest = null, nearDist = Infinity;
            for (var ti = 0; ti < world.towns.length; ti++) {
                var t = world.towns[ti];
                if (t.abandoned || t.destroyed) continue;
                var dx = (opts.x || 0) - t.x;
                var dy = (opts.y || 0) - t.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d < nearDist) { nearDist = d; nearest = t; }
            }
            if (nearest) kingdomId = nearest.kingdomId;
        }

        var outpost = {
            id: uid('town'),
            name: opts.name,
            x: opts.x || 0,
            y: opts.y || 0,
            kingdomId: kingdomId,
            isCapital: false,
            population: 0,
            buildings: [],
            market: createMarket(1, 'village'),
            prosperity: 10,
            walls: 0,
            garrison: 0,
            happiness: 50,
            isPort: false,
            isIsland: false,
            towers: 0,
            livestock: { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 },
            category: 'outpost',
            maxBuildingSlots: CONFIG.TOWN_CATEGORIES.outpost.maxBuildingSlots,
            // Outpost-specific fields
            isOutpost: true,
            founderId: opts.founderId,
            founderType: opts.founderType || 'player',
            foundedDay: world.day,
            hiredWorkers: 0,
            hiredGuards: 0,
            maintenancePaid: true,
            lastMaintenanceDay: world.day,
            totalInvested: cfg.foundingCost,
            annexed: false,
        };

        // Start with a basic storage shed
        outpost.buildings.push({
            type: 'warehouse',
            id: 'bld_' + world.rng.randInt(10000, 99999),
            ownerId: opts.founderId,
            condition: 'new',
            builtDay: world.day,
            workers: [],
            level: 1,
        });

        world.towns.push(outpost);

        // Create a basic road to nearest town
        var nearestTown = null;
        var nearestDist = Infinity;
        for (var ti2 = 0; ti2 < world.towns.length; ti2++) {
            var t2 = world.towns[ti2];
            if (t2.id === outpost.id || t2.abandoned || t2.destroyed || t2.category === 'outpost') continue;
            var dx2 = outpost.x - t2.x;
            var dy2 = outpost.y - t2.y;
            var d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (d2 < nearestDist) { nearestDist = d2; nearestTown = t2; }
        }
        if (nearestTown) {
            world.roads.push({
                fromTownId: nearestTown.id,
                toTownId: outpost.id,
                quality: 1,
                safe: true,
                hasBridge: false,
                bridgeDestroyed: false,
                bridgeSegments: [],
                condition: 'new',
                builtDay: world.day,
                lastRepairDay: 0,
                banditThreat: 15,
                isDirtTrack: true,
            });
        }

        logEvent('⛺ A new outpost "' + outpost.name + '" has been established in the wilderness by ' +
            (opts.founderType === 'player' ? 'you' : 'an enterprising merchant') + '!');

        return { success: true, message: 'Outpost "' + outpost.name + '" established!', outpost: outpost };
    }

    /**
     * Daily tick for all outposts — maintenance, theft, damage, worker upkeep.
     */
    function tickOutposts() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        var rng = world.rng;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed) continue;

            // ── Maintenance costs (deducted from founder) ──
            var dailyCost = cfg.dailyMaintenanceCost +
                (outpost.hiredWorkers || 0) * cfg.workerWagePerDay +
                (outpost.hiredGuards || 0) * cfg.guardCostPerDay;

            var founder = null;
            if (outpost.founderType === 'player') {
                // Player outpost — costs handled in player.js tick
                // Just track that maintenance is due
                outpost._dailyMaintenanceDue = dailyCost;
            } else {
                // NPC/Elite merchant outpost
                founder = findPerson(outpost.founderId);
                if (founder && founder.alive) {
                    if ((founder.gold || 0) >= dailyCost) {
                        founder.gold -= dailyCost;
                        outpost.maintenancePaid = true;
                        outpost.lastMaintenanceDay = world.day;
                    } else {
                        outpost.maintenancePaid = false;
                    }
                } else {
                    outpost.maintenancePaid = false;
                }
            }

            // ── Abandonment from no maintenance ──
            if (!outpost.maintenancePaid && outpost.founderType !== 'player') {
                var daysSinceUpkeep = world.day - (outpost.lastMaintenanceDay || outpost.foundedDay);
                if (daysSinceUpkeep >= cfg.abandonDaysNoMaintenance) {
                    outpost.abandoned = true;
                    outpost.abandonedDay = world.day;
                    logEvent('💀 The outpost "' + outpost.name + '" has been abandoned due to lack of maintenance.');
                    continue;
                }
            }

            // ── Theft risk ──
            var theftChance = cfg.theftChancePerDay;
            // Guards reduce theft
            theftChance -= (outpost.hiredGuards || 0) * cfg.securityPerGuard;
            // Walls reduce theft
            theftChance -= (cfg.wallTheftReduction[outpost.walls] || 0);
            theftChance = Math.max(theftChance, 0.005);

            if (rng.chance(theftChance)) {
                // Steal from outpost market/warehouse
                var stolenValue = 0;
                var stolenItems = [];
                var supplyKeys = Object.keys(outpost.market.supply).filter(function(k) {
                    return (outpost.market.supply[k] || 0) > 0;
                });
                if (supplyKeys.length > 0) {
                    var stolenKey = supplyKeys[rng.randInt(0, supplyKeys.length - 1)];
                    var maxSteal = Math.min(outpost.market.supply[stolenKey], rng.randInt(5, 20));
                    if (maxSteal > 0) {
                        outpost.market.supply[stolenKey] -= maxSteal;
                        var res = findResourceById(stolenKey);
                        stolenValue = maxSteal * (res ? res.basePrice : 1);
                        stolenItems.push(maxSteal + ' ' + stolenKey);
                    }
                }
                if (stolenItems.length > 0) {
                    logEvent('🦹 Thieves raided outpost "' + outpost.name + '" and stole ' + stolenItems.join(', ') +
                        ' (worth ~' + Math.floor(stolenValue) + 'g)!');
                }
            }

            // ── Building damage risk (weather, animals, wear) ──
            var dmgChance = cfg.damageChancePerDay;
            dmgChance -= (outpost.walls > 0 ? 0.01 : 0);
            dmgChance = Math.max(dmgChance, 0.005);

            if (rng.chance(dmgChance) && outpost.buildings.length > 0) {
                var bIdx = rng.randInt(0, outpost.buildings.length - 1);
                var bld = outpost.buildings[bIdx];
                if (bld.condition === 'new') {
                    bld.condition = 'used';
                    logEvent('⚠️ A building at outpost "' + outpost.name + '" suffered weather damage.');
                } else if (bld.condition === 'used') {
                    bld.condition = 'breaking';
                    logEvent('⚠️ A building at outpost "' + outpost.name + '" is breaking down!');
                }
            }

            // ── Small prosperity growth if maintained ──
            if (outpost.maintenancePaid || outpost.founderType === 'player') {
                outpost.prosperity = Math.min(100, (outpost.prosperity || 10) + 0.1);
                // Attract settlers slowly (1% daily chance if prosperity > 30)
                if (outpost.prosperity > 30 && rng.chance(0.01)) {
                    outpost.population = (outpost.population || 0) + 1;
                }
            }
        }
    }

    /**
     * Kingdom annexation of outposts — kingdoms absorb successful outposts into villages.
     */
    function tickOutpostAnnexation() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        if (world.day % cfg.annexationCheckInterval !== 0) return;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var outpost = world.towns[ti];
            if (!outpost.isOutpost || outpost.abandoned || outpost.destroyed || outpost.annexed) continue;

            var kingdom = findKingdom(outpost.kingdomId);
            if (!kingdom) continue;

            // Annexation requires the outpost to be established and have some population
            var daysSinceFounded = world.day - (outpost.foundedDay || 0);
            if (daysSinceFounded < 180) continue; // Must exist for 6 months minimum
            if ((outpost.population || 0) < cfg.annexationMinPop) continue;

            // King personality affects approach
            var willAnnex = false;
            var annexMethod = 'negotiate';

            var kp = kingdom.kingPersonality;
            if (kingdom.king && kp) {
                if (kp.ambition === 'ambitious') {
                    willAnnex = world.rng.chance(0.40);
                    if (kp.temperament === 'cruel') {
                        annexMethod = 'seize';
                    } else if (kp.greed === 'greedy' || kp.greed === 'corrupt') {
                        annexMethod = 'tax_heavily';
                    } else {
                        annexMethod = 'negotiate';
                    }
                } else {
                    willAnnex = world.rng.chance(0.15);
                    annexMethod = 'negotiate';
                }
            } else {
                willAnnex = world.rng.chance(0.20);
            }

            if (!willAnnex) continue;

            // Perform annexation
            outpost.annexed = true;
            outpost.isOutpost = false;
            outpost.category = 'village';
            outpost.maxBuildingSlots = CONFIG.TOWN_CATEGORIES.village.maxBuildingSlots;
            outpost.garrison = world.rng.randInt(2, 5);

            // Add to kingdom territories
            if (kingdom.territories) {
                if (kingdom.territories instanceof Set) {
                    kingdom.territories.add(outpost.id);
                } else if (Array.isArray(kingdom.territories)) {
                    kingdom.territories.push(outpost.id);
                }
            }

            // Compensation depends on method
            var founder = findPerson(outpost.founderId);
            var compensationMsg = '';

            if (annexMethod === 'negotiate') {
                // Fair compensation: 150% of invested gold
                var compensation = Math.floor((outpost.totalInvested || 500) * 1.5);
                if (founder && founder.alive) {
                    founder.gold = (founder.gold || 0) + compensation;
                    compensationMsg = ' The founder received ' + compensation + 'g in compensation.';
                }
                logEvent('👑 The kingdom of ' + kingdom.name + ' has annexed outpost "' + outpost.name +
                    '" as a new village through peaceful negotiation.' + compensationMsg);
            } else if (annexMethod === 'seize') {
                // No compensation — king just takes it
                logEvent('⚔️ The kingdom of ' + kingdom.name + ' has seized outpost "' + outpost.name +
                    '" by royal decree! The founder receives nothing.');
            } else if (annexMethod === 'tax_heavily') {
                // Partial compensation but heavy ongoing tax
                var partialComp = Math.floor((outpost.totalInvested || 500) * 0.5);
                if (founder && founder.alive) {
                    founder.gold = (founder.gold || 0) + partialComp;
                    compensationMsg = ' The founder received only ' + partialComp + 'g.';
                }
                logEvent('💰 The kingdom of ' + kingdom.name + ' has absorbed outpost "' + outpost.name +
                    '" and imposed heavy taxes on its trade.' + compensationMsg);
            }

            // Spawn some villagers to populate the new village
            var settlersNeeded = Math.max(0, 25 - (outpost.population || 0));
            var firstNames_m = ['Aldric','Rowan','Cedric','Edmund','Gareth','Theron','Victor','Owen','Jasper','Hugo'];
            var firstNames_f = ['Mira','Elara','Helena','Willa','Astrid','Brigid','Keira','Isolde','Lyra','Faye'];
            var lastNames = ['Settler','Ashford','Thornbury','Moorfield','Ironwood','Langley','Whitfield','Greenhill'];
            var occupations = ['farmer','farmer','laborer','laborer','craftsman','merchant','miner'];

            for (var s = 0; s < settlersNeeded; s++) {
                var sex = world.rng.random() < 0.5 ? 'M' : 'F';
                var names = sex === 'M' ? firstNames_m : firstNames_f;
                var settler = {
                    id: uid('person'),
                    firstName: names[world.rng.randInt(0, names.length - 1)],
                    lastName: lastNames[world.rng.randInt(0, lastNames.length - 1)],
                    age: world.rng.randInt(18, 40),
                    sex: sex,
                    alive: true,
                    townId: outpost.id,
                    kingdomId: outpost.kingdomId,
                    occupation: occupations[world.rng.randInt(0, occupations.length - 1)],
                    employerId: null,
                    needs: { food: 80, shelter: 50, safety: 50, wealth: 30, happiness: 60 },
                    gold: world.rng.randInt(10, 50),
                    wealthClass: 'lower',
                    skills: { farming: world.rng.randInt(0, 30), mining: world.rng.randInt(0, 10), crafting: world.rng.randInt(0, 20), trading: world.rng.randInt(0, 15), combat: world.rng.randInt(0, 10) },
                    workerSkill: world.rng.randInt(5, 30),
                    spouseId: null, childrenIds: [], parentIds: [],
                    personality: {
                        loyalty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        ambition: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        frugality: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        intelligence: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        warmth: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                        honesty: Math.floor((world.rng.random()+world.rng.random()+world.rng.random())/3*100),
                    },
                    quirks: assignRandomQuirks(world.rng),
                    foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
                    recentFoods: [],
                };
                world.people.push(settler);
                if (typeof registerPerson === 'function') registerPerson(settler);
            }
            outpost.population = Math.max(outpost.population || 0, 25);

            // Add basic village buildings if missing
            var hasMarket = outpost.buildings.some(function(b) { return b.type === 'market_stall'; });
            if (!hasMarket) {
                outpost.buildings.push({ type: 'market_stall', id: 'bld_' + world.rng.randInt(10000, 99999), ownerId: null, condition: 'new', builtDay: world.day, workers: [] });
            }
            var hasFarm = outpost.buildings.some(function(b) { return b.type === 'wheat_farm'; });
            if (!hasFarm) {
                outpost.buildings.push({ type: 'wheat_farm', id: 'bld_' + world.rng.randInt(10000, 99999), ownerId: null, condition: 'new', builtDay: world.day, workers: [] });
            }
            // Give the new village basic market supply
            outpost.market.supply.wheat = Math.max(outpost.market.supply.wheat || 0, 200);
            outpost.market.supply.bread = Math.max(outpost.market.supply.bread || 0, 80);
            outpost.market.supply.water = Math.max(outpost.market.supply.water || 0, 100);

            // Build a road connecting the new village to nearest kingdom town
            var nearestKingdomTown = null;
            var nearestDist = Infinity;
            var kTerritories = kingdom.territories instanceof Set ? kingdom.territories : new Set(kingdom.territories || []);
            for (var ti = 0; ti < world.towns.length; ti++) {
                var candidate = world.towns[ti];
                if (candidate.id === outpost.id || candidate.destroyed || candidate.abandoned) continue;
                if (!kTerritories.has(candidate.id)) continue;
                var dx = (candidate.x || 0) - (outpost.x || 0);
                var dy = (candidate.y || 0) - (outpost.y || 0);
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestKingdomTown = candidate;
                }
            }
            if (nearestKingdomTown && nearestDist < 3000) {
                buildNewRoad(outpost.id, nearestKingdomTown.id, kingdom.id);
            }
        }
    }

    /**
     * Elite merchants may found outposts in the wilderness.
     */
    function tickEliteMerchantOutposts() {
        var cfg = CONFIG.OUTPOST_CONFIG;
        var rng = world.rng;

        for (var pi = 0; pi < world.people.length; pi++) {
            var em = world.people[pi];
            if (!em.alive || !em.isEliteMerchant) continue;
            if ((em.gold || 0) < cfg.foundingCost * 2) continue; // Need 2x cost (buffer for maintenance)

            // Already owns an outpost? Skip
            var ownsOutpost = world.towns.some(function(t) { return t.isOutpost && t.founderId === em.id && !t.abandoned; });
            if (ownsOutpost) continue;

            if (!rng.chance(cfg.eliteMerchantFoundChance)) continue;

            // Find a position near the merchant's town
            var emTown = findTown(em.townId);
            if (!emTown) continue;

            var outpostX = emTown.x + rng.randInt(-80, 80);
            var outpostY = emTown.y + rng.randInt(-80, 80);

            // Outpost names — ensure unique name
            var prefixes = ['New', 'Fort', 'Camp', 'Post', 'Watch', 'Trade', 'Old', 'North', 'South', 'East', 'West', 'Upper', 'Lower'];
            var suffixes = ['Haven', 'Point', 'Rest', 'Crossing', 'Ridge', 'Creek', 'Field', 'Gate', 'Hill', 'Hollow', 'Ford', 'Landing', 'Bend', 'Bluff', 'Pass'];
            var existingNames = {};
            world.towns.forEach(function(tt) { existingNames[tt.name] = true; });
            if (world.outposts) world.outposts.forEach(function(oo) { existingNames[oo.name] = true; });
            var outpostName;
            var nameAttempts = 0;
            do {
                outpostName = prefixes[rng.randInt(0, prefixes.length - 1)] + ' ' +
                    suffixes[rng.randInt(0, suffixes.length - 1)];
                nameAttempts++;
            } while (existingNames[outpostName] && nameAttempts < 50);
            if (existingNames[outpostName]) {
                outpostName = outpostName + ' ' + (world.day || 0);
            }

            em.gold -= cfg.foundingCost;
            var result = foundOutpost({
                founderId: em.id,
                founderType: 'elite',
                x: outpostX,
                y: outpostY,
                name: outpostName,
                kingdomId: emTown.kingdomId,
            });

            if (result.success && result.outpost) {
                result.outpost.hiredWorkers = rng.randInt(1, 3);
                result.outpost.hiredGuards = rng.randInt(0, 1);
            }
        }
    }

    // ========================================================
    // §15C NAVAL WARFARE
    // ========================================================
    function tickNavalWarfare() {
        const rng = world.rng;
        for (const k of world.kingdoms) {
            if (!k.navalFleet) k.navalFleet = [];
            if (k.atWar.size === 0) continue;

            // Build warships at port towns if at war and can afford
            if (rng.chance(0.05)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town || !town.isPort) continue;
                    const hasDock = town.buildings.some(b => b.type === 'dock');
                    if (!hasDock) continue;

                    // Build the best warship the kingdom can afford
                    const types = Object.entries(CONFIG.WARSHIP_TYPES).sort((a, b) => b[1].cost - a[1].cost);
                    for (const [typeId, config] of types) {
                        if (k.gold < config.cost) continue;
                        let hasMats = true;
                        for (const [matId, qty] of Object.entries(config.materials || {})) {
                            if ((town.market.supply[matId] || 0) < qty) { hasMats = false; break; }
                        }
                        if (hasMats) {
                            for (const [matId, qty] of Object.entries(config.materials || {})) {
                                town.market.supply[matId] -= qty;
                            }
                            k.gold -= config.cost;
                            k.navalFleet.push({
                                id: uid('warship'),
                                type: typeId,
                                name: config.name,
                                stationedAt: town.id,
                                soldiers: config.soldiers,
                                attack: config.attack,
                                defense: config.defense,
                                speed: config.speed,
                                mission: null, // 'blockade' | 'patrol' | 'attack' | null
                                targetTownId: null,
                            });
                            logEvent(`${k.name} has built a ${config.name} at ${town.name}!`, {
                                type: 'kingdom_construction',
                                townId: town.id,
                                cause: 'The ruler invested in ' + k.name + '\'s naval capabilities.',
                                effects: [
                                    'New ' + config.name + ' strengthens the kingdom\'s navy',
                                    'Kingdom treasury spent ' + config.cost + 'g',
                                    'Naval defense and offense improved'
                                ]
                            });
                            break;
                        }
                    }
                    break; // Only build one per tick
                }
            }

            // Assign missions to idle warships
            for (const ship of k.navalFleet) {
                if (ship.mission) continue;
                // Find enemy port towns
                const enemyPorts = world.towns.filter(t =>
                    k.atWar.has(t.kingdomId) && t.isPort
                );
                if (enemyPorts.length > 0 && rng.chance(0.3)) {
                    const target = rng.pick(enemyPorts);
                    var missionPool = ['blockade', 'patrol', 'attack_ship'];
                    // Siege ships can bombard towns
                    var wsCfg = CONFIG.WARSHIP_TYPES[ship.type];
                    if (wsCfg && wsCfg.canBombard) missionPool.push('bombard_town');
                    // Large ships can transport troops
                    if (ship.soldiers >= 40) missionPool.push('troop_transport');
                    ship.mission = rng.pick(missionPool);
                    ship.targetTownId = target.id;
                }
            }

            // Process blockades — mark port towns as blockaded
            for (const ship of k.navalFleet) {
                if (ship.mission === 'blockade' && ship.targetTownId) {
                    const targetTown = findTown(ship.targetTownId);
                    if (targetTown) {
                        targetTown._blockadedBy = targetTown._blockadedBy || [];
                        if (!targetTown._blockadedBy.includes(k.id)) {
                            targetTown._blockadedBy.push(k.id);
                        }
                    }
                }

                // Ship-to-ship combat: attack enemy warships at target
                if (ship.mission === 'attack_ship' && ship.targetTownId) {
                    var targetTown2 = findTown(ship.targetTownId);
                    if (!targetTown2) continue;
                    var targetKingdom = findKingdom(targetTown2.kingdomId);
                    if (!targetKingdom || !targetKingdom.navalFleet) continue;
                    // Find enemy ship stationed at same town
                    var enemyShip = targetKingdom.navalFleet.find(function(es) {
                        return es.stationedAt === ship.targetTownId;
                    });
                    if (enemyShip && rng.chance(0.15)) {
                        var atkRoll = (ship.attack || 10) + rng.randInt(0, 10);
                        var defRoll = (enemyShip.defense || 5) + rng.randInt(0, 10);
                        if (atkRoll > defRoll) {
                            // Enemy ship destroyed
                            targetKingdom.navalFleet = targetKingdom.navalFleet.filter(function(s) { return s.id !== enemyShip.id; });
                            logEvent(k.name + '\'s ' + ship.name + ' sank ' + targetKingdom.name + '\'s ' + enemyShip.name + ' at ' + targetTown2.name + '!', {
                                type: 'naval_combat', townId: targetTown2.id
                            });
                        } else {
                            // Attacker damaged/destroyed
                            if (rng.chance(0.4)) {
                                k.navalFleet = k.navalFleet.filter(function(s) { return s.id !== ship.id; });
                                logEvent(targetKingdom.name + '\'s ' + enemyShip.name + ' sank ' + k.name + '\'s ' + ship.name + '!', {
                                    type: 'naval_combat', townId: targetTown2.id
                                });
                            }
                        }
                    }
                }

                // Town bombardment: siege ships damage port town buildings/garrison
                if (ship.mission === 'bombard_town' && ship.targetTownId) {
                    var bombTarget = findTown(ship.targetTownId);
                    if (bombTarget && rng.chance(0.10)) {
                        var cannonDmg = CONFIG.WARSHIP_TYPES[ship.type] ? CONFIG.WARSHIP_TYPES[ship.type].cannons : 4;
                        // Damage garrison
                        if (bombTarget.garrison > 0) {
                            var garrisonLoss = Math.min(bombTarget.garrison, Math.floor(cannonDmg * 2));
                            bombTarget.garrison -= garrisonLoss;
                        }
                        // Chance to destroy a building
                        if (rng.chance(0.20) && bombTarget.buildings.length > 0) {
                            var bldIdx = rng.randInt(0, bombTarget.buildings.length - 1);
                            var destroyedBld = bombTarget.buildings[bldIdx];
                            destroyedBld.condition = 'destroyed';
                            logEvent(k.name + '\'s ' + ship.name + ' bombarded ' + bombTarget.name + '! A ' + destroyedBld.type + ' was destroyed.', {
                                type: 'naval_bombardment', townId: bombTarget.id
                            });
                        } else {
                            logEvent(k.name + '\'s ' + ship.name + ' bombarded ' + bombTarget.name + '!', {
                                type: 'naval_bombardment', townId: bombTarget.id
                            });
                        }
                        // Reduce happiness/prosperity
                        bombTarget.happiness = Math.max(0, (bombTarget.happiness || 50) - 3);
                        bombTarget.prosperity = Math.max(0, (bombTarget.prosperity || 50) - 2);
                    }
                }

                // Troop transport: land soldiers at enemy port town
                if (ship.mission === 'troop_transport' && ship.targetTownId) {
                    var landTarget = findTown(ship.targetTownId);
                    if (landTarget && rng.chance(0.08)) {
                        var troopsLanded = Math.floor(ship.soldiers * 0.8);
                        // Add to garrison of the target (invasion force)
                        // This simulates an amphibious assault — troops fight garrison
                        var defenderGarrison = landTarget.garrison || 0;
                        if (troopsLanded > defenderGarrison) {
                            logEvent(k.name + ' landed ' + troopsLanded + ' soldiers at ' + landTarget.name + ' and overwhelmed the garrison!', {
                                type: 'amphibious_assault', townId: landTarget.id
                            });
                            landTarget.garrison = Math.floor(troopsLanded * 0.3);
                            // Transfer town if enough force
                            if (troopsLanded > defenderGarrison * 1.5) {
                                transferTown(landTarget.id, landTarget.kingdomId, k.id, 'naval_invasion');
                            }
                        } else {
                            logEvent(k.name + ' attempted a naval invasion of ' + landTarget.name + ' but was repelled!', {
                                type: 'amphibious_assault', townId: landTarget.id
                            });
                            landTarget.garrison = Math.max(0, defenderGarrison - Math.floor(troopsLanded * 0.5));
                        }
                        // Remove ship after troop deployment
                        ship.mission = null;
                        ship.soldiers = Math.floor(ship.soldiers * 0.2); // Remaining crew
                    }
                }
            }
        }

        // Clear expired blockades (if fleet destroyed or peace)
        for (const town of world.towns) {
            if (town._blockadedBy && town._blockadedBy.length > 0) {
                town._blockadedBy = town._blockadedBy.filter(kId => {
                    const blocker = findKingdom(kId);
                    if (!blocker) return false;
                    // Still at war with town's kingdom?
                    if (!blocker.atWar.has(town.kingdomId)) return false;
                    // Still has ships blockading?
                    return (blocker.navalFleet || []).some(s =>
                        s.mission === 'blockade' && s.targetTownId === town.id
                    );
                });
            }
        }
    }

    function isPortBlockaded(townId) {
        const town = findTown(townId);
        return town && town._blockadedBy && town._blockadedBy.length > 0;
    }

    function getNavalThreat(seaRouteFromTownId, seaRouteToTownId) {
        // Check if any warship on patrol/attack mission threatens this route
        let threat = 0;
        const from = findTown(seaRouteFromTownId);
        const to = findTown(seaRouteToTownId);
        if (!from || !to) return 0;

        // Check if either port is blockaded
        if (isPortBlockaded(from.id)) threat += 50;
        if (isPortBlockaded(to.id)) threat += 50;

        // Check for patrolling warships near the route
        for (const k of world.kingdoms) {
            if (!k.navalFleet) continue;
            for (const ship of k.navalFleet) {
                if (ship.mission !== 'patrol') continue;
                const shipTown = findTown(ship.stationedAt);
                if (!shipTown) continue;
                const distToFrom = Math.hypot(shipTown.x - from.x, shipTown.y - from.y);
                const distToTo = Math.hypot(shipTown.x - to.x, shipTown.y - to.y);
                if (distToFrom < 2000 || distToTo < 2000) {
                    // Check if this kingdom is at war with towns' kingdoms
                    if (k.atWar.has(from.kingdomId) || k.atWar.has(to.kingdomId)) {
                        threat += 25;
                    }
                }
            }
        }
        return Math.min(100, threat);
    }

    // ========================================================
    // §16 RANDOM EVENTS TICK
    // ========================================================
    function tickEvents() {
        const rng = world.rng;
        const day = world.day;

        // Advance existing events
        for (let i = world.events.length - 1; i >= 0; i--) {
            const ev = world.events[i];
            if (!ev.active) continue;
            ev.daysRemaining--;
            if (ev.daysRemaining <= 0) {
                ev.active = false;
                logEvent(`${ev.name} event has ended.`);
                continue;
            }
            // Ongoing effects
            applyOngoingEvent(ev);
        }

        // Prune old inactive events (keep last 90 days)
        world.events = world.events.filter(ev => ev.active || (day - ev.startDay) < 90);

        // Roll for new events
        for (const key in EVENT_TYPES) {
            const et = EVENT_TYPES[key];
            if (!rng.chance(et.chance)) continue;

            // Naval events only target port towns
            let town;
            if (et.id === 'pirates' || et.id === 'naval_raid' || et.id === 'naval_blockade') {
                const portTowns = world.towns.filter(t => t.isPort);
                if (portTowns.length === 0) continue;
                town = rng.pick(portTowns);
            } else if (et.id === 'storm_season') {
                town = rng.pick(world.towns); // storm_season ignores townId anyway
            } else {
                town = rng.pick(world.towns);
            }

            const event = createEvent(et, town, day);
            if (event) {
                world.events.push(event);
                if (event.active) {
                    logEvent(`EVENT: ${event.name} strikes ${town.name}!`);
                }
            }
        }
    }

    function createEvent(et, town, day) {
        const rng = world.rng;
        const base = {
            id: uid('ev'),
            type: et.id,
            name: et.name,
            townId: town.id,
            startDay: day,
            active: true,
        };

        switch (et.id) {
            case 'plague':
                return { ...base, daysRemaining: 30, killRate: rng.randFloat(0.05, 0.15) / 30 };
            case 'drought':
                return { ...base, daysRemaining: 60 };
            case 'bandit_surge':
                return { ...base, daysRemaining: 30 };
            case 'bountiful':
                return { ...base, daysRemaining: CONFIG.DAYS_PER_SEASON };
            case 'trade_festival':
                return { ...base, daysRemaining: 15 };
            case 'mine_discovery': {
                // Add a mine building to the town
                const mineType = rng.chance(0.3) ? 'gold_mine' : 'iron_mine';
                town.buildings.push({ type: mineType, level: 1, ownerId: null });
                logEvent(`A new mineral vein discovered near ${town.name}!`);
                return { ...base, daysRemaining: 1, active: false };
            }
            case 'royal_wedding': {
                // Improve relations between two random kingdoms
                if (world.kingdoms.length < 2) return null;
                const kA = rng.pick(world.kingdoms);
                let kB = rng.pick(world.kingdoms);
                let attempts = 0;
                while (kB.id === kA.id && attempts < 10) { kB = rng.pick(world.kingdoms); attempts++; }
                if (kA.id === kB.id) return null;
                const boost = rng.randInt(20, 30);
                kA.relations[kB.id] = Math.min(100, (kA.relations[kB.id] || 0) + boost);
                kB.relations[kA.id] = Math.min(100, (kB.relations[kA.id] || 0) + boost);
                logEvent(`Royal wedding between houses of ${kA.name} and ${kB.name}! Relations soar.`);
                return { ...base, daysRemaining: 1, active: false };
            }
            case 'assassination': {
                const k = findKingdom(town.kingdomId);
                if (!k || !k.king) return null;
                const king = findPerson(k.king);
                if (!king || !king.alive) return null;
                if (rng.chance(0.5)) {
                    killPerson(king, 'assassination');
                    logEvent(`The king of ${k.name} has been assassinated!`);
                } else {
                    logEvent(`An assassination attempt on the king of ${k.name} failed!`);
                }
                return { ...base, daysRemaining: 1, active: false };
            }
            case 'flood':
                // Damage buildings
                if (town.buildings.length > 2) {
                    const damaged = rng.randInt(1, Math.min(3, town.buildings.length - 1));
                    for (let i = 0; i < damaged; i++) {
                        const bld = rng.pick(town.buildings);
                        bld.level = Math.max(1, bld.level - 1);
                    }
                }
                town.prosperity = Math.max(0, town.prosperity - rng.randInt(5, 15));
                return { ...base, daysRemaining: 15 };
            case 'religious':
                town.happiness = Math.min(100, town.happiness + rng.randInt(5, 15));
                return { ...base, daysRemaining: 20 };
            case 'pirates': {
                // Only affects port towns
                if (!town.isPort) return null;
                return { ...base, daysRemaining: rng.randInt(15, 30), seaRiskMultiplier: 3 };
            }
            case 'storm_season': {
                // Only triggers in winter, affects all sea routes
                if (getSeason(day) !== 'Winter') return null;
                return { ...base, townId: null, daysRemaining: CONFIG.DAYS_PER_SEASON, seaRiskMultiplier: 2 };
            }
            case 'naval_raid': {
                // Only port towns can be raided
                if (!town.isPort) return null;
                const attackK = world.kingdoms.find(k => k.id !== town.kingdomId && k.atWar.has(town.kingdomId));
                if (!attackK) {
                    // Random pirate raid instead
                    const raided = Math.min(town.garrison, rng.randInt(3, 8));
                    town.garrison = Math.max(0, town.garrison - raided);
                    town.prosperity = Math.max(0, town.prosperity - rng.randInt(5, 15));
                    // Steal some goods
                    const lootTypes = ['fish', 'salt', 'wheat', 'gold_ore'];
                    for (const lt of lootTypes) {
                        const stolen = Math.min(town.market.supply[lt] || 0, rng.randInt(5, 20));
                        town.market.supply[lt] = Math.max(0, (town.market.supply[lt] || 0) - stolen);
                    }
                    logEvent(`Pirates raided ${town.name}! The port suffered losses.`);
                    return { ...base, daysRemaining: 1, active: false };
                }
                // Kingdom naval attack
                const damage = rng.randInt(5, 15);
                town.garrison = Math.max(0, town.garrison - damage);
                town.prosperity = Math.max(0, town.prosperity - rng.randInt(10, 20));
                logEvent(`${attackK.name} launched a naval raid on ${town.name}!`);
                return { ...base, daysRemaining: 1, active: false };
            }
            case 'naval_blockade': {
                if (!town.isPort) return null;
                // Only during wars
                const blockadingK = world.kingdoms.find(k => k.id !== town.kingdomId && k.atWar.has(town.kingdomId));
                if (!blockadingK) return null;
                // Check blockading kingdom has a port
                const blockaderHasPort = world.towns.some(t => t.kingdomId === blockadingK.id && t.isPort);
                if (!blockaderHasPort) return null;
                logEvent(`${blockadingK.name} has blockaded the port of ${town.name}!`);
                return { ...base, daysRemaining: rng.randInt(20, 40), blockadedBy: blockadingK.id };
            }
            default:
                return { ...base, daysRemaining: 10 };
        }
    }

    function applyOngoingEvent(ev) {
        const rng = world.rng;
        const town = findTown(ev.townId);
        if (!town) return;

        switch (ev.type) {
            case 'plague': {
                // Kill some people each day
                const townPeople = world.people.filter(p => p.alive && p.townId === ev.townId);
                for (const p of townPeople) {
                    if (rng.chance(ev.killRate)) {
                        killPerson(p, 'plague');
                    }
                }
                town.happiness = Math.max(0, town.happiness - 1);
                break;
            }
            case 'bandit_surge': {
                // Roads near this town are unsafe (already handled by isRoadSafe)
                town.happiness = Math.max(0, town.happiness - 0.5);
                // Re-mark nearby roads
                for (const road of world.roads) {
                    if (road.fromTownId === ev.townId || road.toTownId === ev.townId) {
                        road.safe = false;
                    }
                }
                break;
            }
            case 'flood': {
                town.prosperity = Math.max(0, town.prosperity - 0.3);
                break;
            }
            case 'pirates': {
                // Increase risk on sea routes near this port town
                town.happiness = Math.max(0, town.happiness - 0.3);
                break;
            }
            case 'naval_blockade': {
                // Reduce trade — remove supply gradually
                if (town) {
                    for (const resId in town.market.supply) {
                        town.market.supply[resId] = Math.max(0,
                            Math.floor((town.market.supply[resId] || 0) * 0.98)
                        );
                    }
                    town.prosperity = Math.max(0, town.prosperity - 0.5);
                    town.happiness = Math.max(0, town.happiness - 0.3);
                }
                break;
            }
            case 'plague_disaster': {
                // Kill people each day based on severity
                const townPeople = world.people.filter(p => p.alive && p.townId === ev.townId);
                for (const p of townPeople) {
                    if (rng.chance(ev.killRate)) {
                        killPerson(p, 'plague');
                    }
                }
                town.happiness = Math.max(0, town.happiness - 1);
                break;
            }
            case 'blight': {
                // Farms produce nothing — handled by getEventProductionMod
                town.happiness = Math.max(0, town.happiness - 0.2);
                break;
            }
        }
    }

    // ========================================================
    // §17 LOOKUP HELPERS
    // ========================================================
    function findTown(id) {
        return world.towns.find(t => t.id === id) || null;
    }

    function findKingdom(id) {
        return world.kingdoms.find(k => k.id === id) || null;
    }

    function findPerson(id) {
        return world.people.find(p => p.id === id) || null;
    }

    // Build index maps for fast lookups after generation
    let townIndex = {};
    let kingdomIndex = {};
    let personIndex = {};

    function rebuildIndexes() {
        townIndex = {};
        kingdomIndex = {};
        personIndex = {};
        for (const t of world.towns) townIndex[t.id] = t;
        for (const k of world.kingdoms) kingdomIndex[k.id] = k;
        for (const p of world.people) personIndex[p.id] = p;

        // Override lookup helpers to use indexes
        findTown = function (id) { return townIndex[id] || null; };
        findKingdom = function (id) { return kingdomIndex[id] || null; };
        findPerson = function (id) { return personIndex[id] || null; };
    }

    // Keep person index updated for new births
    function registerPerson(p) {
        personIndex[p.id] = p;
    }

    // ========================================================
    // §17F  FRONTLINE TOWNS
    // ========================================================
    function getFrontlineTowns(war) {
        var frontline = new Set();
        if (!world || !war) return frontline;
        var sides = war.sides || [war.attackerId, war.defenderId];
        if (!sides || sides.length < 2) return frontline;
        var side0Towns = world.towns.filter(t => t.kingdomId === sides[0]);
        var side1Towns = world.towns.filter(t => t.kingdomId === sides[1]);
        for (var i = 0; i < side0Towns.length; i++) {
            for (var j = 0; j < side1Towns.length; j++) {
                var dist = Math.hypot((side0Towns[i].x || 0) - (side1Towns[j].x || 0), (side0Towns[i].y || 0) - (side1Towns[j].y || 0));
                if (dist < (CONFIG.WARTIME_FRONTLINE_DISTANCE || 500)) {
                    frontline.add(side0Towns[i].id);
                    frontline.add(side1Towns[j].id);
                }
            }
        }
        return frontline;
    }

    // ========================================================
    // §17G-A  PROACTIVE KING ECONOMIC GROWTH STRATEGIES
    // ========================================================

    /**
     * Analyze the economy of a kingdom: per-town production, surpluses,
     * deficits, population trends, and supply chain gaps.
     */
    function analyzeKingdomEconomy(kingdom) {
        if (!kingdom || !kingdom.territories) return null;
        const towns = [];
        let totalPop = 0, totalHappiness = 0, totalProsperity = 0;
        const kingdomSupply = {};   // aggregate supply across kingdom
        const kingdomDemand = {};   // estimated demand
        const buildingCounts = {};  // how many of each building type exist

        for (const townId of kingdom.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const pop = town.population || 0;
            totalPop += pop;
            totalHappiness += (town.happiness || 50);
            totalProsperity += (town.prosperity || 50);

            // Catalog buildings and production
            const produces = {};
            const consumes = {};
            const bldTypes = {};
            for (const bld of town.buildings) {
                bldTypes[bld.type] = (bldTypes[bld.type] || 0) + 1;
                buildingCounts[bld.type] = (buildingCounts[bld.type] || 0) + 1;
                const bt = findBuildingType(bld.type);
                if (!bt) continue;
                let ap = bt.produces, ac = bt.consumes, ar = bt.rate;
                if (bld.currentProduct && bt.availableProducts && bt.availableProducts[bld.currentProduct]) {
                    const r = bt.availableProducts[bld.currentProduct];
                    ap = r.produces; ac = r.consumes; ar = r.rate;
                } else if (bld.productionChoice && bt.availableProducts && bt.availableProducts[bld.productionChoice]) {
                    const r = bt.availableProducts[bld.productionChoice];
                    ap = r.produces; ac = r.consumes; ar = r.rate;
                }
                if (ap) produces[ap] = (produces[ap] || 0) + (ar || 1);
                if (ac) {
                    for (const [res, qty] of Object.entries(ac)) {
                        consumes[res] = (consumes[res] || 0) + qty;
                    }
                }
            }

            // Supply vs demand from market
            const surpluses = [];
            const deficits = [];
            for (const resId in town.market.supply) {
                const sup = town.market.supply[resId] || 0;
                kingdomSupply[resId] = (kingdomSupply[resId] || 0) + sup;
                if (sup > pop * 2) surpluses.push({ good: resId, amount: sup });
            }
            // Estimate demand: population food needs + building input consumption
            const foodDemand = Math.ceil(pop * 0.5);
            for (const foodId of ['bread', 'meat', 'wheat', 'fish', 'eggs']) {
                const dem = foodDemand;
                kingdomDemand[foodId] = (kingdomDemand[foodId] || 0) + dem;
                if ((town.market.supply[foodId] || 0) < dem * 0.5) {
                    deficits.push({ good: foodId, shortfall: dem - (town.market.supply[foodId] || 0) });
                }
            }
            for (const [res, qty] of Object.entries(consumes)) {
                kingdomDemand[res] = (kingdomDemand[res] || 0) + qty;
                if ((town.market.supply[res] || 0) < qty * 3) {
                    deficits.push({ good: res, shortfall: qty * 3 - (town.market.supply[res] || 0) });
                }
            }

            // Building slots available
            const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
            const slotsUsed = town.buildings.length;

            // Trade volume estimate
            let tradeVolume = 0;
            for (const resId in town.market.supply) {
                tradeVolume += (town.market.supply[resId] || 0);
            }

            towns.push({
                id: town.id,
                name: town.name,
                population: pop,
                happiness: town.happiness || 50,
                prosperity: town.prosperity || 50,
                buildings: bldTypes,
                produces: produces,
                consumes: consumes,
                surpluses: surpluses,
                deficits: deficits,
                slotsAvailable: maxSlots - slotsUsed,
                tradeVolume: tradeVolume,
                isPort: !!town.isPort,
                isCapital: !!town.isCapital,
            });
        }

        const numTowns = towns.length || 1;

        // Identify supply chain gaps: raw materials produced but no processor, or processor but no raw source
        const supplyChainGaps = [];
        for (const key in BUILDING_TYPES) {
            const bt = BUILDING_TYPES[key];
            if (!bt.produces || !bt.consumes) continue;
            for (const inputRes of Object.keys(bt.consumes)) {
                // Is input produced somewhere in kingdom?
                const inputProduced = towns.some(t => t.produces[inputRes] > 0);
                // Is processor present?
                const processorPresent = (buildingCounts[bt.id] || 0) > 0;
                if (inputProduced && !processorPresent) {
                    supplyChainGaps.push({ type: 'missing_processor', building: bt.id, input: inputRes, output: bt.produces });
                }
                if (processorPresent && !inputProduced && !(kingdomSupply[inputRes] > 0)) {
                    supplyChainGaps.push({ type: 'missing_source', building: bt.id, input: inputRes, output: bt.produces });
                }
            }
        }

        // Find single-industry towns (diversification concerns)
        const monoTowns = towns.filter(t => {
            const prodTypes = Object.keys(t.produces);
            return prodTypes.length <= 1 && t.population > 30;
        });

        return {
            towns: towns,
            totalPopulation: totalPop,
            avgHappiness: Math.round(totalHappiness / numTowns),
            avgProsperity: Math.round(totalProsperity / numTowns),
            kingdomSupply: kingdomSupply,
            kingdomDemand: kingdomDemand,
            buildingCounts: buildingCounts,
            supplyChainGaps: supplyChainGaps,
            monoTowns: monoTowns,
            treasury: kingdom.gold,
        };
    }

    /**
     * Every 30 days, the king reviews the economy and takes proactive
     * growth actions based on personality and analysis.
     */
    function tickKingEconomicStrategy(kingdom) {
        if (!world || !kingdom) return;
        const rng = world.rng;
        const p = kingdom.kingPersonality || {};
        const treasury = kingdom.gold;

        // Intelligence affects strategy review frequency
        var strategyInterval = CONFIG.KING_ECONOMY_STRATEGY_INTERVAL || 30;
        if (p.intelligence === 'brilliant' || p.intelligence === 'clever') strategyInterval = 7;
        else if (p.intelligence === 'dim' || p.intelligence === 'foolish') strategyInterval = 15;
        else strategyInterval = 10;
        if (!kingdom._lastStrategyDay) kingdom._lastStrategyDay = 0;
        if (world.day - kingdom._lastStrategyDay < strategyInterval) return;
        kingdom._lastStrategyDay = world.day;

        // Don't strategize if broke
        if (treasury < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) return;

        // Initialize economic strategy fields
        if (!kingdom.landSubsidies) kingdom.landSubsidies = [];
        if (!kingdom.productionBounties) kingdom.productionBounties = [];
        if (!kingdom.tradeSubsidies) kingdom.tradeSubsidies = [];
        if (!kingdom.taxHolidays) kingdom.taxHolidays = [];
        if (!kingdom.immigrationIncentives) kingdom.immigrationIncentives = [];
        if (!kingdom.productionQuotas) kingdom.productionQuotas = [];
        if (!kingdom.exportRestrictions) kingdom.exportRestrictions = [];

        // Expire old policies
        const day = world.day;
        kingdom.landSubsidies = kingdom.landSubsidies.filter(s => s.expiresDay > day);
        kingdom.productionBounties = kingdom.productionBounties.filter(b => b.expiresDay > day);
        kingdom.tradeSubsidies = kingdom.tradeSubsidies.filter(s => s.expiresDay > day);
        kingdom.taxHolidays = kingdom.taxHolidays.filter(h => h.expiresDay > day);
        kingdom.immigrationIncentives = kingdom.immigrationIncentives.filter(i => i.expiresDay > day);
        kingdom.productionQuotas = kingdom.productionQuotas.filter(q => q.expiresDay > day);

        // Run analysis
        const analysis = analyzeKingdomEconomy(kingdom);
        if (!analysis) return;

        // Determine strategy count and weighting by personality
        let maxActions = CONFIG.KING_MAX_STRATEGIES_PER_CYCLE || 5;
        let carrotWeight = 0.5; // balanced default

        // Ambition affects count
        if (p.ambition === 'ambitious') maxActions = Math.min(7, maxActions + 2);
        else if (p.ambition === 'lazy') maxActions = Math.max(1, maxActions - 3);
        else if (p.ambition === 'content') maxActions = Math.max(2, maxActions - 1);

        // Greed/justice affects carrot vs stick weighting
        if (p.greed === 'generous' || p.greed === 'fair') carrotWeight += 0.2;
        if (p.justice === 'just' || p.temperament === 'kind') carrotWeight += 0.1;
        if (p.greed === 'greedy') carrotWeight -= 0.2;
        if (p.greed === 'corrupt') carrotWeight -= 0.3;
        if (p.temperament === 'stern' || p.temperament === 'cruel') carrotWeight -= 0.1;
        carrotWeight = Math.max(0.1, Math.min(0.9, carrotWeight));

        // Intelligence affects quality
        const isClever = p.intelligence === 'brilliant' || p.intelligence === 'clever';
        const isDim = p.intelligence === 'dim' || p.intelligence === 'foolish';

        // Intelligence-based strategy quality modifier
        var strategyQuality = 1.0;
        if (p.intelligence === 'brilliant') strategyQuality = 1.5;
        else if (p.intelligence === 'clever') strategyQuality = 1.2;
        else if (p.intelligence === 'dim') strategyQuality = 0.7;
        else if (p.intelligence === 'foolish') strategyQuality = 0.5;

        // Intelligence-based crisis detection: smart kings react earlier
        var crisisThreshold = 0.5; // standard: 50% of starting gold
        if (isClever) crisisThreshold = 0.7; // react at 70%
        else if (isDim) crisisThreshold = 0.3; // don't notice until 30%

        // Low-value goods that brilliant kings avoid subsidizing
        var lowValueGoods = ['gut_string', 'hide', 'wool', 'wheat'];

        // Foolish king: chance to waste gold on frivolity
        if (p.intelligence === 'foolish' && rng.chance(0.3)) {
            var wastedGold = rng.randInt(100, 500);
            wastedGold = Math.min(wastedGold, Math.floor(kingdom.gold * 0.1));
            if (wastedGold > 0 && kingdom.gold > wastedGold + 500) {
                kingdom.gold -= wastedGold;
                logEvent('\uD83E\uDD34 The foolish ruler of ' + kingdom.name + ' wastes ' + wastedGold + 'g on royal frivolity!', {
                    type: 'royal_frivolity', cause: 'Poor judgment by dim ruler',
                    effects: ['Treasury -' + wastedGold + 'g', 'Gold wasted on pointless vanity projects']
                });
            }
        }

        // Gather candidate strategies
        const carrotStrategies = [];
        const stickStrategies = [];

        // ---- CARROT STRATEGIES ----

        // a) Subsidized Land Program — for towns with deficits and available slots
        for (const ta of analysis.towns) {
            if (ta.slotsAvailable <= 0 || kingdom.landSubsidies.length >= 3) continue;
            if (kingdom.landSubsidies.some(s => s.townId === ta.id)) continue;
            for (const def of ta.deficits) {
                // Find building that produces this good
                for (const key in BUILDING_TYPES) {
                    const bt = BUILDING_TYPES[key];
                    if (bt.produces === def.good && bt.cost <= treasury * 0.3) {
                        carrotStrategies.push({
                            type: 'land_subsidy',
                            townId: ta.id,
                            townName: ta.name,
                            buildingType: bt.id,
                            buildingName: bt.name,
                            good: def.good,
                            discount: CONFIG.KING_LAND_SUBSIDY_DISCOUNT || 0.4,
                            priority: def.shortfall,
                        });
                        break;
                    }
                }
            }
        }

        // b) Production Bounties — for goods in deficit
        if (kingdom.productionBounties.length < (CONFIG.KING_MAX_BOUNTIES || 5)) {
            for (const ta of analysis.towns) {
                for (const def of ta.deficits) {
                    if (kingdom.productionBounties.some(b => b.good === def.good && b.townId === ta.id)) continue;
                    carrotStrategies.push({
                        type: 'bounty',
                        townId: ta.id,
                        townName: ta.name,
                        good: def.good,
                        reward: CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50,
                        priority: def.shortfall,
                    });
                }
            }
        }

        // c) Trade Subsidies — for scarce goods kingdom-wide
        if (kingdom.tradeSubsidies.length < (CONFIG.KING_MAX_TRADE_SUBSIDIES || 3)) {
            for (const resId in analysis.kingdomDemand) {
                const dem = analysis.kingdomDemand[resId];
                const sup = analysis.kingdomSupply[resId] || 0;
                if (dem > sup * 2 && !kingdom.tradeSubsidies.some(s => s.good === resId)) {
                    carrotStrategies.push({
                        type: 'trade_subsidy',
                        good: resId,
                        bonusPerUnit: CONFIG.KING_TRADE_SUBSIDY_PER_UNIT || 2,
                        maxUnits: 100,
                        priority: dem - sup,
                    });
                }
            }
        }

        // d) Tax Holidays — for towns with low prosperity and available slots
        for (const ta of analysis.towns) {
            if (ta.prosperity >= 50 || ta.slotsAvailable <= 0) continue;
            if (kingdom.taxHolidays.some(h => h.townId === ta.id)) continue;
            carrotStrategies.push({
                type: 'tax_holiday',
                townId: ta.id,
                townName: ta.name,
                priority: 50 - ta.prosperity,
            });
        }

        // e) Immigration Incentives — for underpopulated towns
        for (const ta of analysis.towns) {
            if (ta.population >= 80 || kingdom.immigrationIncentives.some(i => i.townId === ta.id)) continue;
            carrotStrategies.push({
                type: 'immigration',
                townId: ta.id,
                townName: ta.name,
                priority: 80 - ta.population,
            });
        }

        // f) Infrastructure — build roads between complementary towns (handled by existing road AI, just boost priority)

        // l) Strategic Building — fill supply chain gaps
        for (const gap of analysis.supplyChainGaps) {
            if (gap.type !== 'missing_processor') continue;
            const bt = findBuildingType(gap.building);
            if (!bt || bt.cost > treasury * 0.4) continue;
            // Find best town to place it (one that produces the input)
            const bestTown = analysis.towns.find(t => t.produces[gap.input] > 0 && t.slotsAvailable > 0);
            if (bestTown) {
                carrotStrategies.push({
                    type: 'strategic_building',
                    townId: bestTown.id,
                    townName: bestTown.name,
                    buildingType: bt.id,
                    buildingName: bt.name,
                    input: gap.input,
                    output: gap.output,
                    cost: bt.cost,
                    priority: 80,
                });
            }
        }

        // n) Diversification — incentivize different production in mono-towns
        for (const mt of analysis.monoTowns) {
            if (mt.slotsAvailable <= 0) continue;
            const existingProds = Object.keys(mt.produces);
            for (const key in BUILDING_TYPES) {
                const bt = BUILDING_TYPES[key];
                if (!bt.produces || existingProds.includes(bt.produces)) continue;
                if (bt.cost > treasury * 0.3) continue;
                if ((CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bt.id)) continue;
                carrotStrategies.push({
                    type: 'land_subsidy',
                    townId: mt.id,
                    townName: mt.name,
                    buildingType: bt.id,
                    buildingName: bt.name,
                    good: bt.produces,
                    discount: (CONFIG.KING_LAND_SUBSIDY_DISCOUNT || 0.4) + 0.1,
                    priority: 60,
                });
                break;
            }
        }

        // o) Stockpile Management — brilliant kings buy low, sell high
        if (isClever) {
            for (const ta of analysis.towns) {
                for (const sur of ta.surpluses) {
                    const res = findResourceById(sur.good);
                    if (!res) continue;
                    const town = findTown(ta.id);
                    if (!town) continue;
                    const price = getMarketPrice(town, sur.good);
                    if (price < res.basePrice * (CONFIG.KING_STOCKPILE_BUY_THRESHOLD || 0.7)) {
                        carrotStrategies.push({
                            type: 'stockpile_buy',
                            townId: ta.id,
                            townName: ta.name,
                            good: sur.good,
                            price: price,
                            priority: 40,
                        });
                    }
                }
            }
        }

        // ---- STICK STRATEGIES ----

        // g) Production Quotas — for towns underperforming
        for (const ta of analysis.towns) {
            if (ta.prosperity >= 40 || kingdom.productionQuotas.some(q => q.townId === ta.id)) continue;
            const mainProd = Object.entries(ta.produces).sort((a, b) => b[1] - a[1])[0];
            if (mainProd) {
                stickStrategies.push({
                    type: 'quota',
                    townId: ta.id,
                    townName: ta.name,
                    good: mainProd[0],
                    minPerSeason: Math.ceil(mainProd[1] * 1.5),
                    priority: 40 - ta.prosperity,
                });
            }
        }

        // h) Forced Labor — for construction projects when treasury is low
        if (treasury < 2000) {
            for (const ta of analysis.towns) {
                if (ta.slotsAvailable <= 0) continue;
                const town = findTown(ta.id);
                if (!town) continue;
                const idle = world.people.filter(pp =>
                    pp.alive && pp.townId === ta.id &&
                    (pp.occupation === 'laborer' || pp.occupation === 'none') &&
                    pp.age >= CONFIG.COMING_OF_AGE
                );
                if (idle.length >= 3) {
                    stickStrategies.push({
                        type: 'forced_labor',
                        townId: ta.id,
                        townName: ta.name,
                        idleCount: idle.length,
                        priority: 30,
                    });
                }
            }
        }

        // i) Asset Seizure — corrupt kings only, target underperforming NPC buildings
        if (p.greed === 'corrupt') {
            for (const ta of analysis.towns) {
                const town = findTown(ta.id);
                if (!town) continue;
                for (const bld of town.buildings) {
                    if (!bld.ownerId || bld.ownerId === 'player' || bld.ownerId === kingdom.id) continue;
                    if (bld._profitTracker && bld._profitTracker.revenue < bld._profitTracker.costs) {
                        stickStrategies.push({
                            type: 'asset_seizure',
                            townId: ta.id,
                            townName: ta.name,
                            buildingType: bld.type,
                            ownerId: bld.ownerId,
                            priority: 20,
                        });
                        break;
                    }
                }
            }
        }

        // j) Export Restrictions — protect scarce goods
        if (kingdom.exportRestrictions.length < (CONFIG.KING_MAX_EXPORT_RESTRICTIONS || 3)) {
            for (const resId in analysis.kingdomDemand) {
                const dem = analysis.kingdomDemand[resId];
                const sup = analysis.kingdomSupply[resId] || 0;
                if (dem > sup * 3 && !kingdom.exportRestrictions.includes(resId)) {
                    stickStrategies.push({
                        type: 'export_restriction',
                        good: resId,
                        priority: dem - sup,
                    });
                }
            }
        }

        // p) Market Intelligence — adjust tariffs based on neighbors
        if (isClever) {
            stickStrategies.push({
                type: 'tariff_adjustment',
                priority: 25,
            });
        }

        // ---- SELECT STRATEGIES ----
        // Dim/foolish kings pick randomly; clever kings sort by priority
        let candidates = [];
        const carrotSlots = Math.ceil(maxActions * carrotWeight);
        const stickSlots = maxActions - carrotSlots;

        // Brilliant/clever kings: filter out low-value goods and boost priorities by supply/demand gap
        if (isClever) {
            for (var fi = carrotStrategies.length - 1; fi >= 0; fi--) {
                if (carrotStrategies[fi].good && lowValueGoods.indexOf(carrotStrategies[fi].good) >= 0) {
                    carrotStrategies.splice(fi, 1);
                }
            }
            // Boost priorities based on actual supply/demand gap analysis
            for (var si2 = 0; si2 < carrotStrategies.length; si2++) {
                var strat2 = carrotStrategies[si2];
                if (strat2.good) {
                    var demGap = (analysis.kingdomDemand[strat2.good] || 0) - (analysis.kingdomSupply[strat2.good] || 0);
                    if (demGap > 0) strat2.priority += Math.floor(demGap * strategyQuality);
                }
            }
            carrotStrategies.sort((a, b) => b.priority - a.priority);
            stickStrategies.sort((a, b) => b.priority - a.priority);
        } else if (isDim) {
            rng.shuffle(carrotStrategies);
            rng.shuffle(stickStrategies);
        } else {
            // Average intelligence: partially sorted with some randomness
            rng.shuffle(carrotStrategies);
            rng.shuffle(stickStrategies);
            carrotStrategies.sort((a, b) => (b.priority - a.priority) * 0.5 + rng.randFloat(-20, 20));
            stickStrategies.sort((a, b) => (b.priority - a.priority) * 0.5 + rng.randFloat(-20, 20));
        }

        candidates = candidates.concat(carrotStrategies.slice(0, carrotSlots));
        candidates = candidates.concat(stickStrategies.slice(0, stickSlots));

        // Warlike kings bias toward military production
        if (p.militarism === 'warlike' || p.militarism === 'aggressive') {
            candidates = candidates.filter(c => {
                if (c.good && ['swords', 'armor', 'bows', 'arrows', 'horses'].includes(c.good)) return true;
                return rng.chance(0.6); // drop some non-military strategies
            });
        }

        // ---- EXECUTE STRATEGIES ----
        let actionsThisCycle = 0;
        for (const strat of candidates) {
            if (actionsThisCycle >= maxActions) break;
            if (kingdom.gold < (CONFIG.KING_MIN_TREASURY_FOR_STRATEGY || 500)) break;

            switch (strat.type) {
                case 'land_subsidy': {
                    const discount = Math.min(0.6, strat.discount);
                    kingdom.landSubsidies.push({
                        townId: strat.townId,
                        buildingType: strat.buildingType,
                        discount: discount,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    logEvent(`👑 ${kingdom.name} offers cheap land in ${strat.townName} for anyone who builds a ${strat.buildingName}!`, {
                        type: 'economic_strategy', cause: `${strat.good} deficit in ${strat.townName}`,
                        effects: [`${Math.round(discount * 100)}% discount on land for ${strat.buildingName} builders`, `Lasts ${CONFIG.KING_SUBSIDY_DURATION || 180} days`]
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'bounty': {
                    const reward = strat.reward;
                    kingdom.productionBounties.push({
                        good: strat.good,
                        townId: strat.townId,
                        reward: reward,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`📜 ${kingdom.name} seeks ${goodName} producers in ${strat.townName} — ${reward}g bounty!`, {
                        type: 'economic_strategy', cause: `${goodName} shortage in ${strat.townName}`,
                        effects: [`${reward}g reward for building ${goodName} production`, 'NPCs may respond to this opportunity']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'trade_subsidy': {
                    kingdom.tradeSubsidies.push({
                        good: strat.good,
                        bonusPerUnit: strat.bonusPerUnit,
                        maxUnits: strat.maxUnits,
                        unitsPaid: 0,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`💰 ${kingdom.name} subsidizes ${goodName} imports — ${strat.bonusPerUnit}g bonus per unit!`, {
                        type: 'economic_strategy', cause: `${goodName} scarcity across kingdom`,
                        effects: [`Merchants get +${strat.bonusPerUnit}g per ${goodName} sold in kingdom`, 'Treasury funds the subsidy']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'tax_holiday': {
                    kingdom.taxHolidays.push({
                        townId: strat.townId,
                        expiresDay: day + (CONFIG.KING_TAX_HOLIDAY_DURATION || 180),
                    });
                    logEvent(`🎉 ${kingdom.name} declares a tax holiday in ${strat.townName}! New businesses pay no property tax for ${CONFIG.KING_TAX_HOLIDAY_DURATION || 180} days.`, {
                        type: 'economic_strategy', cause: `Low prosperity (${analysis.towns.find(t => t.id === strat.townId)?.prosperity || '?'}%) in ${strat.townName}`,
                        effects: ['No property tax for new buildings', 'Attracts investment']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'immigration': {
                    kingdom.immigrationIncentives.push({
                        townId: strat.townId,
                        bonus: CONFIG.KING_IMMIGRATION_BONUS || 50,
                        expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                    });
                    logEvent(`🏠 ${kingdom.name} offers ${CONFIG.KING_IMMIGRATION_BONUS || 50}g to families relocating to ${strat.townName}!`, {
                        type: 'economic_strategy', cause: `${strat.townName} is underpopulated (${analysis.towns.find(t => t.id === strat.townId)?.population || '?'} people)`,
                        effects: ['Gold bonus for immigrants', 'Population may grow']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'strategic_building': {
                    if (kingdom.gold < strat.cost) break;
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                    if (town.buildings.length >= maxSlots) break;
                    town.buildings.push({
                        type: strat.buildingType, level: 1, ownerId: kingdom.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    kingdom.gold -= strat.cost;
                    logEvent(`🏗️ ${kingdom.name} builds a ${strat.buildingName} in ${strat.townName} to complete ${strat.input} → ${strat.output} supply chain!`, {
                        type: 'economic_strategy', cause: `${strat.input} produced locally but no ${strat.buildingName} to process it`,
                        effects: [`New ${strat.buildingName} in ${strat.townName}`, `${strat.output} production begins`, `Treasury spent ${strat.cost}g`]
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'stockpile_buy': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const avail = town.market.supply[strat.good] || 0;
                    const toBuy = Math.min(avail, Math.floor(treasury * 0.05 / Math.max(1, strat.price)));
                    if (toBuy <= 0) break;
                    const cost = toBuy * strat.price;
                    if (kingdom.gold < cost) break;
                    kingdom.gold -= cost;
                    town.market.supply[strat.good] -= toBuy;
                    // Store in military stockpile if military good, otherwise just remove from market (strategic reserve)
                    if (kingdom.militaryStockpile && kingdom.militaryStockpile[strat.good] !== undefined) {
                        kingdom.militaryStockpile[strat.good] += toBuy;
                    }
                    logEvent(`📦 ${kingdom.name} stockpiles ${toBuy} ${strat.good} from ${strat.townName} at low prices.`, {
                        type: 'economic_strategy', cause: `${strat.good} priced below market value`,
                        effects: [`${toBuy} units purchased for ${cost}g`, 'Strategic reserves increased']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'quota': {
                    kingdom.productionQuotas.push({
                        townId: strat.townId,
                        good: strat.good,
                        minPerSeason: strat.minPerSeason,
                        expiresDay: day + CONFIG.DAYS_PER_SEASON,
                    });
                    logEvent(`⚖️ ${kingdom.name} sets production quota for ${strat.good} in ${strat.townName}: minimum ${strat.minPerSeason} per season.`, {
                        type: 'economic_strategy', cause: `Low prosperity in ${strat.townName} (${analysis.towns.find(t => t.id === strat.townId)?.prosperity || '?'}%)`,
                        effects: [`Towns failing quota lose ${CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5} happiness`, 'Workers pressured to produce more']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'forced_labor': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    // Conscript idle for a kingdom building project
                    const neededBld = analysis.supplyChainGaps.find(g => g.type === 'missing_processor');
                    if (!neededBld) break;
                    const bt = findBuildingType(neededBld.building);
                    if (!bt) break;
                    const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                    if (town.buildings.length >= maxSlots) break;
                    // Build at half cost but happiness penalty
                    const cost = Math.floor(bt.cost * 0.5);
                    if (kingdom.gold < cost) break;
                    kingdom.gold -= cost;
                    town.buildings.push({
                        type: bt.id, level: 1, ownerId: kingdom.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    town.happiness = Math.max(0, (town.happiness || 50) + (CONFIG.KING_FORCED_LABOR_HAPPINESS || -10));
                    logEvent(`⛓️ ${kingdom.name} conscripts laborers in ${strat.townName} to build a ${bt.name}!`, {
                        type: 'economic_strategy', cause: 'Treasury too low for normal construction',
                        effects: [`${bt.name} built at half cost`, `Happiness in ${strat.townName} drops by ${Math.abs(CONFIG.KING_FORCED_LABOR_HAPPINESS || -10)}`]
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'asset_seizure': {
                    const town = findTown(strat.townId);
                    if (!town) break;
                    const bld = town.buildings.find(b => b.type === strat.buildingType && b.ownerId === strat.ownerId);
                    if (!bld) break;
                    const prevOwner = findPerson(strat.ownerId);
                    bld.ownerId = kingdom.id;
                    town.happiness = Math.max(0, (town.happiness || 50) - 15);
                    if (prevOwner) {
                        prevOwner.needs = prevOwner.needs || {};
                        prevOwner.needs.happiness = Math.max(0, (prevOwner.needs.happiness || 50) - 30);
                    }
                    const bt = findBuildingType(strat.buildingType);
                    logEvent(`👑 ${kingdom.name} seizes a ${bt ? bt.name : strat.buildingType} in ${strat.townName}!`, {
                        type: 'economic_strategy', cause: 'Corrupt king confiscates underperforming business',
                        effects: ['Building transferred to kingdom ownership', `Happiness in ${strat.townName} drops sharply`, 'Former owner furious']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'export_restriction': {
                    kingdom.exportRestrictions.push(strat.good);
                    const resInfo = findResourceById(strat.good);
                    const goodName = resInfo ? resInfo.name : strat.good;
                    logEvent(`🚫 ${kingdom.name} restricts export of ${goodName} to protect domestic supply!`, {
                        type: 'economic_strategy', cause: `Severe ${goodName} shortage domestically`,
                        effects: [`${goodName} cannot be exported from ${kingdom.name}`, 'Domestic prices stabilize', 'Trade partners may be upset']
                    });
                    actionsThisCycle++;
                    break;
                }
                case 'tariff_adjustment': {
                    // Clever kings adjust tariffs based on surpluses/deficits
                    if (!kingdom.laws) break;
                    const surplus = Object.entries(analysis.kingdomSupply)
                        .filter(([, v]) => v > analysis.totalPopulation * 3)
                        .map(([k]) => k);
                    // Lower tariffs on deficit goods (attract imports)
                    if (surplus.length > 0 && kingdom.laws.tradeTariff > 0.02) {
                        kingdom.laws.tradeTariff = Math.max(0.02, kingdom.laws.tradeTariff - 0.01);
                        logEvent(`📊 ${kingdom.name} lowers trade tariffs to attract imports of scarce goods.`, {
                            type: 'economic_strategy', cause: 'Market intelligence: goods needed from abroad',
                            effects: [`Tariffs reduced to ${Math.round(kingdom.laws.tradeTariff * 100)}%`]
                        });
                    }
                    actionsThisCycle++;
                    break;
                }
            }
        }

        // Foolish kings occasionally do counterproductive things
        if (isDim && actionsThisCycle < maxActions && rng.chance(0.3)) {
            // Randomly ban a good that's already scarce
            const scarce = Object.entries(analysis.kingdomDemand)
                .filter(([resId, dem]) => (analysis.kingdomSupply[resId] || 0) < dem * 0.5)
                .map(([k]) => k);
            if (scarce.length > 0) {
                const bad = rng.pick(scarce);
                if (!kingdom.exportRestrictions.includes(bad)) {
                    kingdom.exportRestrictions.push(bad);
                    const resInfo = findResourceById(bad);
                    const goodName = resInfo ? resInfo.name : bad;
                    logEvent(`🤦 ${kingdom.name}'s foolish king restricts export of ${goodName} — which is already scarce!`, {
                        type: 'economic_strategy', cause: 'Poor judgment by dim ruler',
                        effects: ['Already scarce goods become harder to get', 'Merchants frustrated']
                    });
                }
            }
        }

        // Foolish kings: 20% chance to make a counterproductive decision
        if (p.intelligence === 'foolish' && rng.chance(0.2)) {
            var badAction = rng.randInt(0, 2);
            if (badAction === 0 && kingdom.happiness < 40) {
                // Raise taxes when happiness is already low
                kingdom.taxRate = Math.min(0.25, (kingdom.taxRate || 0.05) + 0.03);
                kingdom.lastTaxIncreaseDay = world.day;
                logEvent('\uD83E\uDD26 The foolish ruler of ' + kingdom.name + ' raises taxes despite widespread unhappiness!', {
                    type: 'bad_decision', cause: 'Poor judgment',
                    effects: ['Tax rate increased to ' + Math.round(kingdom.taxRate * 100) + '%', 'Citizens grow more unhappy']
                });
            } else if (badAction === 1) {
                // Subsidize a wrong good (pick a surplus good instead of a deficit good)
                var surplusGoods = Object.entries(analysis.kingdomSupply)
                    .filter(function(e) { return e[1] > (analysis.kingdomDemand[e[0]] || 0) * 2; })
                    .map(function(e) { return e[0]; });
                if (surplusGoods.length > 0 && kingdom.productionBounties.length < (CONFIG.KING_MAX_BOUNTIES || 5)) {
                    var wrongGood = rng.pick(surplusGoods);
                    var wrongTown = analysis.towns.length > 0 ? rng.pick(analysis.towns) : null;
                    if (wrongTown) {
                        kingdom.productionBounties.push({
                            good: wrongGood, townId: wrongTown.id,
                            reward: CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50,
                            expiresDay: day + (CONFIG.KING_SUBSIDY_DURATION || 180),
                        });
                        var wrInfo = findResourceById(wrongGood);
                        logEvent('\uD83E\uDD26 ' + kingdom.name + ' offers bounties for ' + (wrInfo ? wrInfo.name : wrongGood) + ' — which is already in surplus!', {
                            type: 'bad_decision', cause: 'Foolish ruler misreads the market',
                            effects: ['Gold wasted on unnecessary production']
                        });
                    }
                }
            } else if (badAction === 2 && kingdom.laws) {
                // Raise tariffs when trade is needed
                kingdom.laws.tradeTariff = Math.min(0.20, (kingdom.laws.tradeTariff || 0.05) + 0.03);
                logEvent('\uD83E\uDD26 The dim ruler of ' + kingdom.name + ' raises trade tariffs, discouraging needed imports!', {
                    type: 'bad_decision', cause: 'Poor economic understanding',
                    effects: ['Tariffs raised to ' + Math.round(kingdom.laws.tradeTariff * 100) + '%']
                });
            }
        }
    }

    /**
     * NPC response to king's economic strategies — called during
     * NPC business evaluation tick (every 60 days).
     */
    function applyKingEconomicEffectsToNPCs() {
        if (!world) return;
        const rng = world.rng;
        const day = world.day;

        for (const k of world.kingdoms) {
            if (!k.productionBounties || !k.territories) continue;

            // NPCs respond to bounties — merchants/craftsmen with gold try to build requested buildings
            for (const bounty of k.productionBounties) {
                if (bounty.fulfilled) continue;
                const town = findTown(bounty.townId);
                if (!town) continue;
                const maxSlots = (CONFIG.TOWN_CATEGORIES[town.category] || {}).maxBuildingSlots || 10;
                if (town.buildings.length >= maxSlots) continue;

                // Find building that produces this good
                let targetBt = null;
                for (const key in BUILDING_TYPES) {
                    const bt = BUILDING_TYPES[key];
                    if (bt.produces === bounty.good) { targetBt = bt; break; }
                }
                if (!targetBt) continue;

                // Look for NPCs with enough gold and relevant skills
                const candidates = world.people.filter(pp =>
                    pp.alive && pp.townId === bounty.townId &&
                    (pp.occupation === 'merchant' || pp.occupation === 'craftsman') &&
                    pp.gold >= targetBt.cost * 0.8 &&
                    !pp.buildings?.some(b => b.type === targetBt.id && b.townId === bounty.townId)
                );
                if (candidates.length > 0 && rng.chance(0.15)) {
                    const npc = rng.pick(candidates);
                    npc.gold -= targetBt.cost;
                    town.buildings.push({
                        type: targetBt.id, level: 1, ownerId: npc.id,
                        builtDay: day, condition: 'new', lastRepairDay: 0
                    });
                    if (!npc.buildings) npc.buildings = [];
                    npc.buildings.push({ type: targetBt.id, townId: town.id, level: 1 });
                    // Pay bounty
                    npc.gold += bounty.reward;
                    k.gold -= bounty.reward;
                    bounty.fulfilled = true;
                    logEvent(`✅ ${npc.firstName} ${npc.lastName} builds a ${targetBt.name} in ${town.name} and claims the ${bounty.reward}g bounty!`, {
                        type: 'bounty_fulfilled', cause: `Kingdom bounty for ${bounty.good}`,
                        effects: [`New ${targetBt.name} in ${town.name}`, `${bounty.reward}g paid from treasury`]
                    });
                }
            }

            // NPCs respond to immigration incentives — unhappy NPCs in other kingdoms relocate
            for (const inc of (k.immigrationIncentives || [])) {
                if (inc.fulfilled) continue;
                const targetTown = findTown(inc.townId);
                if (!targetTown) continue;
                // Find unhappy people in other kingdoms
                const migrants = world.people.filter(pp =>
                    pp.alive && pp.kingdomId !== k.id &&
                    pp.needs && pp.needs.happiness < 30 &&
                    pp.age >= CONFIG.COMING_OF_AGE && pp.age <= 60
                );
                if (migrants.length > 0 && rng.chance(0.08)) {
                    const migrant = rng.pick(migrants);
                    const oldTown = findTown(migrant.townId);
                    migrant.townId = inc.townId;
                    migrant.kingdomId = k.id;
                    migrant.gold += inc.bonus;
                    k.gold -= inc.bonus;
                    migrant.needs.happiness = Math.min(100, (migrant.needs.happiness || 30) + 20);
                    targetTown.population++;
                    if (oldTown && oldTown.population > 0) oldTown.population--;
                    logEvent(`🚶 ${migrant.firstName} ${migrant.lastName} migrates to ${targetTown.name} in ${k.name}, drawn by the ${inc.bonus}g immigration bonus.`, {
                        type: 'immigration', cause: 'Kingdom immigration incentive',
                        effects: [`${targetTown.name} gains a citizen`, `Treasury pays ${inc.bonus}g`]
                    });
                    inc.fulfilled = true; // Mark incentive as fulfilled
                }
            }

            // Apply quota happiness penalties
            if (day % CONFIG.DAYS_PER_SEASON === 0) {
                for (const quota of (k.productionQuotas || [])) {
                    const town = findTown(quota.townId);
                    if (!town) continue;
                    const currentProd = town.market.supply[quota.good] || 0;
                    if (currentProd < quota.minPerSeason) {
                        town.happiness = Math.max(0, (town.happiness || 50) + (CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5));
                        logEvent(`⚠️ ${town.name} fails to meet ${quota.good} production quota. Happiness drops.`, {
                            type: 'quota_failure', cause: `Produced ${currentProd} of ${quota.minPerSeason} required`,
                            effects: [`Happiness penalty: ${CONFIG.KING_QUOTA_HAPPINESS_PENALTY || -5}`]
                        });
                    }
                }
            }

            // Tax holiday effect: NPC building decisions favor tax-holiday towns
            for (const holiday of (k.taxHolidays || [])) {
                const town = findTown(holiday.townId);
                if (!town) continue;
                // Boost attractiveness: slightly increase prosperity perception
                // This happens naturally when property tax collection skips holiday towns
            }

            // Trade subsidies: applied in collectTradeTax, but clean up expired/exhausted ones
            if (k.tradeSubsidies) {
                k.tradeSubsidies = k.tradeSubsidies.filter(s => s.expiresDay > day && (s.unitsPaid || 0) < s.maxUnits);
            }
        }
    }

    // ========================================================
    // §17G  SMART KINGDOM BAN POLICY
    // ========================================================
    function tickKingdomBanPolicy(kingdom) {
        if (!world || !kingdom || !kingdom.laws) return;
        var rng = world.rng;
        if (!rng) return;

        var day = world.day;
        if (!kingdom._lastBanCheckDay) kingdom._lastBanCheckDay = 0;
        if (day - kingdom._lastBanCheckDay < (CONFIG.KINGDOM_BAN_POLICY_INTERVAL || 30)) return;
        kingdom._lastBanCheckDay = day;

        var isAtWar = kingdom.atWar && kingdom.atWar.size > 0;
        var kPers = kingdom.kingPersonality || {};
        var bannableWeapons = ['swords', 'armor', 'horses', 'blasting_powder', 'demolition_tools'];
        var bannableLuxury = ['wine', 'jewelry'];

        // Calculate military stockpile ratio
        var stockpile = kingdom.militaryStockpile || {};
        var armySize = (_tickCache.soldiersByKingdom[kingdom.id] || []).length || 1;
        var stockpileRatio = ((stockpile.swords || 0) + (stockpile.armor || 0)) / (armySize * 2);

        // Calculate crime rate in kingdom towns
        var kingdomTowns = world.towns.filter(t => t.kingdomId === kingdom.id);
        var avgSecurity = kingdomTowns.reduce((s, t) => s + (t.security || 50), 0) / Math.max(1, kingdomTowns.length);
        var crimeRate = Math.max(0, 100 - avgSecurity); // higher = more crime

        // Count citizens who produce these goods (economic impact)
        var weaponProducers = (_tickCache.peopleByKingdom[kingdom.id] || []).filter(function(p) { return p.occupation === 'craftsman'; }).length;

        var changed = false;
        var currentBanned = kingdom.laws.bannedGoods || [];

        // Evaluate each weapon/armor/horse for banning
        for (var bi = 0; bi < bannableWeapons.length; bi++) {
            var good = bannableWeapons[bi];
            var isBanned = currentBanned.includes(good);

            if (!isBanned) {
                // Should we ban?
                var banChance = 0;
                if (stockpileRatio > 2.0) banChance += 0.60;
                else if (stockpileRatio > 1.0) banChance += 0.20;
                if (isAtWar) banChance = Math.min(banChance, 0.10); // unlikely during war
                if (crimeRate > 60) banChance += 0.40; // high crime → ban weapons
                if (kPers.militarism === 'warlike' || kPers.militarism === 'aggressive') banChance *= 0.5;
                if (weaponProducers > armySize * 0.3) banChance *= 0.5; // too many producers hurt

                // Priority: swords most likely, horses least
                if (good === 'horses') banChance *= 0.5;
                else if (good === 'armor') banChance *= 0.8;

                if (rng.chance(Math.min(0.7, banChance))) {
                    currentBanned.push(good);
                    changed = true;
                    logEvent(kingdom.name + ' has banned trade in ' + good + '!', {
                        type: 'trade_ban',
                        cause: stockpileRatio > 2.0 ? kingdom.name + ' has excess ' + good + ' stockpiled (' + (stockpileRatio * 100).toFixed(0) + '% of army needs).' :
                               crimeRate > 60 ? 'High crime rate (' + Math.round(crimeRate) + '%) in ' + kingdom.name + ' prompted the ban for security.' :
                               'The ruler of ' + kingdom.name + ' decided to restrict ' + good + ' trade.',
                        effects: [
                            good + ' cannot be freely traded in ' + kingdom.name,
                            'A Royal Production Permit is required to trade banned goods',
                            'Prices for ' + good + ' increase significantly (~95% premium)',
                            'Smuggling becomes more profitable but risky'
                        ]
                    });
                }
            } else {
                // Should we unban?
                var unbanChance = 0;
                if (isAtWar) unbanChance += 0.50; // war → need supply
                if (stockpileRatio < 0.5) unbanChance += 0.40;
                if (kPers.militarism === 'warlike') unbanChance += 0.20;

                if (rng.chance(Math.min(0.6, unbanChance))) {
                    currentBanned = currentBanned.filter(g => g !== good);
                    changed = true;
                    logEvent(kingdom.name + ' has lifted the ban on ' + good + '.');
                }
            }
        }

        // Luxury ban logic
        var isAustere = kPers.generosity === 'miserly' || kPers.tradition === 'traditional';
        for (var li = 0; li < bannableLuxury.length; li++) {
            var luxGood = bannableLuxury[li];
            var luxBanned = currentBanned.includes(luxGood);
            if (!luxBanned && isAustere && rng.chance(0.15)) {
                currentBanned.push(luxGood);
                changed = true;
                logEvent(kingdom.name + ' has banned trade in ' + luxGood + '!');
            } else if (luxBanned && !isAustere && rng.chance(0.20)) {
                currentBanned = currentBanned.filter(g => g !== luxGood);
                changed = true;
                logEvent(kingdom.name + ' has lifted the ban on ' + luxGood + '.');
            }
        }

        if (changed) kingdom.laws.bannedGoods = currentBanned;
    }

    // ========================================================
    // §18 EVENT LOG
    // ========================================================
    function inferEventCategory(msg, details) {
        var m = (msg || '').toLowerCase();
        var dtype = details && details.type ? details.type.toLowerCase() : '';

        // Tier 1: Always show (critical)
        if (dtype === 'death' || dtype === 'game_over' || dtype === 'victory' ||
            m.includes('you have been jailed') || m.includes('conscripted') ||
            m.includes('ship sunk') || m.includes('caravan captured') ||
            m.includes('assassination') || m.includes('building seized') ||
            m.includes('bankruptcy') || m.includes('heir born') ||
            m.includes('border closed') || m.includes('blockade')) {
            return 'critical';
        }

        // War/military
        if (dtype === 'war_declared' || dtype === 'wardeclared' || dtype === 'warended' ||
            dtype === 'peace' || dtype === 'surrender' || dtype === 'battle' ||
            dtype === 'siege' || dtype === 'army' || dtype === 'naval_raid' ||
            m.includes('declares war') || m.includes('war ') || m.includes('army') ||
            m.includes('siege') || m.includes('troops') || m.includes('battle') ||
            m.includes('bombardment') || m.includes('invaded')) {
            return 'military';
        }

        // Disasters/events
        if (dtype === 'flood' || dtype === 'fire' || dtype === 'plague' || dtype === 'earthquake' ||
            dtype === 'blight' || dtype === 'drought' || dtype === 'mine_collapse' ||
            dtype === 'famine' || dtype === 'storm' ||
            m.includes('plague') || m.includes('fire ') || m.includes('flood') ||
            m.includes('earthquake') || m.includes('famine') || m.includes('blight')) {
            return 'local_town';
        }

        // Kingdom political
        if (dtype === 'law_change' || dtype === 'tax_change' || dtype === 'succession' ||
            dtype === 'economic_collapse' || dtype === 'revolt' || dtype === 'kingdom_collapse' ||
            dtype === 'territory_transfer' || dtype === 'alliance' || dtype === 'treaty' ||
            m.includes('law ') || m.includes('tax ') || m.includes('festival') ||
            m.includes('succession') || m.includes('king ') || m.includes('regent') ||
            m.includes('commission') || m.includes('tournament') || m.includes('alliance')) {
            return 'my_kingdom';
        }

        // Trade/economy
        if (dtype === 'trade' || dtype === 'trade_craze' || dtype === 'embargo' ||
            dtype === 'price_control' || dtype === 'bounty' || dtype === 'tariff' ||
            m.includes('trade craze') || m.includes('embargo') || m.includes('price') ||
            m.includes('tariff') || m.includes('bounty')) {
            return 'world_economy';
        }

        // Elite merchant / NPC
        if (m.includes('elite merchant') || m.includes('merchant empire') ||
            m.includes('merchant dynasty') || m.includes(' married ') ||
            m.includes(' retired') || m.includes('npc ')) {
            return 'npc_activity';
        }

        // Combat/piracy
        if (m.includes('pirate') || m.includes('bandit') || m.includes('ambush') ||
            m.includes('attacked') || m.includes('raided')) {
            return 'combat';
        }

        // Default to local_town for unrecognized events
        return 'local_town';
    }

    function logEvent(msg, details, category) {
        // Infer category from details or message if not explicitly provided
        if (!category) {
            category = inferEventCategory(msg, details);
        }
        var event = { day: world.day, message: msg, category: category };
        if (details) {
            event.details = details;
            // Store kingdomId if available in details for visibility filtering
            if (details.kingdomId) event.kingdomId = details.kingdomId;
            if (details.townId) event.townId = details.townId;
        }
        world.eventLog.push(event);
        // Preserve major events in permanent history
        if (details && details.type) {
            var majorTypes = ['war_declared', 'warDeclared', 'warEnded', 'peace', 'surrender', 'territory_transfer', 'kingdom_collapse', 'economic_collapse', 'revolt'];
            if (majorTypes.indexOf(details.type) !== -1) {
                if (!world.majorEventHistory) world.majorEventHistory = [];
                world.majorEventHistory.push({ day: world.day, message: msg, details: details });
            }
        }
        // Auto-clear events older than 90 days
        while (world.eventLog.length > 0 && world.eventLog[0].day < world.day - 90) {
            world.eventLog.shift();
        }
        while (world.eventLog.length > 500) world.eventLog.shift();
    }

    // ========================================================
    // §18a PERIODIC ROAD CONNECTIVITY CHECK
    // ========================================================
    function tickRoadConnectivity() {
        // BFS from capital/first town to find main connected component
        var activeRoads = world.roads.filter(function(r) { return r.condition !== 'destroyed'; });
        var adj = {};
        for (var ri = 0; ri < activeRoads.length; ri++) {
            var r = activeRoads[ri];
            if (!adj[r.fromTownId]) adj[r.fromTownId] = [];
            if (!adj[r.toTownId]) adj[r.toTownId] = [];
            adj[r.fromTownId].push(r.toTownId);
            adj[r.toTownId].push(r.fromTownId);
        }
        for (var si = 0; si < world.seaRoutes.length; si++) {
            var sr = world.seaRoutes[si];
            var sfrom = sr.fromTownId || sr.from;
            var sto = sr.toTownId || sr.to;
            if (!adj[sfrom]) adj[sfrom] = [];
            if (!adj[sto]) adj[sto] = [];
            adj[sfrom].push(sto);
            adj[sto].push(sfrom);
        }

        // Find starting town (capital of largest kingdom)
        var startTown = null;
        var maxTerr = 0;
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            var tCount = k.territories instanceof Set ? k.territories.size : (Array.isArray(k.territories) ? k.territories.length : 0);
            if (tCount > maxTerr) {
                maxTerr = tCount;
                var cap = world.towns.find(function(t) { return t.kingdomId === k.id && t.isCapital; });
                if (cap) startTown = cap;
            }
        }
        if (!startTown && world.towns.length > 0) startTown = world.towns[0];
        if (!startTown) return;

        // BFS
        var visited = {};
        var queue = [startTown.id];
        visited[startTown.id] = true;
        var mainComponent = [startTown];
        while (queue.length > 0) {
            var cur = queue.shift();
            var neighbors = adj[cur] || [];
            for (var ni = 0; ni < neighbors.length; ni++) {
                if (!visited[neighbors[ni]]) {
                    visited[neighbors[ni]] = true;
                    queue.push(neighbors[ni]);
                    var nt = findTown(neighbors[ni]);
                    if (nt) mainComponent.push(nt);
                }
            }
        }

        // Find disconnected non-destroyed, non-abandoned towns
        var disconnected = world.towns.filter(function(t) {
            return !visited[t.id] && !t.destroyed && !t.abandoned;
        });
        if (disconnected.length === 0) return;

        // Disconnected towns may get roads built by their kingdom — but only if
        // the king can afford it and AI decides to invest. This is NOT free.
        // Road importance factors into the decision: higher importance = more likely to build.
        var connected = 0;
        for (var di = 0; di < disconnected.length && connected < 1; di++) {
            var dt = disconnected[di];
            // Find the kingdom that owns this town
            var ownerK = null;
            for (var oki = 0; oki < world.kingdoms.length; oki++) {
                var ok = world.kingdoms[oki];
                var terrSet = ok.territories instanceof Set ? ok.territories : new Set(ok.territories || []);
                if (terrSet.has(dt.id)) { ownerK = ok; break; }
            }
            if (!ownerK) continue;

            // Kingdom must have gold and the king must not be foolish
            var kingPerson = findPerson(ownerK.king);
            var intel = kingPerson ? kingPerson.intelligence : 'average';
            var roadCost = 500; // Cost to build a connectivity road
            if (ownerK.gold < roadCost) continue;

            // Find best target town — scored by distance AND road importance
            var bestTown = null;
            var bestScore = -Infinity;
            for (var mi = 0; mi < mainComponent.length; mi++) {
                var mt = mainComponent[mi];
                var dx = dt.x - mt.x;
                var dy = dt.y - mt.y;
                var d = Math.sqrt(dx * dx + dy * dy);
                if (d >= 5000) continue;
                // Score: road importance minus distance penalty
                var importance = computeRoadImportance(dt, mt);
                var score = importance - d * 0.01;
                if (score > bestScore) { bestScore = score; bestTown = mt; }
            }
            if (!bestTown) continue;

            // Build chance: base from intelligence, boosted by road importance
            var baseBuildChance = intel === 'brilliant' ? 0.4 : intel === 'clever' ? 0.25 : intel === 'average' ? 0.15 : intel === 'dim' ? 0.05 : 0;
            // High importance roads (>50) get up to +20% build chance
            var importanceBoost = Math.min(0.2, bestScore * 0.004);
            var buildChance = Math.min(0.8, baseBuildChance + importanceBoost);
            // Wartime urgency: kings at war are more likely to build strategic roads
            if (ownerK.atWar && ownerK.atWar.size > 0) buildChance = Math.min(0.9, buildChance + 0.15);
            if (buildChance <= 0 || Math.random() > buildChance) continue;

            ownerK.gold -= roadCost;
            buildNewRoad(dt.id, bestTown.id, dt.kingdomId || bestTown.kingdomId);
            mainComponent.push(dt);
            visited[dt.id] = true;
            connected++;
            logEvent('🛤️ King of ' + ownerK.name + ' invested ' + roadCost + 'g to build a road connecting ' + dt.name + '.');
        }
    }

    // ========================================================
    // §18b DEGRADATION SYSTEM
    // ========================================================
    function tickDegradation() {
        const day = world.day;

        // Buildings (all towns)
        for (const town of world.towns) {
            for (const bld of town.buildings) {
                // Retrofit existing buildings with a random age
                if (!bld.builtDay && bld.builtDay !== 0) {
                    bld.builtDay = Math.max(0, day - Math.floor(world.rng.randInt(0, 365)));
                }
                if (!bld.condition) bld.condition = 'new';

                const age = day - (bld.lastRepairDay || bld.builtDay);
                if (age >= 3600 && bld.condition !== 'destroyed') {
                    bld.condition = 'destroyed';    // ~10 years
                    logEvent(`A ${bld.type} in ${town.name} has collapsed from neglect!`, null, 'local_town');
                } else if (age >= 2160 && bld.condition !== 'breaking' && bld.condition !== 'destroyed') {
                    bld.condition = 'breaking';      // ~6 years
                } else if (age >= 1080 && bld.condition === 'new') {
                    bld.condition = 'used';           // ~3 years
                }
            }

            // Walls
            if (town.walls > 0) {
                if (!town.wallBuiltDay && town.wallBuiltDay !== 0) town.wallBuiltDay = Math.max(0, day - world.rng.randInt(0, 365));
                if (!town.wallCondition) town.wallCondition = 'new';
                const wallAge = day - (town.wallLastRepair || town.wallBuiltDay);
                if (wallAge >= 3600 && town.wallCondition !== 'destroyed') {
                    town.wallCondition = 'destroyed';  // ~10 years
                    logEvent(`The walls of ${town.name} have crumbled to ruin!`);
                } else if (wallAge >= 2160 && town.wallCondition !== 'breaking' && town.wallCondition !== 'destroyed') {
                    town.wallCondition = 'breaking';
                } else if (wallAge >= 1080 && town.wallCondition === 'new') {
                    town.wallCondition = 'used';
                }
            }
        }

        // Helper: check if destroying a road would leave either endpoint town with no connections
        function wouldDisconnectTown(road) {
            var fromId = road.fromTownId, toId = road.toTownId;
            var fromHasOther = false, toHasOther = false;
            for (var ri = 0; ri < world.roads.length; ri++) {
                var r = world.roads[ri];
                if (r === road || r.condition === 'destroyed') continue;
                if (r.fromTownId === fromId || r.toTownId === fromId) fromHasOther = true;
                if (r.fromTownId === toId || r.toTownId === toId) toHasOther = true;
                if (fromHasOther && toHasOther) return false;
            }
            // Also check sea routes
            for (var si = 0; si < (world.seaRoutes || []).length; si++) {
                var sr = world.seaRoutes[si];
                var srFrom = sr.fromTownId || sr.from;
                var srTo = sr.toTownId || sr.to;
                if (srFrom === fromId || srTo === fromId) fromHasOther = true;
                if (srFrom === toId || srTo === toId) toHasOther = true;
                if (fromHasOther && toHasOther) return false;
            }
            return !fromHasOther || !toHasOther;
        }

        // Roads
        for (const road of world.roads) {
            if (!road.builtDay && road.builtDay !== 0) {
                road.builtDay = Math.max(0, day - world.rng.randInt(0, 500));
            }
            if (!road.condition) road.condition = 'new';
            const roadAge = day - (road.lastRepairDay || road.builtDay);
            if (roadAge >= 3600 && road.condition !== 'destroyed') {
                if (wouldDisconnectTown(road)) {
                    road.condition = 'breaking';
                    road._protectedAsLastRoad = true;
                } else {
                    road.condition = 'destroyed';     // ~10 years
                }
            } else if (roadAge >= 2160 && road.condition !== 'breaking' && road.condition !== 'destroyed') {
                road.condition = 'breaking';       // ~6 years
            } else if (roadAge >= 1080 && road.condition === 'new') {
                road.condition = 'used';           // ~3 years
            }
        }
    }

    // ========================================================
    // §19 PATHFINDING (Dijkstra over road graph)
    // ========================================================
    function findPath(fromTownId, toTownId) {
        const adjacency = {};
        for (const town of world.towns) adjacency[town.id] = [];
        for (const road of world.roads) {
            // Skip roads with destroyed bridges — they're unusable
            if (road.hasBridge && road.bridgeDestroyed) continue;
            const fromT = findTown(road.fromTownId);
            const toT = findTown(road.toTownId);
            if (!fromT || !toT) continue;
            const dist = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
            const roadCondEff = CONFIG.CONDITION_LEVELS[road.condition || 'new'] ? CONFIG.CONDITION_LEVELS[road.condition || 'new'].efficiency : 1.0;
            if (roadCondEff <= 0) continue; // Skip fully destroyed roads
            const effectiveMultiplier = CONFIG.CARAVAN_ROAD_MULTIPLIER[road.quality] * Math.max(0.1, roadCondEff);
            const cost = dist / effectiveMultiplier;
            adjacency[road.fromTownId].push({ town: road.toTownId, cost, road, type: 'road' });
            adjacency[road.toTownId].push({ town: road.fromTownId, cost, road, type: 'road' });
        }

        // Also include sea routes in pathfinding
        if (world.seaRoutes) {
            for (const route of world.seaRoutes) {
                const fromT = findTown(route.fromTownId);
                const toT = findTown(route.toTownId);
                if (!fromT || !toT) continue;
                // Sea routes are faster (distance / SEA_SPEED_MULTIPLIER)
                const cost = route.distance / (CONFIG.SEA_SPEED_MULTIPLIER || 1.5);
                adjacency[route.fromTownId].push({ town: route.toTownId, cost, road: route, type: 'sea' });
                adjacency[route.toTownId].push({ town: route.fromTownId, cost, road: route, type: 'sea' });
            }
        }

        // Add off-road edges: any two non-island towns on the same landmass
        // Off-road cost is terrain-aware (mountains extremely slow, grassland moderate)
        for (let i = 0; i < world.towns.length; i++) {
            const tA = world.towns[i];
            if (tA.isIsland) continue;
            for (let j = i + 1; j < world.towns.length; j++) {
                const tB = world.towns[j];
                if (tB.isIsland) continue;
                // Check the path isn't over large water (must be traversable by land)
                const waterInfo = checkWaterPath(tA.x, tA.y, tB.x, tB.y);
                if (waterInfo > 0.05) continue; // Off-road can't cross water bodies
                const d = Math.hypot(tA.x - tB.x, tA.y - tB.y);
                // Compute terrain-aware cost
                const avgTerrainCost = getOffroadCost(tA.x, tA.y, tB.x, tB.y);
                if (avgTerrainCost === null) continue; // impassable (water tile found)
                const cost = d * avgTerrainCost;
                const dominantTerrain = getDominantTerrain(tA.x, tA.y, tB.x, tB.y);
                const offroadEdge = { fromTownId: tA.id, toTownId: tB.id, type: 'offroad', quality: 0, dominantTerrain };
                adjacency[tA.id].push({ town: tB.id, cost, road: offroadEdge, type: 'offroad' });
                adjacency[tB.id].push({ town: tA.id, cost, road: offroadEdge, type: 'offroad' });
            }
        }

        const dist = {};
        const prev = {};
        const visited = new Set();
        for (const town of world.towns) dist[town.id] = Infinity;
        dist[fromTownId] = 0;

        // Simple priority queue (array-based, fine for < 50 nodes)
        const queue = [{ id: fromTownId, cost: 0 }];

        while (queue.length > 0) {
            queue.sort((a, b) => a.cost - b.cost);
            const { id: current } = queue.shift();
            if (visited.has(current)) continue;
            visited.add(current);
            if (current === toTownId) break;

            for (const edge of (adjacency[current] || [])) {
                const newDist = dist[current] + edge.cost;
                if (newDist < dist[edge.town]) {
                    dist[edge.town] = newDist;
                    prev[edge.town] = { from: current, road: edge.road };
                    queue.push({ id: edge.town, cost: newDist });
                }
            }
        }

        // Reconstruct path
        const path = [];
        let current = toTownId;
        while (prev[current]) {
            path.unshift(prev[current].road);
            current = prev[current].from;
        }
        return path.length > 0 ? path : null;
    }

    // ========================================================
    // §19A  KINGDOM PROCUREMENT AI
    // ========================================================
    function tickKingdomProcurement(kingdom) {
        if (!world || !kingdom) return;
        if (!kingdom.procurement) {
            kingdom.procurement = { orders: [], deals: [], needs: {}, preferredMerchants: {}, lastAssessmentDay: 0 };
        }
        if (!kingdom.militaryStockpile) {
            kingdom.militaryStockpile = { swords: 0, armor: 0, bows: 0, arrows: 0, horses: 0 };
        }
        const rng = world.rng;
        const proc = kingdom.procurement;

        // --- 1. Assess needs ---
        proc.needs = {};
        const kingdomTowns = world.towns.filter(t => t.kingdomId === kingdom.id);
        const capitalTown = kingdomTowns.find(t => t.isCapital) || kingdomTowns[0];
        if (!capitalTown) return;

        const totalPop = kingdomTowns.reduce((s, t) => {
            const pop = (t._popOverride || CONFIG.PEOPLE_PER_TOWN);
            return s + pop;
        }, 0);
        const armySize = world.people.filter(p => p.alive && p.kingdomId === kingdom.id &&
            (p.occupation === 'soldier' || p.occupation === 'guard')).length;
        const isAtWar = kingdom.atWar && kingdom.atWar.size > 0;
        const warIntensity = isAtWar ? Math.min(100, 40 + kingdom.atWar.size * 20) : 0;

        // Military goods during wartime
        if (isAtWar || armySize > 10) {
            const stockpile = kingdom.militaryStockpile;
            const milGoods = [
                { id: 'swords', needed: Math.max(0, armySize - (stockpile.swords || 0)) },
                { id: 'armor',  needed: Math.max(0, Math.floor(armySize * 0.8) - (stockpile.armor || 0)) },
                { id: 'bows',   needed: Math.max(0, Math.floor(armySize * 0.4) - (stockpile.bows || 0)) },
                { id: 'arrows', needed: Math.max(0, Math.floor(armySize * 2) - (stockpile.arrows || 0)) },
                { id: 'horses', needed: Math.max(0, Math.floor(armySize * 0.2) - (stockpile.horses || 0)) },
            ];
            for (const mg of milGoods) {
                if (mg.needed > 0) {
                    const urgency = isAtWar ? Math.min(100, 50 + warIntensity * 0.5) : 30;
                    proc.needs[mg.id] = { urgency: Math.round(urgency), qtyNeeded: mg.needed };
                }
            }
        }

        // Food when towns are low
        let totalFoodSupply = 0;
        for (const t of kingdomTowns) {
            if (!t.market || !t.market.supply) continue;
            totalFoodSupply += (t.market.supply.bread || 0) + (t.market.supply.meat || 0) +
                (t.market.supply.wheat || 0) + (t.market.supply.fish || 0) +
                (t.market.supply.poultry || 0) + (t.market.supply.eggs || 0);
        }
        const foodRatio = totalPop > 0 ? totalFoodSupply / totalPop : 1;
        if (foodRatio < 2) {
            const urgency = Math.round(Math.min(100, (2 - foodRatio) * 50));
            const needed = Math.max(20, Math.floor(totalPop * (2 - foodRatio)));
            proc.needs.bread = { urgency: urgency, qtyNeeded: needed };
        }

        // Construction materials
        const recentDisasters = (world.eventLog || []).filter(e =>
            e.day > world.day - 60 && e.message && e.message.includes(kingdom.name) &&
            (e.message.includes('fire') || e.message.includes('earthquake') || e.message.includes('storm'))
        ).length;
        if (recentDisasters > 0 || kingdom.prosperity < 35) {
            const constructionUrgency = Math.min(100, 30 + recentDisasters * 20);
            const qtyBase = 20 + recentDisasters * 15;
            proc.needs.wood = proc.needs.wood || { urgency: constructionUrgency, qtyNeeded: qtyBase };
            proc.needs.stone = proc.needs.stone || { urgency: constructionUrgency, qtyNeeded: qtyBase };
            proc.needs.iron = proc.needs.iron || { urgency: Math.floor(constructionUrgency * 0.7), qtyNeeded: Math.floor(qtyBase * 0.5) };
        }

        // General goods for economy
        const generalGoods = ['tools', 'cloth', 'salt'];
        for (const gId of generalGoods) {
            let totalSupply = 0;
            for (const t of kingdomTowns) {
                if (t.market && t.market.supply) totalSupply += (t.market.supply[gId] || 0);
            }
            if (totalSupply < Math.floor(totalPop * 0.1)) {
                proc.needs[gId] = proc.needs[gId] || {
                    urgency: 20,
                    qtyNeeded: Math.max(10, Math.floor(totalPop * 0.1) - totalSupply),
                };
            }
        }

        // --- 2. Try local market first ---
        for (const resId in proc.needs) {
            const need = proc.needs[resId];
            let bought = 0;
            for (const t of kingdomTowns) {
                if (!t.market || !t.market.supply) continue;
                const available = t.market.supply[resId] || 0;
                const price = getMarketPrice(t, resId);
                const canAfford = Math.floor(kingdom.gold / Math.max(1, price));
                const toBuy = Math.min(available, need.qtyNeeded - bought, canAfford, Math.floor(available * 0.5));
                if (toBuy > 0) {
                    const cost = toBuy * price;
                    kingdom.gold -= cost;
                    t.market.supply[resId] = (t.market.supply[resId] || 0) - toBuy;
                    bought += toBuy;
                    // Bug 1 fix: collect trade tax on kingdom procurement
                    collectTradeTax(t.kingdomId, cost, resId);
                    // Add to stockpile if military
                    if (kingdom.militaryStockpile.hasOwnProperty(resId)) {
                        kingdom.militaryStockpile[resId] = (kingdom.militaryStockpile[resId] || 0) + toBuy;
                    }
                }
                if (bought >= need.qtyNeeded) break;
            }
            need.qtyNeeded -= bought;
        }

        // --- 3/4. Post orders for unmet needs ---
        const bannedGoods = (kingdom.laws && kingdom.laws.bannedGoods) || [];
        for (const resId in proc.needs) {
            const need = proc.needs[resId];
            if (need.qtyNeeded <= 0) continue;
            // Check for existing open order for this resource
            const existingOrder = proc.orders.find(o => o.resourceId === resId && (o.status === 'open' || o.status === 'assigned'));
            if (existingOrder) continue;
            // Post order when qty > 50 or urgency > 60
            if (need.qtyNeeded > 50 || need.urgency > 60) {
                const res = findResourceById(resId);
                const marketPrice = res ? res.basePrice : 10;
                const deadlineDays = Math.max(60, Math.min(360, Math.floor(need.qtyNeeded * 2)));
                const order = {
                    id: 'order_' + kingdom.id + '_' + world.day + '_' + resId,
                    kingdomId: kingdom.id,
                    resourceId: resId,
                    qty: need.qtyNeeded,
                    qtyDelivered: 0,
                    maxPricePerUnit: Math.ceil(marketPrice * (bannedGoods.indexOf(resId) !== -1 ? 1.95 : 1.3)),
                    deliveryTownId: capitalTown.id,
                    postedDay: world.day,
                    deadlineDay: world.day + deadlineDays,
                    status: 'open',
                    bids: [],
                    assignedTo: null,
                    assignedPrice: null,
                    requiresPermit: bannedGoods.indexOf(resId) !== -1,
                    bonusOnCompletion: 0,
                };
                proc.orders.push(order);
            }
        }

        // --- 5. Evaluate bids ---
        for (const order of proc.orders) {
            if (order.status !== 'open') continue;
            if (order.bids.length === 0) {
                // Re-post with higher price after 14 days with no bids
                if (world.day - order.postedDay > 14) {
                    order.maxPricePerUnit = Math.ceil(order.maxPricePerUnit * 1.2);
                    order.postedDay = world.day; // reset timer
                }
                continue;
            }
            const daysSincePost = world.day - order.postedDay;
            const shouldEvaluate = daysSincePost >= 7 || (proc.needs[order.resourceId] && proc.needs[order.resourceId].urgency > 80);
            if (!shouldEvaluate) continue;

            // Score each bid
            let bestScore = -1;
            let bestBid = null;
            for (const bid of order.bids) {
                const pref = proc.preferredMerchants[bid.merchantId] || { reliability: 50, completedOrders: 0, failedOrders: 0 };
                const reliabilityScore = pref.reliability / 100;
                // Net worth approximation: for elite merchants check gold, for player use a baseline
                const netWorthScore = Math.min(1, (bid.netWorth || 1000) / 10000);
                // Reputation with kingdom
                const repScore = Math.min(1, (bid.reputation || 50) / 100);
                // Price competitiveness (lower = better)
                const lowestBidPrice = Math.min(...order.bids.map(b => b.pricePerUnit));
                const priceScore = lowestBidPrice > 0 ? lowestBidPrice / bid.pricePerUnit : 1;

                const totalScore = reliabilityScore * 0.30 + netWorthScore * 0.15 + repScore * 0.25 + priceScore * 0.30;
                if (totalScore > bestScore) {
                    bestScore = totalScore;
                    bestBid = bid;
                }
            }
            if (bestBid) {
                order.status = 'assigned';
                order.assignedTo = bestBid.merchantId;
                order.assignedPrice = bestBid.pricePerUnit;
                order.bonusOnCompletion = Math.floor(order.qty * bestBid.pricePerUnit * (0.10 + rng.random() * 0.10));
            }
        }

        // --- Expire/fail old orders ---
        for (const order of proc.orders) {
            if (order.status === 'open' && world.day > order.deadlineDay) {
                order.status = 'expired';
            }
            if (order.status === 'assigned' && world.day > order.deadlineDay && order.qtyDelivered < order.qty) {
                order.status = 'failed';
                const pref = proc.preferredMerchants[order.assignedTo];
                if (pref) {
                    pref.reliability = Math.max(0, pref.reliability - 20);
                    pref.failedOrders = (pref.failedOrders || 0) + 1;
                }
            }
        }

        // Prune completed/expired/failed orders older than 360 days
        proc.orders = proc.orders.filter(o =>
            (o.status === 'open' || o.status === 'assigned') || (world.day - o.postedDay < 360)
        );
        proc.lastAssessmentDay = world.day;
    }

    // ========================================================
    // §19A1  ELITE MERCHANT COUNT MANAGEMENT
    // ========================================================
    function createEliteMerchantFromNPC(npc) {
        npc.isEliteMerchant = true;
        npc.occupation = 'merchant';
        npc.wealthClass = 'upper';
        npc.name = (npc.firstName || '') + ' ' + (npc.lastName || '');
        if (!npc.npcMerchantInventory) npc.npcMerchantInventory = {};
        if (!npc.buildings) npc.buildings = [];
        if (npc.npcMerchantCooldown == null) npc.npcMerchantCooldown = 0;
        // Promotion gold bonus — ensure EMs start with enough capital to operate
        var minGold = 2000;
        var age = npc.age || 30;
        if (age <= 35) minGold = 1500;
        else if (age <= 50) minGold = 3000;
        else minGold = 5000;
        if ((npc.gold || 0) < minGold) {
            npc.gold = minGold + Math.floor((world.rng ? world.rng.random() : Math.random()) * 2000);
        }
        // Assign unused heraldry
        if (!npc.heraldry && typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var usedHeraldry = world.eliteMerchants.map(function(m) { return m.heraldry; }).filter(Boolean);
            var available = ELITE_MERCHANT_HERALDRY.filter(function(h) { return usedHeraldry.indexOf(h) === -1; });
            if (available.length > 0) {
                npc.heraldry = available[Math.floor(world.rng.random() * available.length)];
            } else {
                var hIdx = 0;
                for (var ci = 0; ci < (npc.id || '').length; ci++) hIdx = (hIdx * 31 + (npc.id || '').charCodeAt(ci)) | 0;
                hIdx = Math.abs(hIdx) % ELITE_MERCHANT_HERALDRY.length;
                npc.heraldry = ELITE_MERCHANT_HERALDRY[hIdx];
            }
        }
        npc._eliteFieldsInit = false;
        return npc;
    }

    function generateFreshEliteMerchant() {
        var rng = world.rng;
        if (!rng) return null;
        // Weighted town selection — higher prosperity towns attract more elite merchants
        var townWeights = world.towns.map(function(t) {
            var base = t.population || 100;
            var prospBonus = (t.prosperity || 50) / 50; // 0-2x multiplier
            var tierBonus = t.tier === 'capital' ? 3 : t.tier === 'city' ? 2 : t.tier === 'town' ? 1 : 0.3;
            return base * prospBonus * tierBonus;
        });
        var totalWeight = townWeights.reduce(function(s, w) { return s + w; }, 0);
        var roll = rng.random() * totalWeight;
        var cumulative = 0;
        var selectedTown = world.towns[0];
        for (var twi = 0; twi < world.towns.length; twi++) {
            cumulative += townWeights[twi];
            if (roll <= cumulative) { selectedTown = world.towns[twi]; break; }
        }
        var town = selectedTown;
        if (!town) return null;
        var sex = rng.chance(0.5) ? 'M' : 'F';
        var firstName = sex === 'M' ? rng.pick(NAMES.male) : rng.pick(NAMES.female);
        var lastName = rng.pick(NAMES.surnames);
        var age = rng.randInt(25, 55);
        var gold;
        if (age <= 35) gold = rng.randInt(500, 2000);
        else if (age <= 50) gold = rng.randInt(2000, 8000);
        else gold = rng.randInt(5000, 15000);

        var person = {
            id: uid('p'),
            firstName: firstName,
            lastName: lastName,
            age: age,
            sex: sex,
            alive: true,
            townId: town.id,
            kingdomId: town.kingdomId,
            occupation: 'merchant',
            employerId: null,
            needs: {
                food: rng.randInt(50, 80),
                shelter: rng.randInt(55, 85),
                safety: rng.randInt(50, 80),
                wealth: rng.randInt(40, 70),
                happiness: rng.randInt(50, 75),
            },
            gold: gold,
            skills: { farming: 5, mining: 5, crafting: 5, trading: rng.randInt(30, 70), combat: 5 },
            workerSkill: rng.randInt(30, 70),
            spouseId: null,
            childrenIds: [],
            parentIds: [],
            wealthClass: 'upper',
            isEliteMerchant: true,
            npcMerchantInventory: {},
            buildings: [],
            npcMerchantCooldown: 0,
            personality: {
                loyalty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                ambition:     Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                frugality:    Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                intelligence: Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                warmth:       Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
                honesty:      Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100),
            },
            quirks: assignRandomQuirks(rng),
            foodPreferences: { bread: 1, meat: 1, poultry: 1, fish: 1, eggs: 1, preserved_food: 1 },
            recentFoods: [],
            houseType: gold > 5000 ? 'manor' : 'townhouse',
        };
        // Assign heraldry
        if (typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var usedHeraldry = world.eliteMerchants.map(function(m) { return m.heraldry; }).filter(Boolean);
            var available = ELITE_MERCHANT_HERALDRY.filter(function(h) { return usedHeraldry.indexOf(h) === -1; });
            if (available.length > 0) {
                person.heraldry = available[Math.floor(rng.random() * available.length)];
            } else {
                person.heraldry = ELITE_MERCHANT_HERALDRY[Math.floor(rng.random() * ELITE_MERCHANT_HERALDRY.length)];
            }
        }
        person._eliteFieldsInit = false;
        person.name = firstName + ' ' + lastName;
        world.people.push(person);
        if (town) town.population++;
        if (world._alivePopCount != null) world._alivePopCount++;
        return person;
    }

    function emitTrackedEMNotification(em, message, details) {
        if (typeof Player === 'undefined') return;
        if (!Player.hasSkill || !Player.hasSkill('elite_tracker')) return;
        if (!Player.isTrackingMerchant || !Player.isTrackingMerchant(em.id)) return;
        // 50% chance to receive the notification
        if (world.rng && world.rng.random() > 0.50) return;
        var fullMsg = '⭐ ' + (em.firstName || 'Unknown') + ' ' + (em.lastName || '') + ': ' + message;
        logEvent(fullMsg, Object.assign({ category: 'tracked', emId: em.id }, details || {}));
        if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast(fullMsg, 'info', 'tracked');
        }
    }

    function tickEliteMerchantDynamics() {
        if (!world || !world.eliteMerchants) return;
        
        var emTarget = Math.max(CONFIG.ELITE_MERCHANT_MIN, Math.min(CONFIG.ELITE_MERCHANT_MAX, Math.ceil(world.towns.length / CONFIG.ELITE_MERCHANT_PER_TOWNS)));
        
        // ── Growth check: RARE EM emergence ──
        if (world.day % (CONFIG.ELITE_MERCHANT_GROWTH_INTERVAL || 60) === 0 && world.eliteMerchants.length < emTarget) {
            // Track economy for growth detection
            var totalGold = 0;
            for (var gi = 0; gi < world.people.length; gi++) {
                if (world.people[gi].alive) totalGold += (world.people[gi].gold || 0);
            }
            for (var ki = 0; ki < world.kingdoms.length; ki++) {
                totalGold += (world.kingdoms[ki].gold || 0);
            }
            if (!world._lastEconomyGold) world._lastEconomyGold = totalGold;
            var growthRate = (totalGold - world._lastEconomyGold) / Math.max(1, world._lastEconomyGold);
            world._lastEconomyGold = totalGold;
            
            // STRICT CONDITIONS for EM emergence:
            // 1. Find a qualifying town (prosperity > 75)
            var qualifyingTowns = world.towns.filter(function(t) {
                return (t.prosperity || 0) > 75 && (t.tier === 'capital' || t.tier === 'city');
            });
            
            if (qualifyingTowns.length > 0 && growthRate > 0.15) {
                // 2. Check that the kingdom of the qualifying town is also prosperous
                var candidateTown = null;
                for (var qi = 0; qi < qualifyingTowns.length; qi++) {
                    var qt = qualifyingTowns[qi];
                    var qk = findKingdom(qt.kingdomId);
                    if (qk && (qk.gold || 0) > 3000) {
                        // 3. Kingdom must not be at war
                        var atWar = qk.atWar && qk.atWar.size > 0;
                        if (!atWar) {
                            candidateTown = qt;
                            break;
                        }
                    }
                }
                
                if (candidateTown) {
                    // 4. Even with all conditions met, only 20% chance
                    if (rng.random() < 0.20) {
                        // Find the wealthiest NPC merchant in that town
                        var candidates = world.people.filter(function(p) {
                            return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant 
                                && p.townId === candidateTown.id && (p.gold || 0) > 300;
                        });
                        candidates.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                        
                        if (candidates.length > 0) {
                            var promoted = candidates[0];
                            createEliteMerchantFromNPC(promoted);
                            world.eliteMerchants.push(promoted);
                            logEvent('🌟 ' + (promoted.firstName || '') + ' ' + (promoted.lastName || '') + ' of ' + (candidateTown.name || 'unknown') + ' has risen to become a renowned elite merchant! The booming economy of ' + (candidateTown.name || 'the town') + ' breeds new merchant dynasties.', { townId: promoted.townId, category: 'npc_activity' });
                        } else {
                            // No local merchant to promote — generate fresh in that town
                            var newElite = generateFreshEliteMerchant();
                            if (newElite) {
                                newElite.townId = candidateTown.id;
                                newElite.kingdomId = candidateTown.kingdomId;
                                world.eliteMerchants.push(newElite);
                                logEvent('🌟 A new elite merchant, ' + (newElite.firstName || '') + ' ' + (newElite.lastName || '') + ', emerges in prosperous ' + (candidateTown.name || 'unknown') + '!', { townId: candidateTown.id, category: 'npc_activity' });
                            }
                        }
                    }
                }
            }
            
            // Fallback: if BELOW minimum, still force-fill (game needs some EMs)
            if (world.eliteMerchants.length < CONFIG.ELITE_MERCHANT_MIN) {
                var fallbackCandidates = world.people.filter(function(p) {
                    return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant && (p.gold || 0) > 200;
                });
                fallbackCandidates.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); });
                if (fallbackCandidates.length > 0) {
                    var fb = fallbackCandidates[0];
                    createEliteMerchantFromNPC(fb);
                    world.eliteMerchants.push(fb);
                    logEvent('🎯 ' + (fb.firstName || '') + ' ' + (fb.lastName || '') + ' has risen to fill the ranks of elite merchants.', { townId: fb.townId, category: 'npc_activity' });
                } else {
                    var newFb = generateFreshEliteMerchant();
                    if (newFb) world.eliteMerchants.push(newFb);
                }
            }
        }
        
        // ── Decline: check for bankrupt EMs ──
        for (var bi = world.eliteMerchants.length - 1; bi >= 0; bi--) {
            var em = world.eliteMerchants[bi];
            if (!em || !em.alive) continue;
            
            if ((em.gold || 0) < (CONFIG.ELITE_MERCHANT_BANKRUPTCY_GOLD || 50)) {
                em._bankruptDays = (em._bankruptDays || 0) + 1;
                if (em._bankruptDays === 1) {
                    emitTrackedEMNotification(em, 'is struggling financially! Gold below ' + (CONFIG.ELITE_MERCHANT_BANKRUPTCY_GOLD || 50) + 'g.', { townId: em.townId });
                }
            } else {
                em._bankruptDays = 0;
            }
            
            // Demote if bankrupt too long AND we're above minimum
            if (em._bankruptDays >= (CONFIG.ELITE_MERCHANT_BANKRUPTCY_DAYS || 30) && 
                world.eliteMerchants.length > CONFIG.ELITE_MERCHANT_MIN) {
                em.isEliteMerchant = false;
                em.wealthClass = 'middle';
                em._eliteFieldsInit = false;
                world.eliteMerchants.splice(bi, 1);
                logEvent('📉 ' + (em.firstName || '') + ' ' + (em.lastName || '') + ' has lost their elite merchant status due to bankruptcy.', { townId: em.townId, category: 'npc_activity' });
            }
        }
    }

    function ensureEliteMerchantCount() {
        if (!world || !world.eliteMerchants) return;
        // Remove dead ones
        world.eliteMerchants = world.eliteMerchants.filter(function(m) { return m.alive !== false; });

        // Refill only to minimum — dynamic target is reached organically via tickEliteMerchantDynamics
        while (world.eliteMerchants.length < CONFIG.ELITE_MERCHANT_MIN) {
            var merchants = world.people.filter(function(p) {
                return p.alive && p.occupation === 'merchant' && !p.isEliteMerchant;
            });
            // Calculate value: gold + building count * 500 as rough proxy
            merchants.sort(function(a, b) {
                var aVal = (a.gold || 0) + ((a.buildings ? a.buildings.length : 0) * 500);
                var bVal = (b.gold || 0) + ((b.buildings ? b.buildings.length : 0) * 500);
                return bVal - aVal;
            });

            if (merchants.length > 0) {
                var promoted = merchants[0];
                createEliteMerchantFromNPC(promoted);
                world.eliteMerchants.push(promoted);
                logEvent('\uD83D\uDCC8 ' + promoted.firstName + ' ' + (promoted.lastName || '') + ' has risen to become a renowned elite merchant!', {
                    type: 'elite_promotion',
                    cause: promoted.firstName + ' ' + (promoted.lastName || '') + ' accumulated enough wealth and reputation to join the elite merchant ranks.',
                    effects: [
                        'A new elite merchant dynasty begins',
                        promoted.firstName + ' gains access to elite trade networks',
                        'Competition among elite merchants intensifies'
                    ]
                }, 'npc_activity');
            } else {
                var newElite = generateFreshEliteMerchant();
                if (newElite) {
                    world.eliteMerchants.push(newElite);
                }
            }
        }
    }

    // ========================================================
    // §19A2  ELITE MERCHANT DEEP AI SIMULATION
    // ========================================================
    const ELITE_STRATEGIES = ['food_monopoly', 'military_supplier', 'luxury_trader', 'diversified', 'political_climber', 'war_profiteer', 'land_baron', 'trade_network'];

    const STRATEGY_GOODS = {
        food_monopoly:     ['wheat', 'bread', 'meat', 'fish', 'eggs', 'flour', 'preserved_food'],
        military_supplier: ['swords', 'armor', 'bows', 'iron', 'iron_ore', 'tools', 'weapons'],
        luxury_trader:     ['jewelry', 'wine', 'silk', 'spices', 'gold_ore', 'dye', 'furniture'],
        diversified:       ['wheat', 'cloth', 'tools', 'iron', 'wood', 'bread', 'wool'],
        political_climber: ['wine', 'jewelry', 'silk', 'furniture', 'spices'],
        war_profiteer:     ['swords', 'armor', 'bows', 'bread', 'preserved_food', 'iron', 'weapons'],
        land_baron:        ['wheat', 'wood', 'stone', 'wool', 'iron_ore'],
        trade_network:     ['cloth', 'tools', 'salt', 'spices', 'wine', 'dye'],
    };

    const STRATEGY_BUILDINGS = {
        food_monopoly:     ['wheat_farm', 'flour_mill', 'bakery', 'cattle_ranch', 'fishery', 'smokehouse', 'chicken_farm', 'restaurant'],
        military_supplier: ['blacksmith', 'iron_mine', 'smelter', 'toolsmith', 'armory_shop'],
        luxury_trader:     ['jeweler', 'vineyard', 'winery', 'weaver', 'jewelers_boutique', 'clothing_shop'],
        diversified:       ['wheat_farm', 'bakery', 'blacksmith', 'weaver', 'sawmill', 'tanner', 'general_store', 'tavern'],
        political_climber: ['vineyard', 'winery', 'jeweler', 'market_stall', 'jewelers_boutique'],
        war_profiteer:     ['blacksmith', 'smelter', 'iron_mine', 'bakery', 'armory_shop'],
        land_baron:        ['wheat_farm', 'cattle_ranch', 'sheep_farm', 'lumber_camp', 'iron_mine', 'pig_farm', 'restaurant'],
        trade_network:     ['market_stall', 'weaver', 'salt_works', 'rope_maker', 'general_store', 'tavern'],
    };

    function ensureEliteMerchantFields(em) {
        if (em._eliteFieldsInit) return;
        var rng = world.rng;
        // Personality — extend existing; preserve old values
        if (!em.personality) em.personality = {};
        var p = em.personality;
        if (p.ambition == null || typeof p.ambition === 'string') p.ambition = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.greed == null || typeof p.greed === 'string') p.greed = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.risk_tolerance == null) p.risk_tolerance = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.honesty == null || typeof p.honesty === 'string') p.honesty = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.social == null) p.social = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.loyalty == null || typeof p.loyalty === 'string') p.loyalty = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.militarism == null) p.militarism = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);
        if (p.patience == null) p.patience = Math.floor((rng.random() + rng.random() + rng.random()) / 3 * 100);

        if (!em.strategy) {
            // Pick strategy influenced by personality
            if (p.militarism > 65) em.strategy = rng.chance(0.5) ? 'military_supplier' : 'war_profiteer';
            else if (p.ambition > 70 && p.social > 60) em.strategy = 'political_climber';
            else if (p.greed > 65 && p.patience > 55) em.strategy = 'land_baron';
            else if (p.risk_tolerance > 65) em.strategy = rng.pick(['luxury_trader', 'trade_network']);
            else if (p.patience > 60) em.strategy = 'food_monopoly';
            else em.strategy = rng.pick(ELITE_STRATEGIES);
        }

        if (!em.relationships) em.relationships = {};
        if (!em.socialRank) em.socialRank = {};
        if (em.citizenshipKingdomId == null) em.citizenshipKingdomId = em.kingdomId || null;
        if (!em.reputation) {
            em.reputation = {};
            if (em.kingdomId) em.reputation[em.kingdomId] = 50 + Math.floor(rng.random() * 30);
        }
        if (!em.familyName) em.familyName = em.lastName || em.firstName || 'Unknown';
        if (!em.name || em.name === 'Unknown') em.name = (em.firstName || '') + ' ' + (em.lastName || em.familyName || '');
        if (em.heirId === undefined) em.heirId = null;
        if (em.netWorth === undefined) em.netWorth = 0;
        if (em.ordersCompleted === undefined) em.ordersCompleted = 0;
        if (em.ordersFailed === undefined) em.ordersFailed = 0;
        if (em.crimesCommitted === undefined) em.crimesCommitted = 0;
        if (!em.criminalRecord) em.criminalRecord = {};
        if (em.tradingStartDay === undefined) em.tradingStartDay = 0;
        if (!em.supplyDeals) em.supplyDeals = [];
        if (em.jailedUntilDay === undefined) em.jailedUntilDay = 0;
        // Kingdom-aware AI tracking fields
        if (!em._kingdomAwareness) em._kingdomAwareness = {};
        if (em._lastCollapseCheck === undefined) em._lastCollapseCheck = 0;
        if (em._lastMigrationCheck === undefined) em._lastMigrationCheck = 0;
        if (em._assetsDiversified === undefined) em._assetsDiversified = false;
        if (em._seizureVictim === undefined) em._seizureVictim = false;
        if (em._nationalizedPivot === undefined) em._nationalizedPivot = false;
        if (em._bountiesFulfilled === undefined) em._bountiesFulfilled = 0;
        if (em._kingRelationship === undefined) em._kingRelationship = {};
        if (em._competitorTracking === undefined) em._competitorTracking = {};
        // Social rank init: 1 (citizen) for most, higher for wealthy
        if (!em.socialRank[em.kingdomId || '']) {
            var rankIdx = 1;
            if ((em.gold || 0) >= 5000) rankIdx = 2;
            if ((em.gold || 0) >= 20000) rankIdx = 3;
            if (em.kingdomId) em.socialRank[em.kingdomId] = rankIdx;
        }

        em._eliteFieldsInit = true;

        // Heraldry assignment (fallback for merchants without heraldry)
        if (!em.heraldry && typeof ELITE_MERCHANT_HERALDRY !== 'undefined' && ELITE_MERCHANT_HERALDRY.length > 0) {
            var hIdx = 0;
            for (var ci = 0; ci < (em.id || '').length; ci++) hIdx = (hIdx * 31 + (em.id || '').charCodeAt(ci)) | 0;
            hIdx = Math.abs(hIdx) % ELITE_MERCHANT_HERALDRY.length;
            em.heraldry = ELITE_MERCHANT_HERALDRY[hIdx];
        }

        // Housing: assign house type based on wealth
        if (!em.houseType) {
            if ((em.gold || 0) > 5000) em.houseType = rng.pick(['merchant_house', 'manor']);
            else if ((em.gold || 0) > 1000) em.houseType = 'townhouse';
            else if ((em.gold || 0) > 200) em.houseType = 'cottage';
            else em.houseType = rng.chance(0.7) ? 'shack' : null;
        }
    }

    // ── NPC Caravan System (EM + Kingdom) ──────────────────────────

    function tickEMCaravans() {
        if (!world || !world.eliteMerchants) return;
        if (world.day % (CONFIG.EM_CARAVAN_DECISION_INTERVAL || 7) !== 0) return;

        var rng = world.rng;
        if (!rng) return;
        if (!world.npcCaravans) world.npcCaravans = [];

        for (var ei = 0; ei < world.eliteMerchants.length; ei++) {
            var em = world.eliteMerchants[ei];
            if (!em || !em.alive || em.traveling) continue;

            // Count active caravans for this EM
            var activeCaravans = 0;
            for (var ci = 0; ci < world.npcCaravans.length; ci++) {
                if (world.npcCaravans[ci].ownerId === em.id && world.npcCaravans[ci].status !== 'completed') {
                    activeCaravans++;
                }
            }
            if (activeCaravans >= (CONFIG.EM_CARAVAN_MAX_PER_EM || 4)) continue;

            // Can they afford it?
            var hireCost = CONFIG.EM_CARAVAN_HIRE_COST || 200;
            if ((em.gold || 0) < hireCost * 1.5) continue;

            // Find best destination based on strategy and arbitrage
            var town = findTown(em.townId);
            if (!town || !town.connectedTowns || town.connectedTowns.length === 0) continue;

            var strategy = em.strategy || 'diversified';
            var preferredGoods = (typeof STRATEGY_GOODS !== 'undefined' && STRATEGY_GOODS[strategy]) || [];
            var inv = em.npcMerchantInventory || {};

            var bestDest = null;
            var bestScore = 0;
            var bestGoods = {};

            for (var di = 0; di < town.connectedTowns.length; di++) {
                var dest = findTown(town.connectedTowns[di]);
                if (!dest || !dest.market) continue;

                var score = 0;
                var sendGoods = {};
                var totalWeight = 0;
                var maxCapacity = Math.min(CONFIG.EM_CARAVAN_CAPACITY_MAX || 200,
                                           CONFIG.EM_CARAVAN_CAPACITY_MIN + Math.floor((em.gold || 0) / 50));

                // Score based on goods we can send from inventory
                for (var resId in inv) {
                    if ((inv[resId] || 0) <= 2) continue;
                    var localPrice = (town.market.prices[resId] || 0);
                    var destPrice = (dest.market.prices[resId] || 0);

                    if (destPrice > localPrice * 1.2) {
                        var sendQty = Math.min(inv[resId] - 2, maxCapacity - totalWeight);
                        if (sendQty > 0) {
                            sendGoods[resId] = sendQty;
                            totalWeight += sendQty;
                            score += (destPrice - localPrice) * sendQty;
                        }
                    }
                }

                // Score buying opportunities at destination (for return trip)
                for (var rk in dest.market.prices) {
                    var dPrice = dest.market.prices[rk] || 0;
                    var lPrice = town.market.prices[rk] || 0;
                    if (dPrice > 0 && lPrice > dPrice * 1.3) {
                        score += (lPrice - dPrice) * 5;
                    }
                }

                // Prosperity bonus for destination
                score += (dest.prosperity || 50) * 0.5;

                if (score > bestScore) {
                    bestScore = score;
                    bestDest = dest.id;
                    bestGoods = sendGoods;
                }
            }

            if (bestDest && bestScore > 50) {
                em.gold -= hireCost;

                // Remove goods from EM inventory
                for (var gk in bestGoods) {
                    inv[gk] = (inv[gk] || 0) - bestGoods[gk];
                    if (inv[gk] <= 0) delete inv[gk];
                }

                // Decide mode based on personality
                var mode = 'roundtrip';
                if (em.personality && em.personality.patience > 60 && rng.random() > 0.4) {
                    mode = 'continuous';
                } else if (rng.random() > 0.7) {
                    mode = 'one_way';
                }

                world.npcCaravans.push({
                    id: 'npc_caravan_' + world.day + '_' + ei,
                    ownerId: em.id,
                    ownerType: 'em',
                    fromTownId: em.townId,
                    toTownId: bestDest,
                    goods: bestGoods,
                    capacity: CONFIG.EM_CARAVAN_CAPACITY_MAX || 200,
                    progress: 0,
                    speed: CONFIG.EM_CARAVAN_SPEED || 0.08,
                    startDay: world.day,
                    status: 'traveling',
                    mode: mode,
                    returnGoods: {},
                    tripCount: 0,
                });
                emitTrackedEMNotification(em, 'hired a caravan to ' + ((findTown(bestDest) || {}).name || 'unknown'), { townId: em.townId });
            }
        }
    }

    function tickNPCCaravans() {
        if (!world || !world.npcCaravans) return;

        for (var ci = world.npcCaravans.length - 1; ci >= 0; ci--) {
            var caravan = world.npcCaravans[ci];
            if (!caravan || caravan.status === 'completed') {
                world.npcCaravans.splice(ci, 1);
                continue;
            }

            // Move caravan
            caravan.progress = (caravan.progress || 0) + (caravan.speed || 0.08);

            if (caravan.progress >= 1.0) {
                caravan.progress = 0;

                if (caravan.status === 'traveling') {
                    // Arrived at destination — sell goods
                    var destTown = findTown(caravan.toTownId);
                    if (destTown && destTown.market) {
                        var totalRevenue = 0;
                        for (var resId in caravan.goods) {
                            var qty = caravan.goods[resId] || 0;
                            if (qty <= 0) continue;
                            var price = destTown.market.prices[resId] || 1;
                            var revenue = Math.floor(price * qty * 0.85); // 15% caravan overhead
                            totalRevenue += revenue;
                            destTown.market.supply[resId] = (destTown.market.supply[resId] || 0) + qty;
                        }

                        // Credit owner
                        if (caravan.ownerType === 'em') {
                            var owner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (owner) owner.gold = (owner.gold || 0) + totalRevenue;
                        } else if (caravan.ownerType === 'kingdom') {
                            var kingdom = findKingdom(caravan.ownerId);
                            if (kingdom) kingdom.gold = (kingdom.gold || 0) + totalRevenue;
                        }

                        caravan.tripCount = (caravan.tripCount || 0) + 1;
                        caravan.goods = {};

                        // Decide what to do next
                        if (caravan.mode === 'one_way') {
                            caravan.status = 'completed';
                        } else {
                            // Buy goods at destination for return trip
                            caravan.status = 'returning';
                            var fromTown = findTown(caravan.fromTownId);
                            if (fromTown && fromTown.market) {
                                var budget = Math.min(totalRevenue * 0.8, 500);
                                var spent = 0;
                                var returnGoods = {};
                                for (var rk in destTown.market.prices) {
                                    var dPrice = destTown.market.prices[rk] || 0;
                                    var fPrice = fromTown.market.prices[rk] || 0;
                                    if (dPrice > 0 && fPrice > dPrice * 1.2 && (destTown.market.supply[rk] || 0) > 10) {
                                        var buyQty = Math.min(
                                            Math.floor((budget - spent) / dPrice),
                                            Math.floor((destTown.market.supply[rk] || 0) * 0.2),
                                            caravan.capacity
                                        );
                                        if (buyQty > 0) {
                                            var cost = Math.ceil(dPrice * buyQty);
                                            if (caravan.ownerType === 'em') {
                                                var emOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                                                if (emOwner && (emOwner.gold || 0) >= cost) {
                                                    emOwner.gold -= cost;
                                                    destTown.market.supply[rk] -= buyQty;
                                                    returnGoods[rk] = buyQty;
                                                    spent += cost;
                                                }
                                            } else if (caravan.ownerType === 'kingdom') {
                                                var kOwner = findKingdom(caravan.ownerId);
                                                if (kOwner && (kOwner.gold || 0) >= cost) {
                                                    kOwner.gold -= cost;
                                                    destTown.market.supply[rk] -= buyQty;
                                                    returnGoods[rk] = buyQty;
                                                    spent += cost;
                                                }
                                            }
                                        }
                                    }
                                }
                                caravan.goods = returnGoods;
                            }
                        }
                    }
                } else if (caravan.status === 'returning') {
                    // Arrived back at origin — sell return goods
                    var originTown = findTown(caravan.fromTownId);
                    if (originTown && originTown.market) {
                        var returnRevenue = 0;
                        for (var rr in caravan.goods) {
                            var rQty = caravan.goods[rr] || 0;
                            if (rQty <= 0) continue;
                            var rPrice = originTown.market.prices[rr] || 1;
                            var rRev = Math.floor(rPrice * rQty * 0.85);
                            returnRevenue += rRev;
                            originTown.market.supply[rr] = (originTown.market.supply[rr] || 0) + rQty;
                        }

                        if (caravan.ownerType === 'em') {
                            var retOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (retOwner) retOwner.gold = (retOwner.gold || 0) + returnRevenue;
                        } else if (caravan.ownerType === 'kingdom') {
                            var retK = findKingdom(caravan.ownerId);
                            if (retK) retK.gold = (retK.gold || 0) + returnRevenue;
                        }

                        caravan.goods = {};
                        caravan.tripCount = (caravan.tripCount || 0) + 1;
                    }

                    if (caravan.mode === 'continuous') {
                        // Reload goods from owner inventory and go again
                        caravan.status = 'traveling';
                        if (caravan.ownerType === 'em') {
                            var contOwner = world.people.find(function(p) { return p.id === caravan.ownerId; });
                            if (contOwner && contOwner.npcMerchantInventory) {
                                var contTown = findTown(caravan.fromTownId);
                                var destTownCont = findTown(caravan.toTownId);
                                if (contTown && destTownCont && destTownCont.market) {
                                    var loadGoods = {};
                                    var loadWeight = 0;
                                    var contInv = contOwner.npcMerchantInventory;
                                    for (var lk in contInv) {
                                        if ((contInv[lk] || 0) <= 2) continue;
                                        var lLocal = contTown.market.prices[lk] || 0;
                                        var lDest = destTownCont.market.prices[lk] || 0;
                                        if (lDest > lLocal * 1.1) {
                                            var lQty = Math.min(contInv[lk] - 2, caravan.capacity - loadWeight);
                                            if (lQty > 0) {
                                                loadGoods[lk] = lQty;
                                                contInv[lk] -= lQty;
                                                if (contInv[lk] <= 0) delete contInv[lk];
                                                loadWeight += lQty;
                                            }
                                        }
                                    }
                                    caravan.goods = loadGoods;

                                    // Cancel continuous if no goods to send
                                    if (loadWeight === 0) {
                                        caravan.status = 'completed';
                                    }
                                }
                            }
                        }
                    } else {
                        caravan.status = 'completed';
                    }
                }
            }
        }

        // Cleanup completed caravans
        world.npcCaravans = world.npcCaravans.filter(function(c) { return c.status !== 'completed'; });
    }

    function tickKingdomCaravans() {
        if (!world) return;
        if (world.day % (CONFIG.KINGDOM_CARAVAN_INTERVAL || 14) !== 0) return;
        if (!world.npcCaravans) world.npcCaravans = [];

        var rng = world.rng;
        if (!rng) return;

        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var k = world.kingdoms[ki];
            if (!k || !k.id) continue;
            if ((k.gold || 0) < (CONFIG.KINGDOM_CARAVAN_TREASURY_MIN || 5000)) continue;

            // Only kingdoms with transport law OR generous/ambitious personality
            var hasTransport = k.laws && k.laws.kingdomTransport;
            var isProsperous = k.kingPersonality && (k.kingPersonality.greed === 'generous' || k.kingPersonality.ambition === 'ambitious');
            if (!hasTransport && !isProsperous) continue;

            // Count active kingdom caravans
            var activeKC = 0;
            for (var aci = 0; aci < world.npcCaravans.length; aci++) {
                if (world.npcCaravans[aci].ownerId === k.id && world.npcCaravans[aci].ownerType === 'kingdom') {
                    activeKC++;
                }
            }
            if (activeKC >= (CONFIG.KINGDOM_CARAVAN_MAX || 2)) continue;

            // Find kingdom towns
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
            if (kTowns.length < 2) continue;

            // Find biggest supply gap between kingdom towns
            var bestFrom = null, bestTo = null, bestGap = 0, bestResource = null;
            var stapleGoods = ['wheat', 'bread', 'wood', 'stone', 'planks', 'tools', 'iron', 'meat'];

            for (var fi = 0; fi < kTowns.length; fi++) {
                for (var ti = 0; ti < kTowns.length; ti++) {
                    if (fi === ti) continue;
                    var fromT = kTowns[fi];
                    var toT = kTowns[ti];
                    if (!fromT.market || !toT.market) continue;

                    // Check if connected
                    if (!fromT.connectedTowns || fromT.connectedTowns.indexOf(toT.id) === -1) continue;

                    for (var si = 0; si < stapleGoods.length; si++) {
                        var good = stapleGoods[si];
                        var fromSupply = fromT.market.supply[good] || 0;
                        var toSupply = toT.market.supply[good] || 0;
                        var gap = fromSupply - toSupply;
                        if (gap > 30 && gap > bestGap) {
                            bestGap = gap;
                            bestFrom = fromT.id;
                            bestTo = toT.id;
                            bestResource = good;
                        }
                    }
                }
            }

            if (bestFrom && bestTo && bestResource) {
                var cost = CONFIG.KINGDOM_CARAVAN_COST || 150;
                if ((k.gold || 0) < cost) continue;
                k.gold -= cost;

                var fromTownK = findTown(bestFrom);
                var sendQty = Math.min(bestGap, CONFIG.KINGDOM_CARAVAN_CAPACITY || 100);
                var goods = {};
                goods[bestResource] = sendQty;

                // Remove from source town supply
                if (fromTownK && fromTownK.market) {
                    fromTownK.market.supply[bestResource] = Math.max(0, (fromTownK.market.supply[bestResource] || 0) - sendQty);
                }

                world.npcCaravans.push({
                    id: 'k_caravan_' + world.day + '_' + ki,
                    ownerId: k.id,
                    ownerType: 'kingdom',
                    fromTownId: bestFrom,
                    toTownId: bestTo,
                    goods: goods,
                    capacity: CONFIG.KINGDOM_CARAVAN_CAPACITY || 100,
                    progress: 0,
                    speed: CONFIG.KINGDOM_CARAVAN_SPEED || 0.10,
                    startDay: world.day,
                    status: 'traveling',
                    mode: 'one_way',
                    returnGoods: {},
                    tripCount: 0,
                });
            }
        }
    }

    function tickEliteMerchantAI() {
        if (!world) return;
        var rng = world.rng;
        if (!rng) return;
        var day = world.day;

        var elites = world.people.filter(function(p) { return p.alive && p.isEliteMerchant; });
        for (var i = 0; i < elites.length; i++) {
            var em = elites[i];
            // Stagger: each elite ticks every 3 days on their own slot
            var hash = 0;
            for (var ci = 0; ci < em.id.length; ci++) hash = (hash * 31 + em.id.charCodeAt(ci)) | 0;
            if (Math.abs(hash) % 3 !== day % 3) continue;

            ensureEliteMerchantFields(em);

            // Skip if jailed
            if (em.jailedUntilDay && em.jailedUntilDay > day) continue;

            // ---- 0. PASSIVE BUILDING REVENUE (every tick) ----
            // EMs earn passive income from their buildings based on town prosperity
            var emBuildings = em.buildings || [];
            if (emBuildings.length > 0) {
                var buildingIncome = 0;
                for (var bi2 = 0; bi2 < emBuildings.length; bi2++) {
                    var bld = emBuildings[bi2];
                    if (bld && bld.condition !== 'destroyed') {
                        var bldTown = findTown(bld.townId);
                        var prosper = bldTown ? (bldTown.prosperity || 30) / 100 : 0.3;
                        buildingIncome += Math.floor(5 + 10 * prosper); // 5-15g per building per EM tick
                    }
                }
                em.gold = (em.gold || 0) + buildingIncome;
            }
            // Minimum sustenance: EMs always earn a small amount from their trade networks
            em.gold = (em.gold || 0) + Math.floor(3 + rng.random() * 5);

            var town = findTown(em.townId);
            if (!town) continue;
            var personality = em.personality;
            var strategy = em.strategy || 'diversified';

            // ---- 1. TRADING LOGIC ----
            eliteTradeAI(em, town, rng, strategy);

            // ---- 2. TRAVEL DECISIONS ----
            if (day % 7 === 0 && !em.traveling) {
                eliteTravelAI(em, town, rng, strategy);
            }

            // ---- 3. BUILDING DECISIONS (every 15 days) ----
            if (day % 15 === 0) {
                eliteBuildAI(em, town, rng, strategy);
            }

            // ---- 4. SOCIAL DECISIONS (every 30 days) ----
            if (day % 30 === 0) {
                eliteSocialAI(em, town, rng, personality);
            }

            // ---- 5. RANK ADVANCEMENT (every 60 days) ----
            if (day % 60 === 0 && personality.ambition > 40) {
                eliteRankAI(em, rng);
            }

            // ---- 6. CRIME DECISIONS (rare) ----
            if (day % 30 === 0 && personality.honesty < 40 && personality.risk_tolerance > 60) {
                eliteCrimeAI(em, town, rng, personality);
            }

            // ---- 7. KINGDOM ORDER FULFILLMENT (every 7 days) ----
            // Bidding handled by tickEliteMerchantBidding; delivery logic here (Bug 2 fix)
            if (day % 7 === 0) {
                var inv = em.npcMerchantInventory || {};
                for (var ki = 0; ki < world.kingdoms.length; ki++) {
                    var k = world.kingdoms[ki];
                    if (!k.procurement || !k.procurement.orders) continue;
                    for (var oi = 0; oi < k.procurement.orders.length; oi++) {
                        var order = k.procurement.orders[oi];
                        if (order.status !== 'assigned' || order.assignedTo !== em.id) continue;
                        var remaining = order.qty - order.qtyDelivered;
                        if (remaining <= 0) continue;

                        // Deliver from inventory first
                        var available = inv[order.resourceId] || 0;
                        if (available > 0) {
                            var deliverQty = Math.min(available, remaining);
                            order.qtyDelivered += deliverQty;
                            inv[order.resourceId] -= deliverQty;
                            var payment = deliverQty * order.assignedPrice;
                            em.gold = (em.gold || 0) + payment;
                            k.gold -= payment;
                            collectTradeTax(k.id, payment, order.resourceId);
                            if (k.militaryStockpile && k.militaryStockpile.hasOwnProperty(order.resourceId)) {
                                k.militaryStockpile[order.resourceId] = (k.militaryStockpile[order.resourceId] || 0) + deliverQty;
                            }
                            remaining = order.qty - order.qtyDelivered;
                        }

                        // If still unmet, buy from local market to fill the order
                        if (remaining > 0 && town.market && town.market.supply) {
                            var marketAvail = town.market.supply[order.resourceId] || 0;
                            var buyQty = Math.min(marketAvail, remaining, Math.floor(marketAvail * 0.5));
                            var buyPrice = getMarketPrice(town, order.resourceId);
                            if (buyQty > 0 && (em.gold || 0) >= buyPrice * buyQty) {
                                em.gold -= Math.floor(buyPrice * buyQty);
                                town.market.supply[order.resourceId] -= buyQty;
                                collectTradeTax(town.kingdomId, Math.floor(buyPrice * buyQty), order.resourceId);
                                // Deliver immediately
                                order.qtyDelivered += buyQty;
                                var pay2 = buyQty * order.assignedPrice;
                                em.gold = (em.gold || 0) + pay2;
                                k.gold -= pay2;
                                if (k.militaryStockpile && k.militaryStockpile.hasOwnProperty(order.resourceId)) {
                                    k.militaryStockpile[order.resourceId] = (k.militaryStockpile[order.resourceId] || 0) + buyQty;
                                }
                            }
                        }

                        // Check completion
                        if (order.qtyDelivered >= order.qty) {
                            order.status = 'completed';
                            var pref = k.procurement.preferredMerchants[em.id] || { reliability: 50, completedOrders: 0, failedOrders: 0 };
                            pref.reliability = Math.min(100, pref.reliability + 10);
                            pref.completedOrders = (pref.completedOrders || 0) + 1;
                            k.procurement.preferredMerchants[em.id] = pref;
                            em.gold = (em.gold || 0) + (order.bonusOnCompletion || 0);
                        }
                    }
                }
                em.npcMerchantInventory = inv;
            }

            // ---- 8. NET WORTH UPDATE (every 30 days) ----
            if (day % 30 === 0) {
                em.netWorth = calculateNetWorth(em);
            }

            // ---- 9. CONQUEST & SERVITUDE RESPONSE (daily check) ----
            eliteConquestResponseAI(em, town, rng, personality);

            // ---- 10. FRONTLINE RESPONSE (every 3 days) ----
            if (day % 3 === 0) {
                eliteFrontlineAI(em, town, rng, personality);
            }

            // ---- 11. KING POLICY RESPONSE (every 7 days) ----
            if (day % 7 === 0) {
                eliteKingPolicyAI(em, town, rng, strategy, personality);
            }

            // ---- 12. ECONOMIC COLLAPSE RESPONSE (every 5 days) ----
            if (day % 5 === 0) {
                eliteCollapseAI(em, town, rng, personality);
            }

            // ---- 13. MIGRATION WAVE RESPONSE (every 10 days) ----
            if (day % 10 === 0) {
                eliteMigrationAI(em, town, rng, strategy);
            }

            // ---- 14. SUPPLY CHAIN AI (every 15 days) ----
            if (day % 15 === 0) {
                eliteSupplyChainAI(em, town, rng, strategy);
            }

            // ---- 15. COMPETITION AI (every 20 days) ----
            if (day % 20 === 0) {
                eliteCompetitionAI(em, town, rng, strategy, personality);
            }

            // ---- 16. NATIONALIZATION RESPONSE (every 10 days) ----
            if (day % 10 === 0) {
                eliteNationalizationAI(em, town, rng, strategy);
            }

            // ---- 17. KINGDOM RELATIONSHIP AI (every 30 days) ----
            if (day % 30 === 0) {
                eliteKingdomRelationshipAI(em, town, rng, personality);
            }
        }
    }

    function eliteTradeAI(em, town, rng, strategy) {
        if (!town.market) return;
        var inv = em.npcMerchantInventory || {};
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;

        // Check for active trade subsidies in this kingdom
        var kingdom = findKingdom(town.kingdomId);
        var subsidizedGoods = {};
        if (kingdom && kingdom.tradeSubsidies) {
            for (var si = 0; si < kingdom.tradeSubsidies.length; si++) {
                var sub = kingdom.tradeSubsidies[si];
                if (sub.expiresDay > world.day && (sub.unitsPaid || 0) < (sub.maxUnits || 100)) {
                    subsidizedGoods[sub.good] = sub.bonusPerUnit || 2;
                }
            }
        }

        // Buy goods aligned with strategy at good prices
        if ((em.gold || 0) > 20) {
            for (var gi = 0; gi < Math.min(preferredGoods.length, 3); gi++) {
                var resId = preferredGoods[rng.randInt(0, preferredGoods.length - 1)];
                var supply = (town.market.supply[resId] || 0);
                var price = (town.market.prices[resId] || 999);
                var res = findResourceById(resId);
                if (!res) continue;
                // More aggressive buying for subsidized goods (effective price is lower)
                var effectiveThreshold = res.basePrice * 1.2;
                if (subsidizedGoods[resId]) {
                    effectiveThreshold = res.basePrice * 1.5; // buy at higher prices since subsidy offsets cost
                }
                // Buy if price is below threshold and there's supply
                if (supply > 3 && price < effectiveThreshold && em.gold >= price * 3) {
                    var maxBudget = Math.floor(em.gold * 0.15); // spend up to 15% of gold
                    if (subsidizedGoods[resId]) maxBudget = Math.floor(em.gold * 0.25); // spend more on subsidized goods
                    var qty = Math.min(rng.randInt(2, 8), Math.floor(supply * 0.15), Math.floor(maxBudget / price));
                    if (qty > 0) {
                        em.gold -= Math.floor(price * qty);
                        inv[resId] = (inv[resId] || 0) + qty;
                        town.market.supply[resId] -= qty;
                        collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                        emitTrackedEMNotification(em, 'bought ' + qty + ' ' + resId + ' in ' + (town.name || 'town'), { townId: town.id });
                    }
                }
            }
        }

        // Opportunistic buying: scarce goods elsewhere that we can trade
        if ((em.gold || 0) > 100) {
            for (var resKey in town.market.supply) {
                if ((town.market.supply[resKey] || 0) < 5) continue;
                var scarcityPrice = town.market.prices[resKey] || 999;
                var scarcityRes = findResourceById(resKey);
                if (!scarcityRes) continue;
                // Buy cheap goods that might be scarce in other towns
                if (scarcityPrice < scarcityRes.basePrice * 0.7 && (inv[resKey] || 0) < 15) {
                    var scarceQty = Math.min(rng.randInt(1, 4), Math.floor(em.gold * 0.05 / scarcityPrice));
                    if (scarceQty > 0 && em.gold >= scarcityPrice * scarceQty) {
                        em.gold -= Math.floor(scarcityPrice * scarceQty);
                        inv[resKey] = (inv[resKey] || 0) + scarceQty;
                        town.market.supply[resKey] -= scarceQty;
                        collectTradeTax(town.kingdomId, Math.floor(scarcityPrice * scarceQty), resKey);
                    }
                }
            }
        }

        // Sell overstock or goods at high price
        for (var resId2 in inv) {
            if ((inv[resId2] || 0) <= 0) continue;
            var price2 = (town.market.prices[resId2] || 1);
            var res2 = findResourceById(resId2);
            if (!res2) continue;
            var isPreferred = preferredGoods.indexOf(resId2) >= 0;
            // Sell if price is 40%+ above base, or 80%+ for preferred (hoard preferred goods)
            var sellThresh = isPreferred ? 1.8 : 1.4;
            // Lower sell threshold for subsidized goods (bonus income makes selling more attractive)
            if (subsidizedGoods[resId2]) sellThresh = isPreferred ? 1.4 : 1.1;
            if (price2 > res2.basePrice * sellThresh) {
                var sellQty = Math.min(inv[resId2], rng.randInt(1, 5));
                if (isPreferred && !subsidizedGoods[resId2]) sellQty = Math.min(sellQty, Math.floor(inv[resId2] * 0.3)); // keep 70% of preferred
                if (sellQty > 0) {
                    em.gold += Math.floor(price2 * sellQty);
                    inv[resId2] -= sellQty;
                    town.market.supply[resId2] = (town.market.supply[resId2] || 0) + sellQty;
                    collectTradeTax(town.kingdomId, Math.floor(price2 * sellQty), resId2);
                    emitTrackedEMNotification(em, 'sold ' + sellQty + ' ' + resId2 + ' in ' + (town.name || 'town'), { townId: town.id });
                }
            }
        }
        em.npcMerchantInventory = inv;

        // War profiteer: aggressive military goods trading when wars exist
        if (strategy === 'war_profiteer') {
            var warringKingdoms = world.kingdoms.filter(function(kk) { return kk.atWar && kk.atWar.size > 0; });
            if (warringKingdoms.length > 0) {
                var militaryGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'iron', 'preserved_food'];
                var isInWarZone = warringKingdoms.some(function(kk) { return kk.id === town.kingdomId; });
                inv = em.npcMerchantInventory;

                if (isInWarZone) {
                    // In a warring kingdom: sell military goods at premium (lower sell threshold)
                    for (var wsi = 0; wsi < militaryGoods.length; wsi++) {
                        var wGood = militaryGoods[wsi];
                        var wQty = inv[wGood] || 0;
                        if (wQty <= 0) continue;
                        var wPrice = town.market.prices[wGood] || 1;
                        var wRes = findResourceById(wGood);
                        if (!wRes) continue;
                        // Sell at any price above base (wartime premium)
                        if (wPrice >= wRes.basePrice * 1.1) {
                            var wSellQty = Math.min(wQty, rng.randInt(1, Math.max(2, Math.floor(wQty * 0.5))));
                            if (wSellQty > 0) {
                                em.gold += Math.floor(wPrice * wSellQty);
                                inv[wGood] -= wSellQty;
                                town.market.supply[wGood] = (town.market.supply[wGood] || 0) + wSellQty;
                            }
                        }
                    }
                } else {
                    // Not in a warring kingdom: buy military goods cheaply to sell in war zones
                    for (var wbi = 0; wbi < militaryGoods.length; wbi++) {
                        var wbGood = militaryGoods[wbi];
                        var wbSupply = town.market.supply[wbGood] || 0;
                        var wbPrice = town.market.prices[wbGood] || 999;
                        var wbRes = findResourceById(wbGood);
                        if (!wbRes || wbSupply < 3) continue;
                        // Buy aggressively at or below base price
                        if (wbPrice <= wbRes.basePrice * 1.3 && em.gold >= wbPrice * 3) {
                            var wbMaxBudget = Math.floor(em.gold * 0.2);
                            var wbBuyQty = Math.min(rng.randInt(2, 10), Math.floor(wbSupply * 0.3), Math.floor(wbMaxBudget / wbPrice));
                            if (wbBuyQty > 0) {
                                em.gold -= Math.floor(wbPrice * wbBuyQty);
                                inv[wbGood] = (inv[wbGood] || 0) + wbBuyQty;
                                town.market.supply[wbGood] -= wbBuyQty;
                            }
                        }
                    }
                }
                em.npcMerchantInventory = inv;
            }
        }
    }

    function eliteTravelAI(em, currentTown, rng, strategy) {
        // Find best destination based on strategy
        var bestTown = null;
        var bestScore = -1;
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;

        var connected = [];
        for (var ri = 0; ri < world.roads.length; ri++) {
            var road = world.roads[ri];
            if (road.fromTownId === em.townId) connected.push(road.toTownId);
            else if (road.toTownId === em.townId) connected.push(road.fromTownId);
        }
        // Sea routes
        for (var si = 0; si < world.seaRoutes.length; si++) {
            var sr = world.seaRoutes[si];
            if (sr.fromTownId === em.townId) connected.push(sr.toTownId);
            else if (sr.toTownId === em.townId) connected.push(sr.fromTownId);
        }

        // Check for trade subsidies in connected town kingdoms
        var subsidyMap = {};
        for (var ki = 0; ki < world.kingdoms.length; ki++) {
            var kdom = world.kingdoms[ki];
            if (kdom.tradeSubsidies) {
                for (var tsi = 0; tsi < kdom.tradeSubsidies.length; tsi++) {
                    var tsub = kdom.tradeSubsidies[tsi];
                    if (tsub.expiresDay > world.day && (tsub.unitsPaid || 0) < (tsub.maxUnits || 100)) {
                        subsidyMap[tsub.good + '_' + kdom.id] = tsub.bonusPerUnit || 2;
                    }
                }
            }
        }

        for (var ci2 = 0; ci2 < connected.length; ci2++) {
            var destTown = findTown(connected[ci2]);
            if (!destTown || !destTown.market) continue;
            var score = 0;
            var isCrossKingdom = destTown.kingdomId !== em.kingdomId;
            var destKingdom = findKingdom(destTown.kingdomId);
            var tariffRate = (isCrossKingdom && destKingdom && destKingdom.laws) ? (destKingdom.laws.tradeTariff || 0) : 0;

            // Score based on trade opportunities
            for (var pi2 = 0; pi2 < preferredGoods.length; pi2++) {
                var gId = preferredGoods[pi2];
                var destPrice = destTown.market.prices[gId] || 0;
                var localPrice = currentTown.market.prices[gId] || 0;
                var destSupply = destTown.market.supply[gId] || 0;
                var r = findResourceById(gId);
                if (!r) continue;
                // Good buy opportunity: cheap goods at dest
                if (destSupply > 5 && destPrice < r.basePrice * 0.9) score += 10;
                // Good sell opportunity: high price at dest, we have inventory
                if (destPrice > r.basePrice * 1.5 && (em.npcMerchantInventory[gId] || 0) > 0) score += 20;
                // Arbitrage: cheaper at dest than here
                if (destPrice < localPrice * 0.7 && destSupply > 3) score += 15;
                // Trade subsidy bonus: prefer destinations where our goods are subsidized
                if (subsidyMap[gId + '_' + destTown.kingdomId] && (em.npcMerchantInventory[gId] || 0) > 0) score += 12;

                // Cross-kingdom arbitrage: evaluate actual profit after tariffs
                if (isCrossKingdom) {
                    var heldQty = em.npcMerchantInventory[gId] || 0;
                    if (heldQty > 0 && destPrice > 0) {
                        var netSellPrice = destPrice * (1 - tariffRate);
                        var arbitrageProfit = netSellPrice - localPrice;
                        if (arbitrageProfit > 5) score += Math.min(40, Math.floor(arbitrageProfit * heldQty * 0.5));
                    }
                    // Buy opportunity in foreign market (cheaper even after tariff to bring home)
                    if (destSupply > 3 && destPrice > 0) {
                        var effectiveBuyPrice = destPrice * (1 + tariffRate);
                        if (effectiveBuyPrice < localPrice * 0.7) score += 12;
                    }
                }
            }

            // Cross-kingdom bonus: evaluate ALL inventory for arbitrage, not just preferred goods
            if (isCrossKingdom) {
                for (var invKey in em.npcMerchantInventory) {
                    if ((em.npcMerchantInventory[invKey] || 0) <= 0) continue;
                    if (preferredGoods.indexOf(invKey) >= 0) continue; // already scored
                    var invDestPrice = destTown.market.prices[invKey] || 0;
                    var invLocalPrice = currentTown.market.prices[invKey] || 0;
                    if (invDestPrice > 0) {
                        var invNetPrice = invDestPrice * (1 - tariffRate);
                        var invProfit = invNetPrice - invLocalPrice;
                        if (invProfit > 5) score += Math.min(20, Math.floor(invProfit * 0.3));
                    }
                }
            }

            // Bonus for larger towns (more market activity)
            score += (destTown.prosperity || 0) * 0.1;
            // Penalize same kingdom for luxury_trader (they want long-distance)
            if (strategy === 'luxury_trader' && destTown.kingdomId === em.kingdomId) score *= 0.5;

            // Penalize frontline towns (dangerous for merchants)
            if (destTown.isFrontline) score *= 0.3;
            // Penalize recently conquered towns
            if (destTown._justConquered) score *= 0.1;
            // Penalize very low-happiness towns (unrest)
            if ((destTown.happiness || 50) < 20) score *= 0.6;
            // Bonus for tax holiday towns (good investment destination)
            if (destKingdom && destKingdom.taxHolidays) {
                for (var thi = 0; thi < destKingdom.taxHolidays.length; thi++) {
                    if (destKingdom.taxHolidays[thi].townId === destTown.id && destKingdom.taxHolidays[thi].expiresDay > world.day) {
                        score += 8;
                        break;
                    }
                }
            }
            // War profiteer: prioritize warring kingdom towns with high military demand
            if (strategy === 'war_profiteer' && destKingdom && destKingdom.atWar && destKingdom.atWar.size > 0) {
                // Warring kingdoms have high demand for military goods — big bonus
                score += 30;
                // Extra bonus for towns with high garrison (more demand)
                score += Math.min(20, (destTown.garrison || 0) * 0.5);
                // Don't penalize frontline towns — that's where the profit is
                if (destTown.isFrontline) score *= 3.0; // override the penalty
                // Check if we have military goods to sell
                var milGoods = ['swords', 'armor', 'bows', 'arrows', 'horses', 'iron'];
                for (var mgi = 0; mgi < milGoods.length; mgi++) {
                    if ((em.npcMerchantInventory[milGoods[mgi]] || 0) > 0) {
                        var mgDestPrice = destTown.market.prices[milGoods[mgi]] || 0;
                        var mgRes = findResourceById(milGoods[mgi]);
                        if (mgRes && mgDestPrice > mgRes.basePrice * 1.2) {
                            score += Math.floor(mgDestPrice * 0.5);
                        }
                    }
                }
            } else if (strategy === 'war_profiteer') {
                // No wars: war profiteers still want cheap military goods to stockpile
                var wpMilGoods = ['swords', 'armor', 'bows', 'arrows', 'iron'];
                for (var wpgi = 0; wpgi < wpMilGoods.length; wpgi++) {
                    var wpSupply = destTown.market.supply[wpMilGoods[wpgi]] || 0;
                    var wpPrice = destTown.market.prices[wpMilGoods[wpgi]] || 999;
                    var wpRes = findResourceById(wpMilGoods[wpgi]);
                    if (wpRes && wpSupply > 5 && wpPrice < wpRes.basePrice * 0.8) {
                        score += 10; // good stockpiling opportunity
                    }
                }
            }

            // Bonus for immigration incentive towns (growing economy = opportunity)
            if (destKingdom && destKingdom.immigrationIncentives) {
                for (var imi = 0; imi < destKingdom.immigrationIncentives.length; imi++) {
                    if (destKingdom.immigrationIncentives[imi].townId === destTown.id && destKingdom.immigrationIncentives[imi].expiresDay > world.day) {
                        score += 5;
                        break;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestTown = destTown;
            }
        }

        // Only travel if good opportunity (score > 15) or random wanderlust
        if (bestTown && (bestScore > 15 || rng.chance(0.1))) {
            em.townId = bestTown.id;
            em.kingdomId = bestTown.kingdomId;
        }
    }

    function eliteBuildAI(em, town, rng, strategy) {
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;
        var ownedCount = (em.buildings || []).length;
        // Rank limits
        var maxRank = 0;
        for (var kId in em.socialRank) { if ((em.socialRank[kId] || 0) > maxRank) maxRank = em.socialRank[kId]; }
        var rankDef = CONFIG.SOCIAL_RANKS[maxRank] || CONFIG.SOCIAL_RANKS[0];
        var maxBuildings = rankDef.maxBuildings || 2;
        if (ownedCount >= maxBuildings) return;

        // Can afford?
        if ((em.gold || 0) < 200) return;

        // Check for land subsidies and tax holidays to pick optimal town
        var kingdom = findKingdom(town.kingdomId);
        var buildTown = town;
        var subsidyDiscount = 0;
        var hasTaxHoliday = false;

        // Search for subsidized/tax-holiday towns in our kingdom
        if (kingdom) {
            var bestSubsidyScore = 0;
            for (var ti = 0; ti < world.towns.length; ti++) {
                var candidateTown = world.towns[ti];
                if (candidateTown.kingdomId !== kingdom.id) continue;
                var candidateScore = 0;
                var candidateDiscount = 0;

                // Check land subsidies for this town
                if (kingdom.landSubsidies) {
                    for (var lsi = 0; lsi < kingdom.landSubsidies.length; lsi++) {
                        var ls = kingdom.landSubsidies[lsi];
                        if (ls.townId === candidateTown.id && ls.expiresDay > world.day) {
                            if (preferredBuildings.indexOf(ls.buildingType) >= 0) {
                                candidateScore += 20;
                                candidateDiscount = ls.discount || 0.4;
                            }
                        }
                    }
                }

                // Check tax holidays
                if (kingdom.taxHolidays) {
                    for (var thi2 = 0; thi2 < kingdom.taxHolidays.length; thi2++) {
                        if (kingdom.taxHolidays[thi2].townId === candidateTown.id && kingdom.taxHolidays[thi2].expiresDay > world.day) {
                            candidateScore += 15;
                            break;
                        }
                    }
                }

                // Bonus for being current town (no travel needed)
                if (candidateTown.id === town.id) candidateScore += 5;
                // Penalty for frontline towns
                if (candidateTown.isFrontline) candidateScore -= 20;
                // Bonus for prosperous towns
                candidateScore += (candidateTown.prosperity || 0) * 0.05;

                if (candidateScore > bestSubsidyScore) {
                    bestSubsidyScore = candidateScore;
                    buildTown = candidateTown;
                    subsidyDiscount = candidateDiscount;
                    hasTaxHoliday = candidateScore >= 15;
                }
            }
        }

        var bType = rng.pick(preferredBuildings);
        // If there's a specific subsidized building type, prefer it
        if (subsidyDiscount > 0 && kingdom && kingdom.landSubsidies) {
            for (var lsi2 = 0; lsi2 < kingdom.landSubsidies.length; lsi2++) {
                var ls2 = kingdom.landSubsidies[lsi2];
                if (ls2.townId === buildTown.id && ls2.expiresDay > world.day && preferredBuildings.indexOf(ls2.buildingType) >= 0) {
                    bType = ls2.buildingType;
                    break;
                }
            }
        }

        var bt = findBuildingType(bType);
        if (!bt) return;

        // Calculate material cost from local market + check availability
        var materialCost = 0;
        if (bt.materials) {
            for (var matId in bt.materials) {
                var qtyNeeded = bt.materials[matId];
                var marketHas = (buildTown.market && buildTown.market.supply[matId]) || 0;
                if (marketHas < qtyNeeded) return; // Materials not available — skip
                var matPrice = getMarketPrice(buildTown, matId) || 5;
                materialCost += qtyNeeded * matPrice;
            }
        }
        var laborCost = Math.floor(bt.cost * (1 - subsidyDiscount));
        var effectiveCost = laborCost + materialCost;
        if (em.gold < effectiveCost) return;

        // Check town slots
        var maxSlots = CONFIG.TOWN_CATEGORIES[buildTown.category] ? CONFIG.TOWN_CATEGORIES[buildTown.category].maxBuildingSlots : 10;
        if (buildTown.buildings.length >= maxSlots) return;

        // Consume materials from town market
        if (bt.materials) {
            for (var matId2 in bt.materials) {
                buildTown.market.supply[matId2] = Math.max(0, (buildTown.market.supply[matId2] || 0) - bt.materials[matId2]);
            }
        }

        em.gold -= effectiveCost;
        if (!em.buildings) em.buildings = [];
        var newBld = { type: bType, level: 1, ownerId: em.id, townId: buildTown.id, workers: [], upgrades: [], builtDay: world.day };
        buildTown.buildings.push(newBld);
        em.buildings.push({ type: bType, townId: buildTown.id, level: 1 });
        var subsidyNote = subsidyDiscount > 0 ? ' (with ' + Math.round(subsidyDiscount * 100) + '% land subsidy)' : '';
        var holidayNote = hasTaxHoliday ? ' Tax holiday active.' : '';
        logEvent(em.firstName + ' ' + (em.lastName || '') + ' built a ' + bt.name + ' in ' + buildTown.name + '. (materials: ' + (+materialCost).toFixed(2) + 'g, labor: ' + (+laborCost).toFixed(2) + 'g)' + subsidyNote, {
            type: 'elite_construction',
            townId: buildTown.id,
            cause: em.firstName + ' ' + (em.lastName || '') + ' invested in ' + buildTown.name + '\'s economy.' + holidayNote,
            effects: [
                'New ' + bt.name + ' provides jobs and production',
                em.firstName + ' spent ' + effectiveCost + 'g on construction' + subsidyNote,
                'Town economy should improve over time'
            ]
        });
    }

    // ── NPC-Owned Retail Building Tick ──
    // Processes sales for all NPC-owned retail/service buildings in all towns
    function tickNPCRetailBuildings() {
        if (!world || !world.towns) return;
        var rng = world.rng;
        if (!rng) return;

        for (var ti = 0; ti < world.towns.length; ti++) {
            var town = world.towns[ti];
            if (!town.buildings) continue;

            // Only towns and above have retail
            if (town.category === 'village') continue;

            var kingdom = findKingdom(town.kingdomId);
            var tariffRate = (kingdom && kingdom.laws && kingdom.laws.tradeTariff) || 0.05;

            for (var bi = 0; bi < town.buildings.length; bi++) {
                var bld = town.buildings[bi];
                if (!bld.ownerId) continue; // skip town-owned
                var bt = findBuildingType(bld.type);
                if (!bt || !bt.retailConfig) continue;

                // Skip player-owned — handled in player.js
                if (typeof Player !== 'undefined' && Player.buildings) {
                    var isPlayerOwned = Player.buildings.some(function(pb) { return pb.id === bld.id; });
                    if (isPlayerOwned) continue;
                }

                // Init retail fields
                bld.retailStock = bld.retailStock || {};
                bld.retailRevenue = bld.retailRevenue || 0;

                // NPC owners auto-stock from market when low
                var stockTotal = 0;
                for (var sk in bld.retailStock) stockTotal += (bld.retailStock[sk] || 0);
                var maxStock = (bt.retailConfig.maxStock || 50) * (bld.level || 1);

                if (stockTotal < maxStock * 0.3) {
                    // Auto-restock: buy from market
                    var goods = bt.retailConfig.acceptsGoods || [];
                    for (var gi = 0; gi < goods.length && stockTotal < maxStock * 0.7; gi++) {
                        var gid = goods[gi];
                        var avail = town.market.supply[gid] || 0;
                        var toBuy = Math.min(avail, Math.floor((maxStock - stockTotal) / goods.length));
                        if (toBuy > 0) {
                            town.market.supply[gid] -= toBuy;
                            bld.retailStock[gid] = (bld.retailStock[gid] || 0) + toBuy;
                            stockTotal += toBuy;
                        }
                    }
                }

                // Process sales (simplified version of player retail tick)
                var maxCust = Math.floor((bt.retailConfig.maxCustomersPerDay || 5) * (bld.level || 1) * Math.min(2.0, (town.population || 50) / 100));
                if (maxCust < 1) maxCust = 1;
                var markup = bt.retailConfig.baseMarkup || 1.3;

                for (var ci = 0; ci < maxCust; ci++) {
                    if (!rng.chance(0.4)) continue; // 40% base visit chance for NPC shops

                    if (bt.retailConfig.serviceFee) {
                        var canServe = true;
                        var svcCost = bt.retailConfig.consumesPerService || {};
                        for (var sr in svcCost) {
                            if ((bld.retailStock[sr] || 0) < svcCost[sr]) { canServe = false; break; }
                        }
                        if (!canServe) continue;
                        for (var sr2 in svcCost) {
                            bld.retailStock[sr2] -= svcCost[sr2];
                            if (bld.retailStock[sr2] <= 0) delete bld.retailStock[sr2];
                        }
                        var fee = bt.retailConfig.serviceFee * (bld.level || 1);
                        var tax = Math.floor(fee * tariffRate);
                        if (kingdom) kingdom.gold = (kingdom.gold || 0) + tax;
                        bld.retailRevenue += (fee - tax);
                        continue;
                    }

                    var sKeys = Object.keys(bld.retailStock).filter(function(k) { return bld.retailStock[k] > 0; });
                    if (sKeys.length === 0) break;

                    var itemId = sKeys[Math.floor(rng.random() * sKeys.length)];
                    var mktPrice = town.market.prices[itemId] || 5;
                    var mktSupply = town.market.supply[itemId] || 0;

                    // NPC decision: market or this shop?
                    if (mktSupply > 10 && rng.chance(0.6)) continue; // market has stock, skip shop

                    var salePrice = Math.round(mktPrice * markup);
                    bld.retailStock[itemId]--;
                    if (bld.retailStock[itemId] <= 0) delete bld.retailStock[itemId];
                    var saleTax = Math.floor(salePrice * tariffRate);
                    if (kingdom) kingdom.gold = (kingdom.gold || 0) + saleTax;
                    bld.retailRevenue += (salePrice - saleTax);
                }

                // Owner collects revenue periodically
                if (bld.retailRevenue > 0) {
                    var owner = findPerson(bld.ownerId);
                    if (owner && owner.alive) {
                        owner.gold = (owner.gold || 0) + bld.retailRevenue;
                        bld.retailRevenue = 0;
                    }
                }
            }
        }
    }

    function eliteSocialAI(em, town, rng, personality) {
        // Marriage already handled in tickPeople — this handles relationship building
        if (personality.social > 50 || em.strategy === 'political_climber') {
            // Build relationships with nobles and other elite merchants in town
            var targets = world.people.filter(function(c) {
                return c.alive && c.townId === em.townId && c.id !== em.id &&
                    (c.occupation === 'noble' || c.isEliteMerchant) &&
                    c.age >= 16;
            });
            for (var ti = 0; ti < Math.min(targets.length, 2); ti++) {
                var target = targets[ti];
                if (!em.relationships[target.id]) em.relationships[target.id] = { level: 10, type: 'acquaintance' };
                var rel = em.relationships[target.id];
                var gain = Math.floor(personality.social * 0.1 + rng.random() * 5);
                rel.level = Math.min(100, rel.level + gain);
                if (rel.level >= 60) rel.type = 'friend';
                if (rel.level >= 85) rel.type = 'ally';
            }
        }

        // Choose heir from children
        if (em.childrenIds && em.childrenIds.length > 0) {
            var bestHeir = null;
            var bestHeirScore = -1;
            for (var hi = 0; hi < em.childrenIds.length; hi++) {
                var child = findPerson(em.childrenIds[hi]);
                if (!child || !child.alive || child.age < 14) continue;
                var hScore = (child.age || 0) + (child.skills ? (child.skills.trading || 0) : 0) * 0.5;
                if (hScore > bestHeirScore) { bestHeirScore = hScore; bestHeir = child; }
            }
            if (bestHeir) em.heirId = bestHeir.id;
        }
    }

    function eliteRankAI(em, rng) {
        var kId = em.citizenshipKingdomId || em.kingdomId;
        if (!kId) return;
        var currentRank = (em.socialRank[kId] || 0);
        if (currentRank >= 4) return; // NPC max rank cap at Minor Noble
        var nextRank = CONFIG.SOCIAL_RANKS[currentRank + 1];
        if (!nextRank) return;

        // Check basic requirements
        if ((em.gold || 0) < (nextRank.goldReq || 0)) return;
        if ((em.reputation[kId] || 0) < (nextRank.repReq || 0)) return;
        var fee = nextRank.fee || 0;
        if (em.gold < fee) return;

        // Pay fee and advance
        em.gold -= fee;
        em.socialRank[kId] = currentRank + 1;
        logEvent(em.firstName + ' ' + (em.lastName || '') + ' has been elevated to ' + nextRank.name + '!');
    }

    function eliteCrimeAI(em, town, rng, personality) {
        if (personality.honesty >= 40) return;
        if ((em.gold || 0) < 100) return; // too poor to risk

        // War profiteering
        if (em.strategy === 'war_profiteer' && personality.risk_tolerance > 50) {
            var kingdom = findKingdom(em.kingdomId);
            if (kingdom && kingdom.atWar && kingdom.atWar.size > 0) {
                // Bonus gold from war trading
                var profit = Math.floor(50 + rng.random() * 200);
                em.gold += profit;
                em.crimesCommitted++;
                if (!em.criminalRecord[em.kingdomId]) em.criminalRecord[em.kingdomId] = 0;
                // Small chance of getting caught
                if (rng.chance(0.05)) {
                    em.criminalRecord[em.kingdomId]++;
                    var fine = Math.floor(profit * 2);
                    em.gold = Math.max(0, em.gold - fine);
                    em.reputation[em.kingdomId] = Math.max(0, (em.reputation[em.kingdomId] || 50) - 10);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' was fined ' + fine + 'g for war profiteering!');
                }
            }
        }

        // Bridge sabotage already handled in tickNPCMerchants
    }

    // ---- NET WORTH & LEADERBOARD ----
    function calculateNetWorth(entity) {
        var worth = entity.gold || 0;

        // Inventory value (check both npcMerchantInventory and inventory)
        var inv = entity.npcMerchantInventory || entity.inventory || {};
        for (var resId in inv) {
            var qty = inv[resId] || 0;
            if (qty <= 0) continue;
            var res = findResourceById(resId);
            worth += qty * (res ? res.basePrice : 10);
        }
        // Also check regular inventory if different
        if (entity.inventory && entity.npcMerchantInventory) {
            for (var resId2 in entity.inventory) {
                var qty2 = entity.inventory[resId2] || 0;
                if (qty2 <= 0) continue;
                var res2 = findResourceById(resId2);
                worth += qty2 * (res2 ? res2.basePrice : 10);
            }
        }
        // Town storage
        if (entity.townStorage) {
            for (var tid in entity.townStorage) {
                for (var resId3 in entity.townStorage[tid]) {
                    var qty3 = entity.townStorage[tid][resId3] || 0;
                    if (qty3 <= 0) continue;
                    var res3 = findResourceById(resId3);
                    worth += qty3 * (res3 ? res3.basePrice : 10);
                }
            }
        }

        // Building value
        if (entity.buildings) {
            for (var bi = 0; bi < entity.buildings.length; bi++) {
                var bld = entity.buildings[bi];
                var bt = findBuildingType(bld.type);
                if (bt) worth += bt.cost * (1 + ((bld.level || 1) - 1) * 0.5);
            }
        }

        // Social rank prestige
        if (entity.socialRank) {
            for (var kId in entity.socialRank) {
                worth += (entity.socialRank[kId] || 0) * 5000;
            }
        }

        // Ships
        if (entity.ships) {
            var shipVal = 0;
            if (typeof entity.ships === 'number') shipVal = entity.ships * 1500;
            else if (Array.isArray(entity.ships)) {
                for (var si2 = 0; si2 < entity.ships.length; si2++) {
                    var st = CONFIG.SHIP_TYPES ? CONFIG.SHIP_TYPES[entity.ships[si2].type] : null;
                    shipVal += st ? st.cost * ((entity.ships[si2].condition || 100) / 100) * 0.7 : 1500;
                }
            }
            worth += shipVal;
        }

        // Horses
        if (entity.horses) {
            if (typeof entity.horses === 'number') worth += entity.horses * 60;
            else if (Array.isArray(entity.horses)) worth += entity.horses.length * 60;
        }

        return Math.floor(worth);
    }

    function getHighestRank(socialRank) {
        var highest = 0;
        for (var kId in socialRank) {
            if ((socialRank[kId] || 0) > highest) highest = socialRank[kId];
        }
        return highest;
    }

    function getLeaderboard() {
        var entries = [];

        // Add player — use the Player module's getters directly
        if (typeof Player !== 'undefined' && Player.alive) {
            entries.push({
                id: 'player',
                name: Player.fullName || ((Player.firstName || '') + ' ' + (Player.lastName || '')),
                familyName: Player.lastName || Player.firstName || 'Unknown',
                netWorth: (Player.getNetWorth ? Player.getNetWorth() : calculateNetWorth({
                    gold: Player.gold, inventory: Player.inventory, buildings: Player.buildings,
                    socialRank: Player.socialRank, ships: Player.ships, horses: Player.horses,
                    townStorage: Player.townStorage
                })),
                gold: Player.gold || 0,
                buildings: Player.buildings ? Player.buildings.length : 0,
                employees: Player.employees ? Player.employees.length : 0,
                primaryKingdom: Player.citizenshipKingdomId,
                highestRank: getHighestRank(Player.socialRank || {}),
                strategy: 'Player',
                isPlayer: true,
                townId: Player.townId,
                heraldry: null,
            });
        }

        // Add elite merchants
        if (world && world.people) {
            var elites = world.people.filter(function(m) { return m.alive && m.isEliteMerchant; });
            for (var i = 0; i < elites.length; i++) {
                var m = elites[i];
                ensureEliteMerchantFields(m);
                entries.push({
                    id: m.id,
                    name: (m.firstName || '') + ' ' + (m.lastName || ''),
                    familyName: m.familyName || m.lastName || m.firstName || 'Unknown',
                    netWorth: m.netWorth || calculateNetWorth(m),
                    gold: m.gold || 0,
                    buildings: m.buildings ? m.buildings.length : 0,
                    employees: m.employees ? m.employees.length : 0,
                    primaryKingdom: m.citizenshipKingdomId || m.kingdomId,
                    highestRank: getHighestRank(m.socialRank || {}),
                    strategy: m.strategy || 'diversified',
                    isPlayer: false,
                    townId: m.townId,
                    heraldry: m.heraldry || null,
                });
            }
        }

        entries.sort(function(a, b) { return b.netWorth - a.netWorth; });
        return entries;
    }

    // ========================================================
    // §19A3  ELITE MERCHANT KINGDOM-AWARE AI
    // ========================================================

    // ---- CONQUEST RESPONSE: Buy freedom, flee raids, react to conquest ----
    function eliteConquestResponseAI(em, town, rng, personality) {
        // If indentured, immediately buy freedom (elite merchants are wealthy)
        if (em.status === 'indentured') {
            var freedomCost = em.servitudeFreedomCost || CONFIG.SERVITUDE_FREEDOM_COST || 1000;
            if ((em.gold || 0) >= freedomCost) {
                var servKingdom = findKingdom(em.servitudeKingdomId);
                em.gold -= freedomCost;
                if (servKingdom) servKingdom.gold += freedomCost;
                em.status = 'citizen';
                delete em.servitudeEndDay;
                delete em.servitudeFreedomCost;
                delete em.servitudeKingdomId;
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' immediately buys their freedom for ' + freedomCost + 'g!', {
                    type: 'elite_freedom_buyout',
                    cause: 'Wealthy elite merchant refuses to remain in servitude.',
                    effects: [
                        em.firstName + ' pays ' + freedomCost + 'g to regain freedom',
                        'Elite merchant resumes trading operations',
                        'Kingdom treasury receives ' + freedomCost + 'g'
                    ]
                });
                // After buying freedom, try to relocate to a safer town
                eliteEmergencyRelocate(em, rng);
            }
            return; // Don't do anything else while indentured
        }

        // If town was just conquered, consider fleeing
        if (town._justConquered && rng.chance(0.7)) {
            eliteEmergencyRelocate(em, rng);
        }
    }

    // ---- FRONTLINE RESPONSE: Flee dangerous frontline towns ----
    function eliteFrontlineAI(em, town, rng, personality) {
        if (!town.isFrontline) return;
        // 60% chance to relocate from frontline towns
        if (rng.chance(0.6)) {
            var safeTowns = world.towns.filter(function(t) {
                return !t.isFrontline && t.kingdomId === em.kingdomId && t.id !== em.townId && (t.happiness || 50) > 25;
            });
            if (safeTowns.length > 0) {
                // Prefer prosperous, safe towns
                safeTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); });
                var dest = safeTowns[0];
                var oldTown = town.name;
                em.townId = dest.id;
                em.kingdomId = dest.kingdomId;
                // Fix population bookkeeping on flee
                if (town.population > 0) town.population--;
                dest.population = (dest.population || 0) + 1;
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' flees the frontline in ' + oldTown + ' for safety in ' + dest.name + '.', {
                    type: 'elite_frontline_flee',
                    cause: oldTown + ' is on the front lines of war — too dangerous for trade.',
                    effects: [
                        em.firstName + ' relocates to ' + dest.name,
                        'Trading operations disrupted temporarily',
                        'Buildings in ' + oldTown + ' left unmanned'
                    ]
                });
            }
        }
    }

    // ---- Emergency relocation helper ----
    function eliteEmergencyRelocate(em, rng) {
        var safeTowns = world.towns.filter(function(t) {
            return !t.isFrontline && !t._justConquered && t.id !== em.townId && (t.happiness || 50) > 20;
        });
        // Prefer towns in same kingdom, then any town
        var sameKingdom = safeTowns.filter(function(t) { return t.kingdomId === em.kingdomId; });
        var choices = sameKingdom.length > 0 ? sameKingdom : safeTowns;
        if (choices.length > 0) {
            choices.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); });
            var dest = choices[Math.min(rng.randInt(0, 2), choices.length - 1)];
            // Fix population bookkeeping
            var oldEliteTown = findTown(em.townId);
            if (oldEliteTown && oldEliteTown.population > 0) oldEliteTown.population--;
            dest.population = (dest.population || 0) + 1;
            em.townId = dest.id;
            em.kingdomId = dest.kingdomId;
        }
    }

    // ---- KING POLICY RESPONSE: Bounties, subsidies, tax holidays, seizure threat ----
    function eliteKingPolicyAI(em, town, rng, strategy, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // -- Respond to production bounties --
        if (kingdom.productionBounties && kingdom.productionBounties.length > 0) {
            for (var bi = 0; bi < kingdom.productionBounties.length; bi++) {
                var bounty = kingdom.productionBounties[bi];
                if (bounty.fulfilled || bounty.expiresDay <= world.day) continue;

                // Can we produce this good?
                var canFulfill = false;
                var hasBuilding = em.buildings && em.buildings.some(function(b) {
                    var bt = findBuildingType(b.type);
                    return bt && bt.produces === bounty.good;
                });
                var canBuildForIt = preferredBuildings.some(function(bType) {
                    var bt = findBuildingType(bType);
                    return bt && bt.produces === bounty.good;
                });
                var hasInventory = (em.npcMerchantInventory[bounty.good] || 0) > 0;

                if (hasBuilding || hasInventory || canBuildForIt) canFulfill = true;

                // 40% chance to pursue bounty if they can fulfill it
                if (canFulfill && rng.chance(0.4)) {
                    // If we have inventory, deliver immediately
                    if (hasInventory) {
                        var deliverQty = Math.min(em.npcMerchantInventory[bounty.good] || 0, 10);
                        if (deliverQty > 0) {
                            em.npcMerchantInventory[bounty.good] -= deliverQty;
                            var reward = (bounty.reward || CONFIG.KING_BOUNTY_DEFAULT_REWARD || 50) * deliverQty;
                            em.gold += reward;
                            if (kingdom.gold >= reward) kingdom.gold -= reward;
                            em._bountiesFulfilled = (em._bountiesFulfilled || 0) + 1;
                            em.reputation[kingdom.id] = Math.min(100, (em.reputation[kingdom.id] || 50) + 5);
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' fulfills a royal bounty for ' + bounty.good + ', earning ' + reward + 'g.', {
                                type: 'elite_bounty_fulfilled',
                                cause: 'Kingdom requested ' + bounty.good + ' production.',
                                effects: [
                                    em.firstName + ' delivers ' + deliverQty + ' ' + bounty.good,
                                    'Earned ' + reward + 'g bounty reward',
                                    'Royal reputation increased'
                                ]
                            });
                        }
                    }
                    // If we don't have inventory but can build, consider building (handled in eliteBuildAI with subsidies)
                    break; // Only pursue one bounty at a time
                }
            }
        }

        // -- Asset seizure threat: Move wealth to other kingdoms --
        var kp = kingdom.kingPersonality || {};
        var isGreedyKing = kp.greed === 'greedy' || kp.greed === 'corrupt';
        var isCruelKing = kp.temperament === 'cruel' || kp.temperament === 'stern';
        var kingdomBankrupt = (kingdom._bankruptDays || 0) > 5;

        if ((isGreedyKing || kingdomBankrupt) && (em.gold || 0) > 2000 && personality.risk_tolerance > 40) {
            // Consider moving some assets to a different kingdom
            if (rng.chance(0.25)) {
                var otherKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && k.gold > 500 && !(k._bankruptDays > 0);
                });
                if (otherKingdoms.length > 0) {
                    // Find a safe town in another kingdom to buy property
                    var safeKingdom = otherKingdoms.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); })[0];
                    var safeTowns = world.towns.filter(function(t) {
                        return t.kingdomId === safeKingdom.id && !t.isFrontline && (t.prosperity || 0) > 20;
                    });
                    if (safeTowns.length > 0 && !em._assetsDiversified) {
                        em._assetsDiversified = true;
                        var diverseAmt = Math.floor(em.gold * 0.15);
                        em.gold -= diverseAmt;
                        // Simulate investment: store as cached gold in a safe kingdom
                        if (!em._foreignInvestments) em._foreignInvestments = {};
                        em._foreignInvestments[safeKingdom.id] = (em._foreignInvestments[safeKingdom.id] || 0) + diverseAmt;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' quietly moves ' + diverseAmt + 'g in assets to ' + safeKingdom.name + '.', {
                            type: 'elite_asset_diversification',
                            cause: 'Fear of royal seizure drives ' + em.firstName + ' to diversify holdings.',
                            effects: [
                                diverseAmt + 'g moved to ' + safeKingdom.name + ' investments',
                                'Reduced exposure to ' + kingdom.name + '\'s instability',
                                'Merchant hedges against political risk'
                            ]
                        });
                    }
                }
            }
        }
    }

    // ---- ECONOMIC COLLAPSE RESPONSE: Flee collapsing kingdoms, buy cheap, offer bailout ----
    function eliteCollapseAI(em, town, rng, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        var bankruptDays = kingdom._bankruptDays || 0;

        // Phase 1: Kingdom nearing collapse (bankrupt > 30 days) — start moving assets
        if (bankruptDays > 30 && !em._assetsDiversified) {
            if (rng.chance(0.4)) {
                var safeKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && !(k._bankruptDays > 0) && k.gold > 1000;
                });
                if (safeKingdoms.length > 0) {
                    var bestRefuge = safeKingdoms.sort(function(a, b) { return (b.gold || 0) - (a.gold || 0); })[0];
                    var moveAmount = Math.floor(em.gold * 0.3);
                    if (moveAmount > 100) {
                        em.gold -= moveAmount;
                        if (!em._foreignInvestments) em._foreignInvestments = {};
                        em._foreignInvestments[bestRefuge.id] = (em._foreignInvestments[bestRefuge.id] || 0) + moveAmount;
                        em._assetsDiversified = true;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' evacuates ' + moveAmount + 'g from collapsing ' + kingdom.name + '.', {
                            type: 'elite_collapse_flight',
                            cause: kingdom.name + ' has been bankrupt for ' + bankruptDays + ' days.',
                            effects: [
                                moveAmount + 'g moved to ' + bestRefuge.name + ' for safety',
                                em.firstName + ' prepares for potential kingdom collapse',
                                'Elite merchants losing confidence in ' + kingdom.name
                            ]
                        });
                    }
                }
            }
        }

        // Phase 2: If collapse happens and merchant is wealthy, offer bailout
        if (kingdom._collapseTriggered && (em.gold || 0) >= 3000 && personality.ambition > 50) {
            if (rng.chance(0.3)) {
                var bailoutCost = Math.min(em.gold, rng.randInt(3000, 5000));
                em.gold -= bailoutCost;
                kingdom.gold += bailoutCost;
                kingdom._bankruptDays = 0;
                kingdom._collapseTriggered = false;
                // Gain noble title and tax exemption
                var kId = kingdom.id;
                em.socialRank[kId] = Math.max((em.socialRank[kId] || 0), 3); // Noble rank
                em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 30);
                em._kingRelationship[kId] = (em._kingRelationship[kId] || 0) + 50;
                logEvent('\uD83D\uDC51 ' + em.firstName + ' ' + (em.lastName || '') + ' bails out ' + kingdom.name + ' with ' + bailoutCost + 'g! Elevated to nobility.', {
                    type: 'elite_bailout',
                    cause: em.firstName + ' saves ' + kingdom.name + ' from complete economic collapse.',
                    effects: [
                        em.firstName + ' pays ' + bailoutCost + 'g to save the kingdom',
                        'Elevated to noble rank for service to the crown',
                        'Kingdom avoids collapse and begins recovery',
                        em.firstName + ' gains massive political influence'
                    ]
                });
                return;
            }
        }

        // Phase 3: Buy cheap assets in collapsing economies (opportunistic)
        if (bankruptDays > 15 && (em.gold || 0) > 500 && personality.greed > 40) {
            // Look for cheap buildings for sale in bankrupt kingdoms
            for (var tIdx = 0; tIdx < world.towns.length; tIdx++) {
                var cheapTown = world.towns[tIdx];
                if (cheapTown.kingdomId !== kingdom.id && cheapTown.kingdomId) {
                    var cheapK = findKingdom(cheapTown.kingdomId);
                    if (!cheapK || (cheapK._bankruptDays || 0) < 10) continue;
                }
                // Look for buildings marked for sale
                for (var bldIdx = 0; bldIdx < cheapTown.buildings.length; bldIdx++) {
                    var bld = cheapTown.buildings[bldIdx];
                    if (!bld.forSale) continue;
                    if (bld.ownerId === em.id) continue;
                    var bType = findBuildingType(bld.type);
                    if (!bType) continue;
                    var discountedPrice = Math.floor(bType.cost * 0.5); // 50% value in crisis
                    if (em.gold >= discountedPrice && rng.chance(0.2)) {
                        var maxR = 0;
                        for (var rkId in em.socialRank) { if ((em.socialRank[rkId] || 0) > maxR) maxR = em.socialRank[rkId]; }
                        var rDef = CONFIG.SOCIAL_RANKS[maxR] || CONFIG.SOCIAL_RANKS[0];
                        if ((em.buildings || []).length >= (rDef.maxBuildings || 2)) break;
                        var prevOwner = bld.ownerId;
                        em.gold -= discountedPrice;
                        bld.ownerId = em.id;
                        bld.forSale = false;
                        if (!em.buildings) em.buildings = [];
                        em.buildings.push({ type: bld.type, townId: cheapTown.id, level: bld.level || 1 });
                        // Pay previous owner if they exist
                        if (prevOwner) {
                            var prevPerson = findPerson(prevOwner);
                            if (prevPerson) prevPerson.gold = (prevPerson.gold || 0) + discountedPrice;
                        }
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' buys a distressed ' + bType.name + ' in ' + cheapTown.name + ' for ' + discountedPrice + 'g (50% off).', {
                            type: 'elite_distressed_purchase',
                            cause: 'Economic collapse creates buying opportunities.',
                            effects: [
                                em.firstName + ' acquires ' + bType.name + ' at half price',
                                'New asset in ' + cheapTown.name,
                                'Opportunistic investment during economic downturn'
                            ]
                        });
                        break; // One purchase per cycle
                    }
                }
            }
        }
    }

    // ---- MIGRATION WAVE RESPONSE: Buy/sell property based on population trends ----
    function eliteMigrationAI(em, town, rng, strategy) {
        // Check all towns for migration trends
        for (var tIdx = 0; tIdx < world.towns.length; tIdx++) {
            var checkTown = world.towns[tIdx];
            if (!checkTown.migrationLog || checkTown.migrationLog.length === 0) continue;

            var recentIn = 0;
            var recentOut = 0;
            for (var mi = 0; mi < checkTown.migrationLog.length; mi++) {
                var entry = checkTown.migrationLog[mi];
                if (entry.day >= world.day - 30) {
                    recentIn += (entry.in || 0);
                    recentOut += (entry.out || 0);
                }
            }

            // Refugees flooding in: buy property (values about to rise)
            if (recentIn >= (CONFIG.MIGRATION_WAVE_THRESHOLD || 5) && checkTown.id === em.townId) {
                if ((em.gold || 0) > 500 && rng.chance(0.2)) {
                    // Try to buy a building for sale in this growing town
                    for (var bIdx = 0; bIdx < checkTown.buildings.length; bIdx++) {
                        var bld2 = checkTown.buildings[bIdx];
                        if (!bld2.forSale || bld2.ownerId === em.id) continue;
                        var bType2 = findBuildingType(bld2.type);
                        if (!bType2 || em.gold < bType2.cost) continue;
                        var maxR2 = 0;
                        for (var rkId2 in em.socialRank) { if ((em.socialRank[rkId2] || 0) > maxR2) maxR2 = em.socialRank[rkId2]; }
                        var rDef2 = CONFIG.SOCIAL_RANKS[maxR2] || CONFIG.SOCIAL_RANKS[0];
                        if ((em.buildings || []).length >= (rDef2.maxBuildings || 2)) break;
                        em.gold -= bType2.cost;
                        bld2.ownerId = em.id;
                        bld2.forSale = false;
                        if (!em.buildings) em.buildings = [];
                        em.buildings.push({ type: bld2.type, townId: checkTown.id, level: bld2.level || 1 });
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' snaps up a ' + bType2.name + ' in booming ' + checkTown.name + '.', {
                            type: 'elite_growth_investment',
                            cause: 'Population influx makes ' + checkTown.name + ' a growth market.',
                            effects: [
                                em.firstName + ' acquires ' + bType2.name + ' as migrants arrive',
                                'Property values expected to rise',
                                'Smart investment in growing town'
                            ]
                        });
                        break;
                    }
                }
            }

            // People fleeing: sell property before values drop
            if (recentOut >= (CONFIG.MIGRATION_WAVE_THRESHOLD || 5) && em.buildings) {
                for (var ebIdx = 0; ebIdx < em.buildings.length; ebIdx++) {
                    if (em.buildings[ebIdx].townId !== checkTown.id) continue;
                    if (rng.chance(0.15)) {
                        // Mark building for sale in the declining town
                        for (var tbIdx = 0; tbIdx < checkTown.buildings.length; tbIdx++) {
                            if (checkTown.buildings[tbIdx].ownerId === em.id && !checkTown.buildings[tbIdx].forSale) {
                                checkTown.buildings[tbIdx].forSale = true;
                                logEvent(em.firstName + ' ' + (em.lastName || '') + ' puts their ' + checkTown.buildings[tbIdx].type + ' up for sale in declining ' + checkTown.name + '.', {
                                    type: 'elite_decline_sale',
                                    cause: 'Population exodus from ' + checkTown.name + ' signals declining property values.',
                                    effects: [
                                        em.firstName + ' liquidates assets before further decline',
                                        'Building listed for sale in ' + checkTown.name
                                    ]
                                });
                                break;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // Track market scarcity: if a good is scarce somewhere, consider trading it there
        if (em.npcMerchantInventory) {
            for (var invRes in em.npcMerchantInventory) {
                if ((em.npcMerchantInventory[invRes] || 0) <= 2) continue;
                // Find towns where this good is very expensive (scarce)
                for (var stIdx = 0; stIdx < world.towns.length; stIdx++) {
                    var scarceTown = world.towns[stIdx];
                    if (!scarceTown.market || scarceTown.id === em.townId) continue;
                    var scarcePrice = scarceTown.market.prices[invRes] || 0;
                    var localPrice = town.market ? (town.market.prices[invRes] || 0) : 0;
                    var invRes2 = findResourceById(invRes);
                    if (invRes2 && scarcePrice > invRes2.basePrice * 2.0 && scarcePrice > localPrice * 1.5) {
                        // This good is scarce there — flag for travel AI
                        if (!em._kingdomAwareness) em._kingdomAwareness = {};
                        em._kingdomAwareness.scarcityTarget = { townId: scarceTown.id, good: invRes, price: scarcePrice };
                        break;
                    }
                }
            }
        }
    }

    // ---- SUPPLY CHAIN AI: Understand production chains, secure inputs ----
    function eliteSupplyChainAI(em, town, rng, strategy) {
        if (!em.buildings || em.buildings.length === 0) return;
        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // Map of intermediate inputs needed by our buildings
        var inputNeeds = {};
        for (var bIdx2 = 0; bIdx2 < em.buildings.length; bIdx2++) {
            var ownedBld = em.buildings[bIdx2];
            var ownedBt = findBuildingType(ownedBld.type);
            if (!ownedBt) continue;
            // Check if building requires inputs
            if (ownedBt.inputs) {
                for (var inputId in ownedBt.inputs) {
                    inputNeeds[inputId] = (inputNeeds[inputId] || 0) + (ownedBt.inputs[inputId] || 1);
                }
            }
            // Check availableProducts for current production choice
            if (ownedBt.availableProducts) {
                var currentProd = ownedBld.currentProduct || ownedBld.productionChoice;
                var recipe = currentProd ? ownedBt.availableProducts[currentProd] : null;
                if (recipe && recipe.inputs) {
                    for (var rInputId in recipe.inputs) {
                        inputNeeds[rInputId] = (inputNeeds[rInputId] || 0) + (recipe.inputs[rInputId] || 1);
                    }
                }
            }
        }

        // Do we own buildings that produce our inputs? If not, consider building one.
        for (var needId in inputNeeds) {
            var ownsProducer = em.buildings.some(function(b) {
                var bt2 = findBuildingType(b.type);
                return bt2 && bt2.produces === needId;
            });
            if (ownsProducer) continue;

            // Find what building produces this input
            var producerType = null;
            for (var pbi = 0; pbi < preferredBuildings.length; pbi++) {
                var pbt = findBuildingType(preferredBuildings[pbi]);
                if (pbt && pbt.produces === needId) {
                    producerType = preferredBuildings[pbi];
                    break;
                }
            }

            // If not in preferred, search all building types
            if (!producerType) {
                if (typeof CONFIG.BUILDING_TYPES !== 'undefined') {
                    for (var btKey in CONFIG.BUILDING_TYPES) {
                        var btCheck = CONFIG.BUILDING_TYPES[btKey];
                        if (btCheck && btCheck.produces === needId) {
                            producerType = btKey;
                            break;
                        }
                    }
                }
            }

            if (producerType && rng.chance(0.2)) {
                var pBt = findBuildingType(producerType);
                if (!pBt || em.gold < pBt.cost) continue;
                // Check building limits
                var maxR3 = 0;
                for (var rkId3 in em.socialRank) { if ((em.socialRank[rkId3] || 0) > maxR3) maxR3 = em.socialRank[rkId3]; }
                var rDef3 = CONFIG.SOCIAL_RANKS[maxR3] || CONFIG.SOCIAL_RANKS[0];
                if ((em.buildings || []).length >= (rDef3.maxBuildings || 2)) continue;
                // Check town slots
                var maxSlots2 = CONFIG.TOWN_CATEGORIES[town.category] ? CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots : 10;
                if (town.buildings.length >= maxSlots2) continue;

                em.gold -= pBt.cost;
                var chainBld = { type: producerType, level: 1, ownerId: em.id, townId: town.id, workers: [], upgrades: [], builtDay: world.day };
                town.buildings.push(chainBld);
                em.buildings.push({ type: producerType, townId: town.id, level: 1 });
                logEvent(em.firstName + ' ' + (em.lastName || '') + ' builds a ' + pBt.name + ' to secure ' + needId + ' supply chain.', {
                    type: 'elite_supply_chain',
                    cause: em.firstName + ' vertically integrates to secure raw material supply.',
                    effects: [
                        'New ' + pBt.name + ' secures ' + needId + ' production',
                        em.firstName + ' invested ' + pBt.cost + 'g in supply chain',
                        'Reduced dependency on external suppliers'
                    ]
                });
                break; // One supply chain investment per cycle
            }
        }

        // Check for supply gaps in current town (town needs something but has no producer)
        if (town.market && rng.chance(0.1)) {
            for (var gapRes in town.market.demand) {
                var gapDemand = town.market.demand[gapRes] || 0;
                var gapSupply = town.market.supply[gapRes] || 0;
                if (gapDemand <= 0 || gapSupply >= gapDemand * 0.5) continue;
                // No local producer
                var hasLocalProducer = town.buildings.some(function(b) {
                    var bt3 = findBuildingType(b.type);
                    return bt3 && bt3.produces === gapRes;
                });
                if (hasLocalProducer) continue;
                // Check building limits
                var maxR4 = 0;
                for (var rkId4 in em.socialRank) { if ((em.socialRank[rkId4] || 0) > maxR4) maxR4 = em.socialRank[rkId4]; }
                var rDef4 = CONFIG.SOCIAL_RANKS[maxR4] || CONFIG.SOCIAL_RANKS[0];
                if ((em.buildings || []).length >= (rDef4.maxBuildings || 2)) break;

                // Find building that produces it
                var gapProducer = null;
                if (typeof CONFIG.BUILDING_TYPES !== 'undefined') {
                    for (var gbtKey in CONFIG.BUILDING_TYPES) {
                        var gbtCheck = CONFIG.BUILDING_TYPES[gbtKey];
                        if (gbtCheck && gbtCheck.produces === gapRes) {
                            gapProducer = gbtKey;
                            break;
                        }
                    }
                }
                if (gapProducer) {
                    var gapBt = findBuildingType(gapProducer);
                    if (gapBt && em.gold >= gapBt.cost) {
                        var maxSlots3 = CONFIG.TOWN_CATEGORIES[town.category] ? CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots : 10;
                        if (town.buildings.length < maxSlots3) {
                            em.gold -= gapBt.cost;
                            var gapBld = { type: gapProducer, level: 1, ownerId: em.id, townId: town.id, workers: [], upgrades: [], builtDay: world.day };
                            town.buildings.push(gapBld);
                            em.buildings.push({ type: gapProducer, townId: town.id, level: 1 });
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' identifies supply gap: builds ' + gapBt.name + ' in ' + town.name + '.', {
                                type: 'elite_supply_gap',
                                cause: town.name + ' lacks local production of ' + gapRes + ' despite high demand.',
                                effects: [
                                    'New ' + gapBt.name + ' fills supply gap',
                                    em.firstName + ' invested ' + gapBt.cost + 'g to fill market need',
                                    'Town should see lower ' + gapRes + ' prices'
                                ]
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    // ---- COMPETITION AI: Track and respond to competitor behavior ----
    function eliteCompetitionAI(em, town, rng, strategy, personality) {
        var elites = world.people.filter(function(p) {
            return p.alive && p.isEliteMerchant && p.id !== em.id;
        });
        if (elites.length === 0) return;

        var preferredGoods = STRATEGY_GOODS[strategy] || STRATEGY_GOODS.diversified;

        // Track competitors in same town
        var localCompetitors = elites.filter(function(e) { return e.townId === em.townId; });
        em._competitorTracking = em._competitorTracking || {};

        for (var ci = 0; ci < localCompetitors.length; ci++) {
            var competitor = localCompetitors[ci];
            em._competitorTracking[competitor.id] = {
                strategy: competitor.strategy || 'diversified',
                gold: competitor.gold || 0,
                buildings: competitor.buildings ? competitor.buildings.length : 0,
                lastSeen: world.day
            };
        }

        // Check if another elite merchant is cornering a market (hoarding a good)
        for (var ei = 0; ei < elites.length; ei++) {
            var rival = elites[ei];
            if (rival.townId !== em.townId) continue;
            var rivalInv = rival.npcMerchantInventory || {};
            for (var rGood in rivalInv) {
                if ((rivalInv[rGood] || 0) < 20) continue; // Not cornering
                // Rival has a lot of this good — consider undercutting
                if (preferredGoods.indexOf(rGood) >= 0 && (em.npcMerchantInventory[rGood] || 0) > 0) {
                    // Sell some of this good to undercut the rival
                    if (town.market && rng.chance(0.3)) {
                        var underQty = Math.min(em.npcMerchantInventory[rGood] || 0, rng.randInt(2, 5));
                        var underPrice = Math.floor((town.market.prices[rGood] || 10) * 0.85); // 15% below market
                        if (underQty > 0 && underPrice > 0) {
                            em.gold += underPrice * underQty;
                            em.npcMerchantInventory[rGood] -= underQty;
                            town.market.supply[rGood] = (town.market.supply[rGood] || 0) + underQty;
                            logEvent(em.firstName + ' ' + (em.lastName || '') + ' undercuts ' + rival.firstName + '\'s ' + rGood + ' monopoly.', {
                                type: 'elite_market_competition',
                                cause: rival.firstName + ' was hoarding ' + rGood + '; ' + em.firstName + ' floods the market.',
                                effects: [
                                    em.firstName + ' sells ' + underQty + ' ' + rGood + ' at discount',
                                    'Market price pressure on ' + rGood,
                                    'Competition intensifies between elite merchants'
                                ]
                            });
                        }
                    }
                }
            }
        }

        // Diversification: don't invest in same goods/buildings as nearby competitors
        if (rng.chance(0.15) && personality.risk_tolerance > 50) {
            var competitorStrategies = {};
            for (var ci2 = 0; ci2 < localCompetitors.length; ci2++) {
                var cStrat = localCompetitors[ci2].strategy || 'diversified';
                competitorStrategies[cStrat] = (competitorStrategies[cStrat] || 0) + 1;
            }
            // If 2+ competitors share our strategy, consider switching
            if ((competitorStrategies[strategy] || 0) >= 2) {
                var altStrategies = ELITE_STRATEGIES.filter(function(s) { return s !== strategy && !(competitorStrategies[s] > 1); });
                if (altStrategies.length > 0 && rng.chance(0.1)) {
                    var oldStrategy = em.strategy;
                    em.strategy = rng.pick(altStrategies);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' pivots strategy from ' + oldStrategy + ' to ' + em.strategy + ' to avoid competition.', {
                        type: 'elite_strategy_pivot',
                        cause: 'Too many competitors pursuing ' + oldStrategy + ' strategy.',
                        effects: [
                            em.firstName + ' diversifies into ' + em.strategy + ' goods',
                            'New trading patterns and building priorities',
                            'Reduced direct competition with rival merchants'
                        ]
                    });
                }
            }
        }
    }

    // ---- NATIONALIZATION RESPONSE: Pivot away from nationalized industries ----
    function eliteNationalizationAI(em, town, rng, strategy) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom || !kingdom.nationalizedIndustries || kingdom.nationalizedIndustries.length === 0) return;

        var preferredBuildings = STRATEGY_BUILDINGS[strategy] || STRATEGY_BUILDINGS.diversified;

        // Check if any of our buildings are in a nationalized industry
        var affectedBuildings = [];
        if (em.buildings) {
            for (var bi2 = 0; bi2 < em.buildings.length; bi2++) {
                if (kingdom.nationalizedIndustries.indexOf(em.buildings[bi2].type) >= 0) {
                    affectedBuildings.push(em.buildings[bi2]);
                }
            }
        }

        if (affectedBuildings.length === 0) return;

        // React to nationalization
        if (!em._nationalizedPivot) {
            em._nationalizedPivot = true;
            // Reputation drops with this kingdom
            em.reputation[kingdom.id] = Math.max(0, (em.reputation[kingdom.id] || 50) - 15);
            em._kingRelationship[kingdom.id] = (em._kingRelationship[kingdom.id] || 0) - 20;

            // Sell nationalized buildings (mark for sale)
            for (var abi = 0; abi < affectedBuildings.length; abi++) {
                var affBld = affectedBuildings[abi];
                var affTown = findTown(affBld.townId);
                if (affTown) {
                    for (var tbIdx2 = 0; tbIdx2 < affTown.buildings.length; tbIdx2++) {
                        if (affTown.buildings[tbIdx2].ownerId === em.id && affTown.buildings[tbIdx2].type === affBld.type) {
                            affTown.buildings[tbIdx2].forSale = true;
                            break;
                        }
                    }
                }
            }

            // Consider pivoting to a different strategy if many buildings affected
            if (affectedBuildings.length >= 2 || rng.chance(0.5)) {
                var safeStrategies = ELITE_STRATEGIES.filter(function(s) {
                    var sBlds = STRATEGY_BUILDINGS[s] || [];
                    return !sBlds.some(function(bt) { return kingdom.nationalizedIndustries.indexOf(bt) >= 0; });
                });
                if (safeStrategies.length > 0) {
                    var oldStrat = em.strategy;
                    em.strategy = rng.pick(safeStrategies);
                    logEvent(em.firstName + ' ' + (em.lastName || '') + ' pivots from ' + oldStrat + ' after ' + kingdom.name + ' nationalizes their industry.', {
                        type: 'elite_nationalization_pivot',
                        cause: kingdom.name + ' nationalized ' + affectedBuildings[0].type + ', forcing ' + em.firstName + ' to adapt.',
                        effects: [
                            em.firstName + ' abandons ' + oldStrat + ' strategy',
                            'Pivoting to ' + em.strategy + ' to avoid nationalized sectors',
                            'Buildings marked for sale',
                            'Relationship with ' + kingdom.name + ' damaged'
                        ]
                    });
                }
            }

            // Consider relocating to a kingdom without nationalization
            if (rng.chance(0.3)) {
                var freeKingdoms = world.kingdoms.filter(function(k) {
                    return k.id !== kingdom.id && (!k.nationalizedIndustries || k.nationalizedIndustries.length === 0) && k.gold > 500;
                });
                if (freeKingdoms.length > 0) {
                    var freeK = freeKingdoms[rng.randInt(0, freeKingdoms.length - 1)];
                    var freeTowns = world.towns.filter(function(t) { return t.kingdomId === freeK.id && !t.isFrontline; });
                    if (freeTowns.length > 0) {
                        var freeDest = freeTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); })[0];
                        // Fix population bookkeeping
                        var oldNatTown = findTown(em.townId);
                        if (oldNatTown && oldNatTown.population > 0) oldNatTown.population--;
                        freeDest.population = (freeDest.population || 0) + 1;
                        em.townId = freeDest.id;
                        em.kingdomId = freeDest.kingdomId;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' relocates to ' + freeDest.name + ' in ' + freeK.name + ' to escape nationalization.', {
                            type: 'elite_nationalization_flee',
                            cause: 'Nationalization policies in ' + kingdom.name + ' threaten ' + em.firstName + '\'s business.',
                            effects: [
                                em.firstName + ' relocates to free-market ' + freeK.name,
                                'Business operations resume in ' + freeDest.name,
                                'Capital flight from ' + kingdom.name
                            ]
                        });
                    }
                }
            }
        }
    }

    // ---- KINGDOM RELATIONSHIP AI: Build king relationships, react to seizure ----
    function eliteKingdomRelationshipAI(em, town, rng, personality) {
        var kingdom = findKingdom(em.kingdomId);
        if (!kingdom) return;
        if (!em._kingRelationship) em._kingRelationship = {};
        var kId = kingdom.id;
        var rel = em._kingRelationship[kId] || 0;

        // Build relationship through bounty fulfillment
        if ((em._bountiesFulfilled || 0) > 0) {
            rel += em._bountiesFulfilled * 3;
            em._bountiesFulfilled = 0;
        }

        // Build relationship through tax compliance (wealthy merchants paying high taxes)
        if ((em.gold || 0) > 1000 && (kingdom.incomeTaxRate || 0.05) > 0) {
            rel += 1; // Passive loyalty from being a good taxpayer
        }

        // Damage from crime
        if (em.criminalRecord && (em.criminalRecord[kId] || 0) > 0) {
            rel -= em.criminalRecord[kId] * 5;
        }

        // React to having been a seizure victim
        if (em._seizureVictim) {
            rel -= 30;
            em._seizureVictim = false;
            // May relocate to a different kingdom
            if (rng.chance(0.4) && personality.loyalty < 60) {
                var betterKingdoms = world.kingdoms.filter(function(k) {
                    var kp2 = k.kingPersonality || {};
                    return k.id !== kId && kp2.greed !== 'corrupt' && kp2.greed !== 'greedy' && k.gold > 1000;
                });
                if (betterKingdoms.length > 0) {
                    var betterK = betterKingdoms[rng.randInt(0, betterKingdoms.length - 1)];
                    var destTowns = world.towns.filter(function(t) { return t.kingdomId === betterK.id && !t.isFrontline; });
                    if (destTowns.length > 0) {
                        var dest = destTowns.sort(function(a, b) { return (b.prosperity || 0) - (a.prosperity || 0); })[0];
                        em.townId = dest.id;
                        em.kingdomId = dest.kingdomId;
                        logEvent(em.firstName + ' ' + (em.lastName || '') + ' abandons ' + kingdom.name + ' after royal seizure, relocating to ' + betterK.name + '.', {
                            type: 'elite_seizure_response',
                            cause: 'Royal confiscation destroyed trust between ' + em.firstName + ' and ' + kingdom.name + '.',
                            effects: [
                                em.firstName + ' relocates to ' + dest.name + ' in ' + betterK.name,
                                'Major capital flight from ' + kingdom.name,
                                'Elite merchant loyalty to crown shattered'
                            ]
                        });
                    }
                }
            }
        }

        // Wealthy merchants attempt to bribe king for favorable policies
        if (rel > 20 && (em.gold || 0) > 3000 && personality.ambition > 60 && rng.chance(0.1)) {
            var bribeAmount = Math.floor(em.gold * 0.05);
            em.gold -= bribeAmount;
            kingdom.gold += bribeAmount;
            rel += 10;
            em.reputation[kId] = Math.min(100, (em.reputation[kId] || 50) + 5);
            logEvent(em.firstName + ' ' + (em.lastName || '') + ' makes a ' + bribeAmount + 'g "gift" to the crown of ' + kingdom.name + '.', {
                type: 'elite_king_gift',
                cause: em.firstName + ' cultivates royal favor through generous donations.',
                effects: [
                    bribeAmount + 'g donated to ' + kingdom.name + '\'s treasury',
                    'Royal relationship strengthened',
                    em.firstName + '\'s influence at court grows'
                ]
            });
        }

        em._kingRelationship[kId] = Math.max(-100, Math.min(100, rel));
    }

    // Elite merchant bidding on kingdom orders
    function tickEliteMerchantBidding() {
        if (!world) return;
        if (world.day % 7 !== 0) return;
        const rng = world.rng;
        if (!rng) return;

        const eliteMerchants = world.people.filter(p => p.alive && p.isEliteMerchant && p.occupation === 'merchant');
        for (const em of eliteMerchants) {
            for (const k of world.kingdoms) {
                if (!k.procurement || !k.procurement.orders) continue;
                const openOrders = k.procurement.orders.filter(o => o.status === 'open');
                for (const order of openOrders) {
                    // Skip if already bid
                    if (order.bids.some(b => b.merchantId === em.id)) continue;
                    // Check if merchant has relevant inventory or production
                    const inv = em.npcMerchantInventory || {};
                    const hasGoods = (inv[order.resourceId] || 0) > 0;
                    const hasBuildings = em.buildings && em.buildings.some(b => {
                        const bt = findBuildingType(b.type);
                        return bt && bt.produces === order.resourceId;
                    });
                    if (!hasGoods && !hasBuildings && !rng.chance(0.3)) continue;

                    // Bid price based on personality
                    const res = findResourceById(order.resourceId);
                    const basePrice = res ? res.basePrice : 10;
                    const personality = em.personality || {};
                    let priceMult = 1.0;
                    if ((personality.greed || 0) > 65) priceMult = 1.1 + rng.random() * 0.1;
                    else if ((personality.ambition || 0) > 65) priceMult = 0.9 + rng.random() * 0.1;
                    else priceMult = 0.95 + rng.random() * 0.15;
                    const bidPrice = Math.ceil(basePrice * priceMult);
                    if (bidPrice > order.maxPricePerUnit) continue;

                    order.bids.push({
                        merchantId: em.id,
                        pricePerUnit: bidPrice,
                        merchantType: 'elite',
                        bidDay: world.day,
                        netWorth: em.netWorth || em.gold || 0,
                        reputation: (em.reputation && em.reputation[k.id]) || 50,
                    });
                }
            }
        }
    }

    // ========================================================
    // §19B  NPC MERCHANT TICK (lightweight)
    // ========================================================
    function tickNPCMerchants() {
        if (!world) return;
        const rng = world.rng;
        if (!rng) return;
        // Only run every 3rd day for performance
        if (world.day % 3 !== 0) return;

        for (const p of world.people) {
            if (!p.alive || p.occupation !== 'merchant') continue;
            if (!p.npcMerchantInventory) continue;
            if (p.employerId) continue; // employed by player, skip
            if (p.npcMerchantCooldown > 0) { p.npcMerchantCooldown--; continue; }

            // NPC merchants returning home after travel
            if (!p.isEliteMerchant && p._returnHome && world.day >= (p._homeReturnDay || 0)) {
                p.traveling = true;
                p.travelProgress = 0;
                p.travelDestination = p.travelOriginTown;
                p.travelOriginTown = p.townId;
                p._returnHome = false;
                p._homeReturnDay = 0;
                continue;
            }

            // ── Merchant Travel Progress (elite and regular NPC) ──
            if (p.traveling) {
                var progressRate = p.isEliteMerchant ? (p.travelOffroad ? 0.07 : 0.15) : 0.05; // NPCs are slower
                p.travelProgress = (p.travelProgress || 0) + progressRate;
                if (p.travelProgress >= 1.0) {
                    p.townId = p.travelDestination;
                    p.traveling = false;
                    p.travelProgress = 0;
                    p.travelDestination = null;
                    p.travelOffroad = false;
                    // NPC merchants return home after selling
                    if (!p.isEliteMerchant && p.travelOriginTown) {
                        p._returnHome = true;
                        p._homeReturnDay = world.day + 5; // stay 5 days then return
                    }
                    var arrivalTown = findTown(p.townId);
                    if (p.isEliteMerchant) {
                        logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' has arrived in ' + (arrivalTown ? arrivalTown.name : 'unknown') + '.',
                            { type: 'merchant' }, 'npc_activity');
                        emitTrackedEMNotification(p, 'has arrived in ' + (arrivalTown ? arrivalTown.name : 'town'), { townId: p.townId });
                    }
                }
                continue; // Skip other actions while traveling
            }

            const town = findTown(p.townId);
            if (!town || !town.market) continue;

            // Buy cheap goods
            if (p.gold > 10) {
                const goodIds = Object.keys(town.market.prices);
                if (goodIds.length > 0) {
                    const resId = rng.pick(goodIds);
                    const price = town.market.prices[resId] || 999;
                    const supply = town.market.supply[resId] || 0;
                    const res = findResourceById(resId);
                    if (res && supply > 5 && price < res.basePrice && p.gold >= price * 2) {
                        const qty = Math.min(rng.randInt(1, 3), Math.floor(supply * 0.1), Math.floor(p.gold / price));
                        if (qty > 0) {
                            p.gold -= Math.floor(price * qty);
                            p.npcMerchantInventory[resId] = (p.npcMerchantInventory[resId] || 0) + qty;
                            town.market.supply[resId] -= qty;
                            collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                        }
                    }
                }
            }

            // Sell when profitable
            for (const resId in p.npcMerchantInventory) {
                if ((p.npcMerchantInventory[resId] || 0) <= 0) continue;
                const price = town.market.prices[resId] || 1;
                const res = findResourceById(resId);
                if (res && price > res.basePrice * 1.3) {
                    const qty = Math.min(p.npcMerchantInventory[resId], rng.randInt(1, 3));
                    if (qty > 0) {
                        p.gold += Math.floor(price * qty);
                        p.npcMerchantInventory[resId] -= qty;
                        town.market.supply[resId] = (town.market.supply[resId] || 0) + qty;
                        collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                    }
                }
            }

            // Occasionally buy 1 building if wealthy
            if (p.gold > 500 && rng.chance(0.005) && (!p.buildings || p.buildings.length < 2)) {
                const cheapBuildings = ['market_stall', 'wheat_farm', 'bakery'];
                const bType = rng.pick(cheapBuildings);
                const bt = findBuildingType(bType);
                if (bt && p.gold >= bt.cost) {
                    p.gold -= bt.cost;
                    if (!p.buildings) p.buildings = [];
                    p.buildings.push({ type: bType, townId: p.townId, level: 1 });
                    town.buildings.push({ type: bType, level: 1, ownerId: p.id });
                }
            }

            // Aggressive elite merchants may sabotage bridges to hurt competitors
            if (p.isEliteMerchant && p.wealthClass === 'upper' && rng.chance(0.002)) {
                const bridgeRoads = world.roads.map((r, idx) => ({ road: r, idx }))
                    .filter(e => (e.road.hasBridge || false) && !e.road.bridgeDestroyed &&
                        e.road.fromTownId !== p.townId && e.road.toTownId !== p.townId);
                if (bridgeRoads.length > 0) {
                    const target = bridgeRoads[rng.randInt(0, bridgeRoads.length - 1)];
                    destroyBridge(target.idx);
                    logEvent(`\uD83D\uDC80 An unknown saboteur has destroyed the bridge between ${findTown(target.road.fromTownId)?.name || '?'} and ${findTown(target.road.toTownId)?.name || '?'}!`);
                }
            }

            // Wealthy elite merchants may build toll routes — scored by road importance
            if (p.isEliteMerchant && (p.gold || 0) > 20000 && rng.chance(CONFIG.ELITE_MERCHANT_ROUTE_BUILD_CHANCE || 0.001)) {
                const homeTown = findTown(p.townId);
                if (homeTown) {
                    const potentialTargets = world.towns.filter(t => {
                        if (t.id === p.townId) return false;
                        if (t.isIsland) return false;
                        const d = Math.hypot(homeTown.x - t.x, homeTown.y - t.y);
                        if (d > 2500 || d < 200) return false;
                        const hasRoad = world.roads.some(r =>
                            (r.fromTownId === p.townId && r.toTownId === t.id) ||
                            (r.fromTownId === t.id && r.toTownId === p.townId)
                        );
                        if (hasRoad) return false;
                        const wf = checkWaterPath(homeTown.x, homeTown.y, t.x, t.y);
                        if (wf > 0.15) return false;
                        return true;
                    });
                    if (potentialTargets.length > 0) {
                        // Pick highest importance target instead of random
                        var bestEmTarget = null;
                        var bestEmScore = -Infinity;
                        for (var eti = 0; eti < potentialTargets.length; eti++) {
                            var emScore = computeRoadImportance(homeTown, potentialTargets[eti]);
                            if (emScore > bestEmScore) { bestEmScore = emScore; bestEmTarget = potentialTargets[eti]; }
                        }
                        if (bestEmTarget) {
                            const d = Math.hypot(homeTown.x - bestEmTarget.x, homeTown.y - bestEmTarget.y);
                            const cost = 3000 + Math.floor(d * 5);
                            if ((p.gold || 0) >= cost) {
                                p.gold -= cost;
                                buildNewRoad(p.townId, bestEmTarget.id, p.id, {
                                    ownerId: p.id,
                                    tollRate: 3 + rng.randInt(0, 7),
                                    isTollRoad: true,
                                    quality: 2,
                                });
                                logEvent(`\uD83D\uDEE4\uFE0F Elite merchant ${p.name} has built a toll road between ${homeTown.name} and ${bestEmTarget.name}!`, null, 'npc_activity');
                            }
                        }
                    }
                }
            }

            // ── Elite Merchant Travel Decision (every 7 days, staggered) ──
            if (p.isEliteMerchant && world.day % 7 === (p.id % 7)) {
                var emTown = findTown(p.townId);
                if (emTown) {
                    var emKingdom = findKingdom(emTown.kingdomId);

                    // Evaluate travel to nearby towns
                    var bestDest = null;
                    var bestScore = 0;

                    // Find connected towns (roads + sea routes)
                    var connectedTowns = [];
                    for (var ri = 0; ri < (world.roads || []).length; ri++) {
                        var road = world.roads[ri];
                        if (road.fromTownId === p.townId) connectedTowns.push(road.toTownId);
                        if (road.toTownId === p.townId) connectedTowns.push(road.fromTownId);
                    }
                    for (var si = 0; si < (world.seaRoutes || []).length; si++) {
                        var sr = world.seaRoutes[si];
                        if (sr.fromTownId === p.townId) connectedTowns.push(sr.toTownId);
                        if (sr.toTownId === p.townId) connectedTowns.push(sr.fromTownId);
                    }

                    for (var ci = 0; ci < connectedTowns.length; ci++) {
                        var candTown = findTown(connectedTowns[ci]);
                        if (!candTown || !candTown.market) continue;

                        var score = 0;

                        // Score based on price differences (arbitrage opportunity)
                        var inv = p.npcMerchantInventory || {};
                        for (var resId in inv) {
                            if ((inv[resId] || 0) > 3) {
                                var localPrice = emTown.market.prices[resId] || 0;
                                var destPrice = candTown.market.prices[resId] || 0;
                                if (destPrice > localPrice * 1.3) {
                                    score += (destPrice - localPrice) * inv[resId];
                                }
                            }
                        }

                        // Score based on supply gaps (goods the dest town needs)
                        for (var gId in (candTown.market.demand || {})) {
                            var destSupply = (candTown.market.supply || {})[gId] || 0;
                            var destDemand = candTown.market.demand[gId] || 0;
                            if (destDemand > destSupply * 1.5) {
                                score += (destDemand - destSupply) * 2;
                            }
                        }

                        // Flee from war zone
                        if (emKingdom && emKingdom.atWar && emKingdom.atWar.size > 0) {
                            var candKingdom = findKingdom(candTown.kingdomId);
                            if (candKingdom && (!candKingdom.atWar || candKingdom.atWar.size === 0)) {
                                score += 500; // Strong incentive to flee war
                            }
                        }

                        // Higher prosperity = more attractive
                        score += (candTown.prosperity || 50) * 0.5;

                        // Penalty for leaving home town (EMs prefer stability)
                        score -= 100;

                        if (score > bestScore) {
                            bestScore = score;
                            bestDest = connectedTowns[ci];
                        }
                    }

                    // If no good connected town, consider off-road travel to any reachable town
                    if (!bestDest || bestScore < 200) {
                        var allTowns = world.towns.filter(function(t) {
                            return t.id !== p.townId && !t.isIsland;
                        });

                        for (var ati = 0; ati < Math.min(allTowns.length, 5); ati++) {
                            var randTown = allTowns[rng.randInt(0, allTowns.length - 1)];
                            if (!randTown || !randTown.market) continue;

                            var dist = Math.hypot((randTown.x || 0) - (emTown.x || 0), (randTown.y || 0) - (emTown.y || 0));
                            if (dist > 3000) continue; // Too far for off-road

                            var offroadScore = 0;
                            var distPenalty = dist * 0.1;

                            // Check for big arbitrage opportunities
                            var oInv = p.npcMerchantInventory || {};
                            for (var oResId in oInv) {
                                var oLocal = emTown.market.prices[oResId] || 0;
                                var oDest = randTown.market.prices[oResId] || 0;
                                if (oDest > oLocal * 1.5) {
                                    offroadScore += (oDest - oLocal) * (oInv[oResId] || 0);
                                }
                            }

                            offroadScore -= distPenalty;

                            if (offroadScore > bestScore && offroadScore > 400) {
                                bestScore = offroadScore;
                                bestDest = randTown.id;
                            }
                        }

                        // Start off-road travel if threshold met
                        if (bestDest && bestScore > 400) {
                            p.traveling = true;
                            p.travelDestination = bestDest;
                            p.travelProgress = 0;
                            p.travelOffroad = true;

                            var offDestName = findTown(bestDest) ? findTown(bestDest).name : 'unknown';
                            logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' departed from ' + emTown.name + ' heading off-road to ' + offDestName + '.',
                                { type: 'merchant' }, 'npc_activity');
                            emitTrackedEMNotification(p, 'is traveling off-road to ' + offDestName, { townId: p.townId });
                        }
                    }

                    // On-road travel if score threshold met (and not already started off-road above)
                    if (!p.traveling && bestDest && bestScore > 200) {
                        p.traveling = true;
                        p.travelDestination = bestDest;
                        p.travelProgress = 0;
                        p.travelOffroad = false;

                        // Use kingdom transport if available
                        if (emKingdom && emKingdom.laws && emKingdom.laws.kingdomTransport) {
                            var transportCost = emKingdom.laws.transportRate || 15;
                            if ((p.gold || 0) >= transportCost) {
                                p.gold -= transportCost;
                                emKingdom.gold = (emKingdom.gold || 0) + transportCost;
                                p.travelProgress = 0.3; // Faster with kingdom transport
                            }
                        }

                        var destName = findTown(bestDest) ? findTown(bestDest).name : 'unknown';
                        logEvent('📦 Elite merchant ' + (p.firstName || 'Unknown') + ' ' + (p.lastName || '') + ' departed from ' + emTown.name + ' heading to ' + destName + '.',
                            { type: 'merchant' }, 'npc_activity');
                        emitTrackedEMNotification(p, 'is traveling to ' + destName, { townId: p.townId });
                    }
                }
            }

            p.npcMerchantCooldown = rng.randInt(1, 3);
        }
    }

    function findResourceById(id) {
        _ensureLookupMaps();
        return _resourceTypeMap[id] || null;
    }

    function tickNPCMerchantTravel() {
        if (!world) return;
        // Only check every NPC_MERCHANT_TRAVEL_INTERVAL days
        if (world.day % (CONFIG.NPC_MERCHANT_TRAVEL_INTERVAL || 30) !== 0) return;
        
        var rng = world.rng;
        if (!rng) return;
        
        for (var mi = 0; mi < world.people.length; mi++) {
            var m = world.people[mi];
            if (!m.alive || m.occupation !== 'merchant' || m.isEliteMerchant) continue;
            if (m.employerId) continue; // employed by player
            if (m.traveling) continue; // already traveling
            if ((m.gold || 0) < (CONFIG.NPC_MERCHANT_TRAVEL_GOLD_MIN || 500)) continue;
            
            // Only ~10% of qualifying merchants actually consider traveling
            if (rng.random() > 0.10) continue;
            
            var town = findTown(m.townId);
            if (!town || !town.connectedTowns || town.connectedTowns.length === 0) continue;
            
            // Check 1-2 nearest connected towns for price differentials
            var checkCount = Math.min(town.connectedTowns.length, 2);
            var bestDest = null;
            var bestProfit = 0;
            
            for (var ci = 0; ci < checkCount; ci++) {
                var neighbor = findTown(town.connectedTowns[ci]);
                if (!neighbor || !neighbor.market) continue;
                
                // Check inventory for selling opportunities
                var inv = m.npcMerchantInventory || {};
                for (var resId in inv) {
                    if ((inv[resId] || 0) <= 0) continue;
                    var localPrice = town.market.prices[resId] || 0;
                    var destPrice = neighbor.market.prices[resId] || 0;
                    if (destPrice > localPrice * (CONFIG.NPC_MERCHANT_TRAVEL_PRICE_SELL_THRESHOLD || 1.5)) {
                        var profit = (destPrice - localPrice) * inv[resId];
                        if (profit > bestProfit) {
                            bestProfit = profit;
                            bestDest = neighbor.id;
                        }
                    }
                }
                
                // Check for buying opportunities at destination
                for (var rk in neighbor.market.prices) {
                    var nPrice = neighbor.market.prices[rk] || 0;
                    var lPrice = town.market.prices[rk] || 0;
                    if (nPrice > 0 && lPrice > 0 && nPrice < lPrice * (CONFIG.NPC_MERCHANT_TRAVEL_PRICE_BUY_THRESHOLD || 0.6)) {
                        var buyProfit = (lPrice - nPrice) * 5; // assume buying ~5 units
                        if (buyProfit > bestProfit) {
                            bestProfit = buyProfit;
                            bestDest = neighbor.id;
                        }
                    }
                }
            }
            
            if (bestDest && bestProfit > 20) {
                m.traveling = true;
                m.travelProgress = 0;
                m.travelDestination = bestDest;
                m.travelOriginTown = m.townId;
                m.travelOffroad = false;
            }
        }
    }

    // ========================================================
    // §19B1b  FAMILY MEMBER ENHANCED SIMULATION
    // ========================================================
    // Family members get more simulation than normal NPCs but less than elite merchants.
    // Runs every 5 days (vs NPCs daily, elite merchants every 3 days).

    function tickFamilyMembers() {
        if (!world) return;
        const rng = world.rng;
        if (!rng) return;
        if (world.day % 5 !== 0) return;

        // Get player family member IDs
        const playerObj = typeof Player !== 'undefined' ? Player : null;
        if (!playerObj || !playerObj.familyMembers) return;
        const familyIds = new Set();
        for (var fi = 0; fi < playerObj.familyMembers.length; fi++) {
            familyIds.add(playerObj.familyMembers[fi].npcId);
        }
        if (familyIds.size === 0) return;

        for (const p of world.people) {
            if (!p.alive || !familyIds.has(p.id)) continue;
            if (p.employerId) continue; // employed by player, let player manage them

            const town = findTown(p.townId);
            if (!town || !town.market) continue;

            // Initialize family merchant inventory if not present
            if (!p.npcMerchantInventory) p.npcMerchantInventory = {};
            if (!p.familySimulated) p.familySimulated = true;

            // 1. SMART TRADING — buy underpriced goods, sell overpriced (better than NPC merchants)
            if ((p.gold || 0) > 5) {
                const goodIds = Object.keys(town.market.prices);
                // Try to find a good deal (check up to 5 goods)
                for (var gi = 0; gi < Math.min(5, goodIds.length); gi++) {
                    const resId = rng.pick(goodIds);
                    const price = town.market.prices[resId] || 999;
                    const supply = town.market.supply[resId] || 0;
                    const res = findResourceById(resId);
                    if (!res) continue;
                    // Buy if price < 80% of base (smarter than NPC's 100% threshold)
                    if (supply > 3 && price < res.basePrice * 0.8 && p.gold >= price * 3) {
                        const qty = Math.min(rng.randInt(1, 5), Math.floor(supply * 0.15), Math.floor(p.gold / price / 2));
                        if (qty > 0) {
                            p.gold -= Math.floor(price * qty);
                            p.npcMerchantInventory[resId] = (p.npcMerchantInventory[resId] || 0) + qty;
                            town.market.supply[resId] -= qty;
                            collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                            break;
                        }
                    }
                }
            }

            // Sell when profitable (lower threshold than NPC merchants — 120% vs 130%)
            for (const resId in p.npcMerchantInventory) {
                if ((p.npcMerchantInventory[resId] || 0) <= 0) continue;
                const price = town.market.prices[resId] || 1;
                const res = findResourceById(resId);
                if (res && price > res.basePrice * 1.2) {
                    const qty = Math.min(p.npcMerchantInventory[resId], rng.randInt(1, 4));
                    if (qty > 0) {
                        p.gold += Math.floor(price * qty);
                        p.npcMerchantInventory[resId] -= qty;
                        town.market.supply[resId] = (town.market.supply[resId] || 0) + qty;
                        collectTradeTax(town.kingdomId, Math.floor(price * qty), resId);
                    }
                }
            }

            // 2. JOB SEEKING — if unemployed and not a merchant, try to find work
            if (!p.occupation || p.occupation === 'unemployed' || p.occupation === 'none') {
                // Look for open positions in town buildings
                var hired = false;
                for (var bi = 0; bi < town.buildings.length && !hired; bi++) {
                    var bldg = town.buildings[bi];
                    var bt = findBuildingType(bldg.type);
                    if (!bt || !bt.workers) continue;
                    var currentWorkers = bldg.workers ? bldg.workers.length : 0;
                    var maxWorkers = bt.workers * (bldg.level || 1);
                    if (currentWorkers < maxWorkers) {
                        p.occupation = bt.jobTitle || 'worker';
                        if (!bldg.workers) bldg.workers = [];
                        bldg.workers.push(p.id);
                        p.employerId = bldg.ownerId || null;
                        hired = true;
                    }
                }
                if (!hired) {
                    p.occupation = 'merchant';
                }
            }

            // 3. WEALTH ACCUMULATION — family members save more aggressively
            // Small passive income to represent family connections (5-15g every 5 days)
            if (rng.chance(0.4)) {
                var familyIncome = rng.randInt(5, 15);
                p.gold = (p.gold || 0) + familyIncome;
            }

            // 4. BUILDING PURCHASE — can own up to 2 buildings (less than elite unlimited)
            if ((p.gold || 0) > 300 && rng.chance(0.01) && (!p.buildings || p.buildings.length < 2)) {
                const affordableBuildings = ['market_stall', 'wheat_farm', 'bakery', 'chicken_farm', 'lumber_camp'];
                const bType = rng.pick(affordableBuildings);
                var bt = findBuildingType(bType);
                if (bt && p.gold >= bt.cost) {
                    p.gold -= bt.cost;
                    if (!p.buildings) p.buildings = [];
                    p.buildings.push({ type: bType, townId: p.townId, level: 1 });
                    town.buildings.push({ type: bType, level: 1, ownerId: p.id });
                    logEvent(`Your family member ${p.firstName || p.name || 'relative'} opened a ${bt.name} in ${town.name}.`);
                }
            }

            // 5. SOCIAL CONNECTIONS — family members build relationships in their town
            if (rng.chance(0.05)) {
                // Slight reputation boost in their town's kingdom
                if (town.kingdomId && playerObj.reputation) {
                    var currentRep = playerObj.reputation[town.kingdomId] || 50;
                    if (currentRep < 80) {
                        // Family presence slowly builds reputation
                        playerObj.state.reputation[town.kingdomId] = Math.min(100, currentRep + 0.5);
                    }
                }
            }
        }
    }

    // ========================================================
    // §19B2  WORKER ECONOMY TICK
    // ========================================================

    function tickWorkerEconomy() {
        if (!world) return;
        const rng = world.rng;
        const day = world.day;

        // --- Worker poaching (every WORKER_POACH_INTERVAL days) ---
        if (day % CONFIG.WORKER_POACH_INTERVAL === 0) {
            // Build merchants-by-town index to avoid O(P²) filtering
            var _merchantsByTown = {};
            for (var mi = 0; mi < world.people.length; mi++) {
                var mp = world.people[mi];
                if (mp.alive && mp.occupation === 'merchant') {
                    if (!_merchantsByTown[mp.townId]) _merchantsByTown[mp.townId] = [];
                    _merchantsByTown[mp.townId].push(mp);
                }
            }

            for (const p of world.people) {
                if (!p.alive || !p.employerId) continue;
                if ((p.workerSkill || 0) < CONFIG.WORKER_POACH_MIN_SKILL) continue;
                var poachChance = CONFIG.WORKER_POACH_CHANCE;
                // Player's loyalty_bonus skill: 30% less likely to have poach attempts
                if (p.employerId === 'player' && typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('loyalty_bonus')) {
                    poachChance *= 0.7;
                }
                if (!rng.chance(poachChance)) continue;

                // Find an NPC merchant in the same town who might poach
                const town = findTown(p.townId);
                if (!town) continue;
                var townMerchants = _merchantsByTown[p.townId] || [];
                var npcMerchants = townMerchants.filter(function(m) { return m.id !== p.employerId && m.gold > 100; });
                if (npcMerchants.length === 0) continue;
                const poacher = rng.pick(npcMerchants);
                const tier = getWorkerSkillTier(p.workerSkill || 0);
                const offerWage = Math.ceil((CONFIG.WORKER_WEEKLY_WAGES[tier] || 2) * 1.5);

                // Underpaid workers are more vulnerable
                const currentWage = p.currentWage || CONFIG.WORKER_WEEKLY_WAGES[tier] || 2;
                const minWage = CONFIG.WORKER_WEEKLY_WAGES[tier] || 2;
                const isUnderpaid = currentWage < minWage;
                const poachSuccess = isUnderpaid ? 0.6 : 0.3;

                p.poachAttempt = {
                    by: poacher.id,
                    offerWage: offerWage,
                    day: day,
                };

                // Auto-resolve for NPC-owned workers
                if (p.employerId !== 'player') {
                    if (rng.chance(poachSuccess)) {
                        removeWorkerFromBuilding(p);
                        p.employerId = poacher.id;
                    }
                    delete p.poachAttempt;
                }
            }
        }

        // --- Employer reputation update (monthly) ---
        if (day % 30 === 0) {
            for (const town of world.towns) {
                if (!town.employerReputation) town.employerReputation = {};
                for (const bld of town.buildings) {
                    if (!bld.ownerId || !bld.workers || bld.workers.length === 0) continue;
                    const rep = town.employerReputation[bld.ownerId] || 0;
                    let delta = 0;

                    for (const wid of bld.workers) {
                        const w = findPerson(wid);
                        if (!w || !w.alive) continue;
                        // Paying above minimum wage
                        const tier = getWorkerSkillTier(w.workerSkill || 0);
                        const minWage = CONFIG.WORKER_WEEKLY_WAGES[tier] || 2;
                        if ((w.currentWage || 0) >= minWage) delta += 1;
                        // Long employment tenure
                        if (w.hiredDay && day - w.hiredDay > 90) delta += 1;
                    }

                    // Food availability bonus
                    const foodAvail = (town.market.supply.bread || 0) + (town.market.supply.wheat || 0);
                    if (foodAvail > 0) delta += 1;

                    town.employerReputation[bld.ownerId] = Math.max(-100, Math.min(100, rep + delta));
                }
            }
        }

        // --- Festival generation (instrument festivals every 60-90 days) ---
        if (day % 15 === 0 && rng.chance(0.05)) {
            const town = rng.pick(world.towns);
            const alreadyHasFestival = world.events.some(ev =>
                ev.active && ev.type === 'instrument_festival' && ev.townId === town.id
            );
            if (!alreadyHasFestival) {
                const duration = rng.randInt(5, 10);
                world.events.push({
                    id: uid('ev'),
                    type: 'instrument_festival',
                    name: 'Music Festival',
                    townId: town.id,
                    startDay: day,
                    active: true,
                    daysRemaining: duration,
                });
                logEvent(`🎵 A music festival begins in ${town.name}! Instrument demand surges.`);
            }
        }
    }

    // ========================================================
    // §19C  INDIVIDUAL NPC PURCHASING (batched round-robin)
    // ========================================================
    function getMarketPrice(town, resourceId) {
        var rawPrice = town.market.prices[resourceId] || (findResourceById(resourceId) || {}).basePrice || 1;
        // Apply price controls if kingdom has the law
        var kingdom = findKingdom(town.kingdomId);
        return applyPriceControls(kingdom, resourceId, rawPrice);
    }

    function applyPriceControls(kingdom, resourceId, price) {
        if (!kingdom || !CONFIG.PRICE_CONTROLS) return price;
        if (!hasSpecialLaw(kingdom, 'price_controls')) return price;
        var essentials = CONFIG.PRICE_CONTROLS.essentialGoods;
        if (essentials.indexOf(resourceId) === -1) return price;
        var res = findResourceById(resourceId);
        if (!res) return price;
        var maxPrice = Math.floor(res.basePrice * CONFIG.PRICE_CONTROLS.maxPriceMultiplier);
        return Math.min(price, maxPrice);
    }

    function tryBuyFromMarket(person, town, resource) {
        const supply = town.market.supply[resource] || 0;
        if (supply <= 0) return false;
        const price = getMarketPrice(town, resource);
        if (person.gold >= price) {
            person.gold -= price;
            town.market.supply[resource]--;
            // Bug 1 fix: collect trade tax on NPC market purchases
            collectTradeTax(town.kingdomId, price, resource);
            return true;
        }
        return false;
    }

    function processNPCPurchase(person, town) {
        const isUpper = person.gold >= CONFIG.NPC_UPPER_GOLD;
        const isMiddle = person.gold >= CONFIG.NPC_MIDDLE_GOLD;

        // Children (under 18) are fed by parents/community — baseline food
        if (person.age < 18) {
            person.needs.food = Math.min(100, Math.max(person.needs.food, 50));
            return; // Children don't need to purchase goods
        }

        // FOOD — everyone needs food, using preferences
        const foodTypes = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'wheat'];
        let fed = false;
        
        // Sort foods by preference-adjusted value if person has preferences
        let sortedFoods = foodTypes;
        if (person.foodPreferences) {
            sortedFoods = foodTypes.slice().sort((a, b) => {
                const prefA = person.foodPreferences[a] || 1.0;
                const prefB = person.foodPreferences[b] || 1.0;
                const priceA = getMarketPrice(town, a);
                const priceB = getMarketPrice(town, b);
                const scoreA = prefA * (1 / Math.max(0.1, priceA));
                const scoreB = prefB * (1 / Math.max(0.1, priceB));
                return scoreB - scoreA;
            });
        }
        
        for (const food of sortedFoods) {
            if (fed) break;
            const supply = town.market.supply[food] || 0;
            if (supply <= 0) continue;
            const price = getMarketPrice(town, food);
            const pref = (person.foodPreferences && person.foodPreferences[food]) || 1.0;
            // Willing to pay up to 20% more for preferred food
            const maxPay = pref > 1.2 ? price * 1.2 : price;
            if (person.gold >= price) {
                // If non-preferred food is 40%+ cheaper than best preferred, buy cheap
                person.gold -= price;
                town.market.supply[food]--;
                // Bug 1 fix: collect trade tax on NPC food purchase
                collectTradeTax(town.kingdomId, price, food);
                fed = true;
                let foodRestore = CONFIG.NPC_PURCHASE_FOOD_RESTORE;
                // Preferred food bonus
                if (pref > 1.1) {
                    person.needs.happiness = Math.min(100, (person.needs.happiness || 50) + 0.5);
                }
                person.needs.food = Math.min(100, (person.needs.food || 50) + foodRestore);
                // Track recent foods for variety
                if (!person.recentFoods) person.recentFoods = [];
                person.recentFoods.push(food);
                if (person.recentFoods.length > 30) person.recentFoods.shift();
            }
        }

        // If can't afford food → happiness drops
        if (!fed) {
            person.needs.happiness = Math.max(0, (person.needs.happiness || 50) - 2);
            person.needs.food = Math.max(0, (person.needs.food || 50) - 3);
        }

        // CLOTHES — occasional purchase (~once per 30 days)
        if (world.rng.chance(CONFIG.NPC_CLOTHES_CHANCE)) {
            tryBuyFromMarket(person, town, 'clothes');
        }

        // TOOLS — workers need tools occasionally
        if (person.occupation === 'farmer' || person.occupation === 'craftsman' ||
            person.occupation === 'miner' || person.occupation === 'woodcutter') {
            if (world.rng.chance(CONFIG.NPC_TOOLS_CHANCE)) {
                tryBuyFromMarket(person, town, 'tools');
            }
        }

        // LUXURY — upper/middle class only
        if (isUpper && world.rng.chance(CONFIG.NPC_LUXURY_UPPER_CHANCE)) {
            const luxuries = ['wine', 'jewelry', 'furniture', 'silk', 'perfume', 'fine_clothes', 'tapestry', 'gold_goblet', 'pearls'];
            // Check fashion trends for this kingdom
            let trendyGoods = [];
            if (world.fashionTrends) {
                for (const trend of world.fashionTrends) {
                    if (!trend.active) continue;
                    if (trend.originKingdomId === person.kingdomId || (trend.spreadTo && trend.spreadTo.includes(person.kingdomId))) {
                        trendyGoods.push(trend.goodId);
                    }
                }
            }
            // Prefer trendy goods
            let pick;
            if (trendyGoods.length > 0 && world.rng.chance(0.4)) {
                pick = trendyGoods[Math.floor(world.rng.random() * trendyGoods.length)];
            } else {
                pick = luxuries[Math.floor(world.rng.random() * luxuries.length)];
            }
            tryBuyFromMarket(person, town, pick);
        } else if (isMiddle && world.rng.chance(CONFIG.NPC_LUXURY_MIDDLE_CHANCE)) {
            tryBuyFromMarket(person, town, 'wine');
        }

        // NPC INCOME — daily income based on occupation
        const incomeTable = CONFIG.NPC_DAILY_INCOME;
        const income = (incomeTable[person.occupation] || 1) / CONFIG.TICKS_PER_DAY;
        person.gold += income;
    }

    function tickNPCPurchasing() {
        if (!world._npcPurchaseIndex) world._npcPurchaseIndex = 0;

        const alive = world.people.filter(p => p.alive);
        if (alive.length === 0) return;
        const batchSize = Math.ceil(alive.length / CONFIG.TICKS_PER_DAY);
        const start = world._npcPurchaseIndex;
        const end = Math.min(start + batchSize, alive.length);

        for (let i = start; i < end; i++) {
            const person = alive[i];
            const town = findTown(person.townId);
            if (!town || !town.market) continue;
            processNPCPurchase(person, town);
        }

        world._npcPurchaseIndex = end >= alive.length ? 0 : end;
    }

    // ========================================================
    // §19D  NATURAL DISASTERS
    // ========================================================
    function tickDisasters() {
        const rng = world.rng;

        for (const town of world.towns) {
            // FLOOD — port/coastal towns only
            if (town.isPort && rng.chance(CONFIG.DISASTER_FLOOD_CHANCE)) {
                triggerFlood(town);
            }

            // FIRE — any town, more likely in large towns
            if (rng.chance(CONFIG.DISASTER_FIRE_CHANCE * Math.max(1, town.population / CONFIG.DISASTER_FIRE_POP_SCALE))) {
                triggerFire(town);
            }

            // PLAGUE — any town, more likely in cities/capitals
            const plagueMult = town.category === 'capital_city' ? CONFIG.DISASTER_PLAGUE_CAPITAL_MULT
                             : town.category === 'city' ? CONFIG.DISASTER_PLAGUE_CITY_MULT : 1;
            if (rng.chance(CONFIG.DISASTER_PLAGUE_CHANCE * plagueMult)) {
                triggerPlague(town);
            }

            // CROP BLIGHT — towns with farms, spring/summer only
            const season = getSeason(world.day);
            if (season === 'Spring' || season === 'Summer') {
                if (town.buildings.some(b => b.type.includes('farm')) && rng.chance(CONFIG.DISASTER_BLIGHT_CHANCE)) {
                    triggerBlight(town);
                }
            }

            // MINE COLLAPSE — towns with mines
            if (town.buildings.some(b => b.type.includes('mine')) && rng.chance(CONFIG.DISASTER_MINE_COLLAPSE_CHANCE)) {
                triggerMineCollapse(town);
            }

            // RESOURCE DISCOVERY — rare positive event
            if (rng.chance(CONFIG.DISASTER_RESOURCE_DISCOVERY_CHANCE)) {
                triggerResourceDiscovery(town);
            }
        }
    }

    function triggerFlood(town) {
        const rng = world.rng;
        // Destroy 1-2 buildings (reduce level, prefer farms)
        const farmBuildings = town.buildings.filter(b => b.type.includes('farm'));
        const targets = farmBuildings.length > 0 ? farmBuildings : town.buildings;
        const numDestroyed = Math.min(rng.randInt(1, 2), targets.length);
        for (let i = 0; i < numDestroyed; i++) {
            const bld = rng.pick(targets);
            bld.level = Math.max(0, (bld.level || 1) - 1);
        }

        // Kill 5-15% of population
        const killPct = rng.randFloat(0.05, 0.15);
        const townPeople = world.people.filter(p => p.alive && p.townId === town.id);
        const toKill = Math.floor(townPeople.length * killPct);
        for (let i = 0; i < toKill && i < townPeople.length; i++) {
            if (rng.chance(killPct)) killPerson(townPeople[i], 'flood');
        }

        // Destroy 30% of food supply
        const foodTypes = ['bread', 'meat', 'wheat', 'eggs', 'poultry', 'fish'];
        for (const f of foodTypes) {
            town.market.supply[f] = Math.floor((town.market.supply[f] || 0) * 0.7);
        }

        town.prosperity = Math.max(0, town.prosperity - 15);
        logEvent(`🌊 Devastating flood hits ${town.name}! Buildings destroyed, lives lost.`, {
            type: 'flood',
            townId: town.id,
            cause: 'Heavy rains have caused rivers to overflow.',
            effects: [
                'Buildings damaged or destroyed',
                'Town prosperity reduced by 15',
                'Rebuilding will require wood and stone',
                'Food supplies reduced by 30%'
            ]
        }, 'local_town');
    }

    function triggerFire(town) {
        const rng = world.rng;

        // Water supply mitigates fire damage
        var waterAvail = town.market.supply.water || 0;
        var wellCount = town.buildings ? town.buildings.filter(function(b) { return b.type === 'well' || b.type === 'cistern'; }).length : 0;
        var waterMitigation = Math.min(0.6, (waterAvail / 200) * 0.3 + (wellCount * 0.1)); // max 60% reduction
        var damageMultiplier = 1 - waterMitigation;

        // Consume water fighting the fire
        var waterUsed = Math.min(waterAvail, Math.floor(50 + rng.random() * 100));
        town.market.supply.water = Math.max(0, waterAvail - waterUsed);

        // Destroy 1-3 wooden buildings (reduced by water)
        const woodenTypes = ['wheat_farm', 'sheep_farm', 'lumber_camp', 'bakery', 'market_stall', 'warehouse', 'tailor'];
        const woodenBuildings = town.buildings.filter(b => woodenTypes.includes(b.type));
        const numDestroyed = Math.min(Math.max(1, Math.floor(rng.randInt(1, 3) * damageMultiplier)), woodenBuildings.length);
        for (let i = 0; i < numDestroyed; i++) {
            const bld = rng.pick(woodenBuildings);
            bld.level = Math.max(0, (bld.level || 1) - 1);
        }

        // Kill population (reduced by water)
        const killPct = rng.randFloat(0.02, 0.08) * damageMultiplier;
        const townPeople = world.people.filter(p => p.alive && p.townId === town.id);
        const toKill = Math.floor(townPeople.length * killPct);
        for (let i = 0; i < toKill && i < townPeople.length; i++) {
            if (rng.chance(killPct)) killPerson(townPeople[i], 'fire');
        }

        // Destroy stored goods (reduced by water)
        var goodsLoss = 0.15 * damageMultiplier;
        for (const resId in town.market.supply) {
            town.market.supply[resId] = Math.floor((town.market.supply[resId] || 0) * (1 - goodsLoss));
        }

        var prosLoss = Math.max(3, Math.floor(10 * damageMultiplier));
        town.prosperity = Math.max(0, town.prosperity - prosLoss);
        var waterNote = waterMitigation > 0.2 ? ' Water reserves helped contain the blaze!' : '';
        logEvent(`🔥 A great fire sweeps through ${town.name}!` + waterNote, {
            type: 'fire',
            townId: town.id,
            cause: 'A fire has broken out, possibly from a forge or kitchen accident.',
            effects: [
                'Buildings may be damaged or destroyed',
                'Town prosperity decreases by ' + prosLoss,
                'Rebuilding materials will be in demand',
                'Stored goods reduced by ' + Math.round(goodsLoss * 100) + '%',
                waterMitigation > 0 ? 'Water supply reduced fire damage by ' + Math.round(waterMitigation * 100) + '%' : 'No water reserves to fight the fire!'
            ]
        }, 'local_town');
    }

    function triggerPlague(town) {
        const rng = world.rng;

        // Water + bathhouse mitigate plague severity
        var waterAvail = town.market.supply.water || 0;
        var hasBathhouse = town.buildings ? town.buildings.some(function(b) { return b.type === 'bathhouse'; }) : false;
        var clinicCount = town.buildings ? town.buildings.filter(function(b) { return b.type === 'clinic'; }).length : 0;

        var plagueMitigation = 0;
        plagueMitigation += Math.min(0.2, (waterAvail / 300) * 0.2); // water helps wash, max 20%
        if (hasBathhouse) plagueMitigation += 0.15; // bathhouse reduces plague 15%
        plagueMitigation += Math.min(0.2, clinicCount * 0.1); // clinics help treat, max 20%
        plagueMitigation = Math.min(0.5, plagueMitigation); // max 50% reduction

        // Consume water for sanitation
        var waterUsed = Math.min(waterAvail, Math.floor(30 + rng.random() * 60));
        town.market.supply.water = Math.max(0, waterAvail - waterUsed);

        // Set plague flag — kills over 30 days via applyOngoingEvent
        const baseSeverity = rng.randInt(10, 30);
        const severity = Math.max(5, Math.floor(baseSeverity * (1 - plagueMitigation)));
        const plagueDays = Math.max(15, Math.floor(30 * (1 - plagueMitigation * 0.5)));
        const plagueEvent = {
            id: uid('ev'),
            type: 'plague_disaster',
            name: 'Plague Outbreak',
            townId: town.id,
            startDay: world.day,
            active: true,
            daysRemaining: plagueDays,
            killRate: severity / 100 / plagueDays, // spread over duration
            severity: severity,
        };
        world.events.push(plagueEvent);
        town.happiness = Math.max(0, town.happiness - Math.floor(20 * (1 - plagueMitigation * 0.5)));
        var sanitNote = plagueMitigation > 0.15 ? ' Sanitation infrastructure helps limit the spread.' : '';
        logEvent(`🦠 Plague breaks out in ${town.name}! People flee in terror.` + sanitNote, {
            type: 'plague',
            townId: town.id,
            cause: 'Poor sanitation and overcrowding in ' + town.name + ' (population: ' + town.population + ') led to disease outbreak.',
            effects: [
                'Population will decline over ' + plagueDays + ' days (severity: ' + severity + '%)',
                'Town happiness drops significantly',
                'Trade may slow as merchants avoid the area',
                'People may flee to neighboring towns',
                plagueMitigation > 0 ? 'Water and sanitation reduced plague severity by ' + Math.round(plagueMitigation * 100) + '%' : 'No sanitation infrastructure to fight the plague!'
            ]
        }, 'local_town');
    }

    function triggerBlight(town) {
        // Blight event — farms produce 0 for 1 season
        const blightEvent = {
            id: uid('ev'),
            type: 'blight',
            name: 'Crop Blight',
            townId: town.id,
            startDay: world.day,
            active: true,
            daysRemaining: CONFIG.DAYS_PER_SEASON,
        };
        world.events.push(blightEvent);
        logEvent(`🌾 Crop blight devastates farms around ${town.name}!`, {
            type: 'blight',
            townId: town.id,
            cause: 'A crop disease has spread across the farmlands.',
            effects: [
                'Farms produce nothing for one season',
                'Food prices will rise sharply',
                'Town happiness decreases',
                'People may leave in search of food'
            ]
        });
    }

    function triggerMineCollapse(town) {
        const rng = world.rng;
        // Destroy one mine building
        const mines = town.buildings.filter(b => b.type.includes('mine'));
        if (mines.length > 0) {
            const mine = rng.pick(mines);
            mine.level = Math.max(0, (mine.level || 1) - 1);
        }

        // Kill 5-10 miners
        const miners = world.people.filter(p => p.alive && p.townId === town.id && p.occupation === 'miner');
        const toKill = Math.min(rng.randInt(5, 10), miners.length);
        for (let i = 0; i < toKill; i++) {
            killPerson(miners[i], 'mine collapse');
        }

        town.prosperity = Math.max(0, town.prosperity - 10);
        logEvent(`⛏️ Mine collapse in ${town.name}! Workers trapped, production halted.`, {
            type: 'mine_collapse',
            townId: town.id,
            cause: 'Structural failure in the mines near ' + town.name + '.',
            effects: [
                'Mine buildings damaged',
                'Workers killed or injured',
                'Town prosperity reduced by 10',
                'Mining production halted temporarily'
            ]
        }, 'local_town');
    }

    function triggerResourceDiscovery(town) {
        const rng = world.rng;
        const mineType = rng.chance(0.3) ? 'gold_mine' : rng.chance(0.5) ? 'iron_mine' : 'quarry';
        town.buildings.push({ type: mineType, level: 1, ownerId: null });
        town.prosperity = Math.min(100, town.prosperity + 20);

        // Attract migrants
        const migrants = rng.randInt(10, 20);
        const nearbyTowns = world.towns.filter(t => t.id !== town.id && t.population > 30);
        let attracted = 0;
        for (const srcTown of nearbyTowns) {
            if (attracted >= migrants) break;
            const candidates = world.people.filter(p =>
                p.alive && p.townId === srcTown.id &&
                (p.occupation === 'laborer' || p.occupation === 'none')
            );
            for (const p of candidates) {
                if (attracted >= migrants) break;
                if (world.rng.chance(0.3)) {
                    srcTown.population--;
                    p.townId = town.id;
                    p.kingdomId = town.kingdomId;
                    town.population++;
                    attracted++;
                }
            }
        }

        logEvent(`⛏️ A rich vein of ore discovered near ${town.name}! Prospectors flood in.`, null, 'local_town');
    }

    // ========================================================
    // §19E  NPC BUSINESS MANAGEMENT
    // ========================================================
    function tickNPCBusinesses() {
        for (const p of world.people) {
            if (!p.alive || p.occupation !== 'merchant') continue;
            if (!p.npcMerchantInventory) continue;
            if (!p.buildings || p.buildings.length === 0) continue;

            // Track daily profit for each building
            for (const bld of p.buildings) {
                if (!bld._profitTracker) bld._profitTracker = { revenue: 0, costs: 0, days: 0 };
                bld._profitTracker.days++;

                // Estimate costs: worker wages + material inputs
                const bt = findBuildingType(bld.type);
                if (bt) {
                    bld._profitTracker.costs += (bt.workers || 1) * CONFIG.BASE_WAGE;
                    // Estimate revenue from production sold at market price
                    if (bt.produces) {
                        const town = findTown(bld.townId || p.townId);
                        if (town) {
                            const price = getMarketPrice(town, bt.produces);
                            bld._profitTracker.revenue += price * (bt.rate || 1);
                        }
                    }
                }

                // Close unprofitable business after evaluation period
                if (bld._profitTracker.days >= CONFIG.NPC_BUSINESS_EVAL_INTERVAL &&
                    bld._profitTracker.revenue < bld._profitTracker.costs) {
                    const town = findTown(bld.townId || p.townId);
                    const townBld = town ? town.buildings.find(b => b.type === bld.type && b.ownerId === p.id) : null;
                    if (townBld) {
                        townBld.ownerId = null;
                        townBld.forSale = true;
                        townBld.salePrice = Math.floor((bt ? bt.cost : 200) * CONFIG.NPC_BUSINESS_CLOSE_SALE_FACTOR);
                        logEvent(`${p.firstName} ${p.lastName}'s ${bt ? bt.name : bld.type} in ${town ? town.name : 'a town'} has closed down.`);
                    }
                    // Remove from merchant's buildings
                    const idx = p.buildings.indexOf(bld);
                    if (idx >= 0) p.buildings.splice(idx, 1);
                }
            }

            // Consider opening new business if wealthy and sees opportunity
            if (p.gold > 800 && world.rng.chance(0.01)) {
                const town = findTown(p.townId);
                if (town) {
                    // Find goods with consistently high prices (>2x base)
                    for (const key in RESOURCE_TYPES) {
                        const res = RESOURCE_TYPES[key];
                        const price = getMarketPrice(town, res.id);
                        if (price > res.basePrice * CONFIG.NPC_BUSINESS_OPEN_PRICE_THRESHOLD) {
                            // Find a building type that produces this resource
                            for (const bKey in BUILDING_TYPES) {
                                const bt = BUILDING_TYPES[bKey];
                                if (bt.produces === res.id && p.gold >= bt.cost) {
                                    // Check building slots
                                    const maxSlots = CONFIG.TOWN_CATEGORIES[town.category] ? CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots : 10;
                                    if (town.buildings.length < maxSlots) {
                                        p.gold -= bt.cost;
                                        const newBld = { type: bt.id, level: 1, ownerId: p.id, townId: town.id };
                                        town.buildings.push(newBld);
                                        if (!p.buildings) p.buildings = [];
                                        p.buildings.push({ type: bt.id, townId: town.id, level: 1 });
                                        logEvent(`${p.firstName} ${p.lastName} opened a new ${bt.name} in ${town.name}.`);
                                        break;
                                    }
                                }
                            }
                            break; // only try one opportunity per tick
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // §19F  KINGDOM FINANCES & BANKRUPTCY
    // ========================================================

    // ---- Trade Tax Collection (called from market transactions) ----
    function collectTradeTax(kingdomId, amount, goodId) {
        if (!world || !kingdomId || amount <= 0) return;
        const k = findKingdom(kingdomId);
        if (!k) return;

        // Skip tax collection during tax revolt
        if (k._taxRevoltUntil && world.day < k._taxRevoltUntil) return;

        // Check export restrictions
        if (goodId && k.exportRestrictions && k.exportRestrictions.includes(goodId)) {
            // Block or penalize export — reduce amount by 50% as penalty
            amount = Math.floor(amount * 0.5);
        }

        const taxAmount = Math.floor(amount * (k.taxRate || 0.10));
        if (taxAmount > 0) {
            k.gold += taxAmount;
            k.tradeTaxRevenue = (k.tradeTaxRevenue || 0) + taxAmount;
            k.taxRevenue = (k.taxRevenue || 0) + taxAmount;
        }

        // Trade subsidy: pay bonus to merchants importing subsidized goods
        if (goodId && k.tradeSubsidies) {
            for (const sub of k.tradeSubsidies) {
                if (sub.good === goodId && (sub.unitsPaid || 0) < sub.maxUnits && sub.expiresDay > world.day) {
                    const bonus = sub.bonusPerUnit || CONFIG.KING_TRADE_SUBSIDY_PER_UNIT || 2;
                    if (k.gold >= bonus) {
                        k.gold -= bonus;
                        sub.unitsPaid = (sub.unitsPaid || 0) + 1;
                    }
                }
            }
        }
    }

    // ---- Property Tax Collection (monthly) ----
    function collectPropertyTaxes(k) {
        if (!k || !k.territories) return;
        const rate = k.propertyTaxRate || CONFIG.KINGDOM_DEFAULT_PROPERTY_TAX_RATE || 0.02;
        let totalPropertyTax = 0;

        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            for (const bld of town.buildings) {
                if (bld.ownerId === k.id || bld.ownerId === null) continue; // skip kingdom-owned & town-owned
                // Tax holiday: skip buildings in towns with active tax holidays (built after holiday started)
                if (k.taxHolidays && k.taxHolidays.some(h => h.townId === townId && h.expiresDay > world.day && bld.builtDay >= (h.expiresDay - (CONFIG.KING_TAX_HOLIDAY_DURATION || 180)))) {
                    continue;
                }
                const bt = findBuildingType(bld.type);
                const buildingValue = bt ? bt.cost : 200;
                const prosperityMult = 1 + (town.prosperity || 50) / 200;
                const tax = Math.floor(buildingValue * rate * prosperityMult);
                if (tax > 0) {
                    totalPropertyTax += tax;
                    // Deduct from NPC owner if possible
                    if (bld.ownerId === 'player') {
                        // Property Magnate: -10% property tax
                        var playerTax = tax;
                        if (typeof Player !== 'undefined' && Player.hasSkill && Player.hasSkill('property_magnate')) {
                            playerTax = Math.floor(tax * 0.90);
                        }
                        if (typeof Player !== 'undefined' && Player.gold >= playerTax) {
                            Player.state.gold -= playerTax;
                            if (typeof Player.state.stats !== 'undefined') Player.state.stats.totalGoldSpent += playerTax;
                        }
                    } else if (bld.ownerId && bld.ownerId !== 'player') {
                        const owner = findPerson(bld.ownerId);
                        if (owner && owner.gold >= tax) {
                            owner.gold -= tax;
                        }
                    }
                }
            }
        }

        // Treasury vault bonus
        let vaultBonus = 0;
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            if (town.buildings.some(b => b.type === 'treasury_vault')) vaultBonus += 0.10;
        }
        totalPropertyTax = Math.floor(totalPropertyTax * (1 + vaultBonus));

        k.gold += totalPropertyTax;
        k.propertyTaxRevenue = totalPropertyTax;
        k.taxRevenue = (k.taxRevenue || 0) + totalPropertyTax;
        if (totalPropertyTax > 50) {
            logEvent(`📜 ${k.name} collects ${totalPropertyTax}g in property taxes.`, {
                type: 'property_tax', cause: 'Monthly property tax collection', effects: []
            });
        }
    }

    // ---- Income Tax Collection (seasonal) ----
    function collectIncomeTaxes(k) {
        if (!k || !k.territories) return;
        const rate = k.incomeTaxRate || CONFIG.KINGDOM_DEFAULT_INCOME_TAX_RATE || 0.05;
        let totalIncomeTax = 0;

        // Tax NPC citizens based on accumulated wealth
        const citizens = world.people.filter(p => p.alive && p.kingdomId === k.id && p.gold > 10);
        for (const c of citizens) {
            const tax = Math.floor(c.gold * rate);
            if (tax > 0 && c.gold >= tax) {
                c.gold -= tax;
                totalIncomeTax += tax;
            }
        }

        // Tax elite merchants in kingdom territories
        const elites = world.people.filter(p => p.alive && p.isEliteMerchant);
        for (const em of elites) {
            const emTown = findTown(em.townId);
            if (!emTown || emTown.kingdomId !== k.id) continue;
            const tax = Math.floor((em.gold || 0) * rate);
            if (tax > 0 && (em.gold || 0) >= tax) {
                em.gold -= tax;
                totalIncomeTax += tax;
            }
        }

        k.gold += totalIncomeTax;
        k.incomeTaxRevenue = totalIncomeTax;
        k.taxRevenue = (k.taxRevenue || 0) + totalIncomeTax;
        if (totalIncomeTax > 100) {
            logEvent(`📜 ${k.name} collects ${totalIncomeTax}g in seasonal income taxes.`, {
                type: 'income_tax', cause: 'Seasonal income tax assessment', effects: []
            });
        }
    }

    // ---- Smart Financial Strategy (monthly, 4 levels) ----
    function tickKingdomFinancialStrategy(k) {
        if (!k) return;
        const rng = world.rng;
        const p = k.kingPersonality || {};
        const treasury = k.gold;
        const bankruptDays = k._bankruptDays || 0;
        if (!k._financialActions) k._financialActions = [];

        const soldiers = world.people.filter(s =>
            s.alive && s.kingdomId === k.id && (s.occupation === 'soldier' || s.occupation === 'guard')
        );

        // ---- LEVEL 1: Mild Adjustments (treasury < 2000g) ----
        if (treasury < (CONFIG.KINGDOM_MILD_THRESHOLD || 2000)) {
            let actionsTaken = 0;

            // 1. Raise trade tax
            if (k.taxRate < 0.25 && rng.chance(p.greed === 'greedy' || p.greed === 'corrupt' ? 0.8 : 0.4)) {
                const increase = rng.randFloat(0.01, 0.03);
                k.taxRate = Math.min(0.25, k.taxRate + increase);
                k.lastTaxIncreaseDay = world.day;
                logEvent(`📈 ${k.name} raises trade taxes to ${Math.round(k.taxRate * 100)}%.`, {
                    type: 'tax_increase', cause: 'Low treasury (' + Math.floor(treasury) + 'g)', effects: ['Trade becomes more expensive', 'Merchants may avoid this kingdom']
                });
                actionsTaken++;
            }

            // 2. Raise property tax
            if (actionsTaken < 2 && (k.propertyTaxRate || 0.02) < 0.06 && rng.chance(0.3)) {
                k.propertyTaxRate = Math.min(0.06, (k.propertyTaxRate || 0.02) + rng.randFloat(0.005, 0.01));
                logEvent(`📈 ${k.name} raises property taxes to ${Math.round(k.propertyTaxRate * 100)}%.`, {
                    type: 'tax_increase', cause: 'Low treasury', effects: ['Building owners pay more']
                });
                actionsTaken++;
            }

            // 3. Cut military spending
            if (actionsTaken < 2 && soldiers.length > 5 && rng.chance(p.militarism === 'peaceful' ? 0.5 : 0.2)) {
                const toCut = Math.max(1, Math.floor(soldiers.length * 0.10));
                let cut = 0;
                for (const s of soldiers) {
                    if (cut >= toCut) break;
                    s.occupation = 'laborer';
                    const town = findTown(s.townId);
                    if (town && town.garrison > 0) town.garrison--;
                    cut++;
                }
                logEvent(`🏰 ${k.name} reduces its army by ${cut} soldiers to save gold.`, {
                    type: 'military_cut', cause: 'Budget constraints', effects: ['Military strength reduced', 'Former soldiers seek work']
                });
                actionsTaken++;
            }

            // 4. Reduce guard budget
            if (actionsTaken < 2 && (k.guardBudget || 0.15) > 0.05 && rng.chance(0.3)) {
                k.guardBudget = Math.max(0.05, (k.guardBudget || 0.15) - 0.05);
                logEvent(`🏰 ${k.name} reduces guard spending.`, {
                    type: 'budget_cut', cause: 'Financial austerity', effects: ['Fewer guards hired', 'Town security may decrease']
                });
                actionsTaken++;
            }

            // 5. Sell surplus military stockpile
            if (actionsTaken < 2 && k.militaryStockpile && rng.chance(0.4)) {
                const stockpile = k.militaryStockpile;
                let soldItems = 0;
                for (const itemId of ['swords', 'armor', 'bows', 'arrows', 'horses']) {
                    const qty = stockpile[itemId] || 0;
                    const surplus = Math.floor(qty * 0.5);
                    if (surplus > 0) {
                        const kTowns = world.towns.filter(t => k.territories.has(t.id));
                        if (kTowns.length > 0) {
                            const town = rng.pick(kTowns);
                            const price = (town.market.prices[itemId] || 10) * surplus;
                            town.market.supply[itemId] = (town.market.supply[itemId] || 0) + surplus;
                            stockpile[itemId] -= surplus;
                            k.gold += Math.floor(price * 0.7); // sell at 70% market value
                            soldItems += surplus;
                        }
                    }
                }
                if (soldItems > 0) {
                    logEvent(`🏰 ${k.name} sells surplus military equipment (${soldItems} items) to raise funds.`, {
                        type: 'stockpile_sale', cause: 'Financial need', effects: ['Military reserves reduced', 'Treasury bolstered']
                    });
                }
            }
        }

        // ---- LEVEL 2: Moderate Actions (treasury < 500g) ----
        if (treasury < (CONFIG.KINGDOM_MODERATE_THRESHOLD || 500)) {
            // 7. Emergency tax levy
            if (rng.chance(p.greed === 'greedy' || p.greed === 'corrupt' ? 0.6 : 0.2)) {
                let levy = 0;
                const citizens = world.people.filter(c => c.alive && c.kingdomId === k.id && c.gold > 20);
                for (const c of citizens) {
                    const tax = Math.floor(c.gold * 0.05);
                    if (tax > 0) { c.gold -= tax; levy += tax; }
                }
                if (levy > 0) {
                    k.gold += levy;
                    boostKingdomHappiness(k, -10);
                    logEvent(`💰 ${k.name} imposes an emergency wealth tax! ${levy}g collected from citizens.`, {
                        type: 'emergency_tax', cause: 'Near-bankruptcy', effects: ['Happiness drops significantly (-10)', 'Citizens lose savings', 'Unrest may follow']
                    });
                }
            }

            // 8. Sell non-essential kingdom buildings
            if (rng.chance(0.3)) {
                const sellable = ['guild_hall', 'marketplace_royal', 'granary', 'clinic'];
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const idx = town.buildings.findIndex(b => b.ownerId === k.id && sellable.includes(b.type));
                    if (idx >= 0) {
                        const bld = town.buildings[idx];
                        const bt = findBuildingType(bld.type);
                        const salePrice = Math.floor((bt ? bt.cost : 300) * 0.5);
                        town.buildings.splice(idx, 1);
                        k.gold += salePrice;
                        logEvent(`🏚️ ${k.name} sells a ${bt ? bt.name : bld.type} in ${town.name} for ${salePrice}g.`, {
                            type: 'building_sale', cause: 'Desperate for gold', effects: ['Town loses building benefits']
                        });
                        break;
                    }
                }
            }

            // 9. Demand loans from wealthy NPCs
            if (rng.chance(p.temperament === 'cruel' || p.temperament === 'stern' ? 0.5 : 0.2)) {
                const wealthyNPCs = world.people.filter(c =>
                    c.alive && c.kingdomId === k.id && c.gold > 200 && !c.isEliteMerchant
                ).sort((a, b) => b.gold - a.gold);
                if (wealthyNPCs.length > 0) {
                    const target = wealthyNPCs[0];
                    const loan = Math.min(Math.floor(target.gold * 0.3), 500);
                    target.gold -= loan;
                    k.gold += loan;
                    logEvent(`👑 ${k.name}'s king demands a ${loan}g "loan" from ${target.firstName} ${target.lastName}.`, {
                        type: 'forced_loan', cause: 'Royal decree to raise emergency funds', effects: ['Target loses gold', 'Relations strained']
                    });
                }
            }

            // 10. Reduce soldier pay (morale drops)
            if (soldiers.length > 3 && rng.chance(0.3)) {
                const desertCount = Math.max(1, Math.floor(soldiers.length * 0.05));
                let deserted = 0;
                for (const s of soldiers) {
                    if (deserted >= desertCount) break;
                    if (rng.chance(0.3)) {
                        s.occupation = 'laborer';
                        const town = findTown(s.townId);
                        if (town && town.garrison > 0) town.garrison--;
                        deserted++;
                    }
                }
                if (deserted > 0) {
                    logEvent(`🏰 ${k.name} cuts soldier pay. ${deserted} soldiers desert.`, {
                        type: 'soldier_pay_cut', cause: 'Cannot afford full military wages', effects: ['Some soldiers desert', 'Army morale drops']
                    });
                }
            }

            // 11. Trade concessions to other kingdoms
            if (rng.chance(p.intelligence === 'brilliant' || p.intelligence === 'clever' ? 0.5 : 0.15)) {
                const friendliest = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                    .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
                if (friendliest && friendliest.gold > 1000) {
                    const aid = Math.min(500, Math.floor(friendliest.gold * 0.05));
                    friendliest.gold -= aid;
                    k.gold += aid;
                    k.relations[friendliest.id] = Math.min(100, (k.relations[friendliest.id] || 0) + 10);
                    friendliest.relations[k.id] = Math.min(100, (friendliest.relations[k.id] || 0) + 10);
                    logEvent(`🤝 ${k.name} negotiates a trade concession deal with ${friendliest.name} for ${aid}g.`, {
                        type: 'trade_concession', cause: 'Financial diplomacy', effects: ['Relations improve', 'Treasury bolstered']
                    });
                }
            }
        }

        // ---- LEVEL 3: Desperate Measures (bankrupt 15+ days) ----
        if (bankruptDays >= (CONFIG.KINGDOM_DESPERATE_DAYS || 15)) {
            // 13. Seize NPC businesses
            if ((p.greed === 'greedy' || p.greed === 'corrupt') && rng.chance(0.3)) {
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    const npcBld = town.buildings.find(b => b.ownerId && b.ownerId !== 'player' && b.ownerId !== k.id);
                    if (npcBld) {
                        const bt = findBuildingType(npcBld.type);
                        const value = Math.floor((bt ? bt.cost : 300) * 0.4);
                        npcBld.ownerId = k.id;
                        k.gold += value;
                        logEvent(`⚠️ ${k.name}'s king seizes a ${bt ? bt.name : npcBld.type} in ${town.name}! (${value}g)`, {
                            type: 'asset_seizure', cause: 'Despotic measures to avoid collapse', effects: ['Building nationalized', 'Citizens fearful', 'Happiness drops']
                        });
                        boostKingdomHappiness(k, -5);
                        break;
                    }
                }
            }

            // 14. Seize elite merchant assets
            if (rng.chance(0.15)) {
                const elites = world.people.filter(e =>
                    e.alive && e.isEliteMerchant && e.gold > 500
                );
                const localElite = elites.find(e => {
                    const eTown = findTown(e.townId);
                    return eTown && eTown.kingdomId === k.id;
                });
                if (localElite) {
                    const seized = Math.min(Math.floor(localElite.gold * 0.3), 1000);
                    localElite.gold -= seized;
                    k.gold += seized;
                    localElite._seizureVictim = true;
                    logEvent(`⚠️ ${k.name}'s king seizes ${seized}g from the merchant house of ${localElite.firstName} ${localElite.lastName}!`, {
                        type: 'elite_seizure', cause: 'Royal confiscation of merchant wealth', effects: ['Elite merchant may flee', 'Trade confidence shattered']
                    });
                    boostKingdomHappiness(k, -8);
                }
            }

            // 16. Forced labor
            if (rng.chance(0.1) && (p.temperament === 'cruel' || p.temperament === 'stern')) {
                boostKingdomHappiness(k, -20);
                k.gold += rng.randInt(200, 500);
                logEvent(`⛓️ ${k.name}'s king decrees forced labor! Citizens conscripted for kingdom projects.`, {
                    type: 'forced_labor', cause: 'Desperate attempt to generate revenue', effects: ['Happiness plummets (-20)', 'Small amount of gold generated', 'Risk of rebellion']
                });
            }

            // 18. Debase currency
            if (!k._currencyDebased && rng.chance(0.2)) {
                k._currencyDebased = true;
                k._debasementInflation = 0.30;
                k.gold = Math.floor(k.gold * 1.20); // instant 20% boost
                logEvent(`💰 ${k.name} debases its currency! The kingdom mints cheaper coins.`, {
                    type: 'currency_debasement', cause: 'Desperate monetary policy', effects: ['Treasury gets 20% boost', 'All prices in kingdom rise 30%', 'Long-term economic damage']
                });
                // Inflate prices in all kingdom towns
                for (const townId of k.territories) {
                    const town = findTown(townId);
                    if (!town) continue;
                    for (const resId in town.market.prices) {
                        town.market.prices[resId] = Math.ceil(town.market.prices[resId] * 1.30);
                    }
                }
            }
        }

        // ---- LEVEL 4: Last Resort (bankrupt 45+ days) ----
        if (bankruptDays >= 45) {
            // 20. Offer surrender to neighbor
            if (rng.chance(p.courage === 'cowardly' ? 0.3 : 0.05)) {
                const bestNeighbor = world.kingdoms.filter(o => o.id !== k.id && !k.atWar.has(o.id))
                    .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
                if (bestNeighbor) {
                    logEvent(`🏳️ ${k.name}'s king offers to merge with ${bestNeighbor.name} to avoid total collapse.`, {
                        type: 'merger_offer', cause: 'Kingdom cannot survive independently', effects: ['Towns may transfer', 'King may abdicate']
                    }, 'sensitive_intel');
                    // Transfer half the towns
                    const townIds = [...k.territories];
                    const toTransfer = Math.max(1, Math.floor(townIds.length / 2));
                    for (let i = 0; i < toTransfer && i < townIds.length; i++) {
                        const town = findTown(townIds[i]);
                        if (town) {
                            k.territories.delete(townIds[i]);
                            town.kingdomId = bestNeighbor.id;
                            bestNeighbor.territories.add(townIds[i]);
                        }
                    }
                    k.relations[bestNeighbor.id] = Math.min(100, (k.relations[bestNeighbor.id] || 0) + 30);
                    bestNeighbor.relations[k.id] = Math.min(100, (bestNeighbor.relations[k.id] || 0) + 30);
                }
            }

            // 21. King abdicates
            if (rng.chance(p.courage === 'cowardly' ? 0.15 : 0.03)) {
                const king = findPerson(k.king);
                if (king && king.alive) {
                    logEvent(`👑 The king of ${k.name} abdicates! A new ruler must be found.`, {
                        type: 'abdication', cause: 'Kingdom bankruptcy and despair', effects: ['New king with different personality', 'Brief period of instability', 'Debts may be restructured']
                    });
                    king.occupation = 'merchant';
                    handleKingDeath(k, 'abdication');
                    k._bankruptDays = Math.floor(k._bankruptDays * 0.5); // partial reset
                    k.gold += 500; // new king brings some treasury
                }
            }
        }
    }

    function tickKingdomFinances(k) {
        var rng = world.rng;
        // Count soldiers and buildings
        const soldiers = world.people.filter(p =>
            p.alive && p.kingdomId === k.id && (p.occupation === 'soldier' || p.occupation === 'guard')
        );
        let totalBuildings = 0;
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (town) totalBuildings += town.buildings.length;
        }

        // Daily costs (deducted from treasury)
        const soldierCost = soldiers.length * CONFIG.KINGDOM_SOLDIER_DAILY_COST / 30;
        const buildingCost = totalBuildings * CONFIG.KINGDOM_BUILDING_DAILY_COST / 30;
        k.gold -= (soldierCost + buildingCost);

        // ---- Kingdom Transport Upkeep (seasonal) ----
        if (k.laws && k.laws.kingdomTransport) {
            var numTowns = 0;
            for (var _ti of k.territories) {
                if (findTown(_ti)) numTowns++;
            }
            var transportCostPerTown = (CONFIG.KINGDOM_TRANSPORT ? CONFIG.KINGDOM_TRANSPORT.baseCostPerTown : 50);
            var transportCost = transportCostPerTown * numTowns;
            // Deduct per season (every 90 days)
            if (world.day % 90 === 0) {
                k.gold -= transportCost;
                // If kingdom can't afford, they cancel it
                if (k.gold < 0) {
                    k.laws.kingdomTransport = false;
                    logEvent('📢 ' + k.name + ' can no longer afford public transport services.', { type: 'law_change', kingdomId: k.id }, 'my_kingdom');
                }
            }
        }

        // ---- Kingdom Transport Revenue (seasonal) ----
        if (k.laws && k.laws.kingdomTransport && world.day % 90 === 0) {
            var rate = k.laws.transportRate || 15;
            var kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });

            // Estimate: ~5% of each town's population uses transport per season
            var totalPassengers = 0;
            for (var ti = 0; ti < kTowns.length; ti++) {
                var townPop = kTowns[ti].population || 50;
                var passengers = Math.floor(townPop * 0.05 * rng.randFloat(0.5, 1.5));
                totalPassengers += passengers;
            }
            var revenue = totalPassengers * rate;
            k.gold += revenue;
            k.transportRevenue = (k.transportRevenue || 0) + revenue;
        }

        // ---- Periodic Financial Report (every 90 days, for auditing) ----
        if (world.day % 90 === 0) {
            k._financialReport = {
                day: world.day,
                gold: k.gold,
                income: { baseTax: k.taxRevenue || 0, tradeTax: k.tradeTaxRevenue || 0,
                          propertyTax: k.propertyTaxRevenue || 0, incomeTax: k.incomeTaxRevenue || 0 },
                expenses: { soldiers: soldierCost * 30, buildings: buildingCost * 30,
                            warSupply: k.atWar.size > 0 ? soldiers.length * (CONFIG.WARTIME_SUPPLY_COST_PER_SOLDIER || 2) * 90 : 0 }
            };
        }

        // ---- Monthly Property Tax Collection ----
        if (!k._lastPropertyTaxDay) k._lastPropertyTaxDay = 0;
        if (world.day - k._lastPropertyTaxDay >= (CONFIG.KINGDOM_PROPERTY_TAX_INTERVAL || 30)) {
            k._lastPropertyTaxDay = world.day;
            collectPropertyTaxes(k);
        }

        // ---- Seasonal Income Tax Collection ----
        if (!k._lastIncomeTaxDay) k._lastIncomeTaxDay = 0;
        if (world.day - k._lastIncomeTaxDay >= (CONFIG.KINGDOM_INCOME_TAX_INTERVAL || 90)) {
            k._lastIncomeTaxDay = world.day;
            collectIncomeTaxes(k);
        }

        // ---- Smart Financial Strategy (monthly) ----
        if (!k._lastFinancialStrategyDay) k._lastFinancialStrategyDay = 0;
        if (world.day - k._lastFinancialStrategyDay >= (CONFIG.KINGDOM_FINANCIAL_STRATEGY_INTERVAL || 30)) {
            k._lastFinancialStrategyDay = world.day;
            tickKingdomFinancialStrategy(k);
        }

        // Bankruptcy warning
        if (k.gold > 0 && k.gold < CONFIG.KINGDOM_BANKRUPTCY_WARNING_GOLD && !k._bankruptWarned) {
            k._bankruptWarned = true;
            logEvent(`💸 The treasury of ${k.name} is running dangerously low! Only ${Math.floor(k.gold)}g remains.`);
        }
        if (k.gold > CONFIG.KINGDOM_BANKRUPTCY_WARNING_GOLD * 2) {
            k._bankruptWarned = false;
        }

        if (k.gold <= 0) {
            k.gold = 0;
            if (!k._bankruptDays) k._bankruptDays = 0;
            k._bankruptDays++;

            // First day of bankruptcy
            if (k._bankruptDays === 1) {
                logEvent(`💸 The Kingdom of ${k.name} is bankrupt! Soldiers go unpaid.`, {
                    type: 'bankruptcy',
                    cause: k.name + '\'s treasury has been depleted. Expenses (soldier upkeep: ' + Math.round(soldierCost * 30) + 'g/month, buildings: ' + Math.round(buildingCost * 30) + 'g/month) exceed income.',
                    effects: [
                        'Soldiers go unpaid and may desert',
                        'Kingdom happiness decreases (-0.5/day)',
                        'Financial strategy AI will attempt recovery',
                        'Guards and military become unreliable'
                    ]
                });
            }

            // Soldiers desert due to non-payment
            for (const s of soldiers) {
                if (world.rng.chance(CONFIG.KINGDOM_BANKRUPTCY_DESERTION_RATE)) {
                    s.occupation = 'laborer';
                    const town = findTown(s.townId);
                    if (town && town.garrison > 0) town.garrison--;
                }
            }

            // Happiness drops during bankruptcy
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (town) {
                    town.happiness = Math.max(0, town.happiness - 0.5);
                }
            }

            // Economic collapse after prolonged bankruptcy (60+ days)
            if (k._bankruptDays >= (CONFIG.KINGDOM_COLLAPSE_TRIGGER_DAYS || 60)) {
                triggerEconomicCollapse(k);
            }

            // Kingdom collapse check after extreme bankruptcy
            if (k._bankruptDays >= CONFIG.KINGDOM_BANKRUPTCY_COLLAPSE_DAYS) {
                const happiness = k.happiness != null ? k.happiness : 50;
                if (happiness < CONFIG.KINGDOM_COLLAPSE_HAPPINESS_THRESHOLD || world.rng.chance(CONFIG.KINGDOM_COLLAPSE_CHANCE)) {
                    triggerKingdomCollapse(k);
                }
            }

            // Periodic warnings
            if (k._bankruptDays === 30) {
                logEvent(`💸 ${k.name} has been bankrupt for a month. Soldiers are deserting!`, {
                    type: 'military_desertion',
                    cause: k.name + ' cannot pay its soldiers. Treasury: ' + Math.floor(k.gold) + 'g.',
                    effects: [
                        'Soldiers are leaving the army to find paid work',
                        'Kingdom military strength is declining',
                        'Towns may lose garrison protection',
                        'Enemy kingdoms may take advantage of the weakness'
                    ]
                });
            }
            if (k._bankruptDays === 60) {
                logEvent(`💸 ${k.name} has been bankrupt for two months. The kingdom teeters on collapse!`, null, 'sensitive_intel');
            }
        } else {
            k._bankruptDays = 0;
            // Gradually recover from currency debasement
            if (k._currencyDebased && k._debasementInflation > 0) {
                k._debasementInflation = Math.max(0, k._debasementInflation - 0.001);
                if (k._debasementInflation <= 0) {
                    k._currencyDebased = false;
                    logEvent(`💰 ${k.name}'s currency has stabilized after debasement.`);
                }
            }
        }
    }

    // ========================================================
    // §19F2  ECONOMIC COLLAPSE SYSTEM
    // ========================================================
    function triggerEconomicCollapse(k) {
        if (k._collapseTriggered) return; // only trigger once
        k._collapseTriggered = true;
        const rng = world.rng;

        logEvent(`🔥 ECONOMIC COLLAPSE in ${k.name}! Riots, famine, and chaos spread!`, {
            type: 'economic_collapse',
            cause: k.name + ' has been bankrupt for ' + (k._bankruptDays || 60) + ' days despite all measures.',
            effects: [
                'Random buildings damaged or destroyed (10-30%)',
                'Food prices spike 300%',
                'Population decreases as people flee',
                '70% of soldiers desert',
                'Crime rate spikes',
                'Merchants flee to other kingdoms'
            ]
        }, 'sensitive_intel');

        // 1. RIOTS — damage buildings
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const damageRatio = rng.randFloat(0.10, 0.30);
            const toDamage = Math.max(1, Math.floor(town.buildings.length * damageRatio));
            const shuffled = rng.shuffle([...town.buildings.keys()]);
            for (let i = 0; i < toDamage && i < shuffled.length; i++) {
                const bld = town.buildings[shuffled[i]];
                if (bld) bld.condition = rng.chance(0.3) ? 'destroyed' : 'breaking';
            }
            town.happiness = Math.max(0, town.happiness - 30);
            town.prosperity = Math.max(0, town.prosperity - 20);
        }

        // 2. FAMINE — food prices spike
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (!town) continue;
            const foodTypes = ['bread', 'meat', 'wheat', 'fish', 'eggs', 'poultry'];
            for (const food of foodTypes) {
                if (town.market.prices[food]) {
                    town.market.prices[food] = Math.ceil(town.market.prices[food] * 3.0);
                }
            }
            // Population flight — use killPerson for proper tracking
            const fleeing = Math.floor(town.population * rng.randFloat(0.05, 0.15));
            var fleeablePeople = (_tickCache.peopleByTown[town.id] || []).filter(function(pp) { return pp.alive; });
            var shuffledFlee = rng.shuffle([...fleeablePeople]);
            var fled = 0;
            for (var fi = 0; fi < shuffledFlee.length && fled < fleeing; fi++) {
                // Move person to a random safe town in another kingdom
                var destKingdoms = world.kingdoms.filter(function(ok) { return ok.id !== k.id; });
                if (destKingdoms.length > 0) {
                    var destK = rng.pick(destKingdoms);
                    var destTowns = world.towns.filter(function(dt) { return dt.kingdomId === destK.id && !dt.destroyed && !dt.abandoned; });
                    if (destTowns.length > 0) {
                        var destTown2 = rng.pick(destTowns);
                        shuffledFlee[fi].townId = destTown2.id;
                        shuffledFlee[fi].kingdomId = destK.id;
                        destTown2.population = (destTown2.population || 0) + 1;
                        town.population = Math.max(10, town.population - 1);
                        fled++;
                    }
                }
            }
        }

        // 3. MILITARY DECIMATION
        const soldiers = world.people.filter(s =>
            s.alive && s.kingdomId === k.id && (s.occupation === 'soldier' || s.occupation === 'guard')
        );
        const toDesert = Math.floor(soldiers.length * 0.70);
        let deserted = 0;
        for (const s of soldiers) {
            if (deserted >= toDesert) break;
            s.occupation = 'laborer';
            const town = findTown(s.townId);
            if (town && town.garrison > 0) town.garrison = Math.max(0, town.garrison - 1);
            deserted++;
        }

        // 4. CRIME SPIKE
        for (const townId of k.territories) {
            const town = findTown(townId);
            if (town) town.security = Math.max(5, (town.security || 50) - 50);
        }

        // 5. MERCHANT EXODUS — NPCs with gold flee
        const merchants = world.people.filter(m =>
            m.alive && m.kingdomId === k.id && m.gold > 100 && m.occupation === 'merchant'
        );
        for (const m of merchants) {
            if (rng.chance(0.4)) {
                // Find a neighboring kingdom town to flee to
                const safeTowns = world.towns.filter(t => t.kingdomId !== k.id);
                if (safeTowns.length > 0) {
                    const dest = rng.pick(safeTowns);
                    m.townId = dest.id;
                    m.kingdomId = dest.kingdomId;
                }
            }
        }

        // 6. INFRASTRUCTURE DECAY — roads become dangerous
        for (const road of world.roads) {
            const fromT = findTown(road.fromTownId);
            const toT = findTown(road.toTownId);
            if ((fromT && k.territories.has(fromT.id)) || (toT && k.territories.has(toT.id))) {
                road.condition = 'breaking';
                road.banditThreat = Math.min(100, (road.banditThreat || 0) + 40);
            }
        }

        // ---- RESOLUTION PATHS ----
        resolveEconomicCollapse(k);
    }

    function resolveEconomicCollapse(k) {
        const rng = world.rng;

        // Check conditions for each resolution path
        const bestNeighbor = world.kingdoms.filter(o => o.id !== k.id)
            .sort((a, b) => (k.relations[b.id] || 0) - (k.relations[a.id] || 0))[0];
        const bestRelation = bestNeighbor ? (k.relations[bestNeighbor.id] || 0) : -100;

        // Find prominent NPC for revolution
        const prominentNPC = world.people.filter(p =>
            p.alive && p.kingdomId === k.id && p.gold > 200 && p.occupation !== 'soldier'
        ).sort((a, b) => (b.gold || 0) - (a.gold || 0))[0];

        // Find wealthy elite merchant
        const wealthyElite = world.people.filter(e =>
            e.alive && e.isEliteMerchant && e.gold >= 3000
        ).find(e => {
            const eTown = findTown(e.townId);
            return eTown && eTown.kingdomId === k.id;
        });

        // 1. Absorption — neighbor has 60+ relations
        if (bestRelation >= 60 && bestNeighbor) {
            logEvent(`🏰 ${bestNeighbor.name} absorbs the collapsing towns of ${k.name}.`, {
                type: 'kingdom_absorption',
                cause: 'Strong diplomatic ties allow peaceful absorption',
                effects: ['Towns transfer to ' + bestNeighbor.name, 'Citizens gain stability', 'Former king retires']
            });
            const townIds = [...k.territories];
            for (const townId of townIds) {
                const town = findTown(townId);
                if (town) {
                    k.territories.delete(townId);
                    town.kingdomId = bestNeighbor.id;
                    bestNeighbor.territories.add(townId);
                    town.happiness = Math.max(10, town.happiness + 10);
                }
            }
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            return;
        }

        // 2. Revolution — prominent NPC becomes new king
        if (prominentNPC && prominentNPC.gold > 500 && rng.chance(0.5)) {
            logEvent(`🔥 Revolution in ${k.name}! ${prominentNPC.firstName} ${prominentNPC.lastName} seizes power!`, {
                type: 'revolution',
                cause: 'Citizens overthrow the bankrupt king',
                effects: ['New king installed', 'Debts wiped', 'Kingdom restarts with minimal treasury']
            });
            const oldKing = findPerson(k.king);
            if (oldKing && oldKing.alive) {
                oldKing.occupation = 'laborer';
            }
            k.king = prominentNPC.id;
            prominentNPC.occupation = 'king';
            // Generate new personality based on the NPC
            k.kingPersonality = {
                generosity: rng.pick(['generous', 'fair']),
                militarism: rng.pick(['peaceful', 'defensive']),
                justice: rng.pick(['just', 'pragmatic']),
                tradition: rng.pick(['progressive', 'moderate']),
                icon: '⚔️',
                intelligence: rng.pick(['brilliant', 'clever', 'average']),
                temperament: rng.pick(['kind', 'fair']),
                ambition: rng.pick(['ambitious', 'content']),
                greed: rng.pick(['fair', 'generous']),
                courage: rng.pick(['brave', 'cautious']),
            };
            k.gold = Math.max(500, Math.floor(prominentNPC.gold * 0.5));
            prominentNPC.gold = Math.max(500, Math.floor(prominentNPC.gold * 0.5)); // Keep half for the NPC
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            k.taxRate = 0.10; // reset to moderate
            k.happiness = 30;
            return;
        }

        // 3. Elite Merchant Bailout
        if (wealthyElite) {
            const bailoutAmount = Math.min(wealthyElite.gold, 3000);
            wealthyElite.gold -= bailoutAmount;
            k.gold += bailoutAmount;
            logEvent(`💰 ${wealthyElite.firstName} ${wealthyElite.lastName} bails out ${k.name} with ${bailoutAmount}g!`, {
                type: 'merchant_bailout',
                cause: 'Wealthy merchant saves kingdom from total collapse',
                effects: ['Kingdom survives', 'Merchant gains huge political influence', 'Economy slowly recovers']
            });
            k._bankruptDays = 0;
            k._collapseTriggered = false;
            k.happiness = Math.max(20, k.happiness);
            return;
        }

        // 4. Fragmentation — kingdom splits
        if (k.territories.size >= 4) {
            logEvent(`💔 ${k.name} fragments! Towns break away to form a new kingdom.`, {
                type: 'kingdom_fragmentation',
                cause: 'No one can hold the kingdom together',
                effects: ['Kingdom splits into smaller territories', 'New political entities emerge']
            });
            // Transfer half the towns to the strongest neighbor
            const townIds = [...k.territories];
            const halfCount = Math.floor(townIds.length / 2);
            if (bestNeighbor) {
                for (let i = 0; i < halfCount; i++) {
                    const town = findTown(townIds[i]);
                    if (town) {
                        k.territories.delete(townIds[i]);
                        town.kingdomId = bestNeighbor.id;
                        bestNeighbor.territories.add(townIds[i]);
                    }
                }
                bestNeighbor.relations[k.id] = Math.min(100, (bestNeighbor.relations[k.id] || 0) + 20);
            }
            k._bankruptDays = Math.floor(k._bankruptDays * 0.5);
            k._collapseTriggered = false;
            k.gold += 500; // surviving towns pool resources
            return;
        }

        // Fallback — towns absorbed by strongest neighbor (old collapse behavior)
        k._collapseTriggered = false;
    }

    function triggerKingdomCollapse(k) {
        logEvent(`👑💀 The Kingdom of ${k.name} has COLLAPSED! Towns declare independence!`, {
            type: 'kingdom_collapse',
            cause: k.name + ' has been bankrupt too long and its people have lost all faith in the crown.',
            effects: [
                'All towns declare independence',
                'Soldiers disbanded',
                'Former towns may be absorbed by neighboring kingdoms',
                'Trade routes become unsafe',
                'A power vacuum emerges in the region'
            ]
        }, 'sensitive_intel');

        // All towns become independent (assigned to strongest neighbor or none)
        const townIds = [...k.territories];
        for (const townId of townIds) {
            const town = findTown(townId);
            if (!town) continue;

            // Find strongest neighboring kingdom
            let bestK = null;
            let bestStr = 0;
            for (const otherK of world.kingdoms) {
                if (otherK.id === k.id) continue;
                const str = computeMilitaryStrength(otherK);
                // Check if they have a town nearby
                const hasNearby = world.towns.some(t =>
                    t.kingdomId === otherK.id && Math.hypot(t.x - town.x, t.y - town.y) < 2000
                );
                if (hasNearby && str > bestStr) {
                    bestStr = str;
                    bestK = otherK;
                }
            }

            k.territories.delete(townId);
            if (bestK) {
                town.kingdomId = bestK.id;
                bestK.territories.add(townId);
                logEvent(`${town.name} has been absorbed by ${bestK.name}.`);
            }
            // If no neighbor, town stays with collapsed kingdom (weakened state)

            town.happiness = Math.max(0, town.happiness - 20);
            town.prosperity = Math.max(0, town.prosperity - 15);
        }

        // Soldiers become laborers
        const soldiers = world.people.filter(p =>
            p.alive && p.kingdomId === k.id && (p.occupation === 'soldier' || p.occupation === 'guard')
        );
        for (const s of soldiers) {
            s.occupation = 'laborer';
            const town = findTown(s.townId);
            if (town && town.garrison > 0) town.garrison = Math.max(0, town.garrison - 1);
        }

        // Reset kingdom state
        k.gold = 0;
        k._bankruptDays = 0;
        k._collapseTriggered = false;
        k.happiness = 10;
    }

    // ========================================================
    // §19G  TRADE EMBARGOES
    // ========================================================
    function declareEmbargo(kingdom1, kingdom2) {
        if (!kingdom1.embargoes) kingdom1.embargoes = [];
        if (!kingdom2.embargoes) kingdom2.embargoes = [];
        if (!kingdom1.embargoes.includes(kingdom2.id)) {
            kingdom1.embargoes.push(kingdom2.id);
        }
        if (!kingdom2.embargoes.includes(kingdom1.id)) {
            kingdom2.embargoes.push(kingdom1.id);
        }
        logEvent(`📜 ${kingdom1.name} and ${kingdom2.name} have declared a TRADE EMBARGO!`, {
            type: 'trade_embargo',
            cause: 'Diplomatic tensions between ' + kingdom1.name + ' and ' + kingdom2.name + ' have led to trade restrictions.',
            effects: [
                'No trade allowed between the two kingdoms',
                'Merchants caught trading face penalties',
                'Smuggling becomes profitable but risky',
                'Prices of goods from the other kingdom rise sharply'
            ],
            kingdoms: [kingdom1.id, kingdom2.id]
        });
    }

    function liftEmbargo(kingdom1, kingdom2) {
        if (kingdom1.embargoes) {
            kingdom1.embargoes = kingdom1.embargoes.filter(id => id !== kingdom2.id);
        }
        if (kingdom2.embargoes) {
            kingdom2.embargoes = kingdom2.embargoes.filter(id => id !== kingdom1.id);
        }
        logEvent(`📜 Trade embargo between ${kingdom1.name} and ${kingdom2.name} has been lifted.`, {
            type: 'embargo_lifted',
            cause: 'Relations have improved enough to allow trade again.',
            effects: [
                'Trade routes between the kingdoms reopen',
                'Merchants can freely travel between the kingdoms',
                'Prices should stabilize over time'
            ],
            kingdoms: [kingdom1.id, kingdom2.id]
        });
    }

    function hasEmbargo(kingdom1Id, kingdom2Id) {
        const k1 = findKingdom(kingdom1Id);
        if (!k1 || !k1.embargoes) return false;
        return k1.embargoes.includes(kingdom2Id);
    }

    // ========================================================
    // §20B  RESOURCE DEPLETION
    // ========================================================
    function tickResourceDepletion() {
        const daysSinceCheck = 30;
        for (const town of world.towns) {
            if (!town.naturalDeposits) continue;
            
            for (const bld of town.buildings) {
                const bt = findBuildingType(bld.type);
                if (!bt || !bt.produces) continue;
                if (bld.depositDepleted) continue;
                
                const resId = bt.produces;
                if (town.naturalDeposits[resId] == null) continue;
                
                // Calculate extraction
                const requiredWorkers = bt.workers;
                const assignedWorkers = countWorkersForBuilding(town, bld);
                const workerFraction = Math.min(1, assignedWorkers / Math.max(1, requiredWorkers));
                if (workerFraction <= 0) continue;
                
                const extracted = Math.floor(bt.rate * workerFraction * daysSinceCheck * (bld.level || 1));
                town.naturalDeposits[resId] = Math.max(0, town.naturalDeposits[resId] - extracted);
                
                const depositCfg = CONFIG.NATURAL_DEPOSITS[resId];
                if (!depositCfg) continue;
                
                const maxDeposit = depositCfg.max;
                const pct = town.naturalDeposits[resId] / maxDeposit;
                
                if (town.naturalDeposits[resId] <= 0) {
                    bld.depositDepleted = true;
                    logEvent(town.name + "'s " + bt.name + " has been exhausted!");
                } else if (pct < 0.2 && !bld._lowDepositWarned) {
                    bld._lowDepositWarned = true;
                    logEvent(resId.replace('_', ' ') + " deposits running low in " + town.name + "!");
                }
            }
            
            // Renewable resource regeneration
            for (const [resId, amount] of Object.entries(town.naturalDeposits)) {
                const cfg = CONFIG.NATURAL_DEPOSITS[resId];
                if (!cfg || !cfg.renewable) continue;
                
                // Fish recovery
                if (resId === 'fish' && town.fishRecoveryDay) {
                    if (world.day < town.fishRecoveryDay + cfg.overfishRecoveryDays) continue;
                    delete town.fishRecoveryDay;
                }
                
                if (amount <= 0 && resId === 'fish') {
                    town.fishRecoveryDay = world.day;
                    continue;
                }
                
                town.naturalDeposits[resId] = Math.min(cfg.max, amount + cfg.regenPerDay * daysSinceCheck);
            }
            
            // Tree plantation bonus
            const treePlantations = town.buildings.filter(b => b.type === 'tree_plantation');
            if (treePlantations.length > 0 && town.naturalDeposits.wood != null) {
                const woodCfg = CONFIG.NATURAL_DEPOSITS.wood;
                town.naturalDeposits.wood = Math.min(woodCfg.max, town.naturalDeposits.wood + 5 * daysSinceCheck * treePlantations.length);
            }
            
            // Soil fertility degradation (per season = every 90 days)
            if (town.soilFertility != null && world.day % CONFIG.DAYS_PER_SEASON === 0) {
                const hasActiveFarms = town.buildings.some(b => {
                    const btype = findBuildingType(b.type);
                    return btype && btype.category === 'farm' && !b.fallow;
                });
                const hasFallowFarms = town.buildings.some(b => {
                    const btype = findBuildingType(b.type);
                    return btype && btype.category === 'farm' && b.fallow;
                });
                
                if (hasActiveFarms) {
                    town.soilFertility = Math.max(0.1, town.soilFertility - CONFIG.SOIL_FERTILITY.degradePerSeason);
                }
                if (hasFallowFarms) {
                    town.soilFertility = Math.min(1.0, town.soilFertility + CONFIG.SOIL_FERTILITY.fallowRestorePerSeason);
                }
            }
        }
    }

    // ========================================================
    // §20C  LIVESTOCK BREEDING
    // ========================================================
    function tickLivestockBreeding() {
        for (const town of world.towns) {
            const livestockBuildings = {
                cattle_ranch: 'livestock_cow',
                pig_farm: 'livestock_pig',
                chicken_farm: 'livestock_chicken',
                horse_ranch: 'horses',
            };
            
            for (const bld of town.buildings) {
                const livestockType = livestockBuildings[bld.type];
                if (!livestockType) continue;
                
                const breedCfg = CONFIG.LIVESTOCK_BREEDING[livestockType];
                if (!breedCfg) continue;
                
                // Check feed
                const feedAvailable = town.market.supply[breedCfg.feedPerDay] || 0;
                if (feedAvailable < breedCfg.feedQty) {
                    // Starving — reset breed progress
                    if (bld.breedProgress > 0) bld.breedProgress = Math.max(0, (bld.breedProgress || 0) - 5);
                    continue;
                }
                
                // Consume feed (handle fractional feedQty by consuming every other day)
                if (breedCfg.feedQty < 1) {
                    // Feed every N days where N = 1/feedQty
                    if (world.day % Math.round(1 / breedCfg.feedQty) === 0) {
                        town.market.supply[breedCfg.feedPerDay] -= 1;
                    }
                } else {
                    town.market.supply[breedCfg.feedPerDay] -= Math.floor(breedCfg.feedQty);
                }
                
                if (!bld.breedProgress) bld.breedProgress = 0;
                bld.breedProgress++;
                
                if (bld.breedProgress >= breedCfg.breedDays) {
                    bld.breedProgress = 0;
                    // Add offspring to town supply
                    town.market.supply[livestockType] = (town.market.supply[livestockType] || 0) + breedCfg.offspring;
                }
            }
        }
    }

    // ========================================================
    // §20D  FOOD PREFERENCES
    // ========================================================
    function tickFoodPreferences() {
        if (!world._foodPrefIndex) world._foodPrefIndex = 0;
        
        const alive = world.people.filter(p => p.alive);
        if (alive.length === 0) return;
        const batchSize = Math.min(50, alive.length);
        const start = world._foodPrefIndex;
        const end = Math.min(start + batchSize, alive.length);
        
        for (let i = start; i < end; i++) {
            const person = alive[i];
            if (!person.foodPreferences) continue;
            
            const foods = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'];
            for (const f of foods) {
                // Drift preference slightly
                const drift = (world.rng.random() - 0.5) * 0.1;
                person.foodPreferences[f] = Math.max(0.3, Math.min(1.5, (person.foodPreferences[f] || 1.0) + drift));
            }
            
            // Social influence: if 30%+ of town eats a food, curiosity boost
            const town = findTown(person.townId);
            if (town) {
                const townPeople = alive.filter(p => p.townId === town.id && p.recentFoods && p.recentFoods.length > 0);
                if (townPeople.length > 5) {
                    const foodCounts = {};
                    for (const tp of townPeople) {
                        if (!tp.recentFoods) continue;
                        for (const f of tp.recentFoods) {
                            foodCounts[f] = (foodCounts[f] || 0) + 1;
                        }
                    }
                    for (const [f, count] of Object.entries(foodCounts)) {
                        if (count / townPeople.length >= 0.3) {
                            person.foodPreferences[f] = Math.min(1.5, (person.foodPreferences[f] || 1.0) + 0.01);
                        }
                    }
                }
            }
            
            // Variety bonus / monotony penalty
            if (person.recentFoods && person.recentFoods.length >= 10) {
                const uniqueFoods = new Set(person.recentFoods).size;
                if (uniqueFoods >= 3) {
                    person.needs.happiness = Math.min(100, (person.needs.happiness || 50) + 0.05);
                } else if (uniqueFoods <= 1 && person.recentFoods.length >= 30) {
                    person.needs.happiness = Math.max(0, (person.needs.happiness || 50) - 0.05);
                }
            }
        }
        
        world._foodPrefIndex = end >= alive.length ? 0 : end;
    }

    // ========================================================
    // §20E  FASHION & LUXURY TRENDS
    // ========================================================
    function tickFashionTrends() {
        if (!world.fashionTrends) world.fashionTrends = [];
        
        // Remove expired trends
        for (let i = world.fashionTrends.length - 1; i >= 0; i--) {
            const trend = world.fashionTrends[i];
            const elapsed = world.day - trend.startDay;
            if (elapsed > trend.duration + 30) {
                // Fully faded
                world.fashionTrends.splice(i, 1);
            } else if (elapsed > trend.duration) {
                // Fading phase — reduce demand bonus gradually
                trend.active = true;
                trend.demandBonus = trend._origBonus * (1 - (elapsed - trend.duration) / 30);
                if (trend.demandBonus <= 0) {
                    trend.active = false;
                }
            }
        }
        
        // Generate new trends (every 60-90 days)
        const activeTrends = world.fashionTrends.filter(t => t.active);
        if (activeTrends.length < 3) {
            for (const k of world.kingdoms) {
                if (k.gold < 2000) continue;
                const hasCityOrCapital = world.towns.some(t => t.kingdomId === k.id && (t.category === 'city' || t.category === 'capital_city'));
                if (!hasCityOrCapital) continue;
                
                if (!k._nextTrendDay) k._nextTrendDay = world.day + world.rng.randInt(60, 90);
                if (world.day < k._nextTrendDay) continue;
                
                k._nextTrendDay = world.day + world.rng.randInt(60, 90);
                if (activeTrends.length >= 3) break;
                
                const trendGoods = ['wine', 'jewelry', 'pearls', 'silk', 'perfume', 'fine_clothes', 'tapestry', 'gold_goblet', 'drum', 'flute', 'lute', 'harp', 'hurdy_gurdy'];
                // Don't duplicate active trends
                const activeTrendGoods = activeTrends.map(t => t.goodId);
                const available = trendGoods.filter(g => !activeTrendGoods.includes(g));
                if (available.length === 0) break;
                
                const goodId = world.rng.pick(available);
                const bonus = 0.3 + world.rng.random() * 0.2;
                const duration = world.rng.randInt(90, 180);
                
                const trend = {
                    goodId,
                    originKingdomId: k.id,
                    startDay: world.day,
                    duration,
                    spreadTo: [],
                    demandBonus: bonus,
                    _origBonus: bonus,
                    active: true,
                    _lastSpreadCheck: world.day,
                };
                world.fashionTrends.push(trend);
                
                const resInfo = findResourceById(goodId);
                const goodName = resInfo ? resInfo.name : goodId;
                logEvent(k.name + " has developed a taste for " + goodName + "!");
                break;
            }
        }
        
        // Spread trends to neighboring kingdoms
        for (const trend of world.fashionTrends) {
            if (!trend.active) continue;
            if (world.day - trend._lastSpreadCheck < 30) continue;
            trend._lastSpreadCheck = world.day;
            
            const originK = findKingdom(trend.originKingdomId);
            if (!originK) continue;
            
            for (const k of world.kingdoms) {
                if (k.id === trend.originKingdomId) continue;
                if (trend.spreadTo.includes(k.id)) continue;
                
                // Check diplomacy relations
                const rel = originK.relations ? (originK.relations[k.id] || 0) : 50;
                if (rel < 30) continue;
                
                if (world.rng.chance(0.4)) {
                    trend.spreadTo.push(k.id);
                    const resInfo = findResourceById(trend.goodId);
                    const goodName = resInfo ? resInfo.name : trend.goodId;
                    logEvent("The " + goodName + " craze has spread to " + k.name + "!");
                }
            }
        }
    }

    // ========================================================
    // §20F  WAREHOUSE SECURITY
    // ========================================================
    function tickWarehouseSecurity() {
        for (const town of world.towns) {
            const warehouseTypes = ['warehouse', 'warehouse_small', 'warehouse_large'];
            for (const bld of town.buildings) {
                if (!warehouseTypes.includes(bld.type)) continue;
                
                // Base theft chance by town category
                const baseTheft = CONFIG.WAREHOUSE_BASE_THEFT[town.category] || 0.05;
                
                // Apply security reductions
                let theftChance = baseTheft;
                if (bld.securityUpgrades && bld.securityUpgrades.length > 0) {
                    for (const upgradeId of bld.securityUpgrades) {
                        const upgrade = CONFIG.WAREHOUSE_SECURITY[upgradeId];
                        if (upgrade) {
                            theftChance *= (1 - upgrade.theftReduction);
                        }
                    }
                }
                // Also consider existing guard/locked storage
                if (bld.hasGuard) theftChance *= 0.5;
                if (bld.lockedStorage) theftChance *= 0.7;
                
                if (!world.rng.chance(theftChance)) continue;
                
                // Theft occurs — steal 5-15% of stored goods
                const bt = findBuildingType(bld.type);
                const storage = bt ? bt.storage : 200;
                const totalStored = Object.values(town.market.supply).reduce((a, b) => a + Math.max(0, b), 0);
                if (totalStored <= 0) continue;
                
                const stealPct = 0.05 + world.rng.random() * 0.10;
                const stolenAmount = Math.max(1, Math.floor(totalStored * stealPct));
                let remaining = stolenAmount;
                
                const stolenGoods = {};
                const supplyKeys = Object.keys(town.market.supply).filter(k => town.market.supply[k] > 0);
                if (supplyKeys.length === 0) continue;
                
                while (remaining > 0 && supplyKeys.length > 0) {
                    const key = world.rng.pick(supplyKeys);
                    const take = Math.min(remaining, Math.max(1, Math.floor(town.market.supply[key] * stealPct)));
                    town.market.supply[key] -= take;
                    stolenGoods[key] = (stolenGoods[key] || 0) + take;
                    remaining -= take;
                    if (town.market.supply[key] <= 0) {
                        supplyKeys.splice(supplyKeys.indexOf(key), 1);
                    }
                    if (remaining <= 0) break;
                }
                
                logEvent("Thieves struck a warehouse in " + town.name + "! Goods stolen.");
                
                // Check trapped locks — chance to catch thief
                if (bld.securityUpgrades && bld.securityUpgrades.includes('trapped_locks')) {
                    const trapCfg = CONFIG.WAREHOUSE_SECURITY.trapped_locks;
                    if (world.rng.chance(trapCfg.catchChance)) {
                        logEvent("A thief was caught by trapped locks in " + town.name + "!");
                    }
                }
                
                // Guard post wage cost
                if (bld.securityUpgrades && bld.securityUpgrades.includes('guard_post')) {
                    const guardCfg = CONFIG.WAREHOUSE_SECURITY.guard_post;
                    if (bld.ownerId) {
                        // Deduct wage from owner (handled by player or NPC separately)
                    }
                }
            }
        }
    }

    // ========================================================
    // §20G  HELPER — get food trends for tavern intel
    // ========================================================
    function getTownFoodTrends(townId) {
        const town = findTown(townId);
        if (!town) return [];
        
        const alive = world.people.filter(p => p.alive && p.townId === townId);
        if (alive.length === 0) return [];
        
        const foods = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'];
        const totals = {};
        for (const f of foods) totals[f] = 0;
        
        for (const p of alive) {
            if (!p.foodPreferences) continue;
            for (const f of foods) {
                totals[f] += (p.foodPreferences[f] || 1.0);
            }
        }
        
        // Average and sort
        const results = foods.map(f => ({
            food: f,
            avgPreference: totals[f] / Math.max(1, alive.length),
            demand: town.market.demand[f] || 0,
        }));
        results.sort((a, b) => b.avgPreference - a.avgPreference);
        return results.slice(0, 3);
    }

    // ========================================================
    // §19b PASSENGER TRAVEL DEMAND
    // ========================================================

    function tickTravelDemand() {
        if (!world || !world.towns) return;
        var rng = world.rng;
        if (!rng) return;
        var currentDay = world.day || 0;
        for (var i = 0; i < world.towns.length; i++) {
            var town = world.towns[i];
            if (!town.travelDemand) town.travelDemand = [];
            // Remove expired demand (older than 30 days)
            town.travelDemand = town.travelDemand.filter(function(d) { return currentDay - d.createdDay < 30; });
            // Cap at 15 waiting travelers per town
            if (town.travelDemand.length >= 15) continue;
            // Generate 0-3 new travelers wanting to leave
            var numNew = rng.randInt(0, 3); // 0-3
            for (var n = 0; n < numNew; n++) {
                if (town.travelDemand.length >= 15) break;
                // Pick a random connected town as destination
                var connectedTowns = [];
                for (var r = 0; r < world.roads.length; r++) {
                    if (world.roads[r].fromTownId === town.id) connectedTowns.push(world.roads[r].toTownId);
                    else if (world.roads[r].toTownId === town.id) connectedTowns.push(world.roads[r].fromTownId);
                }
                // Also add sea route destinations if port
                if (town.isPort && world.seaRoutes) {
                    for (var sr = 0; sr < world.seaRoutes.length; sr++) {
                        if (world.seaRoutes[sr].fromTownId === town.id) connectedTowns.push(world.seaRoutes[sr].toTownId);
                        else if (world.seaRoutes[sr].toTownId === town.id) connectedTowns.push(world.seaRoutes[sr].fromTownId);
                    }
                }
                if (connectedTowns.length === 0) continue;
                var destId = connectedTowns[Math.floor(rng.random() * connectedTowns.length)];
                var destTown = findTown(destId);
                if (!destTown) continue;
                // Calculate distance
                var dist = Math.hypot(town.x - destTown.x, town.y - destTown.y);
                // Pick random person from town as the traveler
                var townPeople = world.people.filter(function(p) { return p.alive && p.townId === town.id && p.age >= 16; });
                if (townPeople.length === 0) continue;
                var person = townPeople[Math.floor(rng.random() * townPeople.length)];
                // Don't duplicate — skip if already wanting to travel
                var isDuplicate = false;
                for (var di = 0; di < town.travelDemand.length; di++) {
                    if (town.travelDemand[di].personId === person.id) { isDuplicate = true; break; }
                }
                if (isDuplicate) continue;
                // Wealth multiplier
                var wealthMult = 1;
                if (person.wealthClass === 'upper') wealthMult = 3;
                else if (person.wealthClass === 'middle') wealthMult = 1.5;
                var urgency = 1 + rng.randInt(0, 2); // 1-3
                var maxPrice = Math.floor(dist / 100 * 5 * wealthMult * urgency);
                maxPrice = Math.max(5, Math.min(maxPrice, 300)); // Clamp 5-300g
                town.travelDemand.push({
                    personId: person.id,
                    personName: person.firstName + ' ' + (person.lastName || ''),
                    wealthClass: person.wealthClass || 'lower',
                    destinationTownId: destId,
                    destinationName: destTown.name,
                    maxPrice: maxPrice,
                    urgency: urgency,
                    createdDay: currentDay
                });
            }
        }
    }

    // ========================================================
    // §19c NPC TRANSPORT SERVICES
    // ========================================================

    function tickNPCTransport() {
        if (!world || !world.towns) return;
        var day = world.day || 0;
        if (day % 3 !== 0) return; // Run every 3 days
        var rng = world.rng;
        if (!rng) return;
        var roads = world.roads || [];
        var seaRoutes = world.seaRoutes || [];

        for (var t = 0; t < world.towns.length; t++) {
            var town = world.towns[t];
            if (!town.npcTransportServices) town.npcTransportServices = [];

            // Remove expired services
            town.npcTransportServices = town.npcTransportServices.filter(function(s) {
                return day - s.createdDay < s.duration;
            });

            // Cap at 3 services per town
            if (town.npcTransportServices.length >= 3) continue;

            // Find connected destinations (land roads)
            var destinations = [];
            for (var r = 0; r < roads.length; r++) {
                if (roads[r].fromTownId === town.id) destinations.push(roads[r].toTownId);
                else if (roads[r].toTownId === town.id) destinations.push(roads[r].fromTownId);
            }
            // Sea destinations for port towns
            if (town.isPort) {
                for (var sr = 0; sr < seaRoutes.length; sr++) {
                    if (seaRoutes[sr].fromTownId === town.id) destinations.push(seaRoutes[sr].toTownId);
                    else if (seaRoutes[sr].toTownId === town.id) destinations.push(seaRoutes[sr].fromTownId);
                }
            }
            if (destinations.length === 0) continue;

            // Find elite/wealthy merchants in town to operate services
            var operators = [];
            for (var pi = 0; pi < world.people.length; pi++) {
                var p = world.people[pi];
                if (p.alive && p.townId === town.id &&
                    (p.isEliteMerchant || (p.occupation === 'merchant' && (p.wealthClass === 'upper' || p.wealthClass === 'middle')))) {
                    operators.push(p);
                }
            }

            // Filter operators by rank — must be able to own horses
            operators = operators.filter(function(op) {
                if (op.isEliteMerchant) return true; // EMs always qualify
                // Check if Draft Animal Law is active
                var opKingdom = findKingdom(town.kingdomId);
                if (opKingdom && hasSpecialLaw(opKingdom, 'draft_animal_law')) {
                    // Need Burgher rank (rank 2+) or permit
                    var rank = op.socialRank || 0;
                    if (rank < 2) return false; // Can't own horses = can't run transport
                }
                return (op.gold || 0) > 100; // Need some capital
            });

            if (operators.length === 0) continue;

            // Each operator has 15% chance to offer a service
            for (var o = 0; o < operators.length && town.npcTransportServices.length < 3; o++) {
                if (!rng.chance(0.15)) continue;
                var operator = operators[o];
                var destId = destinations[Math.floor(rng.random() * destinations.length)];
                var destTown = findTown(destId);
                if (!destTown) continue;
                // Don't duplicate same destination
                var hasDest = false;
                for (var ds = 0; ds < town.npcTransportServices.length; ds++) {
                    if (town.npcTransportServices[ds].destinationTownId === destId) { hasDest = true; break; }
                }
                if (hasDest) continue;

                var dist = Math.hypot(town.x - destTown.x, town.y - destTown.y);
                var basePrice = Math.floor(dist / 100 * 3);
                var priceVariation = 0.7 + (rng.randInt(0, 60) / 100); // 0.70-1.30
                var price = Math.max(5, Math.floor(basePrice * priceVariation));
                var capacity = 3 + rng.randInt(0, 5); // 3-8 seats
                var duration = 3 + rng.randInt(0, 4); // Available for 3-7 days
                var isSea = town.isPort && destTown.isPort && !roads.some(function(rd) {
                    return (rd.fromTownId === town.id && rd.toTownId === destId) ||
                           (rd.toTownId === town.id && rd.fromTownId === destId);
                });

                town.npcTransportServices.push({
                    operatorId: operator.id,
                    operatorName: operator.firstName + ' ' + (operator.lastName || ''),
                    destinationTownId: destId,
                    destinationName: destTown.name,
                    price: price,
                    capacity: capacity,
                    isSea: !!isSea,
                    createdDay: day,
                    duration: duration
                });

                // NPC services consume some travel demand (competition!)
                if (town.travelDemand && town.travelDemand.length > 0) {
                    var consumed = 0;
                    for (var d = town.travelDemand.length - 1; d >= 0 && consumed < 2; d--) {
                        if (town.travelDemand[d].destinationTownId === destId && town.travelDemand[d].maxPrice >= price) {
                            town.travelDemand.splice(d, 1);
                            consumed++;
                        }
                    }
                }
            }
        }
    }

    // ========================================================
    // §19b BRIDGE & ROAD MANAGEMENT
    // ========================================================

    function destroyBridge(roadIndex) {
        const road = world.roads[roadIndex];
        if (!road || !road.hasBridge) return { success: false, message: 'This road has no bridge.' };
        if (road.bridgeDestroyed) return { success: false, message: 'Bridge is already destroyed.' };
        road.bridgeDestroyed = true;
        road.bridgeDestroyedDay = world.day;
        logEvent(`\u26A0\uFE0F The bridge on the road between ${findTown(road.fromTownId)?.name || '?'} and ${findTown(road.toTownId)?.name || '?'} has been destroyed!`);
        return { success: true, message: 'Bridge destroyed.' };
    }

    function rebuildBridge(roadIndex) {
        const road = world.roads[roadIndex];
        if (!road || !road.hasBridge) return { success: false, message: 'This road has no bridge.' };
        if (!road.bridgeDestroyed) return { success: false, message: 'Bridge is not destroyed.' };
        road.bridgeDestroyed = false;
        road.bridgeDestroyedDay = null;
        road.bridgeRebuiltDay = world.day;
        road.condition = 'new';
        logEvent(`\uD83D\uDD28 The bridge on the road between ${findTown(road.fromTownId)?.name || '?'} and ${findTown(road.toTownId)?.name || '?'} has been rebuilt!`);
        return { success: true, message: 'Bridge rebuilt.' };
    }

    function buildNewRoad(fromTownId, toTownId, builtBy, options) {
        const fromT = findTown(fromTownId);
        const toT = findTown(toTownId);
        if (!fromT || !toT) return { success: false, message: 'Town not found.' };

        // Check if already exists (ignore destroyed roads — they can be replaced)
        const existingIdx = world.roads.findIndex(r =>
            (r.fromTownId === fromTownId && r.toTownId === toTownId) ||
            (r.fromTownId === toTownId && r.toTownId === fromTownId)
        );
        if (existingIdx >= 0) {
            if (world.roads[existingIdx].condition === 'destroyed') {
                world.roads.splice(existingIdx, 1); // Remove destroyed road, will rebuild below
            } else {
                return { success: false, message: 'Road already exists.' };
            }
        }

        // Analyze water for bridges
        const waterInfo = analyzeRoadWater(fromT.x, fromT.y, toT.x, toT.y);
        const hasBridge = waterInfo.bridgeSegments.length > 0;
        options = options || {};
        world.roads.push({
            fromTownId, toTownId,
            quality: options.quality || 2,
            safe: true,
            hasBridge,
            bridgeDestroyed: false,
            bridgeSegments: hasBridge ? waterInfo.bridgeSegments : [],
            condition: 'new',
            builtDay: world.day,
            builtBy: builtBy || null,
            ownerId: options.ownerId || null,
            tollRate: options.tollRate || 0,
            tollRevenue: 0,
            isTollRoad: options.isTollRoad || false,
        });

        logEvent(`\uD83D\uDEE4\uFE0F A new road has been built between ${fromT.name} and ${toT.name}!`);
        return { success: true, message: `Road built between ${fromT.name} and ${toT.name}.` };
    }

    function buildNewSeaRoute(fromTownId, toTownId, builtBy, options) {
        const fromT = findTown(fromTownId);
        const toT = findTown(toTownId);
        if (!fromT || !toT) return { success: false, message: 'Town not found.' };
        if (!fromT.isPort || !toT.isPort) return { success: false, message: 'Both towns must be ports.' };

        const exists = world.seaRoutes.some(r =>
            (r.fromTownId === fromTownId && r.toTownId === toTownId) ||
            (r.fromTownId === toTownId && r.toTownId === fromTownId)
        );
        if (exists) return { success: false, message: 'Sea route already exists.' };

        const dist = Math.hypot(fromT.x - toT.x, fromT.y - toT.y);
        options = options || {};
        world.seaRoutes.push({
            fromTownId, toTownId,
            type: 'sea',
            distance: dist,
            safe: true,
            ownerId: options.ownerId || null,
            tollRate: options.tollRate || 0,
            tollRevenue: 0,
            isTollRoute: options.isTollRoute || false,
            docks: options.docks || { from: true, to: true },
            builtDay: world.day,
            builtBy: builtBy || null,
        });

        logEvent(`\u2693 A new sea route has been established between ${fromT.name} and ${toT.name}!`);
        return { success: true, message: `Sea route built between ${fromT.name} and ${toT.name}.` };
    }

    function collectTolls() {
        const allRoutes = [...world.roads.filter(r => r.isTollRoad && r.tollRate > 0 && r.ownerId),
                           ...world.seaRoutes.filter(r => r.isTollRoute && r.tollRate > 0 && r.ownerId)];

        for (const route of allRoutes) {
            const fromT = findTown(route.fromTownId);
            const toT = findTown(route.toTownId);
            if (!fromT || !toT) continue;

            const avgPop = ((fromT.population || 0) + (toT.population || 0)) / 2;
            const baseTraffic = Math.max(1, Math.floor(avgPop / 20));

            const rateModifier = Math.max(0.2, 1.0 - (route.tollRate - CONFIG.TOLL_DEFAULT_RATE) / (CONFIG.TOLL_MAX_RATE * 1.5));

            let altRouteExists = false;
            if (route.type === 'sea') {
                altRouteExists = world.seaRoutes.some(r => r !== route && !r.isTollRoute &&
                    ((r.fromTownId === route.fromTownId && r.toTownId === route.toTownId) ||
                     (r.fromTownId === route.toTownId && r.toTownId === route.fromTownId)));
            } else {
                altRouteExists = world.roads.some(r => r !== route && !r.isTollRoad &&
                    ((r.fromTownId === route.fromTownId && r.toTownId === route.toTownId) ||
                     (r.fromTownId === route.toTownId && r.toTownId === route.fromTownId)));
            }
            const altModifier = altRouteExists ? 0.3 : 1.0;

            const dailyTraffic = Math.max(0, Math.floor(baseTraffic * rateModifier * altModifier));
            const dailyRevenue = dailyTraffic * route.tollRate;

            route.tollRevenue = (route.tollRevenue || 0) + dailyRevenue;

            if (route.ownerId === 'player') {
                // Player revenue accumulated on route — collected via Player.collectTollRevenue()
            } else {
                const owner = findPerson(route.ownerId);
                if (owner && owner.alive) {
                    owner.gold = (owner.gold || 0) + dailyRevenue;
                } else {
                    const kingdom = findKingdom(route.ownerId);
                    if (kingdom) {
                        kingdom.gold = (kingdom.gold || 0) + dailyRevenue;
                    }
                }
            }
        }
    }

    // ========================================================
    // §19F NPC BUILDING SALE SYSTEM
    // ========================================================

    function getBuildingValue(bld) {
        const bt = findBuildingType(bld.type);
        if (!bt) return 100;
        let value = bt.cost * (bld.level || 1);
        if (bld.condition === 'destroyed') value *= 0.3;
        else if (bld.condition === 'breaking') value *= 0.5;
        else if (bld.condition === 'used') value *= 0.75;
        return Math.floor(value);
    }

    function getNPCBuildingSaleOffers(townId) {
        const town = findTown(townId);
        if (!town) return [];
        const offers = [];
        for (const bld of town.buildings) {
            if (!bld.ownerId || bld.ownerId === 'player') continue;
            if ((CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bld.type)) continue;

            const kingdom = findKingdom(town.kingdomId);
            // Skip kingdom-owned buildings
            if (kingdom && bld.ownerId === kingdom.id) continue;

            const owner = findPerson(bld.ownerId);
            if (!owner || !owner.alive) {
                offers.push({ building: bld, price: getBuildingValue(bld), reason: 'Unowned' });
                continue;
            }

            // NPC sells if: low gold, unhappy, or building is unprofitable
            const sellChance = (owner.gold < 50) ? 0.7 :
                              (owner.needs && owner.needs.happiness < 30) ? 0.4 : 0.05;
            if (world.rng.chance(sellChance)) {
                offers.push({ building: bld, price: Math.floor(getBuildingValue(bld) * 1.2), reason: 'Owner willing to sell' });
            }
        }
        return offers;
    }

    function buyNPCBuilding(buildingIndex, townId) {
        const town = findTown(townId);
        if (!town) return { success: false, message: 'Town not found.' };
        const bld = town.buildings[buildingIndex];
        if (!bld) return { success: false, message: 'Building not found.' };
        if ((CONFIG.KINGDOM_EXCLUSIVE_BUILDINGS || []).includes(bld.type)) {
            return { success: false, message: 'This building cannot be purchased.' };
        }
        const offers = getNPCBuildingSaleOffers(townId);
        const offer = offers.find(o => o.building === bld);
        if (!offer) return { success: false, message: 'This building is not for sale.' };
        return { success: true, price: offer.price, building: bld, reason: offer.reason };
    }

    // ========================================================
    // §20 MAIN GENERATE & TICK
    // ========================================================

    window.Engine = {
        /**
         * Generate a new world. Optionally pass a seed integer.
         * @param {number} [seed=42]
         */
        generate(seed) {
            seed = seed || 42;
            _nextId = 1;
            world = defaultWorld();
            world.seed = seed;
            world.rng = createRNG(seed);
            const rng = world.rng;

            // Terrain
            const { grid, cols, rows } = generateTerrain(rng, seed);
            world.terrain = grid;
            world.gridCols = cols;
            world.gridRows = rows;

            // Kingdoms
            world.kingdoms = generateKingdoms(rng);

            // Towns
            world.towns = generateTowns(rng, world.kingdoms, cols, rows);

            // Post-generation safety: ensure every kingdom has at least 1 town
            for (const k of world.kingdoms) {
                const kTowns = world.towns.filter(t => t.kingdomId === k.id);
                if (kTowns.length === 0) {
                    // Steal the farthest town from the kingdom with the most towns
                    let maxK = null;
                    let maxCount = 0;
                    for (const ok of world.kingdoms) {
                        if (ok.id === k.id) continue;
                        const count = world.towns.filter(t => t.kingdomId === ok.id).length;
                        if (count > maxCount) { maxCount = count; maxK = ok; }
                    }
                    if (maxK && maxCount > 1) {
                        const donorTowns = world.towns.filter(t => t.kingdomId === maxK.id && !t.isCapital);
                        if (donorTowns.length > 0) {
                            const donated = donorTowns[donorTowns.length - 1]; // take the last one
                            donated.kingdomId = k.id;
                            maxK.territories.delete(donated.id);
                            k.territories.add(donated.id);
                        }
                    }
                }
            }

            // Roads
            world.roads = generateRoads(rng, world.towns, world.kingdoms);

            // Record starting town count for war immunity calculations
            for (const k of world.kingdoms) {
                k._startingTowns = k.territories.size;
            }

            // Sea routes
            world.seaRoutes = generateSeaRoutes(rng, world.towns);

            // Pre-compute town connectivity for price convergence and pathfinding
            for (var ci = 0; ci < world.towns.length; ci++) {
                world.towns[ci].connectedTowns = [];
            }
            for (var ri = 0; ri < world.roads.length; ri++) {
                var road = world.roads[ri];
                var fromTown = world.towns.find(function(t) { return t.id === road.fromTownId; });
                var toTown = world.towns.find(function(t) { return t.id === road.toTownId; });
                if (fromTown && toTown) {
                    if (fromTown.connectedTowns.indexOf(toTown.id) === -1) fromTown.connectedTowns.push(toTown.id);
                    if (toTown.connectedTowns.indexOf(fromTown.id) === -1) toTown.connectedTowns.push(fromTown.id);
                }
            }
            for (var si = 0; si < world.seaRoutes.length; si++) {
                var sr = world.seaRoutes[si];
                var fromPort = world.towns.find(function(t) { return t.id === sr.fromTownId; });
                var toPort = world.towns.find(function(t) { return t.id === sr.toTownId; });
                if (fromPort && toPort) {
                    if (fromPort.connectedTowns.indexOf(toPort.id) === -1) fromPort.connectedTowns.push(toPort.id);
                    if (toPort.connectedTowns.indexOf(fromPort.id) === -1) toPort.connectedTowns.push(fromPort.id);
                }
            }

            // People — _popOverride assigned in generateTowns for non-island towns
            for (const town of world.towns) {
                if (town.isIsland && !town._popOverride) {
                    town._popOverride = rng.randInt(CONFIG.ISLAND_POP_MIN, CONFIG.ISLAND_POP_MAX);
                }
                // Non-island towns already have _popOverride from generateTowns
            }
            world.people = generatePeople(rng, world.towns, world.kingdoms);

            // Populate world.eliteMerchants array (always 20)
            world.eliteMerchants = world.people.filter(function(p) { return p.alive && p.isEliteMerchant; });

            // Initialize alive population cache
            world._alivePopCount = world.people.filter(p => p.alive).length;

            // Build indexes
            rebuildIndexes();

            // Initialize livestock and towers for any towns that need it
            for (const town of world.towns) {
                if (!town.livestock) town.livestock = { livestock_cow: 0, livestock_pig: 0, livestock_chicken: 0 };
                town.towers = town.buildings.filter(b => b.type === 'watchtower').length;
                // Initialize town category
                town.category = getTownCategory(town.population);
                town.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots;
            }

            // Initialize royal advisors and naval fleets for kingdoms
            for (const k of world.kingdoms) {
                if (!k.royalAdvisors) k.royalAdvisors = [];
                if (!k.navalFleet) k.navalFleet = [];
                if (!k.alliances) k.alliances = new Set();
                updateRoyalAdvisors(k);
            }

            // Trigger starting wars (deferred from kingdom generation)
            for (const k of world.kingdoms) {
                if (k._startWarWith) {
                    const other = findKingdom(k._startWarWith);
                    if (other && !k.atWar.has(other.id)) {
                        declareWar(k, other);
                    }
                    delete k._startWarWith;
                }
            }

            logEvent('The world of Merchant Realms has been created.');
            return world;
        },

        /**
         * Advance the simulation by one day.
         */
        tick() {
            if (!world) return;
            world.day++;

            // ── Performance: build people cache for this tick ──
            _tickCache = {
                peopleByTown: {},
                peopleByKingdom: {},
                soldiersByKingdom: {},
                aliveCount: 0
            };
            for (var _ci = 0; _ci < world.people.length; _ci++) {
                var _cp = world.people[_ci];
                if (!_cp.alive) continue;
                _tickCache.aliveCount++;
                if (!_tickCache.peopleByTown[_cp.townId]) _tickCache.peopleByTown[_cp.townId] = [];
                _tickCache.peopleByTown[_cp.townId].push(_cp);
                if (!_tickCache.peopleByKingdom[_cp.kingdomId]) _tickCache.peopleByKingdom[_cp.kingdomId] = [];
                _tickCache.peopleByKingdom[_cp.kingdomId].push(_cp);
                if (_cp.occupation === 'soldier' || _cp.occupation === 'guard') {
                    if (!_tickCache.soldiersByKingdom[_cp.kingdomId]) _tickCache.soldiersByKingdom[_cp.kingdomId] = [];
                    _tickCache.soldiersByKingdom[_cp.kingdomId].push(_cp);
                }
            }

            tickEconomy();
            tickPeople();
            tickNPCMerchants();
            tickNPCMerchantTravel();
            tickFamilyMembers();
            tickEliteMerchantAI();
            tickNPCCaravans();     // Process caravan movement
            tickEMCaravans();      // EM caravan hiring decisions
            tickKingdomCaravans(); // Kingdom supply caravans
            tickNPCRetailBuildings();
            tickNPCPurchasing();
            tickDiplomacy();
            tickMilitary();
            tickEvents();
            tickSecurity();
            tickTownCategories();
            tickOutposts();
            tickOutpostAnnexation();
            tickEliteMerchantOutposts();
            tickWorkerEconomy();
            tickTravelDemand();
            tickNPCTransport();

            // Daily happiness fluctuation (drains + boosts)
            tickHappinessFluctuation();
            // Daily town happiness consequences (scaled percentage-based)
            tickTownHappinessConsequences();
            // Daily tax consequences
            tickTaxConsequences();
            // Daily mercenary expiry & war zone supply drain
            tickMercenaryExpiry();

            // Toll Collection
            if (world.day % (CONFIG.TOLL_COLLECTION_INTERVAL || 1) === 0) {
                collectTolls();
            }
            for (const k of world.kingdoms) {
                tickKingdomFinances(k);
            }

            // Kingdom procurement AI (every 7 days)
            if (world.day % 7 === 0) {
                for (const k of world.kingdoms) {
                    tickKingdomProcurement(k);
                }
                tickEliteMerchantBidding();
            }

            // Royal commissions (every 30 days, checked per kingdom)
            if (world.day % (CONFIG.ROYAL_COMMISSIONS ? CONFIG.ROYAL_COMMISSIONS.checkInterval : 30) === 0) {
                for (const k of world.kingdoms) {
                    tickRoyalCommissions(k);
                }
            }

            // Kingdom ban policy review (every 30 days)
            if (world.day % (CONFIG.KINGDOM_BAN_POLICY_INTERVAL || 30) === 0) {
                for (const k of world.kingdoms) {
                    tickKingdomBanPolicy(k);
                }
            }

            // King proactive economic strategy (per-kingdom interval based on intelligence)
            if (world.day % 7 === 0) {
                for (const k of world.kingdoms) {
                    tickKingEconomicStrategy(k);
                }
            }

            // Bug 5 fix: crisis trigger — if treasury dropped 50%, immediately strategize
            for (const k of world.kingdoms) {
                if (k._startingGold && k.gold < k._startingGold * 0.5) {
                    if (!k._lastCrisisCheck || world.day - k._lastCrisisCheck >= 10) {
                        k._lastCrisisCheck = world.day;
                        k._lastStrategyDay = 0; // bypass internal throttle
                        tickKingEconomicStrategy(k);
                    }
                }
            }

            // NPC business evaluation (every 60 days)
            if (world.day % CONFIG.NPC_BUSINESS_EVAL_INTERVAL === 0) {
                tickNPCBusinesses();
                applyKingEconomicEffectsToNPCs();
            }

            // Natural disasters (every 30 days)
            if (world.day % CONFIG.DISASTER_CHECK_INTERVAL === 0) {
                tickDisasters();
            }

            // Degradation every 30 game days
            if (world.day % (CONFIG.DEGRADATION_TICK_INTERVAL || 30) === 0) {
                tickDegradation();
                tickRoadConnectivity();
            }

            // Resource depletion (every 30 days)
            if (world.day % 30 === 0) {
                tickResourceDepletion();
                tickWarehouseSecurity();
            }

            // Livestock breeding (daily)
            tickLivestockBreeding();

            // Food preferences (every 30 days)
            if (world.day % 30 === 0) {
                tickFoodPreferences();
            }

            // Servitude check (every 30 days)
            if (world.day % 30 === 0) {
                tickServitude();
            }

            // Migration check (every MIGRATION_CHECK_INTERVAL days)
            if (world.day % (CONFIG.MIGRATION_CHECK_INTERVAL || 30) === 0) {
                tickMigration();
            }

            // Frontline town updates (daily during wars)
            if (world.activeWars && Object.keys(world.activeWars).length > 0) {
                updateFrontlineTowns();
            }

            // Fashion trends (daily, lightweight)
            tickFashionTrends();

            // Elite merchant dynamics and count maintenance (every 90 days / once per season)
            if (world.day % 90 === 0) {
                tickEliteMerchantDynamics();
                ensureEliteMerchantCount();
            }

            // Register any new people born this tick
            for (const p of world.people) {
                if (!personIndex[p.id]) registerPerson(p);
            }

            // Sanitize gold to prevent float accumulation
            for (const k of world.kingdoms) {
                k.gold = Math.floor(k.gold || 0);
                if ('treasury' in k) { k.gold += Math.floor(k.treasury || 0); delete k.treasury; }
            }
            for (const em of world.eliteMerchants) {
                em.gold = Math.floor(em.gold || 0);
            }
            for (const p of world.people) {
                if (p.gold && !Number.isInteger(p.gold)) p.gold = Math.floor(p.gold);
            }
        },

        // ==== Query Methods ====

        getWorld() { return world; },

        classifyTownTerrain,
        computeLocalBasePrices,

        getTowns() { return world ? world.towns : []; },

        getTown(id) { return world ? findTown(id) : null; },

        getKingdoms() {
            if (!world) return [];
            // Serialize Sets for safe consumption
            return world.kingdoms.map(k => ({
                ...k,
                atWar: [...k.atWar],
                territories: [...k.territories],
            }));
        },

        getKingdom(id) {
            if (!world) return null;
            const k = findKingdom(id);
            if (!k) return null;
            return { ...k, atWar: [...k.atWar], territories: [...k.territories] };
        },

        getPeople(townId) {
            if (!world) return [];
            if (townId) return world.people.filter(p => p.alive && p.townId === townId);
            return world.people.filter(p => p.alive);
        },

        getPeopleCached: function(townId) {
            var currentDay = world ? world.day : 0;
            if (_renderPeopleCache === null || _renderPeopleCacheDay !== currentDay) {
                _renderPeopleCache = {};
                _renderPeopleCacheDay = currentDay;
                for (var i = 0; i < world.people.length; i++) {
                    var p = world.people[i];
                    if (!p.alive) continue;
                    if (!_renderPeopleCache[p.townId]) _renderPeopleCache[p.townId] = [];
                    _renderPeopleCache[p.townId].push(p);
                }
            }
            if (townId) return _renderPeopleCache[townId] || [];
            return world.people.filter(function(p) { return p.alive; });
        },

        getPerson(id) { return world ? findPerson(id) : null; },

        addPerson(person) {
            if (!world) return false;
            world.people.push(person);
            registerPerson(person);
            return true;
        },

        getRoads() { return world ? world.roads : []; },

        getSeaRoutes() { return world ? world.seaRoutes : []; },

        getEvents() {
            if (!world) return [];
            return world.eventLog.filter(e => world.day - e.day <= 30);
        },

        getDay() { return world ? world.day : 0; },

        getHour() { return world ? (world.hour || 0) : 0; },

        getSeason() { return world ? getSeason(world.day) : 'Spring'; },

        getYear() { return world ? getYear(world.day) : 1; },

        getArmies() { return world ? world.armies : []; },

        getTownSecurity(townId) {
            const town = findTown(townId);
            return town ? (town.security || 0) : 0;
        },

        getRoadBanditThreat(roadId) {
            if (!world) return 0;
            const road = world.roads.find(r => r.id === roadId);
            return road ? (road.banditThreat || 0) : 0;
        },

        // Expose helpers for player.js
        findTown(id) { return findTown(id); },
        findKingdom(id) { return findKingdom(id); },
        findPerson(id) { return findPerson(id); },
        findPath(a, b) { return findPath(a, b); },
        findBuildingType(id) { return findBuildingType(id); },
        logEvent(msg, details, category) { logEvent(msg, details, category); },
        getRng() { return world ? world.rng : null; },
        killPerson(p, cause) { return killPerson(p, cause); },
        getTerrainGrid() { return world ? { grid: world.terrain, cols: world.gridCols, rows: world.gridRows } : null; },
        getActiveWars() { return world ? (world.activeWars || {}) : {}; },

        // Free travel: expose A* pathfinding and terrain lookup
        findTerrainPath: function(sx, sy, ex, ey, mode) { return findTerrainPath(sx, sy, ex, ey, mode); },
        getTerrainAtPixel: function(px, py) { return terrainAt(Math.floor(px / CONFIG.TILE_SIZE), Math.floor(py / CONFIG.TILE_SIZE)); },

        // Resource helpers for ship/building dynamic pricing
        getResourcePrice(townId, resourceId) {
            var town = findTown(townId);
            if (!town || !town.market || !town.market.prices) return 10;
            return town.market.prices[resourceId] || 10;
        },
        getResourceSupply(townId, resourceId) {
            var town = findTown(townId);
            if (!town || !town.market || !town.market.supply) return 0;
            return town.market.supply[resourceId] || 0;
        },
        consumeResource(townId, resourceId, qty) {
            var town = findTown(townId);
            if (!town || !town.market || !town.market.supply) return;
            town.market.supply[resourceId] = Math.max(0, (town.market.supply[resourceId] || 0) - qty);
        },

        // Kingdom economic analysis (for kings_log and UI)
        analyzeKingdomEconomy(kingdomId) {
            if (!world) return null;
            const k = typeof kingdomId === 'string' ? findKingdom(kingdomId) : kingdomId;
            return k ? analyzeKingdomEconomy(k) : null;
        },

        // NPC Building Sale System
        getNPCBuildingSaleOffers(townId) { return getNPCBuildingSaleOffers(townId); },
        getBuildingValue(bld) { return getBuildingValue(bld); },
        buyNPCBuilding(buildingIndex, townId) { return buyNPCBuilding(buildingIndex, townId); },
        getAlliances() {
            if (!world) return {};
            const alliances = {};
            for (const k of world.kingdoms) {
                if (k.alliances && k.alliances.size > 0) {
                    alliances[k.id] = { name: k.name, allies: [...k.alliances] };
                }
            }
            return alliances;
        },
        hasEmbargo(k1Id, k2Id) { return hasEmbargo(k1Id, k2Id); },
        hasSpecialLaw(kingdom, lawId) { return hasSpecialLaw(kingdom, lawId); },
        declareWar(a, b) { return declareWar(a, b); },
        makePeace(a, b, isSurrender, loser) { return makePeace(a, b, isSurrender, loser); },
        tickTravelDemand() { tickTravelDemand(); },
        tickNPCTransport() { tickNPCTransport(); },

        // Territory Transfer & Conquest API
        transferTown(townId, fromKingdomId, toKingdomId, method) { return transferTown(townId, fromKingdomId, toKingdomId, method); },
        applyConquestDecision(town, kingdom) { return applyConquestDecision(town, kingdom); },
        grantCitizenship(town, kingdom) { return grantCitizenship(town, kingdom); },
        imposeServitude(town, kingdom) { return imposeServitude(town, kingdom); },
        raidTown(town, kingdom) { return raidTown(town, kingdom); },
        evaluatePeaceTerms(loser, winner) { return evaluatePeaceTerms(loser, winner); },

        // God Mode API — expose elite merchants and NPC caravans
        getEliteMerchants() { return world ? (world.eliteMerchants || []) : []; },
        getNpcCaravans() { return world ? (world.npcCaravans || []) : []; },

        // God Mode helpers — operate on real kingdoms by ID (bypass gameplay costs)
        godDeclareWar(k1Id, k2Id) {
            const k1 = findKingdom(k1Id);
            const k2 = findKingdom(k2Id);
            if (k1 && k2) {
                k1.atWar.add(k2.id);
                k2.atWar.add(k1.id);
            }
        },
        godMakePeace(k1Id, k2Id) {
            const k1 = findKingdom(k1Id);
            const k2 = findKingdom(k2Id);
            if (k1) k1.atWar.delete(k2Id);
            if (k2) k2.atWar.delete(k1Id);
        },
        godMakeWorldWar() {
            if (!world) return;
            for (const k1 of world.kingdoms) {
                for (const k2 of world.kingdoms) {
                    if (k1.id !== k2.id) k1.atWar.add(k2.id);
                }
            }
        },
        godMakeWorldPeace() {
            if (!world) return;
            for (const k of world.kingdoms) {
                k.atWar.clear();
            }
        },
        godAddKingdomGold(kingdomId, amount) {
            const k = findKingdom(kingdomId);
            if (k) k.gold = (k.gold || 0) + amount;
        },
        godSetKingdomTax(kingdomId, rate) {
            const k = findKingdom(kingdomId);
            if (k) k.taxRate = rate;
        },

        // Leaderboard & Net Worth API
        calculateNetWorth(entity) { return calculateNetWorth(entity); },
        getLeaderboard() { return getLeaderboard(); },
        getHighestRank(socialRank) { return getHighestRank(socialRank); },
        ensureEliteMerchantFields(em) { ensureEliteMerchantFields(em); },
        getFrontlineTowns(war) { return getFrontlineTowns(war); },

        // Kingdom Procurement API
        getKingdomOrders(kingdomId) {
            if (!world) return [];
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return [];
            return k.procurement.orders;
        },
        getKingdomNeeds(kingdomId) {
            if (!world) return {};
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return {};
            return k.procurement.needs;
        },
        getKingdomProcurement(kingdomId) {
            if (!world) return null;
            const k = findKingdom(kingdomId);
            return k ? k.procurement : null;
        },
        bidOnKingdomOrder(kingdomId, orderId, bid) {
            if (!world) return { success: false, reason: 'No world' };
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return { success: false, reason: 'Kingdom not found' };
            const order = k.procurement.orders.find(o => o.id === orderId);
            if (!order) return { success: false, reason: 'Order not found' };
            if (order.status !== 'open') return { success: false, reason: 'Order not open for bids' };
            if (bid.pricePerUnit > order.maxPricePerUnit) return { success: false, reason: 'Price exceeds maximum' };
            order.bids.push(bid);
            return { success: true };
        },
        deliverKingdomOrder(kingdomId, orderId, merchantId, qty) {
            if (!world) return { success: false, reason: 'No world' };
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return { success: false, reason: 'Kingdom not found' };
            const order = k.procurement.orders.find(o => o.id === orderId);
            if (!order) return { success: false, reason: 'Order not found' };
            if (order.status !== 'assigned') return { success: false, reason: 'Order not assigned' };
            if (order.assignedTo !== merchantId) return { success: false, reason: 'Order not assigned to you' };
            const remaining = order.qty - order.qtyDelivered;
            const deliverQty = Math.min(qty, remaining);
            if (deliverQty <= 0) return { success: false, reason: 'Nothing to deliver' };
            order.qtyDelivered += deliverQty;
            const payment = deliverQty * order.assignedPrice;
            // Add to military stockpile if applicable
            if (k.militaryStockpile && k.militaryStockpile.hasOwnProperty(order.resourceId)) {
                k.militaryStockpile[order.resourceId] = (k.militaryStockpile[order.resourceId] || 0) + deliverQty;
            }
            k.gold -= payment;
            const completed = order.qtyDelivered >= order.qty;
            if (completed) {
                order.status = 'completed';
                const pref = k.procurement.preferredMerchants[merchantId] || { reliability: 50, completedOrders: 0, failedOrders: 0 };
                pref.reliability = Math.min(100, pref.reliability + 10);
                pref.completedOrders = (pref.completedOrders || 0) + 1;
                k.procurement.preferredMerchants[merchantId] = pref;
            }
            return { success: true, payment: payment, completed: completed, bonus: completed ? order.bonusOnCompletion : 0, qtyDelivered: deliverQty };
        },
        addKingdomSupplyDeal(kingdomId, deal) {
            if (!world) return false;
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return false;
            k.procurement.deals.push(deal);
            return true;
        },
        cancelKingdomSupplyDeal(kingdomId, dealId) {
            if (!world) return false;
            const k = findKingdom(kingdomId);
            if (!k || !k.procurement) return false;
            const deal = k.procurement.deals.find(d => d.id === dealId);
            if (deal) deal.status = 'cancelled';
            return !!deal;
        },

        // King Mood, Succession Crisis, Royal Commissions API
        getKingMood: function(kingdomId) { var k = findKingdom(kingdomId); return k ? (k.kingMood || { current: 'content', since: 0 }) : null; },
        getKingActionLog: function(kingdomId) { var k = findKingdom(kingdomId); return k ? (k.kingActionLog || []) : []; },
        getSuccessionCrisis: function(kingdomId) { var k = findKingdom(kingdomId); return k ? k.successionCrisis : null; },
        getRoyalCommissions: function(kingdomId) { var k = findKingdom(kingdomId); return k ? (k.royalCommissions || []) : []; },
        fulfillRoyalCommission: function(kingdomId, commissionId, playerId) {
            var k = findKingdom(kingdomId);
            if (!k || !k.royalCommissions) return { success: false, reason: 'Kingdom not found' };
            var comm = k.royalCommissions.find(function(c) { return c.id === commissionId && c.status === 'open'; });
            if (!comm) return { success: false, reason: 'Commission not found or already fulfilled' };
            comm.status = 'fulfilled';
            comm.fulfilledBy = playerId || 'player';
            logKingAction(k, '✅ Commission fulfilled: ' + comm.description);
            return { success: true, reward: comm.reward, repReward: comm.repReward };
        },
        backPretender: function(kingdomId, pretenderId, goldAmount) {
            var k = findKingdom(kingdomId);
            if (!k || !k.successionCrisis || !k.successionCrisis.active) return { success: false, reason: 'No active crisis' };
            var pretender = k.successionCrisis.pretenders.find(function(p) { return p.id === pretenderId; });
            if (!pretender) return { success: false, reason: 'Pretender not found' };
            pretender.support += Math.floor(goldAmount / 100);
            k.successionCrisis.playerBacking = pretenderId;
            k.successionCrisis.playerInvested = (k.successionCrisis.playerInvested || 0) + goldAmount;
            logEvent('💰 You back ' + pretender.name + ' with ' + goldAmount + 'g for the throne of ' + k.name + '.');
            return { success: true, newSupport: pretender.support };
        },
        applyPriceControls: applyPriceControls,
        setKingMood: setKingMood,

        // Bridge & Road management
        destroyBridge(idx) { return destroyBridge(idx); },
        rebuildBridge(idx) { return rebuildBridge(idx); },
        buildNewRoad(from, to, by, opts) { return buildNewRoad(from, to, by, opts); },
        buildNewSeaRoute(from, to, by, opts) { return buildNewSeaRoute(from, to, by, opts); },
        collectTolls() { collectTolls(); },
        checkWaterFraction(x1, y1, x2, y2) { return checkWaterPath(x1, y1, x2, y2); },
        getDominantTerrain(ax, ay, bx, by) { return getDominantTerrain(ax, ay, bx, by); },
        findArmyRoute(from, to) { return findArmyRoute(from, to); },
        computeRoadImportance(tA, tB) { return computeRoadImportance(tA, tB); },
        getArmyWorldPosition(army) { return getArmyWorldPosition(army); },

        getMarketPrice(townId, resourceId) {
            const town = findTown(townId);
            return town ? getMarketPrice(town, resourceId) : 0;
        },
        collectTradeTax(kingdomId, amount) { collectTradeTax(kingdomId, amount); },
        computeMilitaryStrength(id) {
            if (!world) return 0;
            const k = findKingdom(id);
            return k ? computeMilitaryStrength(k) : 0;
        },
        getMilitaryBreakdown(kingdomId) {
            if (!world) return null;
            const k = findKingdom(kingdomId);
            if (!k) return null;
            const soldiers = world.people.filter(p =>
                p.alive && p.kingdomId === k.id && (p.occupation === 'soldier' || p.occupation === 'guard')
            );
            let totalInf = 0, totalArch = 0, totalCav = 0, totalGarrison = 0;
            for (const townId of k.territories) {
                const town = findTown(townId);
                if (!town) continue;
                const swords = town.market.supply.swords || 0;
                const armor = town.market.supply.armor || 0;
                const bows = town.market.supply.bows || 0;
                const arrows = town.market.supply.arrows || 0;
                const horses = town.market.supply.horses || 0;
                const saddles = town.market.supply.saddles || 0;
                var cavCount = Math.min(horses, saddles, Math.floor(swords * 0.3));
                totalCav += cavCount;
                totalArch += Math.min(bows, Math.floor(arrows / 5));
                totalInf += Math.max(0, Math.min(swords - cavCount, armor));
                totalGarrison += (town.garrison || 0);
            }
            return { strength: computeMilitaryStrength(k), infantry: totalInf, archers: totalArch, cavalry: totalCav, soldiers: soldiers.length, garrison: totalGarrison, total: soldiers.length };
        },

        // Town category system
        getTownCategory(pop) { return getTownCategory(pop); },
        isPortBlockaded(townId) { return isPortBlockaded(townId); },
        getNavalThreat(fromId, toId) { return getNavalThreat(fromId, toId); },

        // Outpost system
        foundOutpost(opts) { return foundOutpost(opts); },
        getOutposts() { return world ? world.towns.filter(function(t) { return t.isOutpost && !t.abandoned && !t.destroyed; }) : []; },

        // Royal advisor / succession
        updateRoyalAdvisors(kingdomId) {
            if (!world) return;
            const k = findKingdom(kingdomId);
            if (k) updateRoyalAdvisors(k);
        },
        installNewKing(kingdomId, personId) {
            if (!world) return;
            const k = findKingdom(kingdomId);
            const p = findPerson(personId);
            if (k && p) installNewKing(k, p, 'player_crowned');
        },

        // ---- Worker Economy API ----

        getAvailableWorkers(townId) {
            return getAvailableWorkers(townId);
        },

        getWorkerHireCost(personId) {
            return getWorkerHireCost(personId);
        },

        getWorkerSkillTier(skill) {
            return getWorkerSkillTier(skill);
        },

        sendWorkerToTraining(personId, destinationTownId) {
            if (!world) return { success: false, reason: 'No world' };
            const p = findPerson(personId);
            if (!p || !p.alive) return { success: false, reason: 'Worker not found' };
            if (p.trainingUntilDay) return { success: false, reason: 'Already in training' };

            const destTown = findTown(destinationTownId);
            if (!destTown) return { success: false, reason: 'Town not found' };

            // Check destination has relevant building
            const hasTrainingBuilding = destTown.buildings.some(b =>
                ['blacksmith', 'armorer', 'fletcher', 'arrow_maker', 'instrument_workshop', 'toolsmith'].includes(b.type)
            );
            if (!hasTrainingBuilding) return { success: false, reason: 'No training building in destination' };

            const cost = CONFIG.WORKER_TRAINING_COST;
            p.trainingUntilDay = world.day + CONFIG.WORKER_TRAINING_DAYS;
            removeWorkerFromBuilding(p);
            logEvent(`${p.firstName} ${p.lastName} sent to training in ${destTown.name}.`);
            return { success: true, cost, returnDay: p.trainingUntilDay };
        },

        poachWorker(personId, fromBuildingOwnerId) {
            if (!world) return { success: false, reason: 'No world' };
            const p = findPerson(personId);
            if (!p || !p.alive) return { success: false, reason: 'Worker not found' };
            if (!p.employerId) return { success: false, reason: 'Worker is not employed' };

            const tier = getWorkerSkillTier(p.workerSkill || 0);
            const currentWage = p.currentWage || CONFIG.WORKER_WEEKLY_WAGES[tier] || 2;
            const signingBonus = currentWage * 2;

            // Success based on offer vs current pay
            const baseSuccess = 0.4;
            const successChance = Math.min(0.9, baseSuccess + 0.1);

            if (world.rng.chance(successChance)) {
                // Relationship hit with the NPC being poached from
                const oldEmployer = findPerson(fromBuildingOwnerId);
                if (oldEmployer && oldEmployer.personality) {
                    // Store relationship penalty for player.js to read
                    p._poachRelationshipHit = { npcId: fromBuildingOwnerId, amount: -15 };
                }
                removeWorkerFromBuilding(p);
                p.employerId = null; // player will assign
                return { success: true, signingBonus };
            }
            return { success: false, reason: 'Worker declined offer' };
        },

        respondToWageDemand(personId, accept) {
            if (!world) return;
            const p = findPerson(personId);
            if (!p || !p.wageDemand) return;
            if (accept) {
                p.currentWage = p.wageDemand.amount;
                delete p.wageDemand;
                p._nextWageDemandDay = world.day + world.rng.randInt(CONFIG.WORKER_WAGE_DEMAND_MIN_INTERVAL, CONFIG.WORKER_WAGE_DEMAND_MAX_INTERVAL);
            } else {
                // Refuse: 50% leave, 30% stay unhappy, 20% accept
                const roll = world.rng.random();
                if (roll < 0.50) {
                    removeWorkerFromBuilding(p);
                    p.employerId = null;
                    logEvent(`${p.firstName} ${p.lastName} quit after wage refusal.`);
                } else if (roll < 0.80) {
                    p.unhappyUntilDay = world.day + 30;
                }
                delete p.wageDemand;
                p._nextWageDemandDay = world.day + world.rng.randInt(CONFIG.WORKER_WAGE_DEMAND_MIN_INTERVAL, CONFIG.WORKER_WAGE_DEMAND_MAX_INTERVAL);
            }
        },

        respondToPoachAttempt(personId, accept) {
            if (!world) return;
            const p = findPerson(personId);
            if (!p || !p.poachAttempt) return;
            if (!accept) {
                delete p.poachAttempt;
                return;
            }
            // Worker leaves for the poacher
            removeWorkerFromBuilding(p);
            p.employerId = p.poachAttempt.by;
            p.currentWage = p.poachAttempt.offerWage;
            delete p.poachAttempt;
        },

        installBuildingUpgrade(townId, buildingIndex, upgradeId) {
            if (!world) return { success: false, reason: 'No world' };
            const town = findTown(townId);
            if (!town) return { success: false, reason: 'Town not found' };
            const bld = town.buildings[buildingIndex];
            if (!bld) return { success: false, reason: 'Building not found' };
            const upgrade = CONFIG.WORKSHOP_UPGRADES[upgradeId];
            if (!upgrade) return { success: false, reason: 'Unknown upgrade' };
            if (!bld.upgrades) bld.upgrades = [];
            if (bld.upgrades.includes(upgradeId)) return { success: false, reason: 'Already installed' };

            // Check materials
            for (const [matId, qty] of Object.entries(upgrade.materials)) {
                if ((town.market.supply[matId] || 0) < qty) {
                    return { success: false, reason: 'Insufficient materials' };
                }
            }
            // Consume materials
            for (const [matId, qty] of Object.entries(upgrade.materials)) {
                town.market.supply[matId] -= qty;
            }
            bld.upgrades.push(upgradeId);
            logEvent(`${upgrade.name} installed!`);
            return { success: true, cost: upgrade.cost };
        },

        setProductionTier(townId, buildingIndex, tier) {
            if (!world) return;
            const town = findTown(townId);
            if (!town) return;
            const bld = town.buildings[buildingIndex];
            if (bld) bld.productionTier = tier || 'basic';
        },

        setProductionChoice(townId, buildingIndex, choice) {
            if (!world) return;
            const town = findTown(townId);
            if (!town) return;
            const bld = town.buildings[buildingIndex];
            if (bld) bld.productionChoice = choice || null;
        },

        setApprenticePair(townId, buildingIndex, masterWorkerId, apprenticeWorkerId) {
            if (!world) return { success: false };
            const town = findTown(townId);
            if (!town) return { success: false };
            const bld = town.buildings[buildingIndex];
            if (!bld) return { success: false };
            if (!bld.apprenticePairs) bld.apprenticePairs = [];
            // Prevent duplicates
            const alreadyPaired = bld.apprenticePairs.some(
                pair => pair.masterWorkerId === masterWorkerId || pair.apprenticeWorkerId === apprenticeWorkerId
            );
            if (alreadyPaired) return { success: false, reason: 'Already paired' };
            bld.apprenticePairs.push({ masterWorkerId, apprenticeWorkerId });
            return { success: true };
        },

        removeApprenticePair(townId, buildingIndex, apprenticeWorkerId) {
            if (!world) return;
            const town = findTown(townId);
            if (!town) return;
            const bld = town.buildings[buildingIndex];
            if (bld && bld.apprenticePairs) {
                bld.apprenticePairs = bld.apprenticePairs.filter(
                    pair => pair.apprenticeWorkerId !== apprenticeWorkerId
                );
            }
        },

        getEmployerReputation(townId, ownerId) {
            if (!world) return 0;
            const town = findTown(townId);
            if (!town || !town.employerReputation) return 0;
            return town.employerReputation[ownerId] || 0;
        },

        setFarmFallow(townId, buildingId, fallow) {
            if (!world) return { success: false };
            const town = findTown(townId);
            if (!town) return { success: false, reason: 'Town not found' };
            const bld = town.buildings.find(b => b.id === buildingId || b.type === buildingId);
            if (!bld) return { success: false, reason: 'Building not found' };
            const bt = findBuildingType(bld.type);
            if (!bt || bt.category !== 'farm') return { success: false, reason: 'Not a farm' };
            bld.fallow = !!fallow;
            return { success: true, fallow: bld.fallow };
        },

        getTownFoodTrends(townId) {
            return getTownFoodTrends(townId);
        },

        getCurrentTrends() {
            if (!world || !world.fashionTrends) return [];
            return world.fashionTrends.filter(t => t.active).map(t => {
                const resInfo = findResourceById(t.goodId);
                const originK = findKingdom(t.originKingdomId);
                const daysLeft = Math.max(0, t.duration - (world.day - t.startDay));
                return {
                    good: resInfo ? resInfo.name : t.goodId,
                    goodId: t.goodId,
                    icon: resInfo ? resInfo.icon : '?',
                    origin: originK ? originK.name : 'Unknown',
                    originKingdomId: t.originKingdomId,
                    spreadTo: t.spreadTo.map(id => { const k = findKingdom(id); return k ? k.name : id; }),
                    demandBonus: Math.round(t.demandBonus * 100),
                    daysRemaining: daysLeft,
                    fading: world.day - t.startDay > t.duration,
                };
            });
        },

        getTownDeposits(townId) {
            if (!world) return null;
            const town = findTown(townId);
            if (!town || !town.naturalDeposits) return null;
            const result = {};
            for (const [resId, amount] of Object.entries(town.naturalDeposits)) {
                const cfg = CONFIG.NATURAL_DEPOSITS[resId];
                result[resId] = {
                    current: amount,
                    max: cfg ? cfg.max : amount,
                    pct: cfg ? Math.round((amount / cfg.max) * 100) : 100,
                    renewable: cfg ? cfg.renewable : false,
                };
            }
            return result;
        },

        getSeasonalDemandInfo(resourceId) {
            const season = world ? getSeason(world.day) : 'Spring';
            const mods = CONFIG.SEASONAL_DEMAND[season] || {};
            return mods[resourceId] || 1.0;
        },

        /**
         * Serialize the entire world state to a plain object for save/load.
         */
        serialize() {
            if (!world) return null;
            // Convert terrain Uint8Array to base64 for compact storage
            let terrainB64 = '';
            if (world.terrain) {
                const bytes = new Uint8Array(world.terrain);
                const CHUNK = 8192;
                const parts = [];
                for (let i = 0; i < bytes.length; i += CHUNK) {
                    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK)));
                }
                terrainB64 = btoa(parts.join(''));
            }

            // Convert Sets to arrays for kingdoms
            const kingdomsSerialized = world.kingdoms.map(k => ({
                ...k,
                atWar: [...k.atWar],
                alliances: [...(k.alliances || [])],
                territories: [...k.territories],
                royalAdvisors: k.royalAdvisors || [],
                navalFleet: JSON.parse(JSON.stringify(k.navalFleet || [])),
                embargoes: k.embargoes || [],
                _bankruptDays: k._bankruptDays || 0,
                _bankruptWarned: k._bankruptWarned || false,
                _lastPropertyTaxDay: k._lastPropertyTaxDay || 0,
                _lastIncomeTaxDay: k._lastIncomeTaxDay || 0,
                _lastFinancialStrategyDay: k._lastFinancialStrategyDay || 0,
                _financialActions: k._financialActions || [],
                _currencyDebased: k._currencyDebased || false,
                _debasementInflation: k._debasementInflation || 0,
                _collapseTriggered: k._collapseTriggered || false,
                _lastSeasonTaxRevenue: k._lastSeasonTaxRevenue || 0,
                _happinessTier: k._happinessTier || 'neutral',
                propertyTaxRate: k.propertyTaxRate || 0.02,
                incomeTaxRate: k.incomeTaxRate || 0.05,
                tradeTaxRevenue: k.tradeTaxRevenue || 0,
                propertyTaxRevenue: k.propertyTaxRevenue || 0,
                incomeTaxRevenue: k.incomeTaxRevenue || 0,
                // Economic strategy fields
                landSubsidies: k.landSubsidies || [],
                productionBounties: k.productionBounties || [],
                tradeSubsidies: k.tradeSubsidies || [],
                taxHolidays: k.taxHolidays || [],
                immigrationIncentives: k.immigrationIncentives || [],
                productionQuotas: k.productionQuotas || [],
                exportRestrictions: k.exportRestrictions || [],
                lastTaxIncreaseDay: k.lastTaxIncreaseDay || 0,
                tournament: k.tournament || null,
                kingMood: k.kingMood || { current: 'content', since: 0, reason: '' },
                kingActionLog: (k.kingActionLog || []).slice(-50),
                successionCrisis: k.successionCrisis || null,
                royalCommissions: k.royalCommissions || [],
                immigrationPolicy: k.immigrationPolicy || 'open',
                laws: k.laws ? {
                    ...k.laws,
                    bannedGoods: [...(k.laws.bannedGoods || [])],
                    goodsTaxes: k.laws.goodsTaxes ? { ...k.laws.goodsTaxes } : {},
                    restrictedGoods: [...(k.laws.restrictedGoods || [])],
                    specialLaws: k.laws.specialLaws || [],
                } : { bannedGoods: [], tradeTariff: 0.05, conscription: false, guildRestrictions: false, goodsTaxes: {}, restrictedGoods: [], specialLaws: [] },
            }));

            return {
                seed: world.seed,
                day: world.day,
                hour: world.hour || 0,
                terrainB64,
                gridCols: world.gridCols,
                gridRows: world.gridRows,
                kingdoms: kingdomsSerialized,
                towns: world.towns,
                roads: world.roads,
                seaRoutes: world.seaRoutes,
                people: world.people.filter(function(p) {
                    if (p.alive) return true;
                    // Keep dead player children, elite merchants, and their heirs
                    if (p.id && p.id.startsWith('p_child_')) return true;
                    if (p.isEliteMerchant && (p.alive || (world.day - (p._deathDay || 0)) < 120)) return true;
                    return false;
                }),
                events: world.events,
                eventLog: world.eventLog.slice(-100),
                armies: world.armies,
                activeWars: world.activeWars || {},
                treaties: world.treaties || [],
                fashionTrends: world.fashionTrends || [],
                npcCaravans: world.npcCaravans || [],
                _nextId,
            };
        },

        /**
         * Restore world state from a serialized object.
         */
        deserialize(data) {
            if (!data) return;
            world = defaultWorld();
            world.seed = data.seed || 42;
            world.day = data.day || 1;
            world.hour = data.hour || 0;
            world.rng = createRNG(world.seed);
            // Advance RNG to current state (approximate — re-seed is good enough)
            for (let i = 0; i < world.day; i++) world.rng.random();

            // Restore terrain from base64
            if (data.terrainB64) {
                const binary = atob(data.terrainB64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                world.terrain = bytes;
            }
            world.gridCols = data.gridCols;
            world.gridRows = data.gridRows;

            // Restore kingdoms (convert arrays back to Sets)
            world.kingdoms = (data.kingdoms || []).map(k => ({
                ...k,
                atWar: new Set(k.atWar || []),
                alliances: new Set(k.alliances || []),
                territories: new Set(k.territories || []),
                royalAdvisors: k.royalAdvisors || [],
                navalFleet: k.navalFleet || [],
                embargoes: k.embargoes || [],
                _bankruptDays: k._bankruptDays || 0,
                _bankruptWarned: k._bankruptWarned || false,
                _lastPropertyTaxDay: k._lastPropertyTaxDay || 0,
                _lastIncomeTaxDay: k._lastIncomeTaxDay || 0,
                _lastFinancialStrategyDay: k._lastFinancialStrategyDay || 0,
                _financialActions: k._financialActions || [],
                _currencyDebased: k._currencyDebased || false,
                _debasementInflation: k._debasementInflation || 0,
                _collapseTriggered: k._collapseTriggered || false,
                _lastSeasonTaxRevenue: k._lastSeasonTaxRevenue || 0,
                _happinessTier: k._happinessTier || 'neutral',
                propertyTaxRate: k.propertyTaxRate || CONFIG.KINGDOM_DEFAULT_PROPERTY_TAX_RATE || 0.02,
                incomeTaxRate: k.incomeTaxRate || CONFIG.KINGDOM_DEFAULT_INCOME_TAX_RATE || 0.05,
                tradeTaxRevenue: k.tradeTaxRevenue || 0,
                propertyTaxRevenue: k.propertyTaxRevenue || 0,
                incomeTaxRevenue: k.incomeTaxRevenue || 0,
                // Economic strategy fields (backward compat defaults)
                landSubsidies: k.landSubsidies || [],
                productionBounties: k.productionBounties || [],
                tradeSubsidies: k.tradeSubsidies || [],
                taxHolidays: k.taxHolidays || [],
                immigrationIncentives: k.immigrationIncentives || [],
                productionQuotas: k.productionQuotas || [],
                exportRestrictions: k.exportRestrictions || [],
                lastTaxIncreaseDay: k.lastTaxIncreaseDay || 0,
                tournament: k.tournament || null,
                laws: k.laws ? {
                    ...k.laws,
                    bannedGoods: k.laws.bannedGoods || [],
                    goodsTaxes: k.laws.goodsTaxes || {},
                    restrictedGoods: k.laws.restrictedGoods || [],
                } : { bannedGoods: [], tradeTariff: 0.05, conscription: false, guildRestrictions: false, goodsTaxes: {}, restrictedGoods: [], specialLaws: [] },
                taxRevenue: k.taxRevenue || 0,
                guardBudget: k.guardBudget || 0.15,
                happiness: k.happiness != null ? k.happiness : 50,
                peaceTreaties: k.peaceTreaties || {},
                kingPersonality: k.kingPersonality ? {
                    ...k.kingPersonality,
                    intelligence: k.kingPersonality.intelligence || 'average',
                    temperament: k.kingPersonality.temperament || 'fair',
                    ambition: k.kingPersonality.ambition || 'content',
                    greed: k.kingPersonality.greed || 'fair',
                    courage: k.kingPersonality.courage || 'cautious',
                } : k.kingPersonality,
                procurement: k.procurement || { orders: [], deals: [], needs: {}, preferredMerchants: {}, lastAssessmentDay: 0 },
                kingMood: k.kingMood || { current: 'content', since: 0, reason: '' },
                kingActionLog: k.kingActionLog || [],
                successionCrisis: k.successionCrisis || null,
                royalCommissions: k.royalCommissions || [],
                immigrationPolicy: k.immigrationPolicy || 'open',
                nationalizedIndustries: k.nationalizedIndustries || [],
                militaryStockpile: k.militaryStockpile || { swords: 0, armor: 0, bows: 0, arrows: 0, horses: 0 },
            }));

            world.towns = data.towns || [];
            // Restore town categories and new properties
            for (const town of world.towns) {
                if (!town.category) {
                    town.category = getTownCategory(town.population);
                    town.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[town.category].maxBuildingSlots;
                }
                if (!town.employerReputation) town.employerReputation = {};
                // Resource depletion defaults
                if (!town.naturalDeposits) {
                    town.naturalDeposits = {};
                    const ND = CONFIG.NATURAL_DEPOSITS;
                    town.naturalDeposits.clay = Math.floor((ND.clay.min + ND.clay.max) / 2);
                }
                if (town.soilFertility == null) town.soilFertility = 1.0;
                if (!town.travelDemand) town.travelDemand = [];
                if (!town.npcTransportServices) town.npcTransportServices = [];
                // Frontline & migration defaults (backward compat)
                if (town.isFrontline === undefined) town.isFrontline = false;
                if (!town.migrationLog) town.migrationLog = [];
                if (town.crime === undefined) town.crime = 0;
                // Terrain classification migration (backward compat)
                if (!town.terrainType) {
                    town.terrainType = classifyTownTerrain(town);
                }
                if (!town.localBasePrice) {
                    computeLocalBasePrices(town);
                }
                // Ensure new resource types exist in market (backward compat)
                for (var rtk in RESOURCE_TYPES) {
                    var rid = RESOURCE_TYPES[rtk].id;
                    if (town.market && town.market.supply && town.market.supply[rid] === undefined) {
                        town.market.supply[rid] = 0;
                        town.market.demand[rid] = 0;
                        town.market.prices[rid] = RESOURCE_TYPES[rtk].basePrice;
                    }
                }
                for (const bld of town.buildings) {
                    if (bld.productionTier === undefined) bld.productionTier = null;
                    if (bld.upgrades === undefined) bld.upgrades = [];
                    if (bld.apprenticePairs === undefined) bld.apprenticePairs = [];
                    if (bld.productionChoice === undefined) bld.productionChoice = null;
                    if (bld.depositDepleted === undefined) bld.depositDepleted = false;
                    if (bld.fallow === undefined) bld.fallow = false;
                    if (bld.breedProgress === undefined) bld.breedProgress = 0;
                    if (bld.securityUpgrades === undefined) bld.securityUpgrades = [];
                }
            }
            world.roads = data.roads || [];
            world.seaRoutes = data.seaRoutes || [];

            // Fixup: connect any port towns that have no sea routes
            var portTowns = world.towns.filter(function(t) { return t.isPort; });
            var connectedSea = new Set();
            for (var srf = 0; srf < world.seaRoutes.length; srf++) {
                connectedSea.add(world.seaRoutes[srf].fromTownId);
                connectedSea.add(world.seaRoutes[srf].toTownId);
            }
            for (var pf = 0; pf < portTowns.length; pf++) {
                var port = portTowns[pf];
                if (connectedSea.has(port.id)) continue;
                // Find nearest connected port
                var nearestPort = null;
                var nearDist = Infinity;
                for (var np = 0; np < portTowns.length; np++) {
                    if (portTowns[np].id === port.id) continue;
                    if (!connectedSea.has(portTowns[np].id) && portTowns.some(function(op) { return connectedSea.has(op.id); })) {
                        // Prefer connected ports
                        if (!connectedSea.has(portTowns[np].id)) continue;
                    }
                    var d = Math.hypot(portTowns[np].x - port.x, portTowns[np].y - port.y);
                    if (d < nearDist) { nearDist = d; nearestPort = portTowns[np]; }
                }
                if (nearestPort) {
                    world.seaRoutes.push({
                        fromTownId: port.id,
                        toTownId: nearestPort.id,
                        type: 'sea',
                        distance: nearDist,
                        safe: true,
                        waypoints: []
                    });
                    connectedSea.add(port.id);
                }
            }

            // Rebuild town connectivity for price convergence (backward compat)
            for (var ci = 0; ci < world.towns.length; ci++) {
                world.towns[ci].connectedTowns = [];
            }

            // Post-load road fixup: use BFS to find disconnected towns and connect them to the main network
            // Step 1: Build adjacency from active roads + sea routes
            var _fixAdj = {};
            for (var _fi = 0; _fi < world.towns.length; _fi++) {
                var _ft = world.towns[_fi];
                if (!_ft.destroyed && !_ft.abandoned) _fixAdj[_ft.id] = [];
            }
            for (var _ri = 0; _ri < world.roads.length; _ri++) {
                var _fr = world.roads[_ri];
                if (_fr.condition === 'destroyed' || (_fr.hasBridge && _fr.bridgeDestroyed)) continue;
                if (_fixAdj[_fr.fromTownId]) _fixAdj[_fr.fromTownId].push(_fr.toTownId);
                if (_fixAdj[_fr.toTownId]) _fixAdj[_fr.toTownId].push(_fr.fromTownId);
            }
            for (var _si = 0; _si < (world.seaRoutes || []).length; _si++) {
                var _sr = world.seaRoutes[_si];
                var _sfrom = _sr.fromTownId || _sr.from;
                var _sto = _sr.toTownId || _sr.to;
                if (_fixAdj[_sfrom]) _fixAdj[_sfrom].push(_sto);
                if (_fixAdj[_sto]) _fixAdj[_sto].push(_sfrom);
            }
            // Step 2: BFS from first non-destroyed town to find the main connected component
            var _visited = {};
            var _queue = [];
            var _mainComponent = new Set();
            // Start from the first capital or first town with roads
            var _startTown = world.towns.find(function(t) { return t.isCapital && !t.destroyed && !t.abandoned; }) || world.towns[0];
            if (_startTown && _fixAdj[_startTown.id]) {
                _queue.push(_startTown.id);
                _visited[_startTown.id] = true;
                while (_queue.length > 0) {
                    var _cur = _queue.shift();
                    _mainComponent.add(_cur);
                    var _neighbors = _fixAdj[_cur] || [];
                    for (var _ni = 0; _ni < _neighbors.length; _ni++) {
                        if (!_visited[_neighbors[_ni]]) {
                            _visited[_neighbors[_ni]] = true;
                            _queue.push(_neighbors[_ni]);
                        }
                    }
                }
            }
            // Step 3: Connect disconnected towns to the main component
            var _mainTowns = world.towns.filter(function(t) { return _mainComponent.has(t.id); });
            for (var rfi = 0; rfi < world.towns.length; rfi++) {
                var fixTown = world.towns[rfi];
                if (fixTown.destroyed || fixTown.abandoned || fixTown.isIsland) continue;
                if (_mainComponent.has(fixTown.id)) continue;
                // Find nearest town in the main component
                var nearestForRoad = null;
                var nearestRoadDist = Infinity;
                for (var rfj = 0; rfj < _mainTowns.length; rfj++) {
                    var cand = _mainTowns[rfj];
                    var rdx = (cand.x || 0) - (fixTown.x || 0);
                    var rdy = (cand.y || 0) - (fixTown.y || 0);
                    var rdist = Math.sqrt(rdx * rdx + rdy * rdy);
                    if (rdist < nearestRoadDist) {
                        nearestRoadDist = rdist;
                        nearestForRoad = cand;
                    }
                }
                if (nearestForRoad && nearestRoadDist < 5000) {
                    // Remove destroyed road between them if exists
                    for (var rk = world.roads.length - 1; rk >= 0; rk--) {
                        var oldR = world.roads[rk];
                        if (((oldR.fromTownId === fixTown.id && oldR.toTownId === nearestForRoad.id) ||
                             (oldR.fromTownId === nearestForRoad.id && oldR.toTownId === fixTown.id)) &&
                            oldR.condition === 'destroyed') {
                            world.roads.splice(rk, 1);
                        }
                    }
                    world.roads.push({
                        fromTownId: fixTown.id,
                        toTownId: nearestForRoad.id,
                        quality: 1,
                        safe: true,
                        hasBridge: false,
                        bridgeDestroyed: false,
                        bridgeSegments: [],
                        condition: 'new',
                        builtDay: world.day || 0,
                        builtBy: null,
                        banditThreat: 0
                    });
                    // Add this town to main component so subsequent towns can connect to it
                    _mainComponent.add(fixTown.id);
                    _mainTowns.push(fixTown);
                }
            }
            for (var ri = 0; ri < world.roads.length; ri++) {
                var road = world.roads[ri];
                var fromTown = world.towns.find(function(t) { return t.id === road.fromTownId; });
                var toTown = world.towns.find(function(t) { return t.id === road.toTownId; });
                if (fromTown && toTown) {
                    if (fromTown.connectedTowns.indexOf(toTown.id) === -1) fromTown.connectedTowns.push(toTown.id);
                    if (toTown.connectedTowns.indexOf(fromTown.id) === -1) toTown.connectedTowns.push(fromTown.id);
                }
            }
            for (var si = 0; si < world.seaRoutes.length; si++) {
                var sr = world.seaRoutes[si];
                var fromPort = world.towns.find(function(t) { return t.id === sr.fromTownId; });
                var toPort = world.towns.find(function(t) { return t.id === sr.toTownId; });
                if (fromPort && toPort) {
                    if (fromPort.connectedTowns.indexOf(toPort.id) === -1) fromPort.connectedTowns.push(toPort.id);
                    if (toPort.connectedTowns.indexOf(fromPort.id) === -1) toPort.connectedTowns.push(fromPort.id);
                }
            }

            // Post-load town recovery: un-abandon towns that still have viable population
            for (var _tri = 0; _tri < world.towns.length; _tri++) {
                var _tt = world.towns[_tri];
                // Recover abandoned towns with pop >= 15 (old threshold was 20, now 8)
                if (_tt.abandoned && !_tt.destroyed && _tt.population >= 15) {
                    _tt.abandoned = false;
                    _tt.abandonedDay = null;
                    _tt._revitalizing = false;
                    _tt._revitalizeProgress = 0;
                    _tt.category = getTownCategory(_tt.population);
                    _tt.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[_tt.category] ? CONFIG.TOWN_CATEGORIES[_tt.category].maxBuildingSlots : 5;
                    // Restore buildings if all destroyed
                    var _hasActive = false;
                    for (var _bi = 0; _bi < (_tt.buildings || []).length; _bi++) {
                        if (_tt.buildings[_bi].condition !== 'destroyed') { _hasActive = true; break; }
                    }
                    if (!_hasActive) {
                        _tt.buildings = [
                            { type: 'wheat_farm', id: 'bld_rec_' + _tri + '_0', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] },
                            { type: 'bakery', id: 'bld_rec_' + _tri + '_1', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] },
                            { type: 'market_stall', id: 'bld_rec_' + _tri + '_2', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] }
                        ];
                    }
                }
                // Recover destroyed towns with pop >= 25 (shouldn't be destroyed with people)
                if (_tt.destroyed && _tt.population >= 25) {
                    _tt.destroyed = false;
                    _tt.abandoned = false;
                    _tt.abandonedDay = null;
                    _tt.category = getTownCategory(_tt.population);
                    _tt.maxBuildingSlots = CONFIG.TOWN_CATEGORIES[_tt.category] ? CONFIG.TOWN_CATEGORIES[_tt.category].maxBuildingSlots : 5;
                    _tt.buildings = [
                        { type: 'wheat_farm', id: 'bld_rec_' + _tri + '_0', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] },
                        { type: 'bakery', id: 'bld_rec_' + _tri + '_1', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] },
                        { type: 'market_stall', id: 'bld_rec_' + _tri + '_2', ownerId: null, condition: 'new', builtDay: world.day || 0, workers: [] }
                    ];
                    // Restore basic market
                    if (_tt.market && _tt.market.supply) {
                        _tt.market.supply.wheat = Math.max(_tt.market.supply.wheat || 0, 200);
                        _tt.market.supply.bread = Math.max(_tt.market.supply.bread || 0, 80);
                    }
                }
            }

            world.people = data.people || [];
            // Ensure person new properties have defaults
            for (const p of world.people) {
                if (p.workerSkill === undefined) p.workerSkill = 0;
                if (!p.foodPreferences) {
                    p.foodPreferences = {};
                    const foods = ['bread', 'meat', 'poultry', 'fish', 'eggs', 'preserved_food'];
                    for (const f of foods) p.foodPreferences[f] = 0.7 + Math.random() * 0.8;
                }
                if (!p.recentFoods) p.recentFoods = [];
                // Servitude defaults (backward compat)
                if (p.status === undefined) p.status = 'citizen';
                // Migration tracking defaults
                if (p._unemployedDays === undefined) p._unemployedDays = 0;
            }
            world.events = data.events || [];
            world.eventLog = data.eventLog || [];
            world.armies = data.armies || [];
            world.activeWars = data.activeWars || {};
            world.treaties = data.treaties || [];
            world.fashionTrends = data.fashionTrends || [];
            world.npcCaravans = data.npcCaravans || [];
            _nextId = data._nextId || world.people.length + world.towns.length + 1000;

            rebuildIndexes();

            // Initialize new elite merchant fields on loaded data (backward compat)
            for (const p of world.people) {
                if (p.isEliteMerchant && p.alive) ensureEliteMerchantFields(p);
            }

            // Rebuild world.eliteMerchants array (not saved, must reconstruct)
            world.eliteMerchants = world.people.filter(function(p) { return p.alive && p.isEliteMerchant; });

            // Backward compat: generate royal families for kings who lack them
            for (const k of world.kingdoms) {
                if (!k.king) continue;
                const kingPerson = findPerson(k.king);
                if (!kingPerson || !kingPerson.alive) continue;
                // King has no parentIds → old save, generate royal family
                if (!kingPerson.parentIds || kingPerson.parentIds.length === 0) {
                    const kTowns = world.towns.filter(function(t) { return t.kingdomId === k.id; });
                    generateRoyalFamily(world.rng, kingPerson, world.people, kTowns);
                }
            }

            // Rebuild alive population cache
            world._alivePopCount = world.people.filter(p => p.alive).length;
        },
    };

})();
