/**
 * Preset Extension
 * 预设扩展
 *
 * Allows defining named presets that configure model, thinking level, tools,
 * and system prompt instructions. Presets are defined in JSON config files
 * and can be activated via CLI flag, /preset command, or Ctrl+Shift+U to cycle.
 * 允许定义命名预设，用于配置模型、思考级别、工具和系统提示词指令。预设定义在 JSON 配置文件中，
 * 可通过 CLI 参数、/preset 命令或 Ctrl+Shift+U 循环切换来激活。
 *
 * Config files (merged, project takes precedence):
 * 配置文件（合并加载，项目级优先）：
 * - ~/.pi/agent/presets.json (global)
 *   （全局）
 * - <cwd>/.pi/presets.json (project-local)
 *   （项目本地）
 *
 * Example presets.json:
 * presets.json 示例：
 * ```json
 * {
 *   "plan": {
 *     "provider": "openai-codex",
 *     "model": "gpt-5.2-codex",
 *     "thinkingLevel": "high",
 *     "tools": ["read", "grep", "find", "ls"],
 *     "instructions": "You are in PLANNING MODE. Your job is to deeply understand the problem and create a detailed implementation plan.\n\nRules:\n- DO NOT make any changes. You cannot edit or write files.\n- Read files IN FULL (no offset/limit) to get complete context. Partial reads miss critical details.\n- Explore thoroughly: grep for related code, find similar patterns, understand the architecture.\n- Ask clarifying questions if requirements are ambiguous. Do not assume.\n- Identify risks, edge cases, and dependencies before proposing solutions.\n\nOutput:\n- Create a structured plan with numbered steps.\n- For each step: what to change, why, and potential risks.\n- List files that will be modified.\n- Note any tests that should be added or updated.\n\nWhen done, ask the user if they want you to:\n1. Write the plan to a markdown file (e.g., PLAN.md)\n2. Create a GitHub issue with the plan\n3. Proceed to implementation (they should switch to 'implement' preset)"
 *   },
 *   "implement": {
 *     "provider": "anthropic",
 *     "model": "claude-sonnet-4-5",
 *     "thinkingLevel": "high",
 *     "tools": ["read", "bash", "edit", "write"],
 *     "instructions": "You are in IMPLEMENTATION MODE. Your job is to make focused, correct changes.\n\nRules:\n- Keep scope tight. Do exactly what was asked, no more.\n- Read files before editing to understand current state.\n- Make surgical edits. Prefer edit over write for existing files.\n- Explain your reasoning briefly before each change.\n- Run tests or type checks after changes if the project has them (npm test, npm run check, etc.).\n- If you encounter unexpected complexity, STOP and explain the issue rather than hacking around it.\n\nIf no plan exists:\n- Ask clarifying questions before starting.\n- Propose what you'll do and get confirmation for non-trivial changes.\n\nAfter completing changes:\n- Summarize what was done.\n- Note any follow-up work or tests that should be added."
 *   }
 * }
 * ```
 *
 * Usage:
 * 用法：
 * - `pi --preset plan` - start with plan preset
 *   以 plan 预设启动
 * - `/preset` - show selector to switch presets mid-session
 *   显示选择器，在会话中途切换预设
 * - `/preset implement` - switch to implement preset directly
 *   直接切换到 implement 预设
 * - `Ctrl+Shift+U` - cycle through presets
 *   循环切换预设
 *
 * CLI flags always override preset values.
 * CLI 参数始终覆盖预设值。
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Container, Key, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

// Preset configuration
// 预设配置
interface Preset {
	/** Provider name (e.g., "anthropic", "openai") */
	/** 提供方名称（例如 "anthropic"、"openai"） */
	provider?: string;
	/** Model ID (e.g., "claude-sonnet-4-5") */
	/** 模型 ID（例如 "claude-sonnet-4-5"） */
	model?: string;
	/** Thinking level */
	/** 思考级别 */
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	/** Tools to enable (replaces default set) */
	/** 要启用的工具（替换默认集合） */
	tools?: string[];
	/** Instructions to append to system prompt */
	/** 要追加到系统提示词的指令 */
	instructions?: string;
}

