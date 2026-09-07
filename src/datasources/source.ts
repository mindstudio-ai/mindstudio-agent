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
   * Stable path on the app's own domain for the source document
   * (`/_/datasources/<sourceId>/documents/<documentId>`), the same shape as a
   * private file's `url`: a signed-in user's same-origin request authorizes
   * against their session and redirects to the file, so there's nothing to
   * sign or await. It is not a public link. For a public app or another
   * origin, mint one that needs no session the way you would for a file:
   * `search(q, { shareCitations: 3600 })` signs every citation in the response,
   * or {@link DataSource.shareUrl} signs one document on demand.
   */
  url: string;
}

/** A metadata value as stored on a document: scalars only. */
export type MetadataValue = string | number | boolean;

/**
 * Numeric range over a metadata value (inclusive both ends). Numbers only —
 * to range on dates, store them as sortable integers at add time (epoch
 * seconds or `20240315`-style YYYYMMDD) and range on those.
 */
export interface MetadataRange {
  gte?: number;
  lte?: number;
}

/**
 * Tags attached to a document when it's added — department, year, doc type,
 * a per-user scope — and matched by {@link SearchFilter.metadata} at query
 * time. Up to 16 keys per document; keys are alphanumeric with `_`/`-`.
 */
export type DocumentMetadata = Record<string, MetadataValue>;

/**
 * Which retrieval branches run for a search.
 *
 * - `hybrid` — semantic and keyword retrieval fused. The default.
 * - `semantic` — the embedding alone (what `hybrid: false` selects).
 * - `lexical` — keyword matching alone, with NO query embedding. The cheapest
 *   and fastest mode; right when the query is an identifier (an error code, a
 *   SKU, a name) rather than a meaning.
 */
export type SearchMode = 'hybrid' | 'semantic' | 'lexical';

/**
 * Narrow a search before ranking. Every condition ANDs with the others, and a
 * filter can only ever narrow — it runs inside your corpus, not across it.
 */
export interface SearchFilter {
  /**
   * Match document metadata set at add time. A scalar must equal; an array
   * matches any of its values; `{ gte?, lte? }` matches a numeric range. Keys
   * AND together:
   * `{ department: 'legal', year: [2025, 2026], publishedAt: { gte: 20250101 } }`.
   */
  metadata?: Record<string, MetadataValue | MetadataValue[] | MetadataRange>;
  /** Exact filename, or any of several. */
  filename?: string | string[];
  /** Restrict to specific documents (ids from {@link DataSource.documents}). */
  documentIds?: string[];
  /** Page range, inclusive — for paged formats like PDF. */
  pages?: { min?: number; max?: number };
  /** Chunk text must contain ALL of these words, in any order. */
  contains?: string;
  /** Chunk text must contain this exact word sequence, adjacent and in order. */
  phrase?: string;
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
  /**
   * Relevance of this hit. Comparable within a response, not across them —
   * the scale depends on how the search ran (check {@link SearchRan}):
   * cosine similarity in `semantic` mode, an RRF rank reciprocal in `hybrid`
   * (small numbers that are not similarities), keyword-overlap weight in
   * `lexical`. When reranking ran, it's the reranker's 0–1 relevance instead,
   * with the retrieval value preserved as `retrievalScore` — so rerank-on
   * `score` is the one scale that's stable across modes, and the right place
   * for quality cutoffs.
   */
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
  /**
   * Only when `highlight` was requested: where the query's most distinctive
   * terms land in `text`, as `text.slice(start, end)` ranges, each carrying the
   * `token` it matched so you can colour or group by term.
   *
   * NOT every query term — see {@link SearchOptions.highlight}. Keyword-based,
   * so a hit that matched semantically may report an empty array, which is
   * itself informative.
   */
  matches?: { start: number; end: number; token: string }[];
}

/**
 * What a search actually ran — as opposed to what was asked for.
 *
 * Worth checking when a result surprises you: an omitted `mode` falls back to
 * the corpus's own configuration, and `reranked` is false when reranking was
 * skipped or failed open. Absent only when the data source doesn't exist yet,
 * in which case nothing ran at all.
 */
