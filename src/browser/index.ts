/** Supported portable embedding surface; importing it creates no host effects. */
export {BrowserSession} from './session.ts';
export type {
  BrowserView,
  BrowserState,
  BrowserStatus,
  BrowserSessionOptions,
  BrowserRunOptions,
} from './session.ts';
export {KeyboardInput, logicalKey} from './keyboard.ts';
export {
  createSourceDocument,
  decodeSourceDocument,
  encodeSourceDocument,
  SOURCE_DOCUMENT_FORMAT,
  SOURCE_DOCUMENT_VERSION,
} from '../core/source_document.ts';
export type {SourceDocument} from '../core/source_document.ts';
export type {
  Dialect,
  Diagnostic,
  GraphicsCommand,
  LogicalKey,
  Location,
  VariableSnapshot,
} from '../core/types.ts';
