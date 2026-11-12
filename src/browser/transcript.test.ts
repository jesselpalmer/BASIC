import {describe, expect, test} from 'bun:test';
import {Transcript} from './transcript.ts';

describe('Transcript', () => {
  test('retains exact partial lines, blank output, and markup as plain text', () => {
    const transcript = new Transcript();
    transcript.append('Hello');
    transcript.append('');
    transcript.append(', <world>!\n\n');
    expect(transcript.text).toBe('Hello, <world>!\n\n');
    expect(transcript.truncated).toBe(false);
    expect(transcript.limit).toBe(50_000);
  });

  test('evicts oldest characters at the boundary without retaining extra history', () => {
    const transcript = new Transcript(8);
    transcript.append('1234');
    transcript.append('5678');
    expect(transcript.text).toBe('12345678');
    expect(transcript.truncated).toBe(false);
    transcript.append('9');
    expect(transcript.text).toBe('23456789');
    expect(transcript.truncated).toBe(true);
    transcript.append('abcdefgh');
    expect(transcript.text).toBe('abcdefgh');
    transcript.append('ABCDEFGHIJKLM');
    expect(transcript.text).toBe('FGHIJKLM');
    transcript.append('!');
    expect(transcript.text).toBe('GHIJKLM!');
  });

  test('bounds repeated output and clears the truncation indication for a fresh run', () => {
    const transcript = new Transcript(5);
    for (let index = 0; index < 100_000; index++) transcript.append('0123456789');
    expect(transcript.text).toBe('56789');
    expect(transcript.truncated).toBe(true);
    transcript.clear();
    expect(transcript.text).toBe('');
    expect(transcript.truncated).toBe(false);
    transcript.append('ok');
    expect(transcript.text).toBe('ok');
  });

  test('renders paper returns on the same row while retaining raw bytes', () => {
    const transcript = new Transcript();
    transcript.append(' 3 \r');
    transcript.append('\0  O\r\0    .\nNEXT\n\x07');
    expect(transcript.paperText).toBe(' 3O .\nNEXT\n\x07');
    expect(transcript.text).toBe(' 3 \r\0  O\r\0    .\nNEXT\n\x07');
    expect(transcript.truncated).toBe(false);
  });

  test('omits a detached padding byte in a truncated paper display and resets on clear', () => {
    const transcript = new Transcript(4);
    transcript.append('previous\r\0  O');
    expect(transcript.truncated).toBe(true);
    expect(transcript.text).toBe('\0  O');
    expect(transcript.paperText).toBe('  O');
    transcript.clear();
    transcript.append('NEW');
    expect(transcript.paperText).toBe('NEW');
    expect(transcript.truncated).toBe(false);
  });

  test('rejects limits that cannot describe a bounded nonempty transcript', () => {
    for (const limit of [0, -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => new Transcript(limit)).toThrow(RangeError);
    }
  });
});
