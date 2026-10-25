# Native data probe

The DATA statements are unchanged lines from the pinned
[101 BASIC Computer Games corpus](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/tree/45f75052be3f436f2e575f58d4aa611484268227):
ANIMAL line 1100 (blob `aa73e3b6725bc0a76c5ad23f4d625b2b382241ee`) and
QUBIC line 1500 (blob `2bd1dc02537187330759b5c7038ba5656ca79016`).
Every other line is new scaffolding. No typo or source correction is applied to
these DATA lines. They test quoted punctuation/backslashes, numeric tables,
array/list targets, loops, RESTORE and the cursor shared with a subroutine.
Expected output is `corners=1:43:4:\AFISH` then `reset=1:49`.

This is an extracted feature probe, not an unchanged whole-game pass. QUBIC has
other source defects and unsupported forms; ANIMAL requires integer suffixes,
continuations, files, modifiers and intrinsics. Native typed data is not the
historical ASCII pool's coercion policy. AWARI's missing data stays unresolved;
exhaustion must remain an error. See `docs/data-statements.md` and #115/#116/#122.
