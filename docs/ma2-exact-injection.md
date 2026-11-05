# Exact host-number injection into canonical MA2

Design before implementation for #116/#123. Complete the mathematical injection
primitive required by the shared value contract, separately from source literal
conversion and future public Evaluator.assign integration.

Accept primitive JavaScript numbers only. Canonicalize both host zero signs to
[0,0]. Non-finite values, nonzero magnitudes outside canonical MA2 range and values
with extra significand bits return distinct explicit unsupported results. Do not
round, parse a decimal string, underflow to zero, saturate or manufacture a
continued-error replacement. The caller will own source-located rejection.

Read binary64 sign/exponent/fraction bits through a local DataView. Canonical MA2
numbers are normal binary64 values with at most24 significant bits. An in-range
stored MA2 exponent is the unbiased binary64 exponent+129. The low29 fraction
bits must all be zero; pack the remaining23 fraction bits into two words. Check
magnitude endpoints before precision, including the binary64 neighbors just above
the maximum MA2 magnitude. Freeze detached result objects and word pairs. No
mutable shared conversion buffer, caller coercion, public API or profile is added.

Use independent binary64 encodings of captured reference words, exact integers/
powers/fractions and one-bit neighbors to check every stored exponent, both
signs, zero, extrema and precision rejection. Source parsing and injection have
different contracts: host1+2^-23 is an exact MA2 neighbor, while the independently
captured long decimal source spelling for that same mathematical rational can
convert to1 under ATOF's decimal cutoff. Keep both outcomes rather than guessing
source spelling from the host value. Round-trip observations are a secondary
consistency check, not the only oracle. Include strict inputs and immutability.

The existing public BasicValue/assign contract remains native-only. Historical
value storage, injection diagnostics, parser/preparation, event behavior and
complete first-game activation still require their own integration and evidence.
