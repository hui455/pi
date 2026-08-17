# 设置

Pi 使用 JSON 设置文件，项目设置覆盖全局设置。

| 位置 | 作用域 |
|----------|-------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目（当前目录） |

可以直接编辑，也可以使用 `/settings` 配置常用选项。

## 项目信任

交互式启动时，如果项目文件夹包含项目级设置、资源或项目的 `.agents/skills`，且该文件夹或其父文件夹在 `~/.pi/agent/trust.json` 中没有已保存的决定，pi 会先询问是否信任该项目。信任项目允许 pi 加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不显示信任提示。没有适用的已保存信任决定时，它们使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，而 `always` 会信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可为单次运行覆盖项目信任。

如果没有扩展或已保存的决定适用，`defaultProjectTrust` 控制回退行为。在 `~/.pi/agent/settings.json` 中将其设置为 `"ask"`、`"always"` 或 `"never"`，或通过 `/settings` 修改。

`pi config` 和包命令使用相同的项目信任流程，但 `pi update` 从不提示。传入 `--approve` 可为单条命令信任项目级设置，或传入 `--no-approve` 忽略它们。

在交互模式中使用 `/trust` 保存项目信任决定，供以后的会话使用，包括对直接父文件夹的信任。它只写入 `~/.pi/agent/trust.json`；当前会话不会重载，因此需要重启 pi 才能生效。

## 全部设置

### 模型与思考

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `defaultProvider` | string | - | 默认提供商（例如 `"anthropic"`、`"openai"`） |
| `defaultModel` | string | - | 默认模型 ID |
| `defaultThinkingLevel` | string | - | `"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"` |
| `hideThinkingBlock` | boolean | `false` | 在输出中隐藏思考块 |
| `showCacheMissNotices` | boolean | `false` | 对显著的提示缓存未命中显示转录提示 |
| `thinkingBudgets` | object | - | 每个思考等级的自定义 token 预算 |

#### thinkingBudgets

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### UI 与显示

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | 主题名称（`"dark"`、`"light"` 或自定义） |
| `externalEditor` | string | `$VISUAL`，然后是 `$EDITOR`，再是 Windows 上的 Notepad 或其它平台上的 `nano` | Ctrl+G 外部编辑器的命令；优先于环境变量 |
| `quietStartup` | boolean | `false` | 隐藏启动页头 |
| `defaultProjectTrust` | string | `"ask"` | 回退的项目信任行为：`"ask"`、`"always"` 或 `"never"`。仅全局设置 |
| `collapseChangelog` | boolean | `false` | 更新后显示精简版变更日志 |
| `enableInstallTelemetry` | boolean | `true` | 首次安装或检测到变更日志更新后发送一次匿名的安装/更新版本 ping。这不控制更新检查 |
| `enableAnalytics` | boolean | `false` | 选用的分析数据共享。目前只在实验性首次安装引导（`PI_EXPERIMENTAL=1`）期间询问 |
| `trackingId` | string | - | 分析跟踪标识符，在开启 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | string | `"tree"` | 双击 Esc 的操作：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | string | `"default"` | `/tree` 的默认过滤器：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | number | `0` | 输入编辑器的水平内边距（0-3） |
| `outputPad` | number | `1` | 用户消息、助手消息和思考的水平内边距（0 或 1） |
| `autocompleteMaxVisible` | number | `5` | 自动补全下拉框的最大可见项数（3-20） |
| `showHardwareCursor` | boolean | `false` | TUI 定位光标以支持 IME 时，显示终端光标 |
| `tuiMode` | string | `"regular"` | 交互式 TUI 模式：`"regular"` 或实验性的 `"fullscreen"`。通过 `/settings` 修改会立即生效；`--tui-mode` 在启动时覆盖此设置 |
| `fullscreenExitOutput` | string | `"transcript"` | 全屏模式退出时的输出：`"transcript"` 打印最终转录和恢复提示，而 `"resume-hint"` 恢复之前的屏幕并只打印恢复提示。在常规 TUI 模式下无效 |
| `fullscreenScrollbar` | string | `"auto"` | 全屏转录滚动条：`"auto"` 在滚动时临时显示，`"always"` 保留最右列并保持可见，`"hidden"` 隐藏。在常规 TUI 模式下无效 |

