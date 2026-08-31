/**
 * Custom Compaction Extension
 * 自定义压缩扩展
 *
 * Replaces the default compaction behavior with a full summary of the entire context.
 * 用对整个上下文的完整摘要替换默认的压缩行为。
 * Instead of keeping the last 20k tokens of conversation turns, this extension:
 * 这个扩展不会保留最后 20k token 的对话轮次，而是：
 * 1. Summarizes ALL messages (messagesToSummarize + turnPrefixMessages)
 * 1. 汇总所有消息（messagesToSummarize + turnPrefixMessages）
 * 2. Discards all old turns completely, keeping only the summary
 * 2. 完全丢弃所有旧轮次，只保留摘要
 *
 * This example also demonstrates using a different model (Gemini Flash) for summarization,
 * which can be cheaper/faster than the main conversation model.
 * 此示例还演示了使用不同的模型（Gemini Flash）进行摘要，
 * 这可以比主对话模型更便宜/更快。
 *
 * Usage:
 * 用法：
 *   pi --extension examples/extensions/custom-compaction.ts
 */

import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		ctx.ui.notify("Custom compaction extension triggered", "info");

		const { preparation, branchEntries: _, signal } = event;
		const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

		// Use Gemini Flash for summarization (cheaper/faster than most conversation models)
		// 使用 Gemini Flash 进行摘要（比大多数对话模型更便宜/更快）
		const model = ctx.modelRegistry.find("google", "gemini-2.5-flash");
		if (!model) {
			ctx.ui.notify(`Could not find Gemini Flash model, using default compaction`, "warning");
			return;
		}

		// Combine all messages for full summary
		// 合并所有消息以进行完整摘要
		const allMessages = [...messagesToSummarize, ...turnPrefixMessages];

		ctx.ui.notify(
			`Custom compaction: summarizing ${allMessages.length} messages (${tokensBefore.toLocaleString()} tokens) with ${model.id}...`,
			"info",
		);

		// Convert messages to readable text format
		// 将消息转换为可读文本格式
		const conversationText = serializeConversation(convertToLlm(allMessages));

		// Include previous summary context if available
		// 如果有之前的摘要上下文，则包含它
		const previousContext = previousSummary ? `\n\nPrevious session summary for context:\n${previousSummary}` : "";

		// Build messages that ask for a comprehensive summary
		// 构建要求进行全面摘要的消息
		const summaryMessages = [
			{
				role: "user" as const,
				content: [
					{
						type: "text" as const,
						text: `You are a conversation summarizer. Create a comprehensive summary of this conversation that captures:${previousContext}

1. The main goals and objectives discussed
2. Key decisions made and their rationale
3. Important code changes, file modifications, or technical details
4. Current state of any ongoing work
5. Any blockers, issues, or open questions
6. Next steps that were planned or suggested

Be thorough but concise. The summary will replace the ENTIRE conversation history, so include all information needed to continue the work effectively.

Format the summary as structured markdown with clear sections.

<conversation>
${conversationText}
</conversation>`,
					},
				],
				timestamp: Date.now(),
			},
		];

		try {
			// Pass signal to honor abort requests (e.g., user cancels compaction)
			// 传递 signal 以响应中止请求（例如用户取消压缩）
			const response = await ctx.modelRegistry.complete(
				model,
				{ messages: summaryMessages },
				{
					maxTokens: 8192,
					signal,
					cacheRetention: "none",
					sessionId: uuidv7(),
				},
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				if (!signal.aborted) ctx.ui.notify("Compaction summary was empty, using default compaction", "warning");
				return;
			}

			// Return compaction content - SessionManager adds id/parentId
			// 返回压缩内容 —— SessionManager 会添加 id/parentId
			// Use firstKeptEntryId from preparation to keep recent messages
			// 使用 preparation 中的 firstKeptEntryId 保留最近的消息
			return {
				compaction: {
					summary,
					firstKeptEntryId,
					tokensBefore,
					usage: response.usage,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Compaction failed: ${message}`, "error");
			// Fall back to default compaction on error
			// 出错时回退到默认压缩
			return;
		}
	});
}
