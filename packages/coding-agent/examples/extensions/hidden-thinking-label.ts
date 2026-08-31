/**
 * Hidden Thinking Label Extension
 * 隐藏思考标签扩展
 *
 * Demonstrates `ctx.ui.setHiddenThinkingLabel()` for customizing the label shown
 * when thinking blocks are hidden.
 * 演示 `ctx.ui.setHiddenThinkingLabel()` 的用法：自定义思考块被隐藏时显示的标签。
 *
 * Usage:
 * 用法：
 *   pi --extension examples/extensions/hidden-thinking-label.ts
 *
 * Test:
 * 测试：
 *   1. Load this extension
 *   1. 加载此扩展
 *   2. Hide thinking blocks with Ctrl+T
 *   2. 用 Ctrl+T 隐藏思考块
 *   3. Ask for something that produces reasoning output
 *   3. 询问一些会产生推理输出的问题
 *   4. The collapsed thinking block label will show the custom text
 *   4. 折叠的思考块标签将显示自定义文本
 *
 * Commands:
 * 命令：
 *   /thinking-label <text>   Set a custom hidden thinking label
 *   /thinking-label <text>   设置自定义的隐藏思考标签
 *   /thinking-label          Reset to the default label
 *   /thinking-label          重置为默认标签
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const DEFAULT_LABEL = "Pondering...";

export default function (pi: ExtensionAPI) {
	let label = DEFAULT_LABEL;

	const applyLabel = (ctx: ExtensionContext) => {
		ctx.ui.setHiddenThinkingLabel(label);
	};

	pi.on("session_start", async (_event, ctx) => {
		applyLabel(ctx);
	});

	pi.registerCommand("thinking-label", {
		description: "Set the hidden thinking label. Use without args to reset.",
		handler: async (args, ctx) => {
			const nextLabel = args.trim();

			if (!nextLabel) {
				label = DEFAULT_LABEL;
				ctx.ui.setHiddenThinkingLabel();
				ctx.ui.notify(`Hidden thinking label reset to: ${DEFAULT_LABEL}`);
				return;
			}

			label = nextLabel;
			ctx.ui.setHiddenThinkingLabel(label);
			ctx.ui.notify(`Hidden thinking label set to: ${label}`);
		},
	});
}
