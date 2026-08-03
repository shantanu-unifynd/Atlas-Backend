const { XMLParser } = require("fast-xml-parser");

// Reads SVG structure only. No classification, no USO generation, no graph
// building — just the raw primitives and grouping SVG itself declares.
// Output is an SVG-specific intermediate shape, deliberately NOT the ACSM;
// acsm.normalizer.js is the only module that knows what an ACSM looks like.

const PRIMITIVE_TAGS = ["line", "polyline", "polygon", "rect", "circle", "ellipse", "path", "text"];
const GROUP_TAG = "g";

function attributesOf(node) {
  return node[":@"] || {};
}

// Gathers a <text> element's string content, including text nested inside
// <tspan> (and any deeper) children — SVG editors routinely wrap label text in
// tspans, so reading only a direct #text child dropped most labels entirely.
function collectText(children) {
  let out = "";

  for (const child of children || []) {
    if (Object.prototype.hasOwnProperty.call(child, "#text")) {
      out += String(child["#text"]);
      continue;
    }

    const tag = Object.keys(child).find((key) => key !== ":@");

    if (tag && Array.isArray(child[tag])) {
      out += ` ${collectText(child[tag])}`;
    }
  }

  return out;
}

function textContentOf(children) {
  const text = collectText(children).replace(/\s+/g, " ").trim();
  return text === "" ? undefined : text;
}

function walk(children, currentLayerId, elements) {
  for (const node of children || []) {
    const tagName = Object.keys(node).find((key) => key !== ":@");

    if (!tagName || tagName === "#text") {
      continue;
    }

    if (tagName === GROUP_TAG) {
      const groupAttributes = attributesOf(node);
      const layerId = groupAttributes.id || currentLayerId;
      walk(node[tagName], layerId, elements);
      continue;
    }

    if (PRIMITIVE_TAGS.includes(tagName)) {
      const attributes = attributesOf(node);
      elements.push({
        id: attributes.id || `el-${elements.length}`,
        tag: tagName,
        layer: currentLayerId || null,
        attributes,
        text: tagName === "text" ? textContentOf(node[tagName]) : undefined,
      });
      continue;
    }

    // Any other tag (defs, style, metadata, script, ...) is structurally
    // irrelevant to blueprint geometry and is intentionally skipped.
  }
}

function parseSvg(rawText) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    preserveOrder: true,
    alwaysCreateTextNode: true,
  });
  const parsed = parser.parse(rawText);

  const svgNode = parsed.find((node) => Object.prototype.hasOwnProperty.call(node, "svg"));
  const rootAttributes = attributesOf(svgNode);

  const elements = [];
  walk(svgNode.svg, null, elements);

  const layers = [...new Set(elements.map((element) => element.layer).filter(Boolean))];

  return {
    root: rootAttributes,
    layers,
    elements,
  };
}

module.exports = {
  parseSvg,
};
