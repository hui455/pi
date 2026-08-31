/**
 * Reload Runtime Extension
 * 重载运行时扩展
 *
 * Demonstrates ctx.reload() from ExtensionCommandContext and an LLM-callable
 * tool that queues a follow-up command to trigger reload.
 * 演示在 ExtensionCommandContext 中使用 ctx.reload()，以及一个可被 LLM 调用的
 * 工具，该工具通过排队一条后续命令来触发重载。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Command entrypoint for reload.
	// 重载命令的入口点。
	// Treat reload as terminal for this handler.
	// 对当前处理器而言，重载即终点（不再返回）。
	pi.registerCommand("reload-runtime", {
		description: "Reload extensions, skills, prompts, themes, and context files",
		handler: async (_args, ctx) => {
			await ctx.reload();
			return;
		},
	});

	// LLM-callable tool. Tools get ExtensionContext, so they cannot call ctx.reload() directly.
	// 可被 LLM 调用的工具。工具拿到的是 ExtensionContext，因此不能直接调用 ctx.reload()。
	// Instead, queue a follow-up user command that executes the command above.
	// 改为排队一条后续用户命令，去执行上面注册的命令。
	pi.registerTool({
		name: "reload_runtime",
		label: "Reload Runtime",
		description: "Reload extensions, skills, prompts, themes, and context files",
		parameters: Type.Object({}),
		async execute() {
			pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
			return {
				content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
				details: {},
			};
		},
	});
}
