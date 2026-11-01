# Reproducing a selected RSTS V4A-12 reference

Research for #116/#123. The build must use the pinned September 1972
V4A objects and sources; a later DOS bootstrapping tool is not a substitute
math package. No product runtime or historical profile is activated.

## Execution contract

Before numeric conclusions, record downloaded image/source hashes, simulator
version and CPU/peripheral configuration, the exact SYSGEN answers, generated
CF.MAC, zero-error assembler results, link input ordering and SY.MAP, and the
resulting monitor identity. Keep original distribution images read-only. Use
new scratch disks for all writes and do not distribute historical binaries.

The selected experiment is software two-word MA2, without EAE, with record I/O,
UPDATE and PRINT USING, without MAT. Probe literal conversion, arithmetic and
intrinsics separately; printed decimal values alone do not prove stored words
or intermediate rounding. Keep diagnostics with results. A successful boot is
an installation milestone, not full numeric certification or a game pass.

## DECtape direction

The May 1972 DOS Monitor V004A System Programmer’s Manual, §4.2.3,
printed 4-15, documents signed linked-file block references: positive reads
forward; negative reads backward. Backward blocks reverse 16-bit word order,
not bytes within a word. Tape zero’s SYSGEN.LDA has 52 blocks, finishing
with -574,-570,...,-538. A forward-only reader must reject that chain instead
of reporting an incomplete extracted executable. The existing tape-one
inspector deliberately supports only its pinned forward layout.

## Evidence boundary

Record observed execution below only after it occurs. No rounding/ties,
zero encoding, overflow threshold or intrinsic-accuracy claim follows from
a filename, a newer installation or the exact-word format decoder. #109
stays NOT READY; all108 corpus dispositions remain required.
