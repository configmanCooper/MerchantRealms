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
// v9p33river318: bumped from 100 to 256 so realistic late-game caravan
// counts (player caravans + EM caravans + kingdom caravans) don't hit
// the silent return-0 ceiling. JS caller chunks anything still over.
const MAX_CARAVANS: usize = 256;
static mut CARAVAN_PROGRESS_OUT: [f64; MAX_CARAVANS] = [0.0; MAX_CARAVANS];

/// Batch update caravan progress for one subtick.
///
/// data_ptr: pointer to flat f64 array of caravan data (9 values per caravan)
/// num_caravans: number of caravans
/// ticks_per_day: CONFIG.TICKS_PER_DAY (usually 60)
///
/// Returns: u32::MAX when num_caravans exceeds MAX_CARAVANS (sentinel —
///          caller should chunk and re-call). Otherwise number of
///          caravans that reached destination (progress >= 1.0).
///          Read updated progress via caravan_get_progress_ptr()
#[unsafe(no_mangle)]
pub extern "C" fn caravan_subtick(
    data_ptr: *const f64,
    num_caravans: u32,
    ticks_per_day: f64,
) -> u32 {
    let nc = num_caravans as usize;
    if nc > MAX_CARAVANS {
        // v9p33river318: was silently returning 0 (no caravans arrived)
        // and updating nothing. JS caller had no way to detect the
        // overflow, so >100 caravans silently froze. Now return sentinel
        // u32::MAX so JS can detect, chunk, and re-call.
        return u32::MAX;
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
                // v9p33river333: malformed condition efficiency may be >1; never speed ships up.
                let safe_ship_cond_eff = if ship_cond_eff > 1.0 { 1.0 } else if ship_cond_eff < 0.1 { 0.1 } else { ship_cond_eff };
                caravan_speed *= safe_ship_cond_eff;
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

        // v9p33river329: preserve legitimate sub-1.0 route distances;
        // only fall back when the distance is invalid/non-positive.
        let dist = if total_dist > 0.0 { total_dist } else { 1.0 };
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
