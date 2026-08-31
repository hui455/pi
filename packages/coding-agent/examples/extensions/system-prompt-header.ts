/**
 * Displays a status widget showing the system prompt length.
 * 显示一个状态组件，展示系统提示词的长度。
 *
 * Demonstrates ctx.getSystemPrompt() for accessing the effective system prompt.
 * 演示使用 ctx.getSystemPrompt() 获取生效中的系统提示词。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("agent_start", (_event, ctx) => {
		const prompt = ctx.getSystemPrompt();
		ctx.ui.setStatus("system-prompt", `System: ${prompt.length} chars`);
	});

	pi.on("session_shutdown", (_event, ctx) => {
		ctx.ui.setStatus("system-prompt", undefined);
	});
}
