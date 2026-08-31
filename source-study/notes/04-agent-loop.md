# 04 Agent Loop

源码：`packages/agent/src/agent-loop.ts`。

## 入口层次

```text
agentLoop()
  -> runAgentLoop()
     -> runLoop()
        -> streamAssistantResponse()
        -> prepareToolCall()
        -> executeToolCalls*()
```

`agentLoop()` 用 `EventStream` 对外暴露事件；`runAgentLoop()` 负责初始消息和生命周期事件；`runLoop()` 执行共享状态机。

## 双层循环

```text
外层 follow-up：Agent 原本要结束后，是否还有新用户消息？
  内层 turn：处理 steering、模型调用、tool call、toolResult
```

一次工具调用的最小状态机：

```text
user message
  -> model response
  -> assistant toolCall
  -> validate + execute
  -> toolResult message
  -> next model response
  -> no toolCall
  -> agent_end
```

停止原因：`error` 和 `aborted` 结束当前运行；没有工具调用通常结束内层循环；`shouldStopAfterTurn` 可以由上层策略提前结束；所有 follow-up 消息消费完后才发出最终 `agent_end`。
