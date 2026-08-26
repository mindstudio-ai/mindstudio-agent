/**
 * The `analytics` namespace — read the app's OWN traffic and event analytics
 * from method code. The platform auto-tracks pageviews (and custom events via
 * the frontend's `analytics.track()`); this is the read side, so an app can
 * correlate real traffic with its own data — lifetime views next to each blog
 * post, "12 people reading now", conversion events beside the records that
 * produced them.
 *
 * One general read, `query()`, shaped like the Plausible/GA4 family:
 *
 * ```ts
 * import { analytics } from '@mindstudio-ai/agent';
 *
 * // Lifetime pageviews + unique visitors per page — top 10, all history.
 * const top = await analytics.query({
 *   metrics: ['pageviews', 'visitors'],
 *   dimensions: ['path'],
 *   dateRange: 'all',
 *   limit: 10,
 * });
 * // top.results[0] → { dimensions: { path: '/post/hello' },
 * //                    metrics: { pageviews: 4210, visitors: 1830 } }
 *
 * // Daily views for one post, full history.
 * const series = await analytics.query({
 *   metrics: ['pageviews'],
 *   dimensions: ['time'],
 *   granularity: 'day',
 *   filters: [['is', 'path', ['/post/hello']]],
 *   dateRange: 'all',
 * });
 *
 * // A whole page in one round trip — prefer this over a parallel burst.
 * const [kpis, byPage, byCountry] = await analytics.batch([
 *   { metrics: ['pageviews', 'visits', 'visitors'], dateRange: '30d' },
 *   { metrics: ['pageviews'], dimensions: ['path'], dateRange: '30d' },
 *   { metrics: ['visitors'], dimensions: ['country'], dateRange: '30d' },
 * ]);
 * ```
 *
 * Reads are rate limited per app (600/min; each query in a batch counts as
 * one, and the SDK retries a single 429 automatically). Don't swallow
 * `rate_limited` errors into empty data — surface them or retry.
 *
 * **How far back a query can look depends on its shape.** Queries whose
 * filters are all `is` and touch at most ONE dimension read a rollup kept
 * forever — full lifetime history, exact unique visitors. Cross-dimension
 * intersections (`views of /post/x from mobile`), `is_not`, and `contains`
 * scan raw events retained for 90 days; the server clamps the window and says
 * so (`meta.source`, `meta.clamped`). Metrics a shape can't carry come back
 * in `meta.metricsOmitted`, never as silent zeros.
 *
 * The specials cover reads that aren't group-bys: `live()` (who's on the app
 * right now), `sources()` (per-session first-source ranking, classified),
 * `map()` (city points), `aiSources()` (AI-assistant referrals by vendor),
 * and `crawlers.*` (bot/crawler ingestion).
 *
 * Analytics is app-scoped and comes from production traffic — a method
 * running in the dev sandbox reads the LIVE app's real data, which is what
 * you want while building an admin view.
 */

/** @internal Transport bound by the client: POST /_internal/v2/analytics/<op>. */
export type AnalyticsTransport = (op: string, body: unknown) => Promise<any>;

export type AnalyticsMetric = 'pageviews' | 'visitors' | 'visits' | 'events';

export type AnalyticsDimension =
  | 'path'
  | 'referrerHost'
  | 'sourceCategory'
  | 'country'
  | 'city'
  | 'deviceType'
  | 'browser'
  | 'os'
  | 'language'
  | 'visitorType'
  | 'utmSource'
  | 'utmMedium'
  | 'utmCampaign'
  | 'utmTerm'
  | 'utmContent'
  | 'eventName';

export type AnalyticsFilterOp = 'is' | 'is_not' | 'contains';

/**
 * `[op, dimension, values]`. `is` matches any of the values; `is_not`
 * excludes all of them (rows missing the dimension still match); `contains`
 * is case-insensitive substring. Only `is` filters can be served from the
 * lifetime rollup — the others read the 90-day event table. `city` filters
 * take plain city names (matching any country) and always read the 90-day
 * event table.
 */
export type AnalyticsFilter = [AnalyticsFilterOp, AnalyticsDimension, string[]];

export type AnalyticsGranularity = '5m' | 'hour' | 'day' | 'week' | 'month';

/** Shorthand ("30d", "all") or explicit `[startISO, endISO]`. Default "24h". */
export type AnalyticsDateRange =
  | '1h'
  | '24h'
  | '7d'
  | '30d'
  | '90d'
  | 'all'
  | [string, string];

export interface AnalyticsQuerySpec {
  /** At least one of: pageviews, visitors, visits, events. */
  metrics: AnalyticsMetric[];
  /** At most one entity dimension OR `'time'` (not both, yet). */
  dimensions?: (AnalyticsDimension | 'time')[];
  /**
   * Required when `'time'` is in dimensions. With `dateRange: 'all'` it is
   * a minimum — the server coarsens automatically once the app's history
   * outgrows the grain.
   */
  granularity?: AnalyticsGranularity;
  /** IANA zone for calendar grains (day/week/month boundaries). Default UTC. */
  timezone?: string;
  filters?: AnalyticsFilter[];
  dateRange?: AnalyticsDateRange;
  /** Grouped queries only: one `['pageviews' | 'events', 'asc' | 'desc']`. */
  orderBy?: ['pageviews' | 'events', 'asc' | 'desc'][];
  /** Grouped queries only. Default 25, max 1000. */
  limit?: number;
  offset?: number;
  /** Scope to one release (rarely needed — analytics is app-wide). */
  releaseId?: string;
}

