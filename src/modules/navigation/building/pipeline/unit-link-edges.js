// Part 3D — bridge two-floor shops into the building route graph.
//
// A shop that spans floors shares one `unitId` across its per-floor rooms
// (baked into the published MPM by toManualRoom). Routing has no concept of
// that link, so at read time we synthesize, PER UNIT, a CONNECTOR node on each
// floor (anchored at the in-store connector) and a VERTICAL transition between
// consecutive floors — exactly the shape of an admin-confirmed connector pair,
// so the assembler and splitPathByFloor need no change and the "go up the
// shop's stairs" step narrates correctly.
//
// Private rule: a unit's synthesized hop is included only when the route's
// origin or destination sits INSIDE that unit (point-in-polygon against the
// unit's rooms), UNLESS the connector is marked publicPassThrough. Enforced by
// filtering candidates before assembly — a private shop is never a shortcut.

const KIND_TO_NODE_TYPE = { stairs: "STAIR", lift: "ELEVATOR", escalator: "ESCALATOR" };

function centroid(ring) {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

// Ray-casting point-in-polygon. poly = [{x,y}...].
function pointInPolygon(pt, poly) {
  if (!pt || !Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const denom = yj - yi || 1e-12;
    const hit = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / denom + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

// floorEntries: [{ floorId, level, rooms:[{ unitId, polygon, inStoreConnectors }] }]
// Returns candidate unit links (not yet filtered by the route's endpoints):
// [{ unitId, publicPassThrough, floors:[{floorId, polygons:[[{x,y}]]}],
//    connectors:[{id,floorId,nodeType,position,label}],
//    transitions:[{id,sourceNodeId,targetNodeId}] }]
function buildUnitLinks(floorEntries) {
  const byUnit = new Map();
  for (const entry of floorEntries) {
    for (const room of entry.rooms || []) {
      if (!room || !room.unitId) continue;
      if (!byUnit.has(room.unitId)) byUnit.set(room.unitId, []);
      byUnit.get(room.unitId).push({ ...room, floorId: entry.floorId, level: entry.level });
    }
  }

  const links = [];
  for (const [unitId, rooms] of byUnit) {
    // One anchor per floor: the first room on that floor with usable geometry.
    const anchorByFloor = new Map();
    for (const room of rooms) {
      const conns = Array.isArray(room.inStoreConnectors) ? room.inStoreConnectors : [];
      const conn = conns.find((c) => Array.isArray(c.ring) && c.ring.length >= 3) || null;
      const hasPolygon = Array.isArray(room.polygon) && room.polygon.length >= 3;
      const position = conn ? centroid(conn.ring) : hasPolygon ? centroid(room.polygon) : null;
      if (!position) continue;
      const nodeType = conn ? KIND_TO_NODE_TYPE[conn.kind] || "STAIR" : "STAIR";
      const isPublic = conn ? conn.publicPassThrough === true : false;
      if (!anchorByFloor.has(room.floorId)) {
        anchorByFloor.set(room.floorId, {
          floorId: room.floorId,
          level: room.level,
          position,
          nodeType,
          publicPassThrough: isPublic,
          polygons: [],
        });
      }
      const a = anchorByFloor.get(room.floorId);
      if (hasPolygon) a.polygons.push(room.polygon);
      if (isPublic) a.publicPassThrough = true;
    }

    const anchors = [...anchorByFloor.values()]
      .filter((a) => a.level != null)
      .sort((x, y) => x.level - y.level);
    if (anchors.length < 2) continue; // not a multi-floor unit on the published floors

    const connectors = anchors.map((a) => ({
      id: `unit:${unitId}:${a.floorId}`,
      floorId: a.floorId,
      nodeType: a.nodeType,
      position: a.position,
      label: `In-store ${String(a.nodeType).toLowerCase()}`,
    }));
    const transitions = [];
    for (let i = 0; i + 1 < anchors.length; i += 1) {
      const a = connectors[i];
      const b = connectors[i + 1];
      transitions.push({ id: `unit:${unitId}:${a.floorId}->${b.floorId}`, sourceNodeId: a.id, targetNodeId: b.id });
      transitions.push({ id: `unit:${unitId}:${b.floorId}->${a.floorId}`, sourceNodeId: b.id, targetNodeId: a.id });
    }
    links.push({
      unitId,
      publicPassThrough: anchors.some((a) => a.publicPassThrough),
      floors: anchors.map((a) => ({ floorId: a.floorId, polygons: a.polygons })),
      connectors,
      transitions,
    });
  }
  return links;
}

// Pick the unit links allowed for THIS route and return the connectors +
// transitions to merge into the building graph. endpoints = [{position, floorId}]
// for the origin and destination floor nodes.
function allowedUnitGraph(unitLinks, endpoints) {
  const connectors = [];
  const transitions = [];
  for (const link of unitLinks) {
    let allowed = link.publicPassThrough;
    if (!allowed) {
      for (const ep of endpoints) {
        if (!ep || !ep.position) continue;
        const floor = link.floors.find((f) => f.floorId === ep.floorId);
        if (!floor) continue;
        if (floor.polygons.some((poly) => pointInPolygon(ep.position, poly))) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) continue;
    connectors.push(...link.connectors);
    transitions.push(...link.transitions);
  }
  return { connectors, transitions };
}

module.exports = { buildUnitLinks, allowedUnitGraph, pointInPolygon };
