# BASIC support and compatibility — provisional 1.0 contract

BASIC is a small dialect with one shared parser/runtime. The [language reference](language-v1.md)
defines accepted programs; the API guides define embedding and host behavior.
The current snapshot does not implement historical compatibility.
**The final 1.0 contract is not frozen:** correct classic listings are now required
by [#114](https://github.com/jesselpalmer/BASIC/issues/114), following the
[compatibility roadmap](classic-games-roadmap.md). The rules below describe
existing native behavior and the policy to preserve it; planned profiles are not
yet accepted syntax. General QBasic/GW-BASIC compatibility is not claimed.

## Supported delivery targets

| Target              | 1.0 contract and validation scope                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Library and CLI     | Bun >=1.4.4; development and CI pin Bun 1.4.4. Linux and macOS are tested. ESM and CommonJS imports run directly from shipped TypeScript. Node.js alone is unsupported; Windows execution is not a validated 1.0 target. |
| Browser playground  | Desktop Chromium, exercised through the pinned Playwright version on Linux/macOS. Requires Canvas for graphics and a keyboard for game controls. Other browser engines and mobile input are not validated targets.       |
| Static distribution | HTML, JavaScript, source map and CSS served over HTTP by an ordinary static server. No application backend, account, npm installation or checkout is needed to run the extracted playground. Public hosting is optional. |

The package entrypoint is `node-basic-lang`; its executable is `basic`.
`package.json` exports only the package root. Browser adapters, parser internals,
CLI adapters, and files reached by importing `src/...` are not supported package
subpath APIs. Browser adapter guides describe checkout embedding and ownership;
they do not create additional package exports.

## Stable public surface

The package root exports `Basic`, `Evaluator`, `createHost`, `parseLine`,
`parseProgram`, `validateProgram`, `BasicSyntaxError`, `BasicRuntimeError`, and
the documented value, syntax, source-location, diagnostic, host and execution
types. See [architecture](architecture.md), [runtime API](interpreter-host.md),
[parser API](parser.md), and [evaluator API](evaluator.md).

The 1.x contract preserves the documented syntax and value rules, numeric label
ordering, source locations, machine-readable diagnostic codes, lifecycle and
cancellation ownership, executable behavior, and declared public types. Human
error wording and playground presentation may improve without preserving exact
phrasing or DOM selectors. The test suite's selectors are test infrastructure,
not a public DOM API.

`Basic` and `createHost` accept partial hosts. Missing output callbacks are safe
defaults; missing INPUT rejects clearly. WAIT has a cancellable timer default.
Complete structural `Host` implementations include `wait`; optional `draw`,
`readKey`, and `keyDown` expose independent graphics and keyboard capabilities.
An unsupported executed capability reports its documented source-located error.
Loading or skipping an expression does not itself require that capability.
Host callbacks preserve their receiver, and the runtime snapshots its host.
Providers own external resource cleanup and must honor abort signals; the
interpreter also prevents late completion from changing a replacement run.

The [graphics](graphics.md), [WAIT](wait.md), and [keyboard](keyboard.md) guides
are part of this contract: fixed 320 × 200 coordinates/palette, validated numeric
ranges and rasterization, approximate timing, logical key names, focus rules,
queue limits, Escape Stop, and unsupported-host behavior are explicit.

## Reserved names and extension policy

These names are currently reserved case-insensitively in the native dialect,
including terminal commands
and grammar words that are not standalone statements:

```text
ABS CIRCLE CLS COLOR END EXIT FOR GOTO IF INKEY$ INPUT INT KEYDOWN LET
LINE LIST LOAD NEW NEXT PRINT PSET REM RND RUN SAVE STEP THEN TO WAIT
```

Names such as `GOSUB`, `RETURN`, `LEN`, and `DIM` are not silently
reserved for possible future work. They retain their current meaning as names
when permitted by the grammar. A future feature must account for existing
programs rather than assuming a name was unavailable.

Versioning follows semantic compatibility for both programs and consumers:

- Patch releases correct defects against the documented contract without adding
  incompatible language or public-type requirements.
- Minor releases may add compatible exports, optional capabilities, examples,
  tooling and syntax only when existing valid programs and supported consumers
  retain their meaning and types. A new feature that conflicts with an existing
  variable name is not automatically a compatible addition.
- Removing or changing supported behavior, reserving a previously valid name,
  requiring a new callback on complete structural hosts, or extending a public
  closed AST/discriminated union in a way that breaks exhaustive consumers
  requires a major version. An explicitly selected dialect can provide
  incompatible semantics separately. Explicit language options currently accept
  only native; [design #116](https://github.com/jesselpalmer/BASIC/issues/116) must
  settle profiles, public types and the final reserved-name policy before 1.0.

Explicit [native arrays](arrays.md) are implemented. Historical array policies,
subroutines, required string/data/control-flow features and verified classic
profiles remain explicit 1.0 blockers. Sound and a play-only exporter remain optional unless a verified
corpus dependency changes that decision. #109 records NOT READY until a new
candidate meets the expanded gates; earlier candidate archives are historical.

## Migration from the older JavaScript package

1. Install Bun >=1.4.4; Node.js alone no longer runs this TypeScript distribution.
   Import named exports from the package root, or use CommonJS on Bun.
2. Replace standalone `10 ABS "-3.14"` and `20 INT "-1.6"` with
   `10 PRINT ABS(-3.14)` and `20 PRINT INT(-1.6)`. INT floors toward negative infinity.
3. Files validate completely before effects and execute in numeric label order.
   Correct duplicate labels, unresolved targets, and unmatched loops even after END.
4. Numbered terminal entries now edit stored source; use RUN. NEW, LOAD, SAVE and
   EXIT preserve work through confirmation and error recovery. Library `readLine`
   methods remain immediate-entry adapters and are separate from the editor.
5. END completes execution without exiting the embedding process. `run` and
   `step` return immutable execution observations. Use asynchronous methods for
   INPUT and WAIT, and handle AbortError when intentionally cancelling/replacing.
6. Provide drawing or keyboard host capabilities for graphics and games. The
   terminal supports text programs and WAIT; it reports clear unsupported-host
   errors for executed graphics or game-keyboard calls.

The unpublished 0.1.0 preparation was a development milestone, not an intervening
stable release or a second supported dialect. The old language-guide path remains
as a compatibility link to the 1.0 reference.
