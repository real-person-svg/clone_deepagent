import Ajv from 'ajv';
import type { ToolDefinition } from '../../contracts/index';
import { AppError, Store } from '../../storage/index';
import { createDelegationTools } from '../delegation/tools';
import { createComparisonTools } from '../evidence/comparison';
import { createEvidenceTools } from '../evidence/tools';
import { createHistoryTools } from '../history/tools';
import { createPricingTools } from '../pricing/tools';
import { createSourcesTools } from '../sources/tools';
import { researchLimits } from '../sources/budget';
import { createWebSearchTools } from '../sources/search-tools';
import type { Spec, ToolContext } from './types';
export type { ToolContext } from './types';
const ajv = new Ajv({ allErrors: true });
export class Tools {
  private specs: Record<string, Spec>;
  constructor(private store: Store) {
    this.specs = Object.assign(
      {},
      createEvidenceTools(store),
      createComparisonTools(store),
      createPricingTools(store),
      createHistoryTools(store),
      createSourcesTools(store),
      createWebSearchTools(store),
      createDelegationTools(store)
    );
  }
  definitions(names: string[]): ToolDefinition[] {
    return names
      .filter((n) => n in this.specs)
      .map((name) => ({
        type: 'function',
        function: {
          name,
          description: this.specs[name].description,
          parameters: this.specs[name].schema,
        },
      }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
    allowed: string[]
  ) {
    if (!allowed.includes(name) || !this.specs[name])
      throw new AppError(403, `工具 ${name} 不在当前 Agent 权限中`);
    if (context.signal.aborted) throw new Error('任务已停止');
    const spec = this.specs[name],
      validate = ajv.compile(spec.schema);
    if (!validate(args)) throw new Error(`工具参数不合法：${ajv.errorsText(validate.errors)}`);

    const data = await spec.execute(args, context);
    if (context.runId) {
      const ids = new Set<string>();
      const collect = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          if (
            ['id', 'evidenceId', 'oldEvidenceId', 'newEvidenceId'].includes(key) &&
            typeof item === 'string' &&
            this.store.get("SELECT id FROM evidence WHERE id=? AND kind IN ('upload','web')", item)
          )
            ids.add(item);
          else if (item && typeof item === 'object') collect(item);
        }
      };
      if (
        ['query_evidence', 'fetch_source', 'normalize_pricing', 'compare_snapshots'].includes(name)
      )
        collect(data);
      this.store.tx(() => {
        for (const id of ids)
          this.store.exec('INSERT OR IGNORE INTO run_evidence VALUES(?,?)', context.runId, id);
      });
    }
    if (context.runId && ['search_web', 'fetch_source'].includes(name)) {
      const run = this.store.run(context.runId);
      const limits = researchLimits(run.prompt);
      const used = this.store.all<{ name: string; n: number }>(
        "SELECT name,count(*) n FROM tool_calls WHERE runId=? AND name IN ('search_web','fetch_source') GROUP BY name",
        context.runId
      );
      return {
        ...(data as Record<string, unknown>),
        budget: {
          searchesRemaining: Math.max(
            0,
            limits.searches - (used.find((r) => r.name === 'search_web')?.n || 0)
          ),
          pagesRemaining: Math.max(
            0,
            limits.pages - (used.find((r) => r.name === 'fetch_source')?.n || 0)
          ),
        },
      };
    }
    return data;
  }
}
