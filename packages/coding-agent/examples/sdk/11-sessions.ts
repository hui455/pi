/**
 * Session Management
 * 会话管理
 *
 * Control session persistence: in-memory, new file, continue, or open specific.
 * 控制会话持久化：内存中、新建文件、继续或打开指定会话。
 */

import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// In-memory (no persistence)
// 内存模式（无持久化）
const { session: inMemory } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
});
console.log("In-memory session:", inMemory.sessionFile ?? "(none)");
inMemory.dispose();

// New persistent session
// 新建持久化会话
const { session: newSession } = await createAgentSession({
	sessionManager: SessionManager.create(process.cwd()),
});
console.log("New session file:", newSession.sessionFile);
newSession.dispose();

// Continue most recent session (or create new if none)
// 继续最近的会话（如果没有则新建）
const { session: continued, modelFallbackMessage } = await createAgentSession({
	sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) console.log("Note:", modelFallbackMessage);
console.log("Continued session:", continued.sessionFile);
continued.dispose();

// List and open specific session
// 列出并打开指定会话
const sessions = await SessionManager.list(process.cwd());
console.log(`\nFound ${sessions.length} sessions:`);
for (const info of sessions.slice(0, 3)) {
	console.log(`  ${info.id.slice(0, 8)}... - "${info.firstMessage.slice(0, 30)}..."`);
}

if (sessions.length > 0) {
	const { session: opened } = await createAgentSession({
		sessionManager: SessionManager.open(sessions[0].path),
	});
	console.log(`\nOpened: ${opened.sessionId}`);
	opened.dispose();
}

// Custom session directory (no cwd encoding)
// 自定义会话目录（不对 cwd 编码）
// const customDir = "/path/to/my-sessions";
// const { session } = await createAgentSession({
//   sessionManager: SessionManager.create(process.cwd(), customDir),
// });
// SessionManager.list(process.cwd(), customDir);
// SessionManager.continueRecent(process.cwd(), customDir);
