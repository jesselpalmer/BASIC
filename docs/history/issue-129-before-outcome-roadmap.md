# Issue #129 snapshot before the outcome roadmap update

Historical issue body preserved verbatim below. Captured after #203/#204 merged;
its pending/current checkpoint wording describes earlier states and is not the
current plan. See the [roadmap](../classic-games-roadmap.md) and live
[issue #129](https://github.com/jesselpalmer/BASIC/issues/129).

---

<!-- prettier-ignore-start -->

**Priority:** P1 / High — 1.0 blocker
**Epic:** #114

## Previous delivery checkpoint — PRs #175/#176

PR #176 distinguishes raw and one-byte-corrected 23 Matches paths. Independent complete native-output oracles include 0/4/1.5/24 retries without mutation, computer choices 1/3/3/3/3/3, loss/replay, fresh reruns, the label-330 RND(0) arity failure, real CLI/editor/portable execution, browser transcript echoes, Stop and exact export/reload. EOF bounds the infinitely replaying source; it is not rewritten to terminate. These are partial native paths, not complete historical-game passes.

Main `7a06a8d07b4f5239e942677eb447713a69a51320` includes merged #173/#174. PRs [#175](https://github.com/jesselpalmer/BASIC/pull/175) and [#176](https://github.com/jesselpalmer/BASIC/pull/176) are open and independently mergeable; neither is merged. They share no changed files. The combined tree `084c248f50a0eb36430ae931cd05be85c134a98c` passed the full local gate: 2,877 tests plus the existing non-CI environment skip and 37 package scenarios.

[#175 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41360876357) passed 2,877 tests and 36 package scenarios per OS. [#176 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41360939454) passed 2,855 tests and 37 scenarios per OS. Each PR passed 91 checkout and 91 exact-archive browser cases on each platform. All four RELEASE_VALIDATED manifests match the exact published heads/trees, with release/coverage uploads complete and unchanged coverage requirements. Exact hashes and retained logs are recorded in the PR bodies.

The [repository roadmap](https://github.com/jesselpalmer/BASIC/blob/feat/print-using-asterisks/docs/classic-games-roadmap.md) is reconciled through the prior merges and this prepared batch. Earlier delivery sections remain historical evidence. Native is still the only executable profile; all 108 corpus dispositions remain required, zero full historical-game passes are certified, and #109 remains **NOT READY**. Existing acceptance criteria stay open.

## Previous delivery checkpoint — PRs #177/#178

This batch adds exact native trailing-sign output, capacity/failure/Step/rerun and installed CLI/editor/browser export/reload checks (#177), plus installed/browser regression checks proving that internal historical single quotes and comments do not become native syntax (#178). These are feature and boundary regressions, not new certified historical-game passes.

Main `97de8887db554d28cdf38a9d606d1c98838ee096` now contains merged [#177](https://github.com/jesselpalmer/BASIC/pull/177) (`e590e1f9c944dba3ab3bbf8356d4f6a97fd3d9a8`) and [#178](https://github.com/jesselpalmer/BASIC/pull/178) (`97de8887db554d28cdf38a9d606d1c98838ee096`). Its tree `5fa60b6a6e6f2772f637219096459edade034ba0` exactly matches the final combined tree validated locally with 2,924 passing tests plus the existing non-CI environment skip and all 37 package scenarios. The CI results below remain evidence for the exact reviewed PR heads; no additional post-merge run is inferred.

[#177 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41364779855) passed 2,905 tests, 37 package scenarios and 95 checkout plus 95 exact-archive browser cases per OS. [#178 Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/41364785357) passed 2,898 tests, 37 package scenarios and 94 checkout plus 94 exact-archive browser cases per OS. All four RELEASE_VALIDATED manifests match the exact published heads/trees. Release/coverage uploads completed; artifact sizes/hashes and retained logs are in the PR bodies. Touched formatter/scanner line and function coverage is 100% with unchanged floors.

[Roadmap reconciliation #179](https://github.com/jesselpalmer/BASIC/pull/179) marks these deliveries merged, updates the lexing/output/numeric rows and focuses the next milestones on the remaining 1CHECK source/dialect gaps, selected numeric conversion/operation semantics and an executable historical vertical slice. The documentation PR is open; existing acceptance criteria are unchanged. Earlier delivery sections remain historical evidence. Native remains the only executable profile; all 108 corpus dispositions remain required, zero full historical-game passes are certified and #109 remains **NOT READY**.
## Previous delivery checkpoint — PRs #182/#183

[#182](https://github.com/jesselpalmer/BASIC/pull/182) exercises both the minimal 1CHECK correction and the separately reviewed March1975 text through the same independent native oracles. Exact trailing spaces, illegal/legal/retry/replay, seven-move opening/sample-gap rejection, fresh runs and browser import/export/reload/Stop are checked across direct/installed ESM/CommonJS, CLI and static browser artifacts. These remain corrected native paths, with historical numeric padding and original dialect/version unresolved. No historical-game pass is certified.

The preceding PRs #180/#181 are merged as `8c8b1dcc66e1ac28f09a9a4424c87a363bf045d0` and `d77f85ad419a8dbd4a680143c89c8c316cbfa09e`. This new pair remains open, with no overlapping changed paths. [#182 final CI](https://github.com/jesselpalmer/BASIC/actions/runs/41394711907) passed on head `7726fdfaecda30824d8d4aee0842d7a8c4de96ea`, tree `1cfb0c7baf96c534ff485fe65e219266145f6ab5`: 4,274 tests,38 package scenarios and98 checkout plus98 exact-archive browser cases per OS. [#183 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41394557205) passed on head `788b69b23ad44322e67c112a1d999f2593e72d08`, tree `adc1593bb6ef7d80ffd38865b95a35956917fed3`: 5,607 tests,37 package scenarios and96 checkout plus96 exact-archive browser cases per OS, with100% MA2 helper lines/functions. Both Linux/macOS runs include unchanged coverage floors, seeded runs, consumer types/CLI/editor/global install and completed release/coverage uploads. All four RELEASE_VALIDATED manifests match the exact final heads/trees; archive sizes/hashes are retained in the PRs. The combined final local tree `a80c085816ef8b127c688c0b3fbfde33f5244edc` passes the full gate and38 package scenarios.

The local pinned-browser download returned HTML rather than an archive and local browser cases could not launch; the completed official CI runs above provide browser/artifact evidence. Native remains the only executable profile. All108 corpus dispositions remain required; zero historical full-game passes are certified. Parent acceptance criteria remain open and #109 is **NOT READY**. This checkpoint supersedes older delivery-status paragraphs below.

## Previous delivery checkpoint — PRs #184/#185

PR #185 makes first-game historical activation obligations concrete for all85 candidate statements and records separately booted subscript/loop evidence. Its normalized output transports state observations and is not a general historical PRINT oracle. Required preparation rejects unsupported dead/source/tree forms before effects; direct/installed/CLI/browser/Step/Stop/source round trips and full historical game outcomes remain future acceptance. Native is still the only executable profile; no historical pass is added.

The preceding PRs #182/#183 are merged as `e0a6cb28743dea03b767c2f4140090b44a9b042b` and `efb1cde107602cada8e38dbb28e5fb91dcf23dd0`. This pair remains open and changes no common paths. [#184 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41398559583) passed on head `bf582b21810a870adc8a46518d452634b88f2be7`, tree `b3f1a0972d60da86bb2ad70ac95fbd8f5dfa595b`: 6,030 tests per OS and100% new converter lines/functions. [#185 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41400092903) passed on head `309f168ceb1746191995497d8c967ecab68b0cad`, tree `e87ed46d864e177135c855ad82fd928c9102737d`: 5,607 tests per OS. Both Linux/macOS runs include unchanged coverage floors, seeded tests,38 installed-package scenarios/public types/CLI/editor/global install and98 checkout plus98 exact-archive Chromium cases. All four RELEASE_VALIDATED manifests match the exact heads/trees; release/coverage uploads completed. Archive sizes/hashes are retained in the PRs.

Exact combined local tree `01109bc6f8ce9d02f8a21d3e92e14056b276a4fb` passes the full gate with6,029 tests plus the existing environment skip and38 package scenarios. Either merge order is supported. Normal CI consumes captured evidence offline; it does not run the historical OS/emulator. The new reference capture preserves manual-clock/INIT/filesystem limitations and does not establish a general I/O oracle. Native remains the only executable profile. All108 corpus dispositions remain required, zero historical full-game passes are certified, parent acceptance criteria stay open and #109 is **NOT READY**. This checkpoint supersedes older delivery-status paragraphs below.

## Previous delivery checkpoint — PRs #186/#187

PRs #186/#187 add offline numeric and caller evidence with independently verified source/output hashes and repeatable machine/BASIC observations. Their normalized PRINT transports state and is not a general output oracle. The first-game support matrix, raw-literal/value/event binding, supported defaults/arrays/loops/INPUT/output, fail-before-effects preparation and full cross-host historical gameplay/lifecycle acceptance remain required.

Main is `29a6d14a4528a86ec91672c4c8291a6f9c92bacb`: #184 merged as `be29db190604f0de8fce85ea60124d7af2495b8b`, #185 as that main commit. New #186/#187 are independently based on it, change no common paths and remain unmerged.

[#186 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41408035846) passed on head `6b6e5203f43daae97225bb47db274adc047dff1e`, tree `0dba9bf7b418d1c24967794288838411af6d2933` (6,990 tests per OS; 100% new-module lines/functions). [#187 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41408673406) passed on head `7e5dd0744654dd828204830d4a7f470669f198e5`, tree `88e4dc833d1de920b1b0c1f9a7e83340ad5a1b10` (6,030 tests per OS). Each passed Linux/macOS full gates, seeded execution, unchanged coverage floors, 38 installed-package scenarios/types/CLI/editor/global install, 98 checkout plus98 exact-extracted-archive Chromium cases, title checks and release/coverage uploads. Exact head/tree RELEASE_VALIDATED manifests and artifact hashes are recorded in each PR.

Both merge orders produce combined local tree `0dfed90f321582ebbc113cf297a7e035d1e138d3`, which passed full `bun run check`: 6,989 tests plus the existing local Python environment skip, unchanged coverage/seeded runs and all38 package scenarios. Native remains the only executable profile. All108 files remain required:3 reviewed source differences/105 unresolved;1 printed-system identification/107 unverified;2 partial native paths/106 not run;**zero certified historical passes**. Compatibility parents remain open and #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #188/#189

PR #188 defines the shared value/literal/preparation and exact observation/injection direction; #189 adds bounded offline-verified conversion helpers. Historical contexts and arbitrary supplied/dead trees must still fail before effects until every accepted first-game support row is implemented. Input/output, index/loop/default and event/lifecycle evidence remain required, and normalized probe output is not a general historical formatting oracle.

Main is `5bbd548fa0a0a8c140fc2b98e37173cd98eaaaca`: #186 merged as `a645dd06e94d3ded46718c96092bc67e641b52e2`, #187 as that main commit. The new PRs are independently based on main, change no common paths and remain unmerged.

[#188 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41571172321) passed on head `7e6f6bd39b98515fd2345f379b7880146dfff534`, tree `2642874236ae6dbf6bf334d324fe172f30a1d780` (6,990 tests per OS). [#189 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41572002858) passed on head `7ca4f9eb82c865236e20e0f23d4a4801c275f7ff`, tree `32b484eea53888d5d6e58002c5f82740bfffe22f` (7,473 tests per OS; 100% new-module lines/functions). Each passed Linux/macOS full checks, unchanged coverage/seeded execution, 38 installed-package scenarios/types/CLI/editor/global install, 98 checkout plus 98 exact-extracted-archive Chromium cases, title checks and release/coverage uploads. Exact head/tree RELEASE_VALIDATED manifests and artifact hashes are in each PR.

Both merge orders produce combined local tree `b780923ea82567c51791b8227f17374934012254`, which passed full `bun run check`: 7,472 tests plus the existing local Python environment skip, unchanged coverage/seeded runs and all 38 package scenarios. Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents stay open; #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #191/#192

PR #191 verifies raw numeric scanner preservation, native ASTs/context rejection and installed consumer types. PR #192 adds actual installed-browser bundle acceptance alongside exact package/static artifact checks, including input/WAIT Stop, stale callbacks, repeated runs, graphics/keyboard and draft round trips. These engineering checks do not constitute historical game acceptance; every first-game support row and all 108 corpus dispositions remain required.

Main is `e7499599e2525274c99eb1cb175e594c8c1399cf`, containing #188 (`b20b0b1f3387ffca7f2e4e04b53ff742821d3507`) and #189 (that main commit). New #191/#192 are independently based on main, change no common paths and remain unmerged.

[#191 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41971108250) passed on head `47c19a98d6e01ba405930157b37d4d8af0dffd15`, tree `d88cf0bfda30b3fbc195685e91e11134e6631aa5`: 7,877 tests and 98 checkout plus 98 exact-extracted-archive Chromium cases per OS, with 100% scanner/classifier lines/functions. [#192 final CI](https://github.com/jesselpalmer/BASIC/actions/runs/41972273518) passed on head `07b136a23da55975af99d7846364590f357809b9`, tree `e7801cf61b7cb8b8676eb72708867a63ed20c423`: 7,473 tests, eight public embedding scenarios in ESM/CommonJS, and 99 checkout plus 99 exact-archive Chromium cases per OS. Both include unchanged coverage floors/seeded execution, 38 installed-package scenarios/public types/CLI/editor/global install, title checks and release/coverage uploads. All final RELEASE_VALIDATED manifests match their exact heads/trees; artifact hashes are recorded in each PR. The browser bundle is built from the exact selected package artifact.

Both merge orders produce combined local tree `77335940d7fc39e5fe17ef542f046a60a30dac37`, which passes the full gate: 7,876 tests plus the existing local Python environment skip, unchanged coverage/seeded runs, all 38 package scenarios and eight embedding consumer scenarios with physical/symlink path checks. Native remains the only executable language profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open and #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #193/#194

PR #194 extends the installed ESM/CommonJS and actual Chromium embedding consumer with supplied native MA2 rejection, pre-effect host ordering and atomic program replacement. PR #193 independently verifies exact numeric injection. Full-gate tests and exact-archive acceptance verify these engineering prerequisites; they do not certify historical games or replace any first-game support row or corpus disposition.

Main is `b772f03af1edb2cfba3293271113221698eceff2`, containing merged #191 (`1a714a62c561cfec5fa50ea38ebd2238b601df56`) and #192 (that main commit); #190 is closed. New [#193](https://github.com/jesselpalmer/BASIC/pull/193) and [#194](https://github.com/jesselpalmer/BASIC/pull/194) are independently based on main and change no common paths.

[#193 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41977070847) passes on head `0254282c391c795b2481958260728c540600021d`, tree `1e420340dd6c5532900856ec9aec071ce0d502e1`: all 7,954 tests and eight embedding scenarios. [#194 CI](https://github.com/jesselpalmer/BASIC/actions/runs/41977481775) passes on head `2488cb20df9ad2df6c90636fb8f9b35d3a37745b`, tree `12a6c781f7b8d6d95a55b694f0ccd1706e1ee419`: all 8,279 tests and nine embedding scenarios. Each Linux/macOS job includes coverage and seeded runs, unchanged coverage floors (new/touched runtime modules have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict consumer types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser embedding is bundled from the exact selected package artifact. All final RELEASE_VALIDATED manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in each PR.

Both merge orders, including the published heads, produce combined tree `a5dded3ebbc5ee9afce7533721a19c1360c962e7`. Its full local gate passes 8,355 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and nine embedding scenarios in ESM/CommonJS. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #195/#196

PR #195 adds the tenth installed ESM/CommonJS and actual Chromium embedding consumer scenario, proving the expression-conformance entry stays private and historical Program selection remains rejected. #196 independently checks canonical value/operation binding against existing machine captures. Combined source → parser → literal → value → INT/event composition and the full gate pass. These are engineering prerequisites, not historical-game acceptance or new machine captures.

Main is `874230ca7dc72284a2b6236da55140abb7dc1954`, containing merged #193 (`69bf2910e545b1d55a9de564cddca7bbfecdd6f4`) and #194 (that main commit). New [#195](https://github.com/jesselpalmer/BASIC/pull/195) and [#196](https://github.com/jesselpalmer/BASIC/pull/196) are independently based on main, with no changed-path overlap.

[#195 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42150657881) passes on head `e60b4e132efc521e27592860d1fd137158920667`, tree `9c6456f1d7de35c1e409cde8b629a7baf2f7e80a`: all 8,758 tests and ten embedding scenarios. [#196 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42150806894) passes on head `9ec8410fb4d0b3c666d8bad804a990c4ccb3b345`, tree `5d1cb8ff557927862c195429adb9b18f980ef33e`: all 12,574 tests and nine embedding scenarios. Each Linux/macOS job includes coverage and seeded runs, unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match their exact heads/trees; release/coverage uploads and title checks are green. Per-artifact hashes are recorded in the PRs.

Both merge orders, including the published heads, produce combined tree `d2f5339bdfa8a99b9c6de20df9adf82868e7ebb0`. Its full local gate passes 12,975 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and ten embedding scenarios in ESM/CommonJS. A direct composition check also passes shared parser → literal → MA2 INT and division-event binding. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents stay open; #109 remains **NOT READY**.

## Previous delivery checkpoint — PRs #197/#198

PR #198 extends installed ESM/CommonJS and actual Chromium consumer acceptance with native callback array-owner replacement and private constant-entry rejection. The shared driver preserves native arity/error timing, callback order and live state ownership. #197 independently verifies exact conversion facts and unchanged native fractional-index rejection. Full combined checks and source → constant evaluation → signed-word composition pass; these remain prerequisites, not historical gameplay certification.

Main is `3b6d275a7ebc9f34681e835107ae4de433b5e4d1`, containing merged #195 (`d3fba52f4bd410cf85b26317f486af95a4829a80`) and #196 (that main commit). New [#197](https://github.com/jesselpalmer/BASIC/pull/197) and [#198](https://github.com/jesselpalmer/BASIC/pull/198) are independently based on main with no changed-path overlap.

[#197 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42161254450) passes on head `0be94842dfc9bd03d2686db1a977f387d565a922`, tree `f559ac2371cda78bf5b4ce6ed5705d8a7ef4f3f1`: all 13,012 tests and ten embedding scenarios. [#198 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42161531598) passes on head `98090947e41cad1d8131fc8da9f6b66f53476213`, tree `4f708c412c0649bc906bbe2affc05f40bd435532`: all 13,405 tests and eleven embedding scenarios. Each Linux/macOS job includes coverage and seeded runs with unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in each PR.

Both merge orders, including the published heads, produce combined tree `cc9f25a958483a561d6aad0902fa3a50dcefcaaf`. Its full local gate passes 13,440 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and eleven embedding scenarios in ESM/CommonJS. A direct composition check passes shared parser/evaluator → immutable words → mathematical signed-word facts. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #199/#200

PR #199 adds the twelfth installed ESM/CommonJS and actual Chromium embedding scenario, verifying native scalar arithmetic, undefined names, detached snapshots and private conformance exports. #200 adds installed/browser/type guards for the private relation binding and reuses the same native relation switch. Full combined checks and a scalar-storage → word evaluation → exact relation/event-rollback composition pass. Remaining full historical program/game acceptance stays gated.

Main is `90e522cbd19a6823136952bb158ef5f6f1f0e8a6`, containing merged #197 (`b07bead34338b95bf90f5c09ccf621538c90da23`) and #198 (that main commit). New [#199](https://github.com/jesselpalmer/BASIC/pull/199) and [#200](https://github.com/jesselpalmer/BASIC/pull/200) are independently based on main with no changed-path overlap.

[#199 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42163462935) passes on head `89f3ffa0ee734d463b3e819e3f615980b67c73b6`, tree `f74dc4a4fbacccf4d83696283065c227000ca463`: all 13,841 tests and twelve embedding scenarios. [#200 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42163631827) passes on head `02727ad5bd79530341ac979f3ac5b2947068d830`, tree `99dd547dfbd61f8c5c3e628e087d8aef53e986e1`: all 14,199 tests and eleven embedding scenarios. Each Linux/macOS job includes coverage and seeded runs with unchanged floors (new/touched runtime owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, strict public types, CLI/editor/global install, plus 99 checkout and 99 exact-extracted-archive Chromium cases per OS. Browser consumers bundle the exact selected package artifact. Both OS manifests match the exact heads/trees; release/coverage uploads and title checks are green. Artifact hashes are recorded in the PRs.

Both merge orders, including the published heads, produce combined tree `73a8d2d6360e56d72740ff9033a5cdecdb766830`. Its full local gate passes 14,598 tests plus the existing local Python-availability skip, unchanged coverage floors/seeded order, all 38 installed library cases and twelve embedding scenarios in ESM/CommonJS. A direct composition check passes stored scalars → word evaluation → exact relations and event rollback. Both PRs remain open and unmerged.

Native remains the only executable profile. All 108 corpus files remain required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Compatibility parents remain open; #109 stays **NOT READY**.

## Previous delivery checkpoint — PRs #201/#202

PR #201 adds the thirteenth installed ESM/CommonJS and actual Chromium embedding scenario, guarding private comparison parsing and native IF callback order. #202 guards its private array factory and native array initialization/reruns in installed/browser/type consumers. Full combined checks and comparison-source → scalar words → array cell/arithmetic/event composition pass; complete historical statement/game acceptance remains required.

Main is `a14bca7a143a8032eceeab21c529aa1bd5645590`, containing merged #199 (`3a23ab529182a7a2f6ee6a2f72234a3b0fd07244`) and #200 (that main commit). New [#201](https://github.com/jesselpalmer/BASIC/pull/201) and [#202](https://github.com/jesselpalmer/BASIC/pull/202) are independently based on main with no changed-path overlap.

[#201 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42166686486) validates head `786a4be0074762189c4d932e302f54297bf7f13d`, tree `891db2bf39cf0ce23b4bf05f6277f60d56a6c490`: 15,359 tests and thirteen embedding scenarios. [#202 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42166863472) validates head `6f1c17452bbdec31f2e6c200971dedd39dba3b19`, tree `ea64068beb699b3a37ae82decb749a00ef755624`: 14,604 tests and twelve embedding scenarios. Each Linux/macOS job runs coverage/seeded tests with unchanged floors (new/touched owners have 100% lines/functions), 38 installed library cases in ESM/CommonJS, public types, CLI/editor/global install, and 99 checkout plus 99 exact-archive Chromium cases. Browser consumers bundle the exact selected package artifact. Final manifests match each head/tree; release/coverage uploads and title checks are recorded in the PRs with artifact hashes.

Both merge orders, including published heads, produce tree `01b9428c4c12cc4ce92d788ef54a450ce579d8eb`. Its full local gate passes 15,363 tests plus the existing Python-availability skip, unchanged coverage floors/seeded order, 38 installed library cases and thirteen embedding scenarios in ESM/CommonJS. Direct composition passes comparison source → scalar words → array cell/arithmetic and event identity. Both PRs remain unmerged.

Native remains the only executable profile. All 108 corpus files stay required: 3 reviewed source differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Parents remain open; #109 is **NOT READY**.

## Current delivery checkpoint — PRs #203/#204

PR #204 adds a fourteenth installed/browser embedding scenario for privacy, native namespaces/nested indices and reruns. #203 adds installed/browser/type private-helper and native Unicode/exact-equality guards. Combined checks pass; complete historical statement/game/lifecycle acceptance remains required.

Main `6c881d71c50fd61661bd85584b70ff465c2019d2` contains merged #201 (`a2fb3afa006f1c1c5ab07e50e70c2b93e50c2d26`) and #202 (main). New [#203](https://github.com/jesselpalmer/BASIC/pull/203) and [#204](https://github.com/jesselpalmer/BASIC/pull/204) independently target main with no changed-path overlap.

[#203 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42169399887) validates head `d16735e6f537158824d806deaaa5143eb7d5ef2f`, tree `5d16351ce5b0431817fc109c1ae18b5a051945bf`: 15,369 tests, thirteen embedding scenarios. [#204 CI](https://github.com/jesselpalmer/BASIC/actions/runs/42169562191) validates head `1019f76146b05defd23817e3686c97c08b5e1244`, tree `a7fddcbf437784e3f759fc56ca2c0a986dcedf06`: 15,764 tests, fourteen embedding scenarios. Each Linux/macOS job passes coverage/seeded runs with unchanged floors (touched core owners 100% lines/functions), 38 installed ESM/CommonJS library cases, public types/CLI/editor/global install, and 99 checkout plus99 exact-archive Chromium cases. Browser bundles consume the selected package artifact. Final manifests/uploads and artifact hashes are retained in each PR.

Both merge orders, including published heads, produce tree `4fdea63fddd2082a8f98465c7502f746438482bb`. Its full local gate passes 15,768 tests plus the existing Python-availability skip, unchanged floors/seeded order, 38 installed library cases and fourteen embedding scenarios. Both PRs remain unmerged.

Native remains the only executable profile. All108 files stay required: 3 reviewed differences/105 unresolved; 1 printed-system identification/107 unverified; 2 partial native paths/106 not run; **zero certified historical passes**. Parents stay open; #109 is **NOT READY**.

## Outcome

Gate 1.0 on behavioral classic-game compatibility across all distributions.

## Dependencies

#115, #116, all required feature/host tickets, existing #57/#58/#59; final evidence rolls into #109.

## Source evidence

The current native tests/Pong validation do not exercise imported classic sources. Baseline all 108 first-rejections is only an inventory. [1check.bas](https://github.com/maurymarkowitz/101-BASIC-Computer-Games/blob/45f75052be3f436f2e575f58d4aa611484268227/1check.bas) is the first vertical slice; different dialects need additional complete end-to-end scenarios.

## Acceptance criteria

- [ ] Build a pinned, provenance-recorded corpus harness with no online floating-main dependency, deterministic input/random/clock, instruction/output/allocation limits and useful failure artifacts. Preserve exact source bytes and reviewed correction patches separately.
- [ ] For every verified correct listing, record meaningful behavior (not only parsing or first prompt): game moves/state/score/result, retry, replay and required data/file/function paths. Use manual/scan/reference-system evidence and independent expected-state assertions.
- [ ] The scan-verified, minimally corrected 1CHECK fixture (line 74 comma after B$, preserved alongside raw transcription) must show 1..64 in eight aligned rows,48 initial pieces and16 empty center squares; illegal1->2 preserves48, legal1->19 removes midpoint10 and leaves47, quit0 reports counters; invalid retry answer reprompts and YES resets48. Also distinguish the original program's invalid-input bugs from runtime bounds errors.
- [ ] Run compatible source through direct library, installed ESM/CommonJS, file CLI and stored terminal LOAD/RUN/SAVE round trips, and actual browser import/run/input/export/reload on extracted static distribution; verify the selected profile travels by its documented mechanism.
- [ ] Add cross-feature, malformed-source and resource/lifecycle tests: no blanket skips or accepting typos, coherent diagnostics, cancellation during busy computation/input/timing/files, fresh runtime state and source preservation.
- [ ] Maintain a full 108-file ledger: unchanged verified passes, evidenced original/OCR defects, verified corrected passes and unresolved external/dialect blockers. Missing BUNNY/SNOOPY code is accounted for separately. Counts are reconciled, never used as sole readiness.
- [ ] Require fresh green Linux/macOS checks and exact newly packed package/static archives, hashes, candidate SHA and retained logs. Independent review confirms no unsupported valid files silently excluded before #109 can say READY.

## Quality and compatibility requirements

Research/design #115 and #116 precede implementation. Cite the target dialect/manual section for each accepted form and semantic rule; use the corpus's verified dialect mapping, not a permissive union. Preserve current native behavior via the selected compatibility boundary. Keep one shared parser/runtime with host-owned effects; preserve original source/locations, immutable prepared programs, budgets, stepping, cancellation and clean reruns. Add negative malformed-source tests as well as positive behavior tests. Feature tests, installed consumers and relevant browser cases must pass on Linux/macOS; no skipped corpus failures or count-only completion.

Refs #114 and release blocker #109. This issue is planning only until its dependencies are settled.

### 1CHECK primary scan evidence

[Book scan, printed page 164 / leaf n165](https://archive.org/details/101basiccomputer0000davi/page/n165/mode/1up). Visually inspected the listing; the available scan is cataloged1974 while upstream describes a1975 third printing, so record edition provenance rather than treating the metadata as identical. Downloaded PDF SHA-256: `c8a7549a649e9b6a99d80cab9ec8e3d78f6a872f127daee617fe692c40b92867`. Original code is not reproduced wholesale here.


## Delivered progress

- [#131](https://github.com/jesselpalmer/BASIC/pull/131) merged as `de54dbd5bc203785f5463c1726e304ed14ab8d85`: full 108-file structured ledger, inspected first-game source records and shared dialect/source-context design.
- [#132](https://github.com/jesselpalmer/BASIC/pull/132) merged as `e56b334d9e91ec343160b7be8b930bd2e9938d7f`: native optional LET and contextual GO TO, preserving GO as a variable, exact source text/positions and existing execution rules.
- [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/40164063799): green; 1004 passing Bun tests, 21 installed ESM/CommonJS scenarios, local/global CLI, 45 actual Chromium cases against both checkout and exact extracted static artifacts. Exact PR head `b748d9f5f3dfc7151c4f71c29eb4636fd6876fce`, tree `155427283d030ea6a67572246bb31399c17f571a`; merged main has the identical tree. Artifact validation is engineering evidence, not release approval.
- The unchanged pinned 23MTCH source now executes its loss/replay path under native rules in direct/installed library and browser tests. Its RND(0) branch and historical formatting remain explicit blockers. No full historical-game compatibility pass is recorded.

Remaining criteria in this issue stay open. #109 remains **Readiness: NOT READY**. All 108 files remain required dispositions; neither partial grammar support nor passing tests closes the corpus gate.

## Native language-context foundation

[#133](https://github.com/jesselpalmer/BASIC/pull/133) merged as `c3c9a0b48f6dacb900576e0f82d85ec591513029`. New Programs/Lines explicitly carry native context; parser/validation options and immutable Basic/Evaluator selections share it. Legacy trees without metadata stay native. Unsupported root/Line/options metadata fails before BASIC effects, including unreachable lines; a rejected replacement retains the previous runnable snapshot. Immediate options cannot change the instance selection.

[Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/40165167915) validated exact PR head `66ceb1e4faae670a100098cafa2e938566d7a35a`, tree `2642c70d3bb8dc16218c2366a38b65309eafb6e7`; merged main has the identical tree. Both platforms passed 1016 Bun tests, coverage/shuffled execution, 22 shared installed ESM/CommonJS scenarios, positive/negative public types, local/global CLI and 45 Chromium cases against checkout and exact extracted static artifacts. The RELEASE_VALIDATED manifests in both job logs were checked against that exact head/tree.

Only native is enabled. Historical semantic policies, terminal/browser document profile persistence and the full real-game battery remain open. No additional full historical-game pass is claimed. #109 remains **Readiness: NOT READY**; no publication/tag/release or readiness watch was started.

Engineering artifact evidence for #133 (not approved 1.0 publication bytes):

| CI platform | Artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| linux/x64 | `node-basic-lang-1.0.0.tgz` | 155936 | `9572ee0d78460332a3c1855c934279344f94065ad0f20db1ecb0032df7b51860` |
| linux/x64 | `BASIC-playground-1.0.0.tar.gz` | 70407 | `1f32137b9f2facd6e9516fc5bd2e7dc0bea1a797c30c4ded6535f3653da5ff18` |
| darwin/arm64 | `node-basic-lang-1.0.0.tgz` | 156256 | `dee2df18e3a5f7e8609c4036229f09c620494eef7221a2cfa85110555ecdb535` |
| darwin/arm64 | `BASIC-playground-1.0.0.tar.gz` | 70295 | `a102216e983d0d767f21ec2bc38467ef9ab97c21485f7fc983880cbede1b45b1` |

Retained logs: [Linux](https://github.com/jesselpalmer/BASIC/actions/runs/40165167915/job/121084614183), [macOS](https://github.com/jesselpalmer/BASIC/actions/runs/40165167915/job/121084614419). Platform archives are independently built/validated; do not assume identical bytes. A final release candidate still requires the complete compatibility gates and a fresh approval.

## Explicit native array slice delivered

[#134](https://github.com/jesselpalmer/BASIC/pull/134) merged as `88683e0ab772fc910fdca5615f325b944d04f850`. Contextual DIM now declares one/two-dimensional numeric/string arrays with inclusive zero bounds, separate scalar namespaces, indexed reads/assignments and fresh run-owned storage. Existing DIM scalar/array names remain usable. Whole-program declaration/rank/resource validation precedes effects/allocation, and failed replacements retain the previous prepared snapshot. Basic.arrays / Evaluator.snapshotArrays expose frozen detached prefixes with explicit limits/truncation; Evaluator.reset accepts declarations. The provisional closed AST/type additions are documented before the 1.0 freeze.

An independently authored board fixture proves 48 initial pieces, an illegal 1-to-2 move leaving 48, the legal 1-to-19 jump clearing 1/10 and setting 19 with 47 remaining, and clean reruns. It runs through direct/installed ESM/CommonJS, installed CLI and actual browser/static paths. This is not the raw/corrected 1CHECK listing or a full historical-game pass; its ledger behavior status remains not-run.

[Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/40167719880) validated exact PR head `86360d505fc8e57baa735c27181ff9538beb8111`, tree `486667863126cff84e6d457c193bf98260233572`; merged main has the identical tree. Both platforms passed 1061 Bun tests, coverage/shuffled execution, 23 shared installed library cases, positive/negative public types, local/global CLI and 48 Chromium cases against checkout and exact extracted static archives. Both RELEASE_VALIDATED manifests were checked against the exact head/tree.

Native explicitly requires DIM and safe integer indices, rejects duplicate declarations and caps allocations (65,536 cells/array; 262,144/program; 256 arrays). These deliberate native choices do not settle historical implicit dimensions, fractional conversion or duplicate-DIM policy. Historical profiles, integer/square-bracket/MAT arrays, indexed INPUT, 1CHECK PRINT USING/adjacent output/historical formatting and full corpus acceptance remain open. Browser inspection is currently scalar-only; bounded array observations are a library API. #109 remains **Readiness: NOT READY**, with no additional full historical-game pass or publication/tag/release.

Engineering artifacts for #134 only; not approved 1.0 publication bytes:

| CI platform | Artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| linux/x64 | `node-basic-lang-1.0.0.tgz` | 162272 | `d246205f3b0cec7929bddd691fb7c67d6b12cc6c40c7db414e860e71ec0a1ccf` |
| linux/x64 | `BASIC-playground-1.0.0.tar.gz` | 75630 | `f8ab240185f94cdb0252d82d9b4cbc9a5b429244087973d87410c6782071a2e4` |
| darwin/arm64 | `node-basic-lang-1.0.0.tgz` | 162487 | `b57b8d3e5c40a6dba1a83907140573e2e6d5fcebc2330a831e70253fc286d986` |
| darwin/arm64 | `BASIC-playground-1.0.0.tar.gz` | 75552 | `02583d3834387517b65a1d48ee02fc3d5938cd7cf13835035969bf9f960b1b00` |

Retained logs: [Linux](https://github.com/jesselpalmer/BASIC/actions/runs/40167719880/job/121092070581), [macOS](https://github.com/jesselpalmer/BASIC/actions/runs/40167719880/job/121092070352). Each archive was independently built and validated; final publication still requires complete compatibility gates and a new exact approved candidate.

## Native output delivery — separate PRs #135 and #136

- [#135](https://github.com/jesselpalmer/BASIC/pull/135) merged as `3c64c08536780d35c3f4026eaf2aa87af836a7ae`: string-involved PRINT adjacency preserves greedy expressions, real semicolon spans, native numeric spelling and USING names. [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/40169923890) validated exact head `58bb23d46f2b87a688825f05c1eff019307bb2eb`, tree `5f9052764d753296b56c87735959822e8f413ec1`:1101 Bun tests,24 installed cases and50 browser cases with exact artifacts.
- [#136](https://github.com/jesselpalmer/BASIC/pull/136) merged as `9e7a11d893b3f8211b47e334b1d763ff3e2f1ebb`: contextual native PRINT USING, bounded safe-integer # fields in one exact-count pass, source/AST limits before effects and atomic writes. USING scalar/array meanings remain intact. [Linux/macOS CI](https://github.com/jesselpalmer/BASIC/actions/runs/40171073501) validated exact head `2dfa4277150f7baacb33fd19834e65399e5d84aa`, tree `25d8d373f486a2028dbaa90b2c54c2e06060d028`; merged main has the identical tree. Both platforms passed1185 Bun tests, coverage/shuffled execution,26 direct/installed ESM/CommonJS scenarios, positive/negative public types, local/global CLI and52 Chromium cases against checkout and exact extracted static archives.

Independent agents implemented isolated slices and reviewed the source/contract, formatter and integration. Existing PRINT AST comparisons stayed identical. Review caught an immediate-API list-cap gap; it was fixed before publication, with sync/async zero-host-effect and recovery tests. An initial macOS artifact upload alone failed with ECONNRESET after all tests/artifact validation passed; retry completed green, including uploads, without changing code.

The raw 1CHECK fixture retains SHA-256 `87b6ea841f5e6ff0af0718ef3f4f905c992535455afd5d3400b1e2946c30d04f` and is still rejected before effects at line74. The separately reviewed corrected fixture changes exactly one byte (semicolon after B$→comma), SHA-256 `952576cf60f86f5548a880e261e06f6e7353ad607827596d83e028ddbe7ece94`. No source rewriting/game-specific rule was added.

Its complete scripted **corrected native path** now runs through direct/installed library, installed CLI and actual browser/static: all8 numbering rows twice, all24 opening/moved/replay piece rows,48 initial pieces, illegal1-to2 unchanged, legal1-to19 clearing1/10 and setting19 (47 pieces), zero summary, MAYBE retry, YES restoring48, NO normal END999, fresh reruns and preserved source/previous snapshot after raw rejection. Export/reload/Stop preserve corrected bytes. Historical unformatted numeric spacing still differs and its original dialect is uncertified: this is not a full historical-game pass. All108 files retain required dispositions; no full-corpus gate is closed.

Remaining historical padding/zones/TAB, broader formatted fields/rounding/overflow/reuse, profile rules and final corpus/distribution acceptance stay open. #109 remains **Readiness: NOT READY**, with no approved expanded-scope release candidate and no publication/tag/release or readiness watch.

Engineering artifact evidence for #136; not approved 1.0 publication bytes:

| CI platform | Artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| linux/x64 | `node-basic-lang-1.0.0.tgz` | 169984 | `7f54cf1a6b220f24bdc58bcf2529fe7e52b9823a3201fc037023a320b54f5258` |
| linux/x64 | `BASIC-playground-1.0.0.tar.gz` | 79300 | `b6b498ef0ed652ee00aa152b4db064ba02432a9b8b91fdda4b01a1caa1154c14` |
| darwin/arm64 | `node-basic-lang-1.0.0.tgz` | 170086 | `0baeee6e8181c0005bcfb9c68c7bd49fa84520ef741a4e86aa5e7acf4d1cb666` |
| darwin/arm64 | `BASIC-playground-1.0.0.tar.gz` | 79194 | `09c4489b363def6d35c8947dd7f1f6e3f31eff7527e178a35ec7c79d77107499` |

Retained successful logs: [Linux](https://github.com/jesselpalmer/BASIC/actions/runs/40171073501/job/121102249566), [macOS](https://github.com/jesselpalmer/BASIC/actions/runs/40171073501/job/121102248421). Both RELEASE_VALIDATED manifests matched the exact PR head/tree above. Platform archives were independently built/validated; final release still needs complete compatibility gates and a fresh exact approved candidate.

## Fail-closed validation and integrated prerequisite evidence — PRs #145–#148

[PR #148](https://github.com/jesselpalmer/BASIC/pull/148) is open, not merged. Two local bare archive checks exited zero after partial browser progress (78/33 cases), without RELEASE_VALIDATED; a later bare checkout run similarly stopped after 33 cases. Those runs are incomplete evidence, not passes. The same exact artifacts passed under independently complete verification. Sixty reduced spawn/ref/GC/node-child probes did not establish the underlying exit cause; no interpreter failure or proven Bun root cause is claimed.

The fix adds a release-lifetime exit listener that rejects unfinished validation, including explicit zero exits/cleared statuses, while preserving genuine prior/new failures and detaching on settlement. It also requires a fresh Playwright onEnd certificate outside the served static root: passed full-run status, no global errors, a positive unique plan and exactly one passed result per success-expected test. Missing/truncated/partial/failed/skipped/retried/interrupted evidence rejects even if the browser child exits zero. Counts come from the actual plan. Exact artifacts are revalidated and RELEASE_VALIDATED prints only after cleanup.

Added 31 regressions, including real child processes for false zero/certificate cases and preserved status 1/2, pending/explicit exits, rejection and cleanup sequencing. Review caught and fixed an ambiguous failure sentinel; lifecycle listener rereview is clean. A real Playwright reporter smoke and standard local exact-archive run passed all 79 cases with the new certificate. Local full checks passed 1548 plus one existing CI-only environment skip and 33 installed-library cases.

Exact PR head `b875e11cbf6d6695ed599231d3e6d601f1610e62`, tree `5ff7dba3880d2c7f9024cafa992754c36466f6e5`, matches the reviewed local tree. [Linux/macOS CI run 40632098029](https://github.com/jesselpalmer/BASIC/actions/runs/40632098029) passed on each platform: 1549 tests, 33 source/installed ESM/CommonJS scenarios, public types/CLI/editor/global install, 79 checkout plus 79 exact-archive browser cases with the required onEnd certificate, conventional title and artifact uploads. Both manifests identify this exact head/tree.

| Platform | Artifact | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| darwin | node-basic-lang-1.0.0.tgz | 208669 | `eacd2e36cc5f7e39043b7a95df7bc1b040d098d3039983feca5d32c3e91d5319` |
| darwin | BASIC-playground-1.0.0.tar.gz | 96063 | `e74c794715a03b919580df34ff59323a0d0feceaedcf0658a6c509c0b9a1d271` |
| linux | node-basic-lang-1.0.0.tgz | 208586 | `7def4568456114b8481a41d2d866f78d91477b49ae555fcc975b9492be910324` |
| linux | BASIC-playground-1.0.0.tar.gz | 96171 | `3bfbbec4aabe6a445de5d4fe26b0a9aaff1ad486aacb400ab897e8ab84cb6b3f` |

### Combined candidate, still awaiting merge approval

Four independent PRs combine cleanly from main `55657a80184738ef763e1e455043103bddb5d2ac`: [#145 numeric/integer contracts](https://github.com/jesselpalmer/BASIC/pull/145), [#146 native intrinsic signatures](https://github.com/jesselpalmer/BASIC/pull/146), [#147 internal historical scanner](https://github.com/jesselpalmer/BASIC/pull/147), and [#148 release completion](https://github.com/jesselpalmer/BASIC/pull/148). Exact feature/CI/hash evidence is recorded in #124/#123/#117 and above. All four PRs are open and mergeable; none has merged in this batch.

Reviewed combined local commit `a33ec01b5cc89859cacc5e5942ce665504625cb5`, tree `db5fea56d8a8e81c2f2ea175f8d4965bf2ee3526`, passed full checks: 1671 tests plus the existing non-CI environment skip, 34 shared direct/installed scenarios, public types/CLI/editor/global install, 79 checkout and 79 exact-archive browser cases. The checkout used the Node Playwright runner and the actual new onEnd certificate; the standard combined Bun release checker passed extracted acceptance and emitted RELEASE_VALIDATED after cleanup. Existing coverage floors are unchanged, and dependencies/version/lockfile are unchanged.

The combined local manifest binds that tree/commit to these exact validated bytes (distinct from isolated PR CI artifacts):

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| node-basic-lang-1.0.0.tgz | 223674 | `933bc84d5a17bf97e4cca2de148bfda18ba7d024cf6f37d89363133ef92e2528` |
| BASIC-playground-1.0.0.tar.gz | 100441 | `f775ef2be9cbbb829a8cbd62dabdb410de33a8268c56eb48c98ca624dc54cb52` |

This is engineering prerequisite evidence, not a historical profile, whole-game/corpus pass or approved release candidate. Public Dialect remains native; integer/numeric/profile/runtime policies and all 108 corpus dispositions remain open. The earlier local exit cause remains unproven; the checker now fails closed instead of certifying incomplete work. **#109 remains Readiness: NOT READY, approved candidate none.** No npm publication, tag, GitHub release or readiness watch.


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
