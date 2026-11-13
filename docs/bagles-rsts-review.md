# BAGLES source review

The [March 1975 description and listing, pages 22–23][book] credit D. Resek
and P. Rowe of the Lawrence Hall of Science at U.C. Berkeley. The listing
identifies an RSTS/E conversion by Dave Ahl after a Timeshared-8 modification.
The original monitor version and the printed sample's random sequence remain
unverified.

The [pinned corpus transcription](../scripts/package/fixtures/classic/bagels.bas)
keeps the upstream filename and bytes. The
[reviewed BAGLES text](../scripts/package/fixtures/classic/bagles-mar75-text.bas)
restores printed spacing in lines 100, 210, 615, 630 and 660, the semicolon
after the no-match clue at 590, and the printed score wording at 740. It
normalizes the space after label 5, the separator at 740, and the terminal
newline. The original statement order and game logic are preserved.

## Archived execution

The [archive reference](bagles-rsts-reference.json) matches the reviewed
source and the [portable adaptation](../scripts/package/fixtures/classic/bagles-ma2.bas)
on both [rebuilt RSTS V4A-12 MA2](rsts-v4a-build.md) and
[archived V04B-17](nicoma-source-review.md#archived-rsts-v04b-17-replay).
The archive runs omit `RANDOMIZE` from line 40 to start from the default
stream. The capture checks the complete program output, excluding operator
echo, monitor banners and the monitor's final blank line.

The first puzzle rejects a two-digit entry, a nonnumeric entry and repeated
digits without counting them as guesses. Clues include both PICO and FERMI,
and guess five wins with `740`. A YES replay preserves the score and draws a
new secret from the same stream. Twenty wrong guesses end with the reveal
`259`. NO prints the one-point score and finishes at END.

The adaptation uses `CHANGE A$ TO A1` in the selected BASIC-PLUS profile.
It lets the FOR loop finish before redrawing a duplicate secret digit or
retrying a nonnumeric guess. An explicit counter replaces the 20-guess FOR
so replay can restart after an early win. These changes preserve the
checked transcript and keep the selected loop scope. Replacing active
FOR frames by reentering a FOR header remains separate compatibility work.

## Play BAGLES

Choose **BAGLES · BASIC-PLUS adaptation** in the [playground][playground].
Guess three distinct digits, including an initial zero when appropriate.
PICO marks a correct digit in a different position, and FERMI marks a
correct digit in the right position. BAGLES means no digit matches.

The shipped source retains `RANDOMIZE` and draws a host entropy word. The
installed library, CLI/editor, and browser replays supply zero entropy to
compare the archive's default stream. The public tests cover fresh RUN,
and the CLI editor saves and reloads the selected portable source.

```sh
python3 scripts/research/capture-bagles-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --v4a-disk /path/to/raw-v4a.dsk \
  --v4b-disk /path/to/RSTS11v4B.DSK --output /tmp/bagles-rsts-reference.json
```

[book]: https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=22
[playground]: https://basic-playground-rho.vercel.app/
