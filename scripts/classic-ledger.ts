import {createHash} from 'node:crypto';
import {lstatSync, readFileSync, realpathSync} from 'node:fs';
import {dirname, relative, resolve, sep} from 'node:path';

const LEDGER_PATH = 'docs/classic-games-ledger.json';
const INVENTORY_PATH = 'docs/classic-games-inventory.md';
const REVIEW_PATH = 'docs/classic-source-review.md';
const UPSTREAM_REPOSITORY = 'maurymarkowitz/101-BASIC-Computer-Games';
const UPSTREAM_COMMIT = '45f75052be3f436f2e575f58d4aa611484268227';
const NATIVE_BASELINE = '201b52422edc75c518703874a459b6a83eef5726';
const INVENTORY_COUNT = 108;
const SEARCH_NOTICE =
  'Feature labels are conservative textual observations, not complete parsing, dialect certification or a guarantee that no other features are used. README dialect hints are not verified profiles.';
const REQUIRED_BLOCKERS = [
  'behavioral-acceptance',
  'dialect-certification',
  'required-features',
  'source-certification',
] as const;
const ACCEPTANCE_SURFACES = new Set([
  'browser-static',
  'direct-library',
  'installed-cli',
  'installed-commonjs',
  'installed-esm',
]);
const FIXTURE_IDENTITIES = new Map([
  [
    'scripts/package/fixtures/arrays/board.bas',
    {
      sha256: '99d6477bdf8ee5c19f3ba0c95dff565e342df00249dd9dfcd64165a4935b8a4c',
      bytes: 564,
      lines: 32,
    },
  ],
  [
    'scripts/package/fixtures/classic/1check-corrected.bas',
    {
      sha256: '952576cf60f86f5548a880e261e06f6e7353ad607827596d83e028ddbe7ece94',
      bytes: 2042,
      lines: 86,
    },
  ],
  [
    'scripts/package/fixtures/classic/1check-raw.bas',
    {
      sha256: '87b6ea841f5e6ff0af0718ef3f4f905c992535455afd5d3400b1e2946c30d04f',
      bytes: 2042,
      lines: 86,
    },
  ],
]);

type JsonRecord = Record<string, unknown>;

export interface ClassicLedgerReport {
  entries: number;
  sourceStatuses: Record<string, number>;
  dialectStatuses: Record<string, number>;
  behaviorStatuses: Record<string, number>;
  fixtureFiles: number;
}

function fail(message: string): never {
  throw new Error(`Classic ledger validation failed: ${message}`);
}

function record(value: unknown, context: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${context} must be an object`);
  }
  return value as JsonRecord;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) fail(`${context} must be an array`);
  return value;
}

function string(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${context} must be a nonempty string`);
  return value;
}

function integer(value: unknown, context: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    fail(`${context} must be an integer of at least ${minimum}`);
  }
  return value as number;
}

