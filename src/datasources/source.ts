import { createHash } from 'node:crypto';

/** @internal Transport: `POST /_internal/v2/datasources/<op>` with the hook token. */
export type DataSourcesTransport = (op: string, body: unknown) => Promise<any>;

/** Where a retrieved chunk came from — enough to show the user the source. */
export interface Citation {
  documentId: string;
  filename: string | null;
  /** 1-based. Null for formats with no pagination (plain text, html). */
  pageNumber: number | null;
  /** Enclosing headings, outermost first. */
  headingPath: string[];
  /**
   * Region of the page this chunk came from, when the format had a layout to
   * measure — PDFs do, docx and plain text don't. Precise enough to highlight.
   */
  boundingBox?: {
    topLeftX: number;
    topLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
  };
  /**
   * Stable on-domain URL for the source document. Drop it in an `<a href>` —
   * a same-origin logged-in request authorizes automatically, so there's
   * nothing to await.
   */
  url: string;
}

export interface SearchHit {
  /** Provider relevance score. Comparable within a response, not across them. */
  score: number;
  /** The matched chunk, prefixed with its heading path for context. */
  text: string;
  citation: Citation;
}

/**
 * Per-query overrides.
 *
 * These are the settings that are free to change: none of them touch a stored
 * vector, so they take effect on the next call and cost nothing. Anything that
 * would require rebuilding the corpus — chunking, the embedding model, whether
 * chunks are contextualized — is a property of the data source, configured
 * with `mindstudio-prod datasources config` rather than passed here.
 *
 * The defaults come from the data source's own configuration, so most callers
 * should pass nothing.
 */
export interface SearchOptions {
  /** Results to return. Default 5, capped at 50. */
  topK?: number;
  /** Drop hits below this score. Provider-specific scale — measure before using. */
  scoreThreshold?: number;
  /**
   * Rerank results with a cross-encoder before returning them. On by default.
   *
   * Turn it off on a latency-sensitive path — it adds a round trip for a
   * meaningful ranking improvement, which is usually the right trade but not
   * always.
   */
  rerank?: boolean;
  /**
   * Combine semantic search with exact keyword matching. On by default.
   *
   * Keyword matching is what finds part numbers, error codes and proper nouns
   * that an embedding model never learned. Rarely worth disabling.
   */
  hybrid?: boolean;
}

export interface AddOptions {
  /**
   * Required — the extension selects the extraction route. PDFs and office
   * formats go to a document model; text and CSV are read directly.
   */
  filename: string;
  contentType?: string;
}

export interface DataSourceDocument {
  id: string;
  filename: string | null;
  status: 'processing' | 'done' | 'error';
  errorMessage: string | null;
  chunkCount: number | null;
  pageCount: number | null;
  createdAt: string;
  ingestedAt: string | null;
}

/**
 * A typed handle to one data source. Lazy — nothing executes until a method is
 * awaited, so it's safe to `defineDataSource()` at module scope and import the
 * handle into route handlers (same ergonomics as `db.defineTable` and
 * `files.defineStore`).
 */
export class DataSource {
  constructor(
    private readonly _slug: string,
    private readonly _call: DataSourcesTransport,
  ) {}

  get name(): string {
    return this._slug;
  }

  /**
   * Search the corpus.
   *
   * Returns chunks ranked by relevance, each with a citation. Searching a
   * source that doesn't exist yet returns no results rather than throwing —
   * code may name a corpus the build hasn't populated.
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<{ results: SearchHit[] }> {
    const { results } = await this._call('search', {
      slug: this._slug,
      query,
      ...(options?.topK !== undefined ? { topK: options.topK } : {}),
      ...(options?.scoreThreshold !== undefined
        ? { scoreThreshold: options.scoreThreshold }
        : {}),
      ...(options?.rerank !== undefined ? { rerank: options.rerank } : {}),
      ...(options?.hybrid !== undefined ? { hybrid: options.hybrid } : {}),
    });
    return { results: results ?? [] };
  }

  /**
   * Add a document to the corpus.
   *
   * Returns as soon as the document is queued — extraction and embedding run
   * in the background and take a while, so poll {@link documents} for status
   * rather than assuming the content is searchable on return.
   *
   * **Adding the same bytes twice is free.** Documents are content-addressed,
   * so a re-add is a no-op when this source has already processed those exact
   * bytes under its current configuration. Reconfiguring the source is what
   * makes a re-add do work again — and that is an explicit, owner-triggered
   * migration, never something a deploy causes.
   */
  async add(
    content: Buffer | Uint8Array | string,
    options: AddOptions,
  ): Promise<{ document: DataSourceDocument; queued: boolean }> {
    const bytes =
      typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    return this._call('add', {
      slug: this._slug,
      filename: options.filename,
      ...(options.contentType ? { contentType: options.contentType } : {}),
      body: bytes.toString('base64'),
    });
  }

  /** Every document in the corpus, with ingest status. */
  async documents(): Promise<DataSourceDocument[]> {
    const { documents } = await this._call('documents', { slug: this._slug });
    return documents ?? [];
  }

  /** Remove a document and its vectors. */
  async remove(documentId: string): Promise<void> {
    await this._call('remove', { slug: this._slug, documentId });
  }

  /**
   * Create the data source if it doesn't exist yet.
   *
   * Rarely needed — `add` and `search` both handle a missing source. Useful
   * when you want it to exist (and appear in the dashboard) before any
   * document has been added.
   */
  async ensure(name?: string): Promise<void> {
    await this._call('ensure', {
      slug: this._slug,
      ...(name ? { name } : {}),
    });
  }

  /**
   * @internal Content hash of some bytes, matching what the server computes.
   * Exposed for callers that want to check whether they already added a file.
   */
  static contentHash(content: Buffer | Uint8Array | string): string {
    return createHash('sha256').update(Buffer.from(content as any)).digest('hex');
  }
}
