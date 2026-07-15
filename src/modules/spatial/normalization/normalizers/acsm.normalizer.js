// Converts a parser's format-specific intermediate structure into Atlas's
// format-agnostic canonical representation (ACSM). This is the ONLY module
// that knows the shape of an ACSM's structural fields (coordinateSystem,
// bounds, layers, elements, relationships). A future DXF/DWG/IFC parser only
// needs to produce { root, layers, elements } in this same intermediate
// shape for this normalizer to accept it unchanged.

function parseLength(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const match = String(value).match(/^(-?[\d.]+)\s*([a-z%]*)$/i);

  if (!match) {
    return null;
  }

  return { value: parseFloat(match[1]), unit: match[2] || "px" };
}

function normalizeBounds(root) {
  if (root.viewBox) {
    const parts = root.viewBox.trim().split(/\s+/).map(Number);

    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [minX, minY, width, height] = parts;
      return { minX, minY, maxX: minX + width, maxY: minY + height };
    }
  }

  const width = parseLength(root.width);
  const height = parseLength(root.height);

  return {
    minX: 0,
    minY: 0,
    maxX: width ? width.value : null,
    maxY: height ? height.value : null,
  };
}

function normalizeCoordinateSystem(root) {
  const bounds = normalizeBounds(root);
  const width = parseLength(root.width);

  return {
    origin: { x: bounds.minX, y: bounds.minY },
    units: width ? width.unit : "px",
    rotation: 0,
    scale: 1,
  };
}

function normalizeRelationships(parsedLayers, elements) {
  const relationships = [];

  for (const layerId of parsedLayers) {
    for (const element of elements.filter((el) => el.layer === layerId)) {
      relationships.push({ type: "CONTAINS", from: layerId, to: element.id });
    }
  }

  return relationships;
}

function normalizeToAcsm(parsedSvg) {
  const { root, layers, elements } = parsedSvg;

  return {
    coordinateSystem: normalizeCoordinateSystem(root),
    bounds: normalizeBounds(root),
    layers,
    elements: elements.map((element) => ({
      id: element.id,
      type: element.tag,
      layer: element.layer,
      attributes: element.attributes,
      ...(element.text !== undefined ? { text: element.text } : {}),
    })),
    relationships: normalizeRelationships(layers, elements),
  };
}

module.exports = {
  normalizeToAcsm,
};
