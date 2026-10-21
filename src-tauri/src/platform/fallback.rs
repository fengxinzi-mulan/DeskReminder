use super::WorkArea;
use std::path::Path;
use tauri::WebviewWindow;

pub fn is_locked() -> bool {
    false
}

pub fn idle_seconds() -> Option<u64> {
    None
}

pub fn beep() {}

pub fn primary_work_area(_app: &tauri::AppHandle) -> Option<WorkArea> {
    None
}

pub fn prepare_toast_window(_window: &WebviewWindow) -> Result<(), String> {
    Ok(())
}

pub fn hide_toast(window: &WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

pub fn show_without_activating(window: &WebviewWindow) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())
}

pub fn open_path(path: &Path) -> Result<(), String> {
    Err(format!("暂不支持打开目录：{}", path.display()))
}
