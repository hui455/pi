# @earendil-works/pi-telemetry

面向 pi 包的厂商中立（vendor-neutral）遥测（telemetry）契约与类型化 schema 工具。

该包提供：

- 一个显式的、基于回调的 `TelemetryContext` / `TelemetrySpan` 契约；
- 一个共享的 `NOOP_TELEMETRY_CONTEXT`；
- 一个参考实现 `InMemoryTelemetryContext`；
- 可序列化的 schema 定义及从中推断出的 TypeScript 类型；
- 不包含导出器（exporter）、全局当前 span 状态，也不依赖任何遥测后端。

应用程序可以使用内存参考实现，或为 OpenTelemetry、Sentry、日志或其他后端提供适配器。pi 包显式传递遥测上下文，并分别定义各自的领域 schema。

## 目录

- [安装](#installation)
- [遥测概念](#telemetry-concepts)
- [核心上下文 API](#core-context-api)
- [适配器契约](#adapter-contract)
- [无操作上下文](#no-op-context)
- [内存参考适配器](#in-memory-reference-adapter)
- [适配器一致性](#adapter-conformance)
- [类型化 Schema](#typed-schemas)
  - [起始与完成属性](#start-and-completion-attributes)
- [Schema 元数据](#schema-metadata)
- [pi 包集成](#pi-package-integration)
- [安全与可移植性](#security-and-portability)
- [API 参考](#api-reference)
- [开发](#development)
- [许可证](#license)

## 安装

```bash
npm install @earendil-works/pi-telemetry
```

## 遥测概念

遥测描述程序在运行期间做了什么。本包使用 span、属性（attribute）、事件、状态和显式上下文来建模这些工作：

| 概念 | 通俗解释 |
|---|---|
| **Span** | 一次操作的时间记录，例如加载账户或发起 AI 请求。它在工作开始前开始，在工作完成时结束。 |
| **父子 span** | 操作可以包含更小的操作。一个请求 span 可能包含一次缓存查找和一次数据库查询。它们共同构成一棵显示时间花费在何处的树。 |
| **属性** | 附加到 span 上的具名事实，例如 `provider: "openai"`、`cache.hit: true` 或 `item_count: 12`。属性描述操作及其结果。 |
| **事件** | span 进行过程中某个时间点的具名事件，例如 `retry.scheduled` 或 `cache.lookup`。事件没有持续时间，可以携带自己的属性。 |
| **状态** | 操作的结果：`ok` 或 `error`。错误状态可以包含错误名称和消息。 |
| **上下文** | 标识新工作在 span 树中所属位置的句柄。从某个上下文启动 span，会使该 span 成为该上下文的子级。 |

例如，加载账户可能产生如下遥测：

```text
example.account.load                         span
├─ attributes: account.id=123, found=true   facts about the span
├─ event: example.cache.lookup              occurrence during the span
│  └─ attribute: cache.hit=false            fact about the event
└─ status: ok                               final outcome
```

span 是诊断数据，而非业务状态。记录它不能改变账户加载是否运行、成功、失败或被持久化。适配器将这些通用概念转换为 OpenTelemetry、Sentry、日志或其他后端使用的对应概念。

## 核心上下文 API

`TelemetryContext` 在回调周围启动一个 span。回调接收一个 `TelemetrySpan`，它同时作为子 span 的显式父上下文。

```typescript
import {
  NOOP_TELEMETRY_CONTEXT,
  type TelemetryContext,
} from '@earendil-works/pi-telemetry';

async function loadAccount(
  accountId: string,
  telemetryContext: TelemetryContext = NOOP_TELEMETRY_CONTEXT,
) {
  return telemetryContext.startSpan(
    {
      name: 'example.account.load',
      attributes: { 'example.account.id': accountId },
    },
    async (span) => {
      const account = await readAccount(accountId);
      span.setAttributes({ 'example.account.found': account !== undefined });
      return account;
    },
  );
}
```

将回调 span 传递给更底层的工作以创建显式嵌套：

```typescript
return telemetryContext.startSpan({ name: 'example.parent' }, async (parentSpan) => {
  return parentSpan.startSpan({ name: 'example.child' }, async (childSpan) => {
    childSpan.addEvent('example.cache.lookup', { 'example.cache.hit': true });
    return performWork();
  });
});
```

不存在公开的 `end()` 方法。`startSpan()` 负责结算（settlement），保持 span 开启直至回调的值或 promise 结算。对于以普通返回值表示的预期失败，请显式设置状态：

```typescript
return telemetryContext.startSpan({ name: 'example.save' }, async (span) => {
  const result = await save();
  if (!result.ok) {
    span.setStatus({
      status: 'error',
      error: { name: 'SaveError', message: result.reason },
    });
  }
  return result;
});
```

## 适配器契约

适配器实现 `TelemetryContext`，将通用 API 桥接到其后端。它必须：

- 创建子 span，并同步、恰好一次地调用回调；
- 保留回调的返回值与拒绝值；回调同步抛出后，返回以相同值拒绝的 promise；
- 保持原生 span 开启，直到返回的 promise 结算；
- 将正常完成视为 `ok`，将抛出/拒绝视为错误（除非已显式设置状态）；
- 重复调用 `setStatus()` 时后写覆盖；
- 合并 `setAttributes()` 调用，后定义的值替换先前的值，忽略 `undefined`；
- 录制方法保持同步、被动且不抛错；
- 忽略结算后的调用；
- 原子性地忽略失败的录制调用，抑制后端故障，同时仍恰好一次地执行业务回调。

适配器可以在内部激活后端原生的环境上下文以支持自动埋点，但 pi 代码始终通过 `TelemetryContext` 参数传播父上下文。导出器的缓冲、刷新、采样、后端 ID 和后端特定上下文对象均属于适配器。请使用[适配器一致性套件](#adapter-conformance)来检查这些可观察语义。

## 无操作上下文

当遥测为可选时，使用 `NOOP_TELEMETRY_CONTEXT`：

```typescript
import { NOOP_TELEMETRY_CONTEXT } from '@earendil-works/pi-telemetry';

const result = await NOOP_TELEMETRY_CONTEXT.startSpan(
  { name: 'example.operation' },
  () => runOperation(),
);
```

无操作上下文：

- 同步调用回调；
- 保留返回值与异步拒绝，并将同步抛出转换为以相同值拒绝的 promise；
- 使用一个共享的、冻结且惰性的 span，嵌套 span 也一样；
- 不检查或保留名称、属性、事件或状态。

## 内存参考适配器

`InMemoryTelemetryContext` 是与后端无关的参考实现。它适用于测试、本地诊断，以及有意在无导出器的情况下进行进程内捕获的应用程序：

```typescript
import { InMemoryTelemetryContext } from '@earendil-works/pi-telemetry';

const telemetry = new InMemoryTelemetryContext();

await telemetry.startSpan(
  { name: 'example.operation', attributes: { input: 'demo' } },
  async (span) => {
    span.addEvent('example.started');
    span.setAttributes({ output_count: 3 });
  },
);

console.log(telemetry.getSpans());
```

`getSpans()` 按 span 启动顺序返回分离的快照。每个 `RecordedTelemetrySpan` 包含确定性的数字 ID、父 ID、合并后的属性、有序事件、最终状态、结算状态和确定性的结束序列。它不记录时间戳。

该适配器可以安全地作为普通 `TelemetryContext` 使用，但存储无界且仅限进程内。为隔离测试或录制范围，请创建新实例；除非调用方的数据策略允许，否则不要捕获敏感属性。

## 适配器一致性

`@earendil-works/pi-telemetry/testing` 导出一套与运行器无关的一致性套件，以分组用例的形式组织。fixture 提供全新的上下文，并将后端已结束的 span 转换为规范化的 `RecordedTelemetrySpan` 快照：

```typescript
import {
  createTelemetryAdapterConformance,
  type TelemetryAdapterFixture,
} from '@earendil-works/pi-telemetry/testing';
import { describe, it } from 'vitest';

const conformance = createTelemetryAdapterConformance(async () => {
  const adapter = createMyTelemetryAdapter();
  return {
    context: adapter.context,
    getSpans: async () => adapter.normalizedSpans(),
    async [Symbol.asyncDispose]() {
      await adapter.close();
    },
  } satisfies TelemetryAdapterFixture;
});

for (const group of new Set(conformance.map((testCase) => testCase.group))) {
  describe(group, () => {
    for (const testCase of conformance.filter((candidate) => candidate.group === group)) {
      it(testCase.name, () => testCase.run());
    }
  });
}
```

该套件检查同步单次准入、结果与拒绝的同一性、自动与显式状态、属性合并、事件排序、结算后的惰性调用、嵌套与并发父子关系，以及不可读遥测负载故障的抑制。`getSpans()` 可能在返回前刷新异步导出器。testing 子路径使用 Node 的断言 API；根遥测包保持运行时中立。

## 类型化 Schema

底层 span API 有意接受开放的名称和属性包（attribute bag），以保持适配器的通用性。领域包可以定义封闭的、可序列化的 schema，并从中推断出精确的 TypeScript 类型。

```typescript
import {
  createTypedSpanStarter,
  defineTelemetrySchema,
} from '@earendil-works/pi-telemetry';

export const EXAMPLE_TELEMETRY_SCHEMA = defineTelemetrySchema({
  version: 1,
  spans: {
    'example.read': {
      description: 'Read one resource',
      parents: { kind: 'any' },
      startAttributes: {
        'example.resource': {
          type: 'string',
          required: true,
          values: ['account', 'project'],
          description: 'Resource kind',
        },
      },
      endAttributes: {
        'example.item_count': {
          type: 'number',
          description: 'Number of returned items',
        },
      },
      events: {
        'example.cache': {
          description: 'Cache lookup result',
          attributes: {
            'example.cache.hit': {
              type: 'boolean',
              required: true,
              description: 'Whether the cache contained the resource',
            },
          },
        },
      },
      status: {
        default: 'ok',
        errorWhen: 'The read throws or returns an error result',
      },
    },
  },
} as const);

const startSpan = createTypedSpanStarter(
  telemetryContext,
  [EXAMPLE_TELEMETRY_SCHEMA],
);
```

starter 为每个 span 暴露一个重载，并在编译时检查名称和属性。联合类型的名称必须在调用前收窄（narrow），以保留每个运行时名称与其属性 schema 之间的关系。其回调接收一个基于相同 schema 的子 starter，该 starter 已绑定到回调 span：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' },
  async (span, startChildSpan) => {
    span.addEvent('example.cache', { 'example.cache.hit': true });
    const accounts = await readAccounts();
    span.setAttributes({ 'example.item_count': accounts.length });

    await startChildSpan(
      'example.read',
      { 'example.resource': 'project' },
      async (childSpan) => {
        const projects = await readProjects();
        childSpan.setAttributes({ 'example.item_count': projects.length });
      },
    );

    return accounts;
  },
);
```

### 起始与完成属性

`startAttributes` 和 `endAttributes` 描述属性通常在何时已知，而非独立的运行时存储：

| Schema 字段 | 值如何被记录 | 必填性 |
|---|---|---|
| `startAttributes` | 在创建 span 时通过类型化 starter 的 `attributes` 参数传入 | 每个定义显式设置 `required: true` 或 `false` |
| `endAttributes` | 稍后通过限定 schema 的 span 的 `setAttributes()` 方法添加 | 始终可选 |

两组属性都会成为同一后端 span 上的普通属性。不存在单独的结束属性负载或结束回调。在前面的示例中，`example.resource` 在 `example.read` 开始时即可得知，而 `example.item_count` 只有在 `readAccounts()` 返回后才知道：

```typescript
await startSpan(
  'example.read',
  { 'example.resource': 'account' }, // required start attribute
  async (span) => {
    const accounts = await readAccounts();
    span.setAttributes({
      'example.item_count': accounts.length, // optional completion attribute
    });
    return accounts;
  },
); // resolving the callback settles the span
```

“结束”指完成补充（completion enrichment）：结束属性可以在回调活跃期间的任意时刻设置，且在不适用时可以省略。一次也不调用 `setAttributes()` 是合法的。这对早期失败、取消以及并非每条路径上都存在的提供商特定数据很重要。

重复的 `setAttributes()` 调用会合并到同一个属性包中。同一键后定义的值会替换先前的值，而 `undefined` 会被忽略。限定 schema 的方法只接受当前 span 声明的结束属性。

属性不会结束 span。回调中的返回、resolve、抛出或拒绝决定结算时机；`startSpan()` 执行实际的结束操作。结算后的适配器调用是惰性的（inert）。

starter 可以组合多个独立版本化的 schema：

```typescript
import { AGENT_TELEMETRY_SCHEMAS } from '@earendil-works/pi-agent-core';

const startAgentSpan = createTypedSpanStarter(
  telemetryContext,
  AGENT_TELEMETRY_SCHEMAS,
);
```

内联 schema 数组会自动保留其元组类型。单独声明的数组应使用 `as const`。数组中跨条目的重复 span 名称字面量会在编译时被拒绝；schema 在运行时不会被合并、检查或保留。

schema 派生类型会拒绝缺失的必填属性、未知键、无效的封闭集合值、未声明的事件以及空 schema 上的属性。结束属性始终是可选的补充；类型系统不要求必须调用 `setAttributes()`。

`defineTelemetrySchema()` 是一个类型化恒等函数。它返回普通的可 JSON 序列化数据，不执行任何运行时校验或父规则强制。

## Schema 元数据

支持的属性类型：

- `string`、`number` 和 `boolean`；
- `string[]`、`number[]` 和 `boolean[]`。

属性定义支持：

- `values`：标量值的封闭集合；
- `elementValues`：数组元素的封闭集合；
- `examples`：文档示例；
- `sensitive`：标记需要特殊处理的数据；
- `cardinality`：记录预期的 `low` 或 `high` 基数。

起始属性和事件属性声明 `required`。结束属性不声明；参见[起始与完成属性](#start-and-completion-attributes)。

父级元数据是描述性 schema 数据：

- `{ kind: 'any' }`：根 span 或任意调用方 span；
- `{ kind: 'root_or_external' }`：根 span 或 schema 之外的调用方自有 span；
- `{ kind: 'spans', spans: [...] }`：仅列出 schema 中的 span。

适配器无需理解 schema 对象。埋点辅助函数和测试使用它们来保持输出的名称和属性一致。

## pi 包集成

包职责有意拆分：

- `@earendil-works/pi-telemetry` 拥有厂商中立契约、无操作与内存参考上下文、schema 工具和适配器一致性套件；
- `@earendil-works/pi-ai` 在提供商请求选项中接受并传播 `telemetryContext`，但不拥有任何遥测 schema；
- `@earendil-works/pi-agent-core` 拥有并导出 pi 的 AI 请求与 harness schema、它们组合而成的只读 schema 元组，以及类型化 span 辅助函数。

```typescript
import {
  AGENT_TELEMETRY_SCHEMAS,
  AI_TELEMETRY_SCHEMA,
  HARNESS_TELEMETRY_SCHEMA,
  startAiSpan,
  startHarnessSpan,
} from '@earendil-works/pi-agent-core';
```

pi schema 使用 pi 自有的 `pi.ai.*`、`pi.harness.*` 和 `pi.session.*` 名称。适配器可以在不改变 pi 输出词汇的前提下将它们转换为后端约定。

## 安全与可移植性

遥测是进程内的诊断信息，不是持久化的应用状态。不要在记录、消息、快照或延迟句柄中持久化 `TelemetryContext`、`TelemetrySpan` 或后端原生的 trace 对象。

属性值有意限制为原始标量和数组。领域埋点应避免记录提示词（prompt）、补全内容、工具参数或输出、文件内容、提供商负载、请求头、凭据以及自由格式的错误详情，除非其 schema 和数据策略明确允许。

该包不使用 `AsyncLocalStorage` 或其他运行时特定的环境上下文 API。它适用于 Node.js、Bun、浏览器和 worker；后端适配器自行负责各自的运行时兼容性。

## API 参考

### 核心类型与值

| 导出项 | 用途 |
|---|---|
| `TelemetryContext` | 启动由回调管理的子 span |
| `TelemetrySpan` | 记录属性、事件和状态；同时充当子上下文 |
| `SpanOptions` | span 名称与可选的起始属性 |
| `SpanAttributes` / `AttributeValue` | 开放的适配器级属性包及支持的值 |
| `SpanStatus` | 显式的 `ok` 或 `error` 状态 |
| `NOOP_TELEMETRY_CONTEXT` | 用于禁用遥测的共享被动上下文 |
| `InMemoryTelemetryContext` | 具有确定性进程内录制的参考适配器 |
| `RecordedTelemetrySpan` | 规范化捕获的 span 快照 |
| `RecordedTelemetryEvent` | 规范化捕获的事件快照 |

### Schema 定义与推断

| 导出项 | 用途 |
|---|---|
| `defineTelemetrySchema()` | 可序列化 schema 数据的类型化恒等辅助函数 |
| `createTypedSpanStarter()` | 将父上下文绑定到一个或多个 schema 词汇表 |
| `TypedSpanStarter` | 具有递归子绑定回调的精确 starter 类型 |
| `TelemetrySchemaDefinition` | 顶层 schema 形态 |
| `TelemetrySpanDefinition` | span 元数据、父级、属性、事件与状态规则 |
| `TelemetryAttributeType` | 支持的标量与数组类型名 |
| `TelemetryAttributeMetadata` | 描述、敏感性与基数元数据 |
| `TelemetryAttributeDefinition` | 属性类型、允许的值、示例与元数据 |
| `TelemetryStartAttributeDefinition` | 带必填性的起始属性定义 |
| `TelemetryEventAttributeDefinition` | 带必填性的事件属性定义 |
| `TelemetryEventDefinition` | 事件描述与属性定义 |
| `TelemetryParentDefinition` | 开放、外部根或有限 schema 父级规则 |
| `TelemetrySchemaSpanName` | 声明的 span 名称的联合 |
| `TelemetrySchemaSpanStartAttributes` | 单个 span 的精确推断起始属性 |
| `TelemetrySchemaSpanEndAttributes` | 单个 span 的可选推断结束属性 |
| `TelemetrySchemaSpanEventName` | 单个 span 声明的事件的联合 |
| `TelemetrySchemaSpanEventAttributes` | 单个事件的精确推断属性 |
| `SchemaTelemetrySpan` | 限定到单个 schema span 的 span 视图 |
| `TelemetrySchemaSpanUnion` | schema 中所有 span 的可判别联合 |
| `InferStartAttributes` | 从起始定义推断的必填与可选值 |
| `InferOptionalAttributes` | 从结束定义推断的可选值 |
| `InferEventAttributes` | 从事件定义推断的必填与可选值 |
| `InferRequiredAndOptionalAttributes` | 带必填性定义的共享推断工具 |
| `ExactTelemetryAttributes` | 拒绝预期属性集之外的键 |

### 测试子路径

| 导出项 | 用途 |
|---|---|
| `createTelemetryAdapterConformance()` | 创建与运行器无关的适配器一致性用例 |
| `TelemetryAdapterFixture` | 单个用例的全新上下文与规范化快照读取器 |
| `TelemetryAdapterFixtureFactory` | 创建隔离的 fixture |
| `TelemetryAdapterConformanceCase` | 由测试运行器执行的分组用例 |

## 开发

在此包目录下：

```bash
npm test
npm run build
```

全仓库的类型检查、格式化、lint 和冒烟检查通过以下命令运行：

```bash
npm run check
```

## 许可证

MIT
