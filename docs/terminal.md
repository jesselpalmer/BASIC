# Terminal editing

Start `basic` without a filename to edit a stored BASIC program. The terminal
prints the version and a `>>> ` prompt. Numbered entries edit source; they do not
execute until `RUN`. The library's `Basic.readLine` and `readLineAsync` methods
remain immediate-entry APIs for compatibility.

| Entry              | Behavior                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `10 PRINT "Hello"` | Insert or replace line 10 after validating that single statement.                                |
| `10`               | Delete line 10. Deleting a missing line is harmless.                                             |
| `LIST`             | Print complete stored source in numeric label order.                                             |
| `RUN`              | Validate the complete source snapshot, then execute with fresh variables and control-flow state. |
| `NEW`              | Clear stored source and execution state, confirming first if source is unsaved.                  |
| `EXIT`             | Leave the terminal, confirming first if source is unsaved.                                       |
| Blank input        | Leave the program unchanged and show another prompt.                                             |

Commands are case-insensitive and allow surrounding whitespace. Commands do not
take arguments. Unnumbered statements such as `PRINT 2+2` are not supported yet.
Labels retain the language's range of 1 through 65535. The source text of valid
entries is retained, including string case, spacing, and comments.

A rejected edit leaves the previous line and unsaved state unchanged. Forward
jump targets and unmatched `FOR`/`NEXT` lines can be entered incrementally. `RUN`
performs whole-program validation before effects; errors leave source available
for `LIST`, correction, or another `RUN`. Execution never changes the stored
source or marks it saved. Repeated `RUN` starts with fresh variables.

## Input and interruption

While a running program asks for `INPUT`, typed lines belong to that program.
An answer such as `RUN` or `EXIT` is ordinary string input, not a session command.
Numeric INPUT retains its retry and finite-decimal validation rules.

Ctrl+C at an idle prompt discards the current entry and shows a new prompt.
Ctrl+C during a confirmation cancels that operation and preserves the program.
During `RUN`, Ctrl+C stops computation or pending INPUT and returns to an editor
prompt, preserving source for correction or rerun. File execution remains
separate: an interrupted `basic file.bas` exits with status 130.

## Protecting unsaved source

Before clearing or exiting with source present, the prompts are:

- `Discard unsaved changes and start a new program? [y/N] `
- `Discard unsaved changes and exit? [y/N] `

Only `y` or `yes` confirms, ignoring case and surrounding whitespace. Blank or
other answers cancel without changing source. A program is clean when empty;
adding or replacing lines is unsaved, and deleting all lines restores the empty
baseline. LOAD/SAVE will be added separately; until then, listing and copying the
source is the way to retain work outside the terminal.

Clean EOF exits normally. EOF with unsaved source, including EOF during a discard
confirmation, writes this warning followed by **all** stored source in numeric
order to stderr and exits with status 1:

```text
Unsaved program at EOF; copy the source below before closing:
```

EOF during program INPUT first reports its located `INPUT_ENDED` diagnostic,
then returns to the editor. If no input remains, the same complete-source
recovery happens. Explicitly confirming `EXIT` discards the unsaved session and
exits normally. All ordinary exits print `Have a great day :)`.

## Example

```text
>>> 30 NEXT I
>>> 10 FOR I=1 TO 3
>>> 20 PRINT I
>>> RUN
1
2
3
>>> 20 PRINT I*2
>>> RUN
2
4
6
>>> LIST
10 FOR I=1 TO 3
20 PRINT I*2
30 NEXT I
>>> EXIT
Discard unsaved changes and exit? [y/N] yes
Have a great day :)
```
