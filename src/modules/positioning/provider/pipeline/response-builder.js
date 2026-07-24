// Stage 3 — Response Builder. Pure assembly of the normalized Position
// returned to the caller. No persistence, no publication, no database
// writes — the position never touches Postgres at any point in this
// pipeline.
function build(position, providerName) {
  return {
    graphId: position.graphId,
    source: position.source,
    coordinates: position.coordinates,
    recordedAt: position.recordedAt,
    metadata: position.metadata || {},
    provider: providerName,
  };
}

module.exports = { build };
