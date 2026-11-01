# Native INPUT LINE

Design before code for #121. Add `INPUT LINE S$` and `INPUT LINE A$(index)` using
the existing asynchronous input owner and explicitly declared string arrays.
No prompt expression, target list, file channel, LINPUT or LINE INPUT alias is
accepted. LINE is already reserved, so no native identifier reservation changes.
Existing INPUT nodes and LINE$ names retain their grammar and ASTs. Add an
InputLineStatement with one immutable AssignmentTarget to the provisional AST.

The October1972 BASIC-PLUS manual §5.3, printed5-9/5-10 (PDF75/76), and §10.3,
printed10-4 (PDF143), define whole-line string input without a prompt, preserving
spaces and punctuation. These pages were rendered from SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
That implementation also appends terminal-specific CR/LF/ESC sequences. Native
Host.readLine returns line content without a terminator; this feature preserves
the exact returned string and never synthesizes one. Historical terminators,
file-channel input and continued-error behavior remain separate #121/#128 work.

Request one response with the empty prompt and store it without CSV parsing,
quote removal, trimming, numeric conversion or retries. Empty text, Unicode,
commas and quotes are ordinary data. Enforce a 65536 UTF-16-unit response cap
before assignment. EOF, invalid host types and host failure retain the existing
INPUT_ENDED/INPUT_FAILED errors; excessive text reports INPUT_LIMIT. Ordinary
INPUT response/arity/prompt/limit rules remain unchanged.

Validate string target kind and declared array/rank/static indices before
effects, including unreachable supplied trees. ParseLine permits forward DIM
dependencies for editing. After the shared await/generation/abort check, evaluate
array indices once during guarded assignment. Stop/replacement must prevent
late writes and index callbacks. One statement/gate/budget unit owns the request;
there is no separate reader, queue or callback lifetime. Sync entry reports
ASYNC_INPUT_REQUIRED; async immediate scalar input works, while indexed
immediate entry retains the existing complete-program requirement.

Test exact raw contents, prompt/response count, caps, EOF/host failures,
malformed syntax/supplied nodes, dead preflight, source spans, ordinary INPUT
compatibility, indices/effects, stepping/calls, cancellation/reruns, installed
ESM/CommonJS/public types/CLI/editor and actual browser/extracted archives.