interface PresetsConfig {
	[name: string]: Preset;
}

/**
 * Load presets from config files.
 * 从配置文件加载预设。
 * Project-local presets override global presets with the same name.
 * 同名时，项目本地预设覆盖全局预设。
 */
function loadPresets(cwd: string): PresetsConfig {
	const globalPath = join(getAgentDir(), "presets.json");
	const projectPath = join(cwd, CONFIG_DIR_NAME, "presets.json");

	let globalPresets: PresetsConfig = {};
	let projectPresets: PresetsConfig = {};

	// Load global presets
	// 加载全局预设
	if (existsSync(globalPath)) {
		try {
			const content = readFileSync(globalPath, "utf-8");
			globalPresets = JSON.parse(content);
		} catch (err) {
			console.error(`Failed to load global presets from ${globalPath}: ${err}`);
		}
	}

	// Load project presets
	// 加载项目预设
	if (existsSync(projectPath)) {
		try {
			const content = readFileSync(projectPath, "utf-8");
			projectPresets = JSON.parse(content);
		} catch (err) {
			console.error(`Failed to load project presets from ${projectPath}: ${err}`);
		}
	}

	// Merge (project overrides global)
	// 合并（项目级覆盖全局）
	return { ...globalPresets, ...projectPresets };
}

interface OriginalState {
	model: Model<Api> | undefined;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	tools: string[];
}

