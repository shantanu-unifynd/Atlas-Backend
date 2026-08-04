// MPM-04 — walls, openings, labels from normalized geometry + assembled rooms.
// Everything is emitted in the canonical world coordinate space (the geometry
// primitives are already normalized by MPM-02).

const EPS = 0.05;

function primitivePolyline(prim) {
  if (!prim || !Array.isArray(prim.segments)) return [];
  const pts = [];
  const push = (p) => {
    const last = pts[pts.length - 1];
    if (!last || Math.abs(last.x - p.x) > EPS || Math.abs(last.y - p.y) > EPS) {
      pts.push({ x: p.x, y: p.y });
    }
  };
  for (const s of prim.segments) {
    push({ x: s.x1, y: s.y1 });
    push({ x: s.x2, y: s.y2 });
  }
  return pts;
}

function primitiveCenter(prim) {
  const pts = primitivePolyline(prim);
  if (!pts.length) return null;
  const c = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: Math.round((c.x / pts.length) * 100) / 100, y: Math.round((c.y / pts.length) * 100) / 100 };
}

// candidateWall: { id, primitiveId } -> a normalized polyline.
function extractWalls(primitivesById, candidateWalls) {
  const walls = [];
  for (const w of candidateWalls || []) {
    const polyline = primitivePolyline(primitivesById.get(w.primitiveId));
    if (polyline.length >= 2) walls.push({ id: `wall-${w.id}`, polyline });
  }
  return walls;
}

// Doors (candidateOpenings) + passages (candidatePassages) -> a point each.
function extractOpenings(primitivesById, candidateOpenings, candidatePassages) {
  const openings = [];
  const add = (list, type) => {
    for (const o of list || []) {
      const ids = o.primitiveIds || (o.primitiveId ? [o.primitiveId] : []);
      let position = null;
      for (const pid of ids) {
        const c = primitiveCenter(primitivesById.get(pid));
        if (c) { position = c; break; }
      }
      if (position) openings.push({ id: `opening-${o.id}`, type, position });
    }
  };
  add(candidateOpenings, "DOOR");
  add(candidatePassages, "PASSAGE");
  return openings;
}

// Labels are derived from the already-assembled rooms (which incorporated
// USO/Semantic + node names), placed at the room's centroid (polygon) or point
// (fallback), and associated back to the room. Normalized world coordinates.
function extractLabels(rooms) {
  const labels = [];
  for (const r of rooms || []) {
    if (!r.name) continue;
    const position = r.centroid || r.point || null;
    if (!position) continue;
    labels.push({
      id: `label-${r.id}`,
      text: r.name,
      position,
      roomId: r.id,
      kind: "room",
      source: r.source || "SEMANTIC",
    });
  }
  return labels;
}

module.exports = { extractWalls, extractOpenings, extractLabels };
