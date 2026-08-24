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

    // BXP-12 — a <path> may decompose into multiple independent subpaths;
    // primitiveToGeometry returns an array of geometry entries for "path"
    // (one per subpath, even when there's only one), a single object for
    // every other type. Normalize to a list so the rest of this loop
    // doesn't need to know which.
    const parsedEntries = Array.isArray(parsed) ? parsed : [parsed];

    parsedEntries.forEach((entry, index) => {
      // Only multi-subpath paths get a suffixed id — the common case (one
      // subpath, or any non-path primitive) keeps its original element id
      // unchanged.
      const id = parsedEntries.length > 1 ? `${primitive.id}-sub${index}` : primitive.id;

      if (isZeroLength(primitive.type, entry.geometry, entry.segments)) {
        removed.invalid.push({ id, type: primitive.type, reason: "zero-length or degenerate geometry" });
        return;
      }

      const key = geometryKey(primitive.type, primitive.layer, entry.geometry);

      if (seenKeys.has(key)) {
        removed.duplicates.push({ id, type: primitive.type, reason: "duplicate of an earlier primitive in the same layer" });
        return;
      }

      seenKeys.add(key);

      cleaned.push({
        id,
        type: primitive.type,
        layer: primitive.layer,
        ...(primitive.text !== undefined ? { text: primitive.text } : {}),
        geometry: entry.geometry,
        segments: entry.segments,
        closed: entry.closed,
      });
    });
  }

  return { cleaned, removed };
}

module.exports = {
  cleanGeometry,
};
