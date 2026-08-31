/**
 * RPC Extension UI Demo
 * RPC 扩展 UI 演示
 *
 * Purpose-built extension that exercises all RPC-supported extension UI methods.
 * 专门构建的扩展，用于演练所有受 RPC 支持的扩展 UI 方法。
 * Designed to be loaded alongside the rpc-extension-ui-example.ts script to
 * demonstrate the full extension UI protocol.
 * 设计上与 rpc-extension-ui-example.ts 脚本一起加载，以演示完整的扩展 UI 协议。
 *
 * UI methods exercised:
 * 演练的 UI 方法：
 * - select() - on tool_call for dangerous bash commands
 *   在 tool_call 事件中用于危险的 bash 命令
 * - confirm() - on session_before_switch
 *   在 session_before_switch 事件中使用
 * - input() - via /rpc-input command
 *   通过 /rpc-input 命令触发
 * - editor() - via /rpc-editor command
 *   通过 /rpc-editor 命令触发
 * - notify() - after each dialog completes
 *   每个对话框完成后调用
 * - setStatus() - on turn_start/turn_end
 *   在 turn_start/turn_end 事件中使用
 * - setWidget() - on session_start
 *   在 session_start 事件中使用
 * - setTitle() - on session_start
 *   在 session_start 事件中使用
 * - setEditorText() - via /rpc-prefill command
 *   通过 /rpc-prefill 命令触发
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let turnCount = 0;

	// -- setTitle, setWidget, setStatus on session lifecycle --
	// -- 在会话生命周期中使用 setTitle、setWidget、setStatus --

	pi.on("session_start", async (event, ctx) => {
		ctx.ui.setTitle(event.reason === "new" ? "pi RPC Demo (new session)" : "pi RPC Demo");
		ctx.ui.setWidget("rpc-demo", ["--- RPC Extension UI Demo ---", "Loaded and ready."]);
		ctx.ui.setStatus("rpc-demo", `Turns: ${turnCount}`);
	});

	// -- setStatus on turn lifecycle --
	// -- 在回合生命周期中使用 setStatus --

	pi.on("turn_start", async (_event, ctx) => {
		turnCount++;
		ctx.ui.setStatus("rpc-demo", `Turn ${turnCount} running...`);
	});

	pi.on("turn_end", async (_event, ctx) => {
		ctx.ui.setStatus("rpc-demo", `Turn ${turnCount} done`);
	});

	// -- select on dangerous tool calls --
	// -- 对危险工具调用使用 select --

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const isDangerous = /\brm\s+(-rf?|--recursive)/i.test(command) || /\bsudo\b/i.test(command);

		if (isDangerous) {
			if (!ctx.hasUI) {
				return { block: true, reason: "Dangerous command blocked (no UI)" };
			}

			const choice = await ctx.ui.select(`Dangerous command: ${command}`, ["Allow", "Block"]);
			if (choice !== "Allow") {
				ctx.ui.notify("Command blocked by user", "warning");
				return { block: true, reason: "Blocked by user" };
			}
			ctx.ui.notify("Command allowed", "info");
		}

		return undefined;
	});

	// -- confirm on session clear --
	// -- 会话清空时使用 confirm --

	pi.on("session_before_switch", async (event, ctx) => {
		if (event.reason !== "new") return;
		if (!ctx.hasUI) return;

		const confirmed = await ctx.ui.confirm("Clear session?", "All messages will be lost.");
		if (!confirmed) {
			ctx.ui.notify("Clear cancelled", "info");
			return { cancel: true };
		}
	});

	// -- input via command --
	// -- 通过命令使用 input --

	pi.registerCommand("rpc-input", {
		description: "Prompt for text input (demonstrates ctx.ui.input in RPC)",
		handler: async (_args, ctx) => {
			const value = await ctx.ui.input("Enter a value", "type something...");
			if (value) {
				ctx.ui.notify(`You entered: ${value}`, "info");
			} else {
				ctx.ui.notify("Input cancelled", "info");
			}
		},
	});

	// -- editor via command --
	// -- 通过命令使用 editor --

	pi.registerCommand("rpc-editor", {
		description: "Open multi-line editor (demonstrates ctx.ui.editor in RPC)",
		handler: async (_args, ctx) => {
			const text = await ctx.ui.editor("Edit some text", "Line 1\nLine 2\nLine 3");
			if (text) {
				ctx.ui.notify(`Editor submitted (${text.split("\n").length} lines)`, "info");
			} else {
				ctx.ui.notify("Editor cancelled", "info");
			}
		},
	});

	// -- setEditorText via command --
	// -- 通过命令使用 setEditorText --

	pi.registerCommand("rpc-prefill", {
		description: "Prefill the input editor (demonstrates ctx.ui.setEditorText in RPC)",
		handler: async (_args, ctx) => {
			ctx.ui.setEditorText("This text was set by the rpc-demo extension.");
			ctx.ui.notify("Editor prefilled", "info");
		},
	});
}
