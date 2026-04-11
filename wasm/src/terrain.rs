// ============================================================
// Terrain Sampling — checkWaterPath, getOffroadCost, getDominantTerrain
// Pure math on Uint8Array terrain grid, no allocations
// ============================================================

// Terrain IDs (must match config.js TERRAIN constants)
const TERRAIN_GRASS: u8 = 0;
const TERRAIN_FOREST: u8 = 1;
const TERRAIN_WATER: u8 = 2;
const TERRAIN_MOUNTAIN: u8 = 3;
const TERRAIN_HILLS: u8 = 4;
const TERRAIN_SAND: u8 = 5;

/// Read terrain at grid (col, row) from flat array
fn terrain_at(grid: &[u8], cols: u32, col: i32, row: i32) -> u8 {
    if col < 0 || row < 0 || col >= cols as i32 {
        return TERRAIN_WATER; // out of bounds = water
    }
    let idx = (row as u32) * cols + (col as u32);
    if idx < grid.len() as u32 {
        grid[idx as usize]
    } else {
        TERRAIN_WATER
    }
}

/// Returns fraction of water tiles along line (0.0 to 1.0)
/// Samples 20 points like JS version
#[unsafe(no_mangle)]
pub extern "C" fn check_water_path(
    terrain_ptr: *const u8,
    terrain_len: u32,
    cols: u32,
    tile_size: f64,
    x1: f64, y1: f64,
    x2: f64, y2: f64,
) -> f64 {
    let grid = unsafe { core::slice::from_raw_parts(terrain_ptr, terrain_len as usize) };
    let steps: u32 = 20;
    let mut water_count: u32 = 0;
    for s in 1..steps {
        let t = s as f64 / steps as f64;
        let px = x1 + (x2 - x1) * t;
        let py = y1 + (y2 - y1) * t;
        let tx = (px / tile_size).floor() as i32;
        let ty = (py / tile_size).floor() as i32;
        if terrain_at(grid, cols, tx, ty) == TERRAIN_WATER {
            water_count += 1;
        }
    }
    water_count as f64 / (steps - 1) as f64
}

/// Returns average terrain cost along line, or -1.0 if impassable (water blocking)
/// Samples 31 points (0..=30) like JS version
#[unsafe(no_mangle)]
pub extern "C" fn get_offroad_cost(
    terrain_ptr: *const u8,
    terrain_len: u32,
    cols: u32,
    tile_size: f64,
    ax: f64, ay: f64,
    bx: f64, by: f64,
) -> f64 {
    let grid = unsafe { core::slice::from_raw_parts(terrain_ptr, terrain_len as usize) };
    let steps: u32 = 30;
    let mut total_cost: f64 = 0.0;
    for s in 0..=steps {
        let t = s as f64 / steps as f64;
        let px = ax + (bx - ax) * t;
        let py = ay + (by - ay) * t;
        let tx = (px / tile_size).floor() as i32;
        let ty = (py / tile_size).floor() as i32;
        let tid = terrain_at(grid, cols, tx, ty);
        match tid {
            TERRAIN_WATER => return -1.0, // impassable
            TERRAIN_MOUNTAIN => total_cost += 12.5,
            TERRAIN_FOREST => total_cost += 6.67,
            TERRAIN_HILLS => total_cost += 5.0,
            TERRAIN_SAND => total_cost += 4.0,
            _ => total_cost += 2.86, // grassland
        }
    }
    total_cost / (steps + 1) as f64
}

/// Returns dominant terrain ID along path
/// Samples 21 points (0..=20) like JS version
#[unsafe(no_mangle)]
pub extern "C" fn get_dominant_terrain(
    terrain_ptr: *const u8,
    terrain_len: u32,
    cols: u32,
    tile_size: f64,
    ax: f64, ay: f64,
    bx: f64, by: f64,
) -> u8 {
    let grid = unsafe { core::slice::from_raw_parts(terrain_ptr, terrain_len as usize) };
    let steps: u32 = 20;
    let mut counts = [0u32; 8]; // terrain IDs 0-7
    for s in 0..=steps {
        let t = s as f64 / steps as f64;
        let px = ax + (bx - ax) * t;
        let py = ay + (by - ay) * t;
        let tx = (px / tile_size).floor() as i32;
        let ty = (py / tile_size).floor() as i32;
        let tid = terrain_at(grid, cols, tx, ty);
        if (tid as usize) < counts.len() {
            counts[tid as usize] += 1;
        }
    }
    let mut max_id: u8 = TERRAIN_GRASS;
    let mut max_count: u32 = 0;
    for (id, &count) in counts.iter().enumerate() {
        if count > max_count {
            max_count = count;
            max_id = id as u8;
        }
    }
    max_id
}
