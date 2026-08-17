# 会话

Pi 将会话保存为记录，以便你可以继续工作、从之前的轮次分支，以及重访之前的路径。

## 会话存储

会话自动保存到 `~/.pi/agent/sessions/`，按工作目录组织。每个会话是一个 JSONL 文件，内部是树形结构。

```bash
pi -c                  # 继续最近的会话
pi -r                  # 浏览并选择过去的会话
pi --no-session        # 临时模式；不保存
pi --name "my task"    # 启动时设置会话显示名称
pi --session <path|id> # 使用特定的会话文件或部分会话 ID
pi --fork <path|id>    # 将会话文件或部分会话 ID 分叉为新会话
```

在交互模式下使用 `/session` 可查看当前会话文件、会话 ID、消息数、token 数和费用。

关于 JSONL 文件格式和 SessionManager API，参见 [Session Format](session-format.md)。

## 会话命令

| 命令 | 说明 |
|---------|-------------|
| `/resume` | 浏览并选择之前的会话 |
| `/new` | 开始新会话 |
| `/name <name>` | 设置当前会话的显示名称 |
| `/session` | 显示会话信息 |
| `/tree` | 浏览当前会话树 |
| `/fork` | 从之前的用户消息创建新会话 |
| `/clone` | 将当前活动分支复制为新会话 |
| `/compact [prompt]` | 摘要总结较早的上下文；参见 [Compaction](compaction.md) |
| `/export [file]` | 将会话导出为 HTML |
| `/share` | 上传为私有 GitHub gist，附带可分享的 HTML 链接 |

## 恢复和删除会话

`/resume` 打开当前项目的交互式会话选择器。`pi -r` 在启动时打开同一个选择器。

在选择器中你可以：

- 输入文字进行搜索
- 按 Ctrl+P 切换路径显示
- 按 Ctrl+S 切换排序模式
- 按 Ctrl+N 筛选出已命名的会话
- 按 Ctrl+R 重命名
- 按 Ctrl+D 删除，然后确认

可用时，pi 使用 `trash` CLI 进行删除，而不是永久移除文件。

## 命名会话

使用 `/name <name>` 设置人类可读的会话名称：

```text
/name Refactor auth module
```

在启动时用 `--name` 或 `-n` 设置名称：

```bash
pi --name "Refactor auth module"
pi --name "CI audit" -p "Review this build failure"
```

已命名的会话在 `/resume` 和 `pi -r` 中更容易找到。

## 使用 `/tree` 分支

会话以树形结构存储。每条记录都有 `id` 和 `parentId`，当前位置是活动叶子。`/tree` 让你跳转到之前的任意位置并从那里继续，而无需创建新文件。

<p align="center"><img src="images/tree-view.png" alt="树形视图" width="600"></p>

示例形态：

```text
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### 树形控件

| 按键 | 动作 |
|-----|--------|
| ↑/↓ | 浏览可见条目 |
| ←/→ | 向上/向下翻页 |
| Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ | 折叠/展开或在分支段之间跳转 |
| Shift+L | 在选中条目上设置或清除标签 |
| Shift+T | 切换标签时间戳 |
| Enter | 选择条目 |
| Escape/Ctrl+C | 取消 |
| Ctrl+O | 循环切换筛选模式 |

筛选模式有：default、no-tools、user-only、labeled-only 和 all。在 [Settings](settings.md) 中用 `treeFilterMode` 配置默认值。

### 选择行为

选择用户或自定义消息：

1. 将叶子移动到所选消息的父级。
2. 将所选消息的文本放入编辑器。
3. 你可以编辑并重新提交，从而创建新分支。

选择助手、工具、压缩或其他非用户条目：

1. 将叶子移动到该条目。
2. 让编辑器保持为空。
3. 你可以从该点继续。

选择根用户消息会将叶子重置为空对话，并将原始提示放入编辑器。

## `/tree`、`/fork` 和 `/clone`

| 特性 | `/tree` | `/fork` | `/clone` |
|---------|---------|---------|----------|
| 输出 | 同一个会话文件 | 新会话文件 | 新会话文件 |
| 视图 | 完整树 | 用户消息选择器 | 当前活动分支 |
| 典型用途 | 原地探索备选方案 | 从更早的提示开始新会话 | 继续前复制当前工作 |
| 摘要 | 可选的分支摘要 | 无 | 无 |

想在原地保留备选方案时使用 `/tree`。想要独立的会话文件时使用 `/fork` 或 `/clone`。

## 分支摘要

当 `/tree` 从一个分支切换到另一个分支时，pi 可以摘要总结被放弃的分支，并在新位置附加该摘要。这样可以保留你所离开路径的重要上下文，而无需重放整个分支。

被提示时，选择以下之一：

1. 不生成摘要
2. 使用默认提示生成摘要
3. 使用自定义焦点指令生成摘要

分支摘要的内部实现和扩展钩子参见 [Compaction](compaction.md)。

## 会话格式

会话文件是 JSONL 格式，包含消息条目、模型变更、思考级别变更、标签、压缩、分支摘要和扩展条目。

解析器、扩展、SDK 用法和完整的 SessionManager API 参见 [Session Format](session-format.md)。
