# Darwin 原生预构建

从仓库根目录构建两种 macOS 架构：

```sh
npm --prefix packages/tui run build:native:darwin
```

构建使用 macOS 11.0 作为 arm64 部署目标，macOS 10.15 作为 x86_64 部署目标。在 macOS 上，`build.sh` 通过 `xcrun` 查找 Apple clang 和活动的 macOS SDK。Intel 或 Apple Silicon 主机都可以构建两种输出。

非 macOS 主机需要完整的 Darwin 交叉工具链，包括 macOS SDK 和 Mach-O 链接器。例如，可以通过 `CC` 和 `SDKROOT` 选择 osxcross 安装：

```sh
CC=/path/to/osxcross/clang SDKROOT=/path/to/MacOSX.sdk \
  npm --prefix packages/tui run build:native:darwin
```

SDK 必须按照 Apple 的许可获取和使用。单纯的 Linux 或 Windows clang 是不够的，因为该插件包含并链接 CoreGraphics。

这里不使用 Zig，因为它不提供 Apple SDK 或 CoreGraphics 框架桩。因此它不能让此构建与 SDK 无关，而且它的 clang driver 目前不能作为 Apple clang 的即插即用替代来处理这个 Mach-O bundle 配方。
