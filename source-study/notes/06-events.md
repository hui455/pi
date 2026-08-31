# 06 Events

模型层事件定义在 `packages/ai/src/types.ts`，例如 `text_delta`、`toolcall_delta`、`done`、`error`。Agent 层事件定义在 `packages/agent/src/types.ts`，例如 `agent_start`、`turn_start`、`message_update`、`tool_execution_*`、`agent_end`。

普通回答：

```text
agent_start
turn_start
message_start/end(user)
message_start/update/end(assistant)
turn_end
agent_end
```

工具回答：

```text
assistant(toolCall)
tool_execution_start
tool_execution_update?
tool_execution_end
toolResult message
turn_end
下一轮 assistant
agent_end
```

`message_update` 同时包含当前 AgentMessage 快照和底层 assistant 增量，因此 UI、Print、RPC 和日志可以共享同一个 Agent Runtime。
