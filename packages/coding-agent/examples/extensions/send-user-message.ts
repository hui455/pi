/**
 * Send User Message Example
 * 发送用户消息示例
 *
 * Demonstrates pi.sendUserMessage() for sending user messages from extensions.
 * 演示如何在扩展中用 pi.sendUserMessage() 发送用户消息。
 * Unlike pi.sendMessage() which sends custom messages, sendUserMessage() sends
 * actual user messages that appear in the conversation as if typed by the user.
 * 与发送自定义消息的 pi.sendMessage() 不同，sendUserMessage() 发送的是真正的
 * 用户消息，它们会出现在对话中，就像用户亲自输入的一样。
 *
 * Usage:
 * 用法：
 *   /ask What is 2+2?     - Sends a user message (always triggers a turn)
 *                            发送用户消息（总是触发一个回合）
 *   /steer Focus on X     - Sends while streaming with steer delivery
 *                            在流式输出期间发送，采用 steer 投递方式
 *   /followup And then?   - Sends while streaming with followUp delivery
 *                            在流式输出期间发送，采用 followUp 投递方式
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Simple command that sends a user message
	// 发送用户消息的简单命令
	pi.registerCommand("ask", {
		description: "Send a user message to the agent",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /ask <message>", "warning");
				return;
			}

			// sendUserMessage always triggers a turn when not streaming
			// 非流式输出时，sendUserMessage 总是触发一个回合
			// If streaming, it will throw (no deliverAs specified)
			// 若正在流式输出，则会抛出异常（未指定 deliverAs）
			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy. Use /steer or /followup instead.", "warning");
				return;
			}

			pi.sendUserMessage(args);
		},
	});

	// Command that steers the agent mid-conversation
	// 在对话中途引导智能体的命令
	pi.registerCommand("steer", {
		description: "Send a steering message (interrupts current processing)",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /steer <message>", "warning");
				return;
			}

			if (ctx.isIdle()) {
				// Not streaming, just send normally
				pi.sendUserMessage(args);
			} else {
				// Streaming - use steer to interrupt
				// 正在流式输出——使用 steer 进行打断
				pi.sendUserMessage(args, { deliverAs: "steer" });
			}
		},
	});

	// Command that queues a follow-up message
	// 排队一条后续消息的命令
	pi.registerCommand("followup", {
		description: "Queue a follow-up message (waits for current processing)",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /followup <message>", "warning");
				return;
			}

			if (ctx.isIdle()) {
				// Not streaming, just send normally
				// 未在流式输出，直接正常发送
				pi.sendUserMessage(args);
			} else {
				// Streaming - queue as follow-up
				// 正在流式输出——以 follow-up 形式排队
				pi.sendUserMessage(args, { deliverAs: "followUp" });
				ctx.ui.notify("Follow-up queued", "info");
			}
		},
	});

	// Example with content array (text + images would go here)
	// 内容数组示例（文本 + 图片可放在这里）
	pi.registerCommand("askwith", {
		description: "Send a user message with structured content",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /askwith <message>", "warning");
				return;
			}

			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy", "warning");
				return;
			}

			// sendUserMessage accepts string or (TextContent | ImageContent)[]
			// sendUserMessage 接受字符串或 (TextContent | ImageContent)[]
			pi.sendUserMessage([
				{ type: "text", text: `User request: ${args}` },
				{ type: "text", text: "Please respond concisely." },
			]);
		},
	});
}
