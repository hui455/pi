# 11 Verification

运行：

```powershell
node node_modules/vitest/dist/cli.js --run --config packages/coding-agent/vitest.config.ts source-study/test/source-study.test.ts
```

实验覆盖：

1. 文本回答：一次模型调用和完整 Agent 生命周期。
2. 工具回流：tool call、tool execution、ToolResult、第二次模型调用。
3. 并行工具：执行顺序和结果批次。
4. Provider error：错误事件和 Agent 结束。
5. Abort：延迟流被中止后仍有一次 Agent 结束。
6. MyHarness：自定义 prompt 配置、事件日志、工具策略、Skill 过滤和 session 隔离。
7. SDK：真实经过 `createAgentSession()`，并验证文件 session 的保存和恢复。
8. 通用 Harness：创建并关闭内存 `AgentHarness`。

模型数据缺失时，先执行 `npm run hydrate:model-data`；这是源码模式导入 provider catalog 的仓库前置条件，不是实验对真实网络模型的依赖。
