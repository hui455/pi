# 提供商

Pi 通过 OAuth 支持订阅型提供商，通过环境变量或认证文件支持 API key 型提供商。内置目录随 pi 一起发布；配置的提供商可以刷新更新的目录并将其缓存到 `~/.pi/agent/models-store.json` 以供离线使用。

## 目录

- [订阅](#subscriptions)
- [API Keys](#api-keys)
- [认证文件](#auth-file)
- [云提供商](#cloud-providers)
- [llama.cpp](#llamacpp)
- [自定义提供商](#custom-providers)
- [解析顺序](#resolution-order)

## 订阅

在交互模式中使用 `/login`，然后选择提供商：

- ChatGPT Plus/Pro（Codex）
- Claude Pro/Max
- GitHub Copilot
- xAI（Grok/X 订阅）
- OpenRouter（OAuth 铸造的 API key，从 OpenRouter 余额扣费）
- Radius

使用 `/logout` 清除凭据。token 存储在 `~/.pi/agent/auth.json` 中，过期时自动刷新。OpenRouter 则铸造一把用户可控的 API key，不会自动过期。

### OpenAI Codex

- 需要 ChatGPT Plus 或 Pro 订阅
- 由 OpenAI 官方认可：[Codex for OSS](https://developers.openai.com/community/codex-for-oss)

### Claude Pro/Max

Anthropic 订阅认证对 Claude Pro/Max 账户有效。第三方 harness 使用会消耗[额外用量](https://claude.ai/settings/usage)，并按 token 计费，不占用 Claude 套餐额度。

### GitHub Copilot

- 按 Enter 使用 github.com，或输入你的 GitHub Enterprise Server 域名
- 如果提示 "model not supported"，请在 VS Code 中启用：Copilot Chat → 模型选择器 → 选择模型 → "Enable"

### xAI（Grok/X 订阅）

- 运行 `/login xai`，然后选择 **Use a subscription**
- `XAI_API_KEY` 仍可通过 **Use an API key** 使用

### OpenRouter

- 运行 `/login openrouter`，然后选择 **Sign in with OpenRouter** 打开 OpenRouter PKCE 授权流程
- 授权会创建一把用户可控的 OpenRouter API key，从你的 OpenRouter 余额扣费
- 在远程/无头机器上（如通过 SSH），浏览器无法访问回环回调；请将最终的跳转 URL（或授权码）粘贴到登录提示中
- `OPENROUTER_API_KEY` 仍可通过 **Use an API key** 使用

### Radius

Radius 是动态的 `pi-messages` 网关。`/login radius` 将 OAuth token 存储在 `auth.json` 中；网关目录独立刷新并缓存在 `models-store.json` 中。自定义 Radius 网关可以在 `models.json` 中声明，使用 `"oauth": "radius"` 并指定网关 `baseUrl`。

## API Keys

### 环境变量或认证文件

在交互模式中使用 `/login` 并选择提供商，可将 API key 存储在 `auth.json` 中，或通过环境变量设置凭据：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| 提供商 | 环境变量 | `auth.json` key |
|----------|----------------------|------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic` |
| Ant Ling | `ANT_LING_API_KEY` | `ant-ling` |
| Azure OpenAI Responses | `AZURE_OPENAI_API_KEY` | `azure-openai-responses` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek` |
| NVIDIA NIM | `NVIDIA_API_KEY` | `nvidia` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| Amazon Bedrock | `AWS_BEARER_TOKEN_BEDROCK` | `amazon-bedrock` |
| Mistral | `MISTRAL_API_KEY` | `mistral` |
| Groq | `GROQ_API_KEY` | `groq` |
| Cerebras | `CEREBRAS_API_KEY` | `cerebras` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY`（+ `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_GATEWAY_ID`） | `cloudflare-ai-gateway` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY`（+ `CLOUDFLARE_ACCOUNT_ID`） | `cloudflare-workers-ai` |
| xAI | `XAI_API_KEY` | `xai` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| ZAI Coding Plan（全球） | `ZAI_API_KEY` | `zai` |
| ZAI Coding Plan（中国） | `ZAI_CODING_CN_API_KEY` | `zai-coding-cn` |
| OpenCode Zen | `OPENCODE_API_KEY` | `opencode` |
| OpenCode Go | `OPENCODE_API_KEY` | `opencode-go` |
| Radius | `RADIUS_API_KEY` | `radius` |
| Hugging Face | `HF_TOKEN` | `huggingface` |
| Fireworks | `FIREWORKS_API_KEY` | `fireworks` |
| Together AI | `TOGETHER_API_KEY` | `together` |
| Baseten | `BASETEN_API_KEY` | `baseten` |
| Kimi For Coding | `KIMI_API_KEY` | `kimi-coding` |
| MiniMax | `MINIMAX_API_KEY` | `minimax` |
| MiniMax（中国） | `MINIMAX_CN_API_KEY` | `minimax-cn` |
| Qwen Token Plan（现有目录） | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan` |
| Qwen Token Plan（个人版） | `QWEN_TOKEN_PLAN_API_KEY` | `qwen-token-plan-individual` |
| Qwen Token Plan（中国） | `QWEN_TOKEN_PLAN_CN_API_KEY` | `qwen-token-plan-cn` |
| Xiaomi MiMo | `XIAOMI_API_KEY` | `xiaomi` |
| Xiaomi MiMo Token Plan（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` | `xiaomi-token-plan-cn` |
| Xiaomi MiMo Token Plan（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` | `xiaomi-token-plan-ams` |
| Xiaomi MiMo Token Plan（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` | `xiaomi-token-plan-sgp` |

环境变量和 `auth.json` key 的参考： [`packages/ai/src/env-api-keys.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/env-api-keys.ts) 中的 [`const envMap`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/env-api-keys.ts)。

#### 认证文件

将凭据存储在 `~/.pi/agent/auth.json`：

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "ant-ling": { "type": "api_key", "key": "..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "deepseek": { "type": "api_key", "key": "sk-..." },
  "nvidia": { "type": "api_key", "key": "nvapi-..." },
  "google": { "type": "api_key", "key": "..." },
  "opencode": { "type": "api_key", "key": "..." },
  "opencode-go": { "type": "api_key", "key": "..." },
  "together": { "type": "api_key", "key": "..." },
  "qwen-token-plan":  { "type": "api_key", "key": "sk-sp-..." },
  "qwen-token-plan-individual": { "type": "api_key", "key": "sk-sp-..." },
  "qwen-token-plan-cn": { "type": "api_key", "key": "sk-sp-..." },
  "xiaomi": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-cn":  { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-ams": { "type": "api_key", "key": "..." },
  "xiaomi-token-plan-sgp": { "type": "api_key", "key": "..." }
}
```

`qwen-token-plan-individual` 使用与 `qwen-token-plan` 相同的国际端点及 `QWEN_TOKEN_PLAN_API_KEY`，但将选择器限制为个人版订阅所记录的模型。现有提供商为了向后兼容保留更宽的目录。使用 `auth.json` 时，请在你选择的提供商名下存储凭据；环境变量则由两个国际提供商共享。

该文件以 `0600` 权限创建（仅用户可读/写）。认证文件凭据优先于环境变量。

API key 凭据还可以包含提供商作用域的环境值。在解析凭据 key、提供商/模型请求头以及提供商配置（如 Cloudflare 账户 ID、Azure OpenAI 设置、Vertex 项目/区域、Bedrock 设置、`PI_CACHE_RETENTION` 和 `HTTP_PROXY`/`HTTPS_PROXY`）时，这些值先于进程环境变量使用。

```json
{
  "cloudflare-ai-gateway": {
    "type": "api_key",
    "key": "$CLOUDFLARE_API_KEY",
    "env": {
      "CLOUDFLARE_API_KEY": "...",
      "CLOUDFLARE_ACCOUNT_ID": "account-id",
      "CLOUDFLARE_GATEWAY_ID": "gateway-id"
    }
  }
}
```

当 pi 应使用与项目 shell 环境不同的提供商设置时，请使用这种方式。

### Key 解析

`key` 字段支持命令执行、环境变量插值和字面量：

- **Shell 命令：** 开头的 `"!command"` 将整个值作为命令执行，并使用其 stdout（进程生命周期内缓存）
  ```json
  { "type": "api_key", "key": "!security find-generic-password -ws 'anthropic'" }
  { "type": "api_key", "key": "!op read 'op://vault/item/credential'" }
  ```
- **环境变量插值：** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 使用命名变量的值。插值也可用于更大的字面量内部。
  ```json
  { "type": "api_key", "key": "$MY_ANTHROPIC_KEY" }
  { "type": "api_key", "key": "${KEY_PREFIX}_${KEY_SUFFIX}" }
  ```
  `$FOO_BAR` 是变量 `FOO_BAR`；当 `BAR` 是字面文本时使用 `${FOO}_BAR`。缺失的环境变量会使该值无法解析。
- **转义：** `"$$"` 输出字面量 `"$"`；`"$!"` 输出字面量 `"!"`，不会触发命令执行。
  ```json
  { "type": "api_key", "key": "$$literal-dollar-prefix" }
  { "type": "api_key", "key": "$!literal-bang-prefix" }
  ```
- **字面量值：** 直接使用。`MY_API_KEY` 这样的纯大写字符串是字面量；环境变量请使用 `$MY_API_KEY`。
  ```json
  { "type": "api_key", "key": "sk-ant-..." }
  { "type": "api_key", "key": "public" }
  ```

OAuth 凭据在 `/login` 后也会存储在这里，并自动管理。

## 云提供商

### Azure OpenAI

```bash
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_BASE_URL=https://your-resource.ai.azure.com
# also supported: https://your-resource.cognitiveservices.azure.com
# also supported: https://your-resource.openai.azure.com
# root endpoints are auto-normalized to /openai/v1
# or use resource name instead of base URL
export AZURE_OPENAI_RESOURCE_NAME=your-resource

# Optional
export AZURE_OPENAI_API_VERSION=2024-02-01
export AZURE_OPENAI_DEPLOYMENT_NAME_MAP=gpt-4=my-gpt4,gpt-4o=my-gpt4o
```

### Amazon Bedrock

使用 `/login amazon-bedrock` 存储 Bedrock API key，或配置以下任一 AWS 环境凭据来源：

```bash
# Option 1: AWS Profile
export AWS_PROFILE=your-profile

# Option 2: IAM Keys
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...

# Option 3: Bearer Token
export AWS_BEARER_TOKEN_BEDROCK=...

# Optional region (defaults to us-east-1)
export AWS_REGION=us-west-2
```

同时支持 ECS 任务角色（`AWS_CONTAINER_CREDENTIALS_*`）和 IRSA（`AWS_WEB_IDENTITY_TOKEN_FILE`）。

```bash
pi --provider amazon-bedrock --model us.anthropic.claude-sonnet-4-20250514-v1:0
```

对于 ID 中包含可识别模型名（基础模型和系统定义的推理配置文件）的 Claude 模型，提示缓存会自动启用。对于应用推理配置文件（其 ARN 不包含模型名），请设置 `AWS_BEDROCK_FORCE_CACHE=1` 以启用缓存点：

```bash
export AWS_BEDROCK_FORCE_CACHE=1
pi --provider amazon-bedrock --model arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123
```

如果你连接的是 Bedrock API 代理，可以使用以下环境变量：

```bash
# Set the URL for the Bedrock proxy (standard AWS SDK env var)
export AWS_ENDPOINT_URL_BEDROCK_RUNTIME=https://my.corp.proxy/bedrock

# Set if your proxy does not require authentication
export AWS_BEDROCK_SKIP_AUTH=1

# Set if your proxy only supports HTTP/1.1
export AWS_BEDROCK_FORCE_HTTP1=1
```

### Cloudflare AI Gateway

`CLOUDFLARE_API_KEY` 可以通过 `/login` 设置。账户 ID 和网关 slug 可以设置为环境变量，也可以放在 `auth.json` 中 API key 凭据的 `env` 对象里。

```bash
export CLOUDFLARE_API_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_GATEWAY_ID=...        # create at dash.cloudflare.com → AI → AI Gateway
pi --provider cloudflare-ai-gateway --model "claude-sonnet-4-5"
```

通过 Cloudflare AI Gateway 路由到 OpenAI、Anthropic 和 Workers AI。Workers AI 使用 Unified API（`/compat`）和带前缀的模型 ID（`workers-ai/@cf/...`）。OpenAI 使用 OpenAI 透传路由（`/openai`），带原生 OpenAI 模型 ID，如 `gpt-5.1`。Anthropic 使用 Anthropic 透传路由（`/anthropic`），带原生 Anthropic 模型 ID，如 `claude-sonnet-4-5`。

AI Gateway 认证使用 `CLOUDFLARE_API_KEY` 作为 `cf-aig-authorization`。上游认证可以是以下之一：

| 模式 | 请求认证 | 上游认证 |
|------|--------------|---------------|
| Workers AI | 仅 Cloudflare token | Cloudflare 原生 |
| 统一计费（Unified billing） | 仅 Cloudflare token | Cloudflare 处理上游认证并从余额扣费 |
| 存储式 BYOK（Stored BYOK） | 仅 Cloudflare token | Cloudflare 注入存储在 AI Gateway 仪表盘中的提供商 key |
| 内联式 BYOK（Inline BYOK） | Cloudflare token 加上游 `Authorization` 请求头 | 请求自身提供上游提供商 key |

常规 pi 使用中，建议采用统一计费或存储式 BYOK。内联式 BYOK 需要为 Cloudflare AI Gateway 提供商配置额外的上游 `Authorization` 请求头，例如通过 `models.json` 的提供商/模型覆盖实现。

### Cloudflare Workers AI

`CLOUDFLARE_API_KEY` 可以通过 `/login` 设置。`CLOUDFLARE_ACCOUNT_ID` 可以设置为环境变量，也可以放在 `auth.json` 中 API key 凭据的 `env` 对象里。

```bash
export CLOUDFLARE_API_KEY=...           # or use /login
export CLOUDFLARE_ACCOUNT_ID=...
pi --provider cloudflare-workers-ai --model "@cf/moonshotai/kimi-k2.6"
```

Pi 会自动设置 `x-session-affinity`，以获得[前缀缓存](https://developers.cloudflare.com/workers-ai/features/prompt-caching/)折扣。

### Google Vertex AI

使用应用默认凭据（Application Default Credentials）：

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

或者将 `GOOGLE_APPLICATION_CREDENTIALS` 设置为服务账户 key 文件。

## llama.cpp

Pi 支持 llama.cpp 路由器服务器。使用 `/login llama.cpp` 配置，使用 `/llama` 管理已加载的模型，使用 `/model` 选择已加载的模型。

服务器设置、模型目录布局、环境变量和命令用法见 [llama.cpp](llama-cpp.md)。

## 自定义提供商

**通过 models.json：** 添加 Ollama、LM Studio、vLLM，或任何支持受支持 API（OpenAI Completions、OpenAI Responses、Anthropic Messages、Google Generative AI）的提供商。见 [models.md](models.md)。

**通过扩展：** 对于需要自定义 API 实现或 OAuth 流程的提供商，请创建扩展。见 [custom-provider.md](custom-provider.md) 和 [examples/extensions/custom-provider-gitlab-duo](../examples/extensions/custom-provider-gitlab-duo/)。

## 解析顺序

为提供商解析凭据时：

1. CLI `--api-key` 标志
2. `auth.json` 条目（API key 或 OAuth token）
3. 环境变量
4. `models.json` 中的自定义提供商 key
