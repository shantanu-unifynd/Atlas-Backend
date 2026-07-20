// A minimal binary min-heap keyed by cost. Only used to decide traversal
// ORDER (which unvisited node to relax next) — it never decides which of
// two equal-cost PATHS wins for a given node. That's handled explicitly in
// relaxNeighbor's tie-break rule below, so heap-internal tie order between
// equal-cost entries has no effect on the algorithm's output.
class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    this._bubbleUp(this.items.length - 1);
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();

    if (this.items.length > 0) {
      this.items[0] = last;
      this._bubbleDown(0);
    }

    return top;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);

      if (this.items[parentIndex].cost <= this.items[index].cost) {
        break;
      }

      [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
      index = parentIndex;
    }
  }

  _bubbleDown(index) {
    const length = this.items.length;

    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < length && this.items[left].cost < this.items[smallest].cost) {
        smallest = left;
      }

      if (right < length && this.items[right].cost < this.items[smallest].cost) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }
}

// Stage 3 — Dijkstra Engine. Standard deterministic Dijkstra over a
// directed, weighted adjacency list (traversalCost as edge weight). Never
// mutates the adjacency list or any input. Returns only { path, totalCost }
// — no Route/RouteSegment/Instruction concepts exist at this layer.
//
// Tie-breaking rule (documented per spec): when two distinct paths reach
// the same node at EXACTLY equal total cost, the path arriving via the
// predecessor with the lexicographically smaller node ID wins. This is
// evaluated explicitly during edge relaxation, independent of heap
// extraction order or edge/node iteration order, so the result is fully
// deterministic regardless of those incidental orderings.
function computeShortestPath(adjacency, originNodeId, destinationNodeId) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  for (const nodeId of adjacency.keys()) {
    dist.set(nodeId, Infinity);
    prev.set(nodeId, null);
  }

  dist.set(originNodeId, 0);

  const heap = new MinHeap();
  heap.push({ nodeId: originNodeId, cost: 0 });

  while (heap.size > 0) {
    const current = heap.pop();

    if (visited.has(current.nodeId)) {
      continue;
    }

    visited.add(current.nodeId);

    if (current.nodeId === destinationNodeId) {
      break;
    }

    const neighbors = adjacency.get(current.nodeId) || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.neighborId)) {
        continue;
      }

      const newCost = dist.get(current.nodeId) + neighbor.cost;
      const existingCost = dist.get(neighbor.neighborId);

      if (newCost < existingCost) {
        dist.set(neighbor.neighborId, newCost);
        prev.set(neighbor.neighborId, current.nodeId);
        heap.push({ nodeId: neighbor.neighborId, cost: newCost });
      } else if (newCost === existingCost && existingCost !== Infinity) {
        const existingPredecessor = prev.get(neighbor.neighborId);

        if (existingPredecessor !== null && current.nodeId < existingPredecessor) {
          prev.set(neighbor.neighborId, current.nodeId);
        }
      }
    }
  }

  if (dist.get(destinationNodeId) === Infinity) {
    return null;
  }

  const path = [];
  let step = destinationNodeId;

  while (step !== null) {
    path.unshift(step);
    step = prev.get(step);
  }

  return { path, totalCost: dist.get(destinationNodeId) };
}

module.exports = { computeShortestPath };
