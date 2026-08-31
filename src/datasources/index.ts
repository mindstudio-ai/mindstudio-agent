/**
 * The `dataSources` namespace — searchable document corpora for MindStudio
 * apps. The retrieval half of the platform's managed data layer, shaped like
 * `db` and `files`: declare a source at module scope, import the handle into
 * route handlers.
 *
 * ```ts
 * // datasources/policies.ts
 * import { dataSources } from '@mindstudio-ai/agent';
 * export const Policies = dataSources.defineDataSource('policies');
 *
 * // routes/ask.ts
 * import { Policies } from '../datasources/policies';
 *
 * const { results } = await Policies.search('what are the payment terms?');
 * const context = results.map((r) => r.text).join('\n\n');
 * ```
 *
 * The platform owns parsing, chunking, embedding, storage and isolation. You
 * declare what the corpus is and search it; every hit comes back with a
 * citation pointing at the source document.
 *
 * **Corpora are usually built at development time**, not through your app's
 * UI — the agent adds documents while building, and the app is a consumer.
 * `add()` exists for apps where users upload documents themselves.
 *
 * **A data source is live and shared.** Unlike database tables there is no dev
 * copy and no per-release isolation: adding or removing a document affects
 * what the deployed app retrieves, immediately. Scenarios never reset a data
 * source, and re-ingesting a large corpus costs real money.
 */

import { DataSource, type DataSourcesTransport } from './source.js';

export { DataSource } from './source.js';
export type {
  AddOptions,
  BranchPosition,
  Citation,
  DataSourceChunk,
  DataSourceDocument,
  DataSourceStats,
  DocumentMetadata,
  MetadataRange,
  MetadataValue,
  SearchExplain,
  SearchFilter,
  SearchHit,
  SearchMode,
  SearchOptions,
  SearchRan,
} from './source.js';

/** The `dataSources` namespace object. */
export interface DataSources {
  /**
   * Define a data source. Lazy — nothing executes until you await a method on
   * the returned {@link DataSource}, so it's safe to call at module scope.
   *
   * The source is created on first use if it doesn't exist, so naming one the
   * build hasn't populated yet is not an error; it just searches empty.
   */
  defineDataSource(name: string): DataSource;
}

/**
 * Create a DataSources namespace bound to a transport.
 *
 * @internal Called by MindStudioAgent; not part of the public API — access
 * `dataSources` via the agent instance or the top-level export.
 */
export function createDataSources(call: DataSourcesTransport): DataSources {
  return {
    defineDataSource(name: string): DataSource {
      return new DataSource(name, call);
    },
  };
}
