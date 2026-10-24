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

Use **Step** to start a fresh program one statement at a time. **Pause** stops at
the next statement boundary; **Continue** resumes the same run. A stepped INPUT
still needs a valid answer before it completes. The **Inspect execution** panel
highlights the next BASIC line in the fixed running source and shows read-only
variable values. It displays up to 200 variables with a visible limit notice;
the runtime's snapshot API retains the complete set. See the
[debugger guide](browser-debugger.md) for control and inspection semantics.

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

## Browser milestone verification

The same three maintained examples have independent expected results in the
browser, CLI, and public library checks. The guessing game uses injected
`RND() = 0.41` in tests; an ordinary run uses browser randomness. The UI echoes
answers in its transcript, while piped CLI input is not echoed, so these hosts
present input differently without changing the language's values or output.

| Contract                                    | Evidence                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Example and rerun parity                    | `scripts/browser/playground.e2e.ts`, `src/__tests__/examples.test.ts`, and `scripts/library-acceptance.ts` assert greetings, table rows, low/high feedback, and reset guess counts against explicit expected results.              |
| Actual controls, snapshots, and diagnostics | Browser tests edit during INPUT, replace a waiting run, assert BASIC error locations, recover, and exercise keyboard/focus controls.                                                                                               |
| Preservation and terminal round trips       | `scripts/browser/documents.e2e.ts` checks local restore, protected replacement, invalid/failed/stale imports, blocked/quota storage, exact CRLF/Unicode downloads, and execution of a downloaded file through the real CLI.        |
| Responsiveness under unbounded execution    | Browser tests stop GOTO-only and infinite PRINT loops after visible truncation, check the 50,000-character ceiling, and run a recovery program. The transcript retains one bounded buffer and the UI schedules at most one render. |
| Portable static distribution                | The browser-target build bundles the shared core and actual examples. `src/browser/session.test.ts` checks the dependency graph for Node/Bun APIs. The generated files need only a static HTTP server.                             |

Run the complete local gates with the pinned Bun version:

```sh
bun install --frozen-lockfile
bun run check
bun ./node_modules/@playwright/test/cli.js install chromium --only-shell
bun run test:browser
```

Linux/macOS CI starts from a checkout and frozen install, then runs both gates.
Browser tests use observable UI readiness and deadlines, not fixed sleeps, with
no retries masking failures. Traces and screenshots are retained on failure.
See [quality checks](quality-checks.md) for browser installation and coverage
boundaries. This milestone does not configure public hosting or add graphics.
