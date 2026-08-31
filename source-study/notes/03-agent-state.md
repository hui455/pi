# 03 Agent State

阅读 `packages/agent/src/agent.ts` 和 `packages/agent/src/types.ts` 时，把状态分为两类：

| 状态 | 生命周期 | 用途 |
|---|---|---|
| `messages` | 跨 prompt | Agent 上下文和对话历史 |
| `model` / `thinkingLevel` | 跨 prompt | 下一次模型调用配置 |
| `tools` | 跨 prompt | 模型可见并可执行的工具 |
| `isStreaming` | 单次运行 | 防止并发 prompt，表示流正在进行 |
| `streamingMessage` | 单次运行 | 增量事件期间的 assistant 快照 |
| `pendingToolCalls` | 单次运行 | 跟踪尚未结束的工具执行 |
| `errorMessage` | 单次运行/错误后 | 暴露最近一次运行错误 |

`Agent.prompt()` 将字符串规范化成 user `AgentMessage`，再调用 `runAgentLoop()`。它不直接组装 HTTP 请求；provider 边界由传入的 `streamFn` 负责。

`steer` 会在当前运行的下一轮注入，`followUp` 会在原运行本来要结束时启动新的外层轮次。
