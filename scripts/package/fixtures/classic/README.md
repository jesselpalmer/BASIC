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
summary is not a reproducible oracle for that visible prefix. Unclear scan
punctuation at110/360/562 is not applied as additional fixture corrections.

## 23MTCH — unchanged source

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
