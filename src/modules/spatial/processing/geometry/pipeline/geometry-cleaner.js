// Stage 2 — Geometry Cleaning.
// Phase B: lightweight normalization only — duplicate removal, zero-length
// removal, empty/invalid geometry removal, and coordinate normalization
// (parsing raw SVG attribute strings into rounded numeric geometry).
// Deliberately NOT here: polygon repair, segment merging, or any other
// "advanced repair algorithm" — those belong to a later phase.

const { primitiveToGeometry, isZeroLength, geometryKey } = require("./svg-geometry.util");

function cleanGeometry(primitives) {
  const seenKeys = new Set();
  const cleaned = [];
  const removed = { invalid: [], duplicates: [] };

  for (const primitive of primitives) {
    const parsed = primitiveToGeometry(primitive);

    if (!parsed) {
      removed.invalid.push({ id: primitive.id, type: primitive.type, reason: "missing or malformed required attributes" });
      continue;
    }

    if (isZeroLength(primitive.type, parsed.geometry, parsed.segments)) {
      removed.invalid.push({ id: primitive.id, type: primitive.type, reason: "zero-length or degenerate geometry" });
      continue;
    }

    const key = geometryKey(primitive.type, primitive.layer, parsed.geometry);

    if (seenKeys.has(key)) {
      removed.duplicates.push({ id: primitive.id, type: primitive.type, reason: "duplicate of an earlier primitive in the same layer" });
      continue;
    }

    seenKeys.add(key);

    cleaned.push({
      id: primitive.id,
      type: primitive.type,
      layer: primitive.layer,
      ...(primitive.text !== undefined ? { text: primitive.text } : {}),
      geometry: parsed.geometry,
      segments: parsed.segments,
      closed: parsed.closed,
    });
  }

  return { cleaned, removed };
}

module.exports = {
  cleanGeometry,
};
