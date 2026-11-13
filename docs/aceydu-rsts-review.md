# ACEYDU source review

The [March 1975 description and listing, pages 13–14](https://archive.decromancer.ca/bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=13)
credit Bill Palmby and identify Dave Ahl's RSTS/E translation on line 30.
The scan has SHA-256
`311c1be8d3c9361ee9badb59b5a43c43a5b0bf4803298943be1cb617b8f33ad7`.
The original system version and the printed sample's randomized deal are
unverified.

The [pinned transcription](../scripts/package/fixtures/classic/aceydu.bas)
has SHA-256 `686b00f4ca413243877764e9bec6d3318831884bfa8bc8ffab07749b6e1142c4`.
The [reviewed listing](../scripts/package/fixtures/classic/aceydu-mar75-text.bas)
restores the remark on line 20, trailing spaces inside seven PRINT literals
(102, 105, 106, 190, 260, 970 and 1010), and the space in `O. K.` on 1040.
Its SHA-256 is `4fe731f92c62c0a28f871459780ec859ee586883d9afb97ca62a6f443deb0dda`.
The listing keeps the printed statement order, line numbers and game logic.

## Archived RSTS/E V04B-17 replay

The reviewed text loads and lists unchanged on the
[pinned V04B-17 disk](nicoma-source-review.md#archived-rsts-v04b-17-replay).
With `RANDOMIZE` at 100, the capture checks the $100 bankroll, a rejected
$101 bet, a $0 pass, two bankruptcies, YES replay with $100 restored, and
NO returning to Ready. The script responds to the current bankroll because
the clock can change the deal.

The [default-stream replay](aceydu-rsts-reference.json) omits only line 100
for a repeatable deal. It checks every printed
card, prompt and bankroll through the same operator sequence, including a
$70 win, a $140 loss, and a fresh $100 on replay. The archive's initial
face-up cards are 3 and 4. The capture normalizes CRLF to LF and removes
operator echo and the monitor's RUN banner and Ready prompt.

A separate probe records 12 exact fractions from the default stream. Each
observed result times 32,768 is integral. A second RUN repeats the sequence.
`RND(I-2)` yields the same sequence for arguments from −1 through 10.
`RND(1/(I-1))` reports division by zero before the first draw, then the
archive continues with the same sequence. The
[rebuilt V4A-12 MA2 archive](rsts-v4a-ma2-rng.md) reproduces the default
values with both forms.

```sh
python3 scripts/research/capture-aceydu-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --disk /path/to/RSTS11v4B.DSK
```

## Play the reviewed listing

The [playground](https://basic-playground-rho.vercel.app/) offers
**ACEYDU · BASIC-PLUS selected profile** under `basic-plus-v4a12-ma2`.
It runs the exact reviewed source, including `RANDOMIZE` on line 100.
The runtime obtains an entropy word from the host in place of the original
monitor's changing system word. The printed sample's deal remains unverified.

Enter a bet when prompted. A bet of `0` passes. When your bankroll reaches
zero, enter `YES` to restart with $100 and continue the random stream, or
`NO` to finish. The installed library, CLI/editor and browser acceptance
tests supply a zero entropy word to reproduce the complete captured
default-stream session using the reviewed listing. The library and CLI also
run the [separate default-stream fixture](../scripts/package/fixtures/classic/aceydu-rsts-default.bas),
which removes line 100 and needs no injected entropy. The portable terminal
excludes the monitor's final blank line. The browser renders the input prompt
beside the entry field and echoes responses in the transcript.
