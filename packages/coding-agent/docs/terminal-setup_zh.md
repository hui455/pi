# 终端设置

Pi 使用 [Kitty 键盘协议](https://sw.kovidgoyal.net/kitty/keyboard-protocol/)来可靠地检测修饰键。大多数现代终端都支持该协议，但部分终端需要额外配置。

## Kitty

开箱即用。

## iTerm2

### 普通 TUI 模式

开箱即用。

### 全屏 TUI 模式

Pi 拥有视口控制权，因此 iTerm2 会发送鼠标滚轮事件而不是滚动其原生的回滚缓冲。在 iTerm2 默认的快速触控板行为下，这些事件会丢失大部分加速滚轮增量，导致全屏模式下的滚动比普通滚动慢得多。

如果在全屏模式下快速滚动鼠标滚轮每次只移动约一行：

1. 打开 **iTerm2 → Settings → Advanced**。
2. 搜索 **Trackpad scrolls fast?** 并将其设置为 **No**。

这是 iTerm2 全局的变通方案，可能也会改变原生的触控板滚动行为。底层行为跟踪见 [iTerm2 issue 9619](https://gitlab.com/gnachman/iterm2/-/work_items/9619)。

## Apple Terminal

Pi 在可用时会启用增强按键上报。如果 Terminal.app 仍将 `Shift+Enter` 发送为普通 Return，pi 会使用本地 macOS 修饰键回退方案，将该 Return 视为 `Shift+Enter`。

该回退方案仅当 pi 与 Terminal.app 运行在同一台 Mac 上时才有效。无法通过远程 SSH 检测本地键盘。

## Ghostty

在 Ghostty 配置中添加（macOS 为 `~/Library/Application Support/com.mitchellh.ghostty/config`，Linux 为 `~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

较旧的 Claude Code 版本可能添加过这个 Ghostty 映射：

```
keybind = shift+enter=text:\n
```

该映射会发送一个原始换行字节。在 pi 内部，这与 `Ctrl+J` 无法区分，因此 tmux 和 pi 不再能看到真正的 `shift+enter` 按键事件。

如果 Claude Code 2.x 或更新版本是你添加该映射的唯一原因，可以移除它，除非你想在 tmux 中使用 Claude Code（那里仍然需要这个 Ghostty 映射）。

Pi 将 `Ctrl+J` 绑定为默认的换行别名，因此通过这个重新映射，`Shift+Enter` 无需额外的 pi 配置即可在 tmux 中正常工作。

### 全屏 TUI 模式

在全屏模式下，链接仍然可点击，但 pi 捕获鼠标输入时 Ghostty 不显示悬停下划线或左下角的 URL 预览。在 macOS 上按住 `Shift+Command`，或在 Linux 上按住 `Shift+Ctrl`，可使用 Ghostty 原生的链接处理。

## WezTerm

WezTerm 通常通过 xterm modifyOtherKeys 开箱即用地支持 `Shift+Enter`。要显式使用 Kitty 键盘协议，创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

在 macOS 上，WezTerm 默认将 `Option+Enter` 绑定为全屏。要使用 `Option+Enter` 进行 pi 的后续任务排队，添加此按键覆盖：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

如果你已有 `config.keys` 表，将条目添加到其中。

在 WSL 上，WezTerm 可能需要可见的硬件光标来定位输入法候选窗口。如果 CJK 输入法候选不跟随文本光标，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`，或在设置中将 `showHardwareCursor` 设为 `true`。

## Alacritty

Alacritty 通常开箱即用地支持 `Shift+Enter`。在 macOS 上，`Option+Enter` 可能作为普通 `Enter` 到达。要使用 `Option+Enter` 进行 pi 的后续任务排队，在 `~/.config/alacritty/alacritty.toml` 中添加：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

修改配置后重启 Alacritty。

## VS Code（集成终端）

VS Code 1.109.5 及更新版本默认在集成终端中启用 Kitty 键盘协议，因此 `Shift+Enter` 应开箱即用。

早于 1.109.5 的 VS Code 版本需要为 `Shift+Enter` 显式添加终端按键绑定。

`keybindings.json` 位置：
- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

在 `keybindings.json` 中添加：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Windows Terminal

在 `settings.json` 中添加（Ctrl+Shift+, 或 Settings → Open JSON file）以转发 pi 使用的修饰 Enter 键：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    },
    {
      "command": { "action": "sendInput", "input": "\u001b[13;3u" },
      "keys": "alt+enter"
    }
  ]
}
```

- `Shift+Enter` 插入新行。
- Windows Terminal 默认将 `Alt+Enter` 绑定为全屏，这会阻止 pi 接收用于后续任务排队的 `Alt+Enter`。
- 将 `Alt+Enter` 重新映射为 `sendInput` 会把真正的按键组合转发给 pi。

如果你已有 `actions` 数组，将对象添加到其中。如果旧的全屏行为仍然存在，请完全关闭并重新打开 Windows Terminal。

## xfce4-terminal、terminator

这些终端对转义序列的支持有限。`Ctrl+Enter` 和 `Shift+Enter` 等修饰 Enter 键无法与普通 `Enter` 区分，导致 `submit: ["ctrl+enter"]` 等自定义按键绑定无法工作。

为了获得最佳体验，请使用支持 Kitty 键盘协议的终端：
- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty)（需要编译时启用 Kitty 协议支持）

## IntelliJ IDEA（集成终端）

内置终端对转义序列的支持有限。在 IntelliJ 的终端中，Shift+Enter 无法与 Enter 区分。

如果希望硬件光标可见，请在运行 pi 前设置 `PI_HARDWARE_CURSOR=1`（出于兼容性考虑默认关闭）。

为获得最佳体验，建议使用专门的终端模拟器。