export interface SearchRan {
  search: SearchMode;
  hybrid: boolean;
  reranked: boolean;
  /** Which build served the query. Changes when a re-vectorization is promoted. */
  pipelineVersion: number;
}

/**
 * Per-query overrides.
 *
 * These are the settings that are free to change: none of them touch a stored
 * vector, so they take effect on the next call and cost nothing. Anything that
 * would require rebuilding the corpus — chunking, the embedding model, whether
 * chunks are contextualized — is a property of the data source, configured
 * with `remy-admin datasources config` rather than passed here.
 *
 * The defaults come from the data source's own configuration, so most callers
 * should pass nothing.
 */
export interface SearchOptions {
  /** Results to return. Default 5, capped at 50. */
  topK?: number;
  /**
   * Floor on the RETRIEVAL score — applied to the retrieval branch, never to
   * the fused hybrid score or the reranker's score. In `semantic` and
   * `hybrid` modes it's a cosine floor on the embedding branch; in `lexical`,
   * a keyword-overlap floor. The scale depends on the embedding model, so
   * measure before using — and with reranking on, prefer cutting on each
   * hit's returned `score` (the reranker's 0–1 relevance) instead.
   */
  scoreThreshold?: number;
  /**
   * Narrow the search to matching chunks before ranking — by document
   * metadata, filename, document ids, page range, or required words/phrases.
   * See {@link SearchFilter}.
   */
  filter?: SearchFilter;
  /**
   * Which retrieval branches run. Defaults to the source's configuration
   * (hybrid). `'lexical'` skips the query embedding entirely — fastest, and
   * right for identifier-shaped queries. See {@link SearchMode}.
   */
  mode?: SearchMode;
  /**
   * At most this many hits per document, backfilled from other documents —
   * stops one document from monopolizing the results. Useful whenever the
   * answer should draw on several sources.
   */
  maxPerDocument?: number;
  /**
   * Return {@link SearchHit.matches} on each hit: where query terms land in its
   * text, for rendering highlights.
   *
   * Only the query's **distinctive** terms are marked. English function words —
   * `the`, `for`, `is`, `of` — are never marked, and when a passage holds more
   * matches than it can usefully show, the rarest terms win the space. So
   * `what is the policy for parental leave` marks `policy`, `parental` and
   * `leave`, and nothing else. Without that a natural-language query lights up
   * most of the passage and you would need your own stopword list to render
   * anything. Words you filtered on (`contains`, `phrase`) are always marked.
   */
  highlight?: boolean;
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
   * `hybrid: false` is the same as `mode: 'semantic'`; prefer `mode`, which
   * also offers `'lexical'`.
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
  /**
   * Return every `citation.url` as an absolute, signed link that works with
   * **no** session, valid for this many seconds (`true` = 24h; clamped to
   * 60s–90d). The same link {@link DataSource.shareUrl} mints one at a time,
   * done for the whole response in one round trip — the render path of a
   * public search tool. Each link is a bearer capability until it expires, so
   * sign at render time rather than storing signed results.
   */
  shareCitations?: number | true;
}

export interface AddOptions {
  /**
   * Required — the extension selects the extraction route. PDFs and office
   * formats go to a document model; text and CSV are read directly.
   */
  filename: string;
  contentType?: string;
  /**
   * Tags to attach — filterable at search time via
   * {@link SearchFilter.metadata}. Scalars only, up to 16 keys. Re-adding the
   * same bytes with different metadata updates the tags in place with no
   * re-processing; supplying metadata replaces the whole object.
   */
  metadata?: DocumentMetadata;
}

/** What {@link DataSource.add} returns. */
export interface AddResult {
  /**
   * The document, or the first of them on a mapped source. Null only when a
   * mapper answered `deletes` — nothing was added.
   */
  document: DataSourceDocument | null;
  /** Every document the bytes became. One entry on an unmapped source. */
  documents: DataSourceDocument[];
  /** Whether any of them was queued for a build (the rest were already current). */
  queued: boolean;
  /**
   * How the source took the bytes: `unmapped` (no mapper — the bytes are the
   * document), or the mapper's outcome.
   */
  outcome: 'unmapped' | 'documents' | 'passthrough' | 'deletes';
  /** Documents removed or superseded as a result — a `deletes` outcome, a `replaces`. */
  removed: number;
}

