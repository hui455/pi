# 容器化

Pi 默认以全部权限运行，但在某些情况下，你会希望对 Pi 可以写入的目录以及它拥有的访问权限进行更多控制。

有两种常规选项。你可以
1. 在隔离环境中运行整个 `pi` 进程，或
2. 在宿主机上运行 `pi`，并将工具执行路由到隔离环境。

## 选择模式

| 模式 | 被隔离的部分 | 最适合 | 说明 |
| --- | --- | --- | --- |
| Gondolin 扩展 | 内置工具和 `!` 命令 | 本地微型虚拟机隔离，同时在宿主机保留认证 | 参见 [`examples/extensions/gondolin/`](../examples/extensions/gondolin/)。 |
| 纯 Docker | 本地容器中的整个 `pi` 进程 | 简单的本地隔离 | 提供商 API 密钥会进入容器。 |
| OpenShell | 策略控制沙箱中的整个 `pi` 进程 | 本地或远程托管沙箱 | 需要 OpenShell 网关 |

扩展在 `pi` 进程所在的位置运行。如果你在宿主机上运行 `pi` 并使用工具路由扩展，其他自定义扩展工具仍然在宿主机上运行，除非它们也委托其操作。

## Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微型虚拟机。
当你希望 `pi` 在宿主机上、但所有内置工具路由到虚拟机中时，使用[示例扩展](../examples/extensions/gondolin)。

设置：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

从你想挂载的项目运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

扩展将宿主机 cwd 挂载到虚拟机中的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls`。
用户的 `!` 命令也会被路由到虚拟机。
`/workspace` 下的文件修改会写穿到宿主机。

要求：`@earendil-works/gondolin` 需要 Node.js >= 23.6.0，另需 QEMU（通过你的包管理器安装）。

## 纯 Docker

当你想要最简单的本地容器边界时，在 Docker 中运行整个 `pi` 进程。

`Dockerfile.pi`：

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

构建并运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

`-v "$PWD:/workspace"` 将你的当前目录挂载到容器中的 /workspace，使得 Docker 内部 `/workspace` 中的读写直接影响你的宿主机文件，与 Gondolin 示例相同。

如果你想要容器本地的设置和会话，为 `/root/.pi/agent` 使用命名卷。挂载宿主机的 `~/.pi/agent` 会将宿主机的认证和会话文件暴露给容器。

## OpenShell

当你想要一个对文件系统、进程、网络、凭据和推理都有策略控制的沙箱时，使用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。
OpenShell 可以通过由 Docker、Podman 或虚拟机运行时支撑的本地网关运行沙箱，也可以通过远程 Kubernetes 网关运行。

每个沙箱都需要一个活动的网关。
在创建沙箱之前注册并选择一个：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

在 OpenShell 沙箱内启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

在这种模式中，整个 `pi` 进程在沙箱内运行。
内置工具、`!` 命令和扩展工具在 OpenShell 边界内执行。

如果网关是远程的，项目文件不会从宿主机绑定挂载，意味着沙箱中的写入不会反映到你的机器上。
在沙箱内克隆仓库，或使用 OpenShell 的文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell 提供商可以将原始模型 API 密钥保持在沙箱之外。
配置推理路由后，沙箱内的代码可以调用 `https://inference.local`，网关会向上游注入已配置的提供商凭据。
如果你希望模型流量走这条路线，请将 Pi 配置为使用相应的 OpenAI 兼容或 Anthropic 兼容端点。
