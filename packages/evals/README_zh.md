# Pi evals

Pi evals 是针对 Pi 工作流的、基于行为的、由模型背书的检查。它们将真实的 `AgentSession` 适配到 `vitest-evals`，在隔离的临时项目和代理目录中运行，并附加原生 Pi 会话产物。
用它们来衡量端到端行为，并比较提示词、工具、skills、模型或其他 harness 配置。

## 运行 evals

在仓库根目录使用默认提供商和模型运行：

```bash
npm run eval -- --provider openai --model gpt-5.6-sol
```

等效的环境变量是：

```bash
PI_PROVIDER=openai PI_MODEL=gpt-5.6-sol npm run eval
```

CLI 值优先，并成为未显式选择模型的 harness 的默认值。提供商和模型必须同时提供。当每个执行的 harness 都配置了自己的模型时，runner 也允许不设默认值。
认证来自 Pi 常规的 `ModelRuntime`，包括 Pi 订阅凭据和提供商 API key 环境变量。

额外的参数会转发给 Vitest：

```bash
npm run eval -- src/extensions.eval.ts
npm run eval -- -t "creates, reloads, and uses"
```

每次调用都会输出一个应忽略的 `.eval/` 产物目录。`runs.jsonl` 索引已完成的 harness 运行及其位于 `sessions/` 下的原生 Pi 会话 JSONL 附件。这些文件可能包含提示词、响应、源代码和工具输出。

## 编写 evals

通用套件、评判器（judge）、断言和归一化 trace 指南请遵循 [`vitest-evals`](https://github.com/getsentry/vitest-evals)。Pi 特定的 evals 使用 `src/pi-harness.ts` 中的 `createPiCodingAgentHarness(...)`，每个 `describeEval(...)` 套件绑定一个 harness：

```ts
import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createPiCodingAgentHarness } from "./pi-harness.ts";

const harness = createPiCodingAgentHarness({ noTools: "all" });

describeEval("Pi smoke", { harness }, (it) => {
	it("answers a factual question", async ({ run }) => {
		const result = await run("What is the capital of France? Reply with only the city name.");
		expect(result.output).toBe("Paris");
	});
});
```

### 配置 Pi harness

`createPiCodingAgentHarness(...)` 接受：

- `name`：稳定的 harness 标识，用于报告和对比。
- `model`：可选的 `{ provider, id }` 选择。它会覆盖 runner 的默认模型。
- `noTools`：Pi 的禁用工具配置。
- `transformSystemPrompt`：在 eval 开始前转换完整的默认提示词。
- `output`：将最终响应和 `AgentSession` 转换为 JSON 安全的领域结果。

显式选择的模型使模型对比 harness 独立于 runner 默认值：

```ts
const harness = createPiCodingAgentHarness({
	name: "claude-opus-4-6",
	model: { provider: "anthropic", id: "claude-opus-4-6" },
});
```

一次运行接受一个提示词，或一个提示词与 reload 步骤的序列。当前面的提示词创建或更改 Pi 资源时，reload 步骤很有用：

```ts
const result = await run([
	{ type: "prompt", content: "Create a Pi extension." },
	{ type: "reload" },
	{ type: "prompt", content: "Use the extension." },
]);
```

### 转换 harness 输出

使用 `output` 暴露场景特定的、JSON 安全的行为，而无需将该行为加入通用 Pi 适配器：

```ts
const harness = createPiCodingAgentHarness({
	output: ({ response, session }) => ({
		response,
		activeTools: session.getActiveToolNames(),
		extensionErrors: session.resourceLoader.getExtensions().errors,
	}),
});
```

在 `result.output` 上断言应用行为。在 `result.session` 上断言模型和工具 trace，使用 `vitest-evals` 提供的诸如 `toolCalls(...)` 之类的辅助函数。

### 编写对比 eval 集

使用 `evalHarnessTable(...)` 配合 Vitest 原生的 `describe.for(...)`，将相同的输入对多个 harness 运行。harness 可以按提示词、工具、skills、模型或任何其他 Pi 配置而不同：

```ts
import { describe } from "vitest";
import { createJudge, describeEval } from "vitest-evals";
import { evalHarnessTable } from "./vitest-evals/harness-table.ts";

const TargetTaskJudge = createJudge<string, string>("TargetTaskJudge", ({ output }) => ({
	score: output === "expected result" ? 1 : 0,
}));

const harnessTable = evalHarnessTable(
	"target skill effectiveness",
	{
		baseline: withoutTargetSkillHarness,
		candidate: withTargetSkillHarness,
		repetitions: 6,
	},
);

describe.for(harnessTable)("$name repetition $repetition", ({ harness }) => {
	describeEval("target skill effectiveness", { harness, judges: [TargetTaskJudge], judgeThreshold: null }, (it) => {
		it("completes the target task", async ({ run }) => {
			await run("Complete the target task.");
		});
	});
});
```

对比套件应使用确定性或模型背书的评判器记录正确性，并设置 `judgeThreshold: null`。这将低分作为观察结果保留，而不是让 Vitest 调用失败。硬断言只用于套件不变量和基础设施契约。`expect.soft(...)` 仍会使测试失败，它不是评分机制。

Pi harness 在删除其临时 workspace 之前会快照原生会话 JSONL。一个仅用于 eval 的 `afterEach` 钩子会在 reporters 运行之前将该快照注册到显式的 Vitest 测试任务上。

harness 名称在 eval 集内必须稳定且唯一。分组键在有可用的非空字符串 `input.id` 时结合重复次数使用它，否则使用严格规范化 JSON 输入的 SHA-256 哈希。单一处理组使用 `candidate`，多处理组使用 `candidates`。每个 candidate 只与声明的 baseline 比较。对于每个匹配的输入和重复次数，reporter 根据每次运行记录的平均 judge 分数计算通过率提升，分数至少为 `1` 视为通过。提升量是 candidate 通过率减去 baseline 通过率，单位为百分点。缺失的 judge 分数被报告为不完整观察。令牌数、延迟和估计成本保持为单独的 candidate 减 baseline 配对差值；缺失的遥测保持不可用。如果执行顺序随机化变得必要，请使用 Vitest 内置的序列打乱。

对比 eval 的方法论、重复策略、可信评判器和遥测解读指南参见 [`skill-eval-harness`](https://github.com/adewale/skill-eval-harness/)。
