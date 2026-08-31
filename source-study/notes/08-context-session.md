# 08 Context and Session

必须区分：

```text
Session History      持久化的完整记录
Model Context        当前请求真正发送给模型的消息
Tool Result          工具执行后回流给模型的消息
Compaction Summary   压缩历史后的摘要
Project Resource     cwd 中发现的 prompt、skill、extension 等资源
```

`SessionManager` 负责历史、恢复和分支；`AgentSession` 在每次 prompt 前重新组合 system prompt 和上下文；`convertToLlm` 负责把产品消息投影为模型消息。

Compaction 属于 session/harness 层：先判断阈值或 overflow，再生成摘要、保存 compaction entry，下一次上下文构建时使用摘要恢复长期事实。Agent Loop 本身不需要知道压缩算法。

隔离实验通过独立内存 SessionManager 创建 A、B，A 的 messages 不会出现在 B 的 context 中。
