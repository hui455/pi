/**
 * Shutdown Command Extension
 * 关机命令扩展
 *
 * Adds a /quit command that allows extensions to trigger clean shutdown.
 * 添加 /quit 命令，让扩展能够触发干净的退出。
 * Demonstrates how extensions can use ctx.shutdown() to exit pi cleanly.
 * 演示扩展如何使用 ctx.shutdown() 干净地退出 pi。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Register a /quit command that cleanly exits pi
	// 注册 /quit 命令，用于干净地退出 pi
	pi.registerCommand("quit", {
		description: "Exit pi cleanly",
		handler: async (_args, ctx) => {
			ctx.shutdown();
		},
	});

	// You can also create a tool that shuts down after completing work
	// 也可以创建一个在完成工作后退出的工具
	pi.registerTool({
		name: "finish_and_exit",
		label: "Finish and Exit",
		description: "Complete a task and exit pi",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			// Do any final work here...
			// 可在此处执行任何收尾工作……
			// Request graceful shutdown (deferred until agent is idle)
			// 请求优雅退出（延迟到智能体空闲时执行）
			ctx.shutdown();

			// This return is sent to the LLM before shutdown occurs
			// 该返回值会在退出发生之前发送给 LLM
			return {
				content: [{ type: "text", text: "Shutdown requested. Exiting after this response." }],
				details: {},
			};
		},
	});

	// You could also create a more complex tool with parameters
	// 也可以创建带参数的更复杂工具
	pi.registerTool({
		name: "deploy_and_exit",
		label: "Deploy and Exit",
		description: "Deploy the application and exit pi",
		parameters: Type.Object({
			environment: Type.String({ description: "Target environment (e.g., production, staging)" }),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			onUpdate?.({ content: [{ type: "text", text: `Deploying to ${params.environment}...` }], details: {} });

			// Example deployment logic
			// 部署逻辑示例
			// const result = await pi.exec("npm", ["run", "deploy", params.environment], { signal });

			// On success, request graceful shutdown
			// 成功后请求优雅退出
			onUpdate?.({ content: [{ type: "text", text: "Deployment complete, exiting..." }], details: {} });
			ctx.shutdown();

			return {
				content: [{ type: "text", text: "Done! Shutdown requested." }],
				details: { environment: params.environment },
			};
		},
	});
}
