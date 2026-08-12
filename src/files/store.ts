import { createHash, randomUUID } from 'node:crypto';

import { MindStudioError } from '../errors.js';

/**
 * Access level of a file store. `private` (the default) → reads are signed /
 * session-authorized; `public` → CDN-served (public serving ships later).
 */
export type FileAccess = 'public' | 'private';

/** Options for {@link Store.put}. */
export interface PutOptions {
  /**
   * Object key within the store (nested paths allowed, e.g. `reports/q1.pdf`).
   * Omit to auto-generate a UUID key (with `filename`'s extension, if given).
   */
  key?: string;
  /** MIME type stored on the object and returned on read. */
  contentType?: string;
  /** Original filename — used only to derive an extension when `key` is omitted. */
  filename?: string;
  /**
   * When true (and no explicit `key`), derive the key from a content hash
   * (`<sha256>.<ext>`) instead of a random UUID — immutable + idempotent, so
   * re-uploading identical bytes yields the same key/URL. Ideal for public
   * assets baked into source.
   */
  contentAddressed?: boolean;
}

/** Options for {@link Store.list}. */
export interface ListOptions {
  /** Restrict to keys under this prefix (relative to the store). */
  prefix?: string;
  /** Pagination cursor from a previous page. */
  cursor?: string;
  /** Max objects per page. */
  limit?: number;
}

/** A stored object plus a ready-to-use URL. */
export interface StoredFile {
  store: string;
  key: string;
  access: FileAccess;
  size?: number;
  contentType?: string;
  updatedAt?: string;
  /**
   * Stable, on-domain URL for the app's own frontend — drop straight into
   * `<img src>`, `fetch`, or `<a download>`. Relative (resolves against the
   * app's origin); a same-origin logged-in request authorizes automatically
   * via the app session, so there's nothing to await.
   */
  url: string;
  /**
   * Mint an ABSOLUTE, signed share URL that works with **no** active session —
   * email it, or embed it on another site. Expires (default 24h). Private
   * stores only.
   */
  shareUrl(options?: { expiresIn?: number }): Promise<string>;
}

/**
 * A token for a client-direct upload, from {@link Store.createUploadToken}.
 * Return it from a backend method and pass it straight to the frontend's
 * `platform.upload(token, file)` — the browser then POSTs the file directly to
 * storage (no bytes through the platform).
 */
export interface UploadToken {
  /** The object key the upload will land at (within the store). */
  key: string;
  /** The stable on-domain URL the file will be readable at once uploaded. */
  url: string;
  /** @internal The scoped presigned POST the frontend submits to. */
  upload: { url: string; fields: Record<string, string> };
}

/** @internal Per-store upload policy carried from `defineStore`. */
export interface StorePolicy {
  maxSize?: number;
  contentTypes?: string[];
}

/** @internal Transport: `POST /_internal/v2/files/<op>` with the hook token. */
export type FilesTransport = (op: string, body: unknown) => Promise<any>;

function toBase64(content: Buffer | Uint8Array | string): string {
  return Buffer.from(
    typeof content === 'string' ? Buffer.from(content) : content,
  ).toString('base64');
}

function extensionFor(filename?: string): string {
  if (!filename) {
    return '';
  }
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot) : '';
}

/**
 * A typed handle to one named file store. Lazy — nothing executes until a
 * method is awaited, so it's safe to `defineStore()` at module scope and import
 * the handle into route handlers (same ergonomics as `db.defineTable`).
 */
export class Store {
  constructor(
    private readonly _store: string,
    private readonly _access: FileAccess,
    private readonly _call: FilesTransport,
    private readonly _policy: StorePolicy = {},
  ) {}

  /** The store's access level. */
  get access(): FileAccess {
    return this._access;
  }

  /** Store bytes. Returns a {@link StoredFile} with a ready-to-use `url`. */
  async put(
    content: Buffer | Uint8Array | string,
    options?: PutOptions,
  ): Promise<StoredFile> {
    const ext = extensionFor(options?.filename);
    const key =
      options?.key ??
      (options?.contentAddressed
        ? `${createHash('sha256').update(content).digest('hex')}${ext}`
        : `${randomUUID()}${ext}`);
    const meta = await this._call('put', {
      store: this._store,
      access: this._access,
      key,
      body: toBase64(content),
      ...(options?.contentType ? { contentType: options.contentType } : {}),
    });
    return this._toFile(key, meta);
  }

