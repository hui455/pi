/**
 * Git Checkpoint Extension
 * Git 检查点扩展
 *
 * Creates git stash checkpoints at each turn so /fork can restore code state.
 * 在每个轮次创建 git stash 检查点，以便 /fork 可以恢复代码状态。
 * When forking, offers to restore code to that point in history.
 * 分叉（fork）时，提示是否将代码恢复到历史中的该点。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();
	let currentEntryId: string | undefined;

	// Track the current entry ID when user messages are saved
	// 当用户消息被保存时跟踪当前条目 ID
	pi.on("tool_result", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafEntry();
		if (leaf) currentEntryId = leaf.id;
	});

	pi.on("turn_start", async () => {
		// Create a git stash entry before LLM makes changes
		// 在 LLM 做出更改之前创建一个 git stash 条目
		const { stdout } = await pi.exec("git", ["stash", "create"]);
		const ref = stdout.trim();
		if (ref && currentEntryId) {
			checkpoints.set(currentEntryId, ref);
		}
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) {
			// In non-interactive mode, don't restore automatically
			// 在非交互模式下，不自动恢复
			return;
		}

		const choice = await ctx.ui.select("Restore code state?", [
			"Yes, restore code to that point",
			"No, keep current code",
		]);

		if (choice?.startsWith("Yes")) {
			await pi.exec("git", ["stash", "apply", ref]);
			ctx.ui.notify("Code restored to checkpoint", "info");
		}
	});

	pi.on("agent_end", async () => {
		// Clear checkpoints after agent completes
		// 代理完成后清除检查点
		checkpoints.clear();
	});
}