export interface DataSourceDocument {
  id: string;
  filename: string | null;
  status: 'processing' | 'done' | 'error';
  errorMessage: string | null;
  chunkCount: number | null;
  pageCount: number | null;
  /** Tags set at add time. See {@link AddOptions.metadata}. */
  metadata: DocumentMetadata | null;
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
 * Which documents a bulk removal selects. The row-level half of
 * {@link SearchFilter} — `metadata`, `filename`, `documentIds` — plus
 * `externalIdPrefix`, the identity a bulk job or S3 connector recorded for each
 * document (a customer's object key, say). Everything ANDs. Chunk-level fields
 * (`pages`, `contains`, `phrase`) do not select documents and are refused, and
 * so is an empty selector: whole-source deletion is an owner operation
 * (`remy-admin datasources delete`), never something app code does.
 */
export interface DocumentSelector {
  metadata?: Record<string, MetadataValue | MetadataValue[] | MetadataRange>;
  filename?: string | string[];
  documentIds?: string[];
  /** Documents whose recorded external id starts with this — e.g. a key prefix. */
  externalIdPrefix?: string;
}

/**
 * planning → planned → running ⇄ paused → done | failed | cancelled.
 *
 * A `planned` job is waiting for a human: its plan exceeded the budget or the
 * capacity of where the source lives (`error` says which), and the owner
 * approves it with `remy-admin datasources jobs approve <id>`.
 */
export type DataSourceJobState =
  | 'planning'
  | 'planned'
  | 'running'
  | 'paused'
  | 'done'
  | 'failed'
  | 'cancelled';

/**
 * What a job would cost before any of it is spent — an extrapolation from a
 * sample of about a hundred documents at today's rates. `credits` are in
 * nano-dollars; divide by 1e9 for dollars.
 */
export interface DataSourceJobPlan {
  objects: number;
  bytes: number;
  /**
   * Mapped sources only: what the mapper did with the sampled objects. The
   * skip share is the baseline the run's skip gate pauses against.
   */
  mapping: {
    objects: number;
    documentsPerObject: number;
    passthroughShare: number;
    skipShare: number;
    errorShare: number;
    deleteShare: number;
    secondsPerObject: number;
  } | null;
  projected: {
    documents: number;
    chunks: number;
    tokens: number;
    credits: {
      embedding: number;
      extraction: number;
      contextual: number;
      total: number;
    };
  };
  capacity: {
    placement: 'shared' | 'dedicated';
    maxPoints: number;
    heldPoints: number;
    /** False means the job will not run until the source moves or the resource grows. */
    fits: boolean;
  };
  durationMinutes: number;
  warnings: string[];
  computedAt: string;
}

/**
 * A bulk ingestion job — a sync, a corpus load started from the CLI, a remap
 * of a mapped source's raw copies, or a replay of an earlier job's quarantine.
 */
export interface DataSourceJob {
  id: string;
  state: DataSourceJobState;
  source:
    | { type: 'store'; store: string; access: string; prefix: string }
    | { type: 'manifest'; key: string }
    | { type: 'connector'; connectorId: string }
    | { type: 'sample'; fromDataSourceId: string; size: number }
    | { type: 'remap' }
    | { type: 'replay'; fromJobId: string; kind: 'skip' | 'error' | null };
  /** Objects the mapper skipped or failed on (mapped sources; zero otherwise). */
  quarantine: { skipped: number; errors: number };
  plan: DataSourceJobPlan | null;
  /** The ceiling this job pauses at, in dollars; null when none was set. */
  budgetDollars: number | null;
  /** Model spend so far at catalog rates — an estimate, not the ledger. */
  estimatedDollars: number;
  counts: {
    objectsSeen: number;
    documentsDone: number;
    documentsSkipped: number;
    documentsFailed: number;
    chunks: number;
  };
  /** Recent per-document failures, newest first, at most twenty. */
  samples: { ref: string; message: string; at: string }[];
  error: string | null;
  /**
   * Why a running job stopped: the owner, the budget, repeated batch
   * failures, or (mapped sources) a skip share far above the plan's.
   */
  pauseReason: 'user' | 'budget' | 'errors' | 'skips' | null;
  stalled: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Pages a single `removeWhere` call works through before returning. */
const REMOVE_WHERE_MAX_PAGES = 100;

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
   *
   * Alongside `results` and `latencyMs` comes {@link SearchRan} — what the
   * search actually did, which is the first thing to check when results don't
   * look like the options you passed.
   *
   * **Throws `index_warming`** (HTTP 503) when a large corpus's index is being
   * reloaded after an eviction: the platform keeps a working set of indexes
   * resident and reloads the rest on first use, which for a big source takes a
   * minute or two in the background. Treat it as "loading", never as "empty" —
   * tell the user the knowledge base is warming up and retry shortly. Small
   * corpora reload inside the search and never raise it. Sources on dedicated
   * capacity are never evicted, so they never raise it either; they raise
   * `capacity_hibernated` and friends instead when their capacity is parked.
   */
  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<{ results: SearchHit[]; mode?: SearchRan; latencyMs: number }> {
    const { results, mode, latencyMs } = await this._call('search', {
      slug: this._slug,
      query,
      ...(options?.topK !== undefined ? { topK: options.topK } : {}),
      ...(options?.scoreThreshold !== undefined
        ? { scoreThreshold: options.scoreThreshold }
        : {}),
      ...(options?.filter !== undefined ? { filter: options.filter } : {}),
      ...(options?.mode !== undefined ? { mode: options.mode } : {}),
      ...(options?.maxPerDocument !== undefined
        ? { maxPerDocument: options.maxPerDocument }
        : {}),
      ...(options?.highlight !== undefined
        ? { highlight: options.highlight }
        : {}),
      ...(options?.rerank !== undefined ? { rerank: options.rerank } : {}),
      ...(options?.hybrid !== undefined ? { hybrid: options.hybrid } : {}),
      ...(options?.explain !== undefined ? { explain: options.explain } : {}),
      ...(options?.expand !== undefined ? { expand: options.expand } : {}),
      ...(options?.shareCitations !== undefined
        ? { shareCitations: options.shareCitations }
        : {}),
    });
    return { results: results ?? [], mode, latencyMs: latencyMs ?? 0 };
  }

  /**
   * Mint an ABSOLUTE, signed link to one document that works with **no**
   * session — the same verb as `store.shareUrl()` for a file. Takes a
   * document id or anything carrying one (`hit.citation`). Expires (default
   * 24h; clamped to 60s–90d); each click still redirects to a fresh
   * short-lived storage URL, so the expiry you pass is the only one that
   * matters. For every citation of a search at once, pass
   * {@link SearchOptions.shareCitations} instead.
   */
  async shareUrl(
    document: string | { documentId: string },
    options?: { expiresIn?: number },
  ): Promise<string> {
    const documentId =
      typeof document === 'string' ? document : document.documentId;
    const res = await this._call('share', {
      slug: this._slug,
      documentId,
      ...(options?.expiresIn ? { expiresIn: options.expiresIn } : {}),
    });
    return res.url as string;
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
   *
   * **On a source with a mapper** (`dataSources[].mapper` in mindstudio.json,
   * see `defineMapper`) the bytes are a raw object and the mapper decides
   * what they become: `documents` holds everything it produced (one object
   * can become many documents), `document` is the first of them for
   * convenience, and `outcome` says which way the mapper went. A
   * `passthrough` is one document from the bytes themselves; a `deletes`
   * outcome removes the named documents and returns none. A document whose
   * `externalId` (or `replaces`) names an existing one supersedes it as soon
   * as the new one is registered, before its build lands; a search in that
   * window sees neither. **Throws `mapper_skipped`** (HTTP 422) when the
   * mapper skipped the object — a specific thing it refused, which the caller
   * should see — and `mapper_error` when the mapper threw.
   */
  async add(
    content: Buffer | Uint8Array | string,
    options: AddOptions,
  ): Promise<AddResult> {
    const bytes =
      typeof content === 'string' ? Buffer.from(content) : Buffer.from(content);
    return this._call('add', {
      slug: this._slug,
      filename: options.filename,
      ...(options.contentType ? { contentType: options.contentType } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
      body: bytes.toString('base64'),
    });
  }

  /**
   * Documents in the corpus, with ingest status.
   *
   * Without options this is the first thousand, newest first: enough to show
   * a small corpus, not a way to walk a large one (a corpus of any size is
   * loaded and inspected from the CLI). To follow what {@link add} just
   * queued, pass the ids it returned: `documents({ ids })` answers only those,
   * at most two hundred per call.
   */
  async documents(options?: {
    /** Only these documents (at most 200). */
    ids?: string[];
  }): Promise<DataSourceDocument[]> {
    const { documents } = await this._call('documents', {
      slug: this._slug,
      ...(options?.ids?.length ? { ids: options.ids } : {}),
    });
    return documents ?? [];
  }

  /** Remove a document and its vectors. */
  async remove(documentId: string): Promise<void> {
    await this._call('remove', { slug: this._slug, documentId });
  }

  /**
   * Remove every document matching a selector — by metadata tags, filename,
   * ids, or the external id prefix a bulk load or connector recorded.
   *
   * Works in pages of a thousand and keeps going until nothing matches (or a
   * very large removal has run for a hundred pages, in which case `remaining`
   * says how many are left and a second call continues). Vectors, the catalog
   * row and the stored bytes all go; the removal is immediate and shared
   * across dev and prod like every data-source write.
   *
   * ```ts
   * await Policies.removeWhere({ metadata: { department: 'legal', year: 2019 } });
   * await Policies.removeWhere({ externalIdPrefix: 'archive/2019/' });
   * ```
   */
  async removeWhere(
    selector: DocumentSelector,
  ): Promise<{ deleted: number; remaining: number }> {
    let deleted = 0;
    let remaining = 0;
    for (let page = 0; page < REMOVE_WHERE_MAX_PAGES; page++) {
      const result = await this._call('remove-many', {
        slug: this._slug,
        filter: selector,
      });
      deleted += result?.deleted ?? 0;
      remaining = result?.remaining ?? 0;
      if (remaining === 0 || !(result?.deleted > 0)) {
        break;
      }
    }
    return { deleted, remaining };
  }

  /**
   * Bring the source up to date with the S3 bucket it is connected to.
   *
   * Lists the bucket, diffs it against what was ingested before (by ETag), and
   * runs an ingestion job over what is new or changed; keys that disappeared
   * upstream are removed at the end when the connector's deletion policy says
   * so. Returns as soon as the job is started — it plans, then runs in the
   * background. Poll {@link job} for progress, or read the latest sync from
   * {@link jobs}.
   *
   * The job auto-approves under the connector's per-sync budget. A plan over
   * that budget, or over the capacity of where the source lives, waits in
   * `planned` for a human (`remy-admin datasources jobs approve <id>`) — so the
   * first backfill of a large bucket stops for approval by itself, and the
   * steady-state deltas run unattended. Nothing is spent when nothing changed.
   *
   * The connection itself — which bucket, which app secrets hold the keys — is
   * created by the app's owner with `remy-admin datasources connect`, never
   * from code. A nightly sync is an ordinary cron interface job whose method
   * calls this:
   *
   * ```ts
   * // methods/sync-archive.ts, scheduled "0 3 * * *" in the cron interface
   * export default async function () {
   *   await Archive.sync();
   * }
   * ```
   *
   * @throws `connector_not_found` when the source is not connected;
   *   `data_source_busy` while another job or a move is in flight.
   */
  async sync(options?: {
    /** Override the connector's per-sync budget for this run, in dollars. */
    budgetDollars?: number;
  }): Promise<{ job: DataSourceJob }> {
    return this._call('sync', {
      slug: this._slug,
      ...(options?.budgetDollars !== undefined
        ? { budgetDollars: options.budgetDollars }
        : {}),
    });
  }

  /** Recent ingestion jobs on this source (syncs and CLI loads), newest first. */
  async jobs(): Promise<DataSourceJob[]> {
    const { jobs } = await this._call('jobs', { slug: this._slug });
    return jobs ?? [];
  }

  /** One job by id — progress, plan, failures, and why it paused if it did. */
  async job(id: string): Promise<DataSourceJob> {
    const { job } = await this._call('job', { slug: this._slug, id });
    return job;
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
    return createHash('sha256')
      .update(Buffer.from(content as any))
      .digest('hex');
  }
}
