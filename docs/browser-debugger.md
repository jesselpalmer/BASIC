# Browser debugger

The playground debugger uses the shared interpreter's statement execution and
control flow. **Step** runs exactly one BASIC statement. A FOR, NEXT, IF, or GOTO
counts as one statement, including its jump or loop transition; Step follows the
resulting next location rather than the next physical source line. REM and END
also count. **Continue** runs from the current position with the current variables
and loop frames. **Pause** suspends before the next statement without resetting
the run. **Stop** cancels it; the next run starts with fresh variables.

An INPUT step remains in progress until a valid answer arrives. Invalid numeric
answers use the normal retry prompt and do not consume another step. Once the
INPUT succeeds, its assigned value becomes visible and the debugger pauses before
the following statement. Continue while INPUT is waiting lets execution proceed
normally after the answer. Pausing a waiting INPUT preserves its request-bound
submit callback; answering while paused completes that INPUT but does not execute
the next statement. Stopping or replacing a run invalidates its old callbacks.

WAIT is also one asynchronous statement. Step waits for its timer, then pauses
before the next statement. Pause during WAIT keeps its timer running; Step can
complete that current statement, and Continue resumes after the same timer.
Neither command restarts the delay. Stop or replacement cancels it. Browser
status remains `running` during a stepped WAIT; no input field appears. See
[timing and animation](wait.md).

Locations and variable observations always belong to the immutable source
snapshot captured when the run started. Editing the source field cannot relocate
an active run's statement. Locations retain physical lines and offsets even when
BASIC labels execute in a different numeric order. A waiting INPUT has a current
location and no next location until it completes. Terminal states have no next
location. The inspector shows explicitly assigned numeric and string variables,
using normalized uppercase names; values are plain data and should be rendered
as text, including strings containing HTML characters.

## Session API

```ts
const completion = session.run(source, {paused: true});
// Preparation and the initial paused state are synchronous.
console.log(session.state.nextLocation, session.state.variables);
session.step();
// Observe stateChanged to learn when the step completes or requests INPUT.
session.resume();
await completion;
```

`run(source)` retains the ordinary uninterrupted behavior. Its returned promise
settles on completion, stop, replacement, or failure; an initial pause does not
settle it. `pause()`, `step()`, and `resume()` synchronously return the latest
`BrowserState`. Observe subsequent `stateChanged` events for asynchronous progress.
Step is accepted only in status `paused`; repeating it while a step is in flight
does not queue another statement. Resume also works during a stepped INPUT.
Idle and terminal control calls are harmless.

`BrowserState` contains `status`, `isPaused`, `source`, `diagnostic`,
`currentLocation`, `nextLocation`, and `variables`. Status adds `paused` to the
ordinary browser lifecycle. `isPaused` remains true during an individual step,
including its `waiting` INPUT phase, so a view can offer Continue then. A pending
INPUT keeps status `waiting` when paused, retaining its visible input control. It is false
in terminal states. All state objects, variable arrays, and variable entries are
frozen, independent observations. An earlier snapshot never changes after later
assignments or a replacement run. Normal execution publishes observations at
batch, INPUT, and terminal boundaries; it does not render every statement.

The view owns DOM events and rendering. Lifecycle and debugger commands cannot
run recursively inside view callbacks; input may still be submitted synchronously
from `requestInput`. A throwing view callback rejects the affected run with the
original application exception, including failures while handling a debugger
command. Handle both the run promise and synchronous control errors.

## Shared runtime boundary

`Evaluator.snapshotVariables()` and `Basic.variables` return a newly copied,
frozen `readonly VariableSnapshot[]`, whose entries have readonly `name` and
`value` fields. No mutable map or evaluator storage is exposed. `VariableSnapshot`
is exported from the package root.

`Basic.runAsync` accepts an optional `beforeStatement(signal)` gate. It runs only
for an actual statement, after checking the instruction budget. Returning void
continues synchronously; returning a promise suspends execution while the same
async run retains ownership. Public stepping still rejects while that run owns
advancement. The browser adapter uses this gate to pause and release individual
statements, keeping the original driver, INPUT handling, and control flow.

Cancellation releases a suspended gate even if its promise ignores the signal.
The gate provider owns cleanup of its external resources. Late completion or
rejection cannot affect a replacement run. A thrown or rejected gate failure
becomes `STATEMENT_GATE_FAILED` at the blocked statement, retaining its cause.
Invalid gate types reject before replacing runtime state. Existing scheduler and
`yieldEvery` behavior is unchanged: the gate does not replace the host task
scheduler, and a busy loop still yields to browser events every configured batch.
