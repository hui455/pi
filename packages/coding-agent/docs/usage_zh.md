# 使用 Pi

本页汇总快速入门页面未涵盖的日常使用细节。

## 交互模式

<p align="center"><img src="images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

界面包含四个主要区域：

- **启动头部（Startup header）** - 快捷键、已加载的上下文文件、提示模板、技能（skills）和扩展
- **消息区（Messages）** - 用户消息、助手回复、工具调用、工具结果、通知、错误和扩展 UI
- **编辑器（Editor）** - 输入区域；边框颜色表示当前的思考级别
- **底部栏（Footer）** - 工作目录、会话名称、token/缓存用量、费用、上下文用量和当前模型。总计包含助手回复、工具报告的用量以及摘要生成

编辑器可被内置 UI（如 `/settings`）或自定义扩展 UI 临时替代。

### 编辑器功能

| 功能 | 操作方式 |
|---------|-----|
| 文件引用 | 输入 `@` 进行项目文件模糊搜索 |
| 路径补全 | 按 Tab 补全路径 |
| 多行输入 | Shift+Enter，或 Windows Terminal 下按 Ctrl+Enter |
| 复制回复 | Ctrl+X 复制最后一条助手消息；在 `/tree` 中复制选中的消息 |
| 图片 | 使用 Ctrl+V 粘贴，Windows 下用 Alt+V，或拖入终端 |
| Shell 命令 | `!command` 运行命令并将输出发送给模型 |
| 隐藏 shell 命令 | `!!command` 运行命令但不将输出发送给模型 |
| 外部编辑器 | Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`，Windows 下为记事本，其他平台为 `nano` |

所有快捷键及其自定义方式参见 [快捷键](keybindings.md)。

## Slash 命令

在编辑器中输入 `/` 可打开命令补全。扩展可以注册自定义命令，技能以 `/skill:name` 形式提供，提示模板通过 `/templatename` 展开。

| 命令 | 说明 |
|---------|-------------|
| `/login`、`/logout` | 管理 OAuth 或 API key 凭据 |
| [`/llama`](llama-cpp.md) | 下载、加载和卸载 llama.cpp 路由器模型 |
| `/model` | 切换模型 |
| `/scoped-models` | 启用/禁用用于 Ctrl+P 循环的模型 |
| `/settings` | 思考级别、主题、消息投递方式、传输方式 |
| `/resume` | 从之前的会话中选择 |
| `/new` | 开启新会话 |
| `/name <name>` | 设置会话显示名称 |
| `/session` | 显示会话文件、ID、消息、token 和费用 |
| `/tree` | 跳转到会话中的任意节点并从此处继续 |
| `/trust` | 保存项目信任决定，供未来会话使用 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制到新会话中 |
| `/compact [prompt]` | 手动压缩上下文，可选附上自定义指令 |
| `/copy` | 将最后一条助手消息复制到剪贴板 |
| `/export [file]` | 将会话导出为 HTML 或 JSONL |
| `/import <file>` | 从 JSONL 文件导入并恢复会话 |
| `/share` | 以私有 GitHub gist 上传，附带可分享的 HTML 链接 |
| `/reload` | 重新加载快捷键、扩展、技能、提示、主题和上下文文件 |
| `/hotkeys` | 显示所有键盘快捷键 |
| `/changelog` | 显示版本历史 |
| `/quit` | 退出 pi |

## 消息队列

可以在 agent 仍在工作时提交消息：

- **Enter** 排队一条引导消息（steering message），在当前助手回合完成其工具调用后投递。
- **Alt+Enter** 排队一条后续消息（follow-up message），在 agent 完成所有工作后投递。
- **Escape** 中止操作并将排队的消息恢复到编辑器。
- **Alt+Up** 将排队的消息取回编辑器。

在 Windows Terminal 中，Alt+Enter 默认是全屏快捷键。若希望 pi 接收该快捷键，请按[终端设置](terminal-setup.md)中的说明重新映射。

投递方式可在[设置](settings.md)中通过 `steeringMode` 和 `followUpMode` 配置。

## 会话

会话会自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择会话
pi --no-session        # 临时模式；不保存
pi --name "my task"    # 启动时设置会话显示名称
pi --session <path|id> # 使用指定的会话文件或会话 ID
pi --fork <path|id>    # 将会话分叉到新的会话文件
```

实用的会话命令：

- `/session` 显示当前会话文件和 ID。
- `/tree` 在文件内导航会话树，并可总结被废弃的分支。
- `/fork` 从较早的用户消息创建新会话。
- `/clone` 将当前活动分支复制到新的会话文件中。
- `/compact` 总结较旧的消息以释放上下文。

