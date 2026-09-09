const DxfParserModule = require("dxf-parser");

// P1 — DXF parser. Reads an ASCII DXF and emits the SAME format-agnostic
// intermediate shape the SVG parser produces ({ root, layers, elements }), with
// elements carrying SVG-STYLE primitives — so acsm.normalizer.js and every
// downstream stage (geometry -> USO -> semantic -> MPM) consume it unchanged.
//   closed LWPOLYLINE/POLYLINE -> tag 'polygon' (attributes.points)
//   open polyline / LINE       -> tag 'polyline' / 'line'
//   TEXT / MTEXT               -> tag 'text' (attributes.x,y + text string)
//   CIRCLE                     -> tag 'circle'
// DXF has no viewBox, so we synthesize root.viewBox from the entity extents.

const DxfParser = DxfParserModule.default || DxfParserModule;
const { ROLE, classifyLayer } = require("./dxf.layers");

function round(n) {
  return Math.round(n * 100) / 100;
}

function pointsString(vertices) {
  return vertices.map((v) => `${round(v.x)},${round(v.y)}`).join(" ");
}

function parseDxf(rawText) {
  const parser = new DxfParser();
  const dxf = parser.parseSync ? parser.parseSync(rawText) : parser.parse(rawText);
  const entities = (dxf && dxf.entities) || [];

  const elements = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const track = (x, y) => {
    if (Number.isFinite(x) && Number.isFinite(y)) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  };

  let i = 0;
  for (const e of entities) {
    const type = String(e.type || "").toUpperCase();
    const layer = e.layer || null;
    // P2 — classify the layer; drop dimensions/structural/roof/furniture noise.
    const role = classifyLayer(layer);
    if (role === ROLE.IGNORE) continue;
    const id = `dxf-${i}`;
    i += 1;

    if (type === "LWPOLYLINE" || type === "POLYLINE") {
      const verts = (e.vertices || []).filter((v) => Number.isFinite(v.x) && Number.isFinite(v.y));
      if (verts.length < 2) continue;
      verts.forEach((v) => track(v.x, v.y));
      const closed = e.shape === true || e.closed === true;
      // Walls/doors are never rooms; only room/unknown closed polylines -> room polygons.
      const tag = role === ROLE.WALL || role === ROLE.DOOR
        ? "polyline"
        : closed && verts.length >= 3 ? "polygon" : "polyline";
      elements.push({ id, tag, layer, attributes: { points: pointsString(verts) } });
    } else if (type === "LINE") {
      const s = e.vertices ? e.vertices[0] : e.start;
      const en = e.vertices ? e.vertices[1] : e.end;
      if (!s || !en) continue;
      track(s.x, s.y);
      track(en.x, en.y);
      elements.push({
        id,
        tag: "line",
        layer,
        attributes: { x1: round(s.x), y1: round(s.y), x2: round(en.x), y2: round(en.y) },
      });
    } else if (type === "TEXT" || type === "MTEXT") {
      const p = e.startPoint || e.position || { x: 0, y: 0 };
      track(p.x, p.y);
      const text = String(e.text || "").replace(/\s+/g, " ").trim();
      elements.push({
        id,
        tag: "text",
        layer,
        attributes: { x: round(p.x), y: round(p.y) },
        text: text === "" ? undefined : text,
      });
    } else if (type === "CIRCLE") {
      const c = e.center || { x: 0, y: 0 };
      track(c.x - e.radius, c.y - e.radius);
      track(c.x + e.radius, c.y + e.radius);
      elements.push({
        id,
        tag: "circle",
        layer,
        attributes: { cx: round(c.x), cy: round(c.y), r: round(e.radius) },
      });
    }
    // other entity types are structurally irrelevant to blueprint geometry
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const width = round(maxX - minX);
  const height = round(maxY - minY);

  const layers = [...new Set(elements.map((el) => el.layer).filter(Boolean))];

  return {
    root: {
      viewBox: `${round(minX)} ${round(minY)} ${width} ${height}`,
      width: String(width),
      height: String(height),
    },
    layers,
    elements,
  };
}

module.exports = {
  parseDxf,
};
