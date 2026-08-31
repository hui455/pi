/**
 * File Trigger Extension
 * 文件触发器扩展
 *
 * Watches a trigger file and injects its contents into the conversation.
 * 监视触发文件并将其内容注入对话。
 * Useful for external systems to send messages to the agent.
 * 便于外部系统向代理发送消息。
 *
 * Usage:
 * 用法：
 *   echo "Run the tests" > /tmp/agent-trigger.txt
 */

import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const triggerFile = "/tmp/agent-trigger.txt";

		fs.watch(triggerFile, () => {
			try {
				const content = fs.readFileSync(triggerFile, "utf-8").trim();
				if (content) {
					pi.sendMessage(
						{
							customType: "file-trigger",
							content: `External trigger: ${content}`,
							display: true,
						},
						{ triggerTurn: true }, // triggerTurn - get LLM to respond（triggerTurn —— 让 LLM 作出回应）
					);
					fs.writeFileSync(triggerFile, ""); // Clear after reading（读取后清空）
				}
			} catch {
				// File might not exist yet
				// 文件可能尚不存在
			}
		});

		if (ctx.hasUI) {
			ctx.ui.notify(`Watching ${triggerFile}`, "info");
		}
	});
}
