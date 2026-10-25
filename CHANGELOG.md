# Changelog

## 1.0.0 — unreleased development

The exact candidate, validation and publication status are recorded in
[release readiness #109](https://github.com/jesselpalmer/BASIC/issues/109).
The earlier unpublished 0.1.0 preparation was a development milestone.
The previous READY decision is withdrawn: verified classic-game compatibility
now blocks1.0. See the [roadmap](docs/classic-games-roadmap.md) and #114.
The implemented changes below remain available; planned compatibility features
are not claimed as shipped.

- Add bounded native colon-separated statements with real instruction positions,
  same-line loops, source-backed false-IF line scope and per-member stepping,
  budgets, cancellation and source columns. Preserve existing single-statement
  ASTs and exact source; reject immediate sequences before effects. Historical
  inline branches, backslashes and full-corpus certification remain pending.
- Add scientific E/e literals in source and numeric INPUT, and left-associative
  powers with explicit precedence/domain/overflow rules. Preserve existing numeric
  names and verify extracted corpus formulas across installed and browser paths.
  Historical intrinsics, profiles, randomness and full-game certification remain open.
- Add contextual native PRINT USING with bounded single-pass integer # fields,
  exact alignment and atomic writes. Preserve USING scalar/array names. Test the
  separately reviewed one-byte 1CHECK correction through moves/retry/replay/exit;
  raw-source rejection and historical formatting/profile blockers stay explicit.
- Accept string-involved adjacent PRINT items while preserving greedy expressions,
  native numeric spelling, physical semicolon spans and existing USING names.
  Historical output policies remain pending.
- Add explicit native DIM, numeric/string arrays with one or two dimensions,
  indexed reads/assignments, preflight allocation limits and bounded immutable
  array observations. Preserve scalar DIM names and separate scalar/array storage.
  Historical defaults/conversions, indexed INPUT and full 1CHECK support remain pending.
- Carry explicit native dialect context through parser snapshots, preparation and
  runtime/evaluator instances. Reject unsupported metadata before effects while
  preserving legacy native trees. Historical profiles remain unavailable.
- Accept scalar assignment with optional LET and the contextual GO TO spelling,
  preserving GO as a native variable and exact source locations. Test an unchanged
  classic-game loss/replay path while explicitly retaining its RNG/format blockers.
- Ship a TypeScript/Bun library and terminal with typed expressions, ABS/INT/RND,
  LET/PRINT/INPUT, IF/THEN/GOTO, nested FOR/NEXT, REM, CLS and END.
- Add stored-program editing with LIST/RUN/NEW/LOAD/SAVE/EXIT, protected source
  replacement, recoverable errors, staged file writes and source recovery at EOF.
- Provide immutable parser/runtime observations, quiet imports, isolated runs,
  async input/cancellation, instruction budgets, host callbacks and public types.
- Add a static browser playground using the shared parser/runtime, exact source
  import/export, local draft recovery, bounded output, Run/Stop/Escape and INPUT.
- Add Pause/Continue/Step, read-only variable inspection and physical source
  highlighting through the shared statement gate.
- Add a fixed 320 × 200 canvas, 16-color palette, COLOR/PSET/LINE/CIRCLE and
  bounded clipping/rasterization, including enormous offscreen coordinates.
- Add cooperative WAIT with guarded duration limits and cancellable timers;
  present complete buffered frames before waiting.
- Add focused INKEY$/KEYDOWN input with a bounded queue, repeat suppression,
  modifier-safe release and lifecycle cleanup. Escape remains reserved for Stop.
- Include greeting, times-table, guessing-game, picture, bouncing-ball,
  arrow-key marker and complete one-player Pong examples. Pong has BASIC
  gameplay, Space serves, a computer opponent, scoring, win/loss and restart.
- Verify installed ESM/CommonJS consumers, public types, local/global CLI,
  persistence/interruption and actual Chromium UI on Linux/macOS. Release
  preparation validates the exact npm and versioned static archives separately.

### Migration from 0.0.10

- Bun >=1.4.4 is required; Node.js alone is not a supported runtime. ESM imports
  and CommonJS require are supported on Bun; the package ships TypeScript source.
- Replace standalone `10 ABS "-3.14"` with `10 PRINT ABS(-3.14)` and standalone
  `20 INT "-1.6"` with `20 PRINT INT(-1.6)`. INT floors toward negative infinity.
- Files execute in numeric label order and validate complete source before
  effects, including duplicate labels, missing targets and unmatched loops.
- END completes a run without terminating the host. Numbered terminal entries
  edit stored source; use RUN. Legacy library readLine methods remain immediate.
- The current snapshot remains a limited native dialect. Historical array rules, DATA/READ,
  GOSUB/RETURN and other verified classic features are not implemented yet and
  now block 1.0. General immediate statements and sound remain optional unless
  the certified corpus establishes a dependency. Graphics and keyboard calls
  need their optional host capabilities.

See the [language reference](docs/language-v1.md),
[support/extension and migration policy](docs/compatibility.md),
[release notes](docs/release-notes-1.0.md), and
[release checklist](docs/release-checklist.md).
