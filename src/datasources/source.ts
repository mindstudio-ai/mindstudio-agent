import { createHash } from 'node:crypto';

/** @internal Transport: `POST /_internal/v2/datasources/<op>` with the hook token. */
export type DataSourcesTransport = (op: string, body: unknown) => Promise<any>;

/** Where a retrieved chunk came from — enough to show the user the source. */
export interface Citation {
  documentId: string;
  filename: string | null;
  /** 1-based. Null for formats with no pagination (plain text, html). */
  pageNumber: number | null;
  /**
   * Position within the document, 0-based.
   *
   * `(documentId, chunkIndex)` is the stable identity of a chunk — use it as
   * the key for an eval set or a regression check rather than matching on
   * `text`. Stable for as long as the corpus keeps its current configuration:
   * re-chunking a source (a different chunk size, say) moves the boundaries and
   * therefore renumbers, which is inherent rather than a wobble.
   */
  chunkIndex: number | null;
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

/** Where one retrieval branch put a hit, and what that branch scored it. */
export interface BranchPosition {
  /** 0-based position within that branch's own results. */
  rank: number;
  score: number;
}

/**
 * Which half of hybrid retrieval found a hit. Only present when `explain` was
 * requested — see {@link SearchOptions.explain}.
 */
export interface SearchExplain {
  /** Semantic (embedding) retrieval. Null if this branch didn't find the hit. */
  dense: BranchPosition | null;
  /** Keyword/IDF retrieval. Null when `hybrid` is off, or if it didn't find it. */
  lexical: BranchPosition | null;
  matchedVia: 'dense' | 'lexical' | 'both';
}

export interface SearchHit {
  /** Provider relevance score. Comparable within a response, not across them. */
  score: number;
  /** The matched chunk, prefixed with its heading path for context. */
  text: string;
  citation: Citation;
  /**
   * Where retrieval put this hit BEFORE reranking, and what it scored.
   *
   * With reranking on, `score` is the reranker's relevance score and this is
   * the retriever's — different quantities, so they're kept apart rather than
   * blended. Comparing `retrievalRank` with the hit's final position is how you
   * see what reranking actually did ("retrieved 7th, reranked to 1st").
   *
   * Named for the stage rather than the method: it's a fused hybrid score when
   * `hybrid` is on and a cosine similarity when it's off.
   */
  retrievalRank?: number;
  retrievalScore?: number;
  /** Only when `explain` was requested. */
  explain?: SearchExplain;
  /** Only when `expand` was requested. Outermost first, so `[...before, text, ...after]` reads in order. */
  neighbors?: { before: string[]; after: string[] };
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
  /**
   * Report which branch found each hit, and where each ranked it.
   *
   * A debugging aid, off by default because it costs two extra round trips: a
   * fused result carries one blended score, so the branches have to be asked
   * separately. Results and their order are identical either way — this only
   * adds {@link SearchHit.explain}.
   */
  explain?: boolean;
  /**
   * Also return this many chunks either side of each hit, in
   * {@link SearchHit.neighbors} — for showing a passage in context. 0-2.
   *
   * `text` is untouched, so citations and highlighting still point at the
   * chunk that actually matched.
   */
  expand?: number;
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

/** One chunk exactly as it was indexed. See {@link DataSource.chunks}. */
export interface DataSourceChunk {
  index: number;
  text: string;
  pageNumber: number;
  headingPath: string[];
  /**
   * Offsets into the page's extracted markdown. Null for PDFs, which carry a
   * `boundingBox` instead — there is no character stream to point into.
   */
  charStart: number | null;
  charEnd: number | null;
  boundingBox?: {
    topLeftX: number;
    topLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
  };
  /** base64 of a Float32Array. Only when `vectors: true` was passed. */
  vector?: string;
}

/** How a corpus was built and what is in it. See {@link DataSource.stats}. */
export interface DataSourceStats {
  /** False for a source nothing has created yet — everything else reads zero. */
  exists: boolean;
  documentCount: number;
  counts: {
    total: number;
    done: number;
    processing: number;
    error: number;
  };
  chunkCount: number;
  /** Original document bytes, not index size. */
  storageBytes: number;
  lastIngestedAt: string | null;
  /**
   * The configuration these documents were actually built with — not the
   * platform default, and not necessarily the newest. Changing it is an
   * explicit, owner-triggered migration.
   */
  pipeline: {
    version: number;
    embeddingModelId: string;
    dimensions: number;
    chunking: {
      strategy: string;
      version: number;
      maxChars: number;
      minChars: number;
      dropBlockTypes: string[];
    };
    contextual: { enabled: boolean; modelId: string | null };
    images: { describe: boolean; modelId: string | null };
  } | null;
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
   *
   * **Deterministic** for a fixed corpus and configuration: the same query
   * returns the same hits in the same order, so it's safe to build an eval set
   * or a regression check on top of it. There is no seed to set. Two things do
   * legitimately move the results: adding or removing documents, and changing
   * the corpus configuration — both of which you control.
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<{ results: SearchHit[]; latencyMs: number }> {
    const { results, latencyMs } = await this._call('search', {
      slug: this._slug,
      query,
      ...(options?.topK !== undefined ? { topK: options.topK } : {}),
      ...(options?.scoreThreshold !== undefined
        ? { scoreThreshold: options.scoreThreshold }
        : {}),
      ...(options?.rerank !== undefined ? { rerank: options.rerank } : {}),
      ...(options?.hybrid !== undefined ? { hybrid: options.hybrid } : {}),
      ...(options?.explain !== undefined ? { explain: options.explain } : {}),
      ...(options?.expand !== undefined ? { expand: options.expand } : {}),
    });
    return { results: results ?? [], latencyMs: latencyMs ?? 0 };
  }

  /**
   * What is in the corpus, and how it was built.
   *
   * Document and chunk counts, storage, and the embedding model and chunking
   * settings actually in effect — which is not the same as the platform
   * default, since a corpus keeps the configuration it was built with until
   * someone migrates it.
   */
  async stats(): Promise<DataSourceStats> {
    return this._call('stats', { slug: this._slug });
  }

  /**
   * Every chunk of one document, exactly as it was indexed.
   *
   * The direct answer to "why isn't this document coming back?" — search only
   * shows you the chunks that surface, which is no help when none do. Reading
   * how a document was actually split usually is.
   *
   * Pass `{ vectors: true }` to include each chunk's embedding. Large: roughly
   * 8KB per chunk, so a 500-chunk document is several megabytes.
   */
  async chunks(
    documentId: string,
    options?: { vectors?: boolean },
  ): Promise<DataSourceChunk[]> {
    const { chunks } = await this._call('chunks', {
      slug: this._slug,
      documentId,
      ...(options?.vectors ? { vectors: true } : {}),
    });
    return chunks ?? [];
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
