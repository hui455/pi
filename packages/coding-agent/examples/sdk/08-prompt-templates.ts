/**
 * Prompt Templates
 * 提示词模板
 *
 * File-based templates that inject content when invoked with /templatename.
 * 基于文件的模板，使用 /templatename 调用时注入内容。
 */

import {
	createAgentSession,
	createSyntheticSourceInfo,
	DefaultResourceLoader,
	getAgentDir,
	type PromptTemplate,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

// Define custom templates
// 定义自定义模板
const deployTemplate: PromptTemplate = {
	name: "deploy",
	description: "Deploy the application",
	filePath: "/virtual/prompts/deploy.md",
	sourceInfo: createSyntheticSourceInfo("/virtual/prompts/deploy.md", { source: "sdk" }),
	content: `# Deploy Instructions

1. Build: npm run build
2. Test: npm test
3. Deploy: npm run deploy`,
};

const loader = new DefaultResourceLoader({
	cwd: process.cwd(),
	agentDir: getAgentDir(),
	promptsOverride: (current) => ({
		prompts: [...current.prompts, deployTemplate],
		diagnostics: current.diagnostics,
	}),
});
await loader.reload();

// Discover templates from cwd/.pi/prompts/ and ~/.pi/agent/prompts/
// 发现来自 cwd/.pi/prompts/ 和 ~/.pi/agent/prompts/ 的模板
const discovered = loader.getPrompts().prompts;
console.log("Discovered prompt templates:");
for (const template of discovered) {
	console.log(`  /${template.name}: ${template.description}`);
}

const { session } = await createAgentSession({
	resourceLoader: loader,
	sessionManager: SessionManager.inMemory(),
});
console.log(`Session created with ${discovered.length + 1} prompt templates`);
session.dispose();
