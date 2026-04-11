// ============================================================
// Merchant Realms — WebAssembly Core Module
// Ports critical+high JS computations to Rust for 3-12x speedup
// ============================================================

mod rng;
mod terrain;
mod pathfinding;
mod monopoly;
mod caravan;
mod terrain_render;

// Re-export everything via the submodules
