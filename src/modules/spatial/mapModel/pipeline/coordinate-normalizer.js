// MPM-02 — coordinate normalization. Each ACSM element carries its own SVG
// transform (matrix(a,b,c,d,e,f)); the geometry model's cleanedGeometry stores
// primitive coordinates in raw, un-transformed space. This applies each
// primitive's transform so ALL geometry lands in ONE canonical world space —
// the normalized ACSM bounds, the same space graph/node positions already use.
// Only normalized (world) coordinates are emitted.

function parseMatrix(transform) {
  if (!transform || typeof transform !== "string") return null;
  const match = transform.match(/matrix\(\s*([-\d.eE\s,]+)\)/);
  if (!match) return null;
  const n = match[1].split(/[\s,]+/).map(Number).filter((v) => Number.isFinite(v));
  return n.length === 6 ? n : null;
}

function applyMatrix(m, x, y) {
  if (!m) return { x, y };
  const [a, b, c, d, e, f] = m;
  return {
    x: Math.round((a * x + c * y + e) * 100) / 100,
    y: Math.round((b * x + d * y + f) * 100) / 100,
  };
}

// BXP-14 hotfix — a <path> element with multiple subpaths (BXP-12A) is
// split into several cleanedGeometry primitives with derived ids
// (`${elementId}-sub${n}`), none of which match the original ACSM
// element's id directly. Falling back to the base element id recovers the
// correct transform for these; every other id (the vast majority, and all
// non-path types) matches directly on the first attempt as before.
function baseElementId(primitiveId) {
  const match = /^(.*)-sub\d+$/.exec(primitiveId);
  return match ? match[1] : primitiveId;
}

// geometryModel: the stored GeometryModel record (has cleanedGeometry).
// normalizedBlueprint: the stored NormalizedBlueprint record (ACSM: elements
// with attributes.transform, bounds, coordinateSystem).
function normalizeGeometry(geometryModel, normalizedBlueprint) {
  const acsm = normalizedBlueprint || {};
  const elements = Array.isArray(acsm.elements) ? acsm.elements : [];
  const transformById = new Map(
    elements.map((el) => [el.id, parseMatrix(el.attributes && el.attributes.transform)])
  );

  const cleaned = Array.isArray(geometryModel.cleanedGeometry) ? geometryModel.cleanedGeometry : [];
  let matchedTransforms = 0;
  const primitives = [];

  for (const primitive of cleaned) {
    const lookupId = transformById.has(primitive.id) ? primitive.id : baseElementId(primitive.id);
    const hasTransform = transformById.has(lookupId);
    const matrix = hasTransform ? transformById.get(lookupId) : null;
    if (hasTransform) matchedTransforms += 1;

    const segments = Array.isArray(primitive.segments) ? primitive.segments : [];
    const worldSegments = segments.map((s) => {
      const p1 = applyMatrix(matrix, s.x1, s.y1);
      const p2 = applyMatrix(matrix, s.x2, s.y2);
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    });

    primitives.push({
      id: primitive.id,
      type: primitive.type,
      closed: Boolean(primitive.closed),
      segments: worldSegments,
    });
  }

  const coordinateSystem = {
    units: (acsm.coordinateSystem && acsm.coordinateSystem.units) || "px",
    yAxis: "down",
    bounds: acsm.bounds || null,
  };

  return {
    coordinateSystem,
    primitives,
    stats: { primitiveCount: primitives.length, matchedTransforms },
  };
}

module.exports = { normalizeGeometry, parseMatrix, applyMatrix };
