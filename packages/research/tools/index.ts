import Ajv from 'ajv';
import type { ToolDefinition } from '../../contracts/index';
import { AppError, Store } from '../../storage/index';
import { createDelegationTools } from '../delegation/tools';
import { createEvidenceTools } from '../evidence/tools';
import { createHistoryTools } from '../history/tools';
import { createPricingTools } from '../pricing/tools';
import { createSourcesTools } from '../sources/tools';
import type { Spec, ToolContext } from './types';
export type { ToolContext } from './types';
const ajv = new Ajv({ allErrors: true });
export class Tools {
  private specs: Record<string, Spec>;
  constructor(private store: Store) {
    this.specs = Object.assign(
      {},
      createEvidenceTools(store),
      createPricingTools(store),
      createHistoryTools(store),
      createSourcesTools(store),
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

    return spec.execute(args, context);
  }
}
