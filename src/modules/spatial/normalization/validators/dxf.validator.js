const DxfParserModule = require("dxf-parser");

// P1 — DXF validator. Mirrors svg.validator's contract: given the stored file
// buffer, confirm it is a parseable ASCII DXF and return the raw text (which the
// parser then re-reads). Throws a 400 on anything unparseable.

const DxfParser = DxfParserModule.default || DxfParserModule;

// Guard against pathologically large DXFs. Real commercial CAD files (e.g. a
// whole shopping mall) run to tens of MB / millions of entity lines — mostly
// dimensions, fixtures and furniture — and the synchronous dxf-parser blocks
// the event loop for minutes on them. We fail fast with a clear message well
// below that (a real single-floor plan is ~1-2 MB), so an oversized upload
// never silently hangs the request. Streaming/pre-filtered parsing would lift
// this ceiling later; IFC is the better route for buildings this complex.
const MAX_DXF_BYTES = 12 * 1024 * 1024;

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateDxfContent(buffer) {
  if (buffer.length > MAX_DXF_BYTES) {
    const mb = (buffer.length / (1024 * 1024)).toFixed(1);
    throw validationError(
      `DXF is too large to process (${mb} MB, limit ${MAX_DXF_BYTES / (1024 * 1024)} MB). ` +
        "Large CAD files with dimensions/fixtures aren't supported yet — export a simplified " +
        "single-floor plan, or use an IFC/BIM model instead."
    );
  }

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
