/**
 * Mappers — customer code that turns raw objects into documents.
 *
 * A data source takes every object it is given as one document through
 * built-in extraction. When the file is not the document — a JSON record
 * that should become markdown plus metadata, a JSONL object that holds a
 * thousand articles, a kill notice that means "remove this story" — the
 * source declares a MAPPER: a `<slug>.mapper.ts` file beside the source's
 * definition, exporting `defineMapper(Source, { map })`.
 *
 * ```ts
 * // datasources/archive.mapper.ts
 * export default defineMapper(Archive, {
 *   map: async (object) => {
 *     if (!object.key.endsWith('.json')) return passthrough();
 *     const { item } = await object.json();
 *     if (item.pubstatus === 'canceled') return deletes([item.uri]);
 *     return documents([{
 *       externalId: item.uri,
 *       title: item.headline,
 *       markdown: toMarkdown(item),
 *       metadata: { date: item.versioncreated.slice(0, 10), language: item.language },
 *       replaces: item.altids?.original_id,
 *     }]);
 *   },
 * });
 * ```
 *
 * One object in, one of four outcomes out:
 * - `documents([...])` — the object becomes these documents (an array is
 *   one object → many). Each is `{ externalId, title, markdown, metadata?,
 *   replaces? }`; `externalId` is the identity the platform replaces by.
 * - `passthrough({ metadata? })` — ingest the raw object itself through
 *   built-in extraction, as an unmapped source would. What lets a mapped
 *   source still accept a PDF.
 * - `skip(reason)` — not a document. Quarantined on the job with the reason;
 *   an `add()` of a skipped object throws `mapper_skipped`.
 * - `deletes([externalId, ...])` — the live documents with these external ids
 *   are removed.
 * A thrown error is the object's `error` outcome: quarantined, the job goes on.
 *
 * `defineMapper` returns a CALLABLE — the executor — with the config attached
 * (the same pattern as `defineJewel`). The platform runs it as an ordinary
 * execution frame: one call maps a slice of objects and returns their
 * outcomes. Everything a method can do, a mapper can do — call models via
 * `runTask`, `fetch` an external API, read the app's tables — and every call
 * is spend per object. The mapper's `map` runs under a per-object timeout
 * (declared in `mindstudio.json`, default 30 s); the executor never throws.
 *
 * Declared in `mindstudio.json`:
 * ```json
 * "dataSources": [{ "slug": "archive", "mapper": { "path": "dist/datasources/archive.mapper.ts" } }]
 * ```
 * Everything that enters a mapped source is mapped: bulk jobs, connector
 * syncs, and `Source.add()` alike. Mapper fixes are re-applied with
 * `remy-admin datasources remap` from the platform's copy of each raw object.
 */

import type { DocumentMetadata } from '../datasources/source.js';

//////////////////////////////////////////////////////////////////////////////
// Types
//////////////////////////////////////////////////////////////////////////////

/** The raw object handed to `map`. Bytes are read lazily, once. */
export interface MapObject {
  /** The key the object is known by: a store key, a bucket key, a URL, a filename. */
  key: string;
  size: number | null;
  contentType: string | null;
  /** Bucket objects carry these; other origins report null. */
  etag: string | null;
  lastModified: string | null;
  /** Metadata the origin supplied (a manifest line's `metadata`), or null. */
  metadata: DocumentMetadata | null;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}

export interface MappedDocument {
  /**
   * The identity the platform replaces by. A later object producing the same
   * external id (a new version of the story) supersedes this document; a
   * `deletes([...])` naming it removes it. Filterable at search time via
   * `externalIdPrefix`.
   */
  externalId: string;
  title: string;
  /** The document's text. Chunked and embedded as markdown. */
  markdown: string;
  /** Scalars only, up to 16 keys — see `AddOptions.metadata`. */
  metadata?: DocumentMetadata;
  /** External ids this document replaces (a writethru's original id). */
  replaces?: string | string[];
}

export type MapOutcome =
  | { kind: 'documents'; documents: MappedDocument[] }
  | { kind: 'passthrough'; metadata?: DocumentMetadata }
  | { kind: 'skip'; reason: string }
  | { kind: 'deletes'; externalIds: string[] };

type MaybePromise<T> = T | Promise<T>;

export interface MapperConfig {
  /** One raw object in; an outcome out. Throwing is the object's `error` outcome. */
  map: (object: MapObject) => MaybePromise<MapOutcome>;
}

/** One object as the platform hands it to the executor: metadata plus a read URL. */
export interface MapRunObject {
  key: string;
  size: number | null;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  metadata: DocumentMetadata | null;
  /** Short-lived read URL for the object's bytes. */
  url: string;
  /**
   * The object's bytes, base64, when the platform already held them (it
   * hashes and lands every object before mapping, and small objects ride
   * along). Present, it is the bytes; `url` is the fallback for large objects
   * and for frames from a platform that predates it.
   */
  content?: string;
}

export interface MapRunParams {
  v: 1;
  objects: MapRunObject[];
  /** Per-object budget for `map`, in milliseconds. */
  timeoutMs?: number;
  /** Objects mapped at once inside the frame. */
  concurrency?: number;
}

