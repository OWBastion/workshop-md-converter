# Workshop.code JSON -> Cloudflare Agent Markdown 转换器技术文档

## 1. 背景与目标

Workshop.code 现有 wiki 已支持在页面 URL 后附加 `.json` 返回结构化内容，例如：

- `/wiki/articles.json`
- 可扩展为 `/wiki/articles/:slug.json`

目标是在不破坏现有人类访问体验的前提下，为 AI agent 提供一个**稳定、低成本、可缓存、可预测**的 Markdown 输出层。该输出层需要尽量贴近 Cloudflare “Markdown for Agents” 的交互习惯，但不依赖 Cloudflare 原生的 HTML -> Markdown 自动转换能力来处理 JSON。

本项目不把问题定义为“任意文档转 Markdown”，而是定义为：

> 将 Workshop.code 的 wiki JSON 进行建模、清洗、规范化，并输出 agent-friendly Markdown。

---

## 2. 设计结论

### 2.1 推荐主方案

使用 **Cloudflare Workers + TypeScript** 实现一个边缘转换器：

1. 从源站拉取 wiki `.json`
2. 解析并适配为统一的内部文章结构
3. 对正文做“最小清洗”
4. 使用模板拼装 front matter + 正文 Markdown
5. 返回 `text/markdown; charset=utf-8`

### 2.2 为什么不直接依赖 Cloudflare 原生 Markdown for Agents

Cloudflare 原生 Markdown for Agents 适用于：

- 已有 HTML 页面
- 客户端通过 `Accept: text/markdown` 协商
- Cloudflare 网络在边缘将 HTML 按需转换为 Markdown

而本项目的数据源是 JSON，不是 HTML；并且我们希望控制字段映射、front matter、分段和元数据。因此：

- **原生 Markdown for Agents 不是主路径**
- **自定义 Worker 转换器才是主路径**
- 原生功能可作为未来补充，用于已有 HTML 页面或兜底能力

---

## 3. 非目标

以下不属于 V1 范围：

- 对任意富文本 / PDF / Office 文档做统一重型转换
- 对全部 HTML 做全量 DOM 级重建
- 摘要生成、标签推荐、语义改写
- 向量化、索引写入、RAG 服务端集成
- 多语言自动翻译

这些能力可在 V2/V3 增补。

---

## 4. 架构概览

```text
Client / Agent
   |
   | GET /wiki/articles/:slug.md
   | Accept: text/markdown
   v
Cloudflare Worker
   |
   |-- route resolve
   |-- fetch upstream JSON
   |-- workshop adapter
   |-- normalize article
   |-- sanitize content
   |-- render front matter + markdown body
   |-- set headers / cache
   v
Markdown Response
```

### 4.1 组件职责

- **路由层**：识别 `.md`、`.json`、`Accept` 协商、健康检查
- **源数据层**：向源站请求 JSON
- **适配层**：把 Workshop.code JSON 映射到统一结构
- **转换层**：做最小清洗、链接规范化、heading 修复、front matter 生成
- **响应层**：生成标准 Markdown 响应头、缓存头、诊断头

---

## 5. 核心技术选型

### 5.1 平台

- **Cloudflare Workers**
- 语言：**TypeScript**
- 部署：**Wrangler**

原因：

- 接近用户和 agent，适合做轻量转换与内容协商
- 请求/响应路径短，方便设置缓存与 header
- 成本低、实现简单、运维轻

### 5.2 依赖建议

V1 最小依赖：

- `linkedom`：轻量 HTML 片段解析
- `yaml`：生成 YAML front matter
- `html-entities` 或 `he`：HTML entity 解码

开发依赖：

- `typescript`
- `wrangler`
- `vitest`
- `@cloudflare/workers-types`

### 5.3 不建议作为主链路的能力

- `env.AI.toMarkdown()`：适合多格式文件转换，不适合本项目主路径
- Browser Rendering `/markdown`：适合动态页面渲染后再转 Markdown，不适合 JSON 直出主链路
- 原生 Markdown for Agents：适合 HTML，不适合作为 JSON 内容建模主方案

