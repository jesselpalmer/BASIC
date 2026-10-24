# Graphics language and host contract

Graphics use a fixed **320 × 200** logical pixel surface. The origin is the top
left; x increases right and y increases down. The browser scales this surface
without changing BASIC coordinates. Text output and graphics have independent
surfaces; `CLS` clears both. Clearing fills graphics with palette index 0 and does
not change the current pen color.

| Statement          | Behavior                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| `COLOR n`          | Select pen index 0 through 15; default 7 at the start of each run.     |
| `PSET x,y`         | Draw one pixel.                                                        |
| `LINE x1,y1,x2,y2` | Draw a one-pixel-wide segment including both endpoints.                |
| `CIRCLE x,y,r`     | Draw a one-pixel outline centered at x,y; radius zero draws one pixel. |
| `CLS`              | Clear text and graphics; retain the selected pen.                      |

Arguments are ordinary numeric expressions, separated by commas. Parentheses
may group expressions; there is no coordinate-pair or optional-color syntax.
Keywords are case insensitive and reserved as variable names. Whole-program
validation checks unreachable lines too, rejecting inferred string arguments
before any program effects.

Each statement evaluates arguments once, left to right, before drawing or
changing the pen. Arguments must be finite numbers. Coordinates and radii use
JavaScript `Math.round`: nearest integer, with exact halves rounded toward positive
infinity (`2.5` becomes `3`, `-1.5` becomes `-1`). Rounded values must be safe
integers (absolute value at most 9007199254740991). Radius must be nonnegative
_before_ rounding, so `-.1` is invalid. `COLOR` requires an integer in 0..15 and
never rounds. Invalid type, nonfinite arithmetic, unsafe coordinates, negative
radius and invalid color produce source-located BASIC diagnostics. There is no
partial drawing on argument failure.

Offcanvas coordinates and radii are valid; hosts clip drawing to the logical
surface. Rendering must use bounded work even for the largest safe integers.
The circle and segment rasterizers use the same logical pixels at every display
scale; no fill, thickness, antialiasing, or animation commands are part of this
language feature.

The fixed palette follows the conventional 16-color RGB values:

| Index | Color         | RGB hex   |
| ----: | ------------- | --------- |
|     0 | Black         | `#000000` |
|     1 | Blue          | `#0000AA` |
|     2 | Green         | `#00AA00` |
|     3 | Cyan          | `#00AAAA` |
|     4 | Red           | `#AA0000` |
|     5 | Magenta       | `#AA00AA` |
|     6 | Brown         | `#AA5500` |
|     7 | Light gray    | `#AAAAAA` |
|     8 | Dark gray     | `#555555` |
|     9 | Light blue    | `#5555FF` |
|    10 | Light green   | `#55FF55` |
|    11 | Light cyan    | `#55FFFF` |
|    12 | Light red     | `#FF5555` |
|    13 | Light magenta | `#FF55FF` |
|    14 | Yellow        | `#FFFF55` |
|    15 | White         | `#FFFFFF` |

## Host capability

The public `Host` accepts optional `draw(command: GraphicsCommand): void`.
Existing hosts continue to work without it. `createHost` preserves the callback
receiver; the runtime snapshots and freezes its host callbacks. Drawing commands
are frozen, stateless values with a `kind` discriminator and explicit pen color:

```ts
import type {GraphicsCommand} from 'node-basic-lang';

const point: GraphicsCommand = {kind: 'pset', x: 10, y: 20, color: 7};
const segment: GraphicsCommand = {kind: 'line', x1: 0, y1: 0, x2: 319, y2: 199, color: 12};
const circle: GraphicsCommand = {kind: 'circle', x: 160, y: 100, radius: 30, color: 14};
```

`GraphicsCommand` is exported from the package root. The runtime owns pen state;
`COLOR` requires graphics support but does not send a command. Each run/reset
restores pen index 7 without invoking the host. Hosts decide when to clear or
present their surface; `CLS` invokes the existing `clear` callback. Browser runs
start with an empty surface, then batch presentation with rendering updates.

A host without `draw`, including the terminal CLI, raises
`GRAPHICS_UNAVAILABLE` at an executed graphics statement. Merely loading,
validating, or skipping such a statement does not require graphics support.
A throwing draw callback becomes `HOST_ERROR` with the original cause and the
statement's BASIC location. Callback reentrancy has the same protections as
text output. The core imports no browser or terminal APIs.

Try [picture.bas](../examples/picture.bas) in the browser playground. Library
hosts can capture commands for testing or implement another renderer using the
same capability.
