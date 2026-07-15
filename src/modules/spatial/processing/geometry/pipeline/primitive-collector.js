// Stage 1 — Primitive Collection.
// Accepts the ACSM, collects its geometric primitives (a defensive copy —
// no modification), groups them by primitive type, and computes basic
// statistics. Still no geometric interpretation: that begins in the
// Geometry Cleaner.

function collectPrimitives(acsm) {
  const primitives = acsm.elements.map((element) => ({ ...element }));

  const byType = {};
  const countsByType = {};
  const countsByLayer = {};

  for (const primitive of primitives) {
    (byType[primitive.type] ||= []).push(primitive);
    countsByType[primitive.type] = (countsByType[primitive.type] || 0) + 1;

    const layerKey = primitive.layer || "unlayered";
    countsByLayer[layerKey] = (countsByLayer[layerKey] || 0) + 1;
  }

  const statistics = {
    totalCount: primitives.length,
    countsByType,
    countsByLayer,
  };

  return { primitives, byType, statistics };
}

module.exports = {
  collectPrimitives,
};