---

## 6. 输出契约

### 6.1 支持的访问方式

建议同时支持两种方式：

1. **显式路径**
   - `/wiki/articles.md`
   - `/wiki/articles/:slug.md`

2. **内容协商**
   - `Accept: text/markdown`
   - 对某些 HTML 或 API 包装路由返回 Markdown

### 6.2 推荐响应头

```http
Content-Type: text/markdown; charset=utf-8
Vary: Accept
Cache-Control: public, max-age=300, s-maxage=300
ETag: "..."
Last-Modified: ...
X-Agent-Content-Type: wiki-article
X-Source-Format: workshop-json
X-Markdown-Tokens: 1234
```

说明：

- `Vary: Accept`：兼容协商
- `X-Markdown-Tokens`：便于 agent 控制上下文窗口
- `X-Agent-Content-Type`：帮助下游 agent 做路由或分类

### 6.3 错误输出建议

普通 HTTP 错误即可，但建议返回 Markdown 文本，而不是 HTML 错页：

```md
---
title: Not Found
type: error
status: 404
---

# Article Not Found

The requested article could not be resolved from Workshop.code JSON.
```

---

## 7. 统一内部数据模型

无论上游 JSON 最终字段名是什么，进入转换层前都必须归一到统一模型。

```ts
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
```

### 7.1 统一模型原则

- `slug` 如果上游没有，需由 `title` 或路径派生
- `contentRaw` 保存源内容
- `contentMarkdown` 保存清洗后正文
- 未知字段放入 `extra`

---

## 8. Markdown 输出规范

### 8.1 单篇文章模板

```md
---
title: Hero Color Reference Table
description: Workshop.code wiki article
url: https://md.example/wiki/articles/hero-color-reference-table.md
source: workshop
slug: hero-color-reference-table
category: References
tags:
  - Color
  - Hero Color
created_at: 2026-03-17T19:20:21.209Z
updated_at: 2026-03-17T19:20:21.209Z
content_type: wiki-article
---

# Hero Color Reference Table

> Source: https://workshop.codes/wiki/articles/hero-color-reference-table
> Category: References
> Updated: 2026-03-17T19:20:21.209Z

## Content

...正文...
```

### 8.2 列表页模板

```md
---
title: Workshop.code wiki articles index
source: workshop
content_type: wiki-article-index
count: 102
generated_at: 2026-03-20T10:00:00.000Z
---

# Workshop.code Wiki Articles

## Articles

- [Hero Color Reference Table](https://md.example/wiki/articles/hero-color-reference-table.md)
  - category: References
  - updated_at: 2026-03-17T19:20:21.209Z
```

### 8.3 渲染约束

- front matter 使用 YAML
- 正文第一层标题统一为 `# {title}`
- 元数据区使用 blockquote 或 section
- 保留原本的代码块、表格、列表
- 不把样式层信息（字体、颜色、对齐）写入 Markdown

---

## 9. 清洗与转换策略

### 9.1 基本原则

**最小清洗，不重写正文语义。**

因为上游 `content` 很可能已经是 Markdown + 少量 HTML 的混合内容，所以不要把整段内容当“脏 HTML”再做全量 HTML -> Markdown 重转换。这样会破坏：

- 已存在的标题层级
- 代码块
- 表格
- 手工编写的链接和锚点

### 9.2 V1 清洗规则

1. **HTML entity 解码**
   - `\u003c` -> `<`
   - `&amp;` -> `&`

2. **移除无内容的展示型标签**
   - 空 `span`
   - 纯样式标签

3. **删除脚本与样式**
   - `<script>`
   - `<style>`

4. **处理少量可安全映射的标签**
   - `<br>` -> 空行
   - `<strong>` / `<b>` -> `**text**`
   - `<em>` / `<i>` -> `*text*`

5. **保留链接语义**
   - `<a href="...">x</a>` -> `[x](...)`
   - 相对链接转绝对链接（可选）

6. **删除表现层样式**
   - `style="color: ..."`
   - `font-size`
   - `text-align`

