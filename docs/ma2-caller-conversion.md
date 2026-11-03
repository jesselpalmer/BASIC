# Bounded selected-MA2 caller conversion

Design before implementation for #123/#122/#59/#116. Use the separately
captured [caller observations](ma2-conversion-callers.md) and already traced
[unsigned source converter](basic-plus-ma2-decimal.md). Add internal pure VAL
and target-dependent numeric READ conversion; leave public parsing, execution,
DATA pools/cursors, INPUT and diagnostic/handler ownership unchanged.

## Closed boundary

VAL accepts primitive strings with at most255 UTF-16 units. This first slice
supports printable ASCII and uppercase numeric notation only; controls,
high bytes, Unicode and lowercase text remain explicitly unsupported. Remove
ASCII spaces, accept empty text as canonical zero, separate one leading sign,
and require complete unsigned decimal/scientific spelling. Reject invalid
complete spellings with conversion error52; do not accept a numeric prefix.
A standalone decimal point remains unsupported because its exploratory probe
did not complete. Do not silently copy native parseFloat/Number behavior.

For valid floating spellings use the selected MA2 converter and apply a negative
sign through canonical word negation. Its conversion-status boundary maps to52.
VAL's observed intermediate arithmetic boundary maps to a first conversion
failure48, without any fabricated result/continuation words. This is a failure
fact for execution-owned trapping; it does not implement untrapped continuation.

Numeric READ consumes **already scanned field text** and an explicit quoted flag,
not raw DATA syntax. The scanner owns quote removal, unquoted ASCII-space
removal, raw spans and syntax errors. Validate the target/quoted flag first,
then require bounded primitive printable text. Reject an empty or space-bearing
unquoted prepared field as malformed input to the helper, not as a guessed
historical omitted-field rule. Quoted fields produce52, including numeric-looking
strings. Floating READ accepts complete signed decimal/scientific spelling;
integer READ accepts only a signed decimal integer in -32768..32767, with no
fraction, exponent or percent suffix. Accumulate its bounded digits exactly,
without routing through floating assignment truncation. Integer range failure
is52 here, rather than subscript/assignment51. Keep READ's unobserved intermediate
arithmetic-event continuation explicitly unsupported.

Results are detached frozen values (two canonical words or a signed integer),
frozen first-failure code52/48, or a frozen explicit unsupported boundary. No
result mutates targets or advances cursors. The execution/data owner may commit
and advance only after success; the captured failed READ/RESUME paths preserve
both initialized targets and the current field. Untrapped policy, retry,
handler stacks and expression event timing require their own integration.

## Acceptance

Consume all81 original caller observations offline:32 VAL,24 floating READ,
24 integer READ and the isolated forty-digit VAL event. Verify source/output
hashes, exact case identities, initialized post-handler targets and observed
READ cursor movement independently of helper results. Exercise source-converter
status and event cases, signs/zero, cutoff neighbors, malformed/unsupported
spellings, byte and length bounds, integer endpoints, strict inputs and frozen
results. Feed actual historical scanner STRING values/quoted raw spellings into
READ to verify the seam without modifying that scanner or public native DATA.

Keep existing native source/AST/value/error behavior and package/browser/archive
gates. No new public entrypoint, historical dialect or complete-game pass is
created; all108 corpus files and remaining compatibility gates stay required.
