# 会话搜索

Pi 搜索是一个针对已提交会话条目的轻量查询接口。共享契约只返回稳定的命中标识；各实现可以扩展命中结果，附加后端特有的展示数据。

## 核心 API

```ts
export interface SessionSearchHit {
  /** Logical identifier of the session that owns the entry. */
  readonly sessionId: string;

  /** Logical identifier of the entry within that session. */
  readonly entryId: string;
}

export interface SessionSearchOptions {
  /** Restrict results to specific canonical entry types. */
  readonly entryTypes?: readonly Entry["type"][];

  /** Maximum number of hits to return. Backends may return fewer, not more. */
  readonly limit?: number;

  /** Abort signal for cancellation, e.g. search-as-you-type. */
  readonly signal?: AbortSignal;
}

export interface SessionSearch<T extends SessionSearchHit = SessionSearchHit> {
  search(text: string, options?: SessionSearchOptions): AsyncIterable<T>;
}
```

基础命中结果刻意保持最小化：`(sessionId, entryId)` 是在 JSONL、内存、SQLite FTS 与远程索引之间可移植的标识。片段（snippet）、时间戳、评分、元数据、偏移量以及排序语义都属于具体实现。

## 为什么用异步可迭代对象

`AsyncIterable` 让调用方可以尽早渲染部分结果、在拿到足够结果时停止迭代，并通过 `AbortSignal` 取消进行中的工作。防抖（debounce）仍然是 UI/调用方自己的职责；该 API 只提供取消原语。

```ts
let currentAbortController: AbortController | undefined;

async function updateResults(query: string) {
  currentAbortController?.abort();
  const controller = new AbortController();
  currentAbortController = controller;

  try {
    for await (const hit of search.search(query, { limit: 10, signal: controller.signal })) {
      render(hit);
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "AbortError") throw error;
  }
}
```

## 默认实现

### 扫描式搜索

可复用的扫描器把类会话的可读对象（`getMetadata`、`findEntries` 与 `getLabel`）适配为投影条目：

```ts
export interface SessionSearchCandidate {
  readonly entryId: string;
  readonly seq: number;
  readonly type: Entry["type"];
  readonly timestamp: number;
  readonly text: string;
  readonly fields?: Record<string, unknown>;
}

export interface ScanningSessionSearchHit extends SessionSearchHit {
  readonly timestamp: number;
  readonly snippet: string;
}
```

`SessionSearchCandidate` 是匹配前的扫描器输入：它包含可搜索文本、类型、序号以及可选的投影字段。扫描器把匹配的候选条目转换为公开的命中结果。

已打开的会话或存储可以直接扫描：

```ts
const search = createScanningSessionSearch(sessions);

for await (const hit of search.search("authentication", { limit: 10 })) {
  const session = sessionsById.get(hit.sessionId)!;
  const entry = await session.getEntry(hit.entryId);
  console.log(entry);
}
```

JSONL 不需要单独的公开搜索适配器。基于 JSONL 的代码可以在本地完成发现/加载，然后把加载好的存储传给同一个扫描器：

```ts
async function* jsonlReadables(jsonl: JsonlSessionRepoOptions, query: JsonlSessionListOptions = {}) {
  for (const metadata of await listJsonlSessionMetadata(jsonl, query)) {
    yield loadJsonlSessionStorage(jsonl, metadata);
  }
}

const search = createScanningSessionSearch((query) => jsonlReadables(jsonl, query));
```

扫描源不得在归 harness 所有的会话上调用 `SessionRepo.open()`，如果该操作可能会获取写者租约（writer lease）的话。JSONL 应使用只读的加载辅助函数；已打开的会话/存储可以直接扫描。

### SQLite FTS

SQLite 搜索暴露一种扩展命中结果：

```ts
export interface SqliteSessionSearchHit extends SessionSearchHit {
  readonly metadata: SqliteSessionMetadata;
  readonly timestamp: number;
  readonly score: number;
}
```

```ts
const search = createSqliteSessionSearch({ env, sqlite, databasePath });

for await (const hit of search.search("auth", {
  entryTypes: ["message", "compaction"],
  limit: 20,
})) {
  console.log(hit.sessionId, hit.entryId, hit.score);
}
```

FTS 表与触发器在首次非空搜索时惰性创建。FTS 首次创建时，SQLite 会从规范化的 `entries` 表执行一次性重建；此后 SQLite 触发器保持 FTS 与规范条目的插入、删除和载荷更新同步。这意味着 SQLite 搜索在提交后即是新鲜的，但也意味着当该数据库启用搜索时，FTS 触发器失败可能回滚规范的 SQLite 写入。

## 索引后端

搜索索引是后端自有的派生状态。共享包只导出查询 API；应用或后端包在需要显式维护索引时，可以自行定义写入器/投喂（feed）契约。

