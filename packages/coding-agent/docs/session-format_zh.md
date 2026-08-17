# 会话文件格式

会话以 JSONL（JSON Lines）文件存储。每行是一个带 `type` 字段的 JSON 对象。会话条目通过 `id`/`parentId` 字段构成树状结构，从而无需创建新文件即可原地分支。

## 文件位置

```
~/.pi/agent/sessions/--<path>--/<timestamp>_<uuid>.jsonl
```

其中 `<path>` 是工作目录，`/` 替换为 `-`。

## 删除会话

删除 `~/.pi/agent/sessions/` 下对应的 `.jsonl` 文件即可移除会话。

Pi 也支持从 `/resume` 交互式删除会话（选择一个会话后按 `Ctrl+D`，然后确认）。可用时，pi 使用 `trash` CLI 以避免永久删除。

## 会话版本

会话在头部有一个版本字段：

- **版本 1**：线性条目序列（旧版，加载时自动迁移）
- **版本 2**：带 `id`/`parentId` 链接的树结构
- **版本 3**：将 `hookMessage` 角色重命名为 `custom`（扩展统一）

已有会话在加载时会自动迁移到当前版本（v3）。

## 源文件

GitHub 上的源码（[pi-mono](https://github.com/earendil-works/pi-mono)）：
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - 会话条目类型和 SessionManager
- [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/messages.ts) - 扩展消息类型（BashExecutionMessage、CustomMessage 等）
- [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/types.ts) - 基础消息类型（UserMessage、AssistantMessage、ToolResultMessage）
- [`packages/agent/src/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/agent/src/types.ts) - AgentMessage 联合类型

要在你的项目中查看 TypeScript 定义，请查看 `node_modules/@earendil-works/pi-coding-agent/dist/` 和 `node_modules/@earendil-works/pi-ai/dist/`。

## 消息类型

会话条目包含 `AgentMessage` 对象。理解这些类型对于解析会话和编写扩展至关重要。

### 内容块

消息包含类型化内容块的数组：

```typescript
interface TextContent {
  type: "text";
  text: string;
}

interface ImageContent {
  type: "image";
  data: string;      // base64 encoded
  mimeType: string;  // e.g., "image/jpeg", "image/png"
}

interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

interface ToolCall {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

### 基础消息类型（来自 pi-ai）

```typescript
interface UserMessage {
  role: "user";
  content: string | (TextContent | ImageContent)[];
  timestamp: number;  // Unix ms
}

interface AssistantMessage {
  role: "assistant";
  content: (TextContent | ThinkingContent | ToolCall)[];
  api: string;
  provider: string;
  model: string;
  usage: Usage;
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
  errorMessage?: string;
  timestamp: number;
}

interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: (TextContent | ImageContent)[];
  details?: any;      // Tool-specific metadata
  usage?: Usage;      // Nested LLM work performed by the tool
  isError: boolean;
  timestamp: number;
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}
```

导出的 pi-ai `StopReason` 类型还包含 `"pending"`，但该值仅保留给流事件中的部分消息。终端 `done`/`error` 消息会在 pi 持久化助手消息之前将其替换为完成原因，因此 `"pending"` 不应出现在会话 JSONL 中。

### 扩展消息类型（来自 pi-coding-agent）

```typescript
interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  fullOutputPath?: string;
  excludeFromContext?: boolean;  // true for !! prefix commands
  timestamp: number;
}

interface CustomMessage {
  role: "custom";
  customType: string;            // Extension identifier
  content: string | (TextContent | ImageContent)[];
  display: boolean;              // Show in TUI
  details?: any;                 // Extension-specific metadata
  timestamp: number;
}

interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;                // Entry we branched from
  timestamp: number;
}

interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}
```

### AgentMessage 联合

```typescript
type AgentMessage =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CustomMessage
  | BranchSummaryMessage
  | CompactionSummaryMessage;
```

## 条目基类

所有条目（`SessionHeader` 除外）都继承 `SessionEntryBase`：

```typescript
interface SessionEntryBase {
  type: string;
  id: string;           // 8-char hex ID
  parentId: string | null;  // Parent entry ID (null for first entry)
  timestamp: string;    // ISO timestamp
}
```

## 条目类型

### SessionHeader

文件的第一行。仅元数据，不属于树（没有 `id`/`parentId`）。

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project"}
```

对于有父会话的会话（通过 `/fork`、`/clone` 或 `newSession({ parentSession })` 创建）：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"2024-12-03T14:00:00.000Z","cwd":"/path/to/project","parentSession":"/path/to/original/session.jsonl"}
```

### SessionMessageEntry

对话中的一条消息。`message` 字段包含一个 `AgentMessage`。

```json
{"type":"message","id":"a1b2c3d4","parentId":"prev1234","timestamp":"2024-12-03T14:00:01.000Z","message":{"role":"user","content":"Hello"}}
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop"}}
{"type":"message","id":"c3d4e5f6","parentId":"b2c3d4e5","timestamp":"2024-12-03T14:00:03.000Z","message":{"role":"toolResult","toolCallId":"call_123","toolName":"bash","content":[{"type":"text","text":"output"}],"isError":false}}
```

### ModelChangeEntry

用户在会话中途切换模型时发出。

```json
{"type":"model_change","id":"d4e5f6g7","parentId":"c3d4e5f6","timestamp":"2024-12-03T14:05:00.000Z","provider":"openai","modelId":"gpt-4o"}
```

### ThinkingLevelChangeEntry

用户更改思考/推理等级时发出。

```json
{"type":"thinking_level_change","id":"e5f6g7h8","parentId":"d4e5f6g7","timestamp":"2024-12-03T14:06:00.000Z","thinkingLevel":"high"}
```

### CompactionEntry

上下文被压缩时创建。存储较早消息的摘要。

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","firstKeptEntryId":"c3d4e5f6","tokensBefore":50000}
```

较新由 harness 生成的压缩会把压缩后保留的上下文直接嵌入条目，而不是使用 `firstKeptEntryId`：

```json
{"type":"compaction","id":"f6g7h8i9","parentId":"e5f6g7h8","timestamp":"2024-12-03T14:10:00.000Z","summary":"User discussed X, Y, Z...","tokensBefore":50000,"retainedTail":[{"role":"user","content":"latest request"},{"role":"assistant","content":[{"type":"text","text":"latest reply"}],"provider":"anthropic","model":"claude-sonnet-4-5","usage":{...},"stopReason":"stop"}]}
```

可选字段：
- `usage`：生成摘要时的 LLM 用量；计入会话 token 和成本总计
- `retainedTail`：压缩后保留的具体化 `AgentMessage[]`。它仅为了与旧会话向后兼容而可省略。较新由 harness 生成的压缩会包含它，这样我们就能直接从这个检查点重建上下文，而不必遍历压缩条目之前的旧条目。
- `details`：实现特有的数据（默认如 `{ readFiles: string[], modifiedFiles: string[] }`，或扩展的自定义数据）
- `fromHook`：由扩展生成时为 `true`，pi 生成时为 `false`/`undefined`（旧字段名）
- `firstKeptEntryId`：用于兼容旧条目格式。

### BranchSummaryEntry

通过 `/tree` 切换分支并带有 LLM 生成的对所离开分支直至共同祖先的摘要时创建。捕获被放弃路径的上下文。

```json
{"type":"branch_summary","id":"g7h8i9j0","parentId":"a1b2c3d4","timestamp":"2024-12-03T14:15:00.000Z","fromId":"f6g7h8i9","summary":"Branch explored approach A..."}
```

可选字段：
- `usage`：生成摘要时的 LLM 用量；计入会话 token 和成本总计
- `details`：文件跟踪数据（默认 `{ readFiles: string[], modifiedFiles: string[] }`），或扩展的自定义数据
- `fromHook`：由扩展生成时为 `true`，pi 生成时为 `false`/`undefined`（旧字段名）

### CustomEntry

扩展状态持久化。**不**参与 LLM 上下文。

```json
{"type":"custom","id":"h8i9j0k1","parentId":"g7h8i9j0","timestamp":"2024-12-03T14:20:00.000Z","customType":"my-extension","data":{"count":42}}
```

用 `customType` 在重新加载时识别你的扩展的条目。交互模式可以通过 `pi.registerEntryRenderer(customType, renderer)` 渲染自定义条目，但它们仍然不参与 LLM 上下文。

### CustomMessageEntry

扩展注入的**确实**参与 LLM 上下文的消息。

```json
{"type":"custom_message","id":"i9j0k1l2","parentId":"h8i9j0k1","timestamp":"2024-12-03T14:25:00.000Z","customType":"my-extension","content":"Injected context...","display":true}
```

字段：
- `content`：字符串或 `(TextContent | ImageContent)[]`（与 UserMessage 相同）
- `display`：`true` = 在 TUI 中以独特样式显示，`false` = 隐藏
- `details`：可选的扩展特有元数据（不发送给 LLM）

### LabelEntry

用户定义的条目书签/标记。

```json
{"type":"label","id":"j0k1l2m3","parentId":"i9j0k1l2","timestamp":"2024-12-03T14:30:00.000Z","targetId":"a1b2c3d4","label":"checkpoint-1"}
```

将 `label` 设置为 `undefined` 可清除标记。

### SessionInfoEntry

会话元数据（例如用户定义的显示名称）。通过 `/name`、`--name` / `-n` 或在扩展中调用 `pi.setSessionName()` 设置。

```json
{"type":"session_info","id":"k1l2m3n4","parentId":"j0k1l2m3","timestamp":"2024-12-03T14:35:00.000Z","name":"Refactor auth module"}
```

设置后，会话选择器（`/resume`）会显示会话名称而不是第一条消息。

## 树结构

条目构成一棵树：
- 第一条条目的 `parentId: null`
- 每个后续条目通过 `parentId` 指向其父条目
- 分支会从较早的条目创建新的子节点
- "叶子"（leaf）是树中的当前位置

```
[user msg] ─── [assistant] ─── [user msg] ─── [assistant] ─┬─ [user msg] ← current leaf
                                                            │
                                                            └─ [branch_summary] ─── [user msg] ← alternate branch
```

## 上下文构建

`buildContextEntries()` 从当前叶子节点向根节点遍历，在尊重压缩的前提下生成活动条目列表：

1. 收集路径上的所有条目
2. 如果路径上有 `CompactionEntry`：
   - 先包含压缩条目
   - 如果存在 `retainedTail`，它作为自包含检查点，包含压缩之后的条目
   - 否则包含从 `firstKeptEntryId` 到压缩条目的条目
   - 然后包含压缩之后的条目
3. 在选定范围内保留非消息条目，使交互模式可以渲染它们

`buildSessionContext()` 基于该条目列表生成发送给 LLM 的消息列表：

1. 从完整路径中提取当前模型和思考等级设置
2. 将选定的条目转换为消息：
   - `message` -> 存储的 `AgentMessage`
   - `compaction` -> `compactionSummary`，存在 `retainedTail` 时附加
   - `branch_summary` -> `branchSummary`
   - `custom_message` -> `CustomMessage`
   - `custom` -> 无上下文消息

这样较新的压缩就像自包含的检查点。`retainedTail` 只是可选的，以便只存 `firstKeptEntryId` 的旧会话仍能正确加载。

## 解析示例

```typescript
import { readFileSync } from "fs";

const lines = readFileSync("session.jsonl", "utf8").trim().split("\n");

for (const line of lines) {
  const entry = JSON.parse(line);

  switch (entry.type) {
    case "session":
      console.log(`Session v${entry.version ?? 1}: ${entry.id}`);
      break;
    case "message":
      console.log(`[${entry.id}] ${entry.message.role}: ${JSON.stringify(entry.message.content)}`);
      break;
    case "compaction":
      console.log(`[${entry.id}] Compaction: ${entry.tokensBefore} tokens summarized`);
      break;
    case "branch_summary":
      console.log(`[${entry.id}] Branch from ${entry.fromId}`);
      break;
    case "custom":
      console.log(`[${entry.id}] Custom (${entry.customType}): ${JSON.stringify(entry.data)}`);
      break;
    case "custom_message":
      console.log(`[${entry.id}] Extension message (${entry.customType}): ${entry.content}`);
      break;
    case "label":
      console.log(`[${entry.id}] Label "${entry.label}" on ${entry.targetId}`);
      break;
    case "model_change":
      console.log(`[${entry.id}] Model: ${entry.provider}/${entry.modelId}`);
      break;
    case "thinking_level_change":
      console.log(`[${entry.id}] Thinking: ${entry.thinkingLevel}`);
      break;
  }
}
```

## SessionManager API

以编程方式处理会话的关键方法。

### 静态创建方法
- `SessionManager.create(cwd, sessionDir?)` - 新建会话
- `SessionManager.open(path, sessionDir?)` - 打开已有会话文件
- `SessionManager.continueRecent(cwd, sessionDir?)` - 继续最近的会话或新建
- `SessionManager.inMemory(cwd?)` - 不进行文件持久化
- `SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?)` - 从另一个项目派生（fork）会话

### 静态列表方法
- `SessionManager.list(cwd, sessionDir?, onProgress?)` - 列出某个目录的会话
- `SessionManager.listAll(onProgress?)` - 列出所有项目的所有会话

### 实例方法 - 会话管理
- `newSession(options?)` - 开始新会话（选项：`{ parentSession?: string }`）
- `setSessionFile(path)` - 切换到不同的会话文件
- `createBranchedSession(leafId)` - 将分支提取到新的会话文件

### 实例方法 - 追加（全部返回条目 ID）
- `appendMessage(message)` - 添加消息
- `appendThinkingLevelChange(level)` - 记录思考等级变更
- `appendModelChange(provider, modelId)` - 记录模型变更
- `appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?)` - 添加压缩
- `appendCustomEntry(customType, data?)` - 扩展状态（不在上下文中）
- `appendSessionInfo(name)` - 设置会话显示名称
- `appendCustomMessageEntry(customType, content, display, details?)` - 扩展消息（在上下文中）
- `appendLabelChange(targetId, label)` - 设置/清除标记

### 实例方法 - 树导航
- `getLeafId()` - 当前位置
- `getLeafEntry()` - 获取当前叶子条目
- `getEntry(id)` - 按 ID 获取条目
- `getBranch(fromId?)` - 从条目走到根
- `getTree()` - 获取完整树结构
- `getChildren(parentId)` - 获取直接子条目
- `getLabel(id)` - 获取条目的标记
- `branch(entryId)` - 将叶子移动到较早的条目
- `resetLeaf()` - 将叶子重置为 null（在任何条目之前）
- `branchWithSummary(entryId, summary, details?, fromHook?)` - 带上下文摘要分支

### 实例方法 - 上下文与信息
- `buildContextEntries()` - 获取应用了压缩的活动分支条目
- `buildSessionContext()` - 获取发送给 LLM 的消息、thinkingLevel 和 model
- `getEntries()` - 所有条目（不含头部）
- `getHeader()` - 会话头部元数据
- `getSessionName()` - 从最新的 session_info 条目获取显示名称
- `getCwd()` - 工作目录
- `getSessionDir()` - 会话存储目录
- `getSessionId()` - 会话 UUID
- `getSessionFile()` - 会话文件路径（内存会话为 undefined）
- `isPersisted()` - 会话是否已保存到磁盘
