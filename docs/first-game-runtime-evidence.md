# First-game BASIC-PLUS runtime evidence and activation matrix

Design/evidence contract for #115/#116/#126/#129. The separately reviewed
March1975 1CHECK text is a **candidate compatible program** for the selected
V4A-12 software MA2 experiment. Its original interpreter/version remains unknown.
This document must not relabel that attribution or turn native game tests into a
historical compatibility pass.

## Reference experiment boundary

Use the hash-pinned [selected build](rsts-v4a-build.md), reconstructed from blank
DOS scratch disks with identical object/map/loader payloads. A separate raw RK05
copy is refreshed and booted. Retain the manual clock-register adjustment,
missing INIT CUSP and existing save/filesystem limitation. The experiment is not
an I/O-complete/site-initialized reference installation and cannot be a general
terminal/file/RNG oracle.

The authored probe will measure arithmetic-dependent subscript selection and
FOR/NEXT state, using explicitly initialized variables/cells and source-located
ERR/ERL observations. Output is a capture transport for those observations;
whole terminal/default/I/O policy is not inferred. Check LIST against exact probe
source and compare two final runs before retaining an observation. Preserve raw
source/result hashes and distinguish recorded facts from unresolved policy.

## Required probe coverage

- Positive/negative/fractional subscript neighbors around0,0.5,1,1.5 and the upper
  bound, with explicitly assigned distinct cells; distinguish assignment
  truncation, nearest rounding and floor. Include out-of-range ERR/ERL and a
  successful continuation target without silently changing the game.
- Positive/negative-step FOR completion, empty ranges, body changes to an index,
  skipped/reentered loops and explicit post-loop values. Record only executed
  cases; do not generalize one loop path to suspended GOSUB/FN ownership.
- First-game integer arithmetic, INT/ABS and stable board-rule values where
  useful, with no implicit random state or host entropy.

## Closed first-game support matrix

The resulting matrix must enumerate every source form required by the candidate
and identify: manual/reference evidence, current implementation owner, native
agreement/difference, and the exact remaining activation test. A row is blocked
until its accepted syntax and all value/effect semantics are implemented together.
The matrix is a concrete preparation for shared-parser/runtime integration, not
permission to expose a partial profile or accept a statement name while executing
its numeric expressions with native fallback.

Required rows include labels/names/quotes, decimal literals and arithmetic,
INT/ABS, defaults and arrays/subscripts, LET/DIM, FOR/NEXT/transfers, IF relations,
PRINT/USING and cursor/padding, INPUT prompts/conversion/retries, replay strings,
END and numeric/error observation boundaries. Keep unsupported source/tree forms
rejected before effects, including unreachable clauses. Native retains long
names, finite doubles, explicit arrays, loop guards, compact output and fatal
errors. Program source/dialect replacement, stepping/cancellation and host round
trips remain required acceptance surfaces.

The full108-file release requirement and zero certified historical-game passes
remain unchanged. This evidence does not waive conversion/status, host, RNG,
profile support or complete game gates.
