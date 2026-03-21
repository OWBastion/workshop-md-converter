import type { NormalizedArticle, WorkshopListRaw } from '../core/types';
import { extractArticles, normalizeWorkshopArticle } from './workshop-adapter';

export function normalizeWorkshopList(raw: WorkshopListRaw, publicBaseUrl: string): NormalizedArticle[] {
  return extractArticles(raw).map((item) => normalizeWorkshopArticle(item, publicBaseUrl));
}
