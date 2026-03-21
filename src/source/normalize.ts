import type { NormalizedArticle, WorkshopListRaw } from '../core/types';
import type { Env } from '../env';
import { extractArticles, normalizeWorkshopArticle } from './workshop-adapter';

export function normalizeWorkshopList(raw: WorkshopListRaw, env: Env): NormalizedArticle[] {
  return extractArticles(raw).map((item) => normalizeWorkshopArticle(item, env));
}
