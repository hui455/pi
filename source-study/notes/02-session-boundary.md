# 02 AgentSession Boundary

`AgentSession` 位于产品组装层。它在 `prompt()` 前准备 system prompt、资源、当前工具和 session 上下文，然后调用 `this.agent.prompt(...)`。

```text
AgentSession.prompt(text)
  -> 处理产品命令和上下文
  -> 更新 Agent 的 system prompt / tools
  -> this.agent.prompt(messages)
  -> 保存 Agent 事件到 SessionManager
```

`Agent` 只关心一次运行和消息状态；`AgentSession` 额外负责项目 cwd、资源加载、模型选择、扩展、持久化、分支和压缩。

实验中 `createHarness()` 提供内存 `SessionManager`，因此可以观察 Agent 事件而不产生磁盘 session 文件。
