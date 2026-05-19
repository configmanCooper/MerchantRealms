// ============================================================
// Dijkstra Pathfinding with Binary Heap
// Operates on a flat edge list passed from JS
// ============================================================

// Edge format in flat f64 array: [fromId, toId, cost, roadIndex, edgeType]
// edgeType: 0=road, 1=sea, 2=offroad
// Result: flat array of [roadIndex, edgeType] pairs for the path

// Shared memory buffer for results (max 200 path segments)
static mut PATH_RESULT: [f64; 400] = [0.0; 400];
static mut PATH_RESULT_LEN: u32 = 0;

// Dijkstra state — pre-allocated for up to 500 nodes
const MAX_NODES: usize = 500;
static mut DIST: [f64; MAX_NODES] = [f64::INFINITY; MAX_NODES];
static mut PREV_FROM: [i32; MAX_NODES] = [-1; MAX_NODES];
static mut PREV_EDGE_IDX: [i32; MAX_NODES] = [-1; MAX_NODES];
static mut PREV_EDGE_TYPE: [i32; MAX_NODES] = [-1; MAX_NODES];
static mut VISITED: [bool; MAX_NODES] = [false; MAX_NODES];

// Binary min-heap
// v9p33river318: bumped MAX_HEAP from 4000 to 16000 so realistic graphs
// near MAX_NODES=500 with many edges don't silently drop nodes (each node
// can be pushed many times during relaxation). Also added an overflow
// flag so the caller can detect when the heap saturated and fall back.
const MAX_HEAP: usize = 16000;
static mut HEAP_IDS: [u32; MAX_HEAP] = [0; MAX_HEAP];
static mut HEAP_COSTS: [f64; MAX_HEAP] = [0.0; MAX_HEAP];
static mut HEAP_LEN: usize = 0;
static mut HEAP_OVERFLOW: bool = false;

fn heap_push(id: u32, cost: f64) -> bool {
    unsafe {
        if HEAP_LEN >= MAX_HEAP {
            HEAP_OVERFLOW = true;
            return false;
        }
        HEAP_IDS[HEAP_LEN] = id;
        HEAP_COSTS[HEAP_LEN] = cost;
        let mut idx = HEAP_LEN;
        HEAP_LEN += 1;
        // Sift up
        while idx > 0 {
            let parent = (idx - 1) >> 1;
            if HEAP_COSTS[parent] <= HEAP_COSTS[idx] {
                break;
            }
            HEAP_IDS.swap(parent, idx);
            HEAP_COSTS.swap(parent, idx);
            idx = parent;
        }
        true
    }
}

fn heap_pop() -> Option<(u32, f64)> {
    unsafe {
        if HEAP_LEN == 0 {
            return None;
        }
        let id = HEAP_IDS[0];
        let cost = HEAP_COSTS[0];
        HEAP_LEN -= 1;
        if HEAP_LEN > 0 {
            HEAP_IDS[0] = HEAP_IDS[HEAP_LEN];
            HEAP_COSTS[0] = HEAP_COSTS[HEAP_LEN];
            // Sift down
            let mut idx = 0;
            loop {
                let left = 2 * idx + 1;
                let right = 2 * idx + 2;
                let mut smallest = idx;
                if left < HEAP_LEN && HEAP_COSTS[left] < HEAP_COSTS[smallest] {
                    smallest = left;
                }
                if right < HEAP_LEN && HEAP_COSTS[right] < HEAP_COSTS[smallest] {
                    smallest = right;
                }
                if smallest == idx {
                    break;
                }
                HEAP_IDS.swap(smallest, idx);
                HEAP_COSTS.swap(smallest, idx);
                idx = smallest;
            }
        }
        Some((id, cost))
    }
}

