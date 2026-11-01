# Internal historical quoted strings and comments

Design before code for #117/#116. Extend only the existing internal
`basic-plus-1972-10` scanner policy. Public parser/runtime selection remains native.

Primary evidence is the October 1972 BASIC-PLUS manual, SHA-256
`684b54d7218a2fb581bf324b175c1e37dc609e718218a81a51b22c31a1e936bd`.
Visually reviewed §5.1.1, printed 5-2 (PDF 68), permits single or double quotes;
§3.1, printed 3-1/3-2 (PDF 28/29), defines `!` comments, including a comment-only
numbered line and the exception for DATA items. These lexical facts do not
settle runtime string encoding, a historical parser or terminal continuation.

Both quote delimiters produce the existing STRING token with exact raw spelling
and UTF-16 positions. The opposite quote, `!`, punctuation and apparent keywords
inside remain payload. A matching quote terminates the token; adjacent strings
remain separate tokens rather than doubled-quote escapes in historical mode.
An unmatched delimiter fails at its opening position before LF/CRLF or EOF.
Native double-quote escaping and rejection of single quotes remain unchanged.

Outside strings and DATA, `!` consumes the rest of the physical line as one
COMMENT token. Its raw span includes `!`, while its value contains only the
following text, including blanks. Empty and comment-only lines are supported,
including a label immediately followed by `!`. REM retains its existing separate
keyword plus payload token. Neither form scans words or punctuation in comments.
LF/CRLF reset lexical clause/label state normally. Bare CR and historical terminal
LINE FEED continuation remain unsupported; no lines are joined or rewritten.

DATA continues to own its entire physical payload: `!` is text, never a trailing
comment, and the existing quoted-field delimiters and validation are unchanged.
Reuse the shared scanner's string/comment readers instead of preprocessing or
introducing another scanner. Verify exact tokens/spans/fragment offsets,
opposite quotes, empty/adjacent/unterminated strings, DATA interactions, clause
reset, long input and native error/token/AST preservation. Public option-shaped
objects must not enable this policy. Existing installed and browser regressions
remain required; no historical execution or full-game pass is claimed.