function exactKeys(
  value: JsonRecord,
  context: string,
  required: string[],
  optional: string[] = [],
): void {
  const permitted = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in value)) fail(`${context} is missing ${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) fail(`${context} has unsupported field ${key}`);
  }
}

function strings(value: unknown, context: string): string[] {
  const result = array(value, context).map((item, index) => string(item, `${context}[${index}]`));
  if (new Set(result).size !== result.length) fail(`${context} contains duplicates`);
  return result;
}

function requireChoice(value: unknown, context: string, choices: readonly string[]): string {
  const result = string(value, context);
  if (!choices.includes(result)) fail(`${context} has unsupported value ${JSON.stringify(result)}`);
  return result;
}

function safeFile(root: string, path: unknown, context: string): {path: string; bytes: Buffer} {
  const relativePath = string(path, context);
  if (
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    relativePath.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    fail(`${context} must be a normalized project-relative path`);
  }
  const rootReal = realpathSync(root);
  const absolute = resolve(rootReal, relativePath);
  let actual: string;
  try {
    actual = realpathSync(absolute);
  } catch {
    fail(`${context} does not exist: ${relativePath}`);
  }
  const outside = relative(rootReal, actual);
  if (outside === '..' || outside.startsWith(`..${sep}`) || actual !== absolute) {
    fail(`${context} escapes the project or traverses a symbolic link: ${relativePath}`);
  }
  if (!lstatSync(actual).isFile()) fail(`${context} is not a regular file: ${relativePath}`);
  return {path: relativePath, bytes: readFileSync(actual)};
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function physicalLines(bytes: Uint8Array): number {
  let count = 0;
  for (const byte of bytes) if (byte === 10) count += 1;
  return count + (bytes.length > 0 && bytes.at(-1) !== 10 ? 1 : 0);
}

function markdownAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const repetitions = new Map<string, number>();
  for (const line of markdown.split(/\r?\n/u)) {
    const heading = /^#{1,6}\s+(.+?)\s*$/u.exec(line)?.[1];
    if (!heading) continue;
    const base = heading
      .toLowerCase()
      .replace(/<[^>]*>/gu, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/gu, '-');
    const repetition = repetitions.get(base) ?? 0;
    repetitions.set(base, repetition + 1);
    anchors.add(repetition === 0 ? base : `${base}-${repetition}`);
  }
  return anchors;
}

function validateMarkdownReference(root: string, value: unknown, context: string): string {
  const reference = string(value, context);
  const match = /^([^#]+\.md)#([a-z0-9-]+)$/u.exec(reference);
  if (!match) fail(`${context} must be a Markdown file and normalized heading anchor`);
  const projectPath = match[1].includes('/') ? match[1] : `docs/${match[1]}`;
  const file = safeFile(root, projectPath, context);
  if (!markdownAnchors(file.bytes.toString('utf8')).has(match[2])) {
    fail(`${context} references a missing Markdown anchor: ${reference}`);
  }
  return reference;
}

function validateDiagnostic(value: unknown, context: string, maximumLines: number): void {
  const diagnostic = record(value, context);
  exactKeys(diagnostic, context, ['code', 'message', 'line', 'column', 'offset'], ['label']);
  const code = string(diagnostic.code, `${context}.code`);
  if (!/^[A-Z][A-Z0-9_]*$/u.test(code)) fail(`${context}.code is not normalized`);
  string(diagnostic.message, `${context}.message`);
  const line = integer(diagnostic.line, `${context}.line`, 1);
  if (line > maximumLines) fail(`${context}.line exceeds the source's physical line count`);
  integer(diagnostic.column, `${context}.column`, 1);
  integer(diagnostic.offset, `${context}.offset`);
  if ('label' in diagnostic && diagnostic.label !== null) {
    integer(diagnostic.label, `${context}.label`, 1);
  }
}

function validateFeatureLabels(value: unknown, context: string, maximumLines: number): void {
  const labels = record(value, context);
  for (const [label, linesValue] of Object.entries(labels)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(label))
      fail(`${context} has an unnormalized label ${label}`);
    const lines = array(linesValue, `${context}.${label}`).map((line, index) =>
      integer(line, `${context}.${label}[${index}]`, 1),
    );
    if (lines.length === 0) fail(`${context}.${label} must identify at least one line label`);
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index - 1] >= lines[index]) {
        fail(`${context}.${label} must be strictly increasing without duplicates`);
      }
    }
    if (lines.some((line) => line > 99_999))
      fail(`${context}.${label} contains an implausible line label`);
  }
  if (maximumLines < 1) fail(`${context} belongs to an empty source`);
}

function validateBookReference(value: unknown, context: string): void {
  const book = record(value, context);
  exactKeys(
    book,
    context,
    ['title', 'referencePage', 'dialectHint', 'evidence'],
    ['listingPageVerified'],
  );
  string(book.title, `${context}.title`);
  integer(book.referencePage, `${context}.referencePage`, 1);
  if (book.dialectHint !== null) string(book.dialectHint, `${context}.dialectHint`);
  if (
    book.evidence !== 'upstream README; attribution not certified' &&
    !/^companion of [A-Z0-9]+; exact printed listing page still unverified$/u.test(
      string(book.evidence, `${context}.evidence`),
    )
  ) {
    fail(`${context}.evidence must preserve the provisional attribution disclaimer`);
  }
  if ('listingPageVerified' in book)
    integer(book.listingPageVerified, `${context}.listingPageVerified`, 1);
}

function validateRemainingBlockers(value: unknown, context: string): void {
  const blockers = strings(value, context);
  if (blockers.length === 0) fail(`${context} must remain explicit and nonempty`);
  for (const blocker of blockers) {
    if (!/^[A-Za-z0-9][A-Za-z0-9 /+().$-]*$/u.test(blocker))
      fail(`${context} contains malformed text`);
  }
}

