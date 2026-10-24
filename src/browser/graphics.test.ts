import {describe, expect, test} from 'bun:test';
import type {GraphicsCommand} from '../core/types';
import {createCanvasRenderer, GRAPHICS_HEIGHT, GRAPHICS_PALETTE, GRAPHICS_WIDTH} from './graphics';

function fixture() {
  const allocations: number[][] = [];
  const uploads: {data: Uint8ClampedArray; x: number; y: number}[] = [];
  const renderer = createCanvasRenderer({
    createImageData(width: number, height: number) {
      allocations.push([width, height]);
      return {width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: 'srgb'};
    },
    putImageData(image: ImageData, x: number, y: number) {
      uploads.push({data: image.data.slice(), x, y});
    },
  });
  function frame() {
    renderer.flush();
    return uploads.at(-1)!.data;
  }
  function points() {
    const data = frame();
    const points: number[][] = [];
    for (let y = 0; y < GRAPHICS_HEIGHT; y++) {
      for (let x = 0; x < GRAPHICS_WIDTH; x++) {
        const offset = (y * GRAPHICS_WIDTH + x) * 4;
        if (data[offset] || data[offset + 1] || data[offset + 2]) points.push([x, y]);
      }
    }
    return points;
  }
  return {renderer, allocations, uploads, frame, points};
}

