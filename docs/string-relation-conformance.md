# Internal BASIC-PLUS string relations

Design for #59/#124/#116, recorded before code. These pure internal helpers do
not activate a public profile or change native string comparison behavior.

## Primary evidence

Visually rechecked the [October 1972 BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf),
SHA-256 `684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`:

- Section 5.1.5 and table 5-1, printed 5-4/5-5 (one-based PDF 70/71), define
  the six string relations by alphabetical sequence, ignore trailing blanks,
  and pad the shorter operand with blanks. The null string equals all-blank
  strings and precedes other strings.
- Table 5-2, printed 5-6 (PDF 72), gives byte codes and explicitly states that
  values N and N+128 remain unequal even where a terminal displays them alike.

The scan does not specify enough collation detail to treat every control,
punctuation, digit, lowercase or high-bit byte as an unsigned sort key. Do not
substitute JavaScript string order, Unicode normalization, locale comparison,
case folding, or high-bit stripping for that missing contract.

## Accepted subset

Reuse the [existing byte-string helper boundary](string-conformance.md): both
operands must be strings of at most 32767 code units, with every code unit in
0..255. Validate both complete operands before computing any relation.

For `=` and `<>`, all validated byte strings are accepted. Only ASCII blank
(code 32) padding is ignored; tabs, controls, null characters, lowercase and
high-bit characters stay distinct. Empty and any number of ASCII blanks compare
equal. This does not trim leading or embedded blanks.

For `<`, `<=`, `>`, and `>=`, the closed conformance subset accepts uppercase
letters A..Z and ASCII blanks only. Compare alphabetically at the first unequal
character after conceptual blank padding, with a blank preceding a letter.
Other valid bytes return an immutable `comparison-domain` unsupported outcome,
including if they occur after an earlier unequal prefix. This deliberate subset
does not claim a historical rejection for those bytes; their ordering still
requires evidence and implementation.

Return the existing internal logical word representation: -1 for a true
relation, 0 for false, wrapped in immutable value results. Invalid operator
spellings and malformed host argument types throw instead of coercing. The
operation performs no host callbacks, writes, mutation, runtime selection or
statement advancement. Public syntax/type rules, historical operand evaluation
order, source-located errors and profile activation remain separate work.

## Independent verification

Assert all six operators for before/equal/after examples, manual YES/YES-blank
equivalence and empty/all-blank cases. Exercise leading and embedded blanks,
prefixes, every uppercase-letter pair, byte equality including 0/128 and 65/193,
and unsupported ordering bytes in either operand and after an early difference.
Cover exact/over-limit lengths, malformed types/operators, immutable outcomes,
independent calls and native exact equality/ordered-string rejection. Run the
full quality/package gate; integration still requires Linux/macOS distribution
validation. Passing relations closes no game or public profile gate.