function validateBehaviorEvidence(
  root: string,
  value: unknown,
  context: string,
  fixtures: Set<string>,
): void {
  const evidence = record(value, context);
  exactKeys(
    evidence,
    context,
    ['oracle', 'scope', 'remainingBlockers'],
    ['rawFixture', 'correctedFixture', 'correctedSha256', 'correction', 'rawResult'],
  );
  validateMarkdownReference(root, evidence.oracle, `${context}.oracle`);
  string(evidence.scope, `${context}.scope`);
  validateRemainingBlockers(evidence.remainingBlockers, `${context}.remainingBlockers`);
  const optionalGroup = [
    'rawFixture',
    'correctedFixture',
    'correctedSha256',
    'correction',
    'rawResult',
  ];
  const present = optionalGroup.filter((key) => key in evidence);
  if (present.length !== 0 && present.length !== optionalGroup.length) {
    fail(`${context} must provide the complete correction-evidence group`);
  }
  if (present.length === optionalGroup.length) {
    const raw = safeFile(root, evidence.rawFixture, `${context}.rawFixture`);
    const corrected = safeFile(root, evidence.correctedFixture, `${context}.correctedFixture`);
    for (const fixture of [raw.path, corrected.path]) {
      if (fixtures.has(fixture)) fail(`${context} duplicates fixture claim ${fixture}`);
      fixtures.add(fixture);
    }
    const correctedHash = string(evidence.correctedSha256, `${context}.correctedSha256`);
    if (!/^[0-9a-f]{64}$/u.test(correctedHash) || correctedHash !== sha256(corrected.bytes)) {
      fail(`${context}.correctedSha256 does not match the fixture bytes`);
    }
    string(evidence.correction, `${context}.correction`);
    string(evidence.rawResult, `${context}.rawResult`);
    if (raw.bytes.length !== corrected.bytes.length)
      fail(`${context} correction must preserve byte length`);
    let differences = 0;
    for (let index = 0; index < raw.bytes.length; index += 1) {
      if (raw.bytes[index] !== corrected.bytes[index]) differences += 1;
    }
    if (differences !== 1) fail(`${context} correction must change exactly one byte`);
  }
}

function validateNativeFeatureEvidence(
  root: string,
  value: unknown,
  context: string,
  fixtures: Set<string>,
): void {
  const evidence = record(value, context);
  exactKeys(evidence, context, ['kind', 'fixture', 'scope', 'surfaces', 'remainingBlockers']);
  if (evidence.kind !== 'independently-authored-feature-oracle') {
    fail(`${context}.kind is unsupported`);
  }
  const fixture = safeFile(root, evidence.fixture, `${context}.fixture`);
  if (fixtures.has(fixture.path)) fail(`${context} duplicates fixture claim ${fixture.path}`);
  fixtures.add(fixture.path);
  string(evidence.scope, `${context}.scope`);
  const surfaces = strings(evidence.surfaces, `${context}.surfaces`);
  for (const surface of surfaces) {
    if (!ACCEPTANCE_SURFACES.has(surface))
      fail(`${context}.surfaces contains unsupported surface ${surface}`);
  }
  if (surfaces.length !== ACCEPTANCE_SURFACES.size)
    fail(`${context}.surfaces omits an acceptance surface`);
  validateRemainingBlockers(evidence.remainingBlockers, `${context}.remainingBlockers`);
}

