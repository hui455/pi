<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> 新贡献者提交的 issue 和 PR 默认会被自动关闭。维护者每天会审查这些自动关闭的 issue。参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

---

Pi 是一个极简的终端编码工具（coding harness）。让 pi 去适应你的工作流，而不是反过来——无需 fork 并修改 pi 内部实现。你可以用 TypeScript [扩展](#extensions)、[技能](#skills)、[提示词模板](#prompt-templates) 和[主题](#themes) 来扩展它。把你的扩展、技能、提示词模板和主题放进 [Pi 包](#pi-packages)，通过 npm 或 git 与他人共享。

Pi 内置了强大的默认功能，但刻意省略了子代理、规划模式（plan mode）等功能。你可以让 pi 构建你想要的功能，或安装一个匹配你工作流的第三方 pi 包。

Pi 以四种模式运行：交互模式、打印或 JSON 模式、用于进程集成的 RPC 模式，以及用于嵌入到你自己应用中的 SDK。

## 分享你的 OSS 编码代理会话

如果你用 pi 做开源工作，请分享你的编码代理会话。

公开的 OSS 会话数据有助于使用真实的开发工作流改进模型、提示词、工具和评测。

完整说明请参见 [X 上的这篇文章](https://x.com/badlogicgames/status/2037811643774652911)。

要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。阅读其 README.md 获取安装说明。你只需要一个 Hugging Face 账号、Hugging Face CLI 和 `pi-share-hf`。

你也可以观看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，里面演示了我如何发布我的 `pi-mono` 会话。

我定期在这里发布我自己的 `pi-mono` 工作会话：

- [Hugging Face 上的 badlogicgames/pi-mono](https://huggingface.co/datasets/badlogicgames/pi-mono)

## 目录

- [快速开始](#quick-start)
- [提供商与模型](#providers--models)
- [交互模式](#interactive-mode)
  - [编辑器](#editor)
  - [命令](#commands)
  - [键盘快捷键](#keyboard-shortcuts)
  - [消息队列](#message-queue)
- [会话](#sessions)
  - [分支](#branching)
  - [压缩](#compaction)
- [设置](#settings)
- [上下文文件](#context-files)
- [自定义](#customization)
  - [提示词模板](#prompt-templates)
  - [技能](#skills)
  - [扩展](#extensions)
  - [主题](#themes)
  - [Pi 包](#pi-packages)
- [编程式使用](#programmatic-usage)
- [设计理念](#philosophy)
- [CLI 参考](#cli-reference)

---

## 快速开始

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` 会在安装时禁用依赖的生命周期脚本。正常 npm 安装下 Pi 不需要安装脚本。

安装器替代方案：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

使用 API 密钥进行认证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

或者使用你现有的订阅：

```bash
pi
/login  # 然后选择提供商
```

然后直接和 pi 对话即可。默认情况下，pi 会给模型四个工具：`read`、`write`、`edit` 和 `bash`。模型用这些工具来完成你的请求。可以通过[技能](#skills)、[提示词模板](#prompt-templates)、[扩展](#extensions) 或 [pi 包](#pi-packages) 增加更多能力。

**平台说明：** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [终端配置](docs/terminal-setup.md) | [Shell 别名](docs/shell-aliases.md)

---

## 提供商与模型

对于每个内置提供商，pi 维护一份支持工具调用的模型列表。配置好的提供商目录会自动刷新；运行 `pi update --models` 可强制立即刷新。通过订阅（`/login`）或 API 密钥认证后，用 `/model`（或 Ctrl+L）选择该提供商的任意模型。

**订阅：**
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot

**API 密钥：**
- Anthropic
- Ant Ling
- OpenAI
- Azure OpenAI
- DeepSeek
- NVIDIA NIM
- Google Gemini
- Google Vertex
- Amazon Bedrock
- Mistral
- Groq
- Cerebras
- Cloudflare AI Gateway
- Cloudflare Workers AI
- xAI
- OpenRouter
- Vercel AI Gateway
- ZAI Coding Plan (Global)
- ZAI Coding Plan (China)
- OpenCode Zen
- OpenCode Go
- Hugging Face
- Fireworks
- Together AI
- Baseten
- Kimi For Coding
- MiniMax
- Xiaomi MiMo
- Xiaomi MiMo Token Plan (China)
- Xiaomi MiMo Token Plan (Amsterdam)
- Xiaomi MiMo Token Plan (Singapore)

Pi 还支持 llama.cpp 路由器服务器。用 `/login llama.cpp` 配置，用 `/llama` 管理下载和已加载的模型，然后用 `/model` 选择已加载的模型。安装和使用说明见 [docs/llama-cpp.md](docs/llama-cpp.md)。

其他提供商的安装说明见 [docs/providers.md](docs/providers.md)。

**自定义提供商与模型：** 如果它们使用受支持的 API（OpenAI、Anthropic、Google），可以通过 `~/.pi/agent/models.json` 添加提供商。对于自定义 API 或 OAuth，请使用扩展。参见 [docs/models.md](docs/models.md) 和 [docs/custom-provider.md](docs/custom-provider.md)。

---

## 交互模式

<p align="center"><img src="docs/images/interactive-mode.png" alt="交互模式" width="600"></p>

界面自上而下：

- **启动头部** - 显示快捷键（完整列表用 `/hotkeys`）、已加载的 AGENTS.md 文件、提示词模板、技能和扩展
- **消息** - 你的消息、助手回复、工具调用及结果、通知、错误和扩展 UI
- **编辑器** - 输入区域；边框颜色表示思考级别
- **页脚** - 工作目录、会话名称、token/缓存总用量（`↑` 输入、`↓` 输出、`R` 缓存读取、`W` 缓存写入、`CH` 最新缓存命中率）、成本、上下文使用量、当前模型。总计包含助手回复、工具上报的使用量和摘要生成。

编辑器可以被其他 UI 临时替换，例如内置的 `/settings` 或来自扩展的自定义 UI（例如一个允许用户以结构化格式回答模型问题的问答工具）。[扩展](#extensions) 还可以替换编辑器、在编辑器上方/下方添加小组件、状态行、自定义页脚或覆盖层。

### 编辑器

| 功能 | 操作方式 |
|---------|-----|
| 文件引用 | 输入 `@` 进行项目文件模糊搜索 |
| 路径补全 | Tab 补全路径 |
| 多行输入 | Shift+Enter（Windows Terminal 上为 Ctrl+Enter） |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`、Windows 上的记事本或其他平台上的 `nano` |
| 剪贴板 | Ctrl+V 粘贴图片或文本（Windows 上为 Alt+V），或将图片拖到终端 |
| Bash 命令 | `!command` 运行并把输出发给 LLM，`!!command` 运行但不发送输出 |

删除单词、撤销等标准编辑按键绑定。参见 [docs/keybindings.md](docs/keybindings.md)。

### 命令

在编辑器中输入 `/` 触发命令。[扩展](#extensions) 可以注册自定义命令，[技能](#skills) 通过 `/skill:name` 使用，[提示词模板](#prompt-templates) 通过 `/templatename` 展开。

| 命令 | 描述 |
|---------|-------------|
| `/login`, `/logout` | 管理提供商凭据 |
| [`/llama`](docs/llama-cpp.md) | 下载、加载和卸载 llama.cpp 路由器模型 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用用于 Ctrl+P 循环切换的模型 |
| `/settings` | 思考级别、主题、消息投递、传输方式 |
| `/resume` | 从之前的会话中选择 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话信息（文件、ID、消息、token、成本） |
| `/tree` | 跳转到会话中的任意节点并从中继续 |
| `/trust` | 保存项目信任决定，供后续会话使用（需要重启） |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话中 |
| `/compact [prompt]` | 手动压缩上下文，可选自定义指令 |
| `/copy` | 复制最后一条助手消息到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL 文件 |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 作为私有 GitHub gist 上传，并生成可分享的 HTML 链接 |
| `/reload` | 重新加载按键绑定、扩展、技能、提示词、主题和上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

### 键盘快捷键

完整列表见 `/hotkeys`。可通过 `~/.pi/agent/keybindings.json` 自定义。参见 [docs/keybindings.md](docs/keybindings.md)。

**常用快捷键：**

| 按键 | 操作 |
|-----|--------|
| Ctrl+C | 清空编辑器 |
| Ctrl+C 两次 | 退出 |
| Escape | 取消/中止 |
| Escape 两次 | 打开 `/tree` |
| Ctrl+L | 打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | 在作用域模型间向前/向后循环 |
| Shift+Tab | 循环切换思考级别 |
| Ctrl+O | 折叠/展开工具输出 |
| Ctrl+T | 折叠/展开思考块 |
| Ctrl+X | 复制最后一条助手消息 |

### 消息队列

在代理工作时也可以提交消息：

- **Enter** 将 *引导（steering）* 消息入队，在当前助手轮次执行完其工具调用后投递
- **Alt+Enter** 将 *追问（follow-up）* 消息入队，仅在代理完成所有工作后投递
- **Escape** 中止并将队列中的消息恢复到编辑器
- **Alt+Up** 把队列中的消息取回编辑器

在 Windows Terminal 上，`Alt+Enter` 默认是全屏。请在 [docs/terminal-setup.md](docs/terminal-setup.md) 中重新映射，以便 pi 能收到追问快捷键。

投递方式在[设置](docs/settings.md)中配置：`steeringMode` 和 `followUpMode` 可以是 `"one-at-a-time"`（默认，等待响应）或 `"all"`（一次性投递所有排队消息）。`transport` 为支持多种传输方式的提供商选择传输偏好（`"sse"`、`"websocket"` 或 `"auto"`）。

---

## 会话

会话以 JSONL 文件存储，具有树状结构。每个条目都有 `id` 和 `parentId`，允许原地分支而无需创建新文件。文件格式见 [docs/session-format.md](docs/session-format.md)。

### 管理

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并从过去的会话中选择
pi --no-session        # 临时模式（不保存）
pi --name "my task"    # 启动时设置会话显示名称
pi --session <path|id> # 使用指定的会话文件或 ID
pi --fork <path|id>    # 将指定的会话文件或 ID fork 到一个新会话
```

在交互模式中使用 `/session` 查看当前会话 ID，然后用 `--session <id>` 或 `--fork <id>` 复用它。

### 分支

**`/tree`** - 原地浏览会话树。选择任意之前的节点，从中继续，并在分支间切换。所有历史记录保留在单个文件中。

<p align="center"><img src="docs/images/tree-view.png" alt="树形视图" width="600"></p>

- 通过输入搜索，用 Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ 折叠/展开并在分支间跳转，用 ←/→ 翻页
- 过滤模式（Ctrl+O）：默认 → 无工具 → 仅用户 → 仅带标签 → 全部
- 按 Ctrl+X 复制选中的消息
- 按 Shift+L 将条目标记为书签，按 Shift+T 切换标签时间戳

**`/fork`** - 从活动分支上某条之前的用户消息创建新的会话文件。打开一个选择器，复制到该节点为止的活动路径，并把选中的提示词放入编辑器供修改。

**`/clone`** - 把当前活动分支复制到当前位置的一个新会话文件。新会话保留完整活动路径历史，并以空编辑器打开。

**`--fork <path|id>`** - 直接从 CLI fork 一个现有会话文件或部分会话 UUID。这会把完整的源会话复制到当前项目中的一个新会话文件。

### 压缩

长会话可能耗尽上下文窗口。压缩会总结较早的消息，同时保留较新的消息。

**手动：** `/compact` 或 `/compact <自定义指令>`

**自动：** 默认启用。在上下文溢出时触发（恢复并重试），或在接近上限时触发（主动）。可通过 `/settings` 或 `settings.json` 配置。

压缩是有损的。完整历史保留在 JSONL 文件中；可用 `/tree` 回看。可通过[扩展](#extensions) 自定义压缩行为。内部机制见 [docs/compaction.md](docs/compaction.md)。

---

## 设置

使用 `/settings` 修改常用选项，或直接编辑 JSON 文件：

| 位置 | 作用范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（覆盖全局） |

所有选项见 [docs/settings.md](docs/settings.md)。

### 项目信任

交互启动时，如果项目文件夹包含项目级设置、资源或项目的 `.agents/skills`，且该文件夹或其父文件夹在 `~/.pi/agent/trust.json` 中没有已保存的决定，pi 会先询问是否信任该项目。信任项目后，pi 才能加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包并执行项目扩展。

在做出信任决定之前，pi 只加载上下文文件、用户/全局扩展和 CLI `-e` 扩展，以便它们能处理 `project_trust` 事件。项目级扩展、项目包托管的扩展和项目设置仅在项目被信任后加载。当切换到来自其他 cwd、且其信任状态未在当前进程中解决的会话时，同样适用此划分。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不显示信任提示。在没有适用的已保存信任决定时，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，而 `always` 会信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可为单次运行覆盖项目信任。

如果没有适用的扩展或已保存决定，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中把它设为 `"ask"`、`"always"` 或 `"never"`，或用 `/settings` 更改。

`pi config` 和包命令使用相同的项目信任流程，但 `pi update` 从不提示。传入 `--approve` 信任单条命令的项目级设置，或 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 为后续会话保存项目信任决定，包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不会被重新加载，因此请重启 pi 使更改生效。

### 遥测与更新检查

Pi 有两个独立的启动功能：

- **更新检查：** 请求 `https://pi.dev/api/latest-version` 检查是否有更新的 Pi 版本。用 `PI_SKIP_VERSION_CHECK=1` 禁用它。禁用更新检查只会关闭这一项检查。
- **安装/更新遥测：** 首次安装后或检测到更新后，向 `https://pi.dev/api/report-install` 发送匿名版本 ping。此设置还控制 OpenRouter、Cloudflare 和直接 NVIDIA NIM 请求的可选提供商归属请求头。通过在 `settings.json` 中把 `enableInstallTelemetry` 设为 `false`，或设置 `PI_TELEMETRY=0` 退出。这不会禁用更新检查；除非更新检查被禁用或启用了离线模式，Pi 仍可能联系 `pi.dev` 获取最新版本。

使用 `--offline` 或 `PI_OFFLINE=1` 禁用这里描述的所有启动网络操作，包括更新检查、包更新检查和安装/更新遥测。

---

## 上下文文件

Pi 启动时从以下位置加载 `AGENTS.md`（或 `CLAUDE.md`）：
- `~/.pi/agent/AGENTS.md`（全局）
- 父目录（从 cwd 向上查找）
- 当前目录

如果某个目录包含 `AGENTS.override.md`，Pi 会加载它而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。其他目录的上下文文件仍然会拼接。

用于项目说明（`AGENTS.md`/`CLAUDE.md`）、约定、常用命令。所有匹配的文件都会拼接在一起。

用 `--no-context-files`（或 `-nc`）禁用上下文文件加载。

### 系统提示词

用 `.pi/SYSTEM.md`（项目）或 `~/.pi/agent/SYSTEM.md`（全局）替换默认系统提示词。用 `APPEND_SYSTEM.md` 在不清除的情况下追加。

---

## 自定义

### 提示词模板

可复用的提示词，以 Markdown 文件形式存放。输入 `/name` 展开。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

放在 `~/.pi/agent/prompts/`、`.pi/prompts/` 或[pi 包](#pi-packages)中与他人共享。参见 [docs/prompt-templates.md](docs/prompt-templates.md)。

### 技能

按需提供的能力包，遵循 [Agent Skills 标准](https://agentskills.io)。通过 `/skill:name` 调用，或让代理自动加载。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

放在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/`（从 `cwd` 向上到父目录）或[pi 包](#pi-packages)中与他人共享。参见 [docs/skills.md](docs/skills.md)。

### 扩展

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom 扩展" width="600"></p>

用自定义工具、命令、键盘快捷键、事件处理器和 UI 组件扩展 pi 的 TypeScript 模块。

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

默认导出也可以是 `async`。pi 会等待异步扩展工厂完成再继续启动，这对于一次性初始化很有用，比如在调用 `pi.registerProvider()` 之前获取远程模型列表。

**能实现的功能：**
- 自定义工具（或完全替换内置工具）
- 子代理和规划模式
- 自定义压缩与摘要
- 权限门控和路径保护
- 自定义编辑器和 UI 组件
- 状态行、头部、页脚
- Git 检查点和自动提交
- SSH 和沙箱执行
- MCP 服务器集成
- 让 pi 看起来像 Claude Code
- 等待时的游戏（没错，Doom 能跑）
- ……任何你能想到的

放在 `~/.pi/agent/extensions/`、`.pi/extensions/` 或[pi 包](#pi-packages)中与他人共享。参见 [docs/extensions.md](docs/extensions.md) 和 [examples/extensions/](examples/extensions/)。

### 主题

内置主题：`dark`、`light`。主题支持热重载：修改活动主题文件后 pi 会立即应用更改。

放在 `~/.pi/agent/themes/`、`.pi/themes/` 或[pi 包](#pi-packages)中与他人共享。参见 [docs/themes.md](docs/themes.md)。

### Pi 包

通过 npm 或 git 打包和共享扩展、技能、提示词和主题。在 [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) 或 [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628) 上查找包。

> **安全：** Pi 包以完整的系统权限运行。扩展会执行任意代码，技能可以指示模型执行任何操作，包括运行可执行文件。安装第三方包前请审查其源代码。

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # 固定版本
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # 标签或提交
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # 标签或提交
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # 标签或提交
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # 标签或提交
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # remove 的别名
pi list
pi update                               # 只更新 pi
pi update --all                         # 更新 pi 和所有包
pi update --extensions                  # 只更新包
pi update --models                      # 只刷新模型目录
pi update --self                        # 只更新 pi
pi update --self --force                # 即使已是最新也重装 pi
pi update npm:@foo/pi-tools             # 更新单个包
pi config                               # 启用/禁用扩展、技能、提示词、主题
```

包安装到 `~/.pi/agent/git/`（git）或 `~/.pi/agent/npm/`（npm）。使用 `-l` 进行项目级安装（`.pi/git/`、`.pi/npm/`）。git `@ref` 值是固定的标签或提交；固定版本包会被 `pi update --extensions` 和 `pi update --all` 跳过，所以要用 `pi install git:host/user/repo@new-ref` 把现有包移到新引用。git 包默认用 `npm install --omit=dev` 安装依赖，因此运行时依赖必须列在 `dependencies` 下；配置了 `npmCommand` 时，git 包使用普通的 `install` 以兼容包装器。如果你使用 Node 版本管理器并希望包安装复用稳定的 npm 环境，请在 `settings.json` 中设置 `npmCommand`，例如 `["mise", "exec", "node@20", "--", "npm"]`。

在 `package.json` 中添加 `pi` 键来创建包：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

如果没有 `pi` 清单，pi 会从约定目录（`extensions/`、`skills/`、`prompts/`、`themes/`）自动发现。

参见 [docs/packages.md](docs/packages.md)。

---

## 编程式使用

### SDK

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

await session.prompt("What files are in the current directory?");
```

对于高级多会话运行时替换，使用 `createAgentSessionRuntime()` 和 `AgentSessionRuntime`。

参见 [docs/sdk.md](docs/sdk.md) 和 [examples/sdk/](examples/sdk/)。

### RPC 模式

对于非 Node.js 集成，通过 stdin/stdout 使用 RPC 模式：

```bash
pi --mode rpc
```

RPC 模式使用严格的 LF 分隔 JSONL 帧格式。客户端必须只按 `\n` 分割记录。不要使用 Node `readline` 之类的通用行读取器，它们也会在 JSON 负载内部的 Unicode 分隔符处分割。

协议参见 [docs/rpc.md](docs/rpc.md)。

---

## 设计理念

Pi 具有极强的可扩展性，因此它不必规定你的工作流。其他工具内置的功能都可以用[扩展](#extensions)、[技能](#skills) 构建，或从第三方 [pi 包](#pi-packages) 安装。这保持了核心的极简，同时让你把 pi 塑造成适合你的工作方式。

**没有 MCP。** 构建带 README 的 CLI 工具（见[技能](#skills)），或构建一个添加 MCP 支持的扩展。[为什么？](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**没有子代理。** 实现方式有很多：通过 tmux 启动多个 pi 实例，或用[扩展](#extensions) 自己构建，或安装一个符合你方式的包。

**没有权限弹窗。** 在容器中运行，或用[扩展](#extensions) 内联构建符合你的环境和安全要求的确认流程。

**没有规划模式。** 把计划写到文件里，或用[扩展](#extensions) 构建，或安装一个包。

**没有内置待办清单。** 它们会迷惑模型。使用 TODO.md 文件，或用[扩展](#extensions) 自己构建。

**没有后台 bash。** 使用 tmux。完全可观测、可直接交互。

完整理由请阅读[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。

---

## CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### 包命令

```bash
pi install <source> [-l]     # 安装包，-l 表示项目级安装
pi remove <source> [-l]      # 移除包
pi uninstall <source> [-l]   # remove 的别名
pi update [source|self|pi]   # 只更新 pi，或更新一个包源
pi update --all              # 更新 pi 和所有包
pi update --extensions       # 只更新包
pi update --models           # 只刷新模型目录
pi update --self             # 只更新 pi
pi update --self --force     # 即使已是最新也重装 pi
pi update --extension <src>  # 更新单个包
pi list                      # 列出已安装的包
pi config                    # 启用/禁用包资源
```

`pi config` 和项目包命令接受 `--approve`/`--no-approve`，以信任或忽略单条命令的项目级设置。`pi update` 从不提示项目信任。

### 模式

| 标志 | 描述 |
|------|-------------|
| （默认） | 交互模式 |
| `-p`, `--print` | 打印响应后退出 |
| `--mode json` | 以 JSON 行输出所有事件（参见 [docs/json.md](docs/json.md)） |
| `--mode rpc` | 用于进程集成的 RPC 模式（参见 [docs/rpc.md](docs/rpc.md)） |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式下，pi 也会读取管道输入并合并到初始提示词中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 描述 |
|--------|-------------|
| `--provider <name>` | 提供商（anthropic、openai、google 等） |
| `--model <pattern>` | 模型模式或 ID（支持 `provider/id` 和可选的 `:<thinking>`） |
| `--api-key <key>` | API 密钥（覆盖环境变量） |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 用于 Ctrl+P 循环切换的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 描述 |
|--------|-------------|
| `-c`, `--continue` | 继续最近的会话 |
| `-r`, `--resume` | 浏览并选择会话 |
| `--session <path\|id>` | 使用指定的会话文件或部分 UUID |
| `--fork <path\|id>` | 将指定的会话文件或部分 UUID fork 到一个新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式（不保存） |
| `--name <name>`, `-n <name>` | 启动时设置会话显示名称 |

### 工具选项

| 选项 | 描述 |
|--------|-------------|
| `--tools <list>`, `-t <list>` | 在内置、扩展和自定义工具中允许使用指定的工具名 |
| `--exclude-tools <list>`, `-xt <list>` | 在内置、扩展和自定义工具中禁用指定的工具名 |
| `--no-builtin-tools`, `-nbt` | 默认禁用内置工具，但保持扩展/自定义工具启用 |
| `--no-tools`, `-nt` | 默认禁用所有工具 |

可用的内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### 资源选项

| 选项 | 描述 |
|--------|-------------|
| `-e`, `--extension <source>` | 从路径、npm 或 git 加载扩展（可重复） |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能（可重复） |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示词模板（可重复） |
| `--no-prompt-templates` | 禁用提示词模板发现 |
| `--theme <path>` | 加载主题（可重复） |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`, `-nc` | 禁用 AGENTS.md 和 CLAUDE.md 上下文文件发现 |

把 `--no-*` 与显式标志组合，可以只加载你需要的内容并忽略 settings.json（例如 `--no-extensions -e ./my-ext.ts`）。

### 其他选项

| 选项 | 描述 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示词（上下文文件和技能仍然会追加） |
| `--append-system-prompt <text>` | 追加到系统提示词 |
| `--tui-mode <mode>` | TUI 模式：`regular`（默认）或实验性的 `fullscreen` |
| `--use-theme <name[/name]>` | 为本次运行设置初始交互主题，不修改设置 |
| `--verbose` | 强制详细启动输出 |
| `-a`, `--approve` | 为本次运行信任项目级文件 |
| `-na`, `--no-approve` | 为本次运行忽略项目级文件 |
| `-h`, `--help` | 显示帮助 |
| `-v`, `--version` | 显示版本 |

### 文件参数

给文件加上 `@` 前缀以包含到消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例

```bash
# 带初始提示词的交互模式
pi "List all .ts files in src/"

# 非交互模式
pi -p "Summarize this codebase"

# 带管道输入的非交互模式
cat README.md | pi -p "Summarize this text"

# 命名的一次性会话
pi --name "release audit" -p "Audit this repository"

# 不同的模型
pi --provider openai --model gpt-4o "Help me refactor"

# 带提供商前缀的模型（无需 --provider）
pi --model openai/gpt-4o "Help me refactor"

# 带思考级别简写的模型
pi --model sonnet:high "Solve this complex problem"

# 限制模型循环范围
pi --models "claude-*,gpt-4o"

# 只读模式
pi --tools read,grep,find,ls -p "Review the code"

# 只禁用一个扩展或内置工具，其余保持可用
pi --exclude-tools ask_question

# 高思考级别
pi --thinking high "Solve this complex problem"
```

### 环境变量

| 变量 | 描述 |
|----------|-------------|
| `AI_AGENT` | 由 CLI 和 RPC 入口点设为 `pi`，以便通用工具将子进程归属到 Pi |
| `PI_CODING_AGENT` | 由 CLI 和 RPC 入口点设为 `true`，以便子进程检测到自己在 Pi 内运行 |
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认：`~/.pi/agent`） |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖会话存储目录（会被 `--session-dir` 覆盖） |
| `PI_PACKAGE_DIR` | 覆盖包目录（对 Nix/Guix 等存储路径分词不佳的场景有用） |
| `PI_OFFLINE` | 禁用启动网络操作，包括更新检查、包更新检查和安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | 跳过启动时的 Pi 版本更新检查。这会阻止 `pi.dev` 的最新版本请求 |
| `PI_TELEMETRY` | 覆盖安装/更新遥测和提供商归属请求头。用 `1`/`true`/`yes` 启用，`0`/`false`/`no` 禁用。这不会禁用更新检查 |
| `PI_CACHE_RETENTION` | 设为 `long` 以延长提示词缓存（Anthropic：1 小时，OpenAI：24 小时） |
| `VISUAL`, `EDITOR` | 当 `externalEditor` 未设置时，Ctrl+G 回退使用的外部编辑器；Windows 默认记事本，其他平台默认 `nano` |

由 LLM 可调用的 bash 工具运行的命令还会收到当前会话元数据：

| 变量 | 描述 |
|----------|-------------|
| `PI_SESSION_ID` | 当前会话 ID |
| `PI_SESSION_FILE` | 会话 JSONL 的绝对路径；临时会话中未设置 |
| `PI_PROVIDER` | 当前选中的模型提供商 |
| `PI_MODEL` | 当前选中的模型 ID |
| `PI_REASONING_LEVEL` | 当前生效的推理级别 |

这些值在每条命令启动时解析。语义、示例和自定义工具退出方式参见[环境变量](docs/environment-variables.md#bash-tool-session-environment)。

---

## 贡献与开发

指南见 [CONTRIBUTING.md](../../CONTRIBUTING.md)，环境配置、fork 和调试见 [docs/development.md](docs/development.md)。

## 许可证

MIT

## 另请参阅

- [@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai)：核心 LLM 工具包
- [@earendil-works/pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core)：代理框架
- [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui)：终端 UI 组件

<p align="center">
  <a href="https://pi.dev">pi.dev</a> 域名由
  <br /><br />
  <a href="https://exe.dev"><img src="docs/images/exy.png" alt="Exy 吉祥物" width="48" /><br />exe.dev</a>
</p>
