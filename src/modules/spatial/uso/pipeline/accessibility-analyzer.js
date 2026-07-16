// Stage 5 — Accessibility Analyzer.
// Populates traversable/walkable/obstacle/verticalConnector with fixed,
// deterministic defaults keyed ONLY by spatialCategory — a lookup table,
// not inference. Never touches wheelchair accessibility, emergency
// accessibility, restricted access or public/private, all of which require
// real-world judgment out of scope for this phase.
//
// ENCLOSURE deliberately gets neutral (all-false) defaults rather than an
// asserted traversable/walkable=true: whether an enclosed area is actually
// walkable depends on what's inside it (columns, fixtures, subdivisions),
// which isn't known at this phase — "initialize defaults only", not a
// confident geometric claim the way Opening/Passage's traversability is.
const DEFAULTS_BY_CATEGORY = {
  BOUNDARY: { traversable: false, walkable: false, obstacle: true, verticalConnector: false },
  WALL: { traversable: false, walkable: false, obstacle: true, verticalConnector: false },
  ENCLOSURE: { traversable: false, walkable: false, obstacle: false, verticalConnector: false },
  OPENING: { traversable: true, walkable: true, obstacle: false, verticalConnector: false },
  PASSAGE: { traversable: true, walkable: true, obstacle: false, verticalConnector: false },
  VERTICAL_CONNECTION: { traversable: true, walkable: false, obstacle: false, verticalConnector: true },
};

function analyzeAccessibility(usos) {
  return usos.map((uso) => ({
    ...uso,
    accessibility: { ...DEFAULTS_BY_CATEGORY[uso.spatialCategory] },
  }));
}

module.exports = {
  analyzeAccessibility,
};
