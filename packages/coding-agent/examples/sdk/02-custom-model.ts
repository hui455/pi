/**
 * Custom Model Selection
 * 自定义模型选择
 *
 * Shows how to select a specific model and thinking level.
 * 演示如何选择特定模型和思考级别。
 */

import { createAgentSession, ModelRuntime } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();

// Option 1: Find a specific built-in model by provider/id
// 方式一：按 provider/id 查找特定的内置模型
const opus = modelRuntime.getModel("anthropic", "claude-opus-4-5");
if (opus) {
	console.log(`Found model: ${opus.provider}/${opus.id}`);
}

// Option 2: Find model via registry (includes custom models from models.json)
// 方式二：通过注册表查找模型（包含 models.json 中的自定义模型）
const customModel = modelRuntime.getModel("my-provider", "my-model");
if (customModel) {
	console.log(`Found custom model: ${customModel.provider}/${customModel.id}`);
}

// Option 3: Pick from available models (have valid API keys)
// 方式三：从可用模型中选择（拥有有效 API 密钥）
const available = await modelRuntime.getAvailable();
console.log(
	"Available models:",
	available.map((m) => `${m.provider}/${m.id}`),
);

if (available.length > 0) {
	const { session } = await createAgentSession({
		model: available[0],
		thinkingLevel: "medium", // off, low, medium, high（可选值：off、low、medium、high）
		modelRuntime,
	});

	try {
		session.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				process.stdout.write(event.assistantMessageEvent.delta);
			}
		});

		await session.prompt("Say hello in one sentence.");
		console.log();
	} finally {
		session.dispose();
	}
}
