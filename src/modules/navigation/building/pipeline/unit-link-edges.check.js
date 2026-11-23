// Part 3D — repeatable check for the two-floor-shop routing bridge. The backend
// has no JS test runner, so this is a self-asserting node script:
//   node src/modules/navigation/building/pipeline/unit-link-edges.check.js
// Exits non-zero on the first failed assertion.
const { buildUnitLinks, allowedUnitGraph, pointInPolygon } = require("./unit-link-edges");

let passed = 0;
function ok(label, cond) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  passed += 1;
  console.log("ok  -", label);
}

const sq = (x0, y0, x1, y1) => [
  { x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 },
];

// Flagship spans level 0 (ground) and level 1; shop B is a separate shop on L1.
function floors(isPublic) {
  return [
    {
      floorId: "F0",
      level: 0,
      rooms: [
        { unitId: "u1", polygon: sq(300, 300, 400, 400), inStoreConnectors: [{ kind: "lift", ring: sq(340, 340, 360, 360), publicPassThrough: isPublic }] },
      ],
    },
    {
      floorId: "F1",
      level: 1,
      rooms: [
        { unitId: "u1", polygon: sq(300, 300, 400, 400), inStoreConnectors: [{ kind: "lift", ring: sq(340, 340, 360, 360), publicPassThrough: isPublic }] },
        { unitId: null, polygon: sq(50, 50, 120, 120) },
      ],
    },
  ];
}

const insideFlagshipUpper = { position: { x: 350, y: 350 }, floorId: "F1" };
const groundCorridor = { position: { x: 600, y: 600 }, floorId: "F0" };
const shopB = { position: { x: 80, y: 80 }, floorId: "F1" };

// buildUnitLinks
const links = buildUnitLinks(floors(false));
ok("one unit link built", links.length === 1);
ok("two connector nodes (one per floor)", links[0].connectors.length === 2);
ok("two directed transitions (up + down)", links[0].transitions.length === 2);
ok("nodeType maps lift -> ELEVATOR", links[0].connectors.every((c) => c.nodeType === "ELEVATOR"));
ok("private by default", links[0].publicPassThrough === false);

// single-floor unit must NOT produce a link
const soloLink = buildUnitLinks([
  { floorId: "F0", level: 0, rooms: [{ unitId: "solo", polygon: sq(0, 0, 10, 10) }] },
]);
ok("a one-floor unit yields no vertical hop", soloLink.length === 0);

// private rule
ok("destination inside the unit -> hop allowed", allowedUnitGraph(links, [groundCorridor, insideFlagshipUpper]).transitions.length === 2);
ok("corridor -> shop B (private) -> hop blocked", allowedUnitGraph(links, [groundCorridor, shopB]).transitions.length === 0);
ok("neither endpoint in the unit (private) -> blocked", allowedUnitGraph(links, [groundCorridor]).transitions.length === 0);

// public pass-through overrides the private rule
const publicLinks = buildUnitLinks(floors(true));
ok("public connector detected", publicLinks[0].publicPassThrough === true);
ok("corridor -> shop B (public) -> hop allowed", allowedUnitGraph(publicLinks, [groundCorridor, shopB]).transitions.length === 2);

// pointInPolygon
ok("point inside polygon", pointInPolygon({ x: 350, y: 350 }, sq(300, 300, 400, 400)) === true);
ok("point outside polygon", pointInPolygon({ x: 10, y: 10 }, sq(300, 300, 400, 400)) === false);

console.log(`\n${passed} checks passed`);
