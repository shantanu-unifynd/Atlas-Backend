// Shared, format-specific geometry parsing used by the Geometry Cleaner and
// consumed (already-cleaned) by the Topology Builder. Converts each SVG
// primitive's raw string attributes (from Story 02's ACSM) into numeric
// geometry plus a straight-line-segment decomposition, so later stages never
// need to parse SVG attribute syntax themselves.
//
// Curve commands inside <path> (C, S, Q, T, A) are approximated by a single
// straight segment from their start point to their end anchor point — this
// preserves connectivity (shared endpoints, topology) without reconstructing
// true curve shape, which is out of scope for this phase.

const COORD_PRECISION = 1000; // 3 decimal places

function round(value) {
  return Math.round(value * COORD_PRECISION) / COORD_PRECISION;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return NaN;
  }

  return parseFloat(value);
}

function parsePoints(pointsString) {
  if (!pointsString) {
    return [];
  }

  const numbers = pointsString
    .trim()
    .split(/[\s,]+/)
    .map((n) => parseFloat(n));

  if (numbers.some((n) => !isFiniteNumber(n)) || numbers.length % 2 !== 0) {
    return [];
  }

  const points = [];

  for (let i = 0; i < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }

  return points;
}

// Minimal SVG path `d` parser: fully interprets M/L/H/V/Z, and approximates
// curve commands (C/S/Q/T/A) by a straight segment to their endpoint.
function parsePathSegments(d) {
  if (!d || typeof d !== "string") {
    return { segments: [], closed: false };
  }

  const tokens = d.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/g);

  if (!tokens) {
    return { segments: [], closed: false };
  }

  const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

  const segments = [];
  let current = { x: 0, y: 0 };
  let subpathStart = { x: 0, y: 0 };
  let closed = false;
  let firstMove = true;

  for (const token of tokens) {
    const command = token[0];
    const isRelative = command === command.toLowerCase();
    const key = command.toLowerCase();
    const arity = ARITY[key];
    const args = (token.slice(1).match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);

    if (key === "z") {
      segments.push({ x1: current.x, y1: current.y, x2: subpathStart.x, y2: subpathStart.y });
      current = { ...subpathStart };
      closed = true;
      continue;
    }

    if (arity === 0 || args.length === 0) {
      continue;
    }

    for (let i = 0; i + arity <= args.length; i += arity) {
      const group = args.slice(i, i + arity);
      let next;

      if (key === "h") {
        next = { x: isRelative ? current.x + group[0] : group[0], y: current.y };
      } else if (key === "v") {
        next = { x: current.x, y: isRelative ? current.y + group[0] : group[0] };
      } else {
        const dx = group[group.length - 2];
        const dy = group[group.length - 1];
        next = { x: isRelative ? current.x + dx : dx, y: isRelative ? current.y + dy : dy };
      }

      if (key === "m" && i === 0 && firstMove) {
        current = next;
        subpathStart = { ...next };
        firstMove = false;
        continue;
      }

      segments.push({ x1: current.x, y1: current.y, x2: next.x, y2: next.y });
      current = next;

      if (key === "m" && i === 0) {
        subpathStart = { ...next };
      }
    }
  }

  return { segments, closed };
}

function segmentsFromPoints(points, close) {
  const segments = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y });
  }

  if (close && points.length > 2) {
    const first = points[0];
    const last = points[points.length - 1];
    segments.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
  }

  return segments;
}

function roundSegments(segments) {
  return segments.map((s) => ({
    x1: round(s.x1),
    y1: round(s.y1),
    x2: round(s.x2),
    y2: round(s.y2),
  }));
}

// Converts one ACSM primitive (raw string attributes) into normalized
// numeric geometry + a straight-line-segment decomposition for topology.
// Returns null if the primitive's required attributes are missing/malformed
// (the Cleaner treats that as "invalid geometry").
function primitiveToGeometry(primitive) {
  const attrs = primitive.attributes || {};

  switch (primitive.type) {
    case "line": {
      const x1 = parseNumber(attrs.x1);
      const y1 = parseNumber(attrs.y1);
      const x2 = parseNumber(attrs.x2);
      const y2 = parseNumber(attrs.y2);

      if (![x1, y1, x2, y2].every(isFiniteNumber)) {
        return null;
      }

      return {
        geometry: { x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2) },
        segments: roundSegments([{ x1, y1, x2, y2 }]),
        closed: false,
      };
    }

    case "rect": {
      const x = parseNumber(attrs.x);
      const y = parseNumber(attrs.y);
      const width = parseNumber(attrs.width);
      const height = parseNumber(attrs.height);

      if (![x, y, width, height].every(isFiniteNumber) || width < 0 || height < 0) {
        return null;
      }

      const corners = [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];

      return {
        geometry: { x: round(x), y: round(y), width: round(width), height: round(height) },
        segments: roundSegments(segmentsFromPoints(corners, true)),
        closed: true,
      };
    }

    case "circle": {
      const cx = parseNumber(attrs.cx);
      const cy = parseNumber(attrs.cy);
      const r = parseNumber(attrs.r);

      if (![cx, cy, r].every(isFiniteNumber) || r < 0) {
        return null;
      }

      return {
        geometry: { cx: round(cx), cy: round(cy), r: round(r) },
        segments: [],
        closed: true,
      };
    }

    case "ellipse": {
      const cx = parseNumber(attrs.cx);
      const cy = parseNumber(attrs.cy);
      const rx = parseNumber(attrs.rx);
      const ry = parseNumber(attrs.ry);

      if (![cx, cy, rx, ry].every(isFiniteNumber) || rx < 0 || ry < 0) {
        return null;
      }

      return {
        geometry: { cx: round(cx), cy: round(cy), rx: round(rx), ry: round(ry) },
        segments: [],
        closed: true,
      };
    }

    case "polyline":
    case "polygon": {
      const points = parsePoints(attrs.points);
      const minPoints = primitive.type === "polygon" ? 3 : 2;

      if (points.length < minPoints) {
        return null;
      }

      const closed = primitive.type === "polygon";

      return {
        geometry: { points: points.map((p) => ({ x: round(p.x), y: round(p.y) })) },
        segments: roundSegments(segmentsFromPoints(points, closed)),
        closed,
      };
    }

    case "path": {
      const { segments, closed } = parsePathSegments(attrs.d);

      if (segments.length === 0) {
        return null;
      }

      return {
        geometry: { segmentCount: segments.length },
        segments: roundSegments(segments),
        closed,
      };
    }

    case "text": {
      const x = parseNumber(attrs.x);
      const y = parseNumber(attrs.y);

      if (![x, y].every(isFiniteNumber)) {
        return null;
      }

      return {
        geometry: { x: round(x), y: round(y) },
        segments: [],
        closed: false,
      };
    }

    default:
      return null;
  }
}

function isZeroLength(type, geometry, segments) {
  if (type === "circle") return geometry.r === 0;
  if (type === "ellipse") return geometry.rx === 0 || geometry.ry === 0;
  if (type === "rect") return geometry.width === 0 || geometry.height === 0;
  if (type === "text") return false;

  if (segments.length === 0) {
    return type !== "circle" && type !== "ellipse";
  }

  return segments.every((s) => s.x1 === s.x2 && s.y1 === s.y2);
}

function geometryKey(type, layer, geometry) {
  return `${type}:${layer || ""}:${JSON.stringify(geometry)}`;
}

module.exports = {
  round,
  isFiniteNumber,
  primitiveToGeometry,
  isZeroLength,
  geometryKey,
};
