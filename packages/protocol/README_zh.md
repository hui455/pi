# @earendil-works/pi-protocol

实验性 pi 协议的运行时无关 schema、类型、CBOR 编码和字节流成帧。

协议版本 `1` 使用具有以下线上布局的二进制消息：

1. 一个四字节无符号大端负载长度。
2. 一个包含消息的定长 CBOR 项。

第一个客户端消息始终是 `hello`，包含 `PROTOCOL_VERSION`。后续消息使用关联的请求/响应信封和服务器事件信封。会话和服务器快照是权威的。进度事件是瞬态 UI 提示，不得归约为权威状态。传输在交换协议字节之前完成认证。

会话列表包含 `SessionMetadata`，即无需获取会话运行时即可获得的规范化持久元数据。只有 `id` 和 `createdAt` 是必需的；`updatedAt`、`parentSessionId`、`sessionName` 和 `cwd` 在底层存储支持时包含。phase、model、thinking level、attachment 和 locking 等运行时状态只出现在获取的 `SessionSnapshot` 中。

## 校验的消息 API

`encodeClientMessage()` 和 `encodeServerMessage()` 校验消息并返回完整的成帧 `Uint8Array`。增量解码器接受任意的碎片化或合并，因此它们适用于流、套接字和自定义字节传输。

```ts
import {
  PROTOCOL_VERSION,
  createServerMessageDecoder,
  encodeClientMessage,
  type ClientHello,
} from "@earendil-works/pi-protocol";

const hello: ClientHello = {
  type: "hello",
  version: PROTOCOL_VERSION,
};

transport.send(encodeClientMessage(hello));

const decoder = createServerMessageDecoder({ maxFrameLength: 1024 * 1024 });
for (const message of decoder.push(incomingChunk)) {
  handleServerMessage(message);
}
decoder.end(); // Call when the byte stream closes to detect truncation.
```

`ClientMessageDecoder` 和 `ServerMessageDecoder` 也可以直接使用。schema 违规、畸形 CBOR 和无效成帧抛出 `ProtocolValidationError`。校验错误不会保留被拒绝的负载。

`parseClientMessage()` 和 `parseServerMessage()` 只校验已解码的值。它们不解析 JSON 字符串。

## 传输支持

每个传输承载相同的完整字节：`[uint32-be CBOR length][CBOR payload]`。传输可以任意拆分或合并这些字节。

该包不捆绑传输。使用者提供保持字节顺序并报告流关闭的字节流传输。自定义传输必须处理任意的帧碎片化和合并。

所有传输都是不受信任的。在将连接暴露给协议之前，配置匹配的帧限制并执行适合该传输的访问控制。Unix 套接字可以使用文件系统权限，而网络传输可以在建立连接期间认证。

## 编码与成帧

`encodeCbor()` 和 `decodeCbor()` 实现协议严格的 RFC 8949 子集。`encodeFrame()` 和 `FrameDecoder` 独立于 schema 和 CBOR 处理成帧。

CBOR 子集支持：

- `null` 和布尔值
- 有限数字，其中整数限制在 JavaScript 的安全范围内，非整数编码为 float64
- UTF-8 字符串
- `Uint8Array` 字节串
- 定长数组
- 由具有唯一字符串键的对象表示的定长映射

未定义的对象的属性被省略。JSON 值的协议字段拒绝 CBOR 字节串和非普通对象。顶层 undefined、undefined 数组条目、稀疏数组、非有限或不安全数字、标签、不定长项、畸形 UTF-8、尾部数据、过度嵌套和超大值均被拒绝。

默认限制为每个 CBOR 负载/帧 16 MiB、1,000,000 个数组元素或映射条目，以及 64 层嵌套项级别。可以使用选项配置这些限制。帧解码器在缓冲负载字节之前验证声明的长度。

所有 schema 都拒绝未知的对象属性。该协议是实验性的，没有兼容性保证。