7. **规范标题与空白**
   - 连续 3 个以上空行压缩为 2 个
   - 标题前后补空行

### 9.3 V2 可选规则

- section 切分
- 自动目录
- 重复 heading 去重
- 锚点小写化
- 代码语言猜测

---

## 10. 路由设计

### 10.1 建议路由

```text
GET /healthz
GET /wiki/articles.md
GET /wiki/articles/:slug.md
GET /wiki/articles/:slug
```

### 10.2 路由优先级

1. `.md` 显式路由优先
2. 若无 `.md`，再判断 `Accept: text/markdown`
3. 若都不满足，保持现有 JSON/HTML 行为

### 10.3 示例

- `GET /wiki/articles/hero-color-reference-table.md` -> 返回单篇 Markdown
- `GET /wiki/articles/hero-color-reference-table` + `Accept: text/markdown` -> 返回单篇 Markdown
- `GET /wiki/articles.json` -> 仍返回 JSON

---

## 11. 缓存策略

### 11.1 缓存目标

减少：

- 上游 JSON 读取压力
- Worker CPU 时间
- 重复清洗与模板渲染

### 11.2 推荐策略

- 列表页：缓存 60~300 秒
- 单篇页：缓存 300~900 秒
- 当上游含 `updated_at` 时，将其写入 `Last-Modified`
- 基于 `article.slug + updated_at + rendererVersion` 生成 `ETag`

### 11.3 Cache Key 组成

```ts
cacheKey = `${pathname}::${acceptVariant}::${rendererVersion}`
```

### 11.4 失效方式

- 时间驱动 TTL
- 版本驱动（`RENDERER_VERSION`）
- 后续可增加 webhook 主动 purge

---

## 12. 可观测性

建议输出以下日志字段：

```ts
{
  traceId,
  route,
  upstreamUrl,
  articleSlug,
  status,
  cacheStatus,
  transformMs,
  bytesIn,
  bytesOut,
  tokenEstimate,
  rendererVersion
}
```

### 12.1 关键指标

- 请求数
- 4xx / 5xx 比例
- 上游 JSON 拉取耗时
- 转换耗时
- 缓存命中率
- 输出 token 估算

---

## 13. 安全与稳定性

### 13.1 基本要求

- 仅代理已允许的上游域名
- 禁止任意 URL 透传，避免 SSRF
- 对输出长度做上限保护
- 对 JSON 解析异常和字段缺失做降级

### 13.2 降级策略

- 若正文为空，仍输出 front matter + 标题
- 若列表接口失败，返回 Markdown 错误页
- 若单篇未找到，返回 404 Markdown

---

## 14. 测试策略

### 14.1 单元测试

覆盖以下函数：

- `decodeEntities`
- `stripStyleTags`
- `normalizeLinks`
- `buildFrontMatter`
- `renderArticleMarkdown`
- `negotiateMarkdown`

### 14.2 集成测试

使用 fixture：

- 输入：`article.sample.json`
- 输出：`article.expected.md`

断言：

- `content-type`
- `vary`
- front matter 字段
- heading 结构
- 链接格式
- 代码块不被破坏

### 14.3 回归测试样本

至少包含：

- 纯 Markdown 正文
- Markdown + HTML 混合
- 含样式标签
- 含 anchor 链接
- 含代码块
- 含表格
- 缺失 title / tags / updated_at

---

## 15. 版本演进路线

### V1

- 单篇 `.md`
- 列表 `.md`
- Accept 协商
- 最小清洗
- 缓存

### V2

- section 切分
- 摘要段
- related articles
- 锚点规范化
- token 估算增强

### V3

- 通过 `env.AI.toMarkdown()` 做异构文档 fallback
- Browser Rendering `/markdown` 动态页面兜底
- webhook purge
- MCP / RAG ingestion 输出模式

---

## 16. 项目结构

