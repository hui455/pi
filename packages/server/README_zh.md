# @earendil-works/pi-server

实验性。该包正在积极开发中，可能随时更改或移除，恕不另行通知。其 API 和行为尚不稳定。

pi 的服务器包。

## 会话服务器核心

该包导出 `PiServer` 会话服务器。

```ts
import type { PiServerService } from "@earendil-works/pi-server";
import { createUnixServer } from "@earendil-works/pi-server/unix";

const service: PiServerService = {
  async listSessions() {
    return storage.listSessions();
  },
  async listModels() {
    return modelRegistry.listModels();
  },
  async createSession(options) {
    return storage.createAndOpen(options);
  },
  async openSession(sessionId) {
    return storage.open(sessionId);
  },
};

const server = createUnixServer(service, {
  path: "/tmp/pi/server.sock",
});
await server.start();
```

`PiServer` 通过 `PiServerListener` 接口组合传输监听器。每个监听器必须在将连接交给 `PiServer` 之前完成任何传输特定的认证和授权。例如，WebSocket 监听器可以在 HTTP 升级期间验证凭据，而 Unix 监听器依赖套接字文件系统权限。Unix 子模块导出 `createUnixListener()` 构建块和 `createUnixServer()` 预设，在保持常见场景简洁的同时不将主服务器与 Unix 套接字耦合。监听器使用来自 `@earendil-works/pi-protocol` 的带长度前缀的 CBOR 消息。

该包不提供独立的 CLI 或 coding-agent 服务。应用提供 `PiServerService` 实现。

`PiServerService.listSessions()` 返回协议 `SessionMetadata`，而非获取的运行时状态。服务应映射其存储支持的持久字段，可以省略 `updatedAt`、`parentSessionId`、`sessionName` 和 `cwd`。`PiServer` 从实时快照刷新可用元数据，无需存储的会话捏造 phase、model、thinking-level、attachment 或 lock 值。

## 传输测试

自定义传输可以使用 `@earendil-works/pi-server/testing` 进行确定性协议一致性测试。它导出 `createTestServer()`、`TestServerService`、`ProtocolTestClient` 和传输无关的 `WireChannel` 契约。`connectUnixTestClient()` 用于 Unix 传输测试。

## `pi-ai` 协议桥接

`@earendil-works/pi-ai` 领域对象和 `@earendil-works/pi-protocol` 线上 DTO 保持独立。该包拥有它们之间的边界，并导出 `toProtocolModelMetadata()`、`toProtocolAssistantMessage()`、`toProtocolUserMessage()` 和 `toProtocolToolResultMessage()`。

这些适配器拒绝无效的工具输入、标识符、时间戳和不匹配的工具结果；`toProtocolToolResultMessage()` 需要原始的 `ToolCall`，以便验证关联并自行转换其参数。诊断细节被显式消毒。封闭的 `pi-ai` 联合被穷尽映射，编译期字段清单枚举当前的 `pi-ai` 属性，因此新增需要显式审查。在语义相同之处，协议镜像 `pi-ai` 的词汇，例如 `toolCall` 和 `toolUse`。协议 schema 强制一致的生命周期状态，测试通过运行时 schema 对适配器输出编码，因此不兼容的更改会在桥接包中失败。
