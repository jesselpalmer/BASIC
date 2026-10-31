import {validateDialect} from './dialect.ts';
import type {Dialect, LanguageOptions} from './types.ts';

export const SOURCE_DOCUMENT_FORMAT = 'basic-program';
export const SOURCE_DOCUMENT_VERSION = 1;

/** A portable, versioned atom containing exact source and its language context. */
export interface SourceDocument {
  readonly format: typeof SOURCE_DOCUMENT_FORMAT;
  readonly version: typeof SOURCE_DOCUMENT_VERSION;
  readonly dialect: Dialect;
  readonly source: string;
}

const fields = ['dialect', 'format', 'source', 'version'] as const;

function validateEnvelope(value: unknown): SourceDocument {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Portable BASIC document must be a JSON object');
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (keys.length !== fields.length || keys.some((key, index) => key !== fields[index])) {
    throw new TypeError(
      'Portable BASIC document must contain exactly format, version, dialect and source',
    );
  }
  if (candidate.format !== SOURCE_DOCUMENT_FORMAT)
    throw new TypeError(`Unsupported portable BASIC document format`);
  if (candidate.version !== SOURCE_DOCUMENT_VERSION)
    throw new TypeError(`Unsupported portable BASIC document version`);
  if (typeof candidate.source !== 'string')
    throw new TypeError('Portable BASIC document source must be a string');
  const dialect = validateDialect(candidate.dialect);
  return Object.freeze({
    format: SOURCE_DOCUMENT_FORMAT,
    version: SOURCE_DOCUMENT_VERSION,
    dialect,
    source: candidate.source,
  });
}

export function decodeSourceDocument(serialized: string): SourceDocument {
  if (typeof serialized !== 'string')
    throw new TypeError('Portable BASIC document input must be a string');
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    throw new TypeError(
      `Invalid portable BASIC document JSON: ${error instanceof Error ? error.message : String(error)}`,
      {cause: error},
    );
  }
  return validateEnvelope(value);
}

export function createSourceDocument(
  source: string,
  options: LanguageOptions = {},
): SourceDocument {
  if (typeof source !== 'string')
    throw new TypeError('Portable BASIC document source must be a string');
  return Object.freeze({
    format: SOURCE_DOCUMENT_FORMAT,
    version: SOURCE_DOCUMENT_VERSION,
    dialect: validateDialect(options.dialect),
    source,
  });
}

export function encodeSourceDocument(source: string, options: LanguageOptions = {}): string {
  return `${JSON.stringify(createSourceDocument(source, options), null, 2)}\n`;
}
