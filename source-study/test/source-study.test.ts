import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { AgentHarness, InMemorySessionStorage, Session } from "@earendil-works/pi-agent-core";
import { createModels, fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, Type } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import {
	createAgentSession,
	createSyntheticSourceInfo,
	ModelRuntime,
	SessionManager,
} from "../../packages/coding-agent/src/index.ts";
import { createHarness } from "../../packages/coding-agent/test/test-harness.ts";
import { MyHarness } from "../my-harness.ts";

const activeCleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of activeCleanups.splice(0)) cleanup();
});

function textTool(name: string, run: (args: Record<string, unknown>) => string): AgentTool {
	return {
		name,
		label: name,
		description: `Learning tool ${name}`,
		parameters: Type.Object({ value: Type.String() }),
		execute: async (_toolCallId, args) => ({
			content: [{ type: "text", text: run(args as Record<string, unknown>) }],
			details: {},
		}),
	};
}

async function createFauxSdkSession(options: { persistent?: boolean; response: string }) {
	const cwd = mkdtempSync(join(tmpdir(), "pi-source-study-sdk-"));
	const runtime = await ModelRuntime.create({ modelsPath: null, allowModelNetwork: false, refreshOnCreate: false });
	const faux = fauxProvider();
	faux.setResponses([fauxAssistantMessage(options.response)]);
	runtime.registerNativeProvider(faux.provider);
	const sessionManager = options.persistent ? SessionManager.create(cwd, cwd) : SessionManager.inMemory(cwd);
	const created = await createAgentSession({
		cwd,
		agentDir: cwd,
		modelRuntime: runtime,
		model: faux.getModel(),
		noTools: "all",
		sessionManager,
	});
	return { ...created, cwd, faux, runtime };
}

