// Self-asserting check for engulfed-room containment.
//   node src/modules/spatial/mapModel/pipeline/room-containment.check.js
const { isEngulfed, containedRoomIds } = require('./room-containment');

let passed = 0;
const ok = (l, c) => { if (!c) { console.error('FAIL:', l); process.exit(1); } passed += 1; console.log('ok  -', l); };

const sq = (x0, y0, x1, y1, id) => ({ id, polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] });
const container = sq(0, 0, 100, 100, 'C');

ok('a room fully inside is engulfed', isEngulfed(container, sq(20, 20, 40, 40, 'in')));
ok('a room poking one vertex outside is NOT engulfed', !isEngulfed(container, sq(90, 90, 110, 110, 'poke')));
ok('a room equal to the container is NOT engulfed (not smaller)', !isEngulfed(container, sq(0, 0, 100, 100, 'equal')));
ok('the container itself is NOT engulfed (same id)', !isEngulfed(container, container));
// Flush in a corner (every vertex inside-or-on the container) counts as inside;
// only a room with a vertex STRICTLY outside is excluded (the "poke" case above).
ok('a room flush in the container corner (all vertices inside) is engulfed', isEngulfed(container, sq(0, 0, 20, 20, 'corner')));
ok('a point room inside is engulfed', isEngulfed(container, { id: 'pt-in', point: { x: 50, y: 50 } }));
ok('a point room outside is NOT engulfed', !isEngulfed(container, { id: 'pt-out', point: { x: 150, y: 50 } }));
ok('a container with no polygon engulfs nothing', !isEngulfed({ id: 'noPoly', point: { x: 1, y: 1 } }, sq(2, 2, 3, 3, 'x')));

const rooms = [
  container,
  sq(10, 10, 20, 20, 'a'),
  sq(30, 30, 45, 45, 'b'),
  sq(95, 95, 120, 120, 'edge'),
  { id: 'pt', point: { x: 60, y: 60 } },
  sq(200, 200, 210, 210, 'far'),
];
const ids = containedRoomIds(container, rooms);
ok('containedRoomIds returns only the inside rooms', JSON.stringify(ids.sort()) === JSON.stringify(['a', 'b', 'pt']));
ok('containedRoomIds excludes the container, edge-clipper, and far room', !ids.includes('C') && !ids.includes('edge') && !ids.includes('far'));

console.log(`\n${passed} checks passed`);
