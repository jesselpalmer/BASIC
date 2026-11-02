# 1CHECK March 1975 quoted-text review

Source/evidence contract before acceptance changes for #115/#129. Preserve the
pinned raw fixture and existing one-byte line74 correction. Add a separately
named reviewed-text fixture; never normalize either older fixture in place or
silently repair user source in the interpreter.

## Primary evidence and bounded correction

Use the [March1975 book scan](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf),
SHA-256 `311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`.
The imprint explicitly identifies the third printing on printed/PDF2; the
listing/sample is printed/PDF164. The review rendered that page at400dpi and
checked all25 double-quoted literals on23 source labels, including blank cells
in the monospaced printed character grid. OCR is a search aid, not the authority
for spaces, punctuation or the zero glyph.

Three quoted spaces differ from the pinned transcription:

| Label | Preserved older fixture          | Reviewed text                     |
| ----- | -------------------------------- | --------------------------------- |
| 550   | `"REMAINING ON THE BOARD."`      | `"REMAINING ON THE BOARD. "`      |
| 580   | `"PLEASE ANSWER 'YES' OR 'NO'."` | `"PLEASE ANSWER 'YES' OR 'NO'. "` |
| 610   | `"O.K.  HOPE YOU HAD FUN!"`      | `"O. K.  HOPE YOU HAD FUN!"`      |

The new `1check-mar75-text.bas` starts from the existing minimal correction,
then inserts exactly these three ASCII spaces. Relative to raw source, its only
other change remains the previously verified semicolon-to-comma at74. It is
2,045 bytes/86 physical lines, SHA-256
`f4744d9a5e9c6aa8bd08375d743e2ab7800c68e3af4d8d1a495717a3e99894b4`.
All85 labels, operands, branches, loop bounds and the final blank line stay
identical to the preserved fixture. Source layout outside these changes remains
the transcription's own; this is a reviewed quoted-text fixture, not an exact
facsimile of physical typesetting or a recovered original machine file.

The remaining22 literals agree with the March1975 copy. In particular, line72
has one blank between the first two `##` fields and two between subsequent
fields, matching the pinned fixture; the earlier scan's format-spacing concern
does not establish a difference in this printing. At230, the printed text has
two blanks after `MOVE.` and **three** terminal periods, matching the fixture.
The third period sits close to the closing quote and must not be dropped based
on OCR or a reduced-resolution view. Line78's closing quote follows the colon
without an inserted trailing blank. The semicolons at110/360/562 were already
resolved in the preceding review and stay unchanged.

## Acceptance and remaining gates

Run both the minimal correction and new reviewed-text fixture through identical
independent game oracles: numbered board,48-piece opening, illegal move without
mutation, legal1-to19 midpoint removal, summary, invalid replay response, YES
reset, NO exit and fresh rerun. Retain the seven printed opening moves and
rejection of the sample's discontinuous12-to26 input. Assert literal trailing
spaces and goodbye text exactly; neither trimming nor substring-only checks may
hide a regression. Verify direct/installed ESM/CommonJS, CLI and actual browser
import/run/input/export/reload/Stop against checkout and extracted static bytes.

Keep exact source/hash/patch assertions, including the old fixtures. The native
summary's compact numeric output still differs from historical padding. This
review resolves the quoted-text differences in the selected printing; it does
not identify the original interpreter/version, settle historical numeric/input/
subscript rules, complete a continuous35-jump sample replay, or certify a full
historical-game pass. All108 corpus dispositions remain required; source and
behavior ledger status counts remain unchanged.
