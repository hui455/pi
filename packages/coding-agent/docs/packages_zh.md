> pi 可以帮你创建 pi 包。让它打包你的扩展、技能、提示模板或主题。

# Pi 包

Pi 包将扩展、技能、提示模板和主题打包在一起，方便你通过 npm 或 git 分享。包可以在 `package.json` 的 `pi` key 下声明资源，或使用约定目录。

## 目录

- [安装与管理](#install-and-manage)
- [包来源](#package-sources)
- [创建 Pi 包](#creating-a-pi-package)
- [包结构](#package-structure)
- [依赖](#dependencies)
- [包过滤](#package-filtering)
- [启用与禁用资源](#enable-and-disable-resources)
- [作用域与去重](#scope-and-deduplication)

## 安装与管理

> **安全：** Pi 包以完全系统权限运行。扩展会执行任意代码，技能可以指示模型执行任何操作，包括运行可执行文件。安装第三方包之前请先审查源代码。

```bash
pi install npm:@foo/bar@1.0.0
pi install git:github.com/user/repo@v1
pi install https://github.com/user/repo  # raw URLs work too
pi install /absolute/path/to/package
pi install ./relative/path/to/package

pi remove npm:@foo/bar
pi list                     # show installed packages from settings
pi update                   # update pi only
pi update --all             # update pi, update packages, and reconcile pinned git refs
pi update --extensions      # update packages and reconcile pinned git refs only
pi update --models          # refresh model catalogs only
pi update --self            # update pi only
pi update --self --force    # reinstall pi even if current
pi update npm:@foo/bar      # update one package
pi update --extension npm:@foo/bar
```

这些命令管理 pi 包，`pi update` 可以更新 pi CLI 安装本身。卸载 pi 本身请参阅[快速入门](quickstart.md#uninstall)。

默认情况下，`install` 和 `remove` 写入用户设置（`~/.pi/agent/settings.json`）。使用 `-l` 改为写入项目设置（`.pi/settings.json`）。项目设置可以与你的团队共享，pi 会在项目被信任后的启动时自动安装任何缺失的包。

想在不安装的情况下试用包，请使用 `--extension` 或 `-e`。它只将包安装到临时目录，仅用于本次运行：

```bash
pi -e npm:@foo/bar
pi -e git:github.com/user/repo
```

## 包来源

Pi 在设置和 `pi install` 中接受三种来源类型。

### npm

```
npm:@scope/pkg@1.2.3
npm:pkg
```

- 带版本号的规格会被固定，包更新（`pi update --extensions`、`pi update --all`）会跳过它们。
- 用户安装位于 `~/.pi/agent/npm/` 下。
- 项目安装位于 `.pi/npm/` 下。
- 在 `settings.json` 中设置 `npmCommand`，可将 npm 包查找和安装操作固定到特定的包装命令，如 `mise` 或 `asdf`。

示例：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

### git

```
git:github.com/user/repo@v1
git:git@github.com:user/repo@v1
https://github.com/user/repo@v1
ssh://git@github.com/user/repo@v1
```

- 不带 `git:` 前缀时，只接受协议 URL（`https://`、`http://`、`ssh://`、`git://`）。
- 带 `git:` 前缀时，接受简写格式，包括 `github.com/user/repo` 和 `git@github.com:user/repo`。
- HTTPS 和 SSH URL 都支持。
- SSH URL 会自动使用你配置的 SSH key（遵循 `~/.ssh/config`）。
- 对于非交互式运行（例如 CI），可以设置 `GIT_TERMINAL_PROMPT=0` 禁用凭据提示，并设置 `GIT_SSH_COMMAND`（例如 `ssh -o BatchMode=yes -o ConnectTimeout=5`）以快速失败。
- 引用是固定的 tag 或 commit。`pi update --extensions` 和 `pi update --all` 不会将它们移动到更新的引用，但会将现有克隆同步到所配置的引用。
- 使用 `pi install git:host/user/repo@new-ref` 更新设置并将现有包移动到新的固定引用。
- 克隆到 `~/.pi/agent/git/<host>/<path>`（全局）或 `.pi/git/<host>/<path>`（项目）。
- 当同步改变了检出内容时，pi 会重置并清理克隆，然后在存在 `package.json` 时运行 `npm install`。

**SSH 示例：**
```bash
# git@host:path shorthand (requires git: prefix)
pi install git:git@github.com:user/repo

# ssh:// protocol format
pi install ssh://git@github.com/user/repo

# With version ref
pi install git:git@github.com:user/repo@v1.0.0
```

### 本地路径

```
/absolute/path/to/package
./relative/path/to/package
```

本地路径指向磁盘上的文件或目录，并直接添加到设置中而不进行复制。相对路径相对于其所在的设置文件解析。如果路径是文件，则作为单个扩展加载。如果是目录，pi 按包规则加载资源。

## 创建 Pi 包

在 `package.json` 中添加 `pi` 清单，或使用约定目录。加入 `pi-package` 关键字以便被发现。

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

路径相对于包根目录。数组支持 glob 模式和 `!exclusions`。

### 图库元数据

[包图库](https://pi.dev/packages) 展示带 `pi-package` 标签的包。添加 `video` 或 `image` 字段以显示预览：

```json
{
  "name": "my-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/screenshot.png"
  }
}
```

- **video**：仅限 MP4。桌面端悬停时自动播放。点击打开全屏播放器。
- **image**：PNG、JPEG、GIF 或 WebP。显示为静态预览。

如果两者都设置，video 优先。

## 包结构

### 约定目录

如果没有 `pi` 清单，pi 会从这些目录自动发现资源：

- `extensions/` 加载 `.ts` 和 `.js` 文件
- `skills/` 递归查找 `SKILL.md` 文件夹，并将顶层的 `.md` 文件作为技能加载
- `prompts/` 加载 `.md` 文件
- `themes/` 加载 `.json` 文件

## 依赖

第三方运行时依赖应放在 `package.json` 的 `dependencies` 中。不注册扩展、技能、提示模板或主题的依赖也应放在 `dependencies` 中。当 pi 从 npm 或 git 安装包时，它会运行 `npm install`，因此这些依赖会自动安装。

Pi 为扩展和技能捆绑了核心包。如果你导入其中任何一个，请将其列在 `peerDependencies` 中并使用 `"*"` 范围，不要捆绑它们：`@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`、`typebox`。

其他 pi 包必须捆绑在你的 tarball 中。将它们添加到 `dependencies` 和 `bundledDependencies`，然后通过 `node_modules/` 路径引用它们的资源。Pi 以独立的模块根加载包，因此不同的安装不会冲突，也不会共享模块。

示例：

```json
{
  "dependencies": {
    "shitty-extensions": "^1.0.1"
  },
  "bundledDependencies": ["shitty-extensions"],
  "pi": {
    "extensions": ["extensions", "node_modules/shitty-extensions/extensions"],
    "skills": ["skills", "node_modules/shitty-extensions/skills"]
  }
}
```

## 包过滤

在设置中使用对象形式过滤包加载的内容：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

`+path` 和 `-path` 是相对于包根目录的精确路径。

- 省略某个 key 表示加载该类型的全部内容。
- 使用 `[]` 表示不加载该类型的任何内容。
- `!pattern` 排除匹配项。
- `+path` 强制包含精确路径。
- `-path` 强制排除精确路径。
- 过滤器叠加在清单之上。它们进一步收窄已经允许的范围。

## 启用与禁用资源

使用 `pi config` 启用或禁用已安装包和本地目录中的扩展、技能、提示模板和主题。`pi config` 从全局设置（`~/.pi/agent/settings.json`）开始；按 Tab 在全局和项目级模式之间切换。使用 `pi config -l` 从项目覆盖（`.pi/settings.json`）开始，继承的全局资源显示为暗淡。

## 作用域与去重

包可以同时出现在全局和项目设置中。如果同一个包同时出现在两处，项目条目优先，除非项目条目带有 `autoload: false`，此时它作为对全局条目的增量（delta）应用。身份由以下内容确定：

- npm：包名
- git：不带引用的仓库 URL
- 本地：解析后的绝对路径
