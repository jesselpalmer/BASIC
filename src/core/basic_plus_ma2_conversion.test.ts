import {describe, expect, test} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {basicPlusMa2Val, basicPlusMa2ReadNumeric} from './basic_plus_ma2_conversion.ts';
import observations from '../../docs/ma2-conversion-caller-observations.json';
import decimals from './__tests__/ma2-decimal-reference.json';
import {tokenize} from '../parser/tokenizer.ts';

describe('bounded selected-MA2 caller conversions', () => {
  test.each(observations.val.cases)('matches original VAL call $id', (row) => {
    const text = String.fromCharCode(...row.inputBytes);
    const result = basicPlusMa2Val(text);
    if ('ERR' in row) {
      expect(result).toEqual({kind: 'error', code: row.ERR as 52});
      expect(row.words).toEqual([0x41e0, 0]);
      expect(row.ERL).toBe(7020);
    } else {
      expect(result).toEqual({kind: 'value', words: [row.words[0], row.words[1]]});
    }
  });
  test.each(observations.read.cases.map((row) => [row.kind, row.id, row] as const))(
    'matches original %s READ call %i and its observed field position',
    (_kind, _id, row) => {
      const field = tokenize('10 DATA ' + row.dataSpelling, {
        lexicalPolicy: 'basic-plus-1972-10',
      }).find((token) => token.type === 'STRING');
      if (field?.type !== 'STRING') throw new Error('Expected scanned field');
      const result = basicPlusMa2ReadNumeric(
        field.value,
        row.kind as 'floating' | 'integer',
        /^['"]/.test(field.raw),
      );
      if ('ERR' in row) {
        expect(result).toEqual({kind: 'error', code: row.ERR as 52});
        expect(row.ERL).toBe(row.kind === 'floating' ? 90 : 390);
        expect(row.nextStringField).toBe(field.value);
        if (row.words !== undefined) expect(row.words).toEqual([0x41e0, 0]);
        else expect(row.value).toBe(7);
      } else {
        if (row.words !== undefined)
          expect(result).toEqual({
            kind: 'value',
            numericKind: 'floating',
            words: [row.words[0], row.words[1]],
          });
        else expect(result).toEqual({kind: 'value', numericKind: 'integer', value: row.value});
        const following = observations.read.cases.find(
          (other) => other.kind === row.kind && other.id === row.id + 1,
        );
        expect(row.nextStringField).toBe(
          following === undefined ? 'TAIL' : following.dataSpelling.replace(/^"|"$/g, ''),
        );
      }
    },
  );
  test('retains the isolated original VAL first event without inventing replacement words', () => {
    const row = observations.valEvent.case;
    expect(basicPlusMa2Val(String.fromCharCode(...row.inputBytes))).toEqual({
      kind: 'error',
      code: 48,
    });
    expect(row.ERR).toBe(48);
    expect(row.ERL).toBe(30);
    expect(row.words).toEqual([0x41e0, 0]);
    expect(basicPlusMa2ReadNumeric('9'.repeat(40), 'floating', false)).toEqual({
      kind: 'unsupported',
      reason: 'read-numeric-event',
    });
  });
  test('pins retained sources, outputs, completed runs and all 81 case identities', () => {
    expect(observations.val.cases).toHaveLength(32);
    expect(observations.read.cases).toHaveLength(48);
    for (const record of [observations.val, observations.read, observations.valEvent]) {
      for (const key of ['probe', 'output'] as const) {
        expect(
          createHash('sha256')
            .update(readFileSync(new URL('../../docs/' + record[key], import.meta.url)))
            .digest('hex'),
        ).toBe(record[key === 'probe' ? 'probeSha256' : 'outputSha256']);
      }
      expect(record.listingSourceMatch).toBe(true);
      expect(record.runsCompared).toBe(2);
      expect(record.rawLfBodySha256[0]).toBe(record.rawLfBodySha256[1]);
    }
  });
  test.each(decimals.rows.map((row, index) => [index, row] as const))(
    'preserves the independently captured source converter boundary %i',
    (_index, [raw, high, low, , psw, mask]) => {
      if (
        typeof raw !== 'string' ||
        typeof high !== 'number' ||
        typeof low !== 'number' ||
        typeof psw !== 'number' ||
        typeof mask !== 'number'
      )
        throw new Error('Bad source reference');
      const val = basicPlusMa2Val(raw);
      const read = basicPlusMa2ReadNumeric(raw, 'floating', false);
      if (mask !== 0) {
        expect(val).toEqual({kind: 'error', code: 48});
        expect(read).toEqual({kind: 'unsupported', reason: 'read-numeric-event'});
      } else if (psw & 2) {
        expect(val).toEqual({kind: 'error', code: 52});
        expect(read).toEqual({kind: 'error', code: 52});
      } else {
        expect(val).toEqual({kind: 'value', words: [high, low]});
        expect(read).toEqual({kind: 'value', numericKind: 'floating', words: [high, low]});
      }
    },
  );
  test('uses scanned DATA contents and preserves the quoted/unquoted distinction', () => {
    const fields = tokenize('10 DATA  1 2 , "1",\'1\', +00001, -00000', {
      lexicalPolicy: 'basic-plus-1972-10',
    }).filter((token) => token.type === 'STRING');
    const results = fields.map((field) =>
      basicPlusMa2ReadNumeric(field.value, 'integer', /^['"]/.test(field.raw)),
    );
    expect(results).toEqual([
      {kind: 'value', numericKind: 'integer', value: 12},
      {kind: 'error', code: 52},
      {kind: 'error', code: 52},
      {kind: 'value', numericKind: 'integer', value: 1},
      {kind: 'value', numericKind: 'integer', value: 0},
    ]);
  });
  test('keeps signs, zero, malformed spelling and integer range separate', () => {
    for (const raw of ['-0', '+0', '-.0', ' - 0 '])
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'value', words: [0, 0]});
    for (const raw of ['', '   '])
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'value', words: [0, 0]});
    for (const raw of ['+', '-', '1E2X', '1..2', '1%', '1\u002c2'])
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'error', code: 52});
    for (const raw of ['32767', '+32767', '-32768', '0'.repeat(250) + '32767']) {
      expect(basicPlusMa2ReadNumeric(raw, 'integer', false)).toEqual({
        kind: 'value',
        numericKind: 'integer',
        value: Number(raw),
      });
    }
    for (const raw of [
      '32768',
      '-32769',
      '9'.repeat(255),
      '.5',
      '-1.5',
      '1E0',
      '0E999',
      '1%',
      '+',
      '--1',
    ])
      expect(basicPlusMa2ReadNumeric(raw, 'integer', false)).toEqual({kind: 'error', code: 52});
  });
  test('bounds text before conversion and keeps unverified characters/spellings explicit', () => {
    for (const raw of ['\t1', '1\n', '1\0', '\u00b1', '١', '😀']) {
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'unsupported', reason: 'byte-domain'});
      expect(basicPlusMa2ReadNumeric(raw, 'integer', true)).toEqual({
        kind: 'unsupported',
        reason: 'byte-domain',
      });
    }
    for (const raw of ['1e2', 'x']) {
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'unsupported', reason: 'lowercase'});
      expect(basicPlusMa2ReadNumeric(raw, 'integer', false)).toEqual({
        kind: 'unsupported',
        reason: 'lowercase',
      });
    }
    for (const raw of ['.', '+.', '-.']) {
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'unsupported', reason: 'point-only'});
      expect(basicPlusMa2ReadNumeric(raw, 'floating', false)).toEqual({
        kind: 'unsupported',
        reason: 'point-only',
      });
    }
    for (const raw of ['9'.repeat(40) + 'X', '9E38X', '-9E38X']) {
      expect(basicPlusMa2Val(raw)).toEqual({kind: 'unsupported', reason: 'failure-order'});
      expect(basicPlusMa2ReadNumeric(raw, 'floating', false)).toEqual({
        kind: 'unsupported',
        reason: 'failure-order',
      });
    }
    expect(basicPlusMa2Val('1E999X')).toEqual({kind: 'error', code: 52});
    const maximum = '0'.repeat(255);
    expect(basicPlusMa2Val(maximum)).toEqual({kind: 'value', words: [0, 0]});
    for (const call of [
      () => basicPlusMa2Val(maximum + '0'),
      () => basicPlusMa2ReadNumeric(maximum + '0', 'floating', true),
    ])
      expect(call()).toEqual({kind: 'unsupported', reason: 'input-limit'});
  });
  test('rejects malformed helper inputs and validates flags before reading text', () => {
    const bad = new Proxy(
      {},
      {
        get() {
          throw new Error('coerced');
        },
      },
    ) as string;
    expect(() => basicPlusMa2ReadNumeric(bad, 'unknown' as 'integer', true)).toThrow(
      'Unsupported numeric READ target',
    );
    expect(() => basicPlusMa2ReadNumeric(bad, 'integer', 1 as unknown as boolean)).toThrow(
      'explicit quoted flag',
    );
    for (const text of [bad, null, undefined, 1, Object('1')]) {
      expect(() => basicPlusMa2Val(text as string)).toThrow(TypeError);
      expect(() => basicPlusMa2ReadNumeric(text as string, 'integer', true)).toThrow(TypeError);
    }
    for (const raw of ['', ' ', '1 2'])
      expect(() => basicPlusMa2ReadNumeric(raw, 'floating', false)).toThrow(
        'scanned unquoted DATA',
      );
  });
  test('returns detached frozen results on successful, failing and unsupported paths', () => {
    const results = [
      basicPlusMa2Val('1'),
      basicPlusMa2Val(''),
      basicPlusMa2Val('X'),
      basicPlusMa2Val('1e2'),
      basicPlusMa2ReadNumeric('1', 'integer', false),
      basicPlusMa2ReadNumeric('1', 'floating', false),
      basicPlusMa2ReadNumeric('1', 'floating', true),
    ];
    for (const result of results) {
      expect(Object.isFrozen(result)).toBe(true);
      expect(() => Object.assign(result, {kind: 'changed'})).toThrow(TypeError);
      if ('words' in result) {
        expect(Object.isFrozen(result.words)).toBe(true);
        expect(() => Object.assign(result.words, {0: 0})).toThrow(TypeError);
      }
    }
    const first = basicPlusMa2Val('1'),
      second = basicPlusMa2Val('1');
    expect(first).not.toBe(second);
    if ('words' in first && 'words' in second) expect(first.words).not.toBe(second.words);
  });
});
