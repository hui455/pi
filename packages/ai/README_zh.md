# @earendil-works/pi-ai

统一 LLM API：提供商集合、自动认证解析、token 与成本追踪，以及简单的上下文持久化和会话中途切换到其他模型（hand-off）。

**注意**：本库只包含支持工具调用（function calling）的模型，因为这对代理式（agentic）工作流至关重要。

## 目录

- [支持的提供商](#supported-providers)
- [安装](#installation)
- [快速开始](#quick-start)
- [提供商与模型](#providers-and-models)
  - [提供商工厂](#provider-factories)
  - [全部内置提供商](#all-built-in-providers)
  - [查询模型](#querying-models)
  - [静态目录读取](#static-catalog-reads)
  - [动态提供商](#dynamic-providers)
- [认证](#auth)
  - [认证如何解析](#how-auth-resolves)
  - [转换请求头](#transforming-request-headers)
  - [凭据存储](#credential-store)
  - [环境变量](#environment-variables)
- [工具](#tools)
  - [定义工具](#defining-tools)
  - [处理工具调用](#handling-tool-calls)
  - [流式工具调用与部分 JSON](#streaming-tool-calls-with-partial-json)
  - [验证工具参数](#validating-tool-arguments)
  - [完整事件参考](#complete-event-reference)
- [图像输入](#image-input)
- [图像生成](#image-generation)
- [思考/推理](#thinkingreasoning)
  - [统一接口](#unified-interface-streamsimplecompletesimple)
  - [提供商特定选项](#provider-specific-options-streamcomplete)
  - [流式思考内容](#streaming-thinking-content)
- [停止原因](#stop-reasons)
- [错误处理](#error-handling)
  - [中止请求](#aborting-requests)
  - [中止后继续](#continuing-after-abort)
  - [调试提供商负载](#debugging-provider-payloads)
- [自定义提供商](#custom-providers)
  - [createProvider()](#createprovider)
  - [直接调用 API 实现](#calling-api-implementations-directly)
  - [OpenAI 兼容性设置](#openai-compatibility-settings)
- [测试用 Faux 提供商](#faux-provider-for-tests)
- [跨提供商切换](#cross-provider-handoffs)
- [上下文序列化](#context-serialization)
- [浏览器使用](#browser-usage)
- [打包与 Tree Shaking](#bundling-and-tree-shaking)
- [OAuth 提供商](#oauth-providers)
  - [Vertex AI](#vertex-ai)
  - [CLI 登录](#cli-login)
  - [编程式 OAuth](#programmatic-oauth)
- [从旧全局 API 迁移](#migrating-from-the-old-global-api)
- [开发](#development)
- [许可证](#license)

## 支持的提供商

- **OpenAI**
- **Ant Ling**
- **Azure OpenAI (Responses)**
- **OpenAI Codex**（ChatGPT Plus/Pro 订阅，需要 OAuth，见下文）
- **DeepSeek**
- **NVIDIA NIM**
- **Anthropic**
- **Google**
- **Vertex AI**（通过 Vertex AI 使用 Gemini）
- **Mistral**
- **Groq**
- **Cerebras**
- **Cloudflare AI Gateway**
- **Cloudflare Workers AI**
- **xAI**
- **OpenRouter**
- **Vercel AI Gateway**
- **ZAI Coding Plan (Global)**（另有独立的中国提供商）
- **MiniMax**（另有独立的中国提供商）
- **Together AI**
- **Baseten**
- **Hugging Face**
- **Moonshot AI**（另有独立的中国提供商）
- **GitHub Copilot**（需要 OAuth，见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Fireworks**（使用 OpenAI 兼容和 Anthropic 兼容 API）
- **Kimi For Coding**（Moonshot AI 订阅端点，使用 Anthropic 兼容 API）
- **Qwen Token Plan**（独立于 Individual 与既有目录，另有独立的中国提供商）
- **Xiaomi MiMo**（默认使用 API 计费端点，另有面向 `cn`/`ams`/`sgp` 区域的独立 Token Plan 提供商）
- **任何 OpenAI 兼容 API**：Ollama、vLLM、LM Studio 等

## 安装

```bash
npm install @earendil-works/pi-ai
```

TypeBox 导出会从 `@earendil-works/pi-ai` 重新导出：`Type`、`Static` 和 `TSchema`。

## 快速开始

你构建一个包含提供商的 `Models` 集合，然后通过它进行流式调用。最快的入门方式是注册所有内置提供商；在意包体积的应用则只注册单个提供商（参见[提供商工厂](#provider-factories) 和[打包与 Tree Shaking](#bundling-and-tree-shaking)）。

```typescript
import { Type, type Context, type Tool } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

// A Models collection with every built-in provider registered
const models = builtinModels();

// Sync lookup against the collection
const model = models.getModel('openai', 'gpt-4o-mini')!;

// Define tools with TypeBox schemas for type safety and validation
const tools: Tool[] = [{
  name: 'get_time',
  description: 'Get the current time',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
  })
}];

// Build a conversation context (easily serializable and transferable between models)
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What time is it?', timestamp: Date.now() }],
  tools
};

// Option 1: Streaming with all event types.
// Auth resolves through the provider (OPENAI_API_KEY from the environment here).
const s = models.stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`Starting with ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[Text started]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[Text ended]');
      break;
    case 'thinking_start':
      console.log('[Model is thinking...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[Thinking complete]');
      break;
    case 'toolcall_start':
      console.log(`\n[Tool call started: index ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // Partial tool arguments are being streamed
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[Streaming args for ${partialCall.name}]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\nTool called: ${event.toolCall.name}`);
      console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\nFinished: ${event.reason}`);
      break;
    case 'error':
      console.error(`Error: ${event.error.errorMessage}`);
      break;
  }
}

// Get the final message after streaming, add it to the context
const finalMessage = await s.result();
context.messages.push(finalMessage);

// Handle tool calls if any
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : 'Unknown tool';

  // Add tool result to context (supports text and images)
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// Continue if there were tool calls
if (toolCalls.length > 0) {
  const continuation = await models.complete(model, context);
  context.messages.push(continuation);
  console.log('After tool execution:', continuation.content);
}

console.log(`Total tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);

// Option 2: Get complete response without streaming
const response = await models.complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

本 README 其余部分中的代码片段都假定有一个这样配置好的 `models` 集合（注册了相关提供商）。

## 提供商与模型

**提供商（provider）** 是运行时单元：它拥有自己的模型目录、认证（API 密钥解析、OAuth 流程）和流式行为。`Models` 集合持有提供商，并把每个请求路由到拥有该模型的提供商。

提供商内部共享 **API 实现**（线上协议）：Anthropic 模型使用 `anthropic-messages`，OpenAI 使用 `openai-responses`，而 xAI、Groq、Cerebras、OpenRouter 以及大多数其他提供商共享 `openai-completions`。混合 API 提供商（GitHub Copilot、OpenCode Zen）按模型分发。

### 提供商工厂

对于只需要特定提供商的应用，每个内置提供商都有一个工厂，各自是子路径导入，只拉取该提供商的目录：

```typescript
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';
// ...one module per provider in the Supported Providers list

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openrouterProvider());
```

提供商工厂会导入其模型目录和一个惰性 API 包装器，不会导入其他提供商。配合打包器的代码分割，SDK 实现（`@anthropic-ai/sdk`、`openai`、`@google/genai` 等）会留在惰性块中，在该 API 的模型首次请求时加载。

### 全部内置提供商

对于想要一切的应用（如快速开始）：

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels(); // a Models collection with every built-in provider registered
```

这会导入所有目录和每个内置提供商工厂。这是重量级、显式的入口点。`builtinModels()` 接受与 `createModels()` 相同的选项（`credentials`、`authContext`）；如果你想在自己的集合上注册，`builtinProviders()` 会返回提供商数组。

### 查询模型

读取是同步的，返回最近已知的列表：

```typescript
const providers = models.getProviders();           // registered Provider objects
const provider = models.getProvider('anthropic');  // one provider

const all = models.getModels();                    // every model across providers
const anthropicModels = models.getModels('anthropic');
const model = models.getModel('anthropic', 'claude-sonnet-4-5');

for (const m of anthropicModels) {
  console.log(`${m.id}: ${m.name}`);
  console.log(`  API: ${m.api}`);
  console.log(`  Context: ${m.contextWindow} tokens`);
  console.log(`  Vision: ${m.input.includes('image')}`);
  console.log(`  Reasoning: ${m.reasoning}`);
}
```

动态列出的模型类型为 `Model<Api>`。当你需要 API 特定的选项类型时，用 `hasApi()` 守卫收窄类型：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

const m = models.getModel('anthropic', 'claude-sonnet-4-5');
if (m && hasApi(m, 'anthropic-messages')) {
  // m: Model<'anthropic-messages'> — stream options fully typed
  models.stream(m, context, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
}
```

### 静态目录读取

对于想要带完整字面量类型的生成内置目录（提供商和模型 ID 自动补全）、且不依赖任何集合的工具：

```typescript
import { getBuiltinModel, getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all';

const model = getBuiltinModel('openai', 'gpt-4o-mini'); // typed Model<'openai-responses'>
const providers = getBuiltinProviders();
const anthropic = getBuiltinModels('anthropic');
```

### 动态提供商

提供商可能拥有动态模型列表（llama.cpp 服务器、实时 OpenRouter 列表）。读取保持同步；获取是显式的异步动词：

```typescript
// getModels() returns the last-known list (empty before the first refresh)
await models.refresh({ providers: ['llamacpp'] }); // refresh one provider
await models.refresh();                            // refresh all providers concurrently, best-effort
const fresh = models.getModel('llamacpp', 'qwen3-30b');
```

静态内置提供商对 `refresh()` 是 no-op。构建动态提供商参见 [createProvider()](#createprovider)。

## 认证

每个提供商都拥有自己的认证：API 密钥如何解析（存储的凭据、环境变量、AWS 配置文件或 gcloud ADC 等环境来源），以及在支持处提供 OAuth 登录/刷新流程。

### 认证如何解析

当你调用 `models.stream()` 时，集合通过所属提供商解析认证，并合并到请求中。显式的按请求值始终优先：

```typescript
// Resolved through the provider (env var, stored credential, OAuth token):
await models.complete(model, context);

// Explicit key wins over anything the provider would resolve:
await models.complete(model, context, { apiKey: 'sk-explicit' });
```

你可以不发请求就检查解析结果。传入提供商 ID 获取提供商级认证，或传入模型以包含其静态 `model.headers`：

```typescript
const providerAuth = await models.getAuth(model.provider);
const modelAuth = await models.getAuth(model);

if (modelAuth) {
  console.log(`configured via ${modelAuth.source}`); // e.g. "ANTHROPIC_API_KEY", "OAuth", "stored credential"
  console.log(modelAuth.auth.headers);              // Provider auth headers + model.headers
} else {
  console.log('not configured');
}
```

两个重载都会解析凭据、在必要时刷新过期的 OAuth，并可能返回从认证派生的 `apiKey`、`headers` 或 `baseUrl`。对于未配置的提供商，`getAuth()` 解析为 `undefined`；当确实有故障时（`"oauth"`：token 刷新失败，凭据保留以供重新登录；`"auth"`：密钥解析或凭据存储失败），会以 `ModelsError` 拒绝。请求路径会把同样的失败呈现为流错误。

`getAuth()`、`checkAuth()`、`getAvailable()`、登录和登出通过其现有选项或交互对象接受可选的调用方取消，并且在未提供信号时保持无界。提供商 `login`、`ApiKeyAuth.check`、`ApiKeyAuth.resolve` 和 `OAuthAuth.refresh` 实现始终收到具体的信号，并且对于阻塞工作必须遵守它。

### 转换请求头

`Models.stream()`、`complete()`、`streamSimple()` 和 `completeSimple()` 接受仅 Models 的 `transformHeaders` 选项。它在提供商认证、`model.headers` 和显式 `options.headers` 合并之后、提供商分发之前运行一次：

```typescript
const response = await models.completeSimple(model, context, {
  headers: { "X-Client": "my-app" },
  transformHeaders: async (headers) => ({
    ...headers,
    "X-Request-ID": crypto.randomUUID(),
  }),
});
```

顺序为：

```text
provider auth headers -> model.headers -> explicit options.headers -> transformHeaders -> Provider.stream*()
```

请求头名按不区分大小写合并。显式请求头覆盖认证/模型请求头，而转换函数拥有最终控制权；为某请求头返回 `null` 会抑制支持删除的低层默认值。

`transformHeaders` 属于 `Models` 而不是 `Provider`。`Models` 实现必须消费它，并在调用 `Provider.stream*()` 之前将其移除。提供商实现继续接收普通的 `ApiStreamOptions` 或 `SimpleStreamOptions`，从不处理转换本身。请使用此选项，而不是在 `stream*()` 之前调用 `getAuth(model)`——后者会解析两次请求认证。

### 凭据存储

存储的凭据（交互式输入的 API 密钥、OAuth token）存放在 `CredentialStore` 中——每个提供商一个带类型标签的凭据。pi-ai 内置了内存默认实现；应用可注入持久化存储：

```typescript
import { createModels, type CredentialStore } from '@earendil-works/pi-ai';

const models = createModels({ credentials: myFileBackedStore });
// builtinModels() takes the same options:
// const models = builtinModels({ credentials: myFileBackedStore });
```

契约很小：`read(providerId)`、`list()`（返回非机密的 `{ providerId, type }` 元数据）、`modify(providerId, fn)`（唯一的写入路径——串行化的读-改-写）和 `delete(providerId)`。每个操作都接受可选的取消选项。枚举不得解析机密或执行配置的密钥命令。OAuth token 刷新在 `modify` 内部运行，因此并发请求和进程不会对轮换的 token 双重刷新。存储的凭据*拥有*其提供商：只有在没有任何存储内容时才查询环境变量，失败的刷新永远不会静默回退到环境密钥。

API 密钥凭据使用与 pi 的 `auth.json` 相同的判别符，可以携带提供商级的环境/配置值：

```typescript
const credential = {
  type: 'api_key',
  key: '...',
  env: {
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
} as const;
```

### 环境变量

内置提供商解析以下环境变量（Node.js；在浏览器中显式传入 `apiKey`）：

| 提供商 | 环境变量 |
|----------|------------------------|
| OpenAI | `OPENAI_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL`（例如 `https://{resource}.ai.azure.com`）或 `AZURE_OPENAI_RESOURCE_NAME`。支持 `*.openai.azure.com`、`*.cognitiveservices.azure.com` 和 `*.ai.azure.com`；根端点自动规范化为 `/openai/v1`。可选：`AZURE_OPENAI_API_VERSION`（默认 `v1`）、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`。 |
| Anthropic | `ANTHROPIC_API_KEY` 或 `ANTHROPIC_OAUTH_TOKEN` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_API_KEY` 或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| xAI | `XAI_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Baseten | `BASETEN_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI Coding Plan (Global) | `ZAI_API_KEY` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_API_KEY` |
| MiniMax (Global) | `MINIMAX_API_KEY` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` |
| Moonshot AI / Moonshot AI (China) | `MOONSHOT_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Qwen Token Plan (existing catalog) | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan (Individual) | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo (API billing) | `XIAOMI_API_KEY` |
| Xiaomi MiMo Token Plan (China) | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo Token Plan (Amsterdam) | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| Xiaomi MiMo Token Plan (Singapore) | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |

`qwen-token-plan-individual` 和 `qwen-token-plan` 共享国际端点和 `QWEN_TOKEN_PLAN_API_KEY`。Individual 提供商只暴露针对 Individual 订阅记录的模型，而既有提供商保留其更广的目录以保持向后兼容。存储的凭据保持提供商级，因此请在你注册的提供商 ID 下保存密钥。

Amazon Bedrock 解析环境中的 AWS 凭据（`AWS_PROFILE`、访问密钥对、`AWS_BEARER_TOKEN_BEDROCK`、ECS 任务角色、web identity token）；其提供商拥有的登录流程支持 bearer token、AWS 配置文件和既有的凭据链。Vertex AI 解析显式密钥或 gcloud Application Default Credentials 加 project/location，并有提供商拥有的登录流程，支持 API 密钥、ADC 和服务账号文件。

## 工具

工具让 LLM 能与外部系统交互。本库使用 TypeBox schema 进行类型安全的工具定义，并使用 TypeBox 内置验证器和值转换工具自动验证。TypeBox schema 可以作为普通 JSON 序列化和反序列化，非常适合分布式系统。

### 定义工具

```typescript
import { Type, type Tool, StringEnum } from '@earendil-works/pi-ai';

// Define tool parameters with TypeBox
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name or coordinates' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// Note: For Google API compatibility, use StringEnum helper instead of Type.Enum
// Type.Enum generates anyOf/const patterns that Google doesn't support

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: 'Schedule a meeting',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### 工具的受限采样

工具可以选择使用提供商端的受限采样（constrained sampling）。对于 JSON-schema 工具，`strict: 'prefer'` 在支持时使用提供商端的严格 schema 强制，否则回退到普通工具调用。`strict: 'require'` 在活动提供商/模型无法满足时使请求失败。显式设置 `constrainedSampling: false` 表示退出；行为与省略该字段相同。

```typescript
const strictTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file',
  parameters: Type.Object({
    path: Type.String(),
    content: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: { type: 'json_schema', strict: 'prefer' }
};
```

严格 JSON-schema 受限采样受 OpenAI、Anthropic、受支持的 Amazon Bedrock Converse 模型、Mistral 以及通过 Google Generative AI 和 Vertex 适配器的 Gemini 3 工具调用支持。Google 使用 `VALIDATED` 函数调用模式（显式请求时使用 `ANY`）；更早的 Gemini 版本对 `strict: 'prefer'` 回退、对 `strict: 'require'` 拒绝，因为它们不强制必填参数。Bedrock 的严格工具能力从模型的结构化输出元数据生成；自定义 Bedrock 模型可以覆盖 `compat.supportsStrictMode`。OpenAI Responses 和 Chat Completions 还可以通过 OpenAI Lark 或 regex 语法变体发出语法受限的自定义工具。如果提供了多个 OpenAI 变体，Lark 优先于 regex。当活动模型支持语法工具时强制执行语法约束；否则工具回退到普通函数/JSON-schema 处理。语法工具能力是模型元数据：生成的目录为那些把 OpenAI 自定义工具透传的端点上的 GPT-5+ 模型设置 `compat.supportsOpenAIGrammarTools`（OpenAI、OpenAI Codex、Azure OpenAI Responses、GitHub Copilot、opencode 和 Cloudflare AI Gateway）。OpenAI 对 GPT-5 之前的模型拒绝 `type: "custom"` 工具，而规范化工具 schema 的网关（例如 OpenRouter）会破坏它们，因此该标志在其他地方保持关闭。自定义模型定义可以通过 `compat` 选择加入。支持语法能力的模型会拒绝没有非空受支持变体的语法配置。原生语法工具必须具有恰好一个必填字符串属性的对象参数 schema：

```typescript
const patchTool: Tool = {
  name: 'apply_patch',
  description: 'Apply a patch',
  parameters: Type.Object({
    input: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: {
    type: 'grammar',
    variants: {
      openai_lark: 'start: /.+/s'
    }
  }
};
```

### 处理工具调用

工具结果使用内容块，可以包含文本和图像：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: 'What is the weather in London?', timestamp: Date.now() }],
  tools: [weatherTool]
};

const response = await models.complete(model, context);

// Check for tool calls in the response
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // Execute your tool with the arguments
    // See "Validating Tool Arguments" section for validation
    const result = await executeWeatherApi(block.arguments);

    // Add tool result with text content
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// Tool results can also include images (for vision-capable models)
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: 'Generated chart showing temperature trends' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### 流式工具调用与部分 JSON

流式过程中，工具调用参数会随到达逐步解析。这可以在完整参数可用之前实现实时 UI 更新：

```typescript
const s = models.stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // toolCall.arguments contains partially parsed JSON during streaming
    // This allows for progressive UI updates
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // BE DEFENSIVE: arguments may be incomplete
      // Example: Show file path being written even before content is complete
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`Writing to: ${toolCall.arguments.path}`);

        // Content might be partial or missing
        if (toolCall.arguments.content) {
          console.log(`Content preview: ${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // Here toolCall.arguments is complete (but not yet validated)
    const toolCall = event.toolCall;
    console.log(`Tool completed: ${toolCall.name}`, toolCall.arguments);
  }
}
```

**关于部分工具参数的重要说明：**
- 在 `toolcall_delta` 事件期间，`arguments` 包含对部分 JSON 的尽力解析
- 字段可能缺失或不完整——使用前务必检查是否存在
- 字符串值可能在单词中间被截断
- 数组可能不完整
- 嵌套对象可能只部分填充
- 至少，`arguments` 会是一个空对象 `{}`，永远不会是 `undefined`
- Google 提供商不支持函数调用流式。相反，你会收到一个带有完整参数的 `toolcall_delta` 事件。

### 验证工具参数

实现你自己的工具执行循环时，用 `validateToolCall` 在把参数传给工具之前验证它们：

```typescript
import { validateToolCall, type Tool } from '@earendil-works/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = models.stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // Validate arguments against the tool's schema (throws on invalid args)
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... add tool result to context
    } catch (error) {
      // Validation failed - return error as tool result so model can retry
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

### 完整事件参考

助手消息生成期间发出的所有流事件：

| 事件类型 | 描述 | 关键属性 |
|------------|-------------|----------------|
| `start` | 流开始 | `partial`：初始助手消息结构 |
| `text_start` | 文本块开始 | `contentIndex`：在内容数组中的位置 |
| `text_delta` | 收到文本块 | `delta`：新文本，`contentIndex`：位置 |
| `text_end` | 文本块完成 | `content`：完整文本，`contentIndex`：位置 |
| `thinking_start` | 思考块开始 | `contentIndex`：在内容数组中的位置 |
| `thinking_delta` | 收到思考块 | `delta`：新文本，`contentIndex`：位置 |
| `thinking_end` | 思考块完成 | `content`：完整思考，`contentIndex`：位置 |
| `toolcall_start` | 工具调用开始 | `contentIndex`：在内容数组中的位置 |
| `toolcall_delta` | 工具参数流式传输 | `delta`：JSON 块，`partial.content[contentIndex].arguments`：部分解析的参数 |
| `toolcall_end` | 工具调用完成 | `toolCall`：带 `id`、`name`、`arguments` 的完整验证过的工具调用 |
| `done` | 流完成 | `reason`：停止原因（"stop"、"length"、"toolUse"），`message`：最终助手消息 |
| `error` | 发生错误 | `reason`：错误类型（"error" 或 "aborted"），`error`：带部分内容的 AssistantMessage |

不同内容块的流事件不保证连续。提供商可能在同一上游块中发出文本、思考和工具调用的增量，pi 可能交错呈现相应事件，例如 `text_start`、`text_delta`、`toolcall_start`、`text_delta`、`toolcall_delta`。消费方必须用 `contentIndex` 将每个 delta/end 事件与其块关联，并且不得假设某个块的 `*_start`/`*_delta`/`*_end` 序列不被其他块的事件打断。

## 图像输入

具有视觉能力的模型可以处理图像。你可以通过 `input` 属性检查模型是否支持图像。如果你把图像传给非视觉模型，它们会被静默忽略。

```typescript
import { readFileSync } from 'fs';

const model = models.getModel('openai', 'gpt-4o-mini')!;

// Check if model supports images
if (model.input.includes('image')) {
  console.log('Model supports vision');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await models.complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ],
    timestamp: Date.now()
  }]
});

// Access the response
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

## 图像生成

图像生成使用与文本/对话生成分离的 API 表面，镜像对话端的设计：`ImagesModels` 集合持有 `ImagesProvider`s，读取是同步的，认证通过所属提供商解析。图像生成是一次性 API：`generateImages()` 等待提供商响应并返回最终的 `AssistantImages` 结果——不要为它使用对话/流式 API。

### 基本图像生成

```typescript
import { builtinImagesModels } from '@earendil-works/pi-ai/providers/all';

// Every built-in image-generation provider; accepts the same options as createModels()
const imagesModels = builtinImagesModels();

const model = imagesModels.getModel('openrouter', 'google/gemini-2.5-flash-image')!;

// Auth resolves through the provider (OPENROUTER_API_KEY here); explicit apiKey wins
const result = await imagesModels.generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
});

for (const block of result.output) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'image') {
    console.log(block.mimeType);
    console.log(block.data.substring(0, 32));
  }
}
```

和对话端一样，你可以从部件构建集合：`createImagesModels({ credentials?, authContext? })`、来自 `@earendil-works/pi-ai/providers/openrouter-images` 的 `openrouterImagesProvider()` 工厂，以及用于自定义图像提供商的 `createImagesProvider({ id, auth, models, refreshModels?, api })`（动态列表用 `imagesModels.refresh(provider?)`）。失败从不拒绝——它们返回带 `stopReason: "error"` 的 `AssistantImages`。集合的提供商级 `getAuth(providerId)` 与对话端完全相同。

旧的全局 API（`getImageModel()` / `getImageModels()` / `getImageProviders()` / `generateImages()`）仍然可以通过 [compat 入口点](#migrating-from-the-old-global-api) 使用：

```typescript
import { getImageModel, generateImages } from '@earendil-works/pi-ai/compat';

const model = getImageModel('openrouter', 'google/gemini-2.5-flash-image');
const result = await generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
}, {
  apiKey: process.env.OPENROUTER_API_KEY
});
```

一些模型还支持图像输入：

```typescript
import { readFileSync } from 'fs';

const imageBuffer = readFileSync('input.png');
const result = await imagesModels.generateImages(model, {
  input: [
    { type: 'text', text: 'Create a variation of this image with a blue background.' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ]
});
```

在模型元数据上检查能力：

```typescript
console.log(model.input);   // ['text', 'image']
console.log(model.output);  // ['image'] or ['image', 'text']
```

### 说明与限制

- 图像模型存在于 `ImagesModels` 集合中，对话模型存在于 `Models` 集合中；两者是独立的表面。
- 使用 `generateImages()`，而不是对话/流式 API。
- 图像生成模型不参与工具调用。
- 输出在 `AssistantImages.output` 中返回，可以包含 base64 编码的 `ImageContent` 块和 `TextContent` 块。
- 一些模型只返回图像，另一些返回图像加文本。检查 `model.output`。
- 一些模型接受图像输入，另一些仅文生图。检查 `model.input`。
- 与流式 API 一样，图像生成支持 `apiKey`、`signal`、`headers`、`onPayload` 和 `onResponse` 等选项，结果可能包含 `stopReason`、`responseId` 和 `usage`。
- 如果你想让模型在对话中分析图像或调用工具，请使用支持图像输入的模型的常规对话 API。
- 目前，图像生成只通过一个提供商可用：OpenRouter。

## 思考/推理

许多模型支持思考/推理能力，可以展示其内部思维过程。你可以通过 `reasoning` 属性检查模型是否支持推理。如果你把推理选项传给不支持推理的模型，它们会被静默忽略。

### 统一接口 (streamSimple/completeSimple)

```typescript
// Many models across providers support thinking/reasoning
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
// or models.getModel('openai', 'gpt-5-mini');
// or models.getModel('google', 'gemini-2.5-flash');
// or models.getModel('xai', 'grok-4.5');

// Check if model supports reasoning
if (model.reasoning) {
  console.log('Model supports reasoning/thinking');
}

// Use the simplified reasoning option
const response = await models.completeSimple(model, {
  messages: [{ role: 'user', content: 'Solve: 2x + 5 = 13', timestamp: Date.now() }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
});

// Access thinking and text blocks
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('Thinking:', block.thinking);
  } else if (block.type === 'text') {
    console.log('Response:', block.text);
  }
}
```

`xhigh` 和 `max` 是模型特定、选择加入的级别。用 `getSupportedThinkingLevels(model)` 确定具体模型是否暴露其中任一级别；例如 GPT-5.6 等模型可能两者都支持。

### 提供商特定选项 (stream/complete)

`models.stream()`/`complete()` 接受所属 API 的完整选项集。用 `hasApi()` 把动态查找的模型收窄到其 API，以获得完整的选项类型：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

// OpenAI Reasoning (o1, o3, gpt-5)
const openaiModel = models.getModel('openai', 'gpt-5-mini')!;
if (hasApi(openaiModel, 'openai-responses')) {
  await models.complete(openaiModel, context, {
    reasoningEffort: 'medium',
    reasoningSummary: 'detailed'  // OpenAI Responses API only
  });
}

// Anthropic Thinking
const anthropicModel = models.getModel('anthropic', 'claude-sonnet-4-5')!;
if (hasApi(anthropicModel, 'anthropic-messages')) {
  await models.complete(anthropicModel, context, {
    thinkingEnabled: true,
    thinkingBudgetTokens: 8192  // Optional token limit
  });
}

// Google Gemini Thinking
const googleModel = models.getModel('google', 'gemini-2.5-flash')!;
if (hasApi(googleModel, 'google-generative-ai')) {
  await models.complete(googleModel, context, {
    thinking: {
      enabled: true,
      budgetTokens: 8192  // -1 for dynamic, 0 to disable
    }
  });
}
```

### 流式思考内容

流式时，思考内容通过特定事件投递：

```typescript
const s = models.streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[Model started thinking]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // Stream thinking content
      break;
    case 'thinking_end':
      console.log('\n[Thinking complete]');
      break;
  }
}
```

## 停止原因

每个 `AssistantMessage` 都包含一个 `stopReason` 字段，指示生成如何结束：

- `"pending"` - 只出现在我们尚不知道停止原因的部分消息中
- `"stop"` - 这是模型本轮将产生的最终消息
- `"length"` - 输出达到最大 token 上限
- `"toolUse"` - 模型正在调用工具并期待工具结果
- `"error"` - 生成期间发生错误
- `"aborted"` - 请求通过中止信号取消

当底层 API 暴露时，`AssistantMessage` 还可能包含 `responseId`，即提供商特定的上游响应或消息标识符。不要假设它在所有提供商中始终存在。

## 错误处理

请求失败永远不会从流函数中抛出：当请求以错误结束（包括中止和工具调用验证错误）时，流式 API 会发出错误事件，最终消息携带详细信息：

```typescript
// In streaming
for await (const event of s) {
  if (event.type === 'error') {
    // event.reason is either "error" or "aborted"
    // event.error is the AssistantMessage with partial content
    console.error(`Error (${event.reason}):`, event.error.errorMessage);
    console.log('Partial content:', event.error.content);
  }
}

// The final message will have the error details
const message = await s.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('Request failed:', message.errorMessage);
  // message.content contains any partial content received before the error
  // message.usage contains partial token counts and costs
}
```

认证失败（未配置密钥、OAuth 刷新失败、未知提供商）以相同方式呈现：作为 `stopReason: "error"` 的流错误。

### 中止请求

中止信号允许你取消进行中的请求。中止的请求有 `stopReason === 'aborted'`：

```typescript
const controller = new AbortController();

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000);

const s = models.stream(model, {
  messages: [{ role: 'user', content: 'Write a long story', timestamp: Date.now() }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason tells you if it was "error" or "aborted"
    console.log(`${event.reason === 'aborted' ? 'Aborted' : 'Error'}:`, event.error.errorMessage);
  }
}

// Get results (may be partial if aborted)
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('Request was aborted:', response.errorMessage);
  console.log('Partial content received:', response.content);
  console.log('Tokens used:', response.usage);
}
```

### 中止后继续

中止的消息可以加入对话上下文并在后续请求中继续：

```typescript
const context = {
  messages: [
    { role: 'user', content: 'Explain quantum computing in detail', timestamp: Date.now() }
  ]
};

// First request gets aborted after 2 seconds
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await models.complete(model, context, { signal: controller1.signal });

// Add the partial response to context
context.messages.push(partial);
context.messages.push({ role: 'user', content: 'Please continue', timestamp: Date.now() });

// Continue the conversation
const continuation = await models.complete(model, context);
```

### 调试提供商负载

使用 `onPayload` 回调检查发送给提供商的请求负载。这对调试请求格式问题或提供商验证错误很有用。

```typescript
const response = await models.complete(model, context, {
  onPayload: (payload) => {
    console.log('Provider payload:', JSON.stringify(payload, null, 2));
  }
});
```

`stream`、`complete`、`streamSimple` 和 `completeSimple` 都支持该回调。

## 自定义提供商

### createProvider()

`createProvider()` 从部件构建提供商：身份、认证、模型列表和 API 实现。用于本地推理服务器、代理或任何 OpenAI/Anthropic 兼容端点：

```typescript
import { createModels, createProvider, envApiKeyAuth, type Model } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

const ollama = createProvider({
  id: 'ollama',
  name: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  // Every provider declares auth; keyless local servers resolve as configured with no key.
  auth: { apiKey: { name: 'Ollama', resolve: async () => ({ auth: {} }) } },
  models: [ollamaModel],
  api: openAICompletionsApi(),
});

const models = createModels();
models.setProvider(ollama);

await models.complete(models.getModel('ollama', 'llama-3.1-8b')!, context);
```

对于有真实密钥的提供商，`envApiKeyAuth(displayName, envVars)` 提供标准行为（存储的凭据优先，然后是第一个已设置的环境变量）：

```typescript
const proxy = createProvider({
  id: 'my-proxy',
  auth: { apiKey: envApiKeyAuth('My proxy API key', ['MY_PROXY_API_KEY']) },
  models: [/* ... */],
  api: openAICompletionsApi(),
});
```

混合 API 提供商传入按 `model.api` 键控的映射；每个模型分发到其 API 的实现：

```typescript
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';

const gateway = createProvider({
  id: 'my-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* models with api: 'anthropic-messages' or 'openai-responses' */],
  api: {
    'anthropic-messages': anthropicMessagesApi(),
    'openai-responses': openAIResponsesApi(),
  },
});
```

提供商级别的端点或请求转换属于提供商的 API 实现：包装你作为 `api` 传入的 `ProviderStreams`，使每个请求在分发前都经过转换。Cloudflare 提供商就是这样做的，从解析的提供商环境中物化账号/网关端点占位符：

```typescript
function tenantStreams(streams: ProviderStreams): ProviderStreams {
  const withTenant = (model: Model<Api>) => ({ ...model, baseUrl: model.baseUrl.replace('{tenant}', tenantId) });
  return {
    stream: (model, context, options) => streams.stream(withTenant(model), context, options),
    streamSimple: (model, context, options) => streams.streamSimple(withTenant(model), context, options),
  };
}

const tenantGateway = createProvider({
  id: 'tenant-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* ... */],
  api: tenantStreams(openAICompletionsApi()),
});
```

动态模型列表使用 `fetchModels`。`Models.refresh()` 刷新每个配置的动态提供商，传入其生效的 API 密钥或刷新后的 OAuth 凭据。`ModelsStore` 持久化动态目录；两个存储默认使用内存实现。其 `read`、`write` 和 `delete` 操作接受可选取消，`Models` 会把这些等待绑定到提供商刷新信号。

```typescript
const models = createModels({ credentials, modelsStore });
const llamacpp = createProvider({
  id: 'llamacpp',
  auth: { apiKey: { name: 'llama.cpp', resolve: async () => ({ auth: {} }) } },
  models: [],
  fetchModels: async ({ signal }) => fetchModelsFromServer('http://localhost:8080', signal),
  api: openAICompletionsApi(),
});

models.setProvider(llamacpp);
const result = await models.refresh({ signal });
if (result.aborted) console.log('refresh cancelled');
for (const [provider, error] of result.errors) console.error(provider, error);
```

`Models.refresh()` 在省略可选信号时是无界的。提供商始终收到具体的 `RefreshModelsContext.signal`，并且必须为网络请求和其他阻塞工作遵守它。当调用方提供信号时，即使自定义提供商不配合，`Models.refresh()` 也会在取消后以 `aborted: true` 及时返回；提供商仍然必须遵守信号以停止其底层工作。

用 `models.refresh({ providers: ['openrouter'] })` 把工作限制在选中的提供商，用 `models.refresh({ allowNetwork: false })` 在无网络访问的情况下恢复持久化目录，或用 `models.refresh({ force: true })` 绕过提供商的新鲜度检查。模型读取保持同步，返回最近恢复或刷新的列表。

`createProvider()` 自动处理动态发布和持久化。手写的 `Provider.refreshModels()` 实现接收只读的 `context.stored` 快照，并通过 `context.publish({ persist?, update? })` 发布。省略 `persist` 保持存储不变，传入 `ModelsStoreEntry` 写入它，或传 `persist: null` 删除它。发布经过代际检查；把同步的内存目录变更放在 `update` 中，而不是在发布前修改状态。

自定义模型可以携带 `headers`（例如隐藏在机器人检测后的代理）和 `compat` 标志。`Models.getAuth(model)` 包含这些模型请求头，流方法在显式请求头和 `transformHeaders` 之前合并它们。参见 [OpenAI 兼容性设置](#openai-compatibility-settings)。

一些 OpenAI 兼容服务器不理解用于推理能力模型的 `developer` 角色。对于这些提供商，把 `compat.supportsDeveloperRole` 设为 `false`，这样系统提示词会作为 `system` 消息发送。如果服务器也不支持 `reasoning_effort`，同时设置 `compat.supportsReasoningEffort` 为 `false`。这通常适用于 Ollama、vLLM、SGLang 及类似的 OpenAI 兼容服务器。

使用模型级的 `thinkingLevelMap` 描述模型特定的思考控制。键是 pi 思考级别（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`）。缺失的标准级别（直到 `high`）使用提供商默认值；`xhigh` 和 `max` 是选择加入的，需要非 null 的映射条目。字符串值发送给提供商，`null` 表示该级别不受支持，映射可以跳过某些级别。

```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  thinkingLevelMap: {
    minimal: null,
    low: null,
    medium: null,
    high: 'high',
    xhigh: null,
  },
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

### 直接调用 API 实现

API 实现可以独立导入。每个模块恰好导出 `stream` 和 `streamSimple`，带该 API 的完整选项类型。直接调用绕过提供商认证——请显式传入 `apiKey`：

```typescript
import { stream } from '@earendil-works/pi-ai/api/anthropic-messages';

const s = stream(claudeModel, context, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048,
});
```

内置 API 实现位于 `./api/<api-id>`：

| API id | 选项类型 |
|--------|--------------|
| `anthropic-messages` | `AnthropicOptions` |
| `openai-completions` | `OpenAICompletionsOptions` |
| `openai-responses` | `OpenAIResponsesOptions` |
| `openai-codex-responses` | `OpenAICodexResponsesOptions` |
| `azure-openai-responses` | `AzureOpenAIResponsesOptions` |
| `google-generative-ai` | `GoogleOptions` |
| `google-vertex` | `GoogleVertexOptions` |
| `mistral-conversations` | `MistralOptions` |
| `bedrock-converse-stream` | `BedrockOptions` |

导入实现模块会加载其 SDK。`./api/<id>.lazy` 包装器（提供商工厂使用）在运行时或打包器支持动态导入分块时，把该加载推迟到首次请求。旧版本中的遗留原始 API 子路径（`./anthropic`、`./google`、`./mistral`、`./openai-completions`、...）已移除；请使用 `@earendil-works/pi-ai/api/<api-id>`。

### OpenAI 兼容性设置

`openai-completions` API 被许多提供商以微小差异实现。默认情况下，库基于 `baseUrl` 对一小撮已知的 OpenAI 兼容提供商（Cerebras、xAI、Chutes、DeepSeek、NVIDIA NIM、Together AI、zAi、OpenCode、Cloudflare Workers AI 等）自动检测兼容性设置。对于自定义代理或未知端点，你可以通过 `compat` 字段覆盖这些设置。对于 `openai-responses` 模型，compat 字段支持 Responses 特定的标志。

```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // Whether provider supports the `store` field (default: true)
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  supportsReasoningEffort?: boolean; // Whether provider supports `reasoning_effort` (default: true)
  supportsUsageInStreaming?: boolean; // Whether provider supports `stream_options: { include_usage: true }` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports `strict` in tool definitions (default: true)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
  sendSessionAffinityHeaders?: boolean; // Send session-affinity data from `sessionId` (default: false)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Format for session affinity: 'openai' uses `prompt_cache_key`, `session_id`, `x-client-request-id`, and `x-session-affinity`; 'openai-nosession' uses `prompt_cache_key`, `x-client-request-id`, and `x-session-affinity`; 'openrouter' uses `x-session-id` (default: auto-detected)
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // Which field name to use (default: max_completion_tokens)
  requiresToolResultName?: boolean;  // Whether tool results require the `name` field (default: false)
  requiresAssistantAfterToolResult?: boolean; // Whether tool results must be followed by an assistant message (default: false)
  requiresThinkingAsText?: boolean;  // Whether thinking blocks must be converted to text (default: false)
  requiresReasoningContentOnAssistantMessages?: boolean; // Whether all replayed assistant messages must include empty reasoning_content when reasoning is enabled (default: auto-detected for DeepSeek)
  thinkingFormat?: 'openai' | 'openrouter' | 'deepseek' | 'together' | 'baseten' | 'zai' | 'qwen' | 'chat-template' | 'qwen-chat-template' | 'string-thinking' | 'ant-ling'; // Format for reasoning param: 'openai' uses reasoning_effort, 'openrouter' uses reasoning: { effort }, 'deepseek' uses thinking: { type } plus reasoning_effort when supported, 'together' uses reasoning: { enabled } plus reasoning_effort when supported, 'baseten' uses configurable chat_template_args plus reasoning_effort when supported, 'zai' uses thinking: { type }, 'qwen' uses enable_thinking, 'chat-template' uses configurable chat_template_kwargs, 'qwen-chat-template' uses chat_template_kwargs.enable_thinking and preserve_thinking, 'string-thinking' uses top-level thinking, 'ant-ling' uses reasoning: { effort } only for mapped efforts (default: openai)
  chatTemplateKwargs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort'; omitWhenOff?: boolean }>; // chat_template_kwargs values; use $var for pi-controlled thinking values
  chatTemplateArgs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort'; omitWhenOff?: boolean }>; // chat_template_args values for thinkingFormat: 'baseten'; use $var for pi-controlled thinking values
  cacheControlFormat?: 'anthropic';  // Anthropic-style cache_control on system prompt, last tool, and last user/assistant text content
  openRouterRouting?: OpenRouterRouting; // OpenRouter routing preferences (default: {})
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway routing preferences (default: {})
}

interface OpenAIResponsesCompat {
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Session-affinity header format: 'openai' sends `session_id` and `x-client-request-id`; 'openai-nosession' sends `x-client-request-id`; 'openrouter' sends `x-session-id`. Does not affect the `prompt_cache_key` body param (default: auto-detected)
  supportsLongCacheRetention?: boolean; // Whether provider supports `prompt_cache_retention: "24h"` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports strict JSON-schema function tools (default: false; enabled in metadata for built-in OpenAI models)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
}
```

如果未设置 `compat`，库回退到基于 URL 的检测。如果 `compat` 部分设置，未指定字段使用检测到的默认值。这对以下情况有用：

- **LiteLLM 代理**：可能不支持 `store` 字段
- **自定义推理服务器**：可能使用非标准字段名
- **自托管端点**：可能有不同的功能支持

## 测试用 Faux 提供商

`fauxProvider()` 构建一个带脚本化响应的内存提供商，用于测试和演示：

```typescript
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const faux = fauxProvider({
  tokensPerSecond: 50 // optional
});

const models = createModels();
models.setProvider(faux.provider);

const model = faux.getModel();
const context = {
  messages: [{ role: 'user', content: 'Summarize package.json and then call echo', timestamp: Date.now() }]
};

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Need to inspect package metadata first.'),
    fauxToolCall('echo', { text: 'package.json' })
  ], { stopReason: 'toolUse' })
]);

const first = await models.complete(model, context, {
  sessionId: 'session-1',
  cacheRetention: 'short'
});
context.messages.push(first);

context.messages.push({
  role: 'toolResult',
  toolCallId: first.content.find((block) => block.type === 'toolCall')!.id,
  toolName: 'echo',
  content: [{ type: 'text', text: 'package.json contents here' }],
  isError: false,
  timestamp: Date.now()
});

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Now I can summarize the tool output.'),
    fauxText('Here is the summary.')
  ])
]);

const s = models.stream(model, context);
for await (const event of s) {
  console.log(event.type);
}

// Optional: multiple faux models for model-switching tests
const multiModel = fauxProvider({
  provider: 'faux-multi',
  models: [
    { id: 'faux-fast', reasoning: false },
    { id: 'faux-thinker', reasoning: true }
  ]
});
models.setProvider(multiModel.provider);
const thinker = multiModel.getModel('faux-thinker');

console.log(thinker?.reasoning);
console.log(faux.getPendingResponseCount());
console.log(faux.state.callCount);
```

说明：
- 响应按请求开始顺序从队列中消费。
- 如果队列为空，faux 提供商返回一条带 `errorMessage: "No more faux responses queued"` 的助手错误消息。
- 用 `faux.setResponses([...])` 替换剩余队列，用 `faux.appendResponses([...])` 追加更多响应。
- `faux.models` 暴露所有 faux 模型。`faux.getModel()` 返回第一个，`faux.getModel(id)` 返回指定的那个。
- 用 `fauxAssistantMessage(...)` 构建脚本化的助手回复。用 `fauxText(...)`、`fauxThinking(...)` 和 `fauxToolCall(...)` 构建内容块，无需手动填写底层字段。
- 用量大约按每 4 个字符 1 个 token 估算。当存在 `sessionId` 且 `cacheRetention` 不是 `"none"` 时，会自动模拟提示词缓存的读取和写入。
- 工具调用参数通过 `toolcall_delta` 块增量流式传输。
- 默认情况下，每个流式块在自己的微任务中发出。设置 `tokensPerSecond` 以实时控制块投递节奏。
- 预期用法是每个句柄一个确定性的脚本化流程。如果你需要独立的并发流程，请创建具有不同 `provider` id 的独立 faux 提供商。

## 跨提供商切换

本库支持在同一对话中不同 LLM 提供商之间的无缝切换。这允许你在对话中途切换模型，同时保留上下文，包括思考块、工具调用和工具结果。

当来自一个提供商的消息发送给不同提供商时，库会自动转换它们以保持兼容：

- **用户和工具结果消息** 原样通过
- **来自同一提供商/API 的助手消息** 保持原样
- **来自不同提供商的助手消息** 其思考块会被转换为带 `<thinking>` 标签的文本
- **工具调用和普通文本** 保持不变

```typescript
import { createModels, type Context } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { googleProvider } from '@earendil-works/pi-ai/providers/google';

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(googleProvider());

const context: Context = { messages: [] };

// Start with Claude
const claude = models.getModel('anthropic', 'claude-sonnet-4-5')!;
context.messages.push({ role: 'user', content: 'What is 25 * 18?', timestamp: Date.now() });
context.messages.push(await models.completeSimple(claude, context, { reasoning: 'medium' }));

// Switch to GPT-5 - it will see Claude's thinking as <thinking> tagged text
const gpt5 = models.getModel('openai', 'gpt-5-mini')!;
context.messages.push({ role: 'user', content: 'Is that calculation correct?', timestamp: Date.now() });
context.messages.push(await models.complete(gpt5, context));

// Switch to Gemini
const gemini = models.getModel('google', 'gemini-2.5-flash')!;
context.messages.push({ role: 'user', content: 'What was the original question?', timestamp: Date.now() });
const geminiResponse = await models.complete(gemini, context);
```

所有提供商都能处理来自其他提供商的消息——文本、工具调用和结果（包括图像）、思考块（转换为带标签的文本），以及带部分内容的中止消息。这支持灵活的工作流：从快速模型开始，为复杂推理切换到能力更强的模型，或在提供商故障期间保持连续性。

## 上下文序列化

`Context` 对象可以使用标准 JSON 方法轻松序列化和反序列化，使其易于持久化对话、实现聊天历史或在服务之间传输上下文：

```typescript
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'What is TypeScript?', timestamp: Date.now() }
  ]
};

const model = models.getModel('openai', 'gpt-4o-mini')!;
const response = await models.complete(model, context);
context.messages.push(response);

// Serialize the entire context
const serialized = JSON.stringify(context);

// Save to database, localStorage, file, etc.
localStorage.setItem('conversation', serialized);

// Later: deserialize and continue the conversation
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: 'Tell me more about its type system', timestamp: Date.now() });

// Continue with any model
const newModel = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const continuation = await models.complete(newModel, restored);
```

模型也是纯可序列化数据——不附加任何函数或实现——因此持久化"这个对话用的是哪个模型"只是一次 `JSON.stringify` 的事。

> **注意**：如果上下文包含图像（如图像输入部分所示，以 base64 编码），这些也会被序列化。

## 浏览器使用

本库支持浏览器环境。核心入口点和提供商工厂无副作用，可干净地打包。环境变量在浏览器中不可用，因此请显式传入 API 密钥——或注入一个 `CredentialStore`（例如 localStorage 支撑的），让提供商认证从存储的凭据解析：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels();
models.setProvider(anthropicProvider());

const model = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const response = await models.complete(model, {
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }]
}, {
  apiKey: 'your-api-key'
});
```

> **安全警告**：在前端代码中暴露 API 密钥是危险的。任何人都可以提取并滥用你的密钥。此方法仅适用于内部工具或演示。对于生产应用，请使用保护 API 密钥的后端代理。

浏览器兼容性说明：

- Amazon Bedrock（`bedrock-converse-stream`）在浏览器环境中不受支持。它仍可能出现在模型列表中；调用会在运行时失败。
- OAuth 登录流程仅限 Node。它们通过打包器不透明的导入惰性加载，因此注册一个支持 OAuth 的提供商不会把仅限 Node 的代码拉进浏览器包——只有实际登录才会。
- 如果你需要从 Web 应用使用 Bedrock 或基于 OAuth 的认证，请使用服务端代理或后端服务。

## 打包与 Tree Shaking

为了减小打包体积，只导入你需要的提供商：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

const models = createModels();
models.setProvider(openaiProvider());
```

规则：

- `@earendil-works/pi-ai` 是核心入口点，不导入内置目录、提供商工厂或 SDK 实现。
- `@earendil-works/pi-ai/providers/<provider>` 只导入该提供商的目录和惰性 API 包装器。
- `@earendil-works/pi-ai/providers/all` 导入每个内置提供商工厂和所有目录。只在需要完整内置集合时使用它。
- 使用代码分割时，提供商 SDK 留在惰性块中，在首次请求时加载。
- 不使用代码分割时，打包器会把可达的惰性 API 实现折叠进单个包中。单提供商包因此包含该提供商的 SDK；`providers/all` 包含所有静态可见的 SDK。Bedrock 是例外：其 AWS SDK 实现通过打包器不透明的仅 Node 导入加载。
- 直接导入 `@earendil-works/pi-ai/api/<api-id>` 会立即加载该 API 实现及其 SDK。

在新建的打包应用里避免使用 `@earendil-works/pi-ai/compat`；它保留旧的全局 API 并导入完整的内置目录表面。

对于单文件 Node ESM 包，某些 SDK 依赖可能仍在内部使用动态 CommonJS `require()`。如果你看到类似 `Dynamic require of "child_process" is not supported` 的错误，请向包中添加一个 Node `require` shim。使用 esbuild：

```bash
esbuild app.js --bundle --platform=node --format=esm \
  --banner:js='import { createRequire } from "module";const require = createRequire(import.meta.url);' \
  --outfile=app.bundle.js
```

这仅适用于 Node 包；不是浏览器或 Cloudflare Workers 的变通方案。

Bedrock 仅限 Node。像添加任何其他提供商一样添加它：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';

const models = createModels();
models.setProvider(amazonBedrockProvider());
```

在常规 Node 包使用和代码分割包中，Bedrock 惰性加载其 AWS SDK 实现。对于必须包含 Bedrock 支持的独立单文件包，请显式注册实现模块：

```typescript
import { setBedrockProviderModule } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';

setBedrockProviderModule(bedrockProviderModule);
```

该显式覆盖会把 AWS SDK 打进包中。没有它，Bedrock 的不透明运行时导入期望包的 Bedrock 实现文件在运行时可用。

### 提供商级环境覆盖

在流选项中传入 `env`，把提供商配置限定到某个请求。`env` 中的值在提供商认证和配置中优先于进程环境变量，例如 Cloudflare 账号 ID、Azure OpenAI 设置、Vertex project/location、Bedrock 设置、`PI_CACHE_RETENTION` 和 `HTTP_PROXY`/`HTTPS_PROXY`。

```typescript
const models = builtinModels();
const model = models.getModel('cloudflare-ai-gateway', 'workers-ai/@cf/moonshotai/kimi-k2.6')!;

const response = await models.complete(model, context, {
  env: {
    CLOUDFLARE_API_KEY: '...',
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
});
```

当单个进程需要按请求使用不同提供商设置，或环境变量不应泄漏到提供商调用中时，使用此方式。

## OAuth 提供商

几个提供商支持 OAuth 认证而非静态 API 密钥：

- **Anthropic**（Claude Pro/Max 订阅）
- **OpenAI Codex**（ChatGPT Plus/Pro 订阅，可访问 GPT-5.x Codex 模型）
- **GitHub Copilot**（Copilot 订阅）
- **OpenRouter**（OAuth PKCE，铸造用户控制的 API 密钥）

这些提供商中的每一个都在 `provider.auth.oauth` 上携带一个 `OAuthAuth`，具有三个操作：`login(interaction)` 使用提供商中立的 `AuthInteraction.prompt()`/`notify()` 协议并返回凭据，`refresh(credential, signal)` 在适用时刷新过期凭据，`toAuth(credential)` 派生请求认证（GitHub Copilot 的按账号 base URL 来自这里）。提供商登录交互和刷新调用始终携带具体的中止信号。刷新是自动的：`models.getAuth(providerId)` 和请求路径在凭据存储锁下刷新过期 token，因此并发请求和进程不会双重刷新。OpenRouter 的 OAuth 流程返回的是永久 API 密钥，因此其刷新操作是 no-op。

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels({ credentials: myStore }); // persistent CredentialStore
models.setProvider(anthropicProvider());

// Login: Models drives the flow and persists the credential
await models.login('anthropic', 'oauth', {
  prompt: async (p) => {
    // p.type: 'text' | 'secret' | 'select' | 'manual_code'
    // manual_code prompts race a local callback server; p.signal aborts them when the server wins
    return await askUser(p.message);
  },
  notify: (event) => {
    // event.type: 'info' | 'auth_url' | 'device_code' | 'progress'
    if (event.type === 'info') {
      console.log(event.message);
      for (const link of event.links ?? []) console.log(`${link.label ?? 'More information'}: ${link.url}`);
    }
    if (event.type === 'auth_url') console.log(`Open: ${event.url}`);
    if (event.type === 'device_code') console.log(`Code: ${event.userCode} at ${event.verificationUri}`);
    if (event.type === 'progress') console.log(event.message);
  },
});

// From here on, requests resolve and refresh the token automatically
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
await models.complete(model, context);

// Logout
await models.logout('anthropic');
```

### Vertex AI

Vertex AI 模型支持 Google Cloud API 密钥或 Application Default Credentials (ADC)。其提供商拥有的 API 密钥登录流程可以配置任一种方式：

- **API 密钥**：设置 `GOOGLE_CLOUD_API_KEY` 或在调用选项中传入 `apiKey`。
- **本地开发 (ADC)**：运行 `gcloud auth application-default login`
- **CI/生产 (ADC)**：把 `GOOGLE_APPLICATION_CREDENTIALS` 指向服务账号 JSON 密钥文件

使用 ADC 时，还要设置 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）和 `GOOGLE_CLOUD_LOCATION`。你也可以在调用选项中传入 `project`/`location`。使用 `GOOGLE_CLOUD_API_KEY` 时，`project` 和 `location` 不是必需的。

```bash
# Local (uses your user credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/Production (service account key file)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

官方文档：[Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)

### CLI 登录

最快的认证方式：

```bash
npx @earendil-works/pi-ai login              # interactive provider selection
npx @earendil-works/pi-ai login anthropic    # login to specific provider
npx @earendil-works/pi-ai list               # list available providers
```

凭据保存到当前目录的 `auth.json`。

### 编程式 OAuth

内置的登录和刷新流程是私有提供商实现。使用提供商拥有的 `OAuthAuth`，它可与 `CredentialStore` 组合，并通过 `Models` 获得带锁的自动刷新。`@earendil-works/pi-ai/oauth` 入口点仅保留 coding-agent 扩展 OAuth 兼容性所需的类型声明。

提供商说明：

**OpenAI Codex**：需要 ChatGPT Plus 或 Pro 订阅。可访问具有扩展上下文窗口和推理能力的 GPT-5.x Codex 模型。当流选项中提供 `sessionId` 时，库自动处理基于会话的提示词缓存，除非 `cacheRetention` 为 `"none"`。你可以在流选项中将 `transport` 设为 `"sse"`、`"websocket"` 或 `"auto"`，用于 Codex Responses 传输选择。使用带 `sessionId` 和缓存保留的 WebSocket 时，连接按会话复用，并在 5 分钟无活动后过期。

**Azure OpenAI (Responses)**：只使用 Responses API。设置 `AZURE_OPENAI_API_KEY` 以及 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME`。`AZURE_OPENAI_BASE_URL` 同时支持 `https://<resource>.openai.azure.com` 和 `https://<resource>.cognitiveservices.azure.com`；根端点自动规范化为 `.../openai/v1`。需要时用 `AZURE_OPENAI_API_VERSION`（默认 `v1`）覆盖 API 版本。部署名称默认被视为模型 ID，可以用 `azureDeploymentName` 或 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` 使用逗号分隔的 `model-id=deployment` 对覆盖（例如 `gpt-4o-mini=my-deployment,gpt-4o=prod`）。基于部署的遗留 URL 有意不支持。

**GitHub Copilot**：如果你收到 "The requested model is not supported" 错误，请在 VS Code 中手动启用该模型：打开 Copilot Chat，点击模型选择器，选择该模型（警告图标），然后点击 "Enable"。

## 从旧全局 API 迁移

旧版本暴露了全局 API：通过全局注册表按 `model.api` 分发的 `stream()`/`complete()`、同步的 `getModel()`/`getModels()`/`getProviders()` 目录读取、`registerApiProvider()`、`getEnvApiKey()` 以及按 API 的惰性流函数。该表面在 **compat 入口点** 上原样保留：

```typescript
// Before
import { getModel, complete } from '@earendil-works/pi-ai';

// After (verbatim behavior, one import-path change)
import { getModel, complete } from '@earendil-works/pi-ai/compat';
```

Compat 是根入口点的严格超集，因此一个文件可以整体切换其导入路径。它将在未来版本中移除；请迁移到 `createModels()` + 提供商工厂：

| 旧 | 新 |
|-----|-----|
| `getModel('openai', 'gpt-4o-mini')` | `models.getModel('openai', 'gpt-4o-mini')` 或来自 `providers/all` 的 `getBuiltinModel()` |
| `getModels('anthropic')` / `getProviders()` | `models.getModels('anthropic')` / `models.getProviders()` 或 `getBuiltin*` |
| `stream(model, ctx, opts)`（环境密钥注入） | `models.stream(model, ctx, opts)`（提供商认证解析） |
| `registerApiProvider({ api, stream, streamSimple })` | `createProvider({ id, auth, models, api })` + `models.setProvider()` |
| `getEnvApiKey('openai')` | `await models.getAuth(model.provider)` |
| `streamAnthropic(model, ctx, opts)` | 来自 `@earendil-works/pi-ai/api/anthropic-messages` 的 `stream`，或集合中的提供商 |
| `registerFauxProvider()` | `fauxProvider()` + `models.setProvider()` |

## 开发

### 添加新提供商

添加新的 LLM 提供商需要跨多个文件的改动。分层布局：API 实现位于 `src/api/`，提供商工厂位于 `src/providers/`，稳定的生成目录包装器位于 `src/providers/<id>.models.ts`，`src/models.generated.ts` 注册它们。这份检查清单覆盖所有必要步骤：

#### 1. 核心类型 (`src/types.ts`)

- 如果这是一个新 API，把 API 标识符添加到 `KnownApi`（例如 `"bedrock-converse-stream"`）
- 把提供商名称添加到 `KnownProvider`（例如 `"amazon-bedrock"`）
- 把选项类型添加到 `ApiOptionsMap`

#### 2. API 实现 (`src/api/<api-id>.ts`，仅新 API)

创建一个新的 API 实现文件（例如 `bedrock-converse-stream.ts`），恰好导出 `stream` 和 `streamSimple`，加上：

- 一个扩展 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
- 把 `Context` 转换为提供商格式的消息转换函数
- 如果提供商支持工具，则进行工具转换
- 响应解析以发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）

添加惰性包装器 `src/api/<api-id>.lazy.ts`（通过 `lazyApi()` 生成 `<name>Api()`），以便提供商可以在不导入其 SDK 的情况下引用实现。在 `src/index.ts` 中添加任何应从 `@earendil-works/pi-ai` 保持可用的根级 `export type` 重新导出。

#### 3. 模型生成 (`scripts/generate-models.ts`、`scripts/generate-image-models.ts`)

- 添加从提供商来源（例如 models.dev API）获取和解析模型的逻辑
- 通过 `scripts/generate-models.ts` 把支持对话/工具的提供商模型数据映射到标准化的 `Model` 接口；hydration 把被忽略的 `src/providers/data/<id>.json` 值按 API 分组，而稳定的 `src/providers/<id>.models.ts` 包装器直接从这些 JSON 键派生精确的模型/API 类型
- 通过 `scripts/generate-image-models.ts` 把图像生成提供商模型数据映射到标准化的 `ImagesModel` 接口
- 处理提供商特定的怪癖（定价格式、能力标志、模型 ID 转换）

#### 4. 提供商工厂 (`src/providers/<id>.ts`)

- `createProvider()` 接线目录 + 认证 + 惰性 API 包装器
- 认证：标准密钥提供商用 `envApiKeyAuth`，环境认证（AWS 配置文件、ADC）用自定义 `ApiKeyAuth`，存在 OAuth 流程时用 `lazyOAuth`
- 在 `src/providers/all.ts` 中注册工厂
- 如果是新 API：在 `src/compat.ts` 的内置列表中注册它，并在 `package.json` 中添加包子路径导出

#### 5. 测试 (`test/`)

创建或更新测试文件以覆盖新提供商：

- `stream.test.ts` - 基本流式与工具使用
- `tokens.test.ts` - token 用量上报
- `abort.test.ts` - 请求取消
- `empty.test.ts` - 空消息处理
- `context-overflow.test.ts` - 上下文上限错误
- `image-limits.test.ts` - 图像支持（如适用）
- `unicode-surrogate.test.ts` - Unicode 处理
- `tool-call-without-result.test.ts` - 孤立工具调用
- `image-tool-result.test.ts` - 工具结果中的图像
- `total-tokens.test.ts` - token 计数准确性
- `cross-provider-handoff.test.ts` - 跨提供商上下文回放
- `providers.test.ts` - 提供商列表与认证解析

对于 `cross-provider-handoff.test.ts`，至少添加一个提供商/模型对。如果提供商暴露多个模型族（例如 GPT 和 Claude），每个族至少添加一对。

对于非标准认证的提供商（AWS、Google Vertex），创建一个类似 `bedrock-utils.ts` 的工具，包含凭据检测辅助函数。

#### 6. Coding Agent 集成 (`../coding-agent/`)

更新 `src/core/model-resolver.ts`：

- 在 `DEFAULT_MODELS` 中为该提供商添加默认模型 ID

更新 `src/cli/args.ts`：

- 在帮助文本中添加环境变量文档

更新 `README.md`：

- 在提供商部分添加该提供商及其安装说明

#### 7. 文档

更新 `packages/ai/README.md`：

- 添加到支持的提供商表格
- 记录任何提供商特定的选项或认证要求
- 在环境变量部分添加环境变量

#### 8. 变更日志

在 `packages/ai/CHANGELOG.md` 的 `## [Unreleased]` 下添加条目：

```markdown
### Added
- Added support for [Provider Name] provider ([#PR](link) by [@author](link))
```

## 许可证

MIT
