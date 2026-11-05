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
