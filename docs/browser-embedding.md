# Browser embedding API

Design before implementation for #190. External applications need a supported
import path for the existing portable session and source-envelope primitives.
Expose `node-basic-lang/browser` while preserving the existing package root.
Keep product UI, DOM listeners, localStorage, private prepared/runtime machinery
and the playground's document controller private.

## Small public surface

Export BrowserSession and its BrowserView, BrowserState, BrowserStatus,
BrowserSessionOptions and BrowserRunOptions types; KeyboardInput/logicalKey;
createSourceDocument/encodeSourceDocument/decodeSourceDocument, their format/
version constants and SourceDocument type. Re-export the core context/location,
diagnostic, drawing, logical-key and variable-observation types needed to
implement these callbacks. Importing this entrypoint must touch no DOM, browser
storage, terminal, filesystem or timers. Add no new execution engine or UI.

The view owns rendering, drawing to the 320x200 logical surface, prompt display,
keyboard event binding and focus. The session owns each run snapshot, pending
INPUT, cooperative execution, pause/step and cancellation. Callbacks are
synchronous observers; use the input request's bound submit callback and discard
stale prompts. Stop releases interpreter work, and a repeated Run starts fresh.
KeyboardInput is a bounded logical queue/held-key set; the application owns its
DOM registrations and clears held/queued keys on blur/Stop/replacement.

## Drafts, imports and validation

The source-envelope codec validates format/version/context and exact source text,
not complete BASIC grammar. A consumer can persist/import an unfinished draft,
keep its own document identifier/history/UI metadata, and validate on Run via
BrowserSession (or explicitly via parseProgram at the package root). Preserve
unsupported-context/envelope failures atomically before replacing a draft.
Do not execute imports or reinterpret plain text as JSON by filename guess.

The playground's private BrowserDocument deliberately validates complete source
before importing/replacing examples. Its restore/edit behavior can retain drafts.
That stricter import policy is not the envelope codec's contract and is not
weakened by this entrypoint. A consumer that wants draft imports should compose
the public codec with its own editor model rather than copy/deep-import internals.

## Acceptance and upgrades

Verify imports from a clean packed installation through ESM/CommonJS and positive/
negative public types. Bundle a consumer using only public imports for a browser;
reject Node/Bun dependencies and unsupported deep imports. Exercise PRINT,
drawing, WAIT, input submission/Stop/stale callbacks, repeated Run/Stop, draft
source/context round trips, and malformed-envelope preservation. Execute the
installed browser bundle in real Chromium as part of the artifact gate; import
time must work without window/document/localStorage globals.

Document exact verified commit/archive identity and install/pin/upgrade commands.
This entrypoint does not publish a package/release, promise standalone playable
export (#108), enable historical profiles or change the #109 readiness decision.

## Using the supported imports

```ts
import {
  BrowserSession,
  KeyboardInput,
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
  type BrowserView,
} from 'node-basic-lang/browser';
import {parseProgram} from 'node-basic-lang';

// The application supplies rendering, prompt controls and keyboard event listeners.
declare const view: BrowserView;
const session = new BrowserSession(view);
const keyboard = new KeyboardInput();
let draft = createSourceDocument('10 PRINT "Hello"');

function edit(source: string) {
  draft = createSourceDocument(source, {dialect: draft.dialect});
}
declare const confirmImport: (current: string, candidate: string) => boolean;
function importDraft(serialized: string) {
  // Decode first; an exception leaves the current draft intact.
  const candidate = decodeSourceDocument(serialized);
  if (!confirmImport(draft.source, candidate.source)) return;
  session.stop();
  keyboard.clear();
  draft = candidate;
}
function exportDraft() {
  return encodeSourceDocument(draft.source, {dialect: draft.dialect});
}
async function run() {
  const state = await session.run(draft.source, {dialect: draft.dialect});
  // Syntax/runtime errors are source-located in state.diagnostic.
  // The editable draft remains application-owned even if the run fails.
  return state;
}
function stop() {
  session.stop();
  keyboard.clear();
}
// Optional complete-program validation for an explicit Check command:
function check() {
  return parseProgram(draft.source, {dialect: draft.dialect});
}
```

`BrowserView.write`, `clear`, `draw`, `present`, `requestInput` and
`stateChanged` execute synchronously. Do not call session lifecycle methods from a view callback; schedule that UI
action after the callback. The bound input
submit callback is safe for the displayed request; it returns false once that
request is answered, stopped or replaced. Present errors through state.diagnostic;
a thrown host/view callback rejects the run promise and requires host handling.
Stop pending input/timing work before disposing UI event registrations.

The host controls typed-input echo, prompt text rendering, focus and transcript
bounds. `draw` receives an immutable GraphicsCommand in the documented
[graphics coordinate/palette contract](graphics.md); it does not access a canvas
itself. Supply `readKey: () => keyboard.readKey()` and
`keyDown: key => keyboard.keyDown(key)` if using KeyboardInput. Forward only the
focused game's key events; prevent page shortcuts/focus changes in the host as
appropriate, and clear the queue/held keys when focus or execution ownership ends.
`present` flushes buffered output/drawing synchronously before a WAIT timer starts.
Default waits and batch scheduling yield to tasks so Stop/input can run. Custom
wait/scheduler callbacks must honor AbortSignal and yield rather than spin.

Each run uses an exact source/context snapshot and fresh variables; editor
changes affect the next run. Pause/resume/step retain the current execution and
its pending async statement. A superseded run promise can settle after a new one;
render only states for the application's current session/run ownership. Unknown
dialects remain rejected before replacing execution. This API currently runs the
native language only, with its existing syntax and diagnostics.

## Verify and pin a build

The delivery PR records its exact validated commit/tree and Linux/macOS release
manifest archive hashes. Use that verified package tarball before publication:

```sh
# Compare this digest with the chosen platform's manifest recorded in the PR.
shasum -a 256 ./vendor/node-basic-lang-1.0.0.tgz
bun add ./vendor/node-basic-lang-1.0.0.tgz
bun install --frozen-lockfile
```

Commit the dependency declaration/lockfile and retain the verified artifact (or
its controlled immutable artifact location). Do not select a floating branch or
infer that version 1.0.0 has been released. For an upgrade, choose a newly verified
commit/archive, compare its manifest hash, review the public API/language changes
and rerun the consuming application's Run/Stop, pending INPUT/WAIT, drawing,
keyboard and exact-source import/export tests before replacing the pinned build.
The package's source entrypoints require a TypeScript-aware browser bundler;
there is no CDN loader, backend service or product UI installed by this API.

The installed consumer suite executes the same eight independent acceptance
cases in ESM/CommonJS and a self-contained browser bundle. Real Chromium loads
that bundle without checkout routes, backend requests or remote assets. During
release validation, the bundle is built from the exact manifest package archive;
it never repacks a replacement. Existing playground checks continue against the
exact extracted static archive. Root imports and private deep-import rejection
remain covered by installed consumer/type tests.