```text
workshop-md-converter/
├─ README.md
├─ package.json
├─ wrangler.json
├─ tsconfig.json
├─ vitest.config.ts
├─ src/
│  ├─ index.ts
│  ├─ env.d.ts
│  ├─ routes/
│  │  ├─ markdown.ts
│  │  ├─ api.ts
│  │  └─ health.ts
│  ├─ core/
│  │  ├─ types.ts
│  │  ├─ config.ts
│  │  ├─ errors.ts
│  │  └─ logger.ts
│  ├─ source/
│  │  ├─ fetch-json.ts
│  │  ├─ workshop-adapter.ts
│  │  └─ normalize.ts
│  ├─ transform/
│  │  ├─ clean-html.ts
│  │  ├─ normalize-links.ts
│  │  ├─ markdown-template.ts
│  │  ├─ sectionizer.ts
│  │  └─ tokens.ts
│  ├─ http/
│  │  ├─ negotiate.ts
│  │  ├─ response.ts
│  │  └─ cache-key.ts
│  └─ utils/
│     ├─ slug.ts
│     ├─ yaml.ts
│     └─ time.ts
├─ test/
│  ├─ fixtures/
│  │  ├─ article.sample.json
│  │  └─ article.expected.md
│  ├─ unit/
│  │  ├─ clean-html.test.ts
│  │  ├─ markdown-template.test.ts
│  │  └─ negotiate.test.ts
│  └─ integration/
│     └─ render-article.test.ts
└─ docs/
   ├─ ADR-001-architecture.md
   └─ TECH-SPEC.md
```

---

## 17. 各文件职责说明

### `src/index.ts`

Worker 入口。负责：

- 分发路由
- 调用 markdown handler
- 错误兜底

### `src/routes/markdown.ts`

处理：

- `.md` 路由
- `Accept: text/markdown`
- 列表与单篇分流

### `src/source/fetch-json.ts`

封装上游请求：

- 统一 `fetch`
- 超时
- 非 2xx 处理
- 响应大小限制

### `src/source/workshop-adapter.ts`

把上游 JSON 映射为内部模型：

- 兼容字段别名
- 组装 url / slug / description
- 容错

### `src/transform/clean-html.ts`

最小清洗器：

- entity 解码
- 样式去除
- 小规模 HTML -> Markdown 映射

### `src/transform/markdown-template.ts`

负责 front matter 和正文模板拼装。

### `src/http/negotiate.ts`

判断当前请求是否需要 Markdown：

- `.md`
- `Accept: text/markdown`

### `src/http/response.ts`

统一响应头、缓存头、ETag、`content-type`。

---

## 18. 关键接口定义

### 18.1 Env

```ts
export interface Env {
  UPSTREAM_BASE_URL: string;
  UPSTREAM_ARTICLES_PATH: string;
  RENDERER_VERSION: string;
  CACHE_TTL_SECONDS: string;
}
```

### 18.2 渲染接口

```ts
export interface RenderResult {
  markdown: string;
  tokens: number;
  etag: string;
  lastModified?: string;
}

export interface ArticleRenderer {
  render(article: NormalizedArticle): RenderResult;
}
```

---

## 19. AI Agent 执行说明

下面这段可以直接作为实现 agent 的执行指令。

### 19.1 Agent 目标

实现一个 Cloudflare Worker 项目，将 Workshop.code wiki JSON 转为 agent-friendly Markdown，并按本技术文档的目录结构组织代码。

### 19.2 Agent 必须遵守的约束

1. 使用 TypeScript
2. 使用 Cloudflare Workers 运行时
3. 不要把正文做全量 HTML -> Markdown 重转换
4. 优先保留原始 Markdown 结构
5. 只做最小清洗
6. 输出必须为 `text/markdown; charset=utf-8`
7. 必须支持 `.md` 路由
8. 必须支持 `Accept: text/markdown`
9. 必须写单元测试和至少 1 个集成测试
10. 必须生成 `README.md`

### 19.3 Agent 分步执行计划

#### Step 1
创建项目骨架：

- `package.json`
- `wrangler.jsonc`
- `tsconfig.json`
- `src/`
- `test/`

#### Step 2
定义内部模型和环境变量：

- `NormalizedArticle`
- `Env`
- 错误类型

