/**
 * The `files` namespace — typed, private-by-default file storage for MindStudio
 * apps. The twin of `db`: define a store at module scope, import the handle into
 * route handlers.
 *
 * ```ts
 * // files/uploads.ts
 * import { files } from '@mindstudio-ai/agent';
 * export const Uploads = files.defineStore('uploads');               // private
 * export const Assets  = files.defineStore('assets', { access: 'public' });
 *
 * // routes/upload.ts
 * import { Uploads } from '../files/uploads';
 * const f = await Uploads.put(buffer, { contentType, filename });
 * return { url: f.url };            // drop into <img src> / <a download>
 * ```
 *
 * `file.url` is a stable, on-domain URL a logged-in user's browser can load
 * directly. For a link that works without a session (email, cross-site embed),
 * use `await file.shareUrl({ expiresIn })`.
 */

import { Store, type FileAccess, type FilesTransport } from './store.js';

export { Store } from './store.js';
export type {
  FileAccess,
  PutOptions,
  ListOptions,
  StoredFile,
  UploadToken,
} from './store.js';

/** Options for `files.defineStore()`. */
export interface DefineStoreOptions {
  /**
   * Access level. **Defaults to `'private'`** (signed / session-authorized
   * reads). `'public'` marks the store world-readable and CDN-served on the
   * app's own domain (resizable via image query params). Pinned at define-time
   * — no `put()` can change it.
   */
  access?: FileAccess;
  /**
   * Max upload size in bytes for client-direct uploads (the default for
   * `createUploadToken`; enforced by the presigned POST). Overridable per call;
   * capped at the platform ceiling.
   */
  maxSize?: number;
  /**
   * Allowed content types for client-direct uploads. When set,
   * `createUploadToken({ contentType })` must pass one of these.
   */
  contentTypes?: string[];
}

/** The `files` namespace object. */
export interface Files {
  /**
   * Define a typed file store. Lazy — nothing executes until you await a method
   * on the returned {@link Store}, so it's safe to call at module scope.
   */
  defineStore(name: string, options?: DefineStoreOptions): Store;
}

/**
 * Create a Files namespace bound to a transport.
 *
 * @internal Called by MindStudioAgent; not part of the public API — access
 * `files` via the agent instance or the top-level export.
 */
export function createFiles(call: FilesTransport): Files {
  return {
    defineStore(name: string, options?: DefineStoreOptions): Store {
      return new Store(name, options?.access ?? 'private', call, {
        ...(options?.maxSize !== undefined ? { maxSize: options.maxSize } : {}),
        ...(options?.contentTypes ? { contentTypes: options.contentTypes } : {}),
      });
    },
  };
}
