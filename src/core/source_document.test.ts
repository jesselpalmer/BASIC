import {describe, expect, test} from 'bun:test';
import {
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
} from './source_document.ts';
import type {LanguageOptions} from './types.ts';

describe('portable BASIC source documents', () => {
  test.each([
    '',
    ' \r\n20 END\r\n10 PRINT "café 😀"\t\r\n',
    '10 PRINT "unfinished',
    '{"version":2}',
    '\0',
  ])('round trips exact editable source independently of BASIC validity: %j', (source) => {
    const encoded = encodeSourceDocument(source, {dialect: 'native'});
    expect(encoded.endsWith('\n')).toBe(true);
    expect(decodeSourceDocument(encoded)).toEqual({
      format: 'basic-program',
      version: 1,
      dialect: 'native',
      source,
    });
    expect(Object.isFrozen(decodeSourceDocument(encoded))).toBe(true);
  });

  test.each([
    null,
    true,
    1,
    'text',
    {},
    {format: 'other', version: 1, dialect: 'native', source: '10 END'},
    {format: 'basic-program', version: 2, dialect: 'native', source: '10 END'},
    {format: 'basic-program', version: '1', dialect: 'native', source: '10 END'},
    {format: 'basic-program', version: 1, dialect: 'basic-plus-1972-10', source: '10 END'},
    {format: 'basic-program', version: 1, dialect: null, source: '10 END'},
    {format: 'basic-program', version: 1, dialect: 'native', source: null},
    {format: 'basic-program', version: 1, dialect: 'native'},
    {format: 'basic-program', version: 1, source: ''},
    {format: 'basic-program', dialect: 'native', source: ''},
    {version: 1, dialect: 'native', source: ''},
    {format: 'basic-program', version: 1, dialect: 'native', source: '', extra: true},
  ])('rejects invalid or unsupported envelope: %j', (value) => {
    expect(() => decodeSourceDocument(JSON.stringify(value))).toThrow();
  });

  test('rejects malformed JSON and prototype-like extra fields', () => {
    expect(() => decodeSourceDocument(3 as unknown as string)).toThrow(/input/);
    expect(() => decodeSourceDocument('{')).toThrow(/JSON/);
    expect(() =>
      decodeSourceDocument(
        '{"format":"basic-program","version":1,"dialect":"native","source":"","__proto__":{}}',
      ),
    ).toThrow(/exactly/);
  });

  test('validates output context instead of silently encoding missing or unsupported metadata', () => {
    expect(createSourceDocument('10 END')).toMatchObject({dialect: 'native'});
    const unsupported = {dialect: 'basic-plus-1972-10'} as unknown as LanguageOptions;
    expect(() => encodeSourceDocument('10 END', unsupported)).toThrow(/dialect/);
    expect(() => encodeSourceDocument(3 as unknown as string)).toThrow(/source/);
  });
});