/// Run Dijkstra on a flat edge list.
///
/// edges_ptr: pointer to f64 array of [fromNodeIdx, toNodeIdx, cost, roadIndex, edgeType] × num_edges
/// num_nodes: total number of nodes (town indices 0..num_nodes-1)
/// num_edges: number of edges
/// from_node: source node index
/// to_node: target node index
///
/// Returns: number of segments in path (0 = no path found).
///          Read results via pathfinding_get_result().
#[unsafe(no_mangle)]
pub extern "C" fn pathfinding_dijkstra(
    edges_ptr: *const f64,
    num_nodes: u32,
    num_edges: u32,
    from_node: u32,
    to_node: u32,
) -> u32 {
    let n = num_nodes as usize;
    if n > MAX_NODES || n == 0 || (from_node as usize) >= n || (to_node as usize) >= n {
        // v9p33river329: reject invalid endpoints before indexing static arrays.
        unsafe { PATH_RESULT_LEN = 0; }
        return 0;
    }

    let edges = unsafe { core::slice::from_raw_parts(edges_ptr, (num_edges as usize) * 5) };

    // Initialize
    unsafe {
        HEAP_LEN = 0;
        HEAP_OVERFLOW = false;
        PATH_RESULT_LEN = 0;
        for i in 0..n {
            DIST[i] = f64::INFINITY;
            PREV_FROM[i] = -1;
            PREV_EDGE_IDX[i] = -1;
            PREV_EDGE_TYPE[i] = -1;
            VISITED[i] = false;
        }
        DIST[from_node as usize] = 0.0;
    }

    heap_push(from_node, 0.0);

    while let Some((node_id, _cost)) = heap_pop() {
        let ni = node_id as usize;
        // v9p33river329: defensive guard for any malformed heap entry.
        if ni >= n {
            continue;
        }
        unsafe {
            if VISITED[ni] {
                continue;
            }
            VISITED[ni] = true;
        }
        if node_id == to_node {
            break;
        }

        // Scan all edges for neighbors of this node
        for e in 0..num_edges as usize {
            let base = e * 5;
            let from_idx = edges[base] as u32;
            let to_idx = edges[base + 1] as u32;
            let cost = edges[base + 2];

            // v9p33river333: respect directed edge records; callers that need bidirectional travel must pass both edges.
            let neighbor = if from_idx == node_id {
                to_idx
            } else {
                continue;
            };

            let neighbor_i = neighbor as usize;
            if neighbor_i >= n {
                continue;
            }

            unsafe {
                let new_dist = DIST[ni] + cost;
                if new_dist < DIST[neighbor_i] {
                    DIST[neighbor_i] = new_dist;
                    PREV_FROM[neighbor_i] = node_id as i32;
                    PREV_EDGE_IDX[neighbor_i] = edges[base + 3] as i32;
                    PREV_EDGE_TYPE[neighbor_i] = edges[base + 4] as i32;
                    heap_push(neighbor, new_dist);
                }
            }
        }
    }

    // v9p33river318: if the heap overflowed, the result may be missing
    // optimal paths. Signal failure so JS falls back to its native
    // dijkstra implementation rather than trusting a partial result.
    unsafe {
        if HEAP_OVERFLOW {
            PATH_RESULT_LEN = 0;
            return 0;
        }
    }

    // Reconstruct path (backwards from to_node)
    unsafe {
        if PREV_FROM[to_node as usize] == -1 && from_node != to_node {
            PATH_RESULT_LEN = 0;
            return 0;
        }

        // Collect path segments in reverse
        // v9p33river318: when seg_count would exceed 200 the loop used
        // to silently truncate AND still report success. Now: if the
        // path is too long to fit, return 0 (no path) so JS falls back
        // to its full-resolution pathfinder. This avoids returning a
        // misleading partial route.
        let mut segments: [(i32, i32); 200] = [(-1, -1); 200];
        let mut seg_count: usize = 0;
        let mut current = to_node as usize;
        let mut truncated = false;

        while PREV_FROM[current] != -1 {
            if seg_count >= 200 {
                truncated = true;
                break;
            }
            segments[seg_count] = (PREV_EDGE_IDX[current], PREV_EDGE_TYPE[current]);
            seg_count += 1;
            current = PREV_FROM[current] as usize;
        }

        if truncated {
            PATH_RESULT_LEN = 0;
            return 0;
        }

        // Write in forward order to PATH_RESULT
        PATH_RESULT_LEN = seg_count as u32;
        for i in 0..seg_count {
            let rev_i = seg_count - 1 - i;
            PATH_RESULT[i * 2] = segments[rev_i].0 as f64;     // roadIndex
            PATH_RESULT[i * 2 + 1] = segments[rev_i].1 as f64; // edgeType
        }

        seg_count as u32
    }
}

/// Get pointer to path result buffer
#[unsafe(no_mangle)]
pub extern "C" fn pathfinding_get_result_ptr() -> *const f64 {
    unsafe { PATH_RESULT.as_ptr() }
}

/// Get path result length
#[unsafe(no_mangle)]
pub extern "C" fn pathfinding_get_result_len() -> u32 {
    unsafe { PATH_RESULT_LEN }
}

/// Get distance to a node (after dijkstra ran)
#[unsafe(no_mangle)]
pub extern "C" fn pathfinding_get_dist(node: u32) -> f64 {
    if (node as usize) < MAX_NODES {
        unsafe { DIST[node as usize] }
    } else {
        f64::INFINITY
    }
}