#### Step 3
实现路由：

- `/healthz`
- `/wiki/articles.md`
- `/wiki/articles/:slug.md`
- `Accept: text/markdown`

#### Step 4
实现上游读取和适配层：

- 拉取 JSON
- 解析列表
- 按 slug 定位文章
- 映射为 `NormalizedArticle`

#### Step 5
实现最小清洗器：

- 删除 `<script>` / `<style>`
- entity 解码
- 小规模标签映射
- 空白规范化

#### Step 6
实现 Markdown 模板：

- front matter
- 标题
- 元数据区
- 正文

#### Step 7
实现响应头和缓存：

- `content-type`
- `vary`
- `etag`
- `cache-control`

#### Step 8
补测试与 README。

### 19.4 验收标准

以下全部通过才算完成：

- `curl /wiki/articles/hero-color-reference-table.md` 返回 `text/markdown`
- `curl /wiki/articles/hero-color-reference-table -H 'Accept: text/markdown'` 返回 Markdown
- front matter 完整
- 原始代码块未损坏
- 样式标签被剔除
- 404 返回 Markdown 错误页
- 测试通过

---

## 20. 样例伪代码

```ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/healthz') {
      return new Response('ok');
    }

    const wantsMarkdown =
      url.pathname.endsWith('.md') ||
      request.headers.get('accept')?.includes('text/markdown');

    if (!wantsMarkdown) {
      return fetch(request);
    }

    const route = resolveMarkdownRoute(url.pathname);

    if (route.kind === 'article') {
      const rawJson = await fetchArticlesJson(env);
      const article = findArticle(rawJson, route.articleRef);
      if (!article) return markdown404();

      const normalized = normalizeWorkshopArticle(article, env);
      const cleaned = cleanContent(normalized.contentRaw, normalized.url);
      const rendered = renderArticleMarkdown({
        ...normalized,
        contentMarkdown: cleaned,
      });

      return markdownResponse(rendered);
    }

    if (route.kind === 'index') {
      const rawJson = await fetchArticlesJson(env);
      const articles = normalizeWorkshopList(rawJson, env);
      const rendered = renderIndexMarkdown(articles);
      return markdownResponse(rendered);
    }

    return markdown404();
  },
};
```

---

## 21. 技术决策摘要

### ADR-001

**决策**：使用 Cloudflare Workers 自定义转换器，而不是把 JSON 丢给通用 Markdown 转换器。

**原因**：

- JSON 需要显式字段建模
- 正文可能已是 Markdown
- 需要稳定 front matter
- 需要可控 header / cache / error 行为

### ADR-002

**决策**：正文采用“最小清洗”而非“全量重写”。

**原因**：

- 避免破坏人工编写的 Markdown
- 降低实现复杂度
- 提高可预测性

### ADR-003

**决策**：把 Cloudflare 原生 Markdown for Agents 视作补充能力，而非主实现。

**原因**：

- 它针对 HTML 页面
- 本项目主输入是 JSON
- 自定义转换器更适合结构化输出

---

## 22. 参考实现优先级

### 第一周

- 项目骨架
- 单篇 `.md`
- 基本 front matter
- 最小清洗
- 单测

### 第二周

- 列表页 `.md`
- Accept 协商
- ETag / 缓存
- 集成测试

### 第三周

- 404 / 500 Markdown 错误页
- sectionizer
- token estimate
- 文档补全

---

## 23. 给实现 agent 的最终指令

请基于本技术文档创建一个可运行的 Cloudflare Worker 项目，优先完成 V1：

- 支持 `/wiki/articles.md`
- 支持 `/wiki/articles/:slug.md`
- 支持 `Accept: text/markdown`
- 输出 front matter + 正文 Markdown
- 只做最小清洗
- 提供测试和 README

如果遇到上游 JSON 字段名与预期不一致：

- 不要修改核心渲染器
- 只修改 `workshop-adapter.ts`
- 将未知字段保留在 `extra`

如果某篇文章正文已经是纯 Markdown：

- 不要再次重转换
- 直接进行最小清洗后输出
