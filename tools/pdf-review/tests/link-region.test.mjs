import assert from "node:assert/strict";
import test from "node:test";
import { linkRegion } from "../src/link-region.mjs";

// PDF.js uses a top-left viewport origin, flips PDF's upward Y axis, and
// includes the page crop box origin, scale, and quarter-turn page rotation.
function viewport({ rotation = 0, viewBox = [10, 20, 210, 320], scale = 2, pointsOnly = false } = {}) {
  const pageWidth = (viewBox[2] - viewBox[0]) * scale;
  const pageHeight = (viewBox[3] - viewBox[1]) * scale;
  const result = {
    width: rotation % 180 ? pageHeight : pageWidth,
    height: rotation % 180 ? pageWidth : pageHeight,
    convertToViewportPoint(x, y) {
      const dx = (x - viewBox[0]) * scale;
      const dy = (y - viewBox[1]) * scale;
      switch (rotation) {
        case 0: return [dx, pageHeight - dy];
        case 90: return [dy, dx];
        case 180: return [pageWidth - dx, dy];
        case 270: return [pageHeight - dy, pageWidth - dx];
        default: throw new Error("Invalid rotation");
      }
    },
  };
  if (!pointsOnly) {
    result.convertToViewportRectangle = function (rect) {
      return [...this.convertToViewportPoint(rect[0], rect[1]), ...this.convertToViewportPoint(rect[2], rect[3])];
    };
  }
  return result;
}

const identity = (extra = {}) => ({ width: 100, height: 200, convertToViewportRectangle: (rect) => rect, ...extra });

for (const pointsOnly of [false, true]) {
  const api = pointsOnly ? "point conversion" : "rectangle conversion";
  const expected = [
    [0, { x: 20, y: 460, width: 100, height: 80 }],
    [90, { x: 60, y: 20, width: 80, height: 100 }],
    [180, { x: 280, y: 60, width: 100, height: 80 }],
    [270, { x: 460, y: 280, width: 80, height: 100 }],
  ];
  for (const [rotation, region] of expected) {
    test(`${api} respects crop origin, scale, and ${rotation}-degree rotation`, () => {
      const page = viewport({ rotation, pointsOnly });
      assert.deepEqual(linkRegion([20, 50, 70, 90], page), region);
      assert.deepEqual(linkRegion([70, 90, 20, 50], page), region);
      assert.deepEqual(linkRegion([70, 50, 20, 90], page), region);
    });
  }
}

test("crop boundaries clip annotation bounds after their PDF coordinate conversion", () => {
  assert.deepEqual(linkRegion([0, 10, 30, 50], viewport()), { x: 0, y: 540, width: 40, height: 60 });
  assert.equal(linkRegion([-20, -20, 0, 0], viewport()), null);
});

test("regions retain fractional coordinates in the viewport's exact coordinate space", () => {
  assert.deepEqual(linkRegion([0.25, 0.5, 10.5, 20.25], viewport({ viewBox: [0, 0, 100, 200], scale: 1.25 })),
    { x: 0.3125, y: 224.6875, width: 12.8125, height: 24.6875 });
  assert.deepEqual(linkRegion([99, 199, 101, 202], identity({ width: 100.25, height: 200.5 })),
    { x: 99, y: 199, width: 1.25, height: 1.5 });
});

test("bounds crossing each edge clip to the viewport without extending its dimensions", () => {
  const cases = [
    [[-10, 20, 30, 60], { x: 0, y: 20, width: 30, height: 40 }],
    [[20, -10, 60, 30], { x: 20, y: 0, width: 40, height: 30 }],
    [[70, 20, 110, 60], { x: 70, y: 20, width: 30, height: 40 }],
    [[20, 170, 60, 210], { x: 20, y: 170, width: 40, height: 30 }],
    [[-10, -20, 110, 220], { x: 0, y: 0, width: 100, height: 200 }],
  ];
  for (const [rect, expected] of cases) assert.deepEqual(linkRegion(rect, identity()), expected);
});

