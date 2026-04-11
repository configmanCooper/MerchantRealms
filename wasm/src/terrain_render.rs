// ============================================================
// Terrain Tile Color Computation — generates RGBA pixel buffer
// For each visible tile: terrain lookup → color + hash shift → RGBA
// ============================================================

// Pre-defined terrain base colors (RGB)
// Must match JS getTerrainColor() / TERRAIN constants
const TERRAIN_COLORS: [[u8; 3]; 8] = [
    [90, 140, 60],    // 0: Grass    #5a8c3c
    [34, 85, 34],     // 1: Forest   #225522
    [50, 100, 180],   // 2: Water    #3264b4
    [120, 100, 80],   // 3: Mountain #786450
    [100, 130, 70],   // 4: Hills    #648246
    [194, 178, 128],  // 5: Sand     #c2b280
    [90, 140, 60],    // 6: fallback (grass)
    [90, 140, 60],    // 7: fallback (grass)
];

const WINTER_COLORS: [[u8; 3]; 8] = [
    [180, 195, 200],  // 0: Grass → snowy
    [58, 90, 72],     // 1: Forest → dark green
    [50, 100, 180],   // 2: Water → same
    [120, 100, 80],   // 3: Mountain → same
    [122, 138, 106],  // 4: Hills → muted
    [194, 178, 128],  // 5: Sand → same
    [180, 195, 200],  // 6: fallback
    [180, 195, 200],  // 7: fallback
];

/// Tile hash — deterministic pseudo-random per tile, returns 0.0-1.0
#[inline(always)]
fn tile_hash(x: u32, y: u32) -> f64 {
    let key = x.wrapping_mul(7919).wrapping_add(y);
    let h = key.wrapping_mul(2654435761);
    (h as f64) / 4294967296.0
}

#[inline(always)]
fn clamp_u8(v: i32) -> u8 {
    if v < 0 { 0 } else if v > 255 { 255 } else { v as u8 }
}