对于 VS Code，加上 `--wait` 以便编辑器退出后 pi 恢复：

```json
{
  "externalEditor": "code --wait"
}
```

### 遥测与更新检查

`enableInstallTelemetry` 只控制向 `https://pi.dev/api/report-install` 发送的匿名安装/更新 ping。退出遥测不会禁用更新检查；Pi 仍会获取 `https://pi.dev/api/latest-version` 查找最新版本。

设置 `PI_SKIP_VERSION_CHECK=1` 可禁用 Pi 版本更新检查。使用 `--offline` 或 `PI_OFFLINE=1` 可禁用此处描述的所有启动网络操作，包括更新检查、包更新检查以及安装/更新遥测。

### 网络

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `httpProxy` | string | - | HTTP 代理 URL，应用为 `HTTP_PROXY` 和 `HTTPS_PROXY`。仅全局设置。 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### 警告

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | 当 Anthropic 订阅认证可能产生付费额外用量时显示警告 |

```json
{
  "warnings": {
    "anthropicExtraUsage": false
  }
}
```

### 压缩

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | 启用自动压缩 |
| `compaction.reserveTokens` | number | `16384` | 为 LLM 响应预留的 token 数 |
| `compaction.keepRecentTokens` | number | `20000` | 保留的近期 token 数（不做摘要） |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### 分支摘要

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | 为分支摘要预留的 token 数 |
| `branchSummary.skipPrompt` | boolean | `false` | 在 `/tree` 导航时跳过"汇总分支？"提示（默认不生成摘要） |

### 重试

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | 启用临时错误时的自动代理级重试 |
| `retry.maxRetries` | number | `3` | 最大代理级重试次数 |
| `retry.baseDelayMs` | number | `2000` | 代理级指数退避的基础延迟（2 秒、4 秒、8 秒） |
| `retry.provider.timeoutMs` | number | SDK 默认值 | 提供商/SDK 请求超时（毫秒） |
| `retry.provider.maxRetries` | number | `0` | 提供商/SDK 重试次数 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | 服务器要求的最长等待延迟，超过即失败（60 秒） |

当提供商请求的重试延迟长于 `retry.provider.maxRetryDelayMs` 时，请求会立即失败并给出信息性错误，而不是静默等待。设为 `0` 可禁用该限制。

除非确实需要提供商级重试，否则将 `retry.provider.maxRetries` 保持为 `0`。把它设为大于 `0` 会让 SDK/提供商重试在处理超出用量限制的错误时先于 Pi 介入，在某些情况下可能会一直阻塞代理直到提供商配额重置。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "timeoutMs": 3600000,
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

