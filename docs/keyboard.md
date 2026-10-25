# Keyboard input

`INKEY$()` returns the next queued logical key, or an empty string when no key
is queued. Reading consumes one key. `KEYDOWN(name)` returns numeric `1` while
that logical key is held, otherwise `0`; it does not consume queued input.
Both are ordinary expression functions and require parentheses.

```bas
10 PRINT "Focus the game canvas and hold an arrow key."
20 IF KEYDOWN("UP") = 1 THEN 60
30 LET K$ = INKEY$()
40 IF K$ <> "" THEN 70
50 WAIT 16
55 GOTO 20
60 PRINT "Up is held"
65 GOTO 50
70 PRINT "Pressed: "; K$
80 GOTO 50
```

## Logical names

| Keys      | Names returned by INKEY$ and accepted by KEYDOWN |
| --------- | ------------------------------------------------ |
| Letters   | `A` through `Z`                                  |
| Digits    | `0` through `9`                                  |
| Arrows    | `UP`, `DOWN`, `LEFT`, `RIGHT`                    |
| Enter     | `ENTER`                                          |
| Space bar | `SPACE`                                          |

KEYDOWN accepts these names case-insensitively, so `"up"` and `"UP"` are
identical. It requires a string, with no surrounding whitespace or aliases.
INKEY$ always returns a canonical uppercase name. Unsupported names report
`INVALID_KEY_NAME`. These are logical keys from the browser's key value, not
physical keyboard positions, historical scan codes, or arbitrary text input.
Punctuation, function keys, modifiers and composing text are outside this set.
`INKEY$` and `KEYDOWN` are reserved built-in names.

**Escape is reserved for Stop.** It is never queued or reported as a held game
key. Ctrl/Command+Enter remains Run. Ctrl, Command, and Alt combinations and
composition events do not become game input. Use BASIC INPUT for text entry.

## Focus and lifetime

In the playground, Run starts execution without moving focus to the canvas.
**Click the graphics canvas or reach it with Tab to control the program.**
Supported game keys are captured only while the canvas has focus and the run
is active and unpaused. Captured arrow and Space presses do not scroll the
page; typing elsewhere retains its normal behavior. The focus outline and
nearby instructions identify the game surface. Tab remains available to reach
other page controls, including Stop.

A newly held logical key queues once. Repeated keydown notifications, including
operating-system auto-repeat, do not enqueue copies. If two physical keys map
to the same name, such as Enter and numeric-keypad Enter, they share one logical
press; it remains held until both are released. Releases still work when Shift
changes the key spelling while it is held. The queue holds at most **64** keys; when full, a new
press drops the oldest unread entry. Reading an empty queue returns `""`
immediately and never waits for a key.

Leaving the canvas, losing window focus, hiding the tab, pausing, entering
INPUT, stopping, failing, finishing, or replacing a run clears both the queue
and held state. Returning focus or continuing requires fresh key presses;
a key held across that boundary is not restored. INPUT's field owns its typing,
and answering it does not also queue game keys. Debugger stepping does not
capture game input while `isPaused` is true, including during a stepped WAIT.

## Move the marker

Choose **Arrow-key marker** to load [move.bas](../examples/move.bas). Run it,
focus the canvas, and hold the arrow keys. BASIC code moves the marker and
clamps its radius-four outline inside the 320 × 200 surface. WAIT yields
between frames. Stop or Escape ends it; Run resets its position. Editing and
exporting work as for other examples. The drawing and keyboard capabilities
are required, so this example is intended for the browser playground.

## Library and unsupported hosts

The public Host has two independent optional callbacks:

- `readKey(): LogicalKey | ''` consumes one queued key.
- `keyDown(key: LogicalKey): boolean` observes whether the canonical key is held.

`LogicalKey` is an exported string union matching the table above.
The interpreter converts the host's boolean result to BASIC's numeric 1 or 0.
`createHost` preserves callback receivers, and Basic snapshots its callback
object. Hosts own their input state, event listeners, focus policy and reset
boundaries; starting a Basic run does not itself clear external host state.
A custom host should clear its state at the same lifecycle boundaries its
embedding application exposes.

A missing callback raises `KEYBOARD_UNAVAILABLE` at an executed call. Loading,
validating or skipping keyboard expressions does not require the capability.
The Bun terminal deliberately supplies neither callback and reports that error;
text INPUT remains supported. A throwing callback raises `KEYBOARD_FAILED`
with its original cause. Invalid callback results, including noncanonical key
names or numeric held-state values, raise `INVALID_KEY_VALUE` instead of being
silently coerced. Argument, host and capability failures retain the original
physical source location and BASIC label.

Whole-program validation rejects an inferred numeric KEYDOWN argument, including
in unreachable code. INKEY$ has a string result for comparison, WAIT and graphics
type checks. Other value-dependent failures retain the usual runtime checks.
Function arity is checked before argument evaluation. Evaluating an expression
calls each keyboard capability once in the ordinary left-to-right order.
Reading a key is an external effect; a later failure does not put it back in
the queue.
