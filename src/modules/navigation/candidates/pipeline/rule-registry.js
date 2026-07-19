const roomEntryRule = require("./rules/room-entry.rule");
const corridorIntersectionRule = require("./rules/corridor-intersection.rule");
const deadEndRule = require("./rules/dead-end.rule");
const verticalConnectorRule = require("./rules/vertical-connector.rule");
const buildingEntryRule = require("./rules/building-entry.rule");

// Order matters only in the sense that the first matching rule wins. By
// construction each rule keys off a disjoint semanticCategory bucket
// (DOORWAY / CORRIDOR / VERTICAL_CONNECTOR), so at most one rule can ever
// match a given Semantic Object — there is no real conflict to resolve.
const RULES = [
  roomEntryRule,
  corridorIntersectionRule,
  deadEndRule,
  verticalConnectorRule,
  buildingEntryRule,
];

module.exports = { RULES };
