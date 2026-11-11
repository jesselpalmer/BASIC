# EVEN on EDUSYSTEM-30

The [March 1975 printing, pages 96–97](https://www.bitsavers.org/pdf/dec/_Books/101_BASIC_Computer_Games_Mar75.pdf#page=96)
describes deterministic EVEN and a separate learning program called EVEN 1.
The printed edition leaves the original author and BASIC interpreter for
EVEN unspecified. The [pinned transcription](../scripts/package/fixtures/classic/even.bas)
has SHA-256 `1d83a93a9c29e4cb912985bf043d8bbaa82f4619fbef921579f5bd4a00fecc92`.
The [reviewed fixture](../scripts/package/fixtures/classic/even-mar75-text.bas)
restores the PRINT separator at line 270, the empty literal at line 360,
and the conditional `IF R<4.7 THEN 660` at line 620. It removes the blank
line after 490 and preserves the printed `LETT=27` at line 250. Its SHA-256
is `a71644ae93419433525e5798422a156186ebbf5243a61e3a572683e1887c2eed`.

## Archived execution

The [archived EDU30.SV transcripts](even-edusystem30-reference.json)
include the printed game, a winning replay, and a fresh computer-first game
that checks out-of-range and overtake retries. The printed game ends with the
computer holding 16 marbles and the player holding 11. The winning replay
ends with the player holding 12 and the computer holding 15. The computer-first
run exercises the restored branch at line 620 and ends 18–9. The transcripts
preserve the numeric fields and input prompts and exclude host input echo,
the OS/8 banner, SIMH tape housekeeping and the interpreter's return to `READY`.

The archive accepts `DIM M(20),Y(20)` and assigns `M` and `Y` as scalars.
The listing has no indexed references. On the computer-first branch the
archive treats compact `LETT=27` as `LET T=27`. In the native profile the
same source binds the longer variable `LETT`, and that branch stops with
undefined `T` at line 270. Native reaches the printed ending when the
player starts.

Choose **EVEN · EDUSYSTEM-30 selected profile** in the
[playground](https://basic-playground-rho.vercel.app/). Start with `1` to
move first, then take one to four marbles per turn. The player holding an
even number when the pile is empty wins.

```sh
python3 scripts/research/capture-edusystem30-even.py \
  --simulator /path/to/simh/BIN/pdp8 --tape /path/to/edu30.tu56 \
  --output /tmp/even-edusystem30-reference.json
diff -u <(python3 -m json.tool docs/even-edusystem30-reference.json) \
  <(python3 -m json.tool /tmp/even-edusystem30-reference.json)
```
