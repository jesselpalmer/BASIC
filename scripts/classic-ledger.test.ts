import {describe, expect, it} from 'bun:test';
import {cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateClassicLedger} from './classic-ledger.ts';

type ObjectValue = Record<string, unknown>;
type Ledger = ObjectValue & {entries: ObjectValue[]};

const sourceRoot = join(import.meta.dirname, '..');

function object(value: unknown): ObjectValue {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('bad fixture');
  return value as ObjectValue;
}

function ledgerFixture(check: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'basic-ledger-'));
  for (const path of [
    'docs/classic-games-ledger.json',
    'docs/classic-games-inventory.md',
    'docs/classic-source-review.md',
    'scripts/package/fixtures/arrays/board.bas',
    'scripts/package/fixtures/classic/1check-corrected.bas',
    'scripts/package/fixtures/classic/1check-raw.bas',
  ]) {
    cpSync(join(sourceRoot, path), join(root, path), {recursive: true});
  }
  try {
    check(root);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

function readLedger(root: string): Ledger {
  return JSON.parse(readFileSync(join(root, 'docs/classic-games-ledger.json'), 'utf8')) as Ledger;
}

function writeLedger(root: string, ledger: Ledger): void {
  writeFileSync(
    join(root, 'docs/classic-games-ledger.json'),
    JSON.stringify(ledger, null, 2) + '\n',
  );
}

function expectMutation(mutate: (root: string, ledger: Ledger) => void, message?: string): void {
  ledgerFixture((root) => {
    const ledger = readLedger(root);
    mutate(root, ledger);
    writeLedger(root, ledger);
    expect(() => validateClassicLedger(root)).toThrow(message);
  });
}

function firstEntry(ledger: Ledger): ObjectValue {
  const entry = ledger.entries[0];
  if (!entry) throw new Error('missing fixture entry');
  return entry;
}

function evidence(
  entry: ObjectValue,
  key: 'behaviorEvidence' | 'nativeFeatureEvidence',
): ObjectValue {
  return object(entry[key]);
}

describe('classic-game ledger validation', () => {
  it('validates the pinned ledger and returns deterministic status counts', () => {
    expect(validateClassicLedger(sourceRoot)).toEqual({
      entries: 108,
      sourceStatuses: {'reviewed-difference': 1, unresolved: 107},
      dialectStatuses: {unverified: 107, 'printed-system-identified': 1},
      behaviorStatuses: {'partial-native-path': 2, 'not-run': 106},
      fixtureFiles: 3,
    });
  });

  it('rejects schema and inventory drift', () => {
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) => void (ledger.schemaVersion = 2),
      (_root, ledger) => void (ledger.unexpected = true),
      (_root, ledger) => void (object(ledger.upstream).repository = 'other/repo'),
      (_root, ledger) => void (object(ledger.upstream).commit = '0'.repeat(40)),
      (_root, ledger) => void (object(ledger.upstream).extra = true),
      (_root, ledger) => void (ledger.nativeBaselineCommit = '1'.repeat(40)),
      (_root, ledger) => void (ledger.inventoryCount = 107),
      (_root, ledger) => void (ledger.searchIndexNotice = 'looks complete'),
      (_root, ledger) => void (ledger.missingBookListings = ['BUNNY']),
      (_root, ledger) => void (ledger.missingBookListings = ['BUNNY', 'BUNNY']),
      (_root, ledger) => void ledger.entries.pop(),
      (root) =>
        void writeFileSync(
          join(root, 'docs/classic-games-inventory.md'),
          readFileSync(join(root, 'docs/classic-games-inventory.md'), 'utf8').replace(
            '**zero parsed**',
            '**one parsed**',
          ),
        ),
      (root) =>
        void writeFileSync(
          join(root, 'docs/classic-games-inventory.md'),
          readFileSync(join(root, 'docs/classic-games-inventory.md'), 'utf8').replace(
            '87b6ea841f5e',
            '07b6ea841f5e',
          ),
        ),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });

  it('rejects duplicate, unsorted and unsafe source identities', () => {
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) => void (ledger.entries[1] = {...firstEntry(ledger)}),
      (_root, ledger) => void ledger.entries.splice(0, 2, ledger.entries[1], firstEntry(ledger)),
      (_root, ledger) => void (firstEntry(ledger).file = '../1check.bas'),
      (_root, ledger) => void (firstEntry(ledger).file = '1CHECK.bas'),
      (_root, ledger) => void (firstEntry(ledger).sha256 = 'ABC'),
      (_root, ledger) => void (ledger.entries[1].sha256 = firstEntry(ledger).sha256),
      (_root, ledger) => void (firstEntry(ledger).bytes = 0),
      (_root, ledger) => void (firstEntry(ledger).physicalLines = 0),
      (_root, ledger) => void (firstEntry(ledger).role = 'ignored'),
      (_root, ledger) => void (firstEntry(ledger).extra = true),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });

  it('rejects unsupported statuses and pass claims without evidence', () => {
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) => void (firstEntry(ledger).sourceStatus = 'valid'),
      (_root, ledger) => void (firstEntry(ledger).dialectStatus = 'certified'),
      (_root, ledger) => void (firstEntry(ledger).behaviorStatus = 'pass'),
      (_root, ledger) => void (firstEntry(ledger).verifiedDialect = 'basic-plus'),
      (_root, ledger) => void delete firstEntry(ledger).reviewRecord,
      (_root, ledger) => void delete firstEntry(ledger).behaviorEvidence,
      (_root, ledger) =>
        void (ledger.entries[2].behaviorEvidence = evidence(
          firstEntry(ledger),
          'behaviorEvidence',
        )),
      (_root, ledger) => void (firstEntry(ledger).blockers = ['source-certification']),
      (_root, ledger) =>
        void (firstEntry(ledger).blockers = [
          'source-certification',
          'source-certification',
          'dialect-certification',
          'required-features',
          'behavioral-acceptance',
        ]),
      (_root, ledger) => void delete ledger.entries[1].printedSystem,
      (_root, ledger) => void (ledger.entries[2].printedSystem = 'imaginary'),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });

  it('rejects missing, escaping and inconsistent evidence', () => {
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) =>
        void (firstEntry(ledger).reviewRecord = 'classic-source-review.md#missing'),
      (_root, ledger) => void (firstEntry(ledger).reviewRecord = '../outside.md#x'),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').oracle =
          'classic-source-review.md#missing'),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').rawFixture = '../raw.bas'),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').correctedFixture = 'missing.bas'),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').correctedSha256 = '0'.repeat(64)),
      (_root, ledger) => void delete evidence(firstEntry(ledger), 'behaviorEvidence').rawResult,
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').fixture = evidence(
          firstEntry(ledger),
          'behaviorEvidence',
        ).rawFixture),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').surfaces = ['direct-library']),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').surfaces = [
          'direct-library',
          'installed-esm',
          'installed-commonjs',
          'installed-cli',
          'not-real',
        ]),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').surfaces = [
          'direct-library',
          'direct-library',
          'installed-commonjs',
          'installed-cli',
          'browser-static',
        ]),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').remainingBlockers = []),
      (root) => {
        const path = join(root, 'scripts/package/fixtures/arrays/board.bas');
        rmSync(path);
        symlinkSync('../../../docs/classic-source-review.md', path);
      },
      (root) =>
        void writeFileSync(
          join(root, 'scripts/package/fixtures/arrays/board.bas'),
          readFileSync(join(root, 'scripts/package/fixtures/arrays/board.bas'), 'utf8') +
            '10 END\n',
        ),
      (root) =>
        void writeFileSync(
          join(root, 'scripts/package/fixtures/classic/1check-corrected.bas'),
          readFileSync(join(root, 'scripts/package/fixtures/classic/1check-raw.bas')),
        ),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });

  it('rejects malformed diagnostics, features and printed evidence', () => {
    const diagnostic = (ledger: Ledger) => object(firstEntry(ledger).firstNativeDiagnostic);
    const features = (ledger: Ledger) => object(firstEntry(ledger).observedFeatureLabels);
    const book = (ledger: Ledger) => object(firstEntry(ledger).bookReference);
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) => void (diagnostic(ledger).code = 'bad-code'),
      (_root, ledger) => void (diagnostic(ledger).line = 999),
      (_root, ledger) => void (diagnostic(ledger).column = 0),
      (_root, ledger) => void (diagnostic(ledger).offset = -1),
      (_root, ledger) => void (diagnostic(ledger).extra = true),
      (_root, ledger) => void (features(ledger)['Bad Label'] = [1]),
      (_root, ledger) => void (features(ledger).arrays = [68, 68]),
      (_root, ledger) => void (features(ledger).arrays = []),
      (_root, ledger) => void (features(ledger).arrays = [100_000]),
      (_root, ledger) => void (book(ledger).referencePage = 0),
      (_root, ledger) => void (book(ledger).dialectHint = 1),
      (_root, ledger) => void (book(ledger).evidence = 'certified'),
      (_root, ledger) => void (book(ledger).extra = true),
      (root) =>
        void writeFileSync(
          join(root, 'docs/classic-source-review.md'),
          readFileSync(join(root, 'docs/classic-source-review.md'), 'utf8').replace(
            'No file has a complete historical compatibility pass.',
            'Everything passes.',
          ),
        ),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });

  it('rejects unsupported or inconsistent native feature evidence', () => {
    const mutations: Array<(root: string, ledger: Ledger) => void> = [
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').kind = 'historical-pass'),
      (_root, ledger) => void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').scope = ''),
      (_root, ledger) => void delete evidence(firstEntry(ledger), 'nativeFeatureEvidence').fixture,
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'nativeFeatureEvidence').unexpected = true),
      (_root, ledger) => void (evidence(firstEntry(ledger), 'behaviorEvidence').scope = ''),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').remainingBlockers = []),
      (_root, ledger) =>
        void (evidence(firstEntry(ledger), 'behaviorEvidence').oracle = 'not-a-reference'),
    ];
    for (const mutate of mutations) expectMutation(mutate);
  });
});
