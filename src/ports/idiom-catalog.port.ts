import type { IdiomEntry } from '../core/models';

/** 成语词库端口：解析引擎只依赖此契约，不关心词库来源 */
export interface IdiomCatalogPort {
  entries(): readonly IdiomEntry[];
}
