# Selected RSTS V4A-12 MA2 execution observations

Research for #116/#123, observed November 1, 2026. The V4A monitor was assembled,
linked and booted, and an authored BASIC probe executed. This is a selected
**two-word software MA2** experiment, with startup/I/O limitations below. It is
not a complete historical installation, public dialect, or corpus certification.

## Pinned inputs and resulting code

The [build record](rsts-v4a-build.json) pins the DOS distribution, both V4A
system-generation tapes, simulator revision/source archive, generated file
payloads, checked absolute-loader images and selected MA2 object. Obtain these
separately; no operating-system binary or emulator is included in this repository.
Normal project checks do not download or run them.

Primary distribution:

- [DOS002, DEC-11-MW2C-UC](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/RG_DECtapes/dos002.dta)
- [V4A tape zero](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/rsts00.dta.gz)
- [V4A tape one](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/rsts01.dta.gz)

The existing [read-only verifier](rsts-reference-media.md) verifies tape one;
its forward-only layout does not accept tape zero. The May 1972
[DOS Monitor V004A System Programmer's Manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/dos-batch/DEC-11-OSPMA-A-D_PDP-11_DOS_Monitor_V004A_System_Programmers_Manual_May72.pdf),
§4.2.3, printed 4-15, explains signed DECtape links. Negative links read backward.
Reverse the **16-bit word order**, preserving bytes inside each word. Tape zero's
SYSGEN.LDA has 52 blocks ending with -574,-570,...,-538; that is not damage.

The simulator is [SIMH commit 698dc8a1](https://github.com/simh/simh/tree/698dc8a1b2135ab03f1da0be9ee44b5f1beeadc6).
The local build command is recorded in JSON; optional package installation was
suppressed. The downloaded branch archive was compared with a separately fetched
commit archive: every regular-file relative name and byte is identical after
removing the enclosing archive root. Both archive hashes are retained. The executable hash identifies this local build, not a portable
reproducible-binary claim. No Ethernet adapter or host network endpoint was
attached. Earlier attempts with SIMH3.8-1 and DOS/BATCH V09-20 are not the final
reference build: old utilities rejected commands or failed while loading. The
final reconstruction uses the pinned current simulator and period DOS V004A.

## Reproduction from blank scratch disks

Keep the original media read-only. All disk names below refer to new scratch
images; retain them for inspection. Decompress the two kit tapes to rsts00.dta
and rsts01.dta. Start the simulator with:

```text
SET CPU 11/05
SET CPU 64K
SET CLK 60HZ
SET HK DISABLED
SET PTR DISABLED
SET PTP DISABLED
SET DZ DISABLED
SET RL DISABLED
SET RX DISABLED
SET RP DISABLED
SET RQ DISABLED
SET TS DISABLED
SET TQ DISABLED
SET RK ENABLED
ATTACH RK0 clean-DOS.dsk
ATTACH RK1 clean-V4A.dsk
SET TC ENABLED
ATTACH -R TC0 dos002.dta
ATTACH -R TC1 rsts01.dta
SET LOG clean-console.log
BOOT TC0
```

At the SYSLOD halt at PC030464, deposit SR100001 and CONTINUE. After the
PC030122 halt, CONTINUE again to `MONITOR V004A`. Interrupt the simulator,
replace TC0 with read-only rsts00.dta and CONTINUE. In DOS, enter each command
after its prompt:

```text
LO 1,1
DATE 12-DEC-72
TIME 12:34
RUN DT0:SYSGEN
```

Choose short questions (`S`). Answer the following in order. These are the
selected experiment's settings, not defaults inferred from a filename.

| Prompt               | Answer   | Prompt           | Answer |
| -------------------- | -------- | ---------------- | ------ |
| Installation         | V4A12MA2 | AC frequency     | 60     |
| Clock                | L        | Power fail       | N      |
| Max job number       | 1        | KL11/DL11A/DL11B | 0      |
| DC11                 | 0        | DL11E            | 0      |
| Fill                 | N        | Serial LA30      | N      |
| Lowercase conversion | 1        | XON              | N      |
| Scopes               | N        | Parity           | 1      |
| RF11                 | 0        | RK11             | 1      |
| RC11                 | 0        | Paper reader     | N      |
| TC11 dual drives     | 1        | CR11             | N      |
| LP11                 | N        | TM11             | 0      |
| Small buffers        | 64       | Math package     | 2      |
| No fail              | N        | Record I/O       | Y      |
| Update               | Y        | PRINT USING      | Y      |
| Matrix               | N        | DSKINT           | N      |
| ROLLIN               | N        |                  |        |

Run the supplied utilities; wait for each command's completion. The three
assemblies must report zero errors. Control-C followed by `KI` exits a DOS
utility. Use fresh output names if previous attempts left files behind.

```text
RUN DT0:LINKOB
RUN DT0:MACRO
SY<CF,DT0:SY,TB
TT<CF,DT0:SY,TT
DK<CF,DT0:SY,DK
[Control-C, KI]
RUN DT0:LINK
SY,SY,SY<SY/B:0,TT,DK
DT1:DT
DT0:EX/CC
DT1:MA2,IO,UP,PU
DT1:IN/E
OV<SY.STB/B:0,DT1:OV/E
[Control-C, KI]
RUN DT1:CILUS
DK1:/NS:256:17/HO<SY/BU
DT1:ER
OV/E
[Control-C, KI]
```

The first exploratory build used SY2/TT2/DK2/OV2 output basenames. These are
output aliases, not replacements for the pinned input modules. The reconstruction
from blank disks reproduced all three object payloads, SY map/STB/LDA and OV LDA
byte for byte. CF differs in DOS DEL tab-fill bytes; after removing those, its
text before the formfeed is identical. The raw hashes remain distinct. Preserve CF.MAC,
the load map, symbol table and loader files. Payload hashes include DOS final
block padding. For a separate loaded-image identity, every absolute-loader
record checksum was checked, then records applied in order to 65536 initially
zero bytes. Holes/unused tail remain zero. This is not a post-boot RAM hash.

### Boot and startup limitations

Detach the new RK1 image. The observed simulator can leave a container that it
subsequently rejects with an inconsistent sector-count metadata message. Preserve
that container. A separate raw copy of its first 2494464 bytes (203 cylinders,
2 surfaces,12 sectors,512 bytes) boots as an RK05 image; no guest instruction
is patched. Attach that copy on RK0 and BOOT RK0. The identification must be:

```text
RSTS V4A-12 V4A12MA2
```

On this new disk, select REFRESH, confirm YES, and enter the test date/time above,
`Y` for the CRASH/OVER/ERRM files, pack `V4AMA2,1`, manager `MNGR,1`, library
`LIBR,4`, and bad-block response `IGNORE`. These passwords belong only to the
new local experiment. REFRESH stalled with clock interrupts disabled. Interrupt,
`DEPOSIT CLK CSR 100`, then CONTINUE; it completed. This is an explicit hardware
register adjustment, not an unexplained claim of stock startup success.

Select START, enter the same date/time, and answer N to crash dump. The absent
INIT system program produces `CATASTROPHIC ERROR`, `PROGRAM LOST-SORRY`, then
`CAN'T FIND FILE OR ACCOUNT` and `Ready`. The probe ran in that initial context;
no CUSP installation or site initialization is implied. A later SAVE attempt in
the exploratory installation halted at PC000056. Filesystem/save reliability and
a startup needing no manual clock adjustment remain follow-up work. Do not
use this installation as an I/O oracle or infer its initialized RNG/defaults.

## Authored probe and captured observations

Enter `NEW NUMOB2` and wait for Ready. Send the
[probe source](rsts-v4a-ma2-probe.bas) in small chunks, waiting for echo; a large
paste can overrun the terminal buffer and ring the bell. LIST was compared
exactly with the checked-in source before accepting results. RUN twice; the
[42-case result body](rsts-v4a-ma2-output.txt) was identical on rerun and on the
separate reconstruction from blank disks. Both installations had at least two
identical final runs and an exact LIST/source comparison. Dynamic
RUN headers and Ready prompts are excluded, CRLF becomes LF, trailing ASCII spaces are removed per line, and internal result spacing
and diagnostics are retained. Hashes, expression/line identities, conversion
bytes and diagnostic messages are in the
[observation record](rsts-v4a-ma2-observations.json).

The October 1972 [BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
§11.5/table11-2, printed11-9 (PDF162), describes CVTF$/CVT$F as representation
mappings. The probe prints the four byte values returned by
`ASCII(MID(CVTF$(A),i%,1%))`. They are **conversion-string bytes**, not an emulator
memory dump or the [word decoder](basic-plus-floating-words.md)'s input order.
Calibrations observed +1 as `[0,0,64,128]`, -5 as `[0,0,193,160]`, and a separate
CVT%$(1%) check as `[0,1]`. Do not assume host endianness or apply this byte
ordering to MA4 without evidence.

The observations already distinguish several paths:

- Adding an exact half-ULP to +1, through power, division and explicitly
  constructed CVT$F operands, produces the same next value. Corresponding
  negative same-sign cases increase magnitude. Odd halfway and multiplication
  cases are retained separately.
- `1.-1./33554432.` and its negative counterpart instead select the neighbor
  toward zero. The operand is separately captured. A single “round all exact
  results to nearest, ties away” policy would disagree with these cases.
- Long decimal literals, short `1.0000001`/`1.0000002`, VAL of the long decimal,
  and arithmetic constructing neighboring values differ. These observations do
  not identify the conversion algorithm or establish that conversion happens
  only once. Literal IDs describe their mathematical spelling, not an expected
  runtime value.
- Canonical minimum/maximum patterns survive multiplication by one; the tested
  division below minimum and multiplication above maximum diagnose and return
  zero. These are particular probes, not every range decision threshold.
- Negative SQR, nonpositive LOG, integer conversion, overflow and underflow
  retain diagnostic text/line and post-error bytes. No installed error handler
  was used. Canonical cancellation and negative-zero spelling return zero bytes;
  other exponent-zero patterns are untested.

Next, trace literal/VAL conversion and each arithmetic operation against these
oracles, including sign/alignment, normalization, carry and range neighbors.
Resolve the startup/I/O limitations before broader installation claims. No
universal rounding model, MA4/EAE policy, public profile, historical game pass,
or release approval follows. #115/#116/#123/#128/#129 remain open and #109 is
NOT READY.
