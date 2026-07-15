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

function textContentOf(children) {
  const textNode = (children || []).find(
    (child) => Object.keys(child).length === 1 && Object.prototype.hasOwnProperty.call(child, "#text")
  );

  return textNode ? textNode["#text"] : undefined;
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
