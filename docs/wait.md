# WAIT and animation

`WAIT milliseconds` suspends the current BASIC run without blocking the host.
The argument is an ordinary numeric expression evaluated once. Its value must
be finite and between **0 and 2147483647**, inclusive (about 24.8 days). Positive
fractions round upward to whole milliseconds: `WAIT .1` requests 1 ms and
`WAIT 16.2` requests 17 ms. `WAIT 0` still yields through a timer task; it is not
a resolved-promise loop.

Negative and out-of-range durations produce a source-located
`INVALID_WAIT_DURATION`. The upper bound prevents platform timer overflow from
turning a long wait into a short one. Strings are type errors, including in
unreachable code during whole-program validation. Undefined variables and
arithmetic failures retain the evaluator's normal diagnostics. `WAIT` is reserved
as a keyword.

```bas
10 PRINT "Ready"
20 WAIT 500
30 PRINT "Go"
```

Timing is approximate. Host load, timer resolution, nested-timer clamping, and
background-tab throttling can delay resumption. Drawing and computation take
additional time, so `WAIT 16` is not a guarantee of 60 frames per second. This is
cooperative animation, with no real-time or display-refresh guarantee.

## Frames in the playground

Draw a complete frame, then wait:

```bas
10 COLOR 14
20 CLS
30 CIRCLE 160,100,6
40 WAIT 16
50 END
```

The playground buffers `CLS`, text, and drawing. At each WAIT, it cancels the
queued render and synchronously uploads the complete buffer before starting the
timer, including for WAIT 0. A clear followed by drawing in the same batch does
not upload an intermediate black frame. The browser controls when uploaded
pixels reach the physical display; WAIT does not synchronize to its refresh.
Ordinary task/frame rendering and INPUT/debugger/terminal boundaries still
present output, so WAIT is not an atomic frame transaction across arbitrary
numbers of statements.

Choose **Bouncing ball** for the editable, downloadable
[bounce.bas](../examples/bounce.bas). Its BASIC code updates position, reverses
velocity before the radius-six outline could leave the 320 × 200 surface,
clears and draws, then waits 16 ms. **Stop** or Escape ends the loop. Run again
to reset position and velocity without reloading the page.

## Async ownership and controls

Use `runAsync`, `stepAsync`, or `readLineAsync` for WAIT. Synchronous execution
reports `ASYNC_WAIT_REQUIRED` at an executed WAIT without starting a timer.
Loading or skipping a WAIT does not itself require asynchronous execution.
The runtime reports `waiting` while the statement is pending, with its current
location and no next location; public stepping or immediate execution cannot
overtake it. WAIT counts as one instruction, independently of elapsed time.

The browser keeps its status `running` during WAIT and shows no INPUT form.
Stepping WAIT runs the whole asynchronous statement and pauses before the next
statement. Pause does not suspend or restart an existing timer: when it settles,
the driver pauses before the successor. Step while that wait is paused completes
only the current WAIT; Continue lets execution proceed after it. Stop, reset,
external abort, and replacement cancel pending timing work. Old continuations
cannot render or resume a replacement run.

## Bun CLI and library hosts

The supported Bun CLI uses the same cancellable timer implementation. Text
programs can WAIT in file mode or stored-program `RUN`; Ctrl+C interrupts the
wait. Browser graphics examples still require a drawing host and report
`GRAPHICS_UNAVAILABLE` in the terminal. WAIT itself needs no graphics support.

`createHost` supplies `wait(milliseconds, {signal})` by default. A library host
may override it to control time, just as it can override input or randomness.
The runtime passes an already validated, rounded duration and an abort signal.
An override must return a promise, yield to a host task when used in production,
and release its timers/listeners on abort. Resolve it to complete the statement.
`createHost` preserves the callback receiver and `Basic.host` freezes its copy.

Cancellation settles the interpreter even if a custom timing provider ignores
the signal; that provider still owns cleanup of its external resources. Late
resolution or rejection cannot affect the new run. A provider failure becomes
a source-located `WAIT_FAILED` retaining its original cause. A scheduler override
controls automatic batch yields; it does not replace WAIT timing.

Portable browser views may implement synchronous `present()` to flush their
buffers before timing begins. View callback failures retain their original
application exception. `BrowserSession` accepts a `wait` constructor option for
controlled timing tests; its default uses the shared core timer.