export type MapRunOutcome =
  | MapOutcome
  | { kind: 'error'; error: { message: string; stack?: string } };

export interface MapRunResult {
  key: string;
  outcome: MapRunOutcome;
  durationMs: number;
}

/** What one executor call returns: one result per input object, in order. */
export interface MapRunRecord {
  v: 1;
  source: string;
  outcomes: MapRunResult[];
  startedAt: number;
  durationMs: number;
}

/** The callable executor with its config attached. */
export interface Mapper {
  (params: MapRunParams): Promise<MapRunRecord>;
  readonly kind: 'mapper';
  /** The data source's slug. */
  readonly source: string;
  readonly config: MapperConfig;
}

//////////////////////////////////////////////////////////////////////////////
// Outcome helpers
//////////////////////////////////////////////////////////////////////////////

/** The object becomes these documents. One document may be passed bare. */
export function documents(list: MappedDocument | MappedDocument[]): MapOutcome {
  return { kind: 'documents', documents: Array.isArray(list) ? list : [list] };
}

/** Ingest the raw object itself through built-in extraction. */
export function passthrough(options?: {
  metadata?: DocumentMetadata;
}): MapOutcome {
  return options?.metadata !== undefined
    ? { kind: 'passthrough', metadata: options.metadata }
    : { kind: 'passthrough' };
}

/** Not a document. Quarantined with the reason. */
export function skip(reason: string): MapOutcome {
  return { kind: 'skip', reason };
}

/** Remove the live documents with these external ids. */
export function deletes(externalIds: string | string[]): MapOutcome {
  return {
    kind: 'deletes',
    externalIds: Array.isArray(externalIds) ? externalIds : [externalIds],
  };
}

//////////////////////////////////////////////////////////////////////////////
// Runtime
//////////////////////////////////////////////////////////////////////////////

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CONCURRENCY = 4;

function errorInfo(e: unknown): { message: string; stack?: string } {
  if (e instanceof Error) return { message: e.message, stack: e.stack };
  return { message: String(e) };
}

/** Lazy, read-once object: inline bytes when the frame carried them, else the presigned URL. */
function objectFor(input: MapRunObject): MapObject {
  let cached: Promise<Uint8Array> | null = null;
  const bytes = () => {
    if (!cached) {
      cached =
        input.content !== undefined
          ? Promise.resolve(
              new Uint8Array(Buffer.from(input.content, 'base64')),
            )
          : (async () => {
              const response = await fetch(input.url);
              if (!response.ok) {
                throw new Error(
                  `Could not read ${input.key}: HTTP ${response.status}`,
                );
              }
              return new Uint8Array(await response.arrayBuffer());
            })();
    }
    return cached;
  };
  return {
    key: input.key,
    size: input.size,
    contentType: input.contentType,
    etag: input.etag,
    lastModified: input.lastModified,
    metadata: input.metadata,
    bytes,
    text: async () => new TextDecoder('utf-8').decode(await bytes()),
    json: async <T = unknown>() =>
      JSON.parse(new TextDecoder('utf-8').decode(await bytes())) as T,
  };
}

const OUTCOME_KINDS = new Set(['documents', 'passthrough', 'skip', 'deletes']);

/** Defensive: an untyped (JS) `map` can return garbage. */
function normalizeOutcome(value: unknown): MapRunOutcome {
  const outcome = value as MapOutcome | null | undefined;
  if (
    !outcome ||
    typeof outcome !== 'object' ||
    !OUTCOME_KINDS.has(outcome.kind)
  ) {
    return {
      kind: 'error',
      error: {
        message: `map returned an invalid outcome: ${JSON.stringify(value)?.slice(0, 200)}. Return documents(), passthrough(), skip() or deletes().`,
      },
    };
  }
  return outcome;
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  key: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`map timed out after ${timeoutMs}ms on ${key}`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Define a mapper — the code that turns each raw object entering a data
 * source into documents. See the module doc for the four outcomes.
 */
export function defineMapper(
  source: { readonly name: string },
  config: MapperConfig,
): Mapper {
  const run = async (params: MapRunParams): Promise<MapRunRecord> => {
    const startedAt = Date.now();
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const concurrency = Math.max(1, params.concurrency ?? DEFAULT_CONCURRENCY);
    const objects = Array.isArray(params.objects) ? params.objects : [];
    const outcomes: MapRunResult[] = new Array(objects.length);

    let next = 0;
    const worker = async () => {
      while (true) {
        const index = next++;
        if (index >= objects.length) return;
        const input = objects[index];
        const t = Date.now();
        let outcome: MapRunOutcome;
        try {
          outcome = normalizeOutcome(
            await withTimeout(
              Promise.resolve().then(() => config.map(objectFor(input))),
              timeoutMs,
              input.key,
            ),
          );
        } catch (e) {
          outcome = { kind: 'error', error: errorInfo(e) };
        }
        outcomes[index] = {
          key: input.key,
          outcome,
          durationMs: Date.now() - t,
        };
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(concurrency, objects.length) }, worker),
    );

    return {
      v: 1,
      source: source.name,
      outcomes,
      startedAt,
      durationMs: Date.now() - startedAt,
    };
  };

  return Object.assign(run, {
    kind: 'mapper' as const,
    source: source.name,
    config,
  });
}