/// Generate RGBA pixel buffer for visible terrain tiles.
///
/// terrain_ptr: terrain grid (Uint8Array, row-major)
/// terrain_len: total grid length
/// cols: grid columns
/// tile_size: pixel size of each tile
/// start_col, start_row, end_col, end_row: visible tile range (inclusive)
/// is_winter: 1 for winter colors, 0 for normal
/// out_ptr: output RGBA buffer (must be pre-allocated: (end_col-start_col+1) * (end_row-start_row+1) * tile_size * tile_size * 4)
///
/// Returns: number of pixels written
#[unsafe(no_mangle)]
pub extern "C" fn render_terrain_tiles(
    terrain_ptr: *const u8,
    terrain_len: u32,
    cols: u32,
    tile_size: u32,
    start_col: u32,
    start_row: u32,
    end_col: u32,
    end_row: u32,
    is_winter: u32,
    out_ptr: *mut u8,
) -> u32 {
    let grid = unsafe { core::slice::from_raw_parts(terrain_ptr, terrain_len as usize) };
    let ts = tile_size;
    let width_tiles = end_col - start_col + 1;
    let _height_tiles = end_row - start_row + 1;
    let row_stride = width_tiles * ts * 4; // bytes per pixel row in output

    let colors = if is_winter != 0 { &WINTER_COLORS } else { &TERRAIN_COLORS };

    let mut pixels_written: u32 = 0;

    for r in start_row..=end_row {
        for c in start_col..=end_col {
            let grid_idx = (r * cols + c) as usize;
            let tile_id = if grid_idx < grid.len() { grid[grid_idx] } else { 0 };
            let color_idx = if (tile_id as usize) < colors.len() { tile_id as usize } else { 0 };
            let base_r = colors[color_idx][0] as i32;
            let base_g = colors[color_idx][1] as i32;
            let base_b = colors[color_idx][2] as i32;

            let h = tile_hash(c, r);
            let shift = ((h - 0.5) * 20.0).floor() as i32;

            let final_r = clamp_u8(base_r + shift);
            let final_g = clamp_u8(base_g + shift);
            let final_b = clamp_u8(base_b + shift);

            // Fill tile_size × tile_size pixels
            let tile_x = (c - start_col) * ts;
            let tile_y = (r - start_row) * ts;

            for py in 0..ts {
                let y_offset = (tile_y + py) * width_tiles * ts * 4;
                for px in 0..ts {
                    let out_idx = (y_offset + (tile_x + px) * 4) as usize;
                    unsafe {
                        let p = out_ptr.add(out_idx);
                        *p = final_r;
                        *p.add(1) = final_g;
                        *p.add(2) = final_b;
                        *p.add(3) = 255;
                    }
                    pixels_written += 1;
                }
            }
        }
    }

    // Add terrain decorations as tinted overlay pixels
    for r in start_row..=end_row {
        for c in start_col..=end_col {
            let grid_idx = (r * cols + c) as usize;
            let tile_id = if grid_idx < grid.len() { grid[grid_idx] } else { 0 };
            let h = tile_hash(c, r);
            let shift = ((h - 0.5) * 20.0).floor() as i32;
            let tile_x = (c - start_col) * ts;
            let tile_y = (r - start_row) * ts;

            match tile_id {
                1 => {
                    // Forest — dark triangular tree marks
                    let tree_count = 1 + (h * 2.0).floor() as u32;
                    let tree_r = if is_winter != 0 { clamp_u8(58 + shift) } else { clamp_u8(26 + shift) };
                    let tree_g = if is_winter != 0 { clamp_u8(90 + shift) } else { clamp_u8(64 + shift) };
                    let tree_b = if is_winter != 0 { clamp_u8(72 + shift) } else { clamp_u8(32 + shift) };

                    for t in 0..tree_count {
                        let tx = ((h * 37.0 + t as f64 * 5.7) % ts as f64) as u32;
                        let ty = ((h * 23.0 + t as f64 * 7.3) % ts as f64) as u32;
                        let sz = (3.0 + h * 3.0) as u32;

                        // Draw a small diamond/dot for the tree
                        for dy in 0..sz.min(ts) {
                            let py = tile_y + ty.wrapping_sub(sz / 2).wrapping_add(dy);
                            if py >= (end_row - start_row + 1) * ts { continue; }
                            let half_w = if dy < sz / 2 { dy } else { sz - dy };
                            let cx = tile_x + tx;
                            for dx in 0..half_w.min(3) {
                                for sign in [cx.wrapping_sub(dx), cx.wrapping_add(dx)] {
                                    if sign < width_tiles * ts {
                                        let out_idx = (py * width_tiles * ts * 4 + sign * 4) as usize;
                                        unsafe {
                                            let p = out_ptr.add(out_idx);
                                            *p = tree_r;
                                            *p.add(1) = tree_g;
                                            *p.add(2) = tree_b;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                3 => {
                    // Mountain — darken center triangle area
                    let peak_x = tile_x + ts / 2;
                    let peak_y = tile_y + ts / 5;
                    let base_y = tile_y + ts * 9 / 10;
                    let mtn_r = clamp_u8(107 + shift);
                    let mtn_g = clamp_u8(91 + shift);
                    let mtn_b = clamp_u8(79 + shift);

                    for py in peak_y..base_y.min((end_row - start_row + 1) * ts) {
                        let progress = (py - peak_y) as f64 / (base_y - peak_y).max(1) as f64;
                        let half_w = (progress * (ts as f64 * 0.3)) as u32;
                        for dx in 0..half_w {
                            for px in [peak_x.wrapping_sub(dx), peak_x.wrapping_add(dx)] {
                                if px >= tile_x && px < tile_x + ts && px < width_tiles * ts {
                                    let out_idx = (py * width_tiles * ts * 4 + px * 4) as usize;
                                    unsafe {
                                        let p = out_ptr.add(out_idx);
                                        *p = mtn_r;
                                        *p.add(1) = mtn_g;
                                        *p.add(2) = mtn_b;
                                    }
                                }
                            }
                        }
                    }
                }
                4 => {
                    // Hills — lighter bumps
                    let hill_r = if is_winter != 0 { clamp_u8(122 + shift - 8) } else { clamp_u8(90 + shift - 8) };
                    let hill_g = if is_winter != 0 { clamp_u8(138 + shift - 8) } else { clamp_u8(122 + shift - 8) };
                    let hill_b = if is_winter != 0 { clamp_u8(106 + shift - 8) } else { clamp_u8(66 + shift - 8) };

                    // Draw two semi-circular bumps
                    let cx1 = tile_x + ts * 35 / 100;
                    let cy1 = tile_y + ts * 65 / 100;
                    let r1 = ts * 25 / 100;
                    let cx2 = tile_x + ts * 70 / 100;
                    let cy2 = tile_y + ts * 55 / 100;
                    let r2 = ts * 20 / 100;

                    for py in tile_y..tile_y + ts {
                        if py >= (end_row - start_row + 1) * ts { break; }
                        for px in tile_x..tile_x + ts {
                            if px >= width_tiles * ts { break; }
                            let d1_sq = ((px as i32 - cx1 as i32) * (px as i32 - cx1 as i32) +
                                        (py as i32 - cy1 as i32) * (py as i32 - cy1 as i32)) as u32;
                            let d2_sq = ((px as i32 - cx2 as i32) * (px as i32 - cx2 as i32) +
                                        (py as i32 - cy2 as i32) * (py as i32 - cy2 as i32)) as u32;
                            let in_hill = (d1_sq <= r1 * r1 && py <= cy1) || (d2_sq <= r2 * r2 && py <= cy2);
                            if in_hill {
                                let out_idx = (py * width_tiles * ts * 4 + px * 4) as usize;
                                unsafe {
                                    let p = out_ptr.add(out_idx);
                                    *p = hill_r;
                                    *p.add(1) = hill_g;
                                    *p.add(2) = hill_b;
                                }
                            }
                        }
                    }
                }
                _ => {} // Water and sand decorations handled in JS (wave animation needs frameCount)
            }
        }
    }

    pixels_written
}

/// Generate minimap RGBA buffer from terrain grid.
///
/// terrain_ptr: terrain grid
/// terrain_len: grid size
/// grid_cols, grid_rows: terrain grid dimensions
/// minimap_w, minimap_h: output minimap pixel dimensions
/// is_winter: 1 for winter, 0 for normal
/// out_ptr: output RGBA buffer (minimap_w * minimap_h * 4 bytes)
///
/// Returns: number of pixels written
#[unsafe(no_mangle)]
pub extern "C" fn build_minimap_terrain(
    terrain_ptr: *const u8,
    terrain_len: u32,
    grid_cols: u32,
    grid_rows: u32,
    minimap_w: u32,
    minimap_h: u32,
    is_winter: u32,
    out_ptr: *mut u8,
) -> u32 {
    let grid = unsafe { core::slice::from_raw_parts(terrain_ptr, terrain_len as usize) };
    let colors = if is_winter != 0 { &WINTER_COLORS } else { &TERRAIN_COLORS };

    for py in 0..minimap_h {
        for px in 0..minimap_w {
            // Map minimap pixel to terrain grid cell
            let grid_col = (px as f64 / minimap_w as f64 * grid_cols as f64) as u32;
            let grid_row = (py as f64 / minimap_h as f64 * grid_rows as f64) as u32;
            let grid_idx = (grid_row * grid_cols + grid_col) as usize;

            let tile_id = if grid_idx < grid.len() { grid[grid_idx] } else { 0 };
            let color_idx = if (tile_id as usize) < colors.len() { tile_id as usize } else { 0 };

            let out_idx = ((py * minimap_w + px) * 4) as usize;
            unsafe {
                let p = out_ptr.add(out_idx);
                *p = colors[color_idx][0];
                *p.add(1) = colors[color_idx][1];
                *p.add(2) = colors[color_idx][2];
                *p.add(3) = 255;
            }
        }
    }

    minimap_w * minimap_h
}