function validateFixtureIdentity(root: string, fixture: string): void {
  const expected = FIXTURE_IDENTITIES.get(fixture);
  if (!expected) fail(`unapproved evidence fixture ${fixture}`);
  const file = safeFile(root, fixture, `fixture ${fixture}`);
  if (file.bytes.length !== expected.bytes) fail(`fixture ${fixture} byte count drifted`);
  if (physicalLines(file.bytes) !== expected.lines) fail(`fixture ${fixture} line count drifted`);
  if (sha256(file.bytes) !== expected.sha256) fail(`fixture ${fixture} SHA-256 drifted`);
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function validateClassicLedger(root: string): ClassicLedgerReport {
  const ledgerFile = safeFile(root, LEDGER_PATH, 'ledger');
  let parsed: unknown;
  try {
    parsed = JSON.parse(ledgerFile.bytes.toString('utf8'));
  } catch (error) {
    fail(`ledger is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const ledger = record(parsed, 'ledger');
  exactKeys(ledger, 'ledger', [
    'schemaVersion',
    'upstream',
    'nativeBaselineCommit',
    'inventoryCount',
    'searchIndexNotice',
    'missingBookListings',
    'entries',
  ]);
  if (ledger.schemaVersion !== 1) fail('unsupported schemaVersion');
  const upstream = record(ledger.upstream, 'ledger.upstream');
  exactKeys(upstream, 'ledger.upstream', ['repository', 'commit']);
  if (upstream.repository !== UPSTREAM_REPOSITORY || upstream.commit !== UPSTREAM_COMMIT) {
    fail('pinned upstream repository or commit drifted');
  }
  if (ledger.nativeBaselineCommit !== NATIVE_BASELINE) fail('native baseline commit drifted');
  if (ledger.inventoryCount !== INVENTORY_COUNT) fail('inventoryCount must remain 108');
  if (ledger.searchIndexNotice !== SEARCH_NOTICE) fail('search-index disclaimer drifted');
  const missing = strings(ledger.missingBookListings, 'ledger.missingBookListings');
  if (missing.join(',') !== 'BUNNY,SNOOPY')
    fail('missing book listings must remain BUNNY and SNOOPY');

  const entries = array(ledger.entries, 'ledger.entries');
  if (entries.length !== INVENTORY_COUNT) fail('entries must account for exactly 108 files');
  const files = new Set<string>();
  const hashes = new Set<string>();
  const fixtures = new Set<string>();
  const sourceStatuses: Record<string, number> = {};
  const dialectStatuses: Record<string, number> = {};
  const behaviorStatuses: Record<string, number> = {};
  let previousFile = '';

  for (const [index, entryValue] of entries.entries()) {
    const context = `ledger.entries[${index}]`;
    const entry = record(entryValue, context);
    exactKeys(
      entry,
      context,
      [
        'file',
        'sha256',
        'bytes',
        'physicalLines',
        'bookReference',
        'role',
        'sourceStatus',
        'dialectStatus',
        'verifiedDialect',
        'observedFeatureLabels',
        'firstNativeDiagnostic',
        'behaviorStatus',
        'blockers',
      ],
      ['reviewRecord', 'printedSystem', 'nativeFeatureEvidence', 'behaviorEvidence'],
    );
    const file = string(entry.file, `${context}.file`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.bas$/u.test(file)) {
      fail(`${context}.file is not a normalized basename`);
    }
    if (file <= previousFile) fail('entry filenames must be unique and strictly sorted');
    previousFile = file;
    if (files.has(file)) fail(`duplicate source file ${file}`);
    files.add(file);
    const hash = string(entry.sha256, `${context}.sha256`);
    if (!/^[0-9a-f]{64}$/u.test(hash)) fail(`${context}.sha256 is not normalized`);
    if (hashes.has(hash)) fail(`${context}.sha256 duplicates another source identity`);
    hashes.add(hash);
    const bytes = integer(entry.bytes, `${context}.bytes`, 1);
    const lines = integer(entry.physicalLines, `${context}.physicalLines`, 1);
    validateBookReference(entry.bookReference, `${context}.bookReference`);
    requireChoice(entry.role, `${context}.role`, ['listing', 'companion']);
    const sourceStatus = requireChoice(entry.sourceStatus, `${context}.sourceStatus`, [
      'reviewed-difference',
      'unresolved',
    ]);
    const dialectStatus = requireChoice(entry.dialectStatus, `${context}.dialectStatus`, [
      'printed-system-identified',
      'unverified',
    ]);
    if (entry.verifiedDialect !== null)
      fail(`${context}.verifiedDialect must remain null in schema v1`);
    validateFeatureLabels(entry.observedFeatureLabels, `${context}.observedFeatureLabels`, lines);
    validateDiagnostic(entry.firstNativeDiagnostic, `${context}.firstNativeDiagnostic`, lines);
    const behaviorStatus = requireChoice(entry.behaviorStatus, `${context}.behaviorStatus`, [
      'not-run',
      'partial-native-path',
    ]);
    const blockers = strings(entry.blockers, `${context}.blockers`).sort();
    if (blockers.join(',') !== [...REQUIRED_BLOCKERS].sort().join(',')) {
      fail(`${context}.blockers must retain every schema-v1 release blocker`);
    }
    if (sourceStatus === 'reviewed-difference' && !('reviewRecord' in entry)) {
      fail(`${context} reviewed source requires reviewRecord`);
    }
    if ('reviewRecord' in entry)
      validateMarkdownReference(root, entry.reviewRecord, `${context}.reviewRecord`);
    if (dialectStatus === 'printed-system-identified') {
      string(entry.printedSystem, `${context}.printedSystem`);
      if (!('reviewRecord' in entry)) fail(`${context} printed system requires reviewRecord`);
    } else if ('printedSystem' in entry) {
      fail(`${context} cannot claim printedSystem while dialectStatus is unverified`);
    }
    if (behaviorStatus === 'partial-native-path' && !('behaviorEvidence' in entry)) {
      fail(`${context} partial behavior requires behaviorEvidence`);
    }
    if (behaviorStatus === 'not-run' && 'behaviorEvidence' in entry) {
      fail(`${context} cannot attach behaviorEvidence while behaviorStatus is not-run`);
    }
    if ('behaviorEvidence' in entry) {
      validateBehaviorEvidence(
        root,
        entry.behaviorEvidence,
        `${context}.behaviorEvidence`,
        fixtures,
      );
    }
    if ('nativeFeatureEvidence' in entry) {
      validateNativeFeatureEvidence(
        root,
        entry.nativeFeatureEvidence,
        `${context}.nativeFeatureEvidence`,
        fixtures,
      );
    }
    if (file === '1check.bas') {
      if (
        hash !== FIXTURE_IDENTITIES.get('scripts/package/fixtures/classic/1check-raw.bas')?.sha256
      ) {
        fail('1check raw source hash drifted from its evidence fixture');
      }
      if (bytes !== 2042 || lines !== 86) fail('1check raw source dimensions drifted');
    }
    increment(sourceStatuses, sourceStatus);
    increment(dialectStatuses, dialectStatus);
    increment(behaviorStatuses, behaviorStatus);
  }

  if (fixtures.size !== FIXTURE_IDENTITIES.size)
    fail('ledger evidence must reference the three approved fixture files');
  for (const fixture of fixtures) validateFixtureIdentity(root, fixture);

  const inventory = safeFile(root, INVENTORY_PATH, 'inventory document').bytes.toString('utf8');
  for (const required of [
    `Exact commit: \`${UPSTREAM_COMMIT}\``,
    'Inventory: **108 `.bas` files**',
    `Interpreter baseline: \`${NATIVE_BASELINE}\``,
    'All 108 report a failure, so **zero parsed**',
    'This is the initial **research baseline**, not a certified compatibility matrix.',
  ]) {
    if (!inventory.includes(required))
      fail(`inventory document lost required disclaimer or identity: ${required}`);
  }
  const rows = new Map<string, string>();
  for (const line of inventory.split(/\r?\n/u)) {
    const match =
      /^\| \[([a-z0-9]+(?:-[a-z0-9]+)*\.bas)\]\(([^)]+)\)\s+\| `([0-9a-f]{64})` \|/u.exec(line);
    if (!match) continue;
    if (rows.has(match[1])) fail(`inventory document duplicates ${match[1]}`);
    const expectedUrl = `https://github.com/${UPSTREAM_REPOSITORY}/blob/${UPSTREAM_COMMIT}/${match[1]}`;
    if (match[2] !== expectedUrl) fail(`inventory document has unpinned URL for ${match[1]}`);
    rows.set(match[1], match[3]);
  }
  if (rows.size !== INVENTORY_COUNT)
    fail('inventory document must contain exactly 108 source rows');
  for (const entryValue of entries) {
    const entry = record(entryValue, 'inventory comparison entry');
    if (rows.get(entry.file as string) !== entry.sha256) {
      fail(`inventory document identity differs for ${String(entry.file)}`);
    }
  }

  const review = safeFile(root, REVIEW_PATH, 'source-review document').bytes.toString('utf8');
  for (const disclaimer of [
    'It does not declare a\nwhole dialect or the corpus compatible.',
    'No file has a complete historical compatibility pass.',
    'A README label is a lead, not a verified dialect.',
  ]) {
    if (!review.includes(disclaimer)) fail(`source-review document lost disclaimer: ${disclaimer}`);
  }

  return {
    entries: entries.length,
    sourceStatuses,
    dialectStatuses,
    behaviorStatuses,
    fixtureFiles: fixtures.size,
  };
}

if (import.meta.main) {
  const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
  console.log(JSON.stringify(validateClassicLedger(root)));
}
