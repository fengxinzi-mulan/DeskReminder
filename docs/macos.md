# macOS 构建与运行

macOS 版与 Windows 版共用同一套 React + Rust 代码，窗口使用系统 WKWebView，不额外附带浏览器内核。

> 当前项目在 Windows 上开发，macOS 平台代码尚未在 Mac 实机编译验证。下面的命令和平台实现按 Tauri 2 官方能力编写；首次构建如遇编译错误，把日志发回来即可修。

## 前置条件

- macOS 11 或更高版本
- Xcode Command Line Tools
- Rust stable（推荐通过 rustup 安装）
- Node.js 20+
- npm

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
node --version
npm --version
```

## 构建

```bash
cd DeskReminder
npm ci
npm run tauri build
```

或使用脚本：

```bash
chmod +x scripts/build-macos.sh
./scripts/build-macos.sh
```

产物位置：

- `src-tauri/target/release/bundle/macos/DeskReminder.app`
- `src-tauri/target/release/bundle/dmg/DeskReminder.dmg`（如果当前 Tauri 配置启用了 dmg target）

开发模式：

```bash
npm run tauri dev
```

调试参数：

```bash
./src-tauri/target/release/bundle/macos/DeskReminder.app/Contents/MacOS/DeskReminder --settings
./src-tauri/target/release/bundle/macos/DeskReminder.app/Contents/MacOS/DeskReminder --demo
```

## 未签名运行

首次打开未签名的 `.app` 时，macOS 可能提示「无法打开」。可以：

- 在 Finder 中右键应用 →「打开」；
- 或执行：

```bash
xattr -dr com.apple.quarantine /path/to/DeskReminder.app
```

正式分发需要 Apple Developer ID 证书进行签名和公证（notarization）。配置方式见 Tauri 的 macOS 签名文档；本项目未包含证书。

## 平台行为

- 应用作为菜单栏应用运行（`ActivationPolicy::Accessory`），不占 Dock；从菜单栏图标打开设置。
- 顶部提醒窗口无边框、透明、置顶，并设置为在所有 Space 显示；使用 AppKit `orderFrontRegardless` 避免激活应用。
- 锁屏检测：`CGSessionCopyCurrentDictionary` 的 `CGSSessionScreenIsLocked`。
- 空闲检测：`CGEventSourceSecondsSinceLastEventType`（仅在「离开时暂停」开启时使用）。
- 提示音：`NSBeep`。
- 开机自启：`tauri-plugin-autostart` 的 LaunchAgent 模式。
- 顶部位置按主屏尺寸预留 40pt 菜单栏高度。若使用多显示器或自动隐藏菜单栏，可能需要微调 `src-tauri/src/platform/macos.rs` 中的 `primary_work_area`。

## 数据位置

- 配置：`~/Library/Application Support/DeskReminder/config.json`
- 日志：`~/Library/Logs/com.deskreminder.desktop/app.log`

## 常见问题

**`npm run tauri build` 报链接错误**

确认 Rust 是 stable 工具链，并已安装 Xcode Command Line Tools：

```bash
rustup default stable
xcode-select -p
```

**应用没有出现在菜单栏**

- 检查是否被系统「允许在菜单栏显示」设置隐藏；
- 用 `--settings` 启动一次，确认进程是否正常运行；
- 查看 `~/Library/Logs/com.deskreminder.desktop/app.log`。

**提醒没有出现**

- 检查生效星期、时段和当前时间；
- 检查是否处于暂停状态（托盘菜单 / 设置页）；
- 检查屏幕是否锁定；
- 查看日志中的 `scheduler skipping` 原因。
