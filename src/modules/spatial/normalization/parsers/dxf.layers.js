// P2 — CAD layer-role classification.
// Real DXFs use arbitrary, often xref-prefixed layer names
// (e.g. "xref-Bishop-Overland-08$0$A-WALL", "A-DIMS-1", "S-STEM-WALL").
// This maps ANY layer name to a semantic role so extraction keeps
// rooms/walls/doors/labels and drops dimensions, structural, roof, furniture,
// etc. Keyword substring matching handles xref prefixes and vendor variations.
// Order matters: noise (structural/roof/dims) is checked BEFORE wall so that
// "S-STEM-WALL" is ignored rather than treated as an architectural wall.

const ROLE = { ROOM: 'room', WALL: 'wall', DOOR: 'door', LABEL: 'label', IGNORE: 'ignore', UNKNOWN: 'unknown' };

const RULES = [
  [ROLE.IGNORE, [
    /DEFPOINT/, /\bDIM/, /HATCH/, /GRID/, /VIEWPORT/, /TITLE/, /^0$/, /^\d+$/,
    /(^|\$|-)S-/, /STEM/, /FOOTER/, /SLAB/,
    /(^|\$|-)R-/, /TRUSS/, /\bBEAM/, /JOIST/, /OVERB/, /OVERH/, /(^|\$|-)FF-/,
    /TEMP/, /CASE/, /FIXTURE/, /FURN/, /EQUIP/, /CENTER/, /MATCH/,
  ]],
  [ROLE.ROOM, [/A-?AREA/, /\bROOM/, /SPACE/, /A-?FLOR/, /FOOTPRINT/, /\bUNIT/, /TENANT/]],
  [ROLE.DOOR, [/A-?DOOR/, /\bDOOR/, /OPENING/, /GARAGE/, /HEADER/, /WINDOW/, /GLAZ/, /\bJAMB/]],
  [ROLE.WALL, [/A-?WALL/, /\bWALL/, /PARTITION/, /\bPART\b/]],
  [ROLE.LABEL, [/A-?ANNO/, /A-?TEXT/, /\bTEXT/, /LABEL/, /ANNTEXT/, /\bNOTE/, /\bANN\b/, /IDEN/]],
];

function classifyLayer(name) {
  const n = String(name || '').toUpperCase();
  for (const [role, patterns] of RULES) {
    if (patterns.some((re) => re.test(n))) return role;
  }
  return ROLE.UNKNOWN;
}

module.exports = { ROLE, classifyLayer };
