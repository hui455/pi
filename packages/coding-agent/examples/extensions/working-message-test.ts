/**
 * Working Message Persistence Test
 * 工作消息持久化测试
 *
 * Sets a custom working message and indicator on session start so you can
 * 在会话启动时设置自定义工作消息与指示器，以便你验证它们在
 * verify they survive across loader recreations (e.g. between agent turns).
 * 加载器重建后仍然保留（例如 agent 各回合之间）。
 *
 * Usage:
 * 用法：
 *   pi --extension examples/extensions/working-message-test.ts
 *
 * Then send a few messages in interactive mode. The working message should
 * 然后在交互模式下发送几条消息。每次加载器出现时，工作消息都应
 * stay "Working... (custom)" with a brown dot indicator every time the
 * 保持为带棕色圆点指示器的 "Working... (custom)"，
 * loader appears, not revert to the default gray "Working...".
 * 而不是回退到默认的灰色 "Working..."。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CUSTOM_MESSAGE = "\x1b[38;2;155;86;63mWorking... (custom)\x1b[39m";
const CUSTOM_INDICATOR = { frames: ["\x1b[38;2;155;86;63m●\x1b[39m"] };

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setWorkingMessage(CUSTOM_MESSAGE);
		ctx.ui.setWorkingIndicator(CUSTOM_INDICATOR);
	});
}
