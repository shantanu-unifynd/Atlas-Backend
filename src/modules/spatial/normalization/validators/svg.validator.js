const { XMLValidator, XMLParser } = require("fast-xml-parser");

// Validation only. Never returns a parsed structure — that is the parser's
// job (svg.parser.js). This keeps "is this file acceptable" fully separate
// from "what does this file contain".

function validateWellFormedXml(rawText) {
  const result = XMLValidator.validate(rawText, { allowBooleanAttributes: true });

  if (result !== true) {
    const error = new Error(`Malformed SVG: ${result.err.msg} (line ${result.err.line})`);
    error.statusCode = 400;
    throw error;
  }
}

function isMeaningfulNode(node) {
  const keys = Object.keys(node);

  if (keys.length === 1 && keys[0] === "#text") {
    return node["#text"].trim().length > 0;
  }

  return true;
}

function validateNonEmptyDocument(rawText) {
  const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true });
  const parsed = parser.parse(rawText);

  const svgNode = parsed.find((node) => Object.prototype.hasOwnProperty.call(node, "svg"));

  if (!svgNode) {
    const error = new Error("Malformed SVG: no root <svg> element found");
    error.statusCode = 400;
    throw error;
  }

  const hasContent = svgNode.svg.some(isMeaningfulNode);

  if (!hasContent) {
    const error = new Error("Malformed SVG: document is empty (no content inside <svg>)");
    error.statusCode = 400;
    throw error;
  }
}

function validateSvgContent(buffer) {
  let rawText;

  try {
    rawText = buffer.toString("utf-8");
  } catch {
    const error = new Error("Blueprint file is not readable as text");
    error.statusCode = 400;
    throw error;
  }

  if (!rawText || rawText.trim().length === 0) {
    const error = new Error("Malformed SVG: file is empty");
    error.statusCode = 400;
    throw error;
  }

  validateWellFormedXml(rawText);
  validateNonEmptyDocument(rawText);

  return rawText;
}

module.exports = {
  validateSvgContent,
};
