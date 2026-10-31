# Portable BASIC documents

Portable documents keep exact editable source and its language context together.
They use the `.basic.json` suffix and this closed version-one envelope:

```json
{
  "format": "basic-program",
  "version": 1,
  "dialect": "native",
  "source": "10 PRINT \"HELLO\"\n20 END\n"
}
```

The object has exactly those four fields. `format` is `basic-program`, `version`
is `1`, `source` is a string, and `dialect` must be a profile supported by the
receiving build. Unknown fields, versions, formats, profiles, missing values and
wrong types fail as document errors. A receiver never infers a profile from a
filename, source spelling, parser failure or nearby file, and it never retries
malformed portable metadata as plain BASIC.

JSON escaping changes the envelope bytes, not the source value. After decoding,
the source string retains all UTF-16 contents, line endings, whitespace, label
ordering and even incomplete edits. Decoding an envelope does not by itself
declare the embedded program valid. A host that will execute or replace work
also validates the complete BASIC candidate under the embedded dialect before
effects.

Version one accepts only `native` because that is the only executable dialect.
The format is ready to preserve future profile identity without making an
unimplemented profile selectable. Adding a dialect to the type, parser and
runtime is a separate compatibility decision; an older build must reject that
new document rather than silently running native semantics.

## Browser ownership

The browser stores the complete envelope under one local-storage key. On first
use after this change, it reads the old source-only draft only when the new key
is absent, treats that source as native and attempts one atomic migration. A
present but malformed new value remains an error and never falls back to an
older draft. Migration or autosave failure leaves editable source available for
plain or portable export.

Plain `.bas` import/export remains exact source with an explicit native context.
Portable import supplies its stored context. Before confirmation or mutation,
the controller validates metadata and the entire embedded program. Replacement
confirmation receives frozen current and candidate source+dialect snapshots.
Edits and newer operations invalidate old reads and dialogs so late completion
cannot replace newer work.

Each run takes an immutable source+dialect snapshot. An unsupported run context
fails before stopping an active run. Editing or importing changes only the next
run; it cannot reinterpret execution already in progress.

## Terminal ownership

The terminal now executes a `.basic.json` argument as a portable document and other
filenames as plain source. Selection is suffix-based, not content sniffing.
Malformed or unsupported portable metadata and invalid unreachable BASIC fail
before output or input. File execution is read-only and creates a fresh runtime
for each call. See [terminal source](terminal.md) for the CLI boundary.

The envelope is not the stored-program editor's save format yet. Extending
LOAD/SAVE requires the same atomic source+dialect/baseline/filename ownership;
it must not bolt a profile onto the existing source-only editor state.