### 使用 Elasticsearch 的 JSONL 会话

这是应用自有的胶水层。核心提供查询契约与 JSONL 会话发现；Elastic 写入器契约是该适配器内部的。

```ts
import { Client } from "@elastic/elasticsearch";
import {
  scanningEntries,
  type JsonlSessionMetadata,
  type JsonlSessionRepoOptions,
  type SessionSearch,
  type SessionSearchHit,
  type SessionSearchOptions,
} from "@earendil-works/pi-agent-core";

// JSONL-backed code can provide this locally from existing JSONL list/load helpers.
async function* jsonlReadables(jsonl: JsonlSessionRepoOptions, options: { cwd?: string } = {}) {
  for (const metadata of await listJsonlSessionMetadata(jsonl, options)) {
    yield loadJsonlSessionStorage(jsonl, metadata);
  }
}

interface SearchIndexWriter<TItem> {
  apply(items: TItem[]): Promise<void>;
  flush?(): Promise<void>;
}

interface IndexedSessionSearch<T extends SessionSearchHit, TItem>
  extends SessionSearch<T>, SearchIndexWriter<TItem> {}

type ElasticSessionFeedItem =
  | { type: "upsert"; id: string; body: ElasticSessionDoc }
  | { type: "delete"; id: string };

interface ElasticSessionDoc {
  sessionId: string;
  entryId: string;
  seq: number;
  timestamp: number;
  cwd: string;
  text: string;
  metadata: JsonlSessionMetadata;
  fields?: Record<string, unknown>;
}

interface ElasticSessionSearchHit extends SessionSearchHit {
  readonly timestamp: number;
  readonly snippet: string;
  readonly score?: number;
}

class ElasticSessionSearch
  implements IndexedSessionSearch<ElasticSessionSearchHit, ElasticSessionFeedItem>
{
  constructor(
    private readonly client: Client,
    private readonly index: string,
  ) {}

  async apply(items: ElasticSessionFeedItem[]): Promise<void> {
    const operations = items.flatMap((item) => {
      if (item.type === "delete") {
        return [{ delete: { _index: this.index, _id: item.id } }];
      }
      return [{ index: { _index: this.index, _id: item.id } }, item.body];
    });

    if (operations.length > 0) await this.client.bulk({ operations });
  }

  async flush(): Promise<void> {
    await this.client.indices.refresh({ index: this.index });
  }

  async *search(
    text: string,
    options: SessionSearchOptions = {},
  ): AsyncIterable<ElasticSessionSearchHit> {
    const result = await this.client.search<ElasticSessionDoc>({
      index: this.index,
      size: options.limit ?? 20,
      query: {
        bool: {
          must: [{ match: { text } }],
        },
      },
    });

    for (const hit of result.hits.hits) {
      if (!hit._source) continue;
      if (options.signal?.aborted) throw options.signal.reason;
      yield {
        sessionId: hit._source.sessionId,
        entryId: hit._source.entryId,
        timestamp: hit._source.timestamp,
        snippet: hit._source.text,
        score: hit._score ?? undefined,
      };
    }
  }
}
```

追赶/重建任务可以不获取写者租约就把 JSONL 投影投喂进 Elasticsearch：

```ts
async function indexJsonlSessionsIntoElastic(
  jsonl: JsonlSessionRepoOptions,
  elastic: ElasticSessionSearch,
  options: { cwd?: string } = {},
): Promise<void> {
  for await (const session of jsonlReadables(jsonl, { cwd: options.cwd })) {
    const metadata = await session.getMetadata();
    for await (const candidate of scanningEntries(session)) {
      await elastic.apply([{
        type: "upsert",
        id: `${metadata.id}:${candidate.entryId}`,
        body: {
          sessionId: metadata.id,
          entryId: candidate.entryId,
          seq: candidate.seq,
          timestamp: candidate.timestamp,
          cwd: metadata.cwd,
          text: candidate.text,
          metadata,
          fields: candidate.fields,
        },
      }]);
    }
  }

  await elastic.flush();
}
```

## 正确性与失败边界

搜索索引是共享 API 的派生状态：应用可以重试、重建或将搜索标记为过期。后端特有的选择可能带来不同的权衡；SQLite FTS 使用同库触发器，因此在搜索初始化触发器之后，FTS 失败可能回滚规范的 SQLite 写入。

扫描源如果产出重复的 `sessionId` 值应当快速失败，因为基础命中标识是 `(sessionId, entryId)`。索引后端通常在其存储/索引层强制唯一性。

搜索的启用仍需要一个同步/索引层。后续工作应添加一个默认无操作的搜索索引接收器（sink，例如 `NOOP_SEARCH_INDEX_SINK`），让规范的写入位置可以无条件发出索引事件，类似于遥测在禁用时使用无操作实现的做法。
