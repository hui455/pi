/**
 * Streaming-Aware Input Gate
 * 感知流式输出的输入闸门
 *
 * Demonstrates `event.streamingBehavior` to skip expensive pre-processing
 * during mid-stream steering, where low latency matters.
 * 演示利用 `event.streamingBehavior` 在流式输出中途的转向（steering）阶段
 * 跳过昂贵的预处理，因为此时低延迟至关重要。
 *
 * This extension prepends `git diff --stat` output when the user mentions
 * file changes, giving the model immediate context. During steering the
 * exec call is skipped so the correction reaches the model without delay.
 * 当用户提到文件变更时，此扩展会在输入前附加 `git diff --stat` 的输出，
 * 让模型立即获得上下文。转向期间会跳过 exec 调用，
 * 使修正内容能无延迟地到达模型。
 *
 * Start pi with this extension:
 * 使用此扩展启动 pi：
 *   pi -e ./examples/extensions/input-transform-streaming.ts
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TRIGGER = /\b(changes?|diff|modified)\b/i;

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event) => {
		// During steering, skip the exec call — corrections should be fast
		// 转向期间跳过 exec 调用 —— 修正应当迅速送达
		if (event.streamingBehavior === "steer") {
			return { action: "continue" };
		}

		if (!TRIGGER.test(event.text)) {
			return { action: "continue" };
		}

		const { stdout, code } = await pi.exec("git", ["diff", "--stat"]);
		if (code !== 0 || !stdout.trim()) {
			return { action: "continue" };
		}

		return {
			action: "transform",
			text: `${event.text}\n\nCurrent uncommitted changes:\n\`\`\`\n${stdout.trim()}\n\`\`\``,
		};
	});
}
