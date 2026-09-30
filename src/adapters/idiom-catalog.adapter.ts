import type { IdiomEntry } from '../core/models';
import type { IdiomCatalogPort } from '../ports/idiom-catalog.port';
import { IDIOM_CATALOG } from './idiom-catalog.data';

export class IdiomCatalogAdapter implements IdiomCatalogPort {
  private readonly byIdiom = new Map<string, IdiomEntry>();

  constructor(data: readonly IdiomEntry[] = IDIOM_CATALOG) {
    for (const e of data) {
      const prev = this.byIdiom.get(e.idiom);
      if (prev) {
        // 同一词目在多书互见时合并别名，释义/出处保留最早的一条
        prev.aliases = [...new Set([...prev.aliases, ...e.aliases])];
      } else {
        this.byIdiom.set(e.idiom, { ...e, aliases: [...e.aliases] });
      }
    }
  }

  entries(): readonly IdiomEntry[] {
    return [...this.byIdiom.values()];
  }
}
