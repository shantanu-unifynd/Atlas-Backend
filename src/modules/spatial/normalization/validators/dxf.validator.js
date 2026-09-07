const DxfParserModule = require("dxf-parser");

// P1 — DXF validator. Mirrors svg.validator's contract: given the stored file
// buffer, confirm it is a parseable ASCII DXF and return the raw text (which the
// parser then re-reads). Throws a 400 on anything unparseable.

const DxfParser = DxfParserModule.default || DxfParserModule;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateDxfContent(buffer) {
  const rawText = buffer.toString("utf8");

  if (rawText.trim() === "") {
    throw validationError("Malformed DXF: file is empty");
  }

  // ASCII DXF is a group-code/value stream; a real one always declares an
  // ENTITIES section. Cheap sniff before the (heavier) full parse.
  if (!/\bENTITIES\b/.test(rawText)) {
    throw validationError("Malformed DXF: no ENTITIES section found");
  }

  try {
    const parser = new DxfParser();
    (parser.parseSync ? parser.parseSync(rawText) : parser.parse(rawText));
  } catch (err) {
    throw validationError(`Malformed DXF: ${err.message}`);
  }

  return rawText;
}

module.exports = {
  validateDxfContent,
};
