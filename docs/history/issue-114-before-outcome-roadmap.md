# Issue #114 snapshot before the outcome roadmap update

Historical issue body preserved verbatim below. Captured after #203/#204 merged;
its pending/current checkpoint wording describes earlier states and is not the
current plan. See the [roadmap](../classic-games-roadmap.md) and live
[issue #114](https://github.com/jesselpalmer/BASIC/issues/114).

---

<!-- prettier-ignore-start -->

**Priority:** P1 / High — required before 1.0
**Release gate:** #109
**Scope adopted at Jesse's request:** 2026-10-24. Required forms pass their own source/design gates before implementation; the full compatibility target remains unchanged.

## Previous delivery checkpoint — PRs #175/#176

The prepared batch supplies native integer USING asterisk fill (#175) and separate scan-reviewed 23 Matches correction acceptance (#176). Shared parser/runtime ownership and raw/corrected fixture distinctions are preserved. Parent completion and release readiness remain governed by the full source/dialect/behavior criteria.

Main `7a06a8d07b4f5239e942677eb447713a69a51320` includes merged #173/#174. PRs [#175](https://github.com/jesselpalmer/BASIC/pull/175) and [#176](https://github.com/jesselpalmer/BASIC/pull/176) are open and independently mergeable; neither is merged. They share no changed files. The combined tree `084c248f50a0eb36430ae931cd05be85c134a98c` passed the full local gate: 2,877 tests plus the existing non-CI environment skip and 37 package scenarios.

[#175 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41360876357) passed 2,877 tests and 36 package scenarios per OS. [#176 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41360939454) passed 2,855 tests and 37 scenarios per OS. Each PR passed 91 checkout and 91 exact-archive browser cases on each platform. All four RELEASE_VALIDATED manifests match the exact published heads/trees, with release/coverage uploads complete and unchanged coverage requirements. Exact hashes and retained logs are recorded in the PR bodies.

The [repository roadmap](https://github.com/jesselpalmer/BASIC/blob/feat/print-using-asterisks/docs/classic-games-roadmap.md) is reconciled through the prior merges and this prepared batch. Earlier delivery sections remain historical evidence. Native is still the only executable profile; all 108 corpus dispositions remain required, zero full historical-game passes are certified, and #109 remains **NOT READY**. Existing acceptance criteria stay open.

## Previous delivery checkpoint — PRs #177/#178

The merged slices are native integer PRINT USING trailing-minus columns (#177) and internal historical single-quote/`!` comment scanning (#178). They preserve shared ownership, native behavior and the existing DATA/comment boundary. They do not complete source/dialect/whole-game acceptance or activate a historical profile.

Main `97de8887db554d28cdf38a9d606d1c98838ee096` now contains merged [#177](https://github.com/jesselpalmer/BASIC/pull/177) (`e590e1f9c944dba3ab3bbf8356d4f6a97fd3d9a8`) and [#178](https://github.com/jesselpalmer/BASIC/pull/178) (`97de8887db554d28cdf38a9d606d1c98838ee096`). Its tree `5fa60b6a6e6f2772f637219096459edade034ba0` exactly matches the final combined tree validated locally with 2,924 passing tests plus the existing non-CI environment skip and all 37 package scenarios. The CI results below remain evidence for the exact reviewed PR heads; no additional post-merge run is inferred.

[#177 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41364779855) passed 2,905 tests, 37 package scenarios and 95 checkout plus 95 exact-archive browser cases per OS. [#178 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41364785357) passed 2,898 tests, 37 package scenarios and 94 checkout plus 94 exact-archive browser cases per OS. All four RELEASE_VALIDATED manifests match the exact published heads/trees. Release/coverage uploads completed; artifact sizes/hashes and retained logs are in the PR bodies. Touched formatter/scanner line and function coverage is 100% with unchanged floors.

[Roadmap reconciliation #179](https://github.com/jesselpalmer/BASIC/pull/179) marks these deliveries merged, updates the lexing/output/numeric rows and focuses the next milestones on the remaining 1CHECK source/dialect gaps, selected numeric conversion/operation semantics and an executable historical vertical slice. The documentation PR is open; existing acceptance criteria are unchanged. Earlier delivery sections remain historical evidence. Native remains the only executable profile; all 108 corpus dispositions remain required, zero full historical-game passes are certified and #109 remains **NOT READY**.
## Previous delivery checkpoint — PRs #180/#181

The two independent PRs advance the roadmap's first-game source review and selected numeric contract: #180 verifies March1975 punctuation without altering either 1CHECK fixture; #181 reproduces ordered MA2 multiplication and its real-monitor range words. The branches change no common paths and can merge in either order. The combined tree `9504d1562043e8de1442b4181c75947bd165d1e5` passed the complete local gate.

Both PRs remain open, with no overlapping changed paths. [#180](https://github.com/jesselpalmer/BASIC/pull/180), head `7f9b34dacf620b55d27d26d09c4597145ac193a7` / tree `ac1415e791be3ec09d112b8fd661792a7f299c98`, passed [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41390905420) with 2,925 tests per OS. [#181](https://github.com/jesselpalmer/BASIC/pull/181), head `ca35a74e052ecb400f24396b4d524f6cefea9cef` / tree `ec51d5a54fe4899a8b901ced89c80473863e73dc`, passed [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41391943433) with 4,274 tests per OS and 100% MA2 helper lines/functions. Each PR/OS passed unchanged coverage floors, seeded runs, 37 installed-package scenarios and 96 checkout plus 96 exact-archive browser cases. All four manifests match the exact heads/trees; release/coverage uploads completed, with archive sizes/hashes retained in the PRs.

Native remains the only executable profile. All 108 corpus files remain required; zero historical full-game passes are certified. Parent acceptance criteria remain open and #109 is **NOT READY**. This checkpoint supersedes older delivery-status paragraphs below.

## Previous delivery checkpoint — PRs #182/#183

[#182](https://github.com/jesselpalmer/BASIC/pull/182) closes the first candidate's quoted-text gap with a separate tested fixture and reconciles the roadmap after merged #180/#181. [#183](https://github.com/jesselpalmer/BASIC/pull/183) adds traced selected-MA2 division and explicit code61/code48 continuations. The branches change no common paths and can merge in either order. The exact combined local tree `a80c085816ef8b127c688c0b3fbfde33f5244edc` passes the complete local gate with5,606 tests plus the existing environment skip and38 package scenarios.

The preceding PRs #180/#181 are merged as `8c8b1dcc66e1ac28f09a9a4424c87a363bf045d0` and `d77f85ad419a8dbd4a680143c89c8c316cbfa09e`. This new pair remains open, with no overlapping changed paths. [#182 final CI](https://github.com/jesselpalmer/BASIC/actions/runs/41394711907) passed on head `7726fdfaecda30824d8d4aee0842d7a8c4de96ea`, tree `1cfb0c7baf96c534ff485fe65e219266145f6ab5`: 4,274 tests,38 package scenarios and98 checkout plus98 exact-archive browser cases per OS. [#183 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41394557205) passed on head `788b69b23ad44322e67c112a1d999f2593e72d08`, tree `adc1593bb6ef7d80ffd38865b95a35956917fed3`: 5,607 tests,37 package scenarios and96 checkout plus96 exact-archive browser cases per OS, with100% MA2 helper lines/functions. Both Linux/macOS runs include unchanged coverage floors, seeded runs, consumer types/CLI/editor/global install and completed release/coverage uploads. All four RELEASE_VALIDATED manifests match the exact final heads/trees; archive sizes/hashes are retained in the PRs. The combined final local tree `a80c085816ef8b127c688c0b3fbfde33f5244edc` passes the full gate and38 package scenarios.

The local pinned-browser download returned HTML rather than an archive and local browser cases could not launch; the completed official CI runs above provide browser/artifact evidence. Native remains the only executable profile. All108 corpus dispositions remain required; zero historical full-game passes are certified. Parent acceptance criteria remain open and #109 is **NOT READY**. This checkpoint supersedes older delivery-status paragraphs below.

## Previous delivery checkpoint — PRs #184/#185

Two independent deliveries are prepared: #184 adds the selected-MA2 normal source-literal converter with explicit unsupported boundaries, and #185 adds32 subscript/six loop reference observations plus the concrete85-statement first-game matrix. They change no common files and can merge in either order. The roadmap reconciles merged #182/#183 without activating an incomplete profile or relaxing the full corpus requirement.

The preceding PRs #182/#183 are merged as `e0a6cb28743dea03b767c2f4140090b44a9b042b` and `efb1cde107602cada8e38dbb28e5fb91dcf23dd0`. This pair remains open and changes no common paths. [#184 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41398559583) passed on head `bf582b21810a870adc8a46518d452634b88f2be7`, tree `b3f1a0972d60da86bb2ad70ac95fbd8f5dfa595b`: 6,030 tests per OS and100% new converter lines/functions. [#185 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41400092903) passed on head `309f168ceb1746191995497d8c967ecab68b0cad`, tree `e87ed46d864e177135c855ad82fd928c9102737d`: 5,607 tests per OS. Both Linux/macOS runs include unchanged coverage floors, seeded tests,38 installed-package scenarios/public types/CLI/editor/global install and98 checkout plus98 exact-archive Chromium cases. All four RELEASE_VALIDATED manifests match the exact heads/trees; release/coverage uploads completed. Archive sizes/hashes are retained in the PRs.

Exact combined local tree `01109bc6f8ce9d02f8a21d3e92e14056b276a4fb` passes the full gate with6,029 tests plus the existing environment skip and38 package scenarios. Either merge order is supported. Normal CI consumes captured evidence offline; it does not run the historical OS/emulator. The new reference capture preserves manual-clock/INIT/filesystem limitations and does not establish a general I/O oracle. Native remains the only executable profile. All108 corpus dispositions remain required, zero historical full-game passes are certified, parent acceptance criteria stay open and #109 is **NOT READY**. This checkpoint supersedes older delivery-status paragraphs below.

## Previous delivery checkpoint — PRs #186/#187

Two independent prerequisites are prepared: #186 completes bounded canonical MA2 unary values/order/observation; #187 captures81 VAL/READ observations and reconciles the roadmap with merged #184/#185. Both change separate files and support either merge order. This advances the selected numeric reference contract without enabling historical parsing/execution or completing a compatibility parent.

Main is `29a6d14a4528a86ec91672c4c8291a6f9c92bacb`: #184 merged as `be29db190604f0de8fce85ea60124d7af2495b8b`, #185 as that main commit. New #186/#187 are independently based on it, change no common paths and remain unmerged.

[#186 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41408035846) passed on head `6b6e5203f43daae97225bb47db274adc047dff1e`, tree `0dba9bf7b418d1c24967794288838411af6d2933` (6,990 tests per OS; 100% new-module lines/functions). [#187 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41408673406) passed on head `7e5dd0744654dd828204830d4a7f470669f198e5`, tree `88e4dc833d1de920b1b0c1f9a7e83340ad5a1b10` (6,030 tests per OS). Each passed Linux/macOS full gates, seeded execution, unchanged coverage floors, 38 installed-package scenarios/types/CLI/editor/global install, 98 checkout plus98 exact-extracted-archive Chromium cases, title checks and release/coverage uploads. Exact head/tree RELEASE_VALIDATED manifests and artifact hashes are recorded in each PR.

Both merge orders produce combined local tree `0dfed90f321582ebbc113cf297a7e035d1e138d3`, which passed full `bun run check`: 6,989 tests plus the existing local Python environment skip, unchanged coverage/seeded runs and all38 package scenarios. Native remains the only executable profile. All108 files remain required:3 reviewed source differences/105 unresolved;1 printed-system identification/107 unverified;2 partial native paths/106 not run;**zero certified historical passes**. Compatibility parents remain open and #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #188/#189

Two independent prerequisites are prepared: #188 defines selected-MA2 raw tokens/literals, word-preserving shared storage/evaluation and exact public observations/injection; #189 implements bounded VAL/numeric READ conversion against 81 captured caller observations and 396 source-converter vectors. Native remains the only executable profile. The roadmap and first-game matrix reflect merged #186/#187 and concrete remaining integration gates.

Main is `5bbd548fa0a0a8c140fc2b98e37173cd98eaaaca`: #186 merged as `a645dd06e94d3ded46718c96092bc67e641b52e2`, #187 as that main commit. The new PRs are independently based on main, change no common paths and remain unmerged.

[#188 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41571172321) passed on head `7e6f6bd39b98515fd2345f379b7880146dfff534`, tree `2642874236ae6dbf6bf334d324fe172f30a1d780` (6,990 tests per OS). [#189 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41572002858) passed on head `7ca4f9eb82c865236e20e0f23d4a4801c275f7ff`, tree `32b484eea53888d5d6e58002c5f82740bfffe22f` (7,473 tests per OS; 100% new-module lines/functions). Each passed Linux/macOS full checks, unchanged coverage/seeded execution, 38 installed-package scenarios/types/CLI/editor/global install, 98 checkout plus 98 exact-extracted-archive Chromium cases, title checks and release/coverage uploads. Exact head/tree RELEASE_VALIDATED manifests and artifact hashes are in each PR.

Both merge orders produce combined local tree `b780923ea82567c51791b8227f17374934012254`, which passed full `bun run check`: 7,472 tests plus the existing local Python environment skip, unchanged coverage/seeded runs and all 38 package scenarios. Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents stay open; #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #191/#192

PR #191 implements the first scanner stage of the shared MA2 contract: historical numbers retain raw spellings without host-number decoding and still require later historical AST/preparation/evaluator binding. PR #192 independently supplies a public browser embedding boundary useful to external applications. Both preserve native execution and all corpus/first-game activation requirements.

Main is `e7499599e2525274c99eb1cb175e594c8c1399cf`, containing #188 (`b20b0b1f3387ffca7f2e4e04b53ff742821d3507`) and #189 (that main commit). New #191/#192 are independently based on main, change no common paths and remain unmerged.

[#191 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41971108250) passed on head `47c19a98d6e01ba405930157b37d4d8af0dffd15`, tree `d88cf0bfda30b3fbc195685e91e11134e6631aa5`: 7,877 tests and 98 checkout plus 98 exact-extracted-archive Chromium cases per OS, with 100% scanner/classifier lines/functions. [#192 final CI](https://github.com/jesselpalmer/BASIC/actions/runs/41972273518) passed on head `07b136a23da55975af99d7846364590f357809b9`, tree `e7801cf61b7cb8b8676eb72708867a63ed20c423`: 7,473 tests, eight public embedding scenarios in ESM/CommonJS, and 99 checkout plus 99 exact-archive Chromium cases per OS. Both include unchanged coverage floors/seeded execution, 38 installed-package scenarios/public types/CLI/editor/global install, title checks and release/coverage uploads. All final RELEASE_VALIDATED manifests match their exact heads/trees; artifact hashes are recorded in each PR. The browser bundle is built from the exact selected package artifact.

Both merge orders produce combined local tree `77335940d7fc39e5fe17ef542f046a60a30dac37`, which passes the full gate: 7,876 tests plus the existing local Python environment skip, unchanged coverage/seeded runs, all 38 package scenarios and eight embedding consumer scenarios with physical/symlink path checks. Native remains the only executable language profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open and #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #193/#194

PR #193 supplies exact mathematical MA2 host-number injection; #194 independently supplies raw/word literal preparation, explicit native rejection and installed/browser boundary checks. Both follow design-before-code commits and preserve the native-only execution gate. The remaining shared runtime support matrix and all historical game acceptance still block completion.

Main is `b772f03af1edb2cfba3293271113221698eceff2`, containing merged #191 (`1a714a62c561cfec5fa50ea38ebd2238b601df56`) and #192 (that main commit); #190 is closed. New [#193](https://github.com/jesselpalmer/BASIC/pull/193) and [#194](https://github.com/jesselpalmer/BASIC/pull/194) are independently based on main and change no common paths.

[#193 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41977070847) passes on head `0254282c391c795b2481958260728c540600021d`, tree `1e420340dd6c5532900856ec9aec071ce0d502e1`: all 7,954 tests and eight embedding scenarios. [#194 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41977481775) passes on head `2488cb20df9ad2df6c90636fb8f9b35d3a37745b`, tree `12a6c781f7b8d6d95a55b694f0ccd1706e1ee419`: all 8,279 tests and nine embedding scenarios. Each Linux/macOS job includes coverage and seeded runs, unchanged coverage floors (new/touched runtime modules have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict consumer types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser embedding is bundled from the exact selected package artifact. All final RELEASE_VALIDATED manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in each PR.

Both merge orders, including the published heads, produce combined tree `a5dded3ebbc5ee9afce7533721a19c1360c962e7`. Its full local gate passes 8,355 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and nine embedding scenarios in ESM/CommonJS. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #195/#196

PRs #195/#196 independently advance shared MA2 integration: the existing Parser now has a bounded internal numeric-expression path, and a closed immutable value owner binds the captured operations without host-number reconstruction. Complete historical Program preparation, execution-owned storage/events, loops/I/O and all historical game acceptance remain outstanding.

Main is `874230ca7dc72284a2b6236da55140abb7dc1954`, containing merged #193 (`69bf2910e545b1d55a9de564cddca7bbfecdd6f4`) and #194 (that main commit). New [#195](https://github.com/jesselpalmer/BASIC/pull/195) and [#196](https://github.com/jesselpalmer/BASIC/pull/196) are independently based on main, with no changed-path overlap.

[#195 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42150657881) passes on head `e60b4e132efc521e27592860d1fd137158920667`, tree `9c6456f1d7de35c1e409cde8b629a7baf2f7e80a`: all 8,758 tests and ten embedding scenarios. [#196 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42150806894) passes on head `9ec8410fb4d0b3c666d8bad804a990c4ccb3b345`, tree `5d1cb8ff557927862c195429adb9b18f980ef33e`: all 12,574 tests and nine embedding scenarios. Each Linux/macOS job includes coverage and seeded runs, unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match their exact heads/trees; release/coverage uploads and title checks are green. Per-artifact hashes are recorded in the PRs.

Both merge orders, including the published heads, produce combined tree `d2f5339bdfa8a99b9c6de20df9adf82868e7ebb0`. Its full local gate passes 12,975 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and ten embedding scenarios in ESM/CommonJS. A direct composition check also passes shared parser → literal → MA2 INT and division-event binding. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents stay open; #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #197/#198

PRs #197/#198 independently add mathematical MA2 signed-word conversion facts and constant MA2 evaluation through the existing iterative driver. This advances numeric integration while leaving complete historical Program preparation, execution-owned storage, statements/comparisons, event policy, arrays/loops, I/O and full game acceptance gated.

Main is `3b6d275a7ebc9f34681e835107ae4de433b5e4d1`, containing merged #195 (`d3fba52f4bd410cf85b26317f486af95a4829a80`) and #196 (that main commit). New [#197](https://github.com/jesselpalmer/BASIC/pull/197) and [#198](https://github.com/jesselpalmer/BASIC/pull/198) are independently based on main with no changed-path overlap.

[#197 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42161254450) passes on head `0be94842dfc9bd03d2686db1a977f387d565a922`, tree `f559ac2371cda78bf5b4ce6ed5705d8a7ef4f3f1`: all 13,012 tests and ten embedding scenarios. [#198 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42161531598) passes on head `98090947e41cad1d8131fc8da9f6b66f53476213`, tree `4f708c412c0649bc906bbe2affc05f40bd435532`: all 13,405 tests and eleven embedding scenarios. Each Linux/macOS job includes coverage and seeded runs with unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in each PR.

Both merge orders, including the published heads, produce combined tree `cc9f25a958483a561d6aad0902fa3a50dcefcaaf`. Its full local gate passes 13,440 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and eleven embedding scenarios in ESM/CommonJS. A direct composition check passes shared parser/evaluator → immutable words → mathematical signed-word facts. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #199/#200

PRs #199/#200 independently advance word-preserving scalar storage and exact numeric relation binding through shared owners. Complete Program preparation, statement/IF integration, historical defaults/strings, arrays/loops, event policy, I/O and full game acceptance remain required. No new historical profile or game certification is delivered.

Main is `90e522cbd19a6823136952bb158ef5f6f1f0e8a6`, containing merged #197 (`b07bead34338b95bf90f5c09ccf621538c90da23`) and #198 (that main commit). New [#199](https://github.com/jesselpalmer/BASIC/pull/199) and [#200](https://github.com/jesselpalmer/BASIC/pull/200) are independently based on main with no changed-path overlap.

[#199 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42163462935) passes on head `89f3ffa0ee734d463b3e819e3f615980b67c73b6`, tree `f74dc4a4fbacccf4d83696283065c227000ca463`: all 13,841 tests and twelve embedding scenarios. [#200 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42163631827) passes on head `02727ad5bd79530341ac979f3ac5b2947068d830`, tree `99dd547dfbd61f8c5c3e628e087d8aef53e986e1`: all 14,199 tests and eleven embedding scenarios. Each Linux/macOS job includes coverage and seeded runs with unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in the PRs.

Both merge orders, including the published heads, produce combined tree `73a8d2d6360e56d72740ff9033a5cdecdb766830`. Its full local gate passes 14,598 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and twelve embedding scenarios in ESM/CommonJS. A direct composition check passes stored scalars → word evaluation → exact relations and event rollback. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #201/#202

PRs #201/#202 independently advance comparison-source binding through shared parser/evaluator owners and word-preserving numeric cells through the shared array store. Historical Program/statement binding, defaults, subscript/error policy, loops/I/O, general event behavior and every full-game acceptance obligation remain outstanding.

Main is `a14bca7a143a8032eceeab21c529aa1bd5645590`, containing merged #199 (`3a23ab529182a7a2f6ee6a2f72234a3b0fd07244`) and #200 (that main commit). New [#201](https://github.com/jesselpalmer/BASIC/pull/201) and [#202](https://github.com/jesselpalmer/BASIC/pull/202) are independently based on main with no changed-path overlap.

[#201 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42166686486) validates head `786a4be0074762189c4d932e302f54297bf7f13d`, tree `891db2bf39cf0ce23b4bf05f6277f60d56a6c490`: 15,359 tests and thirteen embedding scenarios. [#202 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42166863472) validates head `6f1c17452bbdec31f2e6c200971dedd39dba3b19`, tree `ea64068beb699b3a37ae82decb749a00ef755624`: 14,604 tests and twelve embedding scenarios. Each Linux/macOS job runs coverage/seeded tests with unchanged floors (new/touched owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, public types, CLI/editor/global install, and 99 checkout plus 99 exact-archive Chromium cases. Browser consumers bundle the exact selected package artifact. Final manifests match each head/tree; release/coverage uploads and title checks are recorded in the PRs with artifact hashes.

Both merge orders, including published heads, produce tree `01b9428c4c12cc4ce92d788ef54a450ce579d8eb`. Its full local gate passes 15,363 tests plus the existing Python-availability skip, unchanged coverage floors/seeded order, 38 installed library cases and thirteen embedding scenarios in ESM/CommonJS. Direct composition passes comparison source → scalar words → array cell/arithmetic and event identity. Both PRs remain unmerged.

Native remains the only executable profile. All 108 corpus files stay required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Parents remain open; #109 is **NOT READY**.

## Current delivery checkpoint — PRs #203/#204

PRs #203/#204 independently advance bounded string operations/shared predicates and shared word-array expression storage. Historical Program/statement binding, string INPUT/defaults, subscript/errors, loops/output/general events and all full-game acceptance obligations remain open.

Main `6c881d71c50fd61661bd85584b70ff465c2019d2` contains merged #201 (`a2fb3afa006f1c1c5ab07e50e70c2b93e50c2d26`) and #202 (main). New [#203](https://github.com/jesselpalmer/BASIC/pull/203) and [#204](https://github.com/jesselpalmer/BASIC/pull/204) independently target main with no changed-path overlap.

[#203 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42169399887) validates head `d16735e6f537158824d806deaaa5143eb7d5ef2f`, tree `5d16351ce5b0431817fc109c1ae18b5a051945bf`: 15,369 tests, thirteen embedding scenarios. [#204 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42169562191) validates head `1019f76146b05defd23817e3686c97c08b5e1244`, tree `a7fddcbf437784e3f759fc56ca2c0a986dcedf06`: 15,764 tests, fourteen embedding scenarios. Each Linux/macOS job passes coverage/seeded runs with unchanged floors (touched core owners 100% lines/functions), 38 installed ESM/CommonJS library cases, public types/CLI/editor/global install, and 99 checkout plus99 exact-archive Chromium cases. Browser bundles consume the selected package artifact. Final manifests/uploads and artifact hashes are retained in each PR.

Both merge orders, including published heads, produce tree `4fdea63fddd2082a8f98465c7502f746438482bb`. Its full local gate passes 15,768 tests plus the existing Python-availability skip, unchanged floors/seeded order, 38 installed library cases and fourteen embedding scenarios. Both PRs remain unmerged.

Native remains the only executable profile. All108 files stay required: 3 reviewed differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Parents stay open; #109 is **NOT READY**.

## Outcome

Correct classic game listings from [the pinned 101 BASIC Computer Games corpus](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/tree/45f75052be3f436f2e575f58d4aa611484268227) run with their documented dialect semantics through the Bun library, installed CLI and browser. There are **108 .bas files**, not a homogeneous Microsoft BASIC test suite. This supersedes the earlier small-dialect-only 1.0 scope.

## Current delivery checkpoint

Main `63715d03540623ebc067627e5a4c7db178cb0ccb` includes merged #171/#172. Its tree `022ef081c0c861c78a5949e11936e9ed31668b09` matches the independently checked integration tree. Internal MA2 addition/subtraction matches496 original-machine cases; #167's Linux/macOS evidence remains recorded in the PR. The earlier merged #166 reference build remains the installation basis. The selected V4A-12 MA2 monitor was reproduced from blank disks, with42 matching numeric/error observations and pinned media/object/map/load-image identities. Manual clock/startup and save/filesystem limitations remain explicit; this is not a fully initialized I/O oracle. Earlier #164 1CHECK review/native opening acceptance remains delivered, with source/dialect/output certification unresolved.

[PR #168](https://github.com/jesselpalmer/BASIC/pull/168) merged as `80d11ebe4ae419a2679159897ffbe693ab2bdb79`, with its validated tree unchanged. Tracing the original selected monitor shows that TRAP0 skips an inline status mask and resumes arithmetic unchanged: carry overflow reuses the swapped exponent and produces tiny nonzero words; rounding overflow reaches a second machine range trap and clears to zero; normalization underflow also clears. The internal helper retains the first code48/reason and separately attaches frozen continuationWords. Machine masks/counts stay in research data; two traps do not mean two printed diagnostics.

The independent continuation capture completes598 original-monitor calls:495 normal,78 first-overflow,25 first-underflow. All480 prior normal results match unchanged. The fixture retains118 range/control vectors (103 range,15 new normal controls), including signed/reversed boundary cases. A separate fresh-boot BASIC trace checks the three paths and one diagnostic per statement. No parser/evaluator/profile, handler/RESUME, literal/VAL or other arithmetic activation follows.

Local pinned Bun1.4.4 full checks pass2,660 tests plus the existing environment skip, unchanged coverage floors/100% MA2 helper coverage, seeded tests and34 shared source/installed scenarios plus public types/CLI/editor/global install. Uploaded head `e0544005a12970132c417e5c5df68ce4e94e594c`, tree `c6a8b4dd4f30f2fefaf178fb50e09f1f461a4af3`, exactly matches the locally checked tree. [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41287404422) passed on exact head `e0544005a12970132c417e5c5df68ce4e94e594c`, tree `c6a8b4dd4f30f2fefaf178fb50e09f1f461a4af3`: 2,661 tests per OS, unchanged coverage floors and 100% MA2 helper lines/functions, 34 shared source/installed ESM/CommonJS scenarios plus public types/CLI/editor/global install, and 83 checkout plus 83 exact-archive Chromium cases per platform. Both RELEASE_VALIDATED manifests identify this head/tree; release and coverage uploads completed on both platforms. Archive sizes/checksums and retained artifact links are recorded in PR #168. CI consumes captured vectors offline without the historical OS/emulator.

The repository roadmap and both Google plans now reconcile merged #167 and distinguish this prepared continuation slice. Native remains the only executable profile; all108 corpus dispositions remain required, zero historical-game passes are certified, all parent issues remain open and #109 is NOT READY.

The [repository roadmap](https://github.com/jesselpalmer/BASIC/blob/main/docs/classic-games-roadmap.md), [Google roadmap](https://docs.google.com/document/d/1onRiRqbrjoVH5w7ByZ_ylk_ZhixE3OqN-nPDYBHImdk) and [Google backlog](https://docs.google.com/document/d/1V02IrDkBeG98QwgzW1Rx6VgZe4eVkTmSfTdNCD3tUIA) distinguish merged prerequisites from remaining historical acceptance. Google checkpoints are reconciled through merged #171/#172 and identify the prepared line-input/string-format slices, preserving native lists, tables and historical sections.

Native remains the only executable profile. Ledger counts stay108 files: source3 reviewed differences/105 unresolved; dialect1 printed-system identification/107 unverified; behavior2 partial native paths/106 not-run; **zero certified historical-game passes**. Complete first-game source/dialect evidence and its selected numeric contract before historical vertical-slice activation. The full108-file scope, parent acceptance criteria, #109 **NOT READY** and approved candidate none remain unchanged.

## Evidence and boundaries

- The upstream README identifies a 1975 printing of the earlier DEC collection, with BASIC-PLUS, EduSystem, Dartmouth, DECsystem-10, HP-like and unknown dialects. Several assignments are maintainer guesses, not certification.
- Upstream NOTES records OCR/operator/label errors, missing AWARI data, questionable CANAM variables, estimated BOAT/BULL content and absent BUNNY/SNOOPY listings. A parser rejection alone does not establish invalid source.
- Baseline: main `201b52422edc75c518703874a459b6a83eef5726`; read-only `parseProgram` scan rejects all 108 current files at their first lexical/syntax/validation obstacle. This is a gap inventory, not evidence that the files are invalid.
- DEC's BASIC-PLUS manual (October 1972), §§3.2,3.3.2,3.6.2,3.7.1–2, chapters5–8,10.4.1, verifies optional LET, adjacent PRINT items, arrays, bare/argument RND and many other needed forms. DECsystem-10 March 1974 manual §§1.4.1,6.1,8.6,chapter11 and Dartmouth Fourth Edition January 1968 §§1.7,2.1–2.7 provide additional primary references.
- Preserve the existing dialect through explicit, source-backed compatibility selection where rules conflict. No typo correction, fuzzy keyword matching, JavaScript eval or game-specific grammar exceptions.
- The entire pinned corpus must receive a disposition. Valid but unimplemented dialects and unresolved/unknown syntax remain blockers; they cannot be called invalid or quietly deferred. Narrowing scope requires an explicit owner decision in #109.
- Real missing/incorrect source may be recorded as an evidenced source defect. Keep raw bytes and a separately reviewed minimal correction; do not count a corrected version as an unchanged-source pass. Missing external assets/services are dependency blockers until resolved, not syntax errors.

## Completion

- [ ] All 108 files have pinned hashes, dialect/evidence, feature dependencies, validity disposition and behavioral acceptance records; missing-book entries are accounted for separately.
- [ ] Research and dialect/API design decisions precede implementation.
- [ ] Required syntax/runtime/host tickets are complete; no unresolved valid-listing, unknown-source or external-dependency blockers.
- [ ] 1CHECK runs without adding LET, semicolons, or replacing arrays; a reviewed source correction changes the transcribed line 74 template separator from semicolon to the scan/manual's comma. Raw and corrected fixture results stay separate. Legal/illegal moves, board formatting, piece counts, summary, retry and restart work.
- [ ] Every verified correct listing has bounded deterministic gameplay/behavior tests, relevant loss/win/retry/restart and cancellation, across library, installed ESM/CommonJS/CLI and Chromium/static artifacts. No parse-only or first-prompt-only claim.
- [ ] Independent implementation/research review reconciles dialect differences, valid-source behavior and malformed-source rejection.
- [ ] #109 has a fresh exact candidate, Linux/macOS checks and package/static evidence for the expanded scope, with its actual Release decision set to READY only then.

## Sources

- [Pinned README](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/README.md) and [NOTES](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/NOTES.md)
- [BASIC-PLUS manual](https://bitsavers.trailing-edge.com/pdf/dec/pdp11/rsts-11/V004/DEC-11-ORBPA-A-D_BASIC-PLUS_LangMan_Oct72.pdf)
- [DECsystem-10 manual](https://bitsavers.org/pdf/dec/pdp10/TOPS10_softwareNotebooks/vol06/DEC-10-LBLMA-A-D_BASIC_Conversational_Language_Manual_Mar74.pdf)
- [Dartmouth Fourth Edition](https://retrofun.pl/wp-content/uploads/sites/2/2023/11/BASIC_4th_Edition_Jan68_text.pdf)

## Delivery index

| Issue | Scope |
| --- | --- |
| #115 | Certify the pinned classic-game corpus against scans and dialect manuals |
| #116 | Define explicit dialect profiles and compatibility contracts before implementation |
| #117 | Support source-verified classic lexical forms and optional LET |
| #118 | Execute multiple statements and classic conditional branches with correct line scope |
| #119 | Implement classic PRINT item adjacency, zones, numeric spacing and TAB |
| #120 | Implement source-backed PRINT USING templates and dialect delimiters |
| #121 | Support classic INPUT lists, indexed targets and line input |
| #122 | Add DATA, READ and RESTORE with verified classic data semantics |
| #123 | Add classic numeric expressions, initialization and random-number contracts |
| #124 | Define classic integer, comparison and logical-expression behavior |
| #125 | Add classic DEF FN functions and required multiline function bodies |
| #126 | Support verified classic loop transfers and statement modifiers |
| #127 | Implement the matrix operations required by verified classic listings |
| #128 | Resolve classic game file, CHAIN, error, timing and terminal-service dependencies |
| #129 | Gate 1.0 on behavioral classic-game compatibility across all distributions |
| #57 | Subroutines and computed dispatch (promoted) |
| #58 | Numeric/string/multidimensional arrays (promoted and expanded) |
| #59 | Dialect-correct strings/conversions/CHANGE (promoted and expanded) |

The current dependency order is the roadmap's next-milestones section above. Native/shared execution prerequisites have merged; remaining feature work follows verified source/profile contracts. Merge dependencies first, review integrated changes and require green Linux/macOS checks. Finish with full corpus acceptance #129 and a fresh exact-candidate review in #109.

#60 terminal immediate mode and #108 play-only export remain optional unless a verified corpus dependency changes that decision.

### Verified transcription finding

The [book scan, printed page 164 / PDF 166](https://archive.org/details/101basiccomputer0000davi/page/n165/mode/1up) reads `PRINT USING B$,J,...`; the pinned repository has `B$;J,...`. Both reviewed DEC manuals specify a comma template/list separator. Track the one-character correction separately from the raw input; don't add an undocumented DEC parser exception. The scan's catalog year1974 differs from upstream's stated1975 printing, so the audit must preserve edition provenance.

## Planning documentation

Both existing Google planning documents were updated in place on October 24, 2026, preserving the earlier milestone plan as history. [Docs PR #130](https://github.com/jesselpalmer/BASIC/pull/130), merged as `3037a8e83f7aa4da7f4feec844ccba43660c3fba` after green Linux/macOS checks, contains the research roadmap, full pinned inventory and corrected release/status documents; it changes Markdown only. Research #115 and design #116 remain open prerequisites; no interpreter implementation is included.


### First compatibility delivery batch

[#131](https://github.com/jesselpalmer/BASIC/pull/131) merged source/dialect evidence and the full pinned ledger. [#132](https://github.com/jesselpalmer/BASIC/pull/132) merged native optional LET and contextual GO TO. Both passed Linux/macOS checks; #132 validated 1004 Bun tests, 21 installed scenarios and 45 Chromium cases against checkout and exact static artifacts. Main commit `e56b334d9e91ec343160b7be8b930bd2e9938d7f` has the validated PR tree.

23MTCH has an unchanged-source loss/replay observation, **not a complete historical pass**: RND(0), historical formatting and profile certification are still blocked. Source/dialect/grammar/corpus parent issues stay open. The first batch does not satisfy the 1CHECK/whole-corpus gates, and the release decision remains **NOT READY**. No publication or tag was performed.

## Independent delivery batch — PRs #169/#170

Main now includes merged #168 as `80d11ebe4ae419a2679159897ffbe693ab2bdb79`, tree `c6a8b4dd4f30f2fefaf178fb50e09f1f461a4af3` identical to its validated PR tree.

[PR #169](https://github.com/jesselpalmer/BASIC/pull/169) adds an internal selected-MA2 conversion-string codec: raw stored-word/byte mapping, documented prefix consumption/null padding, bounded validation and detached frozen decoded words. It does not assign numeric meaning to unsupported patterns or activate CVTF$/CVT$F in the evaluator. Captured reference pairs, every bit position and all65,536 one-word patterns supplement malformed/hostile input tests. Local full checks pass2,704 tests plus the existing environment skip and34 package scenarios. Exact head `b5d503842698815432ad7b34daf07c3f38730ac4`, tree `2f35d2c43640d1e13827c30819389507dc4c9a21`.

[PR #170](https://github.com/jesselpalmer/BASIC/pull/170) adds terminal portable .basic.json LOAD/SAVE. Source/dialect/filename/baseline commit atomically; unchanged portable source remains verbatim through LIST/RUN/SAVE, real numbered edits use existing sorted-line form, and suffix-based SAVE AS/bare SAVE preserve format ownership. Invalid metadata/programs fail before discard prompts; cancellation/install failure preserve work. Real checkout/installed CLI sessions cover save/reload/execute and recovery. Local full checks pass2,678 tests plus the existing environment skip and34 package scenarios. Exact head `e12fe99db9e2675192ce24af389084869363e93a`, tree `3c28c93f9947672ce2eef38b22e816c707609df2`.

The two independent branches change no common files and merge cleanly. A separate combined tree `fe59fb48a7af47f9815927ad70945fa9314d3cb0` passed the full local gate with 2,722 tests plus the existing environment skip and all 34 package scenarios. Neither PR depends on the other; both start at merged #168 (`80d11ebe4ae419a2679159897ffbe693ab2bdb79`).

PRs #169/#170 are now merged as `2869bb7cd9aa7314744451239453546920cd8cc3` and `d05922dd06e0f26dccc01454648b622ff33c2684`; the integrated tree equals the checked combined tree `fe59fb48a7af47f9815927ad70945fa9314d3cb0`. [#169 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41327106008) passed 2,705 tests per OS; [#170 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41327112224) passed 2,679 tests per OS. Each platform/PR passed coverage and seeded runs, all34 shared package scenarios/public types/CLI/editor/global install, and83 checkout plus83 exact-archive Chromium cases. All four RELEASE_VALIDATED manifests match the exact heads/trees above, and release/coverage uploads completed. Coverage floors are unchanged with100% touched helper/editor lines/functions. Both PRs retain archive sizes/checksums and artifact links. Repository/Google roadmap and backlog checkpoints now distinguish merged #168 from these two prepared slices, preserving earlier plans/lists/tables. Native remains the only executable profile; all108 corpus dispositions, zero certified historical-game passes and #109 NOT READY remain unchanged.


## Native CHANGE and integer representation batch — PRs #171/#172

[PR #171](https://github.com/jesselpalmer/BASIC/pull/171) adds a pure selected-build signed-word/two-byte string codec. It implements documented prefix consumption and null padding, preserves signed16-bit representation, rejects numeric coercion and enforces the existing bounded byte-string domain. All65,536 signed words have independent byte expectations, alongside endpoint/bit/padding/malformed-input cases. It does not activate CVT intrinsics, numeric argument conversion or error51 continuation. Full local checks pass2,765 tests plus the existing environment skip and34 package scenarios. Exact head `c19921066102291ae3b541a5361c97851d4d7ded`, tree `f10ebea01e7e602f720b6445a093e8dc0692d650`.

[PR #172](https://github.com/jesselpalmer/BASIC/pull/172) adds runnable native CHANGE between a string scalar and an explicitly DIM-declared one-dimensional numeric array. Element0 holds length and the following cells hold byte codes0..255, with integral in-bounds counts capped at32767. Destination writes are atomic and unused cells survive. The manual's historical partial-overflow behavior is explicitly different and remains open. New ChangeStatement/Evaluator.change use the shared parser, supplied-tree preflight, execution-owned ArrayStore and ordinary one-statement/gate/budget accounting. Existing CHANGE scalar/array names and native source locations remain intact.

Tests cover manual CAT/ABCDE examples, all256 bytes, length/capacity/character errors, atomic late failures, dead dependencies, supplied snapshots, stepping/calls, cancellation/replacement and fresh runs. ASTs remain identical for150 existing name/assignment forms plus all7 examples. Full local checks pass2,756 tests plus the existing environment skip and35 shared source/installed scenarios, public types and real CLI/editor portable round trips. Two new browser cases cover Step, error recovery, Stop/replacement and exact import/export/reload. Exact head `1ee2b1e89fdebf54a05909861cbdc800912e5494`, tree `28e14cbbe0ff3b144fe50c4c46edda94b9313f05`.

The independent PRs change no common files and merge cleanly. Combined tree `022ef081c0c861c78a5949e11936e9ed31668b09` passed full local checks: 2,799 tests plus the existing environment skip and all 35 shared package scenarios. Both branches start at merged #169/#170 main `d05922dd06e0f26dccc01454648b622ff33c2684`; either may merge first.

PRs #171/#172 are now merged as `ec4ced1a99c67aaf8beb116a49538d7ad89caf43` and `63715d03540623ebc067627e5a4c7db178cb0ccb`; the integrated tree matches checked combined tree `022ef081c0c861c78a5949e11936e9ed31668b09`. [#171 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41329552619) passed 2,766 tests, 34 package scenarios and83 checkout plus83 exact-archive browser cases per OS. [#172 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41329559129) passed 2,757 tests, 35 package scenarios and85 checkout plus85 exact-archive browser cases per OS. Coverage/seeded tests, public types, installed CLI/editor/global install and all release/coverage uploads passed. All four RELEASE_VALIDATED manifests identify the exact heads/trees above; touched helper/array/evaluator modules retain100% lines/functions with unchanged floors. Archive sizes/checksums and retained artifact links are in each PR. The repository/Google roadmap and backlog now reconcile merged #169/#170 and distinguish these prepared native CHANGE/integer-codec slices, preserving historical sections/lists/tables. Native remains the only executable profile; all108 corpus dispositions, zero certified historical-game passes and #109 NOT READY remain unchanged.


## Independent input/output batch — PRs #173/#174

[PR #173](https://github.com/jesselpalmer/BASIC/pull/173) adds native INPUT LINE for a raw scalar or indexed string target. It requests one response with an empty prompt and preserves exact spaces, commas, quotes, empty text and Unicode without CSV parsing or retries. Shared preflight validates string targets/array dependencies before effects; guarded post-await assignment evaluates indices once and prevents late Stop/replacement writes. The response cap is 65,536 UTF-16 units; native never synthesizes historical terminal terminators or maps file channels to interactive input. Ordinary INPUT nodes, prompts, retries and LINE$ names stay unchanged.

Local full checks pass 2,830 tests plus the existing environment skip and 36 direct/installed package scenarios, public types and real CLI/editor portable save/load/execute sessions. New browser cases assert raw whitespace exactly, stepping, empty text, dead preflight and Stop/replacement. Head `0d6ce88e247b3deec99a5d3bdd97e02644855e97`, tree `d629da1e851de2f505f0d0a4625d5b396a0061f0`.

[PR #174](https://github.com/jesselpalmer/BASIC/pull/174) adds fixed-width PRINT USING string fields: ! consumes one character and backslash-delimited space fields consume their full width. Mixed typed fields retain image order, safe-integer formatting and one atomic host write. Native clips long strings and right-pads short/empty ones; emitted prefixes must be byte characters. Only emitted prefixes are inspected, so total traversal/output remain bounded by image width even for huge values. Other masks, numeric rounding, image reuse and historical policy remain open.

Local full checks pass 2,822 tests plus the existing environment skip and 35 package scenarios with expanded installed formatter/CLI/editor coverage. Manual examples, every byte, mixed types/order, caps, malformed images, ignored Unicode tails, consumed effects and atomic failures are tested. New browser cases cover exact whitespace, Step, export/reload/reimport and recovery. Head `457465024ee72a55c32bd1276ec9a103db912a4b`, tree `58c8f1d55d969e1aa229bc43765c929d6d0b4aab`.

The two branches change no common files and merge cleanly. Combined tree `a84697916aa6d993df5f99a120f11f0e8acc8042` passed the full local gate with 2,853 tests plus the existing environment skip and all 36 package scenarios. A composed INPUT LINE → mixed PRINT USING probe also passes. Both branches start at merged #171/#172 main `63715d03540623ebc067627e5a4c7db178cb0ccb`; either can merge first.

Both PRs are open and independently mergeable. [#173 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41337577183) passed 2,831 tests in both coverage/seeded runs and 36 package scenarios per OS; [#174 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41336541659) passed 2,823 tests in both coverage/seeded runs and 35 package scenarios per OS. Each PR passed 87 checkout and 87 exact-archive Chromium cases on each OS. All four RELEASE_VALIDATED manifests match their validated PR heads/trees; release and coverage uploads completed, with per-platform archive sizes, SHA-256 values and retained artifact links in the PR bodies. Coverage floors are unchanged. Initial #173 browser assertions were corrected to account for the accessible label and submitted-input echo; runtime/view behavior is unchanged. Repository/Google roadmap and backlog checkpoints now reconcile merged #171/#172 and distinguish these prepared line-input/string-format slices, preserving historical sections/lists/tables. Native remains the only executable profile; all 108 corpus dispositions, zero certified historical-game passes and #109 NOT READY remain unchanged.


<!-- prettier-ignore-end -->
