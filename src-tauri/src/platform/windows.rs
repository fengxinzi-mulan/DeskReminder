use super::WorkArea;
use std::ffi::c_void;
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use tauri::WebviewWindow;

type Hwnd = *mut c_void;
type Hdesk = *mut c_void;

#[repr(C)]
struct LastInputInfo {
    cb_size: u32,
    dw_time: u32,
}

#[repr(C)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

#[link(name = "user32")]
unsafe extern "system" {
    fn OpenInputDesktop(flags: u32, inherit: i32, desired_access: u32) -> Hdesk;
    fn CloseDesktop(desktop: Hdesk) -> i32;
    fn GetLastInputInfo(info: *mut LastInputInfo) -> i32;
    fn ShowWindow(hwnd: Hwnd, cmd: i32) -> i32;
    fn SetWindowPos(
        hwnd: Hwnd,
        insert_after: Hwnd,
        x: i32,
        y: i32,
        cx: i32,
        cy: i32,
        flags: u32,
    ) -> i32;
    fn MessageBeep(beep_type: u32) -> i32;
    fn SystemParametersInfoW(action: u32, param: u32, data: *mut c_void, win_ini: u32) -> i32;
    fn GetWindowLongW(hwnd: Hwnd, index: i32) -> i32;
    fn SetWindowLongW(hwnd: Hwnd, index: i32, value: i32) -> i32;
    fn SetWindowRgn(hwnd: Hwnd, region: *mut c_void, redraw: i32) -> i32;
}

#[link(name = "gdi32")]
unsafe extern "system" {
    fn CreateRoundRectRgn(
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
        width: i32,
        height: i32,
    ) -> *mut c_void;
}

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetTickCount64() -> u64;
}

const DESKTOP_READOBJECTS: u32 = 0x0001;
const DESKTOP_SWITCHDESKTOP: u32 = 0x0100;
const SW_HIDE: i32 = 0;
const SW_SHOWNOACTIVATE: i32 = 4;
const HWND_TOPMOST: Hwnd = -1isize as Hwnd;
const SWP_NOSIZE: u32 = 0x0001;
const SWP_NOMOVE: u32 = 0x0002;
const SWP_NOACTIVATE: u32 = 0x0010;
const SWP_SHOWWINDOW: u32 = 0x0040;
const SPI_GETWORKAREA: u32 = 0x0030;
const MB_ICONASTERISK: u32 = 0x0000_0040;
const GWL_STYLE: i32 = -16;
const GWL_EXSTYLE: i32 = -20;
const WS_CAPTION: i32 = 0x00C0_0000;
const WS_THICKFRAME: i32 = 0x0004_0000;
const WS_MINIMIZEBOX: i32 = 0x0002_0000;
const WS_MAXIMIZEBOX: i32 = 0x0001_0000;
const WS_SYSMENU: i32 = 0x0008_0000;
const WS_POPUP: i32 = 0x8000_0000u32 as i32;
const WS_EX_TOOLWINDOW: i32 = 0x0000_0080;
const WS_EX_APPWINDOW: i32 = 0x0004_0000;
const SWP_FRAMECHANGED: u32 = 0x0020;

pub fn is_locked() -> bool {
    unsafe {
        let desktop = OpenInputDesktop(
            0,
            0,
            DESKTOP_READOBJECTS | DESKTOP_SWITCHDESKTOP,
        );
        if desktop.is_null() {
            true
        } else {
            CloseDesktop(desktop);
            false
        }
    }
}

pub fn idle_seconds() -> Option<u64> {
    unsafe {
        let mut info = LastInputInfo {
            cb_size: std::mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        if GetLastInputInfo(&mut info) == 0 {
            return None;
        }
        // dwTime 是 32 位 tick，按 32 位回绕计算。
        let elapsed = (GetTickCount64() as u32).wrapping_sub(info.dw_time);
        Some((elapsed / 1000) as u64)
    }
}

pub fn beep() {
    unsafe {
        MessageBeep(MB_ICONASTERISK);
    }
}

pub fn primary_work_area(_app: &tauri::AppHandle) -> Option<WorkArea> {
    unsafe {
        let mut rect = Rect {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        if SystemParametersInfoW(
            SPI_GETWORKAREA,
            0,
            &mut rect as *mut Rect as *mut c_void,
            0,
        ) == 0
        {
            return None;
        }
        Some(WorkArea {
            x: rect.left,
            y: rect.top,
            width: (rect.right - rect.left).max(1) as u32,
            height: (rect.bottom - rect.top).max(1) as u32,
        })
    }
}

/// Tauri 2.12 在 Windows 上仍会给 `decorations(false)` 的透明窗口加原生标题栏。
/// 这里直接改 Win32 样式，并用圆角区域把窗口裁成卡片形状，避免依赖透明背景。
pub fn prepare_toast_window(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;

    unsafe {
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        let style = (style
            & !(WS_CAPTION | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU))
            | WS_POPUP;
        SetWindowLongW(hwnd, GWL_STYLE, style);

        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        SetWindowLongW(
            hwnd,
            GWL_EXSTYLE,
            (ex_style | WS_EX_TOOLWINDOW) & !WS_EX_APPWINDOW,
        );

        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        );
    }

    // 去掉非客户区后恢复设计尺寸，再按卡片的 8px 外边距和 18px 圆角裁剪窗口。
    window
        .set_size(tauri::LogicalSize::new(436.0, 176.0))
        .map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let inset = (8.0 * scale).round() as i32;
    let radius = (18.0 * scale).round() as i32;
    let right = (size.width as i32 - inset).max(inset + 1);
    let bottom = (size.height as i32 - inset).max(inset + 1);

    unsafe {
        let region = CreateRoundRectRgn(inset, inset, right, bottom, radius * 2, radius * 2);
        if region.is_null() {
            return Err("创建圆角窗口区域失败".to_string());
        }
        if SetWindowRgn(hwnd, region, 1) == 0 {
            return Err("设置圆角窗口区域失败".to_string());
        }
    }
    Ok(())
}

/// 显式隐藏并把窗口移出屏幕，避免 Tauri 与原生显示状态不同步时留下顶部残影。
pub fn hide_toast(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
    unsafe {
        ShowWindow(hwnd, SW_HIDE);
        SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            -10000,
            -10000,
            0,
            0,
            SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
    Ok(())
}

pub fn show_without_activating(window: &WebviewWindow) -> Result<(), String> {
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let raw: Hwnd = hwnd.0;
    unsafe {
        ShowWindow(raw, SW_SHOWNOACTIVATE);
        SetWindowPos(
            raw,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
        );
    }
    Ok(())
}

pub fn open_path(path: &Path) -> Result<(), String> {
    let mut command = Command::new("explorer.exe");
    command.arg(path);
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("打开目录失败：{e}"))
}
