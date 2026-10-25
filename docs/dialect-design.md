# Dialect and source-context design

**Status:** shared design decisions and the first verified grammar slice, for
#116. Implementation is incremental; no historical profile is enabled today.
The optional-LET/contextual-GO-TO native slice and native API context below are
implemented. Historical policies and terminal/browser profile persistence remain
pending.
Unresolved dialect rules remain feature/release blockers, not native fallbacks.
The [source review](classic-source-review.md) records the evidence already checked.

## Preserve meaning before broadening syntax

Native programs keep their values, output, source positions and execution
lifecycle. A documented form that is unambiguous and does not change an existing
valid native program can also become native syntax. The first such additions
are **optional LET** for scalar assignment and **GO TO** for a literal jump.
Both have primary manual/printed-source evidence. They are deliberate grammar
extensions before the 1.0 freeze, not a claim of historical compatibility.

Recognize these at statement position. An identifier followed by `=` is an
assignment; GO followed by TO is a jump. GO remains an ordinary variable in
`LET GO=1`, `GO=2` and `PRINT GO`. Unknown command names and misspellings remain
errors. No new reserved GO name, fuzzy abbreviations, source rewriting or general
space stripping is needed. Token/source spans retain the actual spelling.

Compact historical lexing is a different decision. Native names such as SCORE,
FORWARD and INTEGER must not be split into keyword prefixes. `10PRINT`, FORI=1TO2,
PRI/INP/GOT abbreviations, apostrophe comments and backslash separators wait for
their own verified profile grammar. They are not enabled by the common slice.

## Explicit profiles for incompatible rules

Use named, versioned profiles tied to primary manuals. Candidate identities are
native, BASIC-PLUS October 1972, DECsystem-10 March 1974, and separately verified
Dartmouth/EduSystem/HP versions. These are design identities, not accepted API
strings today. Do not expose a historical choice until its implemented forms
have correct behavior; reject unimplemented forms explicitly rather than execute
native semantics under a historical label.

No profile is inferred from filenames, a title, the presence of one keyword or
failed parsing. An unknown profile is an option error; an unsupported form in a
known profile is a source-located feature diagnostic. A valid but unsupported
program continues to block release. Profiles never grant filesystem access.

| Rule            | Native invariant                                       | Verified historical difference / design consequence                                                                                                                                               |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Undefined names | Error                                                  | BASIC-PLUS numeric/string variables initialize to 0/empty string (sections 3.6.2/5.1.2). Profile owns that policy.                                                                                |
| Names           | Long ASCII names remain distinct                       | BASIC-PLUS 1972's elementary names are a letter with optional digit, plus type suffix. Do not use its tokenizer to reinterpret native names.                                                      |
| Labels          | 1..65535 and label whitespace                          | BASIC-PLUS 1972 documents 1..32767; DECsystem-10 documents five-digit limits. Every profile validates its own source and jump ranges.                                                             |
| PRINT           | Existing semicolon concatenation and decimal spelling  | Historical numeric padding, zones, cursor, precision and USING fields differ. Native text cannot silently acquire padding.                                                                        |
| RIGHT           | Currently unsupported                                  | BASIC-PLUS RIGHT uses a start index; DECsystem-10 RIGHT$ uses a count. Implement separately by selected semantics.                                                                                |
| RND             | RND(), host sequence                                   | BASIC-PLUS documents bare RND/RND(X), ignored X and repeatable RUN sequences without RANDOMIZE. Preserve native behavior and explicit host ownership.                                             |
| Arrays          | Explicit DIM, safe integer indices and bounded storage | BASIC-PLUS DIM is program-wide, inclusive of 0, supports scalar+array coexistence and implicit upper bound 10. Native shares explicit forms, but does not enable historical defaults/conversions. |
| Integers        | Finite doubles only                                    | BASIC-PLUS `%` conversion truncates and integer arithmetic is signed 16-bit with mixed-mode rules (chapter 6); do not substitute JS 32-bit behavior.                                              |
| Power           | Native left-associative ^ before unary minus           | BASIC-PLUS and DECsystem-10 manuals describe left-associative repeated exponentiation; BASIC-PLUS gives exponentiation precedence over unary minus. Do not import JavaScript precedence.          |
| Loop transfer   | Native owned loop contexts and lexical entry guards    | Empty ranges, GOTO/GOSUB/FN transfers and modifiers need source-backed rules per version; do not invent loop frames.                                                                              |
| INPUT           | Current whole-line target/retry contract               | Inline prompts are documented in BASIC-PLUS; the reviewed DECsystem-10 INPUT section is not sufficient evidence for that grammar. Lists/line/file input get their own rules.                      |