export interface AnalyticsQueryResultRow {
  /** Group keys: the entity dimension and/or `time` (bucket-start ISO). */
  dimensions: Record<string, string>;
  /** Only the requested-and-available metrics appear. */
  metrics: Partial<Record<AnalyticsMetric, number>>;
}

export interface AnalyticsQueryResponse {
  results: AnalyticsQueryResultRow[];
  meta: {
    /** Which store answered: 'rollup' = lifetime, 'events' = 90-day raw. */
    source: 'rollup' | 'events';
    window: { requested: [string, string]; served: [string, string] };
    /** True when an events-path window was cut to the retention horizon. */
    clamped: boolean;
    /** Requested metrics this query shape can't carry. */
    metricsOmitted?: AnalyticsMetric[];
    /** Grouped queries: unpaginated distinct-group count, for paging. */
    total?: number;
  };
}

/** Shared options for the special reads (same grammar as `query`). */
export interface AnalyticsReadOptions {
  dateRange?: AnalyticsDateRange;
  filters?: AnalyticsFilter[];
  releaseId?: string;
  limit?: number;
  offset?: number;
}

export interface LiveNow {
  /** Visitors on the app right now. */
  count: number;
  countries: { country: string; count: number }[];
  /** Last hour of live-count samples, one per minute. `ts` is an ISO string. */
  sparkline: { ts: string; count: number }[];
}

export interface TopSource {
  sourceType: 'utm' | 'referrer' | 'direct';
  sourceLabel: string;
  visits: number;
  uniqueVisitors: number;
  /** ai_assistant | search | social | email | direct | other. */
  category: string;
  /** Vendor display name for classified hosts (e.g. "OpenAI"), else null. */
  vendor: string | null;
}

export interface MapPoint {
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  pageviews: number;
  uniqueVisitors: number;
}

export interface AiSourceVendor {
  vendor: string;
  pageviews: number;
  uniqueVisitors: number;
  hosts: string[];
}

export interface CrawlerOverview {
  totalHits: number;
  byVendor: { vendor: string; count: number }[];
  topPages: { path: string; count: number }[];
}

export interface CrawlerBucket {
  start: string;
  total: number;
  byVendor: Record<string, number>;
}

export interface CrawlerHit {
  id: string;
  releaseId: string;
  path: string;
  host: string | null;
  botVendor: string;
  botName: string;
  country: string | null;
  createdAt: string;
}

/** The `analytics` namespace object. */
export interface Analytics {
  /** The general read: metrics × dimensions × filters × time. */
  query(spec: AnalyticsQuerySpec): Promise<AnalyticsQueryResponse>;
  /**
   * Up to 10 queries in one round trip, results in request order — the right
   * shape for a page composed of several reads (KPIs + timeseries + a few
   * breakdowns), instead of a parallel burst of `query()` calls competing
   * with each other against the per-app rate limit. Each query in the batch
   * counts as one read against the limit. One invalid query fails the whole
   * batch (the error names its index).
   */
  batch(specs: AnalyticsQuerySpec[]): Promise<AnalyticsQueryResponse[]>;
  /** Who's on the app right now (Redis presence, no time window). */
  live(): Promise<LiveNow>;
  /**
   * Ranked traffic sources — each session attributed to its first pageview's
   * source (UTM > referrer > direct), classified by category/vendor. Always
   * reads raw events (90-day window).
   */
  sources(
    options?: AnalyticsReadOptions,
  ): Promise<{ results: TopSource[]; total: number }>;
  /** City-level visitor points with coordinates. */
  map(
    options?: AnalyticsReadOptions,
  ): Promise<{ points: MapPoint[]; total: number }>;
  /** AI-assistant referral traffic, aggregated per vendor. */
  aiSources(
    options?: Omit<AnalyticsReadOptions, 'filters' | 'offset'>,
  ): Promise<{
    results: AiSourceVendor[];
    hosts: { host: string; pageviews: number; uniqueVisitors: number }[];
  }>;
  /** Bot / AI-crawler ingestion of the app's pages. */
  crawlers: {
    overview(
      options?: Omit<AnalyticsReadOptions, 'filters' | 'limit' | 'offset'> & {
        topPagesLimit?: number;
      },
    ): Promise<CrawlerOverview>;
    timeseries(
      options?: Omit<AnalyticsReadOptions, 'filters' | 'limit' | 'offset'> & {
        buckets?: number;
      },
    ): Promise<{ buckets: CrawlerBucket[] }>;
    recent(
      options?: Pick<AnalyticsReadOptions, 'dateRange' | 'releaseId' | 'limit'>,
    ): Promise<{ results: CrawlerHit[] }>;
  };
}

/**
 * Create an Analytics namespace bound to a transport.
 *
 * @internal Called by MindStudioAgent; not part of the public API — access
 * `analytics` via the agent instance or the top-level export.
 */
export function createAnalytics(call: AnalyticsTransport): Analytics {
  return {
    query(spec) {
      return call('query', spec);
    },
    async batch(specs) {
      const res = await call('query-batch', { queries: specs });
      return res.results;
    },
    live() {
      return call('live', {});
    },
    sources(options) {
      return call('sources', options ?? {});
    },
    map(options) {
      return call('map', options ?? {});
    },
    aiSources(options) {
      return call('ai-sources', options ?? {});
    },
    crawlers: {
      overview(options) {
        return call('crawlers-overview', options ?? {});
      },
      timeseries(options) {
        return call('crawlers-timeseries', options ?? {});
      },
      recent(options) {
        return call('crawlers-recent', options ?? {});
      },
    },
  };
}
