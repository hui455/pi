/**
 * Tools Configuration
 * 工具配置
 *
 * Use tool names to choose which built-in tools are enabled.
 * 使用工具名称来选择启用哪些内置工具。
 *
 * Tool names are matched against all available tools. If you use a custom `cwd`,
 * 工具名称会与所有可用工具进行匹配。如果使用自定义 `cwd`，
 * createAgentSession() applies that cwd when it builds the actual built-in tools.
 * createAgentSession() 在构建实际内置工具时会应用该 cwd。
 *
 * For custom tools, see 06-extensions.ts - custom tools are registered via the
 * 自定义工具请参见 06-extensions.ts —— 自定义工具通过
 * extensions system using pi.registerTool().
 * 扩展系统使用 pi.registerTool() 注册。
 */

import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// Read-only mode (no edit/write)
// 只读模式（无编辑/写入工具）
const { session: readOnlySession } = await createAgentSession({
	tools: ["read", "grep", "find", "ls"],
	sessionManager: SessionManager.inMemory(),
});
console.log("Read-only session created");
readOnlySession.dispose();

// Custom tool selection
// 自定义工具选择
const { session: customToolsSession } = await createAgentSession({
	tools: ["read", "bash", "grep"],
	sessionManager: SessionManager.inMemory(),
});
console.log("Custom tools session created");
customToolsSession.dispose();

// With custom cwd
// 使用自定义 cwd
const customCwd = "/path/to/project";
const { session: customCwdSession } = await createAgentSession({
	cwd: customCwd,
	tools: ["read", "bash", "edit", "write"],
	sessionManager: SessionManager.inMemory(customCwd),
});
console.log("Custom cwd session created");
customCwdSession.dispose();

// Or pick specific tools for custom cwd
// 或者为自定义 cwd 挑选特定工具
const { session: specificToolsSession } = await createAgentSession({
	cwd: customCwd,
	tools: ["read", "bash", "grep"],
	sessionManager: SessionManager.inMemory(customCwd),
});
console.log("Specific tools with custom cwd session created");
specificToolsSession.dispose();
