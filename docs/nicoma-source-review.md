# NICOMA source review

The [March 1975 printing, pages 158–159](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=158)
credits Digital Equipment Corp. and leaves the interpreter unspecified.
The corpus README suggests BASIC-PLUS. The printed listing contains
`SLEEP(5)`, string `INPUT` and string comparisons, with replay controlled
by the program.

The [pinned transcription](../scripts/package/fixtures/classic/nicoma.bas)
has SHA-256 `bf6a70bf29ee28019e9f9107a18a5ad8998a2317793318de6af472854f6f6a04`.
The [reviewed listing](../scripts/package/fixtures/classic/nicoma-mar75-text.bas)
restores the trailing space within the printed literals on lines 30, 240 and 260. Its SHA-256 is `0d92549b3d7adcbfef3c2ce797574f4efe8c17246e6588610b3d3f4a6c2f44e8`.

The printed sample starts with remainders `3, 0, 5` and a guess of
`75`. It shows `RIGHT` echoed in the rejection before the same
guess is confirmed with `YES`. The next rounds show `2, 4, 6` producing
`104` with `YES`, `1, 1, 1` producing `1` with `NO`, and `0, 0, 1`
producing `15` with `YES`. The source accepts those values without
checking the stated range or reducing the individual remainders. After either
valid response it starts another round.

## Archived EDUSYSTEM-30 probes

Stock EDU30.SV reports `S1 90`, `S1 170` and `S1 180` when compiling the
reviewed listing. With each form isolated on line 10, `SLEEP(5)` and
`IF A$="YES"` each produce `S1 10`. `INPUT A$` and
`PRINT "GOT "A$` each produce `S2 10`. The isolated numeric core runs
and prints `YOUR NUMBER WAS 75 , RIGHT` with the first printed inputs.
The selected EDUSYSTEM-30 profile has no verified full NICOMA session.

```sh
python3 scripts/research/probe-edusystem30-nicoma.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56
```

## Archived RSTS V04B-17 replay

The reviewed listing enters and lists unchanged in BASIC-PLUS on the
[published RK05 disk image](https://iamvirtual.ca/PDP-11/RSTS-11/Install.htm)
(`RSTS11v4B.DSK`, SHA-256
`653dca363a376ba6a99a434cbacac7cd6ef050993db70184430544062802343f`).
The replay uses the [pinned SIMH PDP-11 build](rsts-v4a-build.md#pinned-inputs-and-resulting-code)
and waits for each complete prompt before answering.

The [console capture](nicoma-rsts-reference.json) records all four rounds,
the rejected `RIGHT` response, the next-round prompt and the operator's
Control-C return to `Ready`. The console output includes the four dots in
the listing's thinking message and the spaces in the numeric guesses.
In one run, the observed host delay from the thinking message to the guess
was 4.49–5.02 seconds. Wall-clock delay varies with simulator scheduling.
The archive establishes compatibility with V04B-17. The original interpreter
is still unverified. Separate numeric and string INPUT probes print
`PREFIX` without a newline before INPUT, then `TAB(4);"TAIL"` after
the response. Both print four spaces before `TAIL` on the new line.

The [October 1972 BASIC-PLUS manual, §8.8](https://www.bitsavers.org/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
defines SLEEP as a duration in seconds. The public profile implements whole
seconds from 0 through 32767. The V04B-17 archive accepts fractional syntax,
a negative value can remain suspended until interrupted, and 32768 reports
`INTEGER ERROR`. Those conversions and diagnostic continuation are outside the
public subset. The host implements a cancellable millisecond timer. The archive
capture does not establish the V4A-12 monitor's timer behavior.

```sh
python3 scripts/research/capture-nicoma-rsts.py \
  --simulator /path/to/simh/BIN/pdp11 --disk /path/to/RSTS11v4B.DSK
```

## Play the reviewed source

In the [playground](https://basic-playground-rho.vercel.app/), choose
**NICOMA · BASIC-PLUS selected profile** and select **Run program**. Enter the
remainders from dividing your number by 3, 5 and 7, then answer `YES` or
`NO` to the guess. Each answer starts another round. Select **Stop program**
to exit, including during the thinking pause.

The public library, CLI/editor and browser replay the four V04B-17 reference
rounds with the exact reviewed source under `basic-plus-v4a12-ma2`. The
library test observes four 5000 ms requests. The CLI and browser tests
exercise the real timers and interrupt a fresh run during SLEEP. Transcript
comparisons account for host presentation of input prompts and echo.