export default function presetExtension(pi: ExtensionAPI) {
	let presets: PresetsConfig = {};
	let activePresetName: string | undefined;
	let activePreset: Preset | undefined;
	let originalState: OriginalState | undefined;

	// Register --preset CLI flag
	// 注册 --preset CLI 参数
	pi.registerFlag("preset", {
		description: "Preset configuration to use",
		type: "string",
	});

	/**
	 * Apply a preset configuration.
	 * 应用预设配置。
	 */
	async function applyPreset(name: string, preset: Preset, ctx: ExtensionContext): Promise<boolean> {
		// Snapshot state before the first preset is applied (i.e. only when transitioning from no-preset)
		// 在应用第一个预设之前快照当前状态（即仅在从无预设状态切换时）
		if (activePresetName === undefined) {
			originalState = {
				model: ctx.model,
				thinkingLevel: pi.getThinkingLevel(),
				tools: pi.getActiveTools(),
			};
		}

		// Apply model if specified
		// 若指定了模型则应用
		if (preset.provider && preset.model) {
			const model = ctx.modelRegistry.find(preset.provider, preset.model);
			if (model) {
				const success = await pi.setModel(model);
				if (!success) {
					ctx.ui.notify(`Preset "${name}": No API key for ${preset.provider}/${preset.model}`, "warning");
				}
			} else {
				ctx.ui.notify(`Preset "${name}": Model ${preset.provider}/${preset.model} not found`, "warning");
			}
		}

		// Apply thinking level if specified
		// 若指定了思考级别则应用
		if (preset.thinkingLevel) {
			pi.setThinkingLevel(preset.thinkingLevel);
		}

		// Apply tools if specified
		// 若指定了工具则应用
		if (preset.tools && preset.tools.length > 0) {
			const allToolNames = pi.getAllTools().map((t) => t.name);
			const validTools = preset.tools.filter((t) => allToolNames.includes(t));
			const invalidTools = preset.tools.filter((t) => !allToolNames.includes(t));

			if (invalidTools.length > 0) {
				ctx.ui.notify(`Preset "${name}": Unknown tools: ${invalidTools.join(", ")}`, "warning");
			}

			if (validTools.length > 0) {
				pi.setActiveTools(validTools);
			}
		}

		// Store active preset for system prompt injection
		// 记录当前激活的预设，用于注入系统提示词
		activePresetName = name;
		activePreset = preset;

		return true;
	}

	/**
	 * Build description string for a preset.
	 * 为预设构建描述字符串。
	 */
	function buildPresetDescription(preset: Preset): string {
		const parts: string[] = [];

		if (preset.provider && preset.model) {
			parts.push(`${preset.provider}/${preset.model}`);
		}
		if (preset.thinkingLevel) {
			parts.push(`thinking:${preset.thinkingLevel}`);
		}
		if (preset.tools) {
			parts.push(`tools:${preset.tools.join(",")}`);
		}
		if (preset.instructions) {
			const truncated =
				preset.instructions.length > 30 ? `${preset.instructions.slice(0, 27)}...` : preset.instructions;
			parts.push(`"${truncated}"`);
		}

		return parts.join(" | ");
	}

	/**
	 * Show preset selector UI using custom SelectList component.
	 * 使用自定义 SelectList 组件显示预设选择器界面。
	 */
	async function showPresetSelector(ctx: ExtensionContext): Promise<void> {
		const presetNames = Object.keys(presets);

		if (presetNames.length === 0) {
			ctx.ui.notify(
				`No presets defined. Add presets to ${join(getAgentDir(), "presets.json")} or ${join(ctx.cwd, CONFIG_DIR_NAME, "presets.json")}`,
				"warning",
			);
			return;
		}

		// Build select items with descriptions
		// 构建带描述的选项条目
		const items: SelectItem[] = presetNames.map((name) => {
			const preset = presets[name];
			const isActive = name === activePresetName;
			return {
				value: name,
				label: isActive ? `${name} (active)` : name,
				description: buildPresetDescription(preset),
			};
		});

		// Add "None" option to clear preset
		// 添加 "(none)" 选项以清除预设
		items.push({
			value: "(none)",
			label: "(none)",
			description: "Clear active preset, restore defaults",
		});

		const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			// Header
			// 标题
			container.addChild(new Text(theme.fg("accent", theme.bold("Select Preset"))));

			// SelectList with themed styling
			// 带主题样式的 SelectList
			const selectList = new SelectList(items, Math.min(items.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);

			// Footer hint
			// 底部提示
			container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));

			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (!result) return;

		if (result === "(none)") {
			// Clear preset and restore original state
			// 清除预设并恢复原始状态
			activePresetName = undefined;
			activePreset = undefined;
			if (originalState) {
				if (originalState.model) {
					await pi.setModel(originalState.model);
				}
				pi.setThinkingLevel(originalState.thinkingLevel);
				pi.setActiveTools(originalState.tools);
			} else {
				pi.setActiveTools(["read", "bash", "edit", "write"]);
			}
			ctx.ui.notify("Preset cleared, defaults restored", "info");
			updateStatus(ctx);
			return;
		}

		const preset = presets[result];
		if (preset) {
			await applyPreset(result, preset, ctx);
			ctx.ui.notify(`Preset "${result}" activated`, "info");
			updateStatus(ctx);
		}
	}

	/**
	 * Update status indicator.
	 * 更新状态指示器。
	 */
	function updateStatus(ctx: ExtensionContext) {
		if (activePresetName) {
			ctx.ui.setStatus("preset", ctx.ui.theme.fg("accent", `preset:${activePresetName}`));
		} else {
			ctx.ui.setStatus("preset", undefined);
		}
	}

	function getPresetOrder(): string[] {
		return Object.keys(presets).sort();
	}

	async function cyclePreset(ctx: ExtensionContext): Promise<void> {
		const presetNames = getPresetOrder();
		if (presetNames.length === 0) {
			ctx.ui.notify(
				`No presets defined. Add presets to ${join(getAgentDir(), "presets.json")} or ${join(ctx.cwd, CONFIG_DIR_NAME, "presets.json")}`,
				"warning",
			);
			return;
		}

		const cycleList = ["(none)", ...presetNames];
		const currentName = activePresetName ?? "(none)";
		const currentIndex = cycleList.indexOf(currentName);
		const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cycleList.length;
		const nextName = cycleList[nextIndex];

		if (nextName === "(none)") {
			activePresetName = undefined;
			activePreset = undefined;
			if (originalState) {
				if (originalState.model) {
					await pi.setModel(originalState.model);
				}
				pi.setThinkingLevel(originalState.thinkingLevel);
				pi.setActiveTools(originalState.tools);
			} else {
				pi.setActiveTools(["read", "bash", "edit", "write"]);
			}
			ctx.ui.notify("Preset cleared, defaults restored", "info");
			updateStatus(ctx);
			return;
		}

		const preset = presets[nextName];
		if (!preset) return;

		await applyPreset(nextName, preset, ctx);
		ctx.ui.notify(`Preset "${nextName}" activated`, "info");
		updateStatus(ctx);
	}

	pi.registerShortcut(Key.ctrlShift("u"), {
		description: "Cycle presets",
		handler: async (ctx) => {
			await cyclePreset(ctx);
		},
	});

	// Register /preset command
	// 注册 /preset 命令
	pi.registerCommand("preset", {
		description: "Switch preset configuration",
		handler: async (args, ctx) => {
			// If preset name provided, apply directly
			// 若提供了预设名称，则直接应用
			if (args?.trim()) {
				const name = args.trim();
				const preset = presets[name];

				if (!preset) {
					const available = Object.keys(presets).join(", ") || "(none defined)";
					ctx.ui.notify(`Unknown preset "${name}". Available: ${available}`, "error");
					return;
				}

				await applyPreset(name, preset, ctx);
				ctx.ui.notify(`Preset "${name}" activated`, "info");
				updateStatus(ctx);
				return;
			}

			// Otherwise show selector
			// 否则显示选择器
			await showPresetSelector(ctx);
		},
	});

	// Inject preset instructions into system prompt
	// 将预设指令注入系统提示词
	pi.on("before_agent_start", async (event) => {
		if (activePreset?.instructions) {
			return {
				systemPrompt: `${event.systemPrompt}\n\n${activePreset.instructions}`,
			};
		}
	});

	// Initialize on session start
	// 会话启动时初始化
	pi.on("session_start", async (_event, ctx) => {
		// Load presets from config files
		// 从配置文件加载预设
		presets = loadPresets(ctx.cwd);

		// Check for --preset flag
		// 检查 --preset 参数
		const presetFlag = pi.getFlag("preset");
		if (typeof presetFlag === "string" && presetFlag) {
			const preset = presets[presetFlag];
			if (preset) {
				await applyPreset(presetFlag, preset, ctx);
				ctx.ui.notify(`Preset "${presetFlag}" activated`, "info");
			} else {
				const available = Object.keys(presets).join(", ") || "(none defined)";
				ctx.ui.notify(`Unknown preset "${presetFlag}". Available: ${available}`, "warning");
			}
		}

		// Restore preset from session state
		// 从会话状态恢复预设
		const entries = ctx.sessionManager.getEntries();
		const presetEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "preset-state")
			.pop() as { data?: { name: string } } | undefined;

		if (presetEntry?.data?.name && !presetFlag) {
			const preset = presets[presetEntry.data.name];
			if (preset) {
				activePresetName = presetEntry.data.name;
				activePreset = preset;
				// Don't re-apply model/tools on restore, just keep the name for instructions
				// 恢复时不重新应用模型/工具，仅保留名称用于指令
			}
		}

		updateStatus(ctx);
	});

	// Persist preset state
	// 持久化预设状态
	pi.on("turn_start", async () => {
		if (activePresetName) {
			pi.appendEntry("preset-state", { name: activePresetName });
		}
	});
}
