# Pinned RSTS V4A-12 reference media

Internal research tooling for #116/#123. This pins the actual distribution
objects needed to investigate numeric semantics; no historical arithmetic,
profile, emulator or game is activated.

## Evidence and representation

The archived [V4A-12 tape one](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/rsts01.dta.gz)
has compressed SHA-256
`22281930016962740e3c4adaa2adf53abab23753111aaeedcea828f2bcfec2d4`.
After gzip decompression its 295936 bytes have SHA-256
`88ffeb6025977cc8bc9fbd46c1f89345a8901886f12166cbcd6b9f5d568a3aae`.
The [pinned manifest](rsts-v4a-reference.json) records all 30 directory entries,
including the eight MA2/MA4 variants, IN and OV. Hashes were independently
calculated from linked payloads before implementing the verifier.

The [May 1972 DOS Monitor V004A System Programmer's Manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/dos-batch/DEC-11-OSPMA-A-D_PDP-11_DOS_Monitor_V004A_System_Programmers_Manual_May72.pdf),
sections 4.1.1/4.1.2, 4.2.3 and 5.3, describes linked files, MFD/UFD entries,
DECtape layout and Radix-50 names. The actual image has 578 blocks of 512 bytes,
with little-endian words. MFD blocks are octal100/101; the [1,1] account has
nine-word entries in UFD blocks octal102/103, and the bitmap is octal104.
Those fixed addresses/header values are checked as this kit's closed layout.
This is not a general DOS-11 filesystem reader.

Each linked data block begins with its next-block word. Payload hashes concatenate
the remaining 510 bytes in chain order, including final-block padding. They are
**container payload identities**, not hashes of linked executable code, trimmed
object records, or a loaded monitor. No output byte count is inferred from a
filename or a guessed object terminator. The raw date/protection words remain
raw; the inventory-date discrepancy in the [numeric contract](numeric-representation.md#implementation-evidence-and-version-boundaries)
is not resolved by converting them speculatively.

## Closed verification command

Decompress a separately obtained tape to a local file, then run:

```sh
gzip -dc rsts01.dta.gz > rsts01.dta
bun scripts/rsts-reference.ts rsts01.dta
```

The command reads at most one expected image plus one extra byte, requires the
exact decompressed SHA and layout, and compares every parsed file record with
the committed manifest before printing it. It does not download files, write or
extract object bytes, execute a simulator, alter source or call product runtime.
It closes the input descriptor on success/failure. No historical binaries are
bundled and normal tests never download the kit.

The pure inspector checks the exact image/header/entry bounds, linked-file type,
closed entries, Radix-50 values/names, duplicate names, reserved/shared/cyclic
blocks and chain count/end agreement. It returns frozen metadata and hashes,
retaining no caller-owned buffers. Synthetic offline fixtures exercise valid
chains and malformed metadata; the real tape additionally must reproduce the
independently pinned complete manifest. The pinned CLI rejects other media
before interpreting its directory.

## What this does not establish

The readily available [V4B installation/image](https://iamvirtual.ca/PDP-11/RSTS-11/Install.htm)
is a later system. Its installation log identifies V04B-17 and 1975 object
dates. It cannot establish unchanged V4A arithmetic merely because it selects
MA2. No V4A system was linked, booted or numerically probed in this inspection.

Next: reproduce a selected V4A configuration, pin the final monitor/link map and
actual selected MA object, and capture independent exact-word/event oracles for
literal conversion, intermediate arithmetic, intrinsics and error continuation.
Until then rounding/ties, signed zero, thresholds and intrinsic accuracy remain
unresolved. Decoder observations and media identity do not complete #123,
activate a profile, change corpus dispositions or make #109 READY.
