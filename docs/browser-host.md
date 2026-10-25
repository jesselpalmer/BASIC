# Browser host

`src/browser/session.ts` adapts the shared `Basic` runtime to browser views. It
imports the same parser, validator, evaluator, and execution driver as the
terminal host, without Node/Bun APIs, DOM access, terminal ownership, or a second
language implementation. The adapter can also be used by a non-DOM view.

```ts
import {BrowserSession} from '../src/browser/session.ts';

let submitCurrentInput: ((text: string) => boolean) | null = null;
const session = new BrowserSession({
  write(text) {
    transcript.append(document.createTextNode(text));
  },
  clear() {
    transcript.replaceChildren();
  },
  requestInput(prompt, submit) {
    promptLabel.textContent = prompt;
    submitCurrentInput = submit;
    input.disabled = false;
  },
  stateChanged(state) {
    input.disabled = state.status !== 'waiting';
    statusLabel.textContent = state.status;
    // state.diagnostic includes physical line, column, offset, and BASIC label.
  },
});

runButton.addEventListener('click', () => {
  void session.run(editor.value).catch(reportViewFailure);
});
stopButton.addEventListener('click', () => session.stop());
inputForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitCurrentInput?.(input.value);
});
```

The sample identifiers refer to elements and an error reporter supplied by the
embedding application. Render output, prompts, and diagnostics as text rather
than HTML. The host does not evaluate JavaScript or interpret output markup.

`run(source)` snapshots its string argument, stops the previous execution, clears
the transcript through the view, and creates a fresh interpreter with fresh
variables and loop state. Editing a source field does not alter the active run.
Every run resolves to an immutable `BrowserState` with status, source, diagnostic,
statement locations, and copied variables. Status is `idle`, `running`, `waiting`,
`paused`, `stopped`, `finished`, or `error`; language failures resolve with the shared
source-located diagnostic. See the [debugger guide](browser-debugger.md) for
`run(source, {paused: true})`, `pause`, `step`, `resume`, and snapshot semantics.
`state` exposes the latest snapshot, and `stateChanged` observes transitions.
Construction does not invoke the view.

INPUT is supplied through `requestInput(prompt, submit)`. Store the bound `submit`
callback with its input control: it returns `false` after submission, cancellation,
or replacement, so delayed events cannot feed a different run. `submitInput(text)`
is a convenience targeting the current request. Neither method queues input.
Numeric validation and retry messages come from the core; string input retains
spaces. A valid submission changes status to `running` before execution resumes, unless
the debugger has paused the pending request.

`stop()` cancels pending input, WAIT, or execution, publishes `stopped`, and lets the
run promise settle without requiring input, an injected timer, or a scheduler to cooperate.
Stopping an idle or terminal session is harmless. A replacement run explicitly
owns all subsequent view effects; late work from its predecessor cannot change
output or state. There are no persistent external listeners to dispose: each
pending request owns and removes its abort listener, and the default scheduler
clears its timer on cancellation. Applications own their DOM listeners.

View callbacks are synchronous rendering boundaries. Calling `run`, `stop`, or a debugger command
inside one rejects or throws; schedule a browser event/task for a
lifecycle change. Submitting input synchronously from `requestInput` is supported.
View exceptions reject the affected run with the original exception and leave an
`error` state, rather than disguising application bugs as BASIC diagnostics.
Handle the run promise in the application. A callback failure while submitting
also throws to the submit caller. A later run can recover with a working view.

Optional constructor options are `random`, `scheduler`, `yieldEvery`, and `wait`, useful
for deterministic testing. Defaults use `Math.random` and the core's cancellable
browser timer scheduler, yielding every 256 statements. An already resolved
promise used as a scheduler does not yield to browser input events; production
hosts should retain the default or provide a real task boundary. This adapter
does not impose a statement limit: a busy BASIC loop continues until stopped.

An optional synchronous `present()` view callback flushes buffered output before
each WAIT timer starts. It has the same receiver and reentrancy rules as other
view callbacks. WAIT keeps browser status `running`, without requesting input;
its snapshots identify the waiting statement. The `wait(milliseconds, {signal})`
option controls statement timing independently of the batch scheduler. The
default is the shared cancellable timer. See [WAIT and animation](wait.md).

The adapter tests execute the repository's greeting, times-table, and guessing
examples through this shared path, alongside cancellation, retry, diagnostics,
callback failure, and stale-event lifecycle cases. The browser application owns
its own editor, bounded output rendering, event wiring, and browser build.

Optional view methods `readKey()` and `keyDown(key)` adapt independent queued
and held-key capabilities. Their receivers and application exceptions follow
the same rules as drawing callbacks. Missing methods leave the corresponding
core capability unsupported. The view owns focus, queue limits, held state and
cleanup: the playground uses its scoped GameKeyboard binding. A custom view
should release resources even if a rendering callback fails; such failures
can reject with an error state without another stateChanged callback. See
[keyboard input](keyboard.md) for logical names and lifecycle policy.
