# Classic source fixtures

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
