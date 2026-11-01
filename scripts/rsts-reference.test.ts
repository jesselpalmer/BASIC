import {expect, test} from 'bun:test';
import {inspectRstsV4aDirectory, verifyRstsV4aReference} from './rsts-reference.ts';

function fixture() {
  const bytes = new Uint8Array(295936);
  const view = new DataView(bytes.buffer);
  const word = (block: number, index: number, value: number) =>
    view.setUint16(block * 512 + index * 2, value, true);
  [65, 4, 68, 68].forEach((value, index) => word(64, index, value));
  [0, 257, 66, 9, 0].forEach((value, index) => word(65, index, value));
  word(66, 0, 67);
  // MA2.OBJ: independently written Radix-50 words, two nonadjacent payload blocks.
  [20872, 0, 24090, 2266, 0, 1, 2, 5, 155].forEach((value, index) => word(66, index + 1, value));
  word(1, 0, 5);
  bytes.fill(65, 514, 1024);
  bytes.fill(66, 2562, 3072);
  return {bytes, word};
}

test('reads the fixed directory and linked payload in chain order without retaining bytes', () => {
  const {bytes} = fixture();
  const result = inspectRstsV4aDirectory(bytes);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    name: 'MA2.OBJ',
    firstBlock: 1,
    blocks: 2,
    lastBlock: 5,
    rawDateWord: 2266,
    rawProtectionWord: 155,
    payloadBytes: 1020,
    sha256: '179d0d0848d70827c0760758a28296a46abb8fe9aa11ab5d2cc9f79bf3c1d56a',
  });
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result[0])).toBe(true);
  bytes.fill(0);
  expect(result[0].name).toBe('MA2.OBJ');
  expect(() => Object.assign(result[0], {blocks: 0})).toThrow(TypeError);
});

test('uses the Uint8Array window and includes payload padding', () => {
  const {bytes} = fixture();
  const enclosing = new Uint8Array(bytes.length + 8);
  enclosing.set(bytes, 4);
  expect(inspectRstsV4aDirectory(enclosing.subarray(4, -4))).toEqual(
    inspectRstsV4aDirectory(bytes),
  );
  const original = inspectRstsV4aDirectory(bytes)[0].sha256;
  bytes[3071] = 0;
  expect(inspectRstsV4aDirectory(bytes)[0].sha256).not.toBe(original);
});

test('covers the last slot in each UFD and ignores deleted-name slots', () => {
  const {bytes, word} = fixture();
  bytes.copyWithin(66 * 512 + 488, 66 * 512 + 2, 66 * 512 + 20);
  for (let index = 1; index <= 3; index++) word(66, index, 0);
  expect(inspectRstsV4aDirectory(bytes)[0].name).toBe('MA2.OBJ');
  bytes.copyWithin(67 * 512 + 488, 66 * 512 + 488, 66 * 512 + 506);
  for (let index = 244; index < 247; index++) word(66, index, 0);
  expect(inspectRstsV4aDirectory(bytes)[0].name).toBe('MA2.OBJ');
});

test.each([
  (word: ReturnType<typeof fixture>['word']) => word(64, 0, 0),
  (word: ReturnType<typeof fixture>['word']) => word(65, 1, 258),
  (word: ReturnType<typeof fixture>['word']) => word(65, 3, 10),
  (word: ReturnType<typeof fixture>['word']) => word(65, 5, 1),
  (word: ReturnType<typeof fixture>['word']) => word(66, 0, 66),
  (word: ReturnType<typeof fixture>['word']) => word(67, 0, 66),
])('rejects alternate/cyclic directory layouts', (change) => {
  const {bytes, word} = fixture();
  change(word);
  expect(() => inspectRstsV4aDirectory(bytes)).toThrow(/MFD layout|UFD chain/);
});

test.each([
  [1, 64000],
  [1, 0],
  [3, 0],
  [4, 0x1000],
  [5, 1],
  [6, 0],
  [6, 64],
  [6, 578],
  [7, 0],
  [7, 578],
  [8, 1],
  [9, 256],
])('rejects unsupported entry word %i value %i', (index, value) => {
  const {bytes, word} = fixture();
  word(66, index, value);
  expect(() => inspectRstsV4aDirectory(bytes)).toThrow();
});

test.each([1, 64, 66, 578, 65535])('rejects cyclic/reserved/out-of-range data link %i', (link) => {
  const {bytes, word} = fixture();
  word(1, 0, link);
  expect(() => inspectRstsV4aDirectory(bytes)).toThrow(/block/);
});

test('rejects short/long chains and incorrect recorded end blocks', () => {
  const short = fixture();
  short.word(1, 0, 0);
  expect(() => inspectRstsV4aDirectory(short.bytes)).toThrow('chain length/end mismatch');
  const long = fixture();
  long.word(66, 7, 1);
  expect(() => inspectRstsV4aDirectory(long.bytes)).toThrow('chain exceeds directory length');
  const end = fixture();
  end.word(66, 8, 2);
  expect(() => inspectRstsV4aDirectory(end.bytes)).toThrow('chain length/end mismatch');
});

test('rejects duplicate filenames and data blocks shared across files', () => {
  const {bytes, word} = fixture();
  bytes.copyWithin(66 * 512 + 20, 66 * 512 + 2, 66 * 512 + 20);
  expect(() => inspectRstsV4aDirectory(bytes)).toThrow('duplicate filename');
  word(66, 10, 14960); // IN in Radix-50, with distinct name but same block chain.
  expect(() => inspectRstsV4aDirectory(bytes)).toThrow('shared');
});

test('rejects wrong lengths and unpinned media before inspecting metadata', () => {
  expect(() => inspectRstsV4aDirectory(new Uint8Array(0))).toThrow('578');
  expect(() => verifyRstsV4aReference(new Uint8Array(295937))).toThrow('578');
  expect(() => verifyRstsV4aReference(fixture().bytes)).toThrow('unpinned tape SHA-256');
});
