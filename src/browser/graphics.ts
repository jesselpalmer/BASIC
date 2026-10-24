import type {GraphicsCommand} from '../core/types.ts';

export const GRAPHICS_WIDTH = 320;
export const GRAPHICS_HEIGHT = 200;
/** Standard 16-color EGA palette, in BASIC color-index order. */
export const GRAPHICS_PALETTE = Object.freeze([
  '#000000',
  '#0000aa',
  '#00aa00',
  '#00aaaa',
  '#aa0000',
  '#aa00aa',
  '#aa5500',
  '#aaaaaa',
  '#555555',
  '#5555ff',
  '#55ff55',
  '#55ffff',
  '#ff5555',
  '#ff55ff',
  '#ffff55',
  '#ffffff',
]);

type CanvasTarget = {
  createImageData(width: number, height: number): ImageData;
  putImageData(frame: ImageData, x: number, y: number): void;
};

/** Round an exact rational to the nearest integer; ties go toward positive infinity. */
function roundedRatio(numerator: bigint, denominator: bigint): number {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return Number(
    quotient + (2n * remainder >= denominator ? 1n : 2n * remainder < -denominator ? -1n : 0n),
  );
}

/** Integer Newton iteration; safe-integer geometry limits the radicand to 108 bits. */
function roundedRoot(value: bigint): bigint {
  if (value === 0n) return 0n;
  let root = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
  let next = (root + value / root) / 2n;
  while (next < root) {
    root = next;
    next = (root + value / root) / 2n;
  }
  return root + (value > root * root + root ? 1n : 0n);
}

/** Buffered, opaque logical pixels. Only flush uploads a complete frame to the canvas. */
export function createCanvasRenderer(context: CanvasTarget) {
  const frame = context.createImageData(GRAPHICS_WIDTH, GRAPHICS_HEIGHT);
  const colors = GRAPHICS_PALETTE.map((hex) => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ]);

  function clear(): void {
    frame.data.fill(0);
    for (let offset = 3; offset < frame.data.length; offset += 4) frame.data[offset] = 255;
  }

  function pixel(x: number, y: number, color: number): void {
    if (x < 0 || x >= GRAPHICS_WIDTH || y < 0 || y >= GRAPHICS_HEIGHT) return;
    const offset = (y * GRAPHICS_WIDTH + x) * 4;
    const rgb = colors[color];
    frame.data[offset] = rgb[0];
    frame.data[offset + 1] = rgb[1];
    frame.data[offset + 2] = rgb[2];
  }

  function line(command: Extract<GraphicsCommand, {kind: 'line'}>): void {
    const {x1, y1, x2, y2, color} = command;
    const dx = BigInt(x2) - BigInt(x1);
    const dy = BigInt(y2) - BigInt(y1);
    const horizontal = (dx < 0n ? -dx : dx) >= (dy < 0n ? -dy : dy);
    const [a1, b1, a2, b2, limit] = horizontal
      ? [x1, y1, x2, y2, GRAPHICS_WIDTH]
      : [y1, x1, y2, x2, GRAPHICS_HEIGHT];
    if (a1 === a2) {
      pixel(x1, y1, color);
      return;
    }
    const start = Math.max(0, Math.min(a1, a2));
    const end = Math.min(limit - 1, Math.max(a1, a2));
    const direction = a2 > a1 ? 1n : -1n;
    const deltaA = (BigInt(a2) - BigInt(a1)) * direction;
    const deltaB = (BigInt(b2) - BigInt(b1)) * direction;
    // Exact arithmetic preserves the pixel phase even when safe-integer endpoints
    // lie far beyond the viewport. Work is bounded by one viewport dimension.
    for (let a = start; a <= end; a++) {
      const b = roundedRatio(BigInt(b1) * deltaA + (BigInt(a) - BigInt(a1)) * deltaB, deltaA);
      if (horizontal) pixel(a, b, color);
      else pixel(b, a, color);
    }
  }

  function circle({x, y, radius, color}: Extract<GraphicsCommand, {kind: 'circle'}>): void {
    if (radius === 0) {
      pixel(x, y, color);
      return;
    }
    const r = BigInt(radius);
    const cx = BigInt(x);
    const cy = BigInt(y);
    // Sampling both axes avoids gaps around the diagonal octants. Exact roots
    // avoid cancellation at a huge circle's near edge, without walking its radius.
    for (let px = 0; px < GRAPHICS_WIDTH; px++) {
      const delta = BigInt(px) - cx;
      const radicand = r * r - delta * delta;
      if (radicand < 0n) continue;
      const extent = roundedRoot(radicand);
      pixel(px, Number(cy - extent), color);
      pixel(px, Number(cy + extent), color);
    }
    for (let py = 0; py < GRAPHICS_HEIGHT; py++) {
      const delta = BigInt(py) - cy;
      const radicand = r * r - delta * delta;
      if (radicand < 0n) continue;
      const extent = roundedRoot(radicand);
      pixel(Number(cx - extent), py, color);
      pixel(Number(cx + extent), py, color);
    }
  }

  clear();
  return {
    clear,
    draw(command: GraphicsCommand): void {
      switch (command.kind) {
        case 'pset':
          pixel(command.x, command.y, command.color);
          return;
        case 'line':
          line(command);
          return;
        case 'circle':
          circle(command);
          return;
      }
    },
    flush(): void {
      context.putImageData(frame, 0, 0);
    },
  };
}
