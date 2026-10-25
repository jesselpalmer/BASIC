# Buffered browser graphics

`src/browser/graphics.ts` owns one opaque 320 × 200 logical pixel surface. Its
`createCanvasRenderer(context)` factory accepts only the Canvas 2D context's
`createImageData` and `putImageData` capabilities. Importing the module does not
access browser globals. The renderer has no timers, DOM events, execution state,
or current pen color.

The host supplies validated `GraphicsCommand` values from `src/core/types.ts`.
Coordinates and radii are safe integers; radii are nonnegative, and color indices
are integers from 0 through 15. The runtime evaluates and rounds BASIC expressions
before invoking its optional graphics host capability.

## Frames and lifecycle

- `draw(command)` changes the retained pixel buffer without uploading it.
- `clear()` replaces the buffer with opaque black without uploading it.
- `flush()` uploads the complete buffer once, at canvas coordinate `(0, 0)`.

Construction allocates one 256,000-byte `ImageData` and initializes it to opaque
black. A caller must flush to present that initial frame. Clear or run replacement
can therefore be combined with subsequent drawing in one frame, with no visible
intermediate clear. The browser host decides when to flush: for example, one
animation frame per batch, or before INPUT, pause, or completion. The playground
also flushes synchronously before starting every WAIT timer, cancelling its
queued render so the next frame cannot overwrite the pending one first. See
[WAIT and animation](wait.md).

Set the canvas's intrinsic width and height to the exported `GRAPHICS_WIDTH` and
`GRAPHICS_HEIGHT` **before** constructing the renderer. Changing either intrinsic
dimension resets the browser's canvas backing store. Use CSS for display scaling:

```css
canvas {
  width: 100%;
  height: auto;
  aspect-ratio: 320 / 200;
  image-rendering: pixelated;
}
```

CSS scaling preserves the logical coordinates. Device pixel ratio does not alter
the renderer's 320 × 200 buffer.

## Pixel rules and bounded work

The viewport includes `x = 0…319` and `y = 0…199`. Pixels outside it are discarded.
All pixels are opaque; drawing replaces the previous RGB value without blending
or antialiasing. Every command supplies its own color.

- **PSET** replaces precisely the addressed pixel, or does nothing offscreen.
- **LINE** includes both endpoints. It samples each integer coordinate along the
  dominant axis, choosing x when the absolute deltas are equal. The other
  coordinate is the nearest integer on the original mathematical segment; exact
  halfway values round toward positive infinity. Clipping limits samples rather
  than replacing endpoints, so it preserves the original pixel phase. Reversing
  the endpoints produces the same pixels. Coincident endpoints produce one pixel.
- **CIRCLE** samples both horizontal and vertical intersections of the
  mathematical circumference with every integer viewport row and column. Each
  intersection rounds to the nearest pixel. Sampling both axes prevents diagonal
  gaps. The center is integral, so square-root intersections cannot land exactly
  halfway between pixels. Radius zero produces one pixel. The interior is empty.

Lines examine at most 320 samples. Circles examine 320 columns and 200 rows, with
at most two candidate pixels per intersection. Neither algorithm walks from a
distant endpoint, allocates a primitive-sized buffer, or loops through the radius.
Exact integer rational arithmetic preserves lines with enormous endpoints, and
integer square roots avoid cancellation at the near edge of enormous circles.
Safe-integer input bounds square-root operands to 108 bits; Newton iteration is
bounded by this fixed operand size. Offscreen commands and maximum-safe-integer
coordinates/radii therefore retain the same fixed memory and bounded work.

## Palette

`GRAPHICS_PALETTE` is a frozen array of these hexadecimal RGB colors:

| Index | Color     | Index | Color     |
| ----- | --------- | ----- | --------- |
| 0     | `#000000` | 8     | `#555555` |
| 1     | `#0000aa` | 9     | `#5555ff` |
| 2     | `#00aa00` | 10    | `#55ff55` |
| 3     | `#00aaaa` | 11    | `#55ffff` |
| 4     | `#aa0000` | 12    | `#ff5555` |
| 5     | `#aa00aa` | 13    | `#ff55ff` |
| 6     | `#aa5500` | 14    | `#ffff55` |
| 7     | `#aaaaaa` | 15    | `#ffffff` |