test("off-page, edge-only, and zero-area rectangles have no visible region", () => {
  for (const rect of [[-20, 10, -10, 20], [110, 10, 120, 20], [10, -20, 20, -10], [10, 210, 20, 220],
    [-10, 10, 0, 20], [100, 10, 110, 20], [10, -10, 20, 0], [10, 200, 20, 210],
    [10, 20, 10, 40], [10, 20, 30, 20], [0, 0, 0, 0]]) {
    assert.equal(linkRegion(rect, identity()), null);
  }
  assert.equal(linkRegion([1, 2, 3, 4], identity({ convertToViewportRectangle: () => [1, 2, 1, 4] })), null);
});

test("malformed, nonfinite, and unsafe-magnitude source coordinates are rejected before conversion", () => {
  const page = identity({ convertToViewportRectangle() { assert.fail("Invalid source must not be converted"); } });
  for (const rect of [undefined, null, {}, "1,2,3,4", [], [1, 2, 3], [1, 2, 3, 4, 5], new Array(4),
    [1, , 3, 4], [1, "2", 3, 4], [1, NaN, 3, 4], [1, Infinity, 3, 4], [1, -Infinity, 3, 4],
    [1, Number.MAX_VALUE, 3, 4], [-Number.MAX_VALUE, 2, 3, 4], [1, 2, Number.MAX_SAFE_INTEGER + 1, 4]]) {
    assert.equal(linkRegion(rect, page), null);
  }
});

test("malformed, nonfinite, or huge viewport dimensions and missing conversion are rejected", () => {
  for (const page of [null, undefined, {}, { width: 100, height: 200 }, identity({ convertToViewportRectangle: null })]) {
    assert.equal(linkRegion([1, 2, 3, 4], page), null);
  }
  for (const value of [0, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE, "100", undefined]) {
    assert.equal(linkRegion([1, 2, 3, 4], identity({ width: value })), null);
    assert.equal(linkRegion([1, 2, 3, 4], identity({ height: value })), null);
  }
});

test("invalid converted coordinates and conversion errors cannot create a region or escape", () => {
  for (const converted of [null, undefined, {}, [], [1, 2, 3], new Array(4), [1, , 3, 4],
    [1, "2", 3, 4], [1, NaN, 3, 4], [1, Infinity, 3, 4], [-Number.MAX_VALUE, 2, 3, 4]]) {
    assert.equal(linkRegion([1, 2, 3, 4], identity({ convertToViewportRectangle: () => converted })), null);
  }
  assert.equal(linkRegion([1, 2, 3, 4], identity({ convertToViewportRectangle() { throw new Error("Invalid transform"); } })), null);
  assert.equal(linkRegion([1, 2, 3, 4], { width: 100, height: 200, convertToViewportPoint() { throw new Error("Invalid transform"); } }), null);
  assert.equal(linkRegion([1, 2, 3, 4], { width: 100, height: 200, convertToViewportPoint: () => [NaN, 2] }), null);
  assert.equal(linkRegion([1, 2, 3, 4], { width: 100, height: 200, convertToViewportPoint: () => null }), null);
});

test("source rectangles and viewport state remain unchanged, including with a mutating converter", () => {
  const rect = Object.freeze([20, 50, 70, 90]);
  const page = Object.freeze(viewport());
  assert.deepEqual(linkRegion(rect, page), { x: 20, y: 460, width: 100, height: 80 });
  assert.deepEqual(rect, [20, 50, 70, 90]);
  const mutating = identity({ convertToViewportRectangle(source) {
    assert.notEqual(source, rect);
    source[0] = 30;
    return source;
  } });
  assert.deepEqual(linkRegion(rect, mutating), { x: 30, y: 50, width: 40, height: 40 });
  assert.deepEqual(rect, [20, 50, 70, 90]);
  assert.equal(mutating.width, 100);
  assert.equal(mutating.height, 200);
});
