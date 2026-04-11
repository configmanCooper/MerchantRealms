// ============================================================
// Merchant Realms — WebAssembly Loader & Bridge
// Loads merchant_realms_wasm.wasm and exposes functions globally
// Falls back to JS implementations if WASM unavailable
// ============================================================

window.WASM = (function () {
    'use strict';

    var _instance = null;
    var _memory = null;
    var _ready = false;
    var _failed = false;

    // ── Public API (all functions check _ready and fall back to null) ──
    var api = {
        ready: function () { return _ready; },
        failed: function () { return _failed; },

        // ── RNG ──
        rngSeed: null,
        rngRandom: null,
        rngRandInt: null,
        rngChance: null,
        rngGetState: null,
        rngSetState: null,

        // ── Terrain Sampling ──
        checkWaterPath: null,
        getOffroadCost: null,
        getDominantTerrain: null,

        // ── Pathfinding ──
        dijkstra: null,

        // ── Monopoly ──
        countMonopolies: null,

        // ── Caravan ──
        caravanSubtick: null,

        // ── Terrain Rendering ──
        renderTerrainTiles: null,
        buildMinimapTerrain: null,

        // ── Memory helpers ──
        malloc: null,
        memory: function () { return _memory; }
    };

    // ── Simple bump allocator for passing data to WASM ──
    // WASM linear memory starts at 1 page (64KB). We use the area after
    // the module's static data for temporary allocations.
    var _allocOffset = 0;
    var _allocBase = 0; // set after module loads

    function _resetAlloc() {
        _allocOffset = _allocBase;
    }

    function _alloc(bytes) {
        // Align to 8 bytes
        _allocOffset = (_allocOffset + 7) & ~7;
        var ptr = _allocOffset;
        _allocOffset += bytes;
        // Grow memory if needed
        var needed = Math.ceil(_allocOffset / 65536);
        var current = _memory.buffer.byteLength / 65536;
        if (needed > current) {
            _memory.grow(needed - current);
        }
        return ptr;
    }

    function _writeF64Array(arr) {
        var ptr = _alloc(arr.length * 8);
        var view = new Float64Array(_memory.buffer, ptr, arr.length);
        view.set(arr);
        return ptr;
    }

    function _writeU8Array(arr) {
        var ptr = _alloc(arr.length);
        var view = new Uint8Array(_memory.buffer, ptr, arr.length);
        if (arr instanceof Uint8Array) {
            view.set(arr);
        } else {
            for (var i = 0; i < arr.length; i++) view[i] = arr[i];
        }
        return ptr;
    }

    function _readF64Array(ptr, len) {
        return new Float64Array(_memory.buffer, ptr, len);
    }

    // ── Initialize WASM module ──
    function _init() {
        // Determine wasm file path relative to current page
        var wasmPath = 'js/merchant_realms_wasm.wasm';

        // Try to load WASM
        if (typeof WebAssembly === 'undefined') {
            console.warn('[WASM] WebAssembly not supported in this browser — using JS fallback');
            _failed = true;
            return;
        }

        fetch(wasmPath)
            .then(function (response) {
                if (!response.ok) throw new Error('WASM fetch failed: ' + response.status);
                return response.arrayBuffer();
            })
            .then(function (bytes) {
                return WebAssembly.instantiate(bytes, {
                    env: {}
                });
            })
            .then(function (result) {
                _instance = result.instance;
                _memory = _instance.exports.memory;

                // Find where static data ends (use __data_end or __heap_base if exported)
                // Otherwise use a safe default offset past known statics
                _allocBase = 65536; // Start allocations at 64KB (safe above statics)
                _allocOffset = _allocBase;

                _bindFunctions();
                _ready = true;
                console.log('[WASM] Module loaded successfully (' + (bytes.byteLength / 1024).toFixed(1) + ' KB)');
            })
            .catch(function (err) {
                console.warn('[WASM] Failed to load — using JS fallback:', err.message || err);
                _failed = true;
            });
    }

    // ── Bind WASM exports to the API ──
    function _bindFunctions() {
        var exports = _instance.exports;

        // ── RNG ──
        api.rngSeed = function (seed) {
            exports.rng_seed(seed >>> 0);
        };

        api.rngRandom = function () {
            return exports.rng_random();
        };

        api.rngRandInt = function (min, max) {
            return exports.rng_rand_int(min, max);
        };

        api.rngChance = function (p) {
            return exports.rng_chance(p) !== 0;
        };

        api.rngGetState = function () {
            _resetAlloc();
            var ptr = _alloc(16);
            exports.rng_get_state(ptr);
            var view = new Uint32Array(_memory.buffer, ptr, 4);
            return [view[0], view[1], view[2], view[3]];
        };

        api.rngSetState = function (s0, s1, s2, s3) {
            exports.rng_set_state(s0 >>> 0, s1 >>> 0, s2 >>> 0, s3 >>> 0);
        };

        // ── Terrain Sampling ──
        api.checkWaterPath = function (terrainGrid, cols, tileSize, x1, y1, x2, y2) {
            _resetAlloc();
            var tPtr = _writeU8Array(terrainGrid);
            return exports.check_water_path(tPtr, terrainGrid.length, cols, tileSize, x1, y1, x2, y2);
        };

        api.getOffroadCost = function (terrainGrid, cols, tileSize, ax, ay, bx, by) {
            _resetAlloc();
            var tPtr = _writeU8Array(terrainGrid);
            var result = exports.get_offroad_cost(tPtr, terrainGrid.length, cols, tileSize, ax, ay, bx, by);
            return result < 0 ? null : result;
        };

        api.getDominantTerrain = function (terrainGrid, cols, tileSize, ax, ay, bx, by) {
            _resetAlloc();
            var tPtr = _writeU8Array(terrainGrid);
            return exports.get_dominant_terrain(tPtr, terrainGrid.length, cols, tileSize, ax, ay, bx, by);
        };

        // ── Pathfinding ──
        // edges: array of {fromIdx, toIdx, cost, roadIndex, edgeType}
        // Returns array of {roadIndex, edgeType} or null
        api.dijkstra = function (edges, numNodes, fromNode, toNode) {
            _resetAlloc();
            // Flatten edges into f64 array: [fromIdx, toIdx, cost, roadIndex, edgeType] per edge
            var flat = new Float64Array(edges.length * 5);
            for (var i = 0; i < edges.length; i++) {
                var e = edges[i];
                flat[i * 5] = e.fromIdx;
                flat[i * 5 + 1] = e.toIdx;
                flat[i * 5 + 2] = e.cost;
                flat[i * 5 + 3] = e.roadIndex;
                flat[i * 5 + 4] = e.edgeType;
            }
            var edgesPtr = _writeF64Array(flat);
            var segCount = exports.pathfinding_dijkstra(edgesPtr, numNodes, edges.length, fromNode, toNode);
            if (segCount === 0) return null;

            // Read result from WASM static buffer
            var resultPtr = exports.pathfinding_get_result_ptr();
            var resultView = new Float64Array(_memory.buffer, resultPtr, segCount * 2);
            var result = [];
            for (var s = 0; s < segCount; s++) {
                result.push({
                    roadIndex: resultView[s * 2],
                    edgeType: resultView[s * 2 + 1]
                });
            }
            return result;
        };

        // ── Monopoly ──
        api.countMonopolies = function (playerInventory, townSupplies, numResources, numTowns, threshold) {
            _resetAlloc();
            var invPtr = _writeF64Array(playerInventory);
            var supPtr = _writeF64Array(townSupplies);
            return exports.count_monopolies(invPtr, supPtr, numResources, numTowns, threshold);
        };

        // ── Caravan Subtick ──
        // caravanData: flat Float64Array [progress, totalWeight, totalDist, baseSpeed, routeType, expertNav, roadKnowledge, cartographer, shipCondEff] × N
        api.caravanSubtick = function (caravanData, numCaravans, ticksPerDay) {
            _resetAlloc();
            var dataPtr = _writeF64Array(caravanData);
            var arrived = exports.caravan_subtick(dataPtr, numCaravans, ticksPerDay);
            // Read updated progress values
            var progressPtr = exports.caravan_get_progress_ptr();
            var progressView = new Float64Array(_memory.buffer, progressPtr, numCaravans);
            var result = new Float64Array(numCaravans);
            result.set(progressView);
            return { arrived: arrived, progress: result };
        };

        // ── Terrain Rendering ──
        api.renderTerrainTiles = function (terrainGrid, cols, tileSize, startCol, startRow, endCol, endRow, isWinter) {
            _resetAlloc();
            var tPtr = _writeU8Array(terrainGrid);
            var widthTiles = endCol - startCol + 1;
            var heightTiles = endRow - startRow + 1;
            var pixelCount = widthTiles * tileSize * heightTiles * tileSize;
            var outPtr = _alloc(pixelCount * 4);
            exports.render_terrain_tiles(
                tPtr, terrainGrid.length, cols, tileSize,
                startCol, startRow, endCol, endRow,
                isWinter ? 1 : 0, outPtr
            );
            // Return a clamped Uint8Array view of the RGBA data
            return new Uint8ClampedArray(_memory.buffer, outPtr, pixelCount * 4);
        };

        api.buildMinimapTerrain = function (terrainGrid, gridCols, gridRows, minimapW, minimapH, isWinter) {
            _resetAlloc();
            var tPtr = _writeU8Array(terrainGrid);
            var pixelCount = minimapW * minimapH;
            var outPtr = _alloc(pixelCount * 4);
            exports.build_minimap_terrain(
                tPtr, terrainGrid.length, gridCols, gridRows,
                minimapW, minimapH, isWinter ? 1 : 0, outPtr
            );
            return new Uint8ClampedArray(_memory.buffer, outPtr, pixelCount * 4);
        };

        api.malloc = _alloc;
    }

    // Auto-initialize on load
    _init();

    return api;
})();
