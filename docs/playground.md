# Browser playground

The playground is a static page: BASIC runs in the browser, with no account or
application server. The editor starts with the real greeting example; the example
picker also includes the repository's times-table and guessing-game programs.

From a checkout, run `bun install --frozen-lockfile`, `bun run build:playground`,
then `bun run serve:playground` and open `http://127.0.0.1:3000`. The generated
`dist/playground` contains only static files and can be served by another static
server. No public hosting is configured by these commands.

Edit the source and choose **Run program**, or press Ctrl+Enter (Command+Enter on
macOS). Each run clears the console and executes a fresh snapshot. You can keep
editing while it runs; those changes take effect on the next run. Switching
examples asks before replacing a nonempty differing program. Edits autosave
locally and restore after reload. **Import .bas** validates a complete program
before replacement; **Export .bas** downloads the current source, including
unfinished edits. Storage failures are visible and do not remove the editor's
contents. See [source preservation](browser-files.md) for limits and recovery.

When a program reaches `INPUT`, its prompt and a labeled input field appear below
the console. Submit with Enter or **Send**. Invalid numeric answers ask again.
Choose **Stop** or press Escape to stop a running or waiting program. Source stays
editable after completion, cancellation, and errors. Diagnostics show physical
source line and column, and the BASIC line number when available.

The console retains the latest 50,000 characters and marks removed output.
Program output is plain text, including markup characters. Rendering uses one
text node and at most one pending animation frame, so rapid output cannot create
an unbounded queue of DOM updates. Scrolling up holds your reading position;
output follows the bottom when you are already there. `CLS` and a new run reset
both output and the truncation indication.

`src/browser/transcript.ts` owns the pure bounded output buffer and has unit
coverage. `playground/main.ts` owns browser event wiring and rendering; real
browser checks exercise that DOM entrypoint. The browser host owns execution,
state transitions, and stale-safe input request closures independently of the DOM.
