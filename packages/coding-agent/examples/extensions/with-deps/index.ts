/**
 * Example extension with its own npm dependencies.
 * 带有自身 npm 依赖的示例扩展。
 * Tests that jiti resolves modules from the extension's own node_modules.
 * 测试 jiti 能否从扩展自身的 node_modules 解析模块。
 *
 * Requires: npm install in this directory
 * 需要：在本目录运行 npm install
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import ms from "ms";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Register a tool that uses ms
	// 注册一个使用 ms 的工具
	pi.registerTool({
		name: "parse_duration",
		label: "Parse Duration",
		description: "Parse a human-readable duration string (e.g., '2 days', '1h', '5m') to milliseconds",
		parameters: Type.Object({
			duration: Type.String({ description: "Duration string like '2 days', '1h', '5m'" }),
		}),
		execute: async (_toolCallId, params) => {
			const result = ms(params.duration as ms.StringValue);
			if (result === undefined) {
				throw new Error(`Invalid duration: "${params.duration}"`);
			}
			return {
				content: [{ type: "text", text: `${params.duration} = ${result} milliseconds` }],
				details: {},
			};
		},
	});
}
