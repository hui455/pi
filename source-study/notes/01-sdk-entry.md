# 01 SDK Entry

## 入口

`packages/coding-agent/examples/sdk/01-minimal.ts` 只做三件事：创建 session、订阅 `message_update`、调用 `session.prompt()`。

## `createAgentSession()` 的四组职责

| 组 | 源码证据 | 结果 |
|---|---|---|
| 环境 | `packages/coding-agent/src/core/sdk.ts:200` 的 cwd/agentDir 解析 | 确定项目资源和全局配置位置 |
| 模型 | `ModelRuntime.create()`、模型解析和 thinking level | 确定可用模型、认证和流函数 |
| 会话 | `SessionManager`、existing session restore | 恢复 messages、model、thinking level |
| Agent | `new Agent(...)`、`new AgentSession(...)` | 把运行时、工具、扩展和持久化组合起来 |

返回值是 `{ session, extensionsResult, modelFallbackMessage }`。SDK 使用者主要持有 `session`；交互模式使用 `extensionsResult` 初始化 UI 上下文。

## 第一条调用链

```text
01-minimal.ts
  -> createAgentSession()
  -> AgentSession.prompt()
  -> Agent.prompt()
  -> agentLoop()
```

## 仍需下沉的地方

SDK 负责组装，不负责 provider 协议和工具循环。遇到模型调用时继续看 Agent Loop；遇到模型认证和事件格式时继续看 pi-ai。
