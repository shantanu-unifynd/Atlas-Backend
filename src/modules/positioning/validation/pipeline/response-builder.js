// Stage 3 — Response Builder. Pure assembly, no persistence, no
// publication, no database writes.
function build(errors, warnings, statistics) {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics,
    validatedAt: new Date().toISOString(),
  };
}

module.exports = { build };
