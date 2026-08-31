# 10 MyHarness

`source-study/my-harness.ts` 是一个产品层包装器：

- `createMainSession()` 和 `createNamedSession()` 管理命名 session
- `prompt()` 只把请求转发给对应 `AgentSession`
- `subscribe()` 收集每个 session 的事件日志
- 包装已有的 `beforeToolCall`，按工具名阻止危险工具
- `filterSkills()` 实现允许列表，不修改 Agent Loop
- `systemPrompt` 通过 session factory 配置下传到 SDK 资源装配层
- `dispose()` 释放监听器和所有 session

它使用依赖注入的 session factory，因此测试可以使用 coding-agent 的内存 faux harness；生产应用可以替换为真正的 `createAgentSession()` factory。

这个例子证明了：自有 Harness 的自然位置在 Pi SDK 之上。只要 SDK 暴露了 session、agent、事件和资源扩展点，就不需要 Fork 核心。
