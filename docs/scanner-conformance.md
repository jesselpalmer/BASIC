# Internal historical scanner conformance

**Status:** settled #117/#116 implementation slice, recorded before code.
Public `Dialect` remains `native`; no historical Program or runtime is accepted.
This implements the internal scanner stage of [profile activation](profile-activation.md),
not a complete BASIC-PLUS parser or compatibility profile. #109 is NOT READY.

## Evidence and accepted boundary

The [BASIC-PLUS October 1972 manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
§2.2 gives labels 1..32767; §2.4 demonstrates compact label/verb/name spelling;
§2.5.2 gives one-letter names with an optional digit; §2.5.1 gives decimal E
notation. Sections 3.1/3.2/3.6 and 5.1 provide REM, assignment, FOR/NEXT and
string forms. Sections 3.5 and 8.2/8.3 provide IF/THEN and computed transfers.
Appendix A.4 identifies additional statement words whose lexical presence must
be rejected before their payloads or before a short-name fallback. These facts
support a closed internal lexical subset, not arbitrary keyword prefix
recognition, unknown abbreviations or all historical source spellings.

Use one Scanner with an immutable internal policy selection. The default policy
retains native token values, raw spelling, maximal names/numbers, label limits,
errors and UTF-16 coordinates. Internal `tokenize` can select the revision-specific
conformance policy; `SourceOptions`, public parser options, Program metadata and
Basic/Evaluator configuration cannot select it. Do not export a new package API.

The historical conformance subset recognizes contiguous uppercase documented
verbs/delimiters used by the elementary statements: LET, PRINT, INPUT, IF, THEN,
ELSE, GOTO, GOSUB, RETURN, ON, FOR, TO, STEP, NEXT, DIM, READ, RESTORE, END and
REM; ABS, INT and RND are recognized expression words. A matched documented word
has a distinct token span even when adjacent to its operand. This vocabulary is
closed and not an exhaustive historical keyword table. No match falls back to a
native long identifier. Short names may have one digit and a `$` suffix.

The scanner retains only lexical clause context: statement starts at labels,
colons and THEN/ELSE; FOR-header TO/STEP; IF THEN and IF/ON transfers; and open
IF clauses for ELSE. A bare short name at statement start must look like an
assignment target. Unsupported known statement words from appendix A.4, such as
STOP, are recognized before fallback: STOP must not become S/TO/P. LINPUT-like
unknown prefixes and misplaced delimiters are rejected. Clause context resets
at physical lines and colons. This is not a second grammar parser: it does not
validate expression shape, list arity, complete headers or every syntax rule.
For example, XTOY can be X/TO/Y in a FOR header; only the eventual profile parser
can validate the complete header. No token stream is an accepted Program here.

Numeric scanning stops at a recognized following word, so `0TO12`, `1STEP-1`
and `6THEN105` retain correct boundaries. E followed by an exponent belongs to
the number; bare E/E3 at name position remains a short variable. Invalid E
forms fail, rather than accepting a numeric prefix. Decoding a finite numeric
token as a JavaScript number is not historical precision or runtime certification.
The eventual profile must apply its separately reviewed representation policy.

Double-delimited strings protect their literal payload; adjacent quoted strings
are separate tokens in this internal policy rather than native doubled-quote
escaping. REM protects the complete physical remainder. DATA and IMAGE payloads
are rejected before scanning them as expressions. Single-quote/! forms,
backslashes, percent types/constants and lowercase historical spellings report
an explicit unsupported lexical form. Unknown long words and unsupported
adjacent names are rejected rather than split into arbitrary short variables.

Whitespace inside a lexical word, other quote/escape forms, historical terminal
continuation encoding, further vocabulary/abbreviations, integer syntax and
DATA/image modes still require evidence and implementation. LF/CRLF retain
physical line boundaries; no joining or source rewriting is introduced. This
subset must not be offered as a runnable historical selection merely because a
conformance fixture tokenizes.

## Verification

Assert exact tokens and physical spans for compact manual/corpus forms, including
AWARI's `FORP=PTO1STEP-1` and LIFE2's nested `IFJ<>0THENIFJ<>6THEN105` at pinned
corpus commit `45f75052be3f436f2e575f58d4aa611484268227`. These are lexical excerpts,
not unchanged-source or game passes. Preserve tab/CRLF/fragment offsets, strings,
REM text, inclusive label limits, native long names and native numeric failures.
Check malformed labels/exponents, ambiguous/unsupported payloads, unknown policy
selection and independent calls. Exercise a long bounded-name/number token stream
without recursion or repeated suffix-wide scans. Compare native tokens/ASTs and
all existing examples. Keep candidate historical public options/metadata rejected
and prove that an extra internal-policy-shaped public option cannot enable it.

Word matching examines a fixed finite vocabulary of bounded-length spellings;
short-name and number scans advance monotonically. Preserve linear source work,
without rebuilding or scanning every remaining suffix. Existing full checks,
installed consumers and checkout/exact-archive browser validation remain required
before publication. All historical runtime and full-corpus gates remain open.
