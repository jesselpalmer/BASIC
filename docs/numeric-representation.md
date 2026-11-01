# Historical numeric representation and continued errors

**Status:** scan-verified contract work for #123/#116/#128. No historical
numeric policy, intrinsic or public profile is activated. Native finite binary64,
errors, output and host ownership remain unchanged. #109 stays NOT READY.

## Primary scan and configuration

The [BASIC-PLUS October 1972 manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
was checked against the [archival scan](https://archive.org/details/bitsavers_decpdp11rsSICPLUSLangManOct72_10455777).
The reviewed 237-page PDF has SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Page numbers below are one-based PDF positions and printed page labels; the scan
has pages out of chapter order, so offsets must not be inferred globally.

Appendix F.1, printed F-1/F-2 (PDF 225/226), establishes two system configurations:

| Configuration            | Precision stated in the manual                    | Configuration owner                           |
| ------------------------ | ------------------------------------------------- | --------------------------------------------- |
| Two-word floating point  | 24 significant bits, about seven decimal digits   | System manager when building the RSTS monitor |
| Four-word floating point | 56 significant bits, about fifteen decimal digits | System manager when building the RSTS monitor |

Both use an eight-bit excess-128 exponent, a sign-magnitude fraction and hidden
normalization bit. The printed approximate magnitude bounds are `0.14 * 10^-38`
and `1.7 * 10^38`. F-2 gives octal word patterns for positive one and negative
five and warns that programs depending on four-word accuracy cannot run with
the two-word package. Treat those approximate decimal bounds as evidence, not
an exact underflow threshold or a complete rounding specification.

A manual revision alone therefore does not determine floating-point precision.
A future historical execution context must identify its supported math-package
configuration immutably, with parser, prepared program and evaluator agreeing.
Do not choose it from a filename, host CPU, observed values or parse failure.
The candidate identity in [profile activation](profile-activation.md) remains a
design identity until the supported configuration and behavior are settled.

The internal [exact floating-word decoder](basic-plus-floating-words.md) preserves
documented two/four-word patterns as BigInt binary descriptors. It does not
implement historical literal conversion, arithmetic or a public numeric profile;
ambiguous exponent-zero encodings remain explicit unsupported outcomes.

Binary64 is neither historical package. Its 53 significant bits cannot preserve
all four-word values, and its range is much larger. Two-word values can be stored
in a JavaScript number, but storage alone does not implement historical rounding
at literal conversion, each arithmetic operation or intrinsic boundaries.
Math.fround is not a substitute for this format: IEEE binary32 has different
exceptional values, exponent boundaries and potentially different rounding rules.

## Implementation evidence and version boundaries

The next reference implementation lead is the archived
[RSTS-11 V4A-12 DECtape kit](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/),
not a later BASIC-PLUS-2 or RSTS/E installation. Its
[label inventory](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/labels.txt)
identifies original distribution tapes `DEC-11-ORTBA-A-UC1`,
`DEC-11-ORTBA-A-UC2` and `DEC-11-ORTCA-A-UC`. The tape-one inventories list
`MA2`, `MA2E`, `MA2X`, `MA2EX`, `MA4`, `MA4E`, `MA4X` and `MA4EX` as `.OBJ`
modules, together with `IN.OBJ`, `OV.OBJ` and other system components. These are
specific package/binary leads, not reviewed math source or execution results.
The [reference-media verifier](rsts-reference-media.md) now pins the actual
decompressed tape, directory metadata and all30 linked payload hashes. It
reproduces the eight math-module identities plus IN/OV without executing or
redistributing those objects. Payload hashes retain final-block padding; they
are not loaded-code hashes or arithmetic observations.
The label inventory dates those objects 22-SEP-72; the separate
[decoded tape-one directory](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/dectape/rsts/v4a-12/rsts01.dta.txt)
prints Sep 23, 1972. Preserve that discrepancy rather than selecting a date as
proof of a particular source revision.

The associated
[System Manager's Guide, DEC-11-ORSMA-B-D](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORSMA-B-D_RSTSmgr_73.pdf)
needs page-level dating. Its cover says January 1973, for V04A, but the inspected
219-page scan (SHA-256
`1c958987237e01b86190d114501c116a2145fc860c3749e20944e00d71e583bc`)
contains replacement leaves. Section 2.7.12, printed 2-30/2-31 (PDF 46/47), is
dated **February 1975**. It describes the MA2/MA4 packages with or without
functions and with or without KE11-A EAE acceleration, and distinguishes that
EAE from the PDP-11/40's KE11-E EIS option. This supplies package-selection
vocabulary, but those later leaves do not establish October 1972 arithmetic or
that the variants produce identical results. A CPU/FPP rounding rule alone does
not identify the software package used by this kit.

Archive names also require inspection: `BASIC_PL.ZIP` in the
[separate RSTS archive directory](https://bitsavers.trailing-edge.com/bits/DEC/pdp11/rsts/)
contains `basic_plus_2_v2_1.tpc`; it is not the target BASIC-PLUS implementation.
The listed `RSTS_8.0_src.zip` contains V8.0 source/tape material, likewise a later
version. Neither establishes an unchanged V4A implementation.

The initial provenance review did not execute a kit. The follow-up
[selected V4A-12 MA2 build](rsts-v4a-build.md) now pins the monitor/link inputs
and records 42 repeated BASIC conversion-byte/event observations. It needed a
manual clock adjustment, lacks the INIT CUSP, and has an unresolved save failure.
These are scoped execution observations, not a fully initialized I/O oracle.
Literal conversion and opposite-sign halfway arithmetic already disprove a
single generic round-to-nearest/ties-away policy. Trace literal conversion
separately from arithmetic and intrinsics before implementing a public policy.
Record exact stored words and diagnostics for positive and
negative halfway cases, cancellation to zero, range-boundary neighbors and
noncanonical exponent-zero words. Distinguish decoded representable endpoints
from runtime underflow/overflow decision thresholds. The current evidence does
not resolve rounding/ties, signed zero, exceptional encodings or the exact
continuation/trap behavior of this installation; #116/#123 remain open.

## Continued numeric errors

Section 8.4, printed 8-5 (PDF 97), distinguishes termination from errors that
permit continuation. Without an installed error trap, the terminal receives a
message and a continuable computation proceeds. With ON ERROR GOTO installed,
control transfers to its handler with ERR identifying the condition. These are
observable language effects, not merely internal exceptions to swallow.

The error table on printed 8-8 (PDF 100) establishes these untrapped results:

| Error | Condition                                | Documented continuation value                      |
| ----- | ---------------------------------------- | -------------------------------------------------- |
| 48    | Floating-point overflow or underflow     | Zero when no error-handler transfer occurs         |
| 49    | EXP argument outside the supported range | Zero; the printed range uses `-89 <= arg <= +88`   |
| 51    | Conversion to an out-of-range integer    | Integer zero when no error-handler transfer occurs |
| 53    | LOG argument is zero or negative         | The argument supplied to LOG                       |
| 54    | SQR argument is negative                 | Square root of the argument's magnitude            |

The scan resolves the EXP numerals and inclusive printed inequalities that OCR
obscured. It does not establish bit-exact implementation thresholds, endpoint
rounding or approximation accuracy for both math packages. Those still require
reference execution or implementation evidence. In particular, do not import
PDP-10 math-library thresholds into this PDP-11 profile.

A returned zero is not permission to suppress the diagnostic, skip a handler or
continue with a stale expression stack. Native errors remain fatal with their
existing codes, spans and evaluation order. Native ON ERROR GOTO continues to
mean ordinary computed dispatch using the variable ERROR; it is not a trap.
Historical trap syntax and ERR/RESUME state belong to their explicit profile and
#128, coordinated with call/loop ownership in #57/#126.

## Implementation boundary

Keep numeric representation/conversion separate from intrinsic name resolution.
The [intrinsic contract](intrinsic-resolution.md) owns accepted names, signatures
and result typing; it cannot infer the math package or numeric error policy.
The [integer contract](integer-semantics.md) distinguishes modular integer
arithmetic from range-checked conversion and mixed-mode expression rules.

Before activating affected forms:

1. Define literal parsing, intermediate precision, rounding/ties, underflow and
   overflow, signed zero and comparisons for the selected package. Retain raw
   literal spelling until profile conversion has occurred; converting through a
   JavaScript number first can already lose information needed by four-word mode.
2. Preserve the representation through variables, arrays, arguments, arithmetic
   and comparison. Do not round only at assignment or PRINT. If internal values
   exceed BasicValue's exact numeric range, settle public observations and host
   boundaries explicitly rather than returning silently lossy snapshots.
3. Route continuable numeric events through one execution-owned diagnostic/trap
   policy. Define transcript ordering, code/location, handler entry/RESUME and
   failure of any diagnostic callback before adding host API. A terminal-state
   failure field alone cannot represent a run that continues after an event.
4. Preserve native iterative evaluation, left-to-right effects, generation checks
   and statement accounting. Verify historical observable operand ordering
   separately; do not inherit it from native by assumption. An arithmetic event
   adds no synthetic BASIC instruction; handler execution must use real
   instruction positions and bounds.
5. Reject unsupported numeric semantics explicitly under the closed profile
   support matrix, including dead expressions before effects. Do not attach a
   historical identity to native arithmetic as an interim fallback.

These are implementation obligations, not a proposal to expose mutable precision
switches or a generic numeric-plugin framework. A first supported configuration
may be narrower than all RSTS installations, but its limitations must remain
visible in source certification and the corpus release gate.

## Independent acceptance oracles and unresolved evidence

Representation-level checks can distinguish the packages without assuming their
unknown tie behavior: a 24-bit significand cannot represent `2^24 + 1`, whereas
56 bits can; a 53-bit significand cannot represent `2^53 + 1`, whereas 56 bits
can. Use exact integer/rational reference values and documented word patterns,
not the same Math operation called by the implementation. These are mathematical
representation oracles, not observations of a source program or current tests.

Runtime cases must independently assert both numeric result and event trace:
negative SQR, nonpositive LOG, conversion overflow, floating overflow/underflow,
EXP around each verified threshold, an installed handler and untrapped execution.
Include nested failing arguments, first-event order, handler loops/calls, abort,
replacement, rerun and instance isolation. Document which cases remain rejected
while the profile is incomplete. Source-derived formulas remain separate from
whole-game passes; the pinned examples are in the intrinsic-resolution contract.

Still required: precise package-specific literal/operation rounding and intrinsic
accuracy, exact range endpoints, negative-zero rules, a verified reference
implementation/installation, diagnostic/trap continuation state, and game-sensitive
outcome comparisons. No compatibility waiver follows from a newer host number
type or a passing formula. #115/#116/#123/#128/#129 remain open.
