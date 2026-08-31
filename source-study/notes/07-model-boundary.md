# 07 Model Boundary

Agent Loop 通过 `streamFn(model, context, options)` 请求模型；coding-agent 的默认实现把它连接到 `ModelRuntime.streamSimple()`；pi-ai 再根据 provider 和 api 选择具体流实现。

```text
AgentMessage[]
  -> transformContext()
  -> convertToLlm()
  -> pi-ai streamSimple()
  -> provider SSE/WebSocket
  -> AssistantMessageEvent
```

faux provider 复用了同一套流式事件接口，能脚本化产生文本、thinking、tool call、error 和延迟，所以实验无需真实 API key。

Provider 的变化应停留在 pi-ai 边界；只要统一返回 `AssistantMessageEvent`，Agent Loop 不需要知道具体 HTTP 协议。
