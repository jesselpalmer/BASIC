# Browser source preservation

The playground automatically saves the exact source and its language context in
the current browser and restores them when the page reopens. The message below
the editor reports restoration, autosave, and storage errors. This draft belongs
to the current browser and site;
clearing site data or changing browsers can remove access to it. There is no
account or cloud storage. Use **Export .bas** to download exact source or
**Export .basic.json** to preserve source and context together, including
unfinished edits. See [portable documents](portable-documents.md).

**Import file** accepts plain `.bas` or the versioned `.basic.json` envelope.
The suffix selects the format; the browser never guesses from contents. Plain
source uses the visible native selection, while a portable envelope supplies its
stored context. Unknown or malformed metadata, invalid complete BASIC and read
failures leave the editor unchanged. Imports and example changes ask before
replacing any nonempty, differing source/context, including one already
autosaved. Cancel to keep working, or export before trying again.
Running, stopping, and execution failures leave editable source intact.

The browser playground keeps editable source separate from the interpreter's
validated running snapshot. `src/browser/document.ts` owns the editable document;
it has no DOM, filesystem, cloud, or account dependency.

`BrowserDocument(initialSource, storage?, options?)` restores a local draft
immediately. The injected `DocumentStorage` capability reads a portable envelope
or `null`, optionally reads the legacy source-only value, and writes one complete
envelope. The browser adapter owns localStorage access and the
`basic.playground.document.v1` current key plus the legacy
`basic.playground.source.v1` key. A missing current value migrates a present old
draft as native. A present invalid current value reports an error and never falls
back. A stored empty source restores an intentionally empty editor. Restoration
and `edit(source)` preserve text exactly, including line
endings, whitespace, label ordering, and incomplete or invalid edits. Editing
synchronously attempts autosave. It never parses source or changes a running
program.

`storageStatus` reports `unavailable`, `empty`, `restored`, `saved`, or `error`
with a `restore`/`save` operation and message. An error keeps the editable source
available; a later successful edit can save again. The UI must present failures
clearly so users can export their work. A saved status describes only the latest
successful local write, not a backup or a guarantee against browser data removal.

`replaceWithExample`, `importSource` and `importDocument` validate language
context and parse the complete candidate with `parseProgram` before replacing
anything. Imports supply
an asynchronous text reader such as `() => file.text()`. Invalid programs and
failed reads leave the current document and saved draft unchanged. Candidates
retain their original spelling and physical ordering after validation.

Every nonempty differing document requires explicit confirmation, including one
already autosaved and one consisting only of whitespace. The confirmation
callback receives frozen current/candidate source and dialect plus the
`example`/`import` reason.
Refusing or failing confirmation preserves the document. Empty or identical
documents do not need a discard prompt. Each replacement attempt takes ownership;
an edit or newer replacement invalidates old asynchronous reads and confirmations.
A stale completion cannot overwrite the latest work, even if it fails late.
Replacement results distinguish `replaced`, `cancelled`, `stale`, `invalid`,
`read-failed`, and `confirmation-failed`.

`exportSource()` returns exact text; `exportDocument()` returns its versioned
source/context envelope. Both allow incomplete edits. The browser adapter owns
the download, filename, Blob URL, and its cleanup.
Export does not clear the draft, alter source, or make future replacement safe
without confirmation. Running a program obtains a fresh validated snapshot from
the current text; execution output and failure never replace that document.
