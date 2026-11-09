# Classic source fixtures

## 1CHECK — raw and reviewed correction

`1check-raw.bas` preserves the exact [pinned transcription](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/1check.bas),
SHA-256 `87b6ea841f5e6ff0af0718ef3f4f905c992535455afd5d3400b1e2946c30d04f`.
The book credits David Ahl. The inspected printed listing on page164 / leaf n165
has a comma after B$ on line74; the transcription has a semicolon. The separately
named `1check-corrected.bas` changes exactly that one byte, to match the
[printed listing](https://archive.org/details/101basiccomputer0000davi/page/n165/mode/1up).
Its SHA-256 is `952576cf60f86f5548a880e261e06f6e7353ad607827596d83e028ddbe7ece94`.
No other source, spacing, dialogue or game logic is changed, including the raw
file's final blank line. See
`docs/classic-source-review.md` for scan edition/hash evidence and the source policy.

These files use the same public-domain book/provenance policy described below;
no modern repository license is inferred. Raw source is deliberately rejected
at the unsupported template delimiter. The corrected listing executes a complete
scripted native path (illegal move, legal jump, retry/replay and normal exit).
Native number spacing still differs from the historical rules, and the original
dialect is not certified. This is a corrected native path, not a complete
historical-game compatibility pass. Both remain test fixtures excluded from npm.

The source review also records a complete 85-label comparison and a discontinuity
in the printed sample after its seven visible opening moves. The additional
bounded opening scenario ends at seven jumps/41 pieces, rejects the next visible
12-to26 move from an empty source square, then exits. The printed35-jump/13-piece
summary is not a reproducible oracle for that visible prefix. The follow-up
March1975 scan (imprint and hash in the source review) clearly shows semicolons
at110/360/562, matching both fixtures. No additional correction follows. Quoted
spacing/punctuation still differs, so neither fixture is a lossless book transcription.

## 1CHECK — March 1975 reviewed quoted text

`1check-mar75-text.bas` is a third, separately named fixture. Relative to the
preserved minimal correction, it adds exactly three reviewed ASCII spaces:
trailing blanks inside the literals at550 and580, and a gap between `O.` and
`K.` at610. Its2,045 bytes/86 physical lines have SHA-256
`f4744d9a5e9c6aa8bd08375d743e2ab7800c68e3af4d8d1a495717a3e99894b4`.
The original raw/minimal hashes and bytes remain unchanged. See the complete
[25-literal visual review](../../../../docs/1check-reviewed-text.md), including
March1975 scan identity, exact patch, agreement at72/230/78 and remaining limits.

All three spaces are asserted in exact native output. Both corrected variants
run the same illegal/legal/retry/replay and seven-move opening oracles through
direct/installed ESM/CommonJS, CLI and actual browser/extracted-static acceptance;
source import/export/reload stays byte exact. No numeric padding, original dialect
or complete historical game is certified. The fixture remains excluded from npm.

## 23MTCH — unchanged source and reviewed correction

`23mtch.bas` is unchanged from
[maurymarkowitz/101-BASIC-Computer-Games](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/23mtch.bas),
commit `45f75052be3f436f2e575f58d4aa611484268227`.

- Raw SHA-256: `6406621c19cfac9961d0b4fa36ba50d322f4697648b1021fe99cace6ef9d8896`.
- Source: David Ahl's _101 BASIC Computer Games_, listing/sample printed page 227,
  PDF page 229 / leaf n228 of the
  [archived book](https://archive.org/details/101basiccomputer0000davi/page/n228/mode/1up).
- The book credits the published version to Bob Albrecht, People's Computer Co.
  Its sample identifies EduSystem 30. Do not call it a certified native/BASIC-PLUS
  program merely because individual forms are supported.
- The archival record marks the book Public Domain and cites Ahl's 2022 dedication.
  The modern transcription repository has no license metadata; its README and
  modern files are not copied or relicensed here. Preserve this attribution.

This is a test oracle excluded from the published npm archive. The installed
consumer harness copies its own fixtures outside the checkout and imports the
runtime solely from the installed package. Browser tests use these source bytes
as user-imported input, including against the extracted static artifact.

The checked native loss/replay path does not execute RND(0). A separate assertion
records that branch as still unsupported. Native numeric formatting also differs.
These tests prove the new GO TO spelling and source/control-flow preservation;
they do not count as a complete historical-game compatibility pass in #129.

`23mtch-corrected.bas` preserves the raw fixture except for one inserted terminal
semicolon at label 380, matching the already reviewed printed listing/sample.
SHA-256: `6e20090bfdebc2f4760baa7568d53d6a64e18310f2f9daf6e95a883666956364`;
1,212 bytes / 44 physical lines. Quoted spacing remains the transcription's own,
so this is a one-byte correction rather than complete scan normalization. The
raw and corrected seven-moves-of-one paths have complete exact native-output,
invalid-move/retry, loss/replay and explicit blocked-RNG assertions across direct
and installed library, CLI and browser/extracted-static hosts. The correction
suppresses six newlines; game state and all other source bytes stay identical.
Both fixtures remain excluded from npm production archives.

`23mtch-mar75-text.bas` adds the reviewed line 220 prompt delimiter and the
printed text adjustments at 110, 115, 120 and 420. It retains 44 physical lines
and every game branch. Its SHA-256 is
`6b4ce01cdd00a638a415801bd912f9cbfe8ae02d1e42c6b41e759246f1f94ecc`.
The [March 1975 source review](../../../../docs/classic-source-review.md#march-1975-listing-and-edusystem-30-reference-run)
records the scan provenance and the archived EDU30.SV run of these exact bytes.

## LIFE2 — March 1975 reviewed listing and sample

`life2-mar75-reviewed.bas` retains the pinned LIFE2 transcription with
scan-backed corrections at ten labels. The fixture credits Brian Wyvill and
is tied to printed page 148 of the March 1975 third printing. The
[review](../../../../docs/classic-source-review.md#life2) records both source
hashes, the terminal mask uncertainty and the exact scope of the corrections.
`life2-sample.json` records the seven printed boards and a reconstructed
sequence of masked inputs, verified by a separate board model. Both files
are test fixtures excluded from npm. The original dialect remains unverified.