### 消息投递

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | 引导消息（steering message）的发送方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | 后续消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | string | `"auto"` | 支持多种传输方式的提供商的首选传输：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` | HTTP 头/正文空闲超时（毫秒），也用于有显式流空闲超时的提供商。设为 `0` 禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | 支持 WebSocket 传输的提供商的 WebSocket 连接/打开握手超时（毫秒）。设为 `0` 禁用。 |

### 终端与图像

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | 在终端中显示图像（如果支持） |
| `terminal.imageWidthCells` | number | `60` | 行内图像的首选宽度（终端单元格） |
| `terminal.clearOnShrink` | boolean | `false` | 内容缩小时清除空行（可能导致闪烁） |
| `images.autoResize` | boolean | `true` | 将图像调整为最大 2000x2000。适用于 `@file` 附件、`read` 和工具返回的图像 |
| `images.blockImages` | boolean | `false` | 阻止所有图像发送给 LLM |

### Shell

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `shellPath` | string | - | 自定义 shell 路径（例如 Windows 上的 Cygwin）；支持开头 `~` 表示主目录 |
| `shellCommandPrefix` | string | - | 每个 bash 命令的前缀（例如 `"shopt -s expand_aliases"`） |
| `npmCommand` | string[] | - | 用于 npm 包查找/安装操作的命令 argv（例如 `["mise", "exec", "node@20", "--", "npm"]`） |

JSON 中的 Windows 路径必须使用正斜杠或转义的反斜杠：

```json
{
  "shellPath": "C:/Program Files/Git/bin/bash.exe"
}
```

```json
{
  "shellPath": "C:\\Program Files\\Git\\bin\\bash.exe"
}
```

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

`npmCommand` 用于所有 npm 包管理器操作，包括安装、卸载以及 git 包内的依赖安装。用户级 npm 包安装到 `~/.pi/agent/npm/`；项目级 npm 包安装到 `.pi/npm/`。请严格按进程启动方式使用 argv 风格条目。配置了 `npmCommand` 后，git 包依赖安装使用普通 `install`，以避免包装器或替代包管理器中的 npm 特有标志。

### 工具

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `defaultTools` | string[] | - | 初始启用的内置工具。省略时，Pi 使用其标准默认值 |

`defaultTools` 选择启动时启用的内置工具。扩展和 SDK 自定义工具保持启用：

```json
{
  "defaultTools": ["bash", "edit", "write"]
}
```

空数组表示不带内置工具启动，同时保留扩展和 SDK 自定义工具。`--tools` 用针对所有工具的严格允许列表替代此行为，`--no-tools` 禁用所有工具，`--no-builtin-tools` 禁用内置默认值。`--exclude-tools` 过滤最终列表。项目 `defaultTools` 数组会替换全局数组。

### 会话

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `sessionDir` | string | - | 会话文件存储目录。接受绝对或相对路径，也接受 `~`。 |

```json
{ "sessionDir": ".pi/sessions" }
```

当多个来源指定会话目录时，优先级为 `--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，然后是 settings.json 中的 `sessionDir`。

### 模型轮换

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | Ctrl+P 轮换的模型模式（与 `--models` CLI 标志格式相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | string | `"  "` | 代码块的缩进 |
| `markdown.mermaid` | string | `"streaming"` | Mermaid 渲染模式：`"off"`、`"final"` 或 `"streaming"` |

### 资源

这些设置定义从哪里加载扩展、技能、提示词和主题。

`~/.pi/agent/settings.json` 中的路径相对于 `~/.pi/agent` 解析。`.pi/settings.json` 中的路径相对于 `.pi` 解析。支持绝对路径和 `~`。

| 设置 | 类型 | 默认值 | 说明 |
|---------|------|---------|-------------|
| `packages` | array | `[]` | 从中加载资源的 npm/git 包 |
| `extensions` | string[] | `[]` | 本地扩展文件路径或目录 |
| `skills` | string[] | `[]` | 本地技能文件路径或目录 |
| `prompts` | string[] | `[]` | 本地提示词模板路径或目录 |
| `themes` | string[] | `[]` | 本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | 将技能注册为 `/skill:name` 命令 |

数组支持 glob 模式和排除。使用 `!pattern` 排除。使用 `+path` 强制包含精确路径，使用 `-path` 强制排除精确路径。

#### packages

字符串形式会加载包中的所有资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

对象形式会过滤要加载的资源：

```json
{
  "packages": [
    {
      "source": "pi-skills",
      "skills": ["brave-search", "transcribe"],
      "extensions": []
    }
  ]
}
```

包管理详情参见 [packages.md](packages.md)。

## 示例

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "warnings": {
    "anthropicExtraUsage": true
  },
  "packages": ["pi-skills"]
}
```

## 项目覆盖

项目设置（`.pi/settings.json`）覆盖全局设置。嵌套对象会合并：

```json
// ~/.pi/agent/settings.json (global)
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// .pi/settings.json (project)
{
  "compaction": { "reserveTokens": 8192 }
}

// Result
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
