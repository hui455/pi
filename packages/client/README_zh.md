# @earendil-works/pi-client

面向远程 pi 会话的传输无关客户端。`PiClient` 通过一个小的 `ByteTransport` 接口交换带长度前缀的 CBOR 消息。该包没有 Node 特定的导入。

```ts
import { PiClient, type ByteTransportFactory } from "@earendil-works/pi-client";

const transportFactory: ByteTransportFactory = async (handlers) => {
  // Connect using WebSocket, Unix socket, or another ordered byte transport.
  return {
    async send(chunk) {
      // Deliver chunks in invocation order and honor backpressure.
    },
    close() {},
  };
};

const client = new PiClient({ transportFactory });
await client.connect();
const session = await client.createSession({ cwd: "/workspace" });
const unsubscribe = session.subscribe((snapshot) => render(snapshot));
await session.prompt("Inspect this project");
unsubscribe();
```

对入站字节调用 `handlers.onData(chunk)`，对有序的终端关闭调用 `handlers.onClose()`，对传输失败调用 `handlers.onError(error)`。工厂必须为每次连接尝试创建一个全新的传输，并在 resolve 之前完成任何传输特定的认证。例如，WebSocket 工厂可以在其升级请求中提供凭据。

`PiClient` 不会自动重连。断开后调用 `reconnect()`。一个连接可以挂载多个会话。请求通过 ID 关联。服务器快照和成功的响应快照是权威的，而进度事件不会乐观地改变快照状态。从 `client.snapshot?.sessions` 读取缓存的会话元数据；调用 `listSessions()` 向服务器请求刷新的持久元数据。获取会话后即可获得运行时状态。

`acquireSession()` 返回独立的 `SessionLease`；lease 不能直接构造。对生命周期或变更协调器使用 `{ mode: "exclusive" }`，当多个底层消费者有意共享会话时使用 `{ mode: "shared" }`。存在任何 lease 时独占获取会以 `PiSessionOwnershipError` 失败，存在独占 lease 时共享获取会失败。`attachSession()` 是共享获取的便捷方法。`createSession()` 为新建的会话返回独占 lease。

调用 `dispose()` 或 `detach()` 只释放该 lease。释放一开始，lease 就拒绝命令。客户端在最后一个 lease 释放后发送协议 detach 请求。如果显式的 `detach()` 失败，lease 会重新变为活动状态以供重试。如果用于清理的 `dispose()` 失败，它会报告协议错误但放弃本地所有权；`PiClient` 会在下次获取前协调失败的协议清理。已释放的 lease 变为不可用，不影响其他共享 lease。服务器移除或断开会令受影响挂载的每个 lease 失效，且处置已失效的 lease 是空操作。客户端断开时命令以 `PiDisconnectedError` 失败，客户端已连接但 lease 正在释放、已释放或已失效时以 `PiSessionDetachedError` 失败。lease 实现 `AsyncDisposable`。

`subscribe()` 观察权威快照。`onEvent()` 观察协议事件。两者都返回取消订阅函数。服务器返回的结构化错误以 `PiServerError` 暴露。

## 限制与安全

`PiClientOptions.maxFrameLength` 限制入站和出站 CBOR 负载。在客户端和服务器上配置匹配的限制。传输应单独限制排队的出站字节数并保持发送顺序。

将对端视为不受信任。使用具有适当访问控制的加密传输，并在传输建立期间认证。

订阅者的异常与协议状态隔离。在 `PiClientOptions` 中设置 `onListenerError` 以将其上报到应用日志或诊断。

## Unix 域套接字

Node.js 和 Bun 使用者可以使用单独导出的 Unix 域套接字传输：

```ts
import { PiClient } from "@earendil-works/pi-client";
import { createUnixTransportFactory } from "@earendil-works/pi-client/unix";

const client = new PiClient({
  transportFactory: createUnixTransportFactory({
    path: "/tmp/pi.sock",
  }),
});

await client.connect();
```

`maxPendingBytes` 限制排队的出站数据。它默认为协议帧限制的四倍。传输保持发送顺序，并在每次 send resolve 之前等待套接字背压。

`@earendil-works/pi-client` 根保持传输和运行时中立。导入 Node 兼容的传输需要显式的 `@earendil-works/pi-client/unix` 子路径。
