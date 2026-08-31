# 09 AgentHarness

通用 Harness 位于 `packages/agent/src/harness/`，不是 coding-agent SDK 的别名。

```text
Agent          单次运行、消息、工具循环
AgentSession   coding-agent 产品组装、资源、模型、持久化、扩展、压缩
AgentHarness   通用的 durable operation、lane、队列、恢复、分支和工具上下文
```

阅读顺序：先看 `harness/types.ts` 的公开类型，再看 `agent-harness.ts` 的 `AgentHarness.create()`、lane、operation、run、close，最后用 `harness_zh.md` 查具体设计要求。

产品需求的接入优先级：SDK 配置 -> Extension -> 自己的外层 Harness -> 上游 PR/Fork。危险命令审批、Skill scope 和事件日志都可以在外层完成，不需要改 `agent-loop.ts`。