  /** Read an object's bytes (backend / trusted context). */
  async get(key: string): Promise<Buffer> {
    const res = await this._call('get', {
      store: this._store,
      access: this._access,
      key,
    });
    return Buffer.from(res.body, 'base64');
  }

  /** Metadata without downloading. Rejects if the object doesn't exist. */
  async head(key: string): Promise<StoredFile> {
    const meta = await this._call('head', {
      store: this._store,
      access: this._access,
      key,
    });
    return this._toFile(key, meta);
  }

  /** Whether an object exists. */
  async exists(key: string): Promise<boolean> {
    try {
      await this.head(key);
      return true;
    } catch {
      return false;
    }
  }

  /** List objects in the store (optionally under `prefix`), one page at a time. */
  async list(
    options?: ListOptions,
  ): Promise<{ files: StoredFile[]; cursor?: string }> {
    const res = await this._call('list', {
      store: this._store,
      access: this._access,
      ...(options?.prefix ? { prefix: options.prefix } : {}),
      ...(options?.cursor ? { cursor: options.cursor } : {}),
      ...(options?.limit ? { limit: options.limit } : {}),
    });
    return {
      files: (res.files ?? []).map((f: any) => this._toFile(f.key, f)),
      ...(res.cursor ? { cursor: res.cursor } : {}),
    };
  }

  /** Delete an object. No-op if it doesn't exist. */
  async delete(key: string): Promise<void> {
    await this._call('delete', {
      store: this._store,
      access: this._access,
      key,
    });
  }

  /**
   * Mint an {@link UploadToken} for a **client-direct** upload — the browser
   * POSTs the file straight to storage, so the bytes never pass through the
   * platform. Return the token from a backend method and hand it to the
   * frontend's `platform.upload(token, file)`. Works for private + public stores.
   *
   * Enforced at upload time by the presigned POST: a max size (this call's
   * `maxSize`, else the store's, else the platform default) and — when
   * `contentType` is set — an exact content-type match. When the store declares
   * `contentTypes`, `contentType` must be one of them.
   *
   * @example
   * ```ts
   * // backend method
   * export async function getUploadSlot(input: { contentType: string }) {
   *   return Uploads.createUploadToken({ contentType: input.contentType, maxSize: 50 * 1024 * 1024 });
   * }
   * ```
   */
  async createUploadToken(options?: {
    key?: string;
    contentType?: string;
    filename?: string;
    maxSize?: number;
    expiresIn?: number;
  }): Promise<UploadToken> {
    if (
      options?.contentType &&
      this._policy.contentTypes &&
      !this._policy.contentTypes.includes(options.contentType)
    ) {
      throw new MindStudioError(
        `contentType "${options.contentType}" is not allowed by store "${this._store}".`,
        'content_type_not_allowed',
        400,
      );
    }
    const key =
      options?.key ?? `${randomUUID()}${extensionFor(options?.filename)}`;
    const maxSize = options?.maxSize ?? this._policy.maxSize;
    const res = await this._call('create-upload', {
      store: this._store,
      access: this._access,
      key,
      ...(options?.contentType ? { contentType: options.contentType } : {}),
      ...(maxSize ? { maxSize } : {}),
      ...(options?.expiresIn ? { expiresIn: options.expiresIn } : {}),
    });
    return {
      key,
      url: `/_/files/${this._access}/${this._store}/${key}`,
      upload: { url: res.uploadUrl, fields: res.uploadFields },
    };
  }

  private _toFile(key: string, meta: any): StoredFile {
    const store = this._store;
    const access = this._access;
    const call = this._call;
    return {
      store,
      key,
      access,
      url: `/_/files/${access}/${store}/${key}`,
      ...(typeof meta?.size === 'number' ? { size: meta.size } : {}),
      ...(meta?.contentType ? { contentType: meta.contentType } : {}),
      ...(meta?.updatedAt ? { updatedAt: meta.updatedAt } : {}),
      async shareUrl(options?: { expiresIn?: number }): Promise<string> {
        const res = await call('sign', {
          store,
          access,
          key,
          ...(options?.expiresIn ? { expiresIn: options.expiresIn } : {}),
        });
        return res.url as string;
      },
    };
  }
}
