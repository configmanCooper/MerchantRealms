// ============================================================
// Caravan Position Interpolation (60fps subtick)
// Batch-updates progress for all traveling caravans
// ============================================================

// Caravan data layout per caravan (flat f64 array):
// [progress, totalWeight, totalDist, baseSpeed, routeType, hasExpertNav, hasRoadKnowledge, hasCartographer, shipCondEff]
// routeType: 0=land, 1=sea
// hasExpertNav/hasRoadKnowledge/hasCartographer: 0 or 1
// shipCondEff: ship condition efficiency (1.0 if no ship)

// Output: updated progress values
static mut CARAVAN_PROGRESS_OUT: [f64; 100] = [0.0; 100];

/// Batch update caravan progress for one subtick.
///
/// data_ptr: pointer to flat f64 array of caravan data (9 values per caravan)
/// num_caravans: number of caravans
/// ticks_per_day: CONFIG.TICKS_PER_DAY (usually 60)
///
/// Returns: number of caravans that reached destination (progress >= 1.0)
///          Read updated progress via caravan_get_progress_ptr()
#[unsafe(no_mangle)]
pub extern "C" fn caravan_subtick(
    data_ptr: *const f64,
    num_caravans: u32,
    ticks_per_day: f64,
) -> u32 {
    let nc = num_caravans as usize;
    if nc > 100 {
        return 0;
    }
    let data = unsafe { core::slice::from_raw_parts(data_ptr, nc * 9) };
    let mut arrived: u32 = 0;

    for i in 0..nc {
        let base = i * 9;
        let progress = data[base];
        let total_weight = data[base + 1];
        let total_dist = data[base + 2];
        let base_speed = data[base + 3];
        let route_type = data[base + 4]; // 0=land, 1=sea
        let has_expert_nav = data[base + 5]; // 0 or 1
        let has_road_knowledge = data[base + 6];
        let has_cartographer = data[base + 7];
        let ship_cond_eff = data[base + 8];

        let weight_penalty = 1.0 / (1.0 + total_weight * 0.005);
        let mut caravan_speed = base_speed * weight_penalty;

        if route_type >= 0.5 {
            // Sea
            if has_expert_nav >= 0.5 {
                caravan_speed *= 1.20;
            }
            if ship_cond_eff > 0.0 {
                caravan_speed *= if ship_cond_eff < 0.1 { 0.1 } else { ship_cond_eff };
            }
        } else {
            // Land
            if has_road_knowledge >= 0.5 {
                caravan_speed *= 1.15;
            }
            if has_cartographer >= 0.5 {
                caravan_speed *= 1.05;
            }
        }

        let dist = if total_dist > 1.0 { total_dist } else { 1.0 };
        let new_progress = progress + (caravan_speed / dist) / ticks_per_day;
        let clamped = if new_progress >= 1.0 {
            arrived += 1;
            1.0
        } else {
            new_progress
        };

        unsafe {
            CARAVAN_PROGRESS_OUT[i] = clamped;
        }
    }

    arrived
}

/// Get pointer to output progress array
#[unsafe(no_mangle)]
pub extern "C" fn caravan_get_progress_ptr() -> *const f64 {
    unsafe { CARAVAN_PROGRESS_OUT.as_ptr() }
}
