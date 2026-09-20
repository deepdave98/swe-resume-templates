function validCoordinate(value) {
  return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
}

function copyRectangle(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const rectangle = [value[0], value[1], value[2], value[3]];
  return rectangle.every(validCoordinate) ? rectangle : null;
}

/** Map a PDF annotation to the exact preview viewport, clipped to its page. */
export function linkRegion(rect, viewport) {
  try {
    const source = copyRectangle(rect);
    const width = viewport?.width;
    const height = viewport?.height;
    if (!source || !validCoordinate(width) || !validCoordinate(height) || width <= 0 || height <= 0) return null;
    if (source[0] === source[2] || source[1] === source[3]) return null;

    let converted;
    if (typeof viewport.convertToViewportRectangle === "function") {
      converted = viewport.convertToViewportRectangle(source);
    } else if (typeof viewport.convertToViewportPoint === "function") {
      // PDF.js 6 exposes point conversion instead of rectangle conversion.
      const first = viewport.convertToViewportPoint(source[0], source[1]);
      const last = viewport.convertToViewportPoint(source[2], source[3]);
      converted = [first?.[0], first?.[1], last?.[0], last?.[1]];
    } else {
      return null;
    }
    const bounds = copyRectangle(converted);
    if (!bounds) return null;

    const x = Math.max(0, Math.min(bounds[0], bounds[2]));
    const y = Math.max(0, Math.min(bounds[1], bounds[3]));
    const right = Math.min(width, Math.max(bounds[0], bounds[2]));
    const bottom = Math.min(height, Math.max(bounds[1], bounds[3]));
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
  } catch {
    // Malformed annotation geometry must not interrupt the rest of the review.
    return null;
  }
}
