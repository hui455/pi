import type { BeforeToolCallContext, BeforeToolCallResult } from "@earendil-works/pi-agent-core";
import type { AgentSession, AgentSessionEvent, Skill } from "../packages/coding-agent/src/index.ts";

export interface MyHarnessSession {
	readonly name: string;
	readonly session: AgentSession;
	readonly events: AgentSessionEvent[];
	readonly unsubscribe: () => void;
}

export interface MyHarnessOptions {
	/** Tool names that must be blocked before execution. */
	readonly blockedTools?: readonly string[];
	/** Skill names allowed through the product policy. Empty means none. */
	readonly allowedSkills?: readonly string[];
	/** Product-level system prompt passed to the injected session factory. */
	readonly systemPrompt?: string;
}

export interface MyHarnessSessionConfig {
	readonly systemPrompt?: string;
}

/**
 * Small product-level wrapper used by the source-reading labs.
 * It demonstrates policy and observability without changing Pi core code.
 */
export class MyHarness {
	private readonly sessions = new Map<string, MyHarnessSession>();
	private readonly blockedTools: ReadonlySet<string>;
	private readonly allowedSkills: ReadonlySet<string> | undefined;
	private readonly systemPrompt: string | undefined;
	private readonly createSession: (name: string, config: MyHarnessSessionConfig) => Promise<AgentSession>;

	constructor(
		createSession: (name: string, config: MyHarnessSessionConfig) => Promise<AgentSession>,
		options: MyHarnessOptions = {},
	) {
		this.createSession = createSession;
		this.blockedTools = new Set(options.blockedTools ?? []);
		this.allowedSkills = options.allowedSkills ? new Set(options.allowedSkills) : undefined;
		this.systemPrompt = options.systemPrompt;
	}

	async createMainSession(): Promise<MyHarnessSession> {
		return this.createNamedSession("main");
	}

	async createNamedSession(name: string): Promise<MyHarnessSession> {
		if (this.sessions.has(name)) throw new Error(`Session already exists: ${name}`);
		const session = await this.createSession(name, { systemPrompt: this.systemPrompt });
		const events: AgentSessionEvent[] = [];
		const unsubscribe = session.subscribe((event) => {
			events.push(event);
		});
		const previousBeforeToolCall = session.agent.beforeToolCall;
		session.agent.beforeToolCall = async (
			context: BeforeToolCallContext,
			signal?: AbortSignal,
		): Promise<BeforeToolCallResult | undefined> => {
			if (this.blockedTools.has(context.toolCall.name)) {
				return { block: true, reason: `Blocked by MyHarness policy: ${context.toolCall.name}` };
			}
			return previousBeforeToolCall?.(context, signal);
		};
		const value = { name, session, events, unsubscribe };
		this.sessions.set(name, value);
		return value;
	}

	async prompt(name: string, text: string): Promise<void> {
		const value = this.sessions.get(name);
		if (!value) throw new Error(`Unknown session: ${name}`);
		await value.session.prompt(text);
	}

	filterSkills(skills: readonly Skill[]): Skill[] {
		if (!this.allowedSkills) return [...skills];
		return skills.filter((skill) => this.allowedSkills?.has(skill.name));
	}

	getSession(name: string): MyHarnessSession | undefined {
		return this.sessions.get(name);
	}

	dispose(): void {
		for (const value of this.sessions.values()) {
			value.unsubscribe();
			value.session.dispose();
		}
		this.sessions.clear();
	}
}
