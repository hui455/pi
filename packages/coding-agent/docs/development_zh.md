# 开发

附加指南参见 [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md)。

## 设置

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

从源码运行：

```bash
/path/to/pi-mono/pi-test.sh
```

该脚本可以从任何目录运行。Pi 保留调用者的当前工作目录。

## 分叉 / 重塑品牌

通过 `package.json` 配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

为你的分叉更改 `name`、`configDir` 和 `bin` 字段。会影响 CLI banner、配置路径和环境变量名。

## 路径解析

三种执行模式：npm 安装、独立二进制、从源码运行 tsx。

**始终使用 `src/config.ts`** 访问包资源：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

绝不要直接对包资源使用 `__dirname`。

## 调试命令

`/debug`（隐藏）写入 `~/.pi/agent/pi-debug.log`：
- 带 ANSI 码的已渲染 TUI 行
- 发送给 LLM 的最后几条消息

## 测试

```bash
./test.sh                         # 运行非 LLM 测试（无需 API 密钥）
npm test                          # 运行所有测试
npm test -- test/specific.test.ts # 运行特定测试
```

## 项目结构

```
packages/
  ai/           # LLM 提供商抽象
  agent/        # 智能体循环和消息类型
  tui/          # 终端 UI 组件
  coding-agent/ # CLI 和交互模式
```