describe('buffered canvas renderer', () => {
  test('allocates one fixed logical surface, starts opaque black, and only uploads on flush', () => {
    const {renderer, allocations, uploads, frame} = fixture();
    expect([GRAPHICS_WIDTH, GRAPHICS_HEIGHT]).toEqual([320, 200]);
    expect(allocations).toEqual([[320, 200]]);
    expect(uploads).toEqual([]);
    const initial = frame();
    expect(initial.length).toBe(256_000);
    expect(initial.every((value, index) => value === (index % 4 === 3 ? 255 : 0))).toBe(true);
    renderer.draw({kind: 'pset', x: 1, y: 2, color: 15});
    renderer.draw({kind: 'pset', x: 3, y: 4, color: 1});
    expect(uploads).toHaveLength(1);
    expect(initial.slice((2 * 320 + 1) * 4, (2 * 320 + 1) * 4 + 4)).toEqual(
      new Uint8ClampedArray([0, 0, 0, 255]),
    );
    const drawn = frame();
    expect(Array.from(drawn.slice((2 * 320 + 1) * 4, (2 * 320 + 1) * 4 + 4))).toEqual([
      255, 255, 255, 255,
    ]);
    renderer.clear();
    expect(uploads).toHaveLength(2);
    expect(frame()).toEqual(initial);
    expect(uploads.map(({x, y}) => [x, y])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(allocations).toHaveLength(1);
  });

  test('plots exact corner pixels and every immutable EGA palette color without retaining a pen', () => {
    const {renderer, frame} = fixture();
    const expected = [
      [0, 0, 0],
      [0, 0, 170],
      [0, 170, 0],
      [0, 170, 170],
      [170, 0, 0],
      [170, 0, 170],
      [170, 85, 0],
      [170, 170, 170],
      [85, 85, 85],
      [85, 85, 255],
      [85, 255, 85],
      [85, 255, 255],
      [255, 85, 85],
      [255, 85, 255],
      [255, 255, 85],
      [255, 255, 255],
    ];
    expect(Object.isFrozen(GRAPHICS_PALETTE)).toBe(true);
    expect(GRAPHICS_PALETTE).toHaveLength(16);
    for (let color = 15; color >= 0; color--) {
      renderer.draw({kind: 'pset', x: color, y: 0, color});
    }
    renderer.draw({kind: 'pset', x: 319, y: 199, color: 7});
    const data = frame();
    for (let color = 0; color < 16; color++) {
      expect(Array.from(data.slice(color * 4, color * 4 + 4))).toEqual([...expected[color], 255]);
    }
    expect(Array.from(data.slice(-4))).toEqual([170, 170, 170, 255]);
  });

  test('clips points before indexing the fixed buffer', () => {
    const {renderer, points} = fixture();
    for (const [x, y] of [
      [-1, 0],
      [320, 0],
      [0, -1],
      [0, 200],
      [Number.MAX_SAFE_INTEGER, 0],
    ]) {
      renderer.draw({kind: 'pset', x, y, color: 15});
    }
    expect(points()).toEqual([]);
  });

  test('lines include both endpoints, round ties upward, and have direction-independent pixels', () => {
    const cases = [
      {
        ends: [0, 0, 4, 2],
        pixels: [
          [0, 0],
          [1, 1],
          [2, 1],
          [3, 2],
          [4, 2],
        ],
      },
      {
        ends: [2, 0, 0, 4],
        pixels: [
          [2, 0],
          [2, 1],
          [1, 2],
          [1, 3],
          [0, 4],
        ],
      },
      {
        ends: [0, 2, 4, 0],
        pixels: [
          [4, 0],
          [2, 1],
          [3, 1],
          [0, 2],
          [1, 2],
        ],
      },
      {ends: [1, 1, 1, 1], pixels: [[1, 1]]},
      {
        ends: [0, 0, 2, 0],
        pixels: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      {
        ends: [0, 0, 0, 2],
        pixels: [
          [0, 0],
          [0, 1],
          [0, 2],
        ],
      },
    ];
    for (const {
      ends: [x1, y1, x2, y2],
      pixels,
    } of cases) {
      const {renderer, points} = fixture();
      const expected = pixels.toSorted(([ax, ay], [bx, by]) => ay - by || ax - bx);
      renderer.draw({kind: 'line', x1, y1, x2, y2, color: 15});
      expect(points()).toEqual(expected);
      renderer.clear();
      renderer.draw({kind: 'line', x1: x2, y1: y2, x2: x1, y2: y1, color: 15});
      expect(points()).toEqual(expected);
    }
  });

  test('line clipping preserves the original phase and negative rounding', () => {
    const {renderer, points} = fixture();
    renderer.draw({kind: 'line', x1: -4, y1: -2, x2: 4, y2: 2, color: 15});
    expect(points()).toEqual([
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ]);
    renderer.clear();
    renderer.draw({kind: 'line', x1: 0, y1: -3, x2: 4, y2: 0, color: 15});
    expect(points()).toEqual([[4, 0]]);
    renderer.clear();
    renderer.draw({kind: 'line', x1: -10, y1: 0, x2: -2, y2: 2, color: 15});
    renderer.draw({kind: 'line', x1: 0, y1: 200, x2: 4, y2: 201, color: 15});
    expect(points()).toEqual([]);
  });

  test('huge safe-integer lines retain exact visible geometry with bounded viewport work', () => {
    const {renderer, points} = fixture();
    const huge = Number.MAX_SAFE_INTEGER;
    renderer.draw({kind: 'line', x1: -huge, y1: -huge, x2: huge, y2: huge, color: 15});
    expect(points()).toEqual(Array.from({length: 200}, (_, index) => [index, index]));
    renderer.clear();
    renderer.draw({kind: 'line', x1: huge, y1: 50, x2: -huge, y2: 50, color: 15});
    expect(points()).toEqual(Array.from({length: 320}, (_, index) => [index, 50]));
  });

  test('circle outlines use rounded horizontal and vertical intersections, including radius zero', () => {
    const {renderer, points} = fixture();
    renderer.draw({kind: 'circle', x: 4, y: 4, radius: 2, color: 15});
    expect(points()).toEqual([
      [3, 2],
      [4, 2],
      [5, 2],
      [2, 3],
      [6, 3],
      [2, 4],
      [6, 4],
      [2, 5],
      [6, 5],
      [3, 6],
      [4, 6],
      [5, 6],
    ]);
    renderer.clear();
    renderer.draw({kind: 'circle', x: 4, y: 4, radius: 0, color: 15});
    expect(points()).toEqual([[4, 4]]);
    renderer.clear();
    renderer.draw({kind: 'circle', x: 4, y: 4, radius: 1, color: 15});
    expect(points()).toEqual([
      [4, 3],
      [3, 4],
      [5, 4],
      [4, 5],
    ]);
  });

  test('circles clip all edges and huge centers/radii cannot allocate or iterate beyond the viewport', () => {
    const {renderer, points, allocations} = fixture();
    renderer.draw({kind: 'circle', x: 0, y: 0, radius: 2, color: 15});
    expect(points()).toEqual([
      [2, 0],
      [2, 1],
      [0, 2],
      [1, 2],
    ]);
    renderer.clear();
    renderer.draw({kind: 'circle', x: 319, y: 199, radius: 1, color: 15});
    expect(points()).toEqual([
      [319, 198],
      [318, 199],
    ]);
    renderer.clear();
    const huge = Number.MAX_SAFE_INTEGER;
    const invisible: GraphicsCommand[] = [
      {kind: 'circle', x: 0, y: 0, radius: huge, color: 15},
      {kind: 'circle', x: huge, y: huge, radius: 1, color: 15},
      {kind: 'circle', x: -huge, y: -huge, radius: huge, color: 15},
    ];
    for (const command of invisible) renderer.draw(command);
    expect(points()).toEqual([]);
    renderer.draw({kind: 'circle', x: huge, y: 0, radius: huge, color: 15});
    expect(points()).toEqual(Array.from({length: 200}, (_, index) => [0, index]));
    expect(allocations).toEqual([[320, 200]]);
  });
});
