// Stage 4 — Response Builder. Pure assembly, no persistence, no
// publication, no database writes.
function build(events, generatedAt) {
  const eventTypeCounts = {};

  events.forEach((event) => {
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;
  });

  return {
    events,
    statistics: {
      totalEvents: events.length,
      eventTypeCounts,
    },
    generatedAt,
  };
}

module.exports = { build };
