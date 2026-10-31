# Terminal editing

Start `basic` without a filename to edit a stored BASIC program. The terminal
prints the version and a `>>> ` prompt. Numbered entries edit source; they do not
execute until `RUN`. The library's `Basic.readLine` and `readLineAsync` methods
remain immediate-entry APIs for compatibility.

| Entry               | Behavior                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `10 PRINT "Hello"`  | Insert or replace line 10 after validating that single statement.                                   |
| `10`                | Delete line 10. Deleting a missing line is harmless.                                                |
| `LIST`              | Print complete stored source in numeric label order.                                                |
| `RUN`               | Validate the complete source snapshot, then execute with fresh variables and control-flow state.    |
| `LOAD "path.bas"`   | Read and fully validate a candidate, then replace stored source after confirming any unsaved edits. |
| `SAVE ["path.bas"]` | Save to a quoted path, or the current filename; confirm before overwriting an existing destination. |
| `NEW`               | Clear stored source and execution state, confirming first if source is unsaved.                     |
| `EXIT`              | Leave the terminal, confirming first if source is unsaved.                                          |
| Blank input         | Leave the program unchanged and show another prompt.                                                |

Commands are case-insensitive and allow surrounding whitespace. Only `LOAD` and
`SAVE` take arguments; unexpected trailing arguments are errors. Unnumbered
statements such as `PRINT 2+2` are outside the 1.0 dialect.
Labels retain the language's range of 1 through 65535. The source text of valid
entries is retained, including string case, spacing, and comments.

A rejected edit leaves the previous line and unsaved state unchanged. Forward
jump targets and unmatched `FOR`/`NEXT` lines can be entered incrementally. `RUN`
performs whole-program validation before effects; errors leave source available
for `LIST`, correction, or another `RUN`. Execution never changes the stored
source or marks it saved. Repeated `RUN` starts with fresh variables.

## File execution and diagnostics

Run `basic "my program.bas"` to execute plain source, or
`basic "my program.basic.json"` to execute a
[portable source document](portable-documents.md), through the same parser/runtime
as `RUN`, without an editor prompt or banner. The `.basic.json` suffix selects
the strict versioned envelope. Other filenames remain plain source; the CLI
never sniffs JSON or infers a dialect. Portable metadata supplies the context
and must name a profile supported by this build. The CLI reads but never
rewrites either format. Files use numeric label order. Complete
validation happens before effects, including unreachable statements; values are
checked when evaluated. Program output uses stdout, and source-located errors use
stderr without JavaScript stack traces. Successful completion exits 0; file,
syntax, runtime, and input-EOF errors exit 1. Extra arguments print usage and exit 9. Ctrl+C exits 130.

See the [language reference](language-v1.md) for supported statements, expression
functions, and diagnostic rules. This is a limited dialect; standalone `ABS` or
`INT` commands must be replaced with `PRINT ABS(...)` or `PRINT INT(...)`.

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

Before clearing, loading, or exiting with unsaved source, the prompts are:

- `Discard unsaved changes and start a new program? [y/N] `
- `Discard unsaved changes and exit? [y/N] `
- `Discard unsaved changes and load a program? [y/N] `

Only `y` or `yes` confirms, ignoring case and surrounding whitespace. Blank or
other answers cancel without changing source, filename, or saved baseline. EOF
or Ctrl+C during confirmation cancels the operation. A successful `LOAD`, `SAVE`,
or `NEW` establishes a clean baseline; source edits mark it unsaved. Repeating an
unchanged edit or restoring the baseline does not require another save. Running
a program never changes its saved state.

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

## Loading and saving

Paths must be quoted, even when they have no spaces. Filename case, spaces, and
backslashes remain literal. Double a quote within a path to represent one quote:

```text
SAVE "My Program.bas"
LOAD "My Program.bas"
SAVE "A ""quoted"" filename.bas"
```

`SAVE` without an argument uses the filename from the last successful load or
save. It reports an error if there is no current filename. `NEW` clears that
filename. Saving to another path updates it only after the save succeeds.
Every existing destination requires confirmation, including the current file
and dangling symlinks. Only `y` or `yes` authorizes replacement.

`LOAD` checks the entire file before asking to discard edits: syntax, duplicate
labels, jump targets, and loop pairing, including unreachable source. No
candidate statements execute during loading. Blank files are valid empty
programs. An unreadable or invalid candidate preserves your source, filename,
and unsaved state without asking to discard anything.

`SAVE` retains source spelling and whitespace in numeric label order. It also
accepts incomplete edits, such as a forward jump without its target or an
unmatched `FOR`. Complete these before loading the saved file: saving does not
claim that the program can run.

The terminal writes a temporary file in the destination directory before
installing the completed file. Failed writes, failed installation, and
cancellation before installation preserve the prior destination and session
state and remove the temporary. If a competing writer creates a previously
absent destination, saving fails rather than overwriting it without consent.
Installation and the matching saved-state update form one short synchronous
commit; an interrupt after that point does not undo a successful save. If the
filesystem refuses to remove a temporary after successful installation, a
warning identifies that file; the destination and saved state remain successful.
Saving replaces a destination symlink itself, rather than writing its target.

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
