# Selected-MA2 literal preparation boundary

Design before implementation for #116/#117/#123. Build on the merged raw numeric
scanner and unsigned MA2 converter. Add the distinct Ma2NumberLiteral expression
case proposed by the shared value contract, without enabling historical parsing
or execution. Native source still produces NumberLiteral with its exact prior
value/raw/location shape; structural labels/destinations/DIM bounds remain native
integer-only nodes.

An internal preparation helper consumes one RAW_NUMBER token. Validate its type,
null payload, primitive raw text and copied label/physical span; numeric spellings
occupy one physical line and span exactly their UTF-16 raw length. Separate source
signs remain UnaryExpressions. Keep integer suffixes, input-limit, conversion-status
and numeric-event boundaries explicit rather than manufacturing words. Successful
preparation returns a detached frozen Ma2NumberLiteral containing raw text,
canonical two-word encoding and a detached frozen location, with no host-number
value field. Validate supplied literal nodes by recomputing raw conversion and
checking a single snapshot of the exact two words. Return unsupported conversion
boundaries; reject malformed containers, positions, words and raw/word disagreement.

The public closed Expression union gains this explicit case and type inference
recognizes its numeric result kind. Existing native preparation rejects the case
in every tree position, including dead clauses and source after END, before host
effects. Direct Evaluator evaluation, comparison and assignment likewise reject
foreign literals before random/keyboard/index effects. Reject without inspecting
a foreign literal's word payload. Keep the existing iterative evaluator; no
historical operator, native arithmetic fallback or second executor is added.

Use an iterative, cycle-safe foreign-literal search shared by the native guards.
Keep existing native-only arity/type/error behavior and source ordering intact.
Verify all396 original ATOF inputs through scanner/preparation: exact normal words
and explicit unsupported status/event results, plus integer and input limits.
Exercise raw/word mismatches, hostile fields, read-once word snapshots, copied
locations, immutability, native parser identity, deep/shared/cyclic search, and
pre-effect rejection across all public execution boundaries. Installed root and
browser consumers must reject supplied foreign/dead trees and retain source/run
replacement state. Update exhaustive switches and positive/negative public types.

This completes a literal conformance/preparation seam, not the shared historical
parser or executable configuration. The remaining support matrix, value storage,
input/output, array/loop/event policies and full corpus acceptance stay gated.
