# Portable documents in the terminal editor

Design before implementation for #116/#129. Extend LOAD/SAVE using the existing
version-one source-document codec and staged file capability. No new public
profile, file permission or command syntax is introduced.

LOAD selects the portable envelope by a case-insensitive `.basic.json` suffix,
matching file execution. Other paths remain plain native source. Decode metadata
and validate the entire embedded program before discard confirmation or editor
mutation. Commit source, dialect, filename and clean baseline together. Invalid
metadata, unsupported profiles, unreachable syntax, read failure, refusal and
cancellation preserve the prior editor atom. Never retry JSON as plain source.

Retain the portable document's exact decoded source (including CRLF, blank lines,
label order and final newline) until a numbered edit changes a stored line. LIST,
RUN and an unchanged SAVE do not normalize it. A changed numbered line returns
to the editor's existing numeric-label/LF representation; a no-op edit or deletion
of a missing label preserves verbatim source. Plain LOAD keeps its existing
sorted-line representation. The frozen source+dialect snapshot owns RUN context;
NEW resets to an empty native document. Dirty state compares both source and
dialect with the saved baseline.

SAVE chooses plain source or the envelope from the destination suffix, including
the remembered filename for bare SAVE. Preserve incomplete edits and native
source spelling. Keep overwrite confirmation, temporary staging, cancellation,
discard and synchronous install/baseline commit unchanged. A codec/preparation/
installation failure cannot mark work saved or change its filename. A successful
SAVE AS changes the next bare SAVE format only at the existing commit boundary.

Verify exact round trips, native plain/portable SAVE AS, remembered formats,
incomplete edits, no-op/real edits, rejected metadata/programs before prompts,
all interruption boundaries and NEW/RUN context. Exercise actual installed CLI
sessions and reload/execute saved bytes. Existing browser/CLI/source checks and
coverage gates stay required; no historical profile or game pass follows.
