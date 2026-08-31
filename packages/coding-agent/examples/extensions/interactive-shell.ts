/**
 * Interactive Shell Commands Extension
 * 交互式 Shell 命令扩展
 *
 * Enables running interactive commands (vim, git rebase -i, htop, etc.)
 * with full terminal access. The TUI suspends while they run.
 * 允许以完整的终端访问权限运行交互式命令（vim、git rebase -i、htop 等）。
 * 命令运行期间 TUI 会挂起。
 *
 * Usage:
 * 用法：
 *   pi -e examples/extensions/interactive-shell.ts
 *
 *   !vim file.txt        # Auto-detected as interactive
 *   !vim file.txt        # 自动检测为交互式
 *   !i any-command       # Force interactive mode with !i prefix
 *   !i any-command       # 用 !i 前缀强制交互模式
 *   !git rebase -i HEAD~3
 *   !htop
 *
 * Configuration via environment variables:
 * 通过环境变量配置：
 *   INTERACTIVE_COMMANDS - Additional commands (comma-separated)
 *   INTERACTIVE_COMMANDS - 额外的命令（逗号分隔）
 *   INTERACTIVE_EXCLUDE  - Commands to exclude (comma-separated)
 *   INTERACTIVE_EXCLUDE  - 要排除的命令（逗号分隔）
 *
 * Note: This only intercepts user `!` commands, not agent bash tool calls.
 * If the agent runs an interactive command, it will fail (which is fine).
 * 注意：这只拦截用户的 `!` 命令，不拦截智能体的 bash 工具调用。
 * 如果智能体运行交互式命令，它会失败（这没关系）。
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Default interactive commands - editors, pagers, git ops, TUIs
// 默认的交互式命令 —— 编辑器、分页器、git 操作、TUI
const DEFAULT_INTERACTIVE_COMMANDS = [
	// Editors
	// 编辑器
	"vim",
	"nvim",
	"vi",
	"nano",
	"emacs",
	"pico",
	"micro",
	"helix",
	"hx",
	"kak",
	// Pagers
	// 分页器
	"less",
	"more",
	"most",
	// Git interactive
	// Git 交互式操作
	"git commit",
	"git rebase",
	"git merge",
	"git cherry-pick",
	"git revert",
	"git add -p",
	"git add --patch",
	"git add -i",
	"git add --interactive",
	"git stash -p",
	"git stash --patch",
	"git reset -p",
	"git reset --patch",
	"git checkout -p",
	"git checkout --patch",
	"git difftool",
	"git mergetool",
	// System monitors
	// 系统监控
	"htop",
	"top",
	"btop",
	"glances",
	// File managers
	// 文件管理器
	"ranger",
	"nnn",
	"lf",
	"mc",
	"vifm",
	// Git TUIs
	// Git TUI
	"tig",
	"lazygit",
	"gitui",
	// Fuzzy finders
	// 模糊查找器
	"fzf",
	"sk",
	// Remote sessions
	// 远程会话
	"ssh",
	"telnet",
	"mosh",
	// Database clients
	// 数据库客户端
	"psql",
	"mysql",
	"sqlite3",
	"mongosh",
	"redis-cli",
	// Kubernetes/Docker
	// Kubernetes/Docker 命令
	"kubectl edit",
	"kubectl exec -it",
	"docker exec -it",
	"docker run -it",
	// Other
	// 其他
	"tmux",
	"screen",
	"ncdu",
];

function getInteractiveCommands(): string[] {
	const additional =
		process.env.INTERACTIVE_COMMANDS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean) ?? [];
	const excluded = new Set(process.env.INTERACTIVE_EXCLUDE?.split(",").map((s) => s.trim().toLowerCase()) ?? []);
	return [...DEFAULT_INTERACTIVE_COMMANDS, ...additional].filter((cmd) => !excluded.has(cmd.toLowerCase()));
}

function isInteractiveCommand(command: string): boolean {
	const trimmed = command.trim().toLowerCase();
	const commands = getInteractiveCommands();

	for (const cmd of commands) {
		const cmdLower = cmd.toLowerCase();
		// Match at start
		// 匹配开头
		if (trimmed === cmdLower || trimmed.startsWith(`${cmdLower} `) || trimmed.startsWith(`${cmdLower}\t`)) {
			return true;
		}
		// Match after pipe: "cat file | less"
		// 匹配管道之后的部分："cat file | less"
		const pipeIdx = trimmed.lastIndexOf("|");
		if (pipeIdx !== -1) {
			const afterPipe = trimmed.slice(pipeIdx + 1).trim();
			if (afterPipe === cmdLower || afterPipe.startsWith(`${cmdLower} `)) {
				return true;
			}
		}
	}
	return false;
}

export default function (pi: ExtensionAPI) {
	pi.on("user_bash", async (event, ctx) => {
		let command = event.command;
		let forceInteractive = false;

		// Check for !i prefix (command comes without the leading !)
		// 检查 !i 前缀（命令传入时已去掉开头的 !）
		// The prefix parsing happens before this event, so we check if command starts with "i "
		// 前缀解析发生在此事件之前，所以我们检查命令是否以 "i " 开头
		if (command.startsWith("i ") || command.startsWith("i\t")) {
			forceInteractive = true;
			command = command.slice(2).trim();
		}

		const shouldBeInteractive = forceInteractive || isInteractiveCommand(command);
		if (!shouldBeInteractive) {
			return; // Let normal handling proceed（让正常的处理流程继续）
		}

		// No UI available (print mode, RPC, etc.)
		// 没有可用的 UI（print 模式、RPC 等）
		if (ctx.mode !== "tui") {
			return {
				result: { output: "(interactive commands require TUI)", exitCode: 1, cancelled: false, truncated: false },
			};
		}

		// Use ctx.ui.custom() to get TUI access, then run the command
		// 用 ctx.ui.custom() 获取 TUI 访问权限，然后运行命令
		const exitCode = await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
			// Stop TUI to release terminal
			// 停止 TUI 以释放终端
			tui.stop();

			// Clear screen
			// 清屏
			process.stdout.write("\x1b[2J\x1b[H");

			// Run command with full terminal access
			// 以完整终端访问权限运行命令
			const shell = process.env.SHELL || "/bin/sh";
			const result = spawnSync(shell, ["-c", command], {
				stdio: "inherit",
				env: process.env,
			});

			// Restart TUI
			// 重启 TUI
			tui.start();
			tui.requestRender(true);

			// Signal completion
			// 发出完成信号
			done(result.status);

			// Return empty component (immediately disposed since done() was called)
			// 返回空组件（由于已调用 done()，会立即被销毁）
			return { render: () => [], invalidate: () => {} };
		});

		// Return result to prevent default bash handling
		// 返回结果以阻止默认的 bash 处理
		const output =
			exitCode === 0
				? "(interactive command completed successfully)"
				: `(interactive command exited with code ${exitCode})`;

		return {
			result: {
				output,
				exitCode: exitCode ?? 1,
				cancelled: false,
				truncated: false,
			},
		};
	});
}
