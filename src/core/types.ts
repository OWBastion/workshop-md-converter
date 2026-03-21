export interface NormalizedArticle {
  slug: string;
  title: string;
  description?: string;
  url: string;
  source: 'workshop';
  category?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  contentRaw: string;
  contentMarkdown: string;
  extra?: Record<string, unknown>;
}

export interface RenderResult {
  markdown: string;
  tokens: number;
  etag: string;
  lastModified?: string;
}

export interface WorkshopArticleRaw {
  [key: string]: unknown;
}

export interface WorkshopListRaw {
  data?: unknown;
  items?: unknown;
  articles?: unknown;
  [key: string]: unknown;
}
