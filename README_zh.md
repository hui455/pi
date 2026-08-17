<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> 新贡献者提交的新 issue 和 PR 默认会被自动关闭。维护者每天会审查被自动关闭的 issue。参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

# Pi Agent Harness

这里是 Pi agent harness 项目的所在地，包括我们可自我扩展的编码代理（coding agent）。

* **[@earendil-works/pi-coding-agent](packages/coding-agent)**：交互式编码代理 CLI
* **[@earendil-works/pi-agent-core](packages/agent)**：带工具调用和状态管理的代理运行时
* **[@earendil-works/pi-ai](packages/ai)**：统一的多提供商 LLM API（OpenAI、Anthropic、Google 等）

想了解更多 Pi 的信息：

* [访问 pi.dev](https://pi.dev)，项目官网，含演示
* [阅读文档](https://pi.dev/docs/latest)，也可以让代理自己解释

## 全部包（Packages）

| 包（Package） | 描述 |
|---------|-------------|
| **[@earendil-works/pi-telemetry](packages/telemetry)** | 供应商无关的遥测契约、参考适配器、一致性测试和类型化 schema |
| **[@earendil-works/pi-ai](packages/ai)** | 统一的多提供商 LLM API（OpenAI、Anthropic、Google 等） |
| **[@earendil-works/pi-agent-core](packages/agent)** | 带工具调用和状态管理的代理运行时 |
| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | 交互式编码代理 CLI |
| **[@earendil-works/pi-tui](packages/tui)** | 支持差异化渲染的终端 UI 库 |

Slack/聊天自动化和工作流请参见 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat)。

## 权限与容器化

Pi 没有内置权限系统来限制文件系统、进程、网络或凭据访问。默认情况下，它以启动它的用户和进程的权限运行。

如果需要更强的边界，请将 Pi 容器化或沙箱化。参见 [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) 了解三种模式：

- **Gondolin 扩展**：将 `pi` 和提供商认证留在主机上，同时把内置工具和 `!` 命令路由到本地 Linux 微虚拟机中。
- **纯 Docker**：在本地容器中运行整个 `pi` 进程，实现简单隔离。
- **OpenShell**：在受策略控制的沙箱中运行整个 `pi` 进程。

## 贡献

贡献指南参见 [CONTRIBUTING.md](CONTRIBUTING.md)，项目特定规则（面向人和代理）参见 [AGENTS.md](AGENTS.md)。Pi 的长期计划也可以在 [RFCs](https://rfc.earendil.com/keyword/pi/) 中查看。

## 开发

```bash
npm install --ignore-scripts  # Install all dependencies without running lifecycle scripts
npm run build         # Refresh model data, then build all packages
npm run build:offline # Rebuild using existing model data without network access
npm run check         # Lint, format, and type check
./test.sh            # Run tests (skips LLM-dependent tests without API keys)
./pi-test.sh         # Run pi from sources (can be run from any directory)
```

## 从发布源码构建独立二进制

GitHub 发布包含一个带版本号的源码归档，由该发布的 `SHA256SUMS` 文件覆盖。解压后运行与官方独立二进制相同的构建脚本：

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

源码归档包含发布时使用的生成的提供商模型数据。`--offline-model-data` 使用该快照构建，而不是从实时提供商目录刷新。脚本仍会安装依赖、构建 monorepo、编译 Bun 可执行文件并暂存其运行时资源。单独提供依赖的包维护者可以传入 `--skip-install --skip-deps`。

## 供应链加固

我们将 npm 依赖变更视为经过审查的代码变更。

- 直接外部依赖固定为精确版本。内部 workspace 包保持版本范围。
- `.npmrc` 设置 `save-exact=true` 和 `min-release-age=2`，避免 npm 解析期间出现当日发布的依赖。
- `package-lock.json` 是依赖的最终依据。除非设置 `PI_ALLOW_LOCKFILE_CHANGE=1`，pre-commit 会阻止意外的 lockfile 提交。
- `npm run check` 验证固定的直接依赖、原生 TypeScript 导入兼容性以及生成的 coding-agent shrinkwrap。
- 发布的 CLI 包包含 `packages/coding-agent/npm-shrinkwrap.json`（由根 lockfile 生成），用于为 npm 用户固定传递依赖。
- 发布冒烟测试使用 `npm run release:local` 在打标签前于仓库之外构建、打包并创建隔离的 npm 和 Bun 安装。
- 本地发布安装、文档化的 npm 安装以及 `pi update --self` 在支持的地方使用 `--ignore-scripts`。
- CI 使用 `npm ci --ignore-scripts` 安装，定时 GitHub workflow 运行 `npm audit --omit=dev` 和 `npm audit signatures --omit=dev`。
- shrinkwrap 生成为依赖生命周期脚本设置了显式允许列表；新的生命周期脚本依赖在审查通过前会无法通过检查。

## 分享你的 OSS 编码代理会话

如果你使用 Pi 或其他编码代理进行开源工作，请分享你的会话。

公开的 OSS 会话数据有助于用真实世界的任务、工具使用、失败和修复来改进编码代理，而不是使用玩具基准。

完整说明见 [X 上的这篇文章](https://x.com/badlogicgames/status/2037811643774652911)。

要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。阅读其 README.md 获取设置说明。你只需要一个 Hugging Face 账号、Hugging Face CLI 和 `pi-share-hf`。

你还可以观看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，我在其中演示了如何发布我的 `pi-mono` 会话。

我定期在这里发布自己的 `pi-mono` 工作会话：

- [Hugging Face 上的 badlogicgames/pi-mono](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 许可证

MIT

<p align="center">
  <a href="https://pi.dev">pi.dev</a> 域名由以下机构慷慨捐赠
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>