详见[会话](sessions.md)和[压缩](compaction.md)。

## 上下文文件

Pi 在启动时从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`：

- `~/.pi/agent/AGENTS.md`，用于全局指令
- 父目录，从当前工作目录向上逐级查找
- 当前目录

如果某个目录包含 `AGENTS.override.md`，Pi 会加载它而不是该目录中的 `AGENTS.md` 或 `CLAUDE.md`。来自其他目录的上下文文件仍会正常叠加。

使用上下文文件来记录项目约定、命令、安全规则和偏好。可使用 `--no-context-files` 或 `-nc` 禁用加载。

### 系统提示文件

替换默认系统提示：

- 项目级：`.pi/SYSTEM.md`
- 全局：`~/.pi/agent/SYSTEM.md`

若不想替换而是在默认提示后追加，可在上述任一位置使用 `APPEND_SYSTEM.md`。

### 项目信任

在交互式启动时，如果项目文件夹包含项目级设置、资源或项目 `.agents/skills`，且 `~/.pi/agent/trust.json` 中没有针对该文件夹或其父文件夹的已保存决定，pi 会先询问是否信任该项目。信任项目后，pi 才能加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

在信任决定之前，pi 只加载上下文文件、用户/全局扩展和 CLI `-e` 扩展，以便它们能够处理 `project_trust` 事件。项目级扩展、项目包管理的扩展和项目设置仅在项目被信任后加载。此区分同样适用于切换到来自其他 cwd、且其信任状态尚未在当前进程中解决的会话时。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会显示信任提示。在没有适用的已保存信任决定时，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，而 `always` 会信任它们。可传入 `--approve`/`-a` 或 `--no-approve`/`-na` 为单次运行覆盖项目信任决定。

如果没有扩展或已保存的决定适用，`defaultProjectTrust` 控制回退行为。可在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 修改。

`pi config` 和包命令使用相同的项目信任流程，但 `pi update` 从不提示。可传入 `--approve` 为单条命令信任项目级设置，或传入 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 可保存项目信任决定供未来会话使用，包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此请重启 pi 使更改生效。


## 导出与分享会话

使用 `/export [file]` 将会话写入 HTML。

使用 `/share` 上传私有 GitHub gist，附带可分享的 HTML 链接。

如果你将 pi 用于开源工作，并希望发布会话供模型、提示词、工具和评测研究使用，请参阅 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它会将会话发布到 Hugging Face 数据集。

## CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### 包命令

```bash
pi install <source> [-l]     # 安装包，-l 表示项目级
pi remove <source> [-l]      # 移除包
pi uninstall <source> [-l]   # remove 的别名
pi update [source|self|pi]   # 只更新 pi，或更新一个包源
pi update --all              # 更新 pi 和所有包；同步固定的 git 引用
pi update --extensions       # 只更新包；同步固定的 git 引用
pi update --models           # 只刷新模型目录
pi update --self             # 只更新 pi
pi update --extension <src>  # 更新一个包
pi list                      # 列出已安装的包
pi config                    # 启用/禁用包资源
```

这些命令管理 pi 包，`pi update` 可以更新 pi CLI 安装本身。卸载 pi 本身请参阅[快速入门](quickstart.md#uninstall)。`pi config` 和项目包命令接受 `--approve`/`--no-approve`，用于为单条命令信任或忽略项目级设置。`pi update` 从不提示项目信任。

包源与安全说明见[Pi 包](packages.md)。

### 模式

| 标志 | 说明 |
|------|-------------|
| 默认 | 交互模式 |
| `-p`、`--print` | 打印回复后退出 |
| `--mode json` | 以 JSON 行输出所有事件；见 [JSON 模式](json.md) |
| `--mode rpc` | 通过 stdin/stdout 的 RPC 模式；见 [RPC 模式](rpc.md) |
| `--export <in> [out]` | 将会话导出为 HTML |

在打印模式下，pi 也会读取管道输入的 stdin，并将其合并到初始提示中：

```bash
cat README.md | pi -p "Summarize this text"
```

### 模型选项

| 选项 | 说明 |
|--------|-------------|
| `--provider <name>` | 提供商，例如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | 模型模式或 ID；支持 `provider/id` 及可选的 `:<thinking>` |
| `--api-key <key>` | API key，覆盖环境变量 |
| `--thinking <level>` | `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | 用于 Ctrl+P 循环的逗号分隔模式 |
| `--list-models [search]` | 列出可用模型 |

