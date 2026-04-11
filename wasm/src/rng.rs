// ============================================================
// xoshiro128** Seeded RNG — exact port of JS createRNG(seed)
// Must produce identical output to JS version for determinism
// ============================================================

static mut RNG_STATE: [u32; 4] = [0; 4];

fn splitmix32(state: &mut u32) -> u32 {
    *state = state.wrapping_add(0x9e3779b9);
    let mut t = *state ^ (*state >> 16);
    t = t.wrapping_mul(0x21f0aaad);
    t = t ^ (t >> 15);
    t = t.wrapping_mul(0x735a2d97);
    (t ^ (t >> 15)) as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn rng_seed(seed: u32) {
    unsafe {
        let mut sm = seed;
        RNG_STATE[0] = splitmix32(&mut sm);
        RNG_STATE[1] = splitmix32(&mut sm);
        RNG_STATE[2] = splitmix32(&mut sm);
        RNG_STATE[3] = splitmix32(&mut sm);
    }
}

fn rng_next_raw() -> u32 {
    unsafe {
        // xoshiro128** — result = rotl(s1 * 5, 7) * 9
        // But JS uses: result = (Math.imul(s1 * 5, 1 << 7 | 1) >>> 0)
        // which is: (s1 * 5) * 129 as u32
        // Actually: Math.imul(s1 * 5, 129) = (s1 * 5).wrapping_mul(129)
        let result = (RNG_STATE[1].wrapping_mul(5)).wrapping_mul(129);
        let t = RNG_STATE[1] << 9;
        RNG_STATE[2] ^= RNG_STATE[0];
        RNG_STATE[3] ^= RNG_STATE[1];
        RNG_STATE[1] ^= RNG_STATE[2];
        RNG_STATE[0] ^= RNG_STATE[3];
        RNG_STATE[2] ^= t;
        RNG_STATE[3] = RNG_STATE[3].rotate_left(11);
        result
    }
}

/// Returns float in [0, 1)
#[unsafe(no_mangle)]
pub extern "C" fn rng_random() -> f64 {
    (rng_next_raw() as f64) / 4294967296.0
}

/// Returns integer in [min, max] inclusive
#[unsafe(no_mangle)]
pub extern "C" fn rng_rand_int(min: i32, max: i32) -> i32 {
    if max <= min {
        return min;
    }
    let range = (max - min + 1) as u32;
    min + (rng_next_raw() % range) as i32
}

/// Returns true with probability p (0.0-1.0)
#[unsafe(no_mangle)]
pub extern "C" fn rng_chance(p: f64) -> i32 {
    if rng_random() < p { 1 } else { 0 }
}

/// Get current RNG state (for sync with JS)
#[unsafe(no_mangle)]
pub extern "C" fn rng_get_state(out: *mut u32) {
    unsafe {
        *out.add(0) = RNG_STATE[0];
        *out.add(1) = RNG_STATE[1];
        *out.add(2) = RNG_STATE[2];
        *out.add(3) = RNG_STATE[3];
    }
}

/// Set RNG state (for sync from JS)
#[unsafe(no_mangle)]
pub extern "C" fn rng_set_state(s0: u32, s1: u32, s2: u32, s3: u32) {
    unsafe {
        RNG_STATE[0] = s0;
        RNG_STATE[1] = s1;
        RNG_STATE[2] = s2;
        RNG_STATE[3] = s3;
    }
}
