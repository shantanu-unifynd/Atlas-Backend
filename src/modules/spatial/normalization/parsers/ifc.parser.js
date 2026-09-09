const WebIFC = require("web-ifc");

// P3 — IFC/BIM parser. Reads an IFC (STEP) model with web-ifc and emits the
// SAME format-agnostic intermediate the SVG/DXF parsers produce
// ({ root, layers, elements }, with SVG-style primitives), so
// acsm.normalizer.js and every downstream stage run unchanged.
//
// The big win over DXF: IFC carries semantics. Each IfcSpace is a real room
// with a name (LongName) and an exact footprint polygon (the swept area's
// OuterCurve), so rooms are extracted directly — no wall-loop inference.
//
//   IfcSpace  -> tag 'polygon' (footprint) on layer 'IFCSPACE' + a 'text'
//                element carrying the room name (LongName, else Name)
//   IfcWall*  -> tag 'polyline' (wall axis) on layer 'IFCWALL'
//
// Footprint points live in the space's local coordinate system, so we compose
// the placement transform (ObjectPlacement chain x the solid's Position) to
// land them in world XY. IFC is Z-up, so the floor plane is world X/Y.
//
// One IFC file holds every storey; this MVP takes an optional storey selector
// (name or index) and extracts just that storey's spaces/walls. Splitting all
// storeys on upload is a deliberate later step.

const round = (n) => Math.round(n * 100) / 100;

// --- 4x4 matrix helpers (column-major, [c0r0,c0r1,c0r2,c0r3, c1r0, ...]) ---
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function matMul(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
  }
  return r;
}

function apply(mat, x, y, z) {
  return {
    x: mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
    y: mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
    z: mat[2] * x + mat[6] * y + mat[10] * z + mat[14],
  };
}

// Axis/RefDirection are optional in IFC; exporters (Revit) frequently omit
// them, and web-ifc may surface the omitted optional as an object whose ratios
// are undefined. Only trust a direction when every ratio is finite; otherwise
// use the caller's default. 2D directions are padded to Z=0.
const dirOf = (d, fallback) => {
  const r = d && d.DirectionRatios && d.DirectionRatios.map((c) => c && c.value);
  if (r && r.length >= 2 && r.every((n) => Number.isFinite(n))) {
    return r.length === 2 ? [r[0], r[1], 0] : [r[0], r[1], r[2]];
  }
  return fallback;
};
const normalize = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// IfcAxis2Placement3D (or 2D) -> 4x4. Axis = local Z, RefDirection = local X;
// X is re-orthogonalized against Z, Y = Z x X (right-handed).
function axis2placementMatrix(p) {
  if (!p) return IDENTITY.slice();
  const loc = (p.Location && p.Location.Coordinates ? p.Location.Coordinates.map((c) => c.value) : [0, 0, 0]);
  const z = normalize(dirOf(p.Axis, [0, 0, 1]));
  let x = dirOf(p.RefDirection, [1, 0, 0]);
  const d = dot(x, z);
  x = normalize([x[0] - d * z[0], x[1] - d * z[1], x[2] - d * z[2]]);
  const y = cross(z, x);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, loc[0] || 0, loc[1] || 0, loc[2] || 0, 1];
}

// IfcLocalPlacement chain -> composed world matrix (parent x local).
function localPlacementMatrix(lp) {
  if (!lp) return IDENTITY.slice();
  const local = axis2placementMatrix(lp.RelativePlacement);
  if (lp.PlacementRelTo) return matMul(localPlacementMatrix(lp.PlacementRelTo), local);
  return local;
}

// --- extraction helpers -------------------------------------------------

function pointsString(pts) {
  return pts.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

// First representation item whose identifier matches (e.g. 'Body', 'Axis').
function findRep(shape, identifier) {
  const reps = (shape && shape.Representations) || [];
  return reps.find((r) => r.RepresentationIdentifier && r.RepresentationIdentifier.value === identifier);
}

// Ordered profile points in the swept-area coordinate system. Handles the two
// profile kinds real exporters use for rooms: an explicit closed curve
// (IfcArbitraryClosedProfileDef -> OuterCurve polyline) and a parametric
// rectangle (IfcRectangleProfileDef -> XDim/YDim centred on its own Position).
function profilePoints(profile) {
  if (!profile) return null;
  const curve = profile.OuterCurve || profile.Curve;
  const rawPts = curve && curve.Points;
  if (rawPts && rawPts.length >= 3) {
    return rawPts
      .map((p) => (p.Coordinates || []).map((c) => c && c.value))
      .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(([x, y]) => ({ x, y }));
  }
  const xd = profile.XDim && profile.XDim.value;
  const yd = profile.YDim && profile.YDim.value;
  if (Number.isFinite(xd) && Number.isFinite(yd)) {
    const hx = xd / 2;
    const hy = yd / 2;
    const pm = axis2placementMatrix(profile.Position); // rectangle is centred on Position
    return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(([x, y]) => {
      const w = apply(pm, x, y, 0);
      return { x: w.x, y: w.y };
    });
  }
  return null;
}

// Ordered footprint of an IfcSpace in world XY.
function spaceFootprint(space) {
  const body = findRep(space.Representation, "Body") || (space.Representation && (space.Representation.Representations || [])[0]);
  const solid = body && (body.Items || [])[0];
  const local = solid && profilePoints(solid.SweptArea);
  if (!local || local.length < 3) return null;

  const world = matMul(localPlacementMatrix(space.ObjectPlacement), axis2placementMatrix(solid.Position));
  return local.map((p) => {
    const w = apply(world, p.x, p.y, 0);
    return { x: w.x, y: w.y };
  });
}

// Wall centerline (the 'Axis' representation) in world XY.
function wallAxis(wall) {
  const axis = findRep(wall.Representation, "Axis");
  const line = axis && (axis.Items || [])[0];
  const rawPts = line && line.Points;
  if (!rawPts || rawPts.length < 2) return null;
  const world = localPlacementMatrix(wall.ObjectPlacement);
  return rawPts
    .map((p) => (p.Coordinates || []).map((c) => c.value))
    .filter((c) => c.length >= 2)
    .map(([px, py]) => {
      const w = apply(world, px, py, 0);
      return { x: w.x, y: w.y };
    });
}

function centroid(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x: cx, y: cy };
}

