// ============================================================
// Monopoly Win Condition Check
// Counts resources where player controls >= threshold% of supply
// ============================================================

/// Count monopolies across all resources and towns.
///
/// player_inv_ptr: pointer to f64 array of player inventory quantities [qty0, qty1, ..., qtyN]
/// town_supplies_ptr: pointer to f64 array of town market supplies,
///                    laid out as [town0_res0, town0_res1, ..., town0_resN, town1_res0, ...]
/// num_resources: number of resource types
/// num_towns: number of towns
/// threshold: monopoly threshold (e.g., 0.75 for 75%)
///
/// Returns: number of resources where player has monopoly
#[unsafe(no_mangle)]
pub extern "C" fn count_monopolies(
    player_inv_ptr: *const f64,
    town_supplies_ptr: *const f64,
    num_resources: u32,
    num_towns: u32,
    threshold: f64,
) -> u32 {
    let nr = num_resources as usize;
    let nt = num_towns as usize;
    let player_inv = unsafe { core::slice::from_raw_parts(player_inv_ptr, nr) };
    let town_supplies = unsafe { core::slice::from_raw_parts(town_supplies_ptr, nt * nr) };

    let mut count: u32 = 0;

    for res in 0..nr {
        let player_qty = player_inv[res];
        let mut total_market: f64 = 0.0;

        // Sum this resource across all towns
        for town in 0..nt {
            total_market += town_supplies[town * nr + res];
        }

        let grand_total = player_qty + total_market;
        if grand_total > 0.0 && player_qty / grand_total >= threshold {
            count += 1;
        }
    }

    count
}