### 会话选项

| 选项 | 说明 |
|--------|-------------|
| `-c`、`--continue` | 继续最近的会话 |
| `-r`、`--resume` | 浏览并选择会话 |
| `--session <path\|id>` | 使用指定的会话文件或部分 UUID |
| `--fork <path\|id>` | 将会话文件或部分 UUID 分叉到新会话 |
| `--session-dir <dir>` | 自定义会话存储目录 |
| `--no-session` | 临时模式；不保存 |
| `--name <name>`、`-n <name>` | 启动时设置会话显示名称 |

### 工具选项

| 选项 | 说明 |
|--------|-------------|
| `--tools <list>`、`-t <list>` | 白名单指定内置、扩展和自定义工具 |
| `--exclude-tools <list>`、`-xt <list>` | 禁用指定的内置、扩展和自定义工具 |
| `--no-builtin-tools`、`-nbt` | 禁用内置工具，但保留扩展/自定义工具 |
| `--no-tools`、`-nt` | 禁用所有工具 |

内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### 资源选项

| 选项 | 说明 |
|--------|-------------|
| `-e`、`--extension <source>` | 从路径、npm 或 git 加载扩展；可重复 |
| `--no-extensions` | 禁用扩展发现 |
| `--skill <path>` | 加载技能；可重复 |
| `--no-skills` | 禁用技能发现 |
| `--prompt-template <path>` | 加载提示模板；可重复 |
| `--no-prompt-templates` | 禁用提示模板发现 |
| `--theme <path>` | 加载主题；可重复 |
| `--no-themes` | 禁用主题发现 |
| `--no-context-files`、`-nc` | 禁用 `AGENTS.md` 和 `CLAUDE.md` 发现 |

将 `--no-*` 与显式标志组合使用，可以只加载你真正需要的内容，忽略设置。示例：

```bash
pi --no-extensions -e ./my-extension.ts
```

### 其他选项

| 选项 | 说明 |
|--------|-------------|
| `--system-prompt <text>` | 替换默认提示；上下文文件和技能仍会追加 |
| `--append-system-prompt <text>` | 追加到系统提示 |
| `--tui-mode <mode>` | TUI 模式：`regular`（默认）或实验性的 `fullscreen` |
| `--use-theme <name[/name]>` | 为本次运行设置初始交互主题，不修改设置 |
| `--verbose` | 强制显示详细启动信息 |
| `-a`、`--approve` | 为本次运行信任项目级文件 |
| `-na`、`--no-approve` | 为本次运行忽略项目级文件 |
| `-h`、`--help` | 显示帮助 |
| `-v`、`--version` | 显示版本 |

在 `fullscreen` 模式下，转录内容在终端视口内滚动，而排队的消息、工作状态、扩展小组件、编辑器和底部栏固定在底部。鼠标/触控板输入会滚动指针下方的区域；键盘视口操作始终可用。内联图片在支持 Kitty 图形协议的终端中可用，包括 Kitty 和 Ghostty。在 iTerm2 中它们渲染为文本占位符，因为其内联图片协议无法在应用控制的滚动期间删除或裁剪放置位置。在 `regular` 模式下，pi 使用主屏幕和终端自有的回滚缓冲区，iTerm2 的内联图片可正常渲染。终端特定设置与变通方案见[终端设置](terminal-setup.md)。

可在 `/settings` 中设置 **TUI 模式**，立即在 `regular` 和 `fullscreen` 之间切换，并为未来会话选择默认值。**全屏退出输出（Fullscreen exit output）** 控制退出全屏时是打印最终转录，还是恢复之前的屏幕并仅打印会话恢复提示。

### 文件参数

用 `@` 前缀将文件包含到消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### 示例

```bash
# Interactive with initial prompt
pi "List all .ts files in src/"

# Non-interactive
pi -p "Summarize this codebase"

# Non-interactive with piped stdin
cat README.md | pi -p "Summarize this text"

# Named one-shot session
pi --name "release audit" -p "Audit this repository"

# Different model
pi --provider openai --model gpt-4o "Help me refactor"

# Model with provider prefix
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question
```

## 设计原则

Pi 保持核心小巧，将工作流特定行为推向扩展、技能、提示模板和包。

它刻意不内置 MCP、子代理、权限弹窗、计划模式、待办清单或后台 bash。你可以将这些工作流构建或安装为扩展或包，也可以使用容器和 tmux 等外部工具。

完整理由请阅读[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
