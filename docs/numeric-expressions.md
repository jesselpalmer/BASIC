# Scientific literals and powers

**Status:** implemented native expression slice for #123. This contract was
recorded in #123 before code; historical profile certification and the rest
of #123 remain open.

## Primary evidence

BASIC-PLUS October 1972, sections 2.5.1 and 2.5.3 (printed pages 2-6 through 2-8),
documents E notation, exponentiation before unary minus, left-to-right operations
at equal precedence, and signed exponents. The scanned manual already recorded
in [source review](classic-source-review.md) was checked alongside its OCR.
The pinned `rocket.bas` line 15 uses `1E-3`; `rockt2.bas` line 70 uses
`8.84361E-04`. These are feature evidence, not certification of either whole game.

Native adopts the arithmetic grammar without claiming DEC floating-point
emulation. Historical word sizes, precision, initialization and random sequences
remain separate profile work. BASIC-PLUS also documents `**`; that alias remains
unsupported in this slice, since the corpus requirement for it is not established.

## Literal grammar

An unsigned decimal mantissa (`digits[.digits]` or `.digits`, including `1.`)
may have one E/e suffix with an optional sign and at least one decimal digit.
Examples: `1E-3`, `.5e+2`, `1.e2`. Leading signs remain unary operators. Source
spelling and physical UTF-16 spans are retained exactly. Consume malformed
numeric-looking words as errors rather than accepting a valid prefix. Labels,
jump destinations and DIM bounds keep their existing decimal-integer grammar.

Numeric INPUT accepts the same complete literals, plus an optional leading sign
and surrounding ASCII spaces/tabs. Neither input nor source accepts hexadecimal,
binary, separators, NaN, Infinity, incomplete exponents or embedded whitespace.
Finite IEEE-754 conversion remains native: overflow rejects, subnormal values are
allowed and underflow may round to zero. Native output spelling is unchanged.

## Power grammar and evaluation

`^` is left-associative and binds more tightly than ordinary unary `+`/`-`,
then multiplication/division, then addition/subtraction. Thus `2^3^2` is 64,
`-2^2` is -4, `(-2)^2` is 4 and `2^-2^2` is 0.0625. Signs immediately after
`^` apply to that operand, not the remainder of the power chain. Parentheses
can explicitly select a different grouping. Existing expressions without `^`
keep their ASTs and behavior. Flat power chains parse and evaluate iteratively;
sign/group/call nesting retains the existing 256-level limit.

Operands must be finite numbers, with left-to-right evaluation exactly once.
Negative bases require an integer exponent (NUMERIC_DOMAIN otherwise). Zero to a
negative exponent is DIVISION_BY_ZERO; zero to zero is 1 in native. Overflow is
NON_FINITE_NUMBER. IEEE underflow/signed zero remain permitted. Compute one
bounded double-precision power operation, never a multiplication loop proportional
to an exponent. Errors identify the physical operator; a failing PRINT writes no
partial statement, and fresh runs/replacement recovery retain existing contracts.

## Verification and remaining boundaries

Verify literal spelling/spans and malformed words, precedence/associativity and
signed exponent chains, finite/domain/zero boundaries, constructed ASTs, long
chains, depth limits, host evaluation order, INPUT retries, step/run/async paths,
atomic failed output and rerun isolation. Use independently calculated oracles
and extracted corpus expressions with exact source provenance; do not label a
formula test as a complete classic-game pass. Exercise installed ESM/CommonJS,
public types, CLI and browser including the extracted static artifact.

SQR, EXP and other historical intrinsic names are currently legal native scalar
and array names. Adding them to the reserved set or silently treating their array
references as calls would change existing programs. Their introduction needs an
explicit profile/name-resolution decision before implementation. This slice does
not reserve them, loosen undefined-name errors, alter RND(), activate a historical
profile or close the full-corpus/release gates.
