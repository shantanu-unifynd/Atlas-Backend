// First generation of deterministic classification rules (Sprint 05 Story
// 05 Phase B). Each rule reasons over Evidence Collector output only —
// spatialCategory here, nothing else — and is individually testable,
// versioned, and independently enabled/disabled. Every rule in this initial
// set targets a different, mutually exclusive spatialCategory, so in
// practice at most one of these five can ever match a given USO; the
// Conflict Resolver framework still exists for when a future rule set
// introduces genuine overlap.

function categoryRule({ ruleId, ruleName, description, priority, version, spatialCategory, category, subCategory = null }) {
  return {
    ruleId,
    ruleName,
    description,
    priority,
    version,
    enabled: true,
    classification: { category, subCategory },
    evaluate(evidence) {
      if (evidence.spatialCategory !== spatialCategory) {
        return { matched: false };
      }

      return {
        matched: true,
        evidence: { spatialCategory: evidence.spatialCategory },
        proposedClassification: { category, subCategory },
      };
    },
  };
}

const DETERMINISTIC_RULES = [
  // STRUCTURAL RULES
  categoryRule({
    ruleId: "SEM-001",
    ruleName: "Structural Wall Classification",
    description: "A USO with spatialCategory WALL represents a structural wall.",
    priority: 100,
    version: 1,
    spatialCategory: "WALL",
    category: "STRUCTURAL_WALL",
  }),

  // SPATIAL RULES
  categoryRule({
    ruleId: "SEM-002",
    ruleName: "Corridor Classification",
    description: "A USO with spatialCategory PASSAGE represents a corridor.",
    priority: 100,
    version: 1,
    spatialCategory: "PASSAGE",
    category: "CORRIDOR",
  }),
  categoryRule({
    ruleId: "SEM-003",
    ruleName: "Doorway Classification",
    description: "A USO with spatialCategory OPENING represents a doorway.",
    priority: 100,
    version: 1,
    spatialCategory: "OPENING",
    category: "DOORWAY",
  }),
  categoryRule({
    ruleId: "SEM-004",
    ruleName: "Room Classification",
    description: "A USO with spatialCategory ENCLOSURE represents a room.",
    priority: 100,
    version: 1,
    spatialCategory: "ENCLOSURE",
    category: "ROOM",
  }),
  categoryRule({
    ruleId: "SEM-005",
    ruleName: "Vertical Connector Classification",
    description: "A USO with spatialCategory VERTICAL_CONNECTION represents a vertical connector.",
    priority: 100,
    version: 1,
    spatialCategory: "VERTICAL_CONNECTION",
    category: "VERTICAL_CONNECTOR",
  }),
];

// Version of this rule catalog as a whole — bumped when rules are added,
// removed, or re-tuned as a set, independent of any single rule's own
// `version` or the rule-execution engine's own version.
const CLASSIFICATION_VERSION = "1.0.0";

module.exports = {
  DETERMINISTIC_RULES,
  CLASSIFICATION_VERSION,
};
