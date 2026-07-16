// Stage 4 — Rule Engine.
// Registration, execution, and result collection for deterministic
// classification rules. Every rule must be independently testable,
// versioned, and individually enabled/disabled — this engine enforces that
// shape but holds no classification knowledge itself (see rules/).

const { DETERMINISTIC_RULES } = require("./rules/deterministic-rules");

const registeredRules = [];

function registerRule(rule) {
  if (!rule || typeof rule.evaluate !== "function" || !rule.ruleId) {
    throw new Error("A rule must have a ruleId and an evaluate(evidence) function");
  }

  if (registeredRules.some((r) => r.ruleId === rule.ruleId)) {
    throw new Error(`A rule with ruleId '${rule.ruleId}' is already registered`);
  }

  registeredRules.push(rule);
}

function getRegisteredRules() {
  return [...registeredRules];
}

// Executes every enabled rule against each USO's evidence and collects only
// the matches (matched: true). Non-matches carry no information downstream.
function executeRules(evidenceList) {
  const enabledRules = registeredRules.filter((rule) => rule.enabled);

  const executions = evidenceList.map((evidence) => {
    const matches = enabledRules
      .map((rule) => {
        const outcome = rule.evaluate(evidence);

        if (!outcome || !outcome.matched) {
          return null;
        }

        return {
          ruleId: rule.ruleId,
          ruleName: rule.ruleName,
          priority: rule.priority,
          version: rule.version,
          classification: outcome.proposedClassification,
          evidence: outcome.evidence,
        };
      })
      .filter(Boolean);

    return { usoId: evidence.usoId, matches };
  });

  return { executions, rulesExecuted: enabledRules.length };
}

// Registered once, at module load, so every service call sees the same set
// without re-registering per request.
DETERMINISTIC_RULES.forEach(registerRule);

module.exports = {
  registerRule,
  getRegisteredRules,
  executeRules,
};
