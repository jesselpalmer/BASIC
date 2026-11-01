import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync, fstatSync, openSync, readSync} from 'node:fs';
import pinned from '../docs/rsts-v4a-reference.json';

const blockBytes = 512;
const tapeBlocks = 578;
const tapeBytes = blockBytes * tapeBlocks;
const radix50 = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ$.%0123456789';

export interface RstsReferenceFile {
  readonly name: string;
  readonly firstBlock: number;
  readonly blocks: number;
  readonly lastBlock: number;
  readonly rawDateWord: number;
  readonly rawProtectionWord: number;
  readonly payloadBytes: number;
  readonly sha256: string;
}

function requireMedia(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`RSTS reference media: ${message}`);
}

/** Closed tape-one layout only; no extraction, execution or date conversion. */
export function inspectRstsV4aDirectory(bytes: Uint8Array): readonly RstsReferenceFile[] {
  requireMedia(bytes.byteLength === tapeBytes, 'expected 578 512-byte blocks');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = (block: number, index: number) =>
    view.getUint16(block * blockBytes + index * 2, true);
  const mfd1 = [0o101, 4, 0o104, 0o104];
  const mfd2 = [0, 0x0101, 0o102, 9, 0];
  for (let index = 0; index < 256; index++) {
    requireMedia(
      word(0o100, index) === (mfd1[index] ?? 0) && word(0o101, index) === (mfd2[index] ?? 0),
      'unexpected tape-one MFD layout',
    );
  }
  requireMedia(word(0o102, 0) === 0o103 && word(0o103, 0) === 0, 'unexpected UFD chain');
  const decode = (value: number) => {
    requireMedia(value < 64000, 'invalid Radix-50 word');
    return (
      radix50[Math.floor(value / 1600)] + radix50[Math.floor(value / 40) % 40] + radix50[value % 40]
    );
  };
  const claimed = new Set([0, 0o100, 0o101, 0o102, 0o103, 0o104]);
  const names = new Set<string>();
  const files: RstsReferenceFile[] = [];
  for (const directory of [0o102, 0o103]) {
    for (let slot = 1; slot <= 253 - 9; slot += 9) {
      const entry = Array.from({length: 9}, (_, index) => word(directory, slot + index));
      if (entry[0] === 0 && entry[1] === 0 && entry[2] === 0) continue;
      const name =
        (decode(entry[0]) + decode(entry[1])).trimEnd() + '.' + decode(entry[2]).trimEnd();
      requireMedia(/^[A-Z][A-Z0-9]{0,5}\.(OBJ|LDA)$/.test(name), 'unsupported tape-one filename');
      requireMedia(!names.has(name), 'duplicate filename');
      names.add(name);
      requireMedia(entry[3] < 4096 && entry[4] === 0, 'only closed linked files are supported');
      const firstBlock = entry[5],
        blocks = entry[6],
        lastBlock = entry[7];
      requireMedia(blocks > 0 && blocks < tapeBlocks && firstBlock > 0, 'invalid file extent');
      requireMedia(entry[8] < 256, 'unsupported protection word');
      const hash = createHash('sha256');
      let block = firstBlock,
        count = 0,
        last = 0;
      while (block !== 0) {
        requireMedia(
          block < tapeBlocks && !claimed.has(block),
          'cyclic, shared, reserved or out-of-range block',
        );
        requireMedia(count < blocks, 'chain exceeds directory length');
        claimed.add(block);
        hash.update(bytes.subarray(block * blockBytes + 2, (block + 1) * blockBytes));
        last = block;
        count++;
        block = word(block, 0);
      }
      requireMedia(count === blocks && last === lastBlock, 'chain length/end mismatch');
      files.push(
        Object.freeze({
          name,
          firstBlock,
          blocks,
          lastBlock,
          rawDateWord: entry[3],
          rawProtectionWord: entry[8],
          payloadBytes: count * 510,
          sha256: hash.digest('hex'),
        }),
      );
    }
  }
  return Object.freeze(files);
}

export function verifyRstsV4aReference(bytes: Uint8Array): readonly RstsReferenceFile[] {
  requireMedia(bytes.byteLength === tapeBytes, 'expected 578 512-byte blocks');
  requireMedia(
    createHash('sha256').update(bytes).digest('hex') === pinned.sha256,
    'unpinned tape SHA-256',
  );
  const files = inspectRstsV4aDirectory(bytes);
  assert.deepEqual(files, pinned.files, 'Pinned directory/payload manifest mismatch');
  return files;
}

function readTape(path: string): Uint8Array {
  const descriptor = openSync(path, 'r');
  try {
    const stat = fstatSync(descriptor);
    requireMedia(stat.isFile() && stat.size === tapeBytes, 'expected a regular 295936-byte file');
    const bytes = Buffer.alloc(tapeBytes + 1);
    let used = 0;
    while (used < bytes.length) {
      const count = readSync(descriptor, bytes, used, bytes.length - used, null);
      if (count === 0) break;
      used += count;
    }
    requireMedia(used === tapeBytes, 'file size changed while reading');
    return bytes.subarray(0, used);
  } finally {
    closeSync(descriptor);
  }
}

if (import.meta.main) {
  try {
    requireMedia(process.argv.length === 3, 'usage: bun scripts/rsts-reference.ts rsts01.dta');
    const files = verifyRstsV4aReference(readTape(process.argv[2]));
    console.log(JSON.stringify({...pinned, files}, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
