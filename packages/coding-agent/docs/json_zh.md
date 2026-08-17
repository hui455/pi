# JSON 事件流模式

```bash
pi --mode json "Your prompt"
```

将所有会话事件以 JSON 行的形式输出到 stdout。用于将 pi 集成到其他工具或自定义 UI 中。

## 事件类型

线上事件使用 `JsonAgentSessionEvent`。它与
[`AgentSessionEvent`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/agent-session.ts)
匹配，只是流式消息更新省略了累计快照：

```typescript
type WithoutPartial<T> = T extends { partial: unknown } ? Omit<T, "partial"> : T;

type JsonAgentSessionEvent =
  | Exclude<AgentSessionEvent, { type: "message_update" }>
  | {
      type: "message_update";
      usage: Usage;
      assistantMessageEvent: WithoutPartial<AssistantMessageEvent>;
    };
```

`queue_update` 在待处理的转向（steering）和后续（follow-up）队列变化时发出完整的队列。`compaction_start` 和 `compaction_end` 同时涵盖手动和自动压缩。

其他基础事件来自
[`AgentEvent`](https://github.com/earendil-works/pi-mono/blob/main/packages/agent/src/types.ts)：

```typescript
type AgentEvent =
  // Agent lifecycle
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }
  // Turn lifecycle
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
  // Message lifecycle
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }
  // Tool execution
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
```

## 消息类型

来自 [`packages/ai/src/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/types.ts#L134) 的基础消息：
- `UserMessage`（第 134 行）
- `AssistantMessage`（第 140 行）
- `ToolResultMessage`（第 152 行）

来自 [`packages/coding-agent/src/core/messages.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/messages.ts#L29) 的扩展消息：
- `BashExecutionMessage`（第 29 行）
- `CustomMessage`（第 46 行）
- `BranchSummaryMessage`（第 55 行）
- `CompactionSummaryMessage`（第 62 行）

## 输出格式

每行是一个 JSON 对象。第一行是会话头：

```json
{"type":"session","version":3,"id":"uuid","timestamp":"...","cwd":"/path"}
```

随后按发生顺序输出事件：

```json
{"type":"agent_start"}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[],...}}
{"type":"message_update","usage":{...},"assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"Hello"}}
{"type":"message_end","message":{...}}
{"type":"turn_end","message":{...},"toolResults":[]}
{"type":"agent_end","messages":[...]}
```

`message_update` 记录是纯增量的。它们省略累计的 `message` 字段和
`assistantMessageEvent.partial`，以保持流大小线性。顶层 `usage` 字段包含
最新的累计提供商报告用量，当提供商只在完成时报告用量时可能保持为零。如需要，
使用 `contentIndex` 和 `delta` 拼装实时文本、思考或工具调用
参数。`message_end` 包含最终的权威消息。

## 示例

```bash
pi --mode json "List files" 2>/dev/null | jq -c 'select(.type == "message_end")'
```
