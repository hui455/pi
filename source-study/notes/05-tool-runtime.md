# 05 Tool Runtime

工具定义包含 name、description、参数 schema 和 execute；模型返回的是 tool call；本地执行后生成 ToolResult。

```text
toolCall
  -> 找工具
  -> prepareArguments（可选）
  -> validateToolArguments
  -> beforeToolCall
  -> execute(callId, args, signal, update)
  -> afterToolCall
  -> tool_execution_end
  -> ToolResult message
```

`tool_execution_start` 在准备和参数校验之前发出，因此不存在的工具或坏参数也有完整的 start/end 事件对。

并行执行的精确语义是“准备/校验串行、execute 并行、结果按 assistant 原始顺序写回”。一个工具的 `terminate` 只有在批次内所有最终结果都 terminate 时才结束批次。

本实验的第一个失败版本把自定义工具放进 `tools`，结果是 `Tool <name> not found`。`AgentSession` 的 product-level tool selection 会重建工具集合；测试自定义工具应通过 `baseToolsOverride` 注入。这是理解“工具定义”和“当前激活工具集合”区别的关键。