// Map each spatial element -> its containing storey expressID, via the
// aggregation/containment relationships (IfcRelAggregates for spaces).
function buildStoreyIndex(api, model) {
  const byChild = new Map();
  for (const relType of [WebIFC.IFCRELAGGREGATES, WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE]) {
    const ids = api.GetLineIDsWithType(model, relType);
    for (let i = 0; i < ids.size(); i++) {
      const rel = api.GetLine(model, ids.get(i));
      const parent = rel.RelatingObject || rel.RelatingStructure;
      const parentId = parent && parent.value;
      const kids = rel.RelatedObjects || rel.RelatedElements || [];
      for (const k of kids) byChild.set(k.value, parentId);
    }
  }
  return byChild;
}

async function parseIfc(buffer, options = {}) {
  const api = new WebIFC.IfcAPI();
  await api.Init();
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const model = api.OpenModel(bytes);

  try {
    // enumerate storeys (name + elevation) for selection/reporting
    const storeyIds = api.GetLineIDsWithType(model, WebIFC.IFCBUILDINGSTOREY);
    const storeys = [];
    for (let i = 0; i < storeyIds.size(); i++) {
      const s = api.GetLine(model, storeyIds.get(i));
      storeys.push({ id: storeyIds.get(i), name: s.Name && s.Name.value, elevation: s.Elevation && s.Elevation.value });
    }
    const childToStorey = buildStoreyIndex(api, model);

    const elements = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const track = (pts) => pts.forEach((p) => {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
    });
    let id = 0;
    const nextId = () => `ifc-${id++}`;

    // resolve target storey: by name, by index, else the one with most spaces
    const spaceIds = api.GetLineIDsWithType(model, WebIFC.IFCSPACE);
    const spaceCountByStorey = new Map();
    for (let i = 0; i < spaceIds.size(); i++) {
      const st = childToStorey.get(spaceIds.get(i));
      spaceCountByStorey.set(st, (spaceCountByStorey.get(st) || 0) + 1);
    }
    let targetStorey = null;
    if (options.storeyName != null) {
      const found = storeys.find((s) => String(s.name).toLowerCase() === String(options.storeyName).toLowerCase());
      targetStorey = found ? found.id : null;
    } else if (Number.isInteger(options.storeyIndex)) {
      targetStorey = storeys[options.storeyIndex] ? storeys[options.storeyIndex].id : null;
    } else {
      let best = -1;
      for (const [st, count] of spaceCountByStorey) if (count > best) { best = count; targetStorey = st; }
    }

    const inTarget = (childId) => targetStorey == null || childToStorey.get(childId) === targetStorey;

    // rooms
    for (let i = 0; i < spaceIds.size(); i++) {
      const eid = spaceIds.get(i);
      if (!inTarget(eid)) continue;
      const space = api.GetLine(model, eid, true);
      const poly = spaceFootprint(space);
      if (!poly || poly.length < 3) continue;
      track(poly);
      elements.push({ id: nextId(), tag: "polygon", layer: "IFCSPACE", attributes: { points: pointsString(poly) } });
      const name = (space.LongName && space.LongName.value) || (space.Name && space.Name.value);
      if (name) {
        const c = centroid(poly);
        elements.push({ id: nextId(), tag: "text", layer: "IFCSPACE", attributes: { x: round(c.x), y: round(c.y) }, text: String(name) });
      }
    }

    // walls (axis centerlines)
    for (const wallType of [WebIFC.IFCWALLSTANDARDCASE, WebIFC.IFCWALL]) {
      const ids = api.GetLineIDsWithType(model, wallType);
      for (let i = 0; i < ids.size(); i++) {
        const eid = ids.get(i);
        if (!inTarget(eid)) continue;
        const wall = api.GetLine(model, eid, true);
        const axis = wallAxis(wall);
        if (!axis || axis.length < 2) continue;
        track(axis);
        elements.push({ id: nextId(), tag: "polyline", layer: "IFCWALL", attributes: { points: pointsString(axis) } });
      }
    }

    if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
    const width = round(maxX - minX);
    const height = round(maxY - minY);
    const layers = [...new Set(elements.map((e) => e.layer))];

    return {
      root: {
        viewBox: `${round(minX)} ${round(minY)} ${width} ${height}`,
        width: String(width),
        height: String(height),
      },
      layers,
      elements,
    };
  } finally {
    api.CloseModel(model);
  }
}

module.exports = { parseIfc };
