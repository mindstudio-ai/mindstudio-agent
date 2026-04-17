/**
 * System prompt builder for the `mindstudio ask` agent.
 *
 * Packs as much context as possible into the prompt to minimize tool
 * calls. Fetches live data (model summary, OAuth connections, connector
 * services) at startup and combines with the static llms.txt reference.
 *
 * Ordering follows Anthropic's long-context guidance:
 *   1. Identity (top — primacy effect)
 *   2. Reference docs (middle — bulk, available for lookup)
 *   3. Behavioral instructions (bottom — recency effect)
 *
 * All reference sections wrapped in XML tags per Anthropic guidance —
 * Claude is tuned to attend to XML structure.
 */

import type { MindStudioAgent } from '../../client.js';
import { identity } from './identity.js';
import { buildReferenceDocs } from './reference.js';
import { instructions } from './instructions.js';
import { playbook } from './playbook.js';

export { identity } from './identity.js';
export { buildReferenceDocs } from './reference.js';
export type { ReferenceData } from './reference.js';
export { instructions } from './instructions.js';
export { playbook } from './playbook.js';

export async function buildSystemPrompt(
  agent: MindStudioAgent,
): Promise<string> {
  // Fetch live data in parallel — degrade gracefully on failure
  const [modelsResult, connectionsResult, connectorsResult, llmsResult] =
    await Promise.allSettled([
      agent.listModelsSummary(),
      agent.listConnections(),
      agent.listConnectors(),
      import('../../generated/llms-content.js'),
    ]);

  const modelsSummary =
    modelsResult.status === 'fulfilled'
      ? modelsResult.value.models
          .map(
            (m: any) =>
              `- ${m.id} (${m.name}, type: ${m.type}${m.popularity != null ? ', popularity: ' + m.popularity : ''}${m.tags ? ', tags: ' + m.tags : ''})`,
          )
          .join('\n')
      : '(Could not load models — use the listModels tool to look them up)';

  const connections =
    connectionsResult.status === 'fulfilled' &&
    connectionsResult.value.connections.length > 0
      ? connectionsResult.value.connections
          .map((c) => `- ${c.provider}: ${c.name} (id: ${c.id})`)
          .join('\n')
      : 'No OAuth connections configured.';

  const connectorServices =
    connectorsResult.status === 'fulfilled'
      ? connectorsResult.value.services
          .map(
            (s) => `- ${s.id}: ${s.name} (${s.actions?.length ?? 0} actions)`,
          )
          .join('\n')
      : '(Could not load connectors — use the getConnectorDetails tool)';

  const llmsContent =
    llmsResult.status === 'fulfilled'
      ? llmsResult.value.llmsContent
      : '(Could not load action reference — use getActionDetails tool)';

  const referenceDocs = buildReferenceDocs({
    modelsSummary,
    connections,
    connectorServices,
    llmsContent,
  });

  return `${identity}\n\n${referenceDocs}\n\n${playbook}\n\n${instructions}\n\n<!-- cache_breakpoint -->`;
}
