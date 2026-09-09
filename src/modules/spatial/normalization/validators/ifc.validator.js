// P3 — IFC validator. Mirrors the svg/dxf validator contract: given the stored
// file buffer, confirm it is an IFC (STEP / ISO-10303-21) model and return what
// the parser consumes. Unlike SVG/DXF (which return raw text), the IFC parser
// feeds bytes to web-ifc, so this returns the buffer unchanged. A cheap header
// sniff rejects non-IFC uploads up front; web-ifc does the full parse in parseIfc.

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateIfcContent(buffer) {
  if (!buffer || buffer.length === 0) {
    throw validationError("Malformed IFC: file is empty");
  }

  // The HEADER (with ISO-10303-21 + FILE_SCHEMA) always sits at the top, so a
  // small slice is enough — no need to decode the whole multi-MB model.
  const head = buffer.slice(0, 4096).toString("utf8");

  if (!/ISO-10303-21/.test(head)) {
    throw validationError("Malformed IFC: not a STEP/ISO-10303-21 file");
  }

  const schema = head.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i);
  if (!schema || !/^IFC/i.test(schema[1])) {
    throw validationError("Malformed IFC: FILE_SCHEMA is not an IFC schema");
  }

  return buffer;
}

module.exports = {
  validateIfcContent,
};
