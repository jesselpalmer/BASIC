# BASIC-PLUS software MA2 random numbers

The [October 1972 BASIC-PLUS manual, §§3.7.1–3.7.2](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
describes bare `RND` and `RND(X)`, repeatable RUNs and a clock-influenced
`RANDOMIZE`. The [V4A-12 software MA2 capture](rsts-v4a-ma2-rng-reference.json)
rebuilds the [pinned system](rsts-v4a-build.md) and checks the first 12 draws,
fresh RUN, numeric arguments and the recurrence after RANDOMIZE.
Those 12 default values also match the [V04B-17 archive](aceydu-rsts-reference.json).
The V4A-12 probe uses the same manual clock enable and initial Ready context
as the earlier arithmetic probes.

## Instruction evidence

In the extracted MA2.OBJ payload (SHA-256
`6d27b8d91ed33666292ef909472365dc19451275de20e56305be0d6d0ef1f303`),
the text record at file offset `0x17c4` begins at section offset `03422`.
It loads the seed at `0502(R4)`, loads multiplier `076003` (31,747),
calls the software signed multiply and stores its low product back to
`0502(R4)`. An arithmetic left shift drops the sign bit for the result.
The archived probe verifies that the observed fraction is exactly the
remaining 15 bits divided by 32,768, including a zero residual after
scaling a second time. The seed initialized to octal `015073` (6,715) in
the OV.OBJ record at file offset `0x36aa` agrees with the first live
draw and every subsequent result.

At section offset `03502` in the MA2.OBJ text record at file offset
`0x180c`, the other routine loads the same context base, adds a shared
memory word to the seed, then sets its low bit. Its original words
are shown in octal below, including relocation operands.

```text
016704 004032                 MOV 004032(PC),R4
066764 004004 000502          ADD 004004(PC),0502(R4)
052764 000001 000502          BIS #1,0502(R4)
000207                       RTS PC
```

The linked sequences are also visible in the raw V4A-12 disk at byte
offsets `0x9e92` and `0x9ec4`, and in the V04B-17 disk at `0xa27a` and
`0xa2ac`. Relocation addresses and the displacement to the software
multiply differ by build. Both retain the 16-bit seed update, 15-bit output,
addition of a shared word and low-bit force.

## Public selected behavior

A fresh selected MA2 run starts with seed 6,715. Each call updates that
16-bit word and returns an exact MA2 number. A supplied numeric argument
is evaluated first and its value is discarded. A source error in that
expression follows the selected profile's existing diagnostic policy.
`RND()` and multiple arguments are outside the selected syntax.

`RANDOMIZE` obtains one sample from `Host.random()` and uses
`floor(sample * 65536)` as the 16-bit entropy word. It adds the word to
the current seed modulo 65,536 and sets the seed's low bit. The host
sample stands in for the archived system word. This does not reproduce
its wall-clock source or the time-dependent deal in the printed sample.
A host sample of zero preserves the already odd state and provides a
repeatable replay of the exact reviewed ACEYDU listing. Regular draws do
not call the host. The native, EDUSYSTEM-30 and Altair streams retain their
own policies.

Reproduce the selected archive observations against the reconstructed
[raw disk before REFRESH](rsts-v4a-build.md#boot-and-startup-limitations).

```sh
python scripts/research/capture-ma2-random.py \
  --simulator /path/to/pdp11 --disk /path/to/raw.dsk \
  --output /tmp/rsts-v4a-ma2-rng-reference.json
```