Numbers remain `BasicValue` numbers unless a separately reviewed contract changes
that API. Integer kind/range/mode belongs in runtime semantics, not implicit JS
coercion. Hardware floating-point behavior must be compared with actual game
oracles; bounds/precision differences affecting correct games cannot be waived by
saying that IEEE doubles are newer. Every unsupported case stays visible.

Open evidence blocks the corresponding implementation, including historical
fractional-subscript conversion, duplicate DIM handling, exact string edge cases,
all EduSystem/HP mappings, later Dartmouth functions and game-dependent timing.
Neither this table nor a guessed README dialect settles those details.

## Carry one immutable language context

The core now carries a validated, immutable native context at these boundaries.
`Dialect` currently accepts only `'native'`; this deliberately exposes no partial
historical profile. `LanguageOptions` supplies an optional dialect, and
`SourceOptions` also retains fragment coordinates. Unknown or conflicting context
throws `TypeError`, rather than a source diagnostic, before program effects.

- `parseLine(source, options?)`, `parseProgram(source, options?)` and
  `validateProgram(lines, options?)` return frozen snapshots explicitly tagged
  `dialect: 'native'` on Programs and Lines, including empty Programs.
- `new Basic(host?, options?)` and `new Evaluator(host?, options?)` copy the
  selection into private instance state exposed through a read-only `dialect`
  getter. Mutating the options object cannot alter their selection.
- Preparing a supplied Program validates both its root and every Line's metadata,
  including unreachable lines. Legacy missing metadata means native. A rejected
  replacement preserves the previous prepared snapshot for an explicit rerun.
- Immediate source-coordinate options may repeat the instance's dialect but
  cannot change it. Program preparation and immediate execution use that same
  context; there is no mutable global selection.

When historical profiles are activated, preserve these contracts:

- `parseLine`/`parseProgram`/`validateProgram`: explicit options, default native.
  Parsed snapshots carry profile identity. Validate caller-supplied trees against
  their declared profile; reject mixed or conflicting contexts instead of
  reinterpreting a tree under the runtime's default.
- `Basic`/`Evaluator`: immutable instance configuration, default native; preserve
  the existing host-first call shape. An explicitly configured instance rejects
  a conflicting Program before effects. Reruns retain the loaded context and
  clear all mutable variables, arrays, frames and profile-owned random state.
- Prepared indexes: profile, program snapshot, dimensions, labels, instructions
  and loop/call tables travel together. No mutable global current dialect or
  external WeakMap needed to recover a Program's meaning.
- Immediate library entry: uses its instance's context. Source-coordinate options
  cannot override the profile midway through a run.

A legacy public Program without profile metadata means native. Adding metadata
must not break existing native Program construction. New AST kinds are explicit
changes to every exhaustive consumer before the 1.0 type freeze; the project is
not promising that adding a closed-union case after release is a minor change.

## Files, terminal and browser

Plain `.bas` remains exact source. It cannot carry a dialect without changing
its bytes. File execution therefore requires an explicit host selection for a
historical profile, with a planned `--dialect` option; never guess from the name.
The terminal owns a visible document profile as well as source/baseline/filename.

