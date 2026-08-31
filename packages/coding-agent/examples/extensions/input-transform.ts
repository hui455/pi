/**
 * Input Transform Example - demonstrates the `input` event for intercepting user input.
 * 输入变换示例 —— 演示用 `input` 事件拦截用户输入。
 *
 * Start pi with this extension:
 * 使用此扩展启动 pi：
 *   pi -e ./examples/extensions/input-transform.ts
 *
 * Then type these inside pi:
 * 然后在 pi 中输入以下内容：
 *   ?quick What is TypeScript?  → "Respond briefly: What is TypeScript?"
 *   ?quick What is TypeScript?  → 变成 "Respond briefly: What is TypeScript?"
 *   ping                        → "pong" (instant, no LLM)
 *   ping                        → "pong"（即时响应，不经过 LLM）
 *   time                        → current time (instant, no LLM)
 *   time                        → 当前时间（即时响应，不经过 LLM）
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		// Source-based logic: skip processing for extension-injected messages
		// 基于来源的逻辑：跳过由扩展注入的消息，不进行处理
		if (event.source === "extension") {
			return { action: "continue" };
		}

		// Transform: ?quick prefix for brief responses
		// 变换：用 ?quick 前缀请求简要回答
		if (event.text.startsWith("?quick ")) {
			const query = event.text.slice(7).trim();
			if (!query) {
				ctx.ui.notify("Usage: ?quick <question>", "warning");
				return { action: "handled" };
			}
			return { action: "transform", text: `Respond briefly in 1-2 sentences: ${query}` };
		}

		// Handle: instant responses without LLM (extension shows its own feedback)
		// 处理：不经 LLM 的即时响应（扩展自行显示反馈）
		if (event.text.toLowerCase() === "ping") {
			ctx.ui.notify("pong", "info");
			return { action: "handled" };
		}
		if (event.text.toLowerCase() === "time") {
			ctx.ui.notify(new Date().toLocaleString(), "info");
			return { action: "handled" };
		}

		return { action: "continue" };
	});
}