describe("Pi source-study labs", () => {
	it("runs through the public createAgentSession SDK entry", async () => {
		const created = await createFauxSdkSession({ response: "sdk ok" });
		try {
			await created.session.prompt("hello through sdk");
			expect(created.faux.state.callCount).toBe(1);
			expect(created.session.state.messages.at(-1)?.role).toBe("assistant");
		} finally {
			created.session.dispose();
			rmSync(created.cwd, { recursive: true });
		}
	});

	it("traces a text response through AgentSession events", async () => {
		const harness = await createHarness({ responses: ["hello from faux"] });
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("hello");

		expect(harness.faux.callCount).toBe(1);
		expect(harness.eventsOfType("agent_start")).toHaveLength(1);
		expect(harness.eventsOfType("message_end").some((event) => event.message.role === "assistant")).toBe(true);
		expect(harness.eventsOfType("agent_end")).toHaveLength(1);
	});

	it("executes a tool, writes ToolResult, and makes a second model call", async () => {
		const echo = textTool("echo", (args) => String(args.value));
		const harness = await createHarness({
			responses: [{ toolCalls: [{ name: "echo", args: { value: "from tool" } }] }, "final answer"],
			baseToolsOverride: { echo },
		});
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("use echo");

		expect(harness.faux.callCount).toBe(2);
		expect(harness.eventsOfType("tool_execution_start")).toHaveLength(1);
		expect(harness.eventsOfType("tool_execution_end")).toHaveLength(1);
		expect(harness.faux.contexts[1].messages.at(-1)?.role).toBe("toolResult");
		expect(harness.eventsOfType("agent_end")).toHaveLength(1);
	});

	it("keeps parallel tool results in assistant call order", async () => {
		const order: string[] = [];
		const first = textTool("first_tool", () => {
			order.push("first");
			return "one";
		});
		const second = textTool("second_tool", () => {
			order.push("second");
			return "two";
		});
		const harness = await createHarness({
			responses: [
				{
					toolCalls: [
						{ id: "call-1", name: "first_tool", args: { value: "1" } },
						{ id: "call-2", name: "second_tool", args: { value: "2" } },
					],
				},
				"done",
			],
			baseToolsOverride: { first_tool: first, second_tool: second },
		});
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("run both");

		expect(order, JSON.stringify(harness.eventsOfType("tool_execution_end"), null, 2)).toEqual(["first", "second"]);
		const toolResults = harness.faux.contexts[1].messages.filter((message) => message.role === "toolResult");
		expect(toolResults.map((message) => message.toolCallId)).toEqual(["call-1", "call-2"]);
	});

	it.each([
		{
			name: "missing tool",
			toolName: "missing",
			args: { value: "x" },
			baseToolsOverride: {},
		},
		{
			name: "invalid arguments",
			toolName: "echo",
			args: {},
			baseToolsOverride: { echo: textTool("echo", () => "unused") },
		},
	])("turns $name into an error ToolResult", async ({ toolName, args, baseToolsOverride }) => {
		const harness = await createHarness({
			responses: [{ toolCalls: [{ name: toolName, args }] }, "recovered"],
			baseToolsOverride: baseToolsOverride as Record<string, AgentTool>,
		});
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("run invalid tool");

		expect(harness.eventsOfType("tool_execution_end")[0]?.isError).toBe(true);
		expect(harness.faux.callCount).toBe(2);
		expect(harness.faux.contexts[1].messages.at(-1)?.role).toBe("toolResult");
	});

	it("converts an execute throw into an error ToolResult", async () => {
		const throwing: AgentTool = {
			name: "throwing",
			label: "throwing",
			description: "throws for the lab",
			parameters: Type.Object({ value: Type.String() }),
			execute: async () => {
				throw new Error("intentional lab failure");
			},
		};
		const harness = await createHarness({
			responses: [{ toolCalls: [{ name: "throwing", args: { value: "x" } }] }, "recovered"],
			baseToolsOverride: { throwing },
		});
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("throw");

		expect(harness.eventsOfType("tool_execution_end")[0]?.isError).toBe(true);
		expect(harness.faux.callCount).toBe(2);
	});

	it("stops when the whole tool batch terminates", async () => {
		const terminating: AgentTool = {
			name: "finish",
			label: "finish",
			description: "terminates the run",
			parameters: Type.Object({ value: Type.String() }),
			execute: async () => ({ content: [{ type: "text", text: "finished" }], details: {}, terminate: true }),
		};
		const harness = await createHarness({
			responses: [{ toolCalls: [{ name: "finish", args: { value: "x" } }] }],
			baseToolsOverride: { finish: terminating },
		});
		activeCleanups.push(harness.cleanup);

		await harness.session.prompt("finish now");

		expect(harness.faux.callCount).toBe(1);
		expect(harness.eventsOfType("agent_end")).toHaveLength(1);
	});

	it("records provider error and abort without external credentials", async () => {
		const errorHarness = await createHarness({ responses: [{ error: "faux failure" }] });
		activeCleanups.push(errorHarness.cleanup);
		await errorHarness.session.prompt("fail");
		expect(errorHarness.eventsOfType("agent_end")).toHaveLength(1);
		expect(errorHarness.events.some((event) => event.type === "message_end")).toBe(true);

		const abortHarness = await createHarness({ responses: [{ text: "late", delayMs: 100 }] });
		activeCleanups.push(abortHarness.cleanup);
		const prompt = abortHarness.session.prompt("abort me");
		await new Promise((resolve) => setTimeout(resolve, 10));
		await abortHarness.session.abort();
		await prompt;
		expect(abortHarness.eventsOfType("agent_end")).toHaveLength(1);
	});

	it("MyHarness adds policy, event logging, skill filtering, and isolation", async () => {
		const created: Array<Awaited<ReturnType<typeof createHarness>>> = [];
		const receivedSystemPrompts: Array<string | undefined> = [];
		const app = new MyHarness(
			async (_name, config) => {
				receivedSystemPrompts.push(config.systemPrompt);
				const value = await createHarness({ responses: ["ok"] });
				created.push(value);
				return value.session;
			},
			{ blockedTools: ["danger"], allowedSkills: ["allowed"], systemPrompt: "Study Pi carefully." },
		);
		const main = await app.createMainSession();
		const sidecar = await app.createNamedSession("sidecar");

		await app.prompt("main", "hello");
		expect(main.events.some((event) => event.type === "agent_end")).toBe(true);
		expect(sidecar.session.state.messages).toHaveLength(0);
		expect(receivedSystemPrompts).toEqual(["Study Pi carefully.", "Study Pi carefully."]);
		expect(
			app.filterSkills([
				{
					name: "allowed",
					description: "",
					filePath: "allowed",
					baseDir: ".",
					sourceInfo: createSyntheticSourceInfo("allowed", { source: "sdk" }),
					disableModelInvocation: false,
				},
				{
					name: "hidden",
					description: "",
					filePath: "hidden",
					baseDir: ".",
					sourceInfo: createSyntheticSourceInfo("hidden", { source: "sdk" }),
					disableModelInvocation: false,
				},
			]),
		).toHaveLength(1);

		for (const value of created) value.cleanup();
		app.dispose();
	});

	it("blocks a configured tool before execute", async () => {
		let executed = false;
		const dangerous = textTool("danger", () => {
			executed = true;
			return "should not run";
		});
		const created: Array<Awaited<ReturnType<typeof createHarness>>> = [];
		const app = new MyHarness(
			async () => {
				const value = await createHarness({
					responses: [{ toolCalls: [{ name: "danger", args: { value: "rm -rf" } }] }, "blocked acknowledged"],
					baseToolsOverride: { danger: dangerous },
				});
				created.push(value);
				return value.session;
			},
			{ blockedTools: ["danger"] },
		);
		await app.createMainSession();

		await app.prompt("main", "run danger");

		expect(executed).toBe(false);
		expect(created[0].eventsOfType("tool_execution_end")[0]?.isError).toBe(true);
		for (const value of created) value.cleanup();
		app.dispose();
	});

	it("restores persisted SDK messages into a reopened session", async () => {
		const first = await createFauxSdkSession({ persistent: true, response: "persisted" });
		const sessionFile = first.session.sessionFile;
		expect(sessionFile).toBeDefined();
		await first.session.prompt("remember me");
		first.session.dispose();

		const reopened = await createAgentSession({
			cwd: first.cwd,
			agentDir: first.cwd,
			modelRuntime: first.runtime,
			model: first.faux.getModel(),
			noTools: "all",
			sessionManager: SessionManager.open(sessionFile!),
		});
		try {
			expect(reopened.session.state.messages.some((message) => message.role === "user")).toBe(true);
			expect(reopened.session.state.messages.some((message) => message.role === "assistant")).toBe(true);
		} finally {
			reopened.session.dispose();
			rmSync(first.cwd, { recursive: true });
		}
	});

	it("creates and closes the generic AgentHarness with an in-memory session", async () => {
		const faux = fauxProvider();
		const models = createModels();
		models.setProvider(faux.provider);
		const { harness, suspended } = await AgentHarness.create({
			session: new Session(new InMemorySessionStorage({ id: "source-study", createdAt: 1 })),
			models,
			model: faux.getModel(),
		});
		expect(suspended).toEqual([]);
		expect(harness.name).toBe("main");
		await harness.close();
	});

	it("documents faux response blocks used by the labs", () => {
		const response = fauxAssistantMessage([fauxText("text"), fauxToolCall("echo", { value: "x" })], {
			stopReason: "toolUse",
		});
		expect(response.content.map((block) => block.type)).toEqual(["text", "toolCall"]);
	});
});