A portable document format may carry schema version, profile and exact source
string in one `.basic.json` envelope. It must be a single atomically saved
artifact; avoid a source/sidecar pair whose writes can disagree. A plain source
export remains available and clearly states that the receiver must select its
profile. Unknown envelope versions/profiles fail without replacing work. This
format is a design decision for the later persistence implementation, not a
currently accepted file type.

The browser selection belongs to editable document state. Draft recovery retains
source and profile together, migrating old source-only drafts as native. Example
metadata states its profile. Importing a plain .bas uses an explicit visible
selection; importing the portable envelope supplies the stored selection. A
profile change validates the complete candidate, cancels/invalidates old work as
needed and applies atomically; failure keeps the current source/profile/baseline.
Changing a view control cannot reinterpret an in-flight immutable run.

Export/import/reload acceptance must prove both exact text and profile context.
The terminal/browser controls and public API changes need their own focused PRs;
adding a parser option alone does not complete this part of #116 or #129.

## Shared parser, execution and observations

The first [explicit native array contract](arrays.md) settles #58's native slice
before implementation. It adopts verified explicit declaration/access forms,
preserves DIM as an existing scalar name, and separates deliberate native limits
and integer-index checks from unresolved historical defaults/conversions.

Keep one scanner/parser and evaluator/runtime. A small immutable profile policy
supplies documented choices to the module owning each rule; no plugin loader,
per-game checks, alternate interpreter or source-to-JS evaluation. Preserve
physical UTF-16 coordinates while interpreting compact historical tokens.

Multiple statements require a real instruction address, not a rewritten sequence
of invented BASIC labels. Keep physical line and statement position separately.
GOTO enters the target line; GOSUB returns to the following instruction, including
within a line. Inline conditional scope and modifiers must be represented before
flattening/indexing. The shared statement gate counts actual executed statements
and remains cancellable inside loops, calls and asynchronous effects.

Array declarations are validated in a preparation prepass where the profile
requires it. Mutable element storage belongs to a fresh execution, separate from
shared scalar names where documented. Check safe dimension products and total
allocation before creating arrays or calling the host. Configure documented
resource caps; do not silently truncate declarations or allocate on an error path.
Snapshots of arrays must be detached, bounded views with dimensions/count and an
explicit truncation indicator. Do not copy a huge matrix at every statement or
smuggle arrays into the existing scalar VariableSnapshot value type.

Existing Host callbacks remain sufficient for grammar/math changes. Add file,
clock/randomization or terminal capabilities only for concrete verified needs;
all are bounded and fail clearly when absent. A PRINT cursor is run-owned logical
state and must account for INPUT echo/control behavior consistently across hosts.
A CHAIN resolver is supplied by the host and may not start arbitrary processes.

## Implementation and verification order

1. Merge the evidence/ledger and this design before code. Keep #115/#116 open
   while their full corpus/profile criteria remain unresolved.
2. Implement the unambiguous native optional-LET/GO-TO slice in #117, with exact
   source spans, unchanged native names/errors, malformed-source rejection and
   installed consumer acceptance. Record partial real-program paths honestly.
3. Carry explicit native context through the core first; the API foundation is
   implemented, while terminal/browser document profiles remain pending. Activate
   a historical profile only after its accepted native-like forms have
   correct historical behavior or explicit unsupported-feature errors. Complete
   1CHECK's BASIC-PLUS-compatible forms through #58/#119/#120 with the reviewed
   transcription correction and real board/replay oracles.
4. Implement the remaining verified profile features through the existing issue
   graph. No unverified behavior enters another profile by automatic fallback.
5. Run #129's full real-program battery, including the presently blocked paths,
   all distribution surfaces, independent review and exact final artifacts.

The full 108-file target is unchanged. Partial source certification or a passing
path cannot close the corpus gate, imply full platform emulation, or make #109
READY. No publication is part of this implementation sequence.
