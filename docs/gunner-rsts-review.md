# GUNNER source review

The [March 1975 description and listing, pages 115–116][book] credit Tom
Kloos of the Oregon Museum of Science and Industry. The listing explicitly
identifies a conversion to RSTS/E by David Ahl. The author's earlier
interpreter and the printed sample's random sequence remain unverified.
This review concerns GUNNER, not the separate GUNER1 listing.

The [pinned corpus transcription](../scripts/package/fixtures/classic/gunner.bas)
retains the upstream bytes. The
[reviewed text](../scripts/package/fixtures/classic/gunner-mar75-text.bas)
restores four details visible on page 116: the extra PRINT at 444, assignment
to **I**, rather than **T**, at 450, subroutine labels 600/610, and the
semicolon after `CHR$(7)` at 600. The incorrect assignment overwrites the
target and makes ordinary firing impossible. The incorrect subroutine labels
leave every successful target's call without a destination.

The reviewed text normalizes the printed backslash separators to colons and
`GO TO` to `GOTO`, accepted by the selected RSTS build. The
[public adaptation](../scripts/package/fixtures/classic/gunner-ma2.bas)
expands the three bell-only subroutine calls locally into the same ten-iteration
FOR/PRINT loop and replaces `CHR$(7)` with a literal byte 7. It removes the
now-unused subroutine. It retains all shot arithmetic, branch targets,
messages, loop order and replay behavior. These local changes avoid widening
the selected profile's subroutine or function contracts.

## Archived execution

The [reference](gunner-rsts-reference.json) matches the reviewed and adapted
listings on both [rebuilt RSTS V4A-12 MA2](rsts-v4a-build.md) and
[archived V04B-17](nicoma-source-review.md#archived-rsts-v04b-17-replay).
The capture verifies the entered LIST, omits line 90 RANDOMIZE to use the
stock initial stream, and records complete output without operator echo or
monitor banners. The public fixture retains RANDOMIZE; acceptance supplies
a zero entropy word to reproduce the archive stream.

The session rejects elevations 0 and 90 without using ammunition, shoots
short and over the first target, and destroys all five targets. The fifth
target is 40655 yards away, crossing the earlier selected output boundary of 32767. Automatic replay then takes six unsuccessful shots and prints the
enemy-destruction message, before starting another game. All sixty bell bytes
are retained in the reference output. A separate captured probe checks
ordinary PRINT at positive and negative integer boundaries through 46500,
and confirms that BEL leaves the print position unchanged before TAB.
The public output renderer extends only this bounded integer domain and byte
7; other control characters and fractional numeric output remain gated.

Line 491 has a historical quirk worth preserving: when `S1>15` is false,
RSTS skips the entire remaining line, including NICE SHOOTING and its GOTO.
Execution falls through to the refresher-training message even after a
seven-round victory. The printed sample similarly shows refresher training
at fifteen rounds. This review does not silently repair that game logic.

## Play GUNNER

Choose **GUNNER · BASIC-PLUS adaptation** in the [playground][playground].
Enter an elevation from 1 to 89 degrees. A hit within 100 yards destroys the
target; the sixth valid shot destroys your gun. Five destroyed targets end
a session and the game automatically starts again. Use Stop to finish.
The library, installed CLI/editor and browser acceptance cover the complete
archived session and a fresh run. The CLI editor additionally saves/reloads
the selected document and stops a waiting game without losing its source.

```sh
python3 scripts/research/capture-gunner-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/gunner-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=115
[playground]: https://basic-playground-rho.vercel.app/
