> pi 可以创建技能。让它为你的用例构建一个。

# 技能

技能（Skills）是自包含的能力包，agent 按需加载。技能为特定任务提供专门的工作流程、设置说明、辅助脚本和参考文档。

Pi 实现了 [Agent Skills 标准](https://agentskills.io/specification)，对大多数违规行为给出警告但仍保持宽松。Pi 允许技能名称与其父目录不同，尽管标准禁止这样做；该规则对跨多个 agent harness 共享的技能目录来说并不理想。

## 目录

- [位置](#locations)
- [技能如何工作](#how-skills-work)
- [技能命令](#skill-commands)
- [技能结构](#skill-structure)
- [Frontmatter](#frontmatter)
- [校验](#validation)
- [示例](#example)
- [技能仓库](#skill-repositories)

## 位置

> **安全：** 技能可以指示模型执行任何操作，并可能包含模型会调用的可执行代码。使用前请审查技能内容。

Pi 从以下位置加载技能：

- 全局：
  - `~/.pi/agent/skills/`
  - `~/.agents/skills/`
- 项目（仅在项目被信任后）：
  - `.pi/skills/`
  - `cwd` 及其祖先目录中的 `.agents/skills/`（向上到 git 仓库根目录，不在仓库中时到文件系统根目录）
- 包：`skills/` 目录或 `package.json` 中的 `pi.skills` 条目
- 设置：`skills` 数组，可包含文件或目录
- CLI：`--skill <path>`（可重复，即使有 `--no-skills` 也生效）

发现规则：
- 在 `~/.pi/agent/skills/` 和 `.pi/skills/` 中，根目录下的 `.md` 文件被发现为独立技能
- 在所有技能位置，包含 `SKILL.md` 的目录会被递归发现
- 在 `~/.agents/skills/` 和项目 `.agents/skills/` 中，根目录下的 `.md` 文件会被忽略

使用 `--no-skills` 禁用发现（显式的 `--skill` 路径仍会加载）。

### 使用其他 harness 的技能

要使用 Claude Code 或 OpenAI Codex 的技能，将其目录添加到设置：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

对于项目级的 Claude Code 技能，添加到 `.pi/settings.json`：

```json
{
  "skills": ["../.claude/skills"]
}
```

## 技能如何工作

1. 启动时，pi 扫描技能位置并提取名称和描述
2. 系统提示按[规范](https://agentskills.io/integrate-skills)以 XML 格式包含可用技能
3. 当任务匹配时，agent 使用 `read` 加载完整的 SKILL.md（模型不总是这样做；使用提示或 `/skill:name` 强制加载）
4. agent 遵循说明，使用相对路径引用脚本和资源

这是渐进式披露（progressive disclosure）：只有描述始终在上下文中，完整说明按需加载。

## 技能命令

技能注册为 `/skill:name` 命令：

```bash
/skill:brave-search           # Load and execute the skill
/skill:pdf-tools extract      # Load skill with arguments
```

命令后的参数以 `User: <args>` 形式追加到技能内容。

在交互模式中通过 `/settings` 或在 `settings.json` 中切换技能命令：

```json
{
  "enableSkillCommands": true
}
```

## 技能结构

技能是包含 `SKILL.md` 文件的目录。其他一切都是自由格式。

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
│   └── process.sh
├── references/           # Detailed docs loaded on-demand
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md 格式

````markdown
---
name: my-skill
description: What this skill does and when to use it. Be specific.
---

# My Skill

## Setup

Run once before first use:
```bash
cd /path/to/skill && npm install
```

## Usage

```bash
./scripts/process.sh <input>
```
````

使用相对于技能目录的路径：

```markdown
See [the reference guide](references/REFERENCE.md) for details.
```

## Frontmatter

根据 [Agent Skills 规范](https://agentskills.io/specification#frontmatter-required)：

| 字段 | 必需 | 说明 |
|-------|----------|-------------|
| `name` | 是 | 最多 64 个字符。小写 a-z、0-9、连字符。与标准不同，Pi 不要求它与父目录一致，因为该标准要求对共享技能目录来说并不理想。 |
| `description` | 是 | 最多 1024 个字符。技能的用途及使用时机。 |
| `license` | 否 | 许可证名称或对捆绑文件的引用。 |
| `compatibility` | 否 | 最多 500 个字符。环境要求。 |
| `metadata` | 否 | 任意的 key-value 映射。 |
| `allowed-tools` | 否 | 以空格分隔的预先批准工具列表（实验性）。 |
| `disable-model-invocation` | 否 | 为 `true` 时，技能从系统提示中隐藏。用户必须使用 `/skill:name`。 |

### 命名规则

- 1-64 个字符
- 仅限小写字母、数字、连字符
- 不能以连字符开头或结尾
- 不能有连续连字符
Pi 不要求名称与父目录一致。Agent Skills 标准要求一致，但该要求对多个工具共享的技能目录来说并不理想。

有效：`pdf-processing`、`data-analysis`、`code-review`
无效：`PDF-Processing`、`-pdf`、`pdf--processing`

### 描述最佳实践

描述决定 agent 何时加载技能。请具体。

良好：
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

不佳：
```yaml
description: Helps with PDFs.
```

## 校验

Pi 依据 Agent Skills 标准校验技能。大多数问题会产生警告，但技能仍会加载：

- 名称超过 64 个字符或包含无效字符
- 名称以连字符开头/结尾或有连续连字符
- 描述超过 1024 个字符

未知的 frontmatter 字段会被忽略。

**例外：** 缺少描述的技能不会被加载。

名称冲突（来自不同位置的同名技能）会给出警告并保留第一个找到的技能。

## 示例

```
brave-search/
├── SKILL.md
├── search.js
└── content.js
```

**SKILL.md：**
````markdown
---
name: brave-search
description: Web search and content extraction via Brave Search API. Use for searching documentation, facts, or any web content.
---

# Brave Search

## Setup

```bash
cd /path/to/brave-search && npm install
```

## Search

```bash
./search.js "query"              # Basic search
./search.js "query" --content    # Include page content
```

## Extract Page Content

```bash
./content.js https://example.com
```
````

## 技能仓库

- [Anthropic Skills](https://github.com/anthropics/skills) - 文档处理（docx、pdf、pptx、xlsx）、网页开发
- [Pi Skills](https://github.com/badlogic/pi-skills) - 网页搜索、浏览器自动化、Google API、转录
