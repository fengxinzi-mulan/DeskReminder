use crate::config::{self, Config};
use crate::state::{AppState, Status};
use crate::toast;
use chrono::{DateTime, Duration, Local, Timelike};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

pub fn state(app: &AppHandle) -> Arc<AppState> {
    app.state::<Arc<AppState>>().inner().clone()
}

pub fn apply_window_theme(app: &AppHandle, theme: crate::config::Theme) {
    let target = match theme {
        crate::config::Theme::Light => Some(tauri::Theme::Light),
        crate::config::Theme::Dark => Some(tauri::Theme::Dark),
        crate::config::Theme::System => None,
    };
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.set_theme(target);
    }
}

pub fn show_settings(app: &AppHandle) {
    let state = state(app);
    if !state.settings_ready.load(Ordering::Relaxed) {
        state.pending_show_settings.store(true, Ordering::Relaxed);
        return;
    }
    let Some(window) = app.get_webview_window("settings") else {
        return;
    };
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}

pub fn frontend_ready(app: &AppHandle) {
    let state = state(app);
    log::info!("settings frontend ready");
    state.settings_ready.store(true, Ordering::Relaxed);
    if state
        .pending_show_settings
        .swap(false, Ordering::Relaxed)
    {
        show_settings(app);
    }
}

/// 前端加载失败时也把设置窗口显示出来，避免应用看起来完全没有界面。
pub fn schedule_settings_fallback(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(8)).await;
        let state = state(&app);
        if !state.settings_ready.load(Ordering::Relaxed)
            && state.pending_show_settings.load(Ordering::Relaxed)
        {
            log::warn!("settings frontend did not signal ready; showing anyway");
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}

pub fn toast_ready(app: &AppHandle) {
    log::info!("toast frontend ready");
    let state = state(app);
    {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.toast_ready = true;
    }
    toast::pump(app, &state);
}

pub fn pause_for(app: &AppHandle, minutes: i64) {
    let state = state(app);
    let now = Local::now();
    let minutes = minutes.max(1);
    {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.paused_until = Some(now + Duration::minutes(minutes));
    }
    toast::clear_all(app, &state);
    log::info!("paused for {minutes} minutes");
    broadcast_status(app);
}

pub fn pause_until_end_of_day(app: &AppHandle) {
    let now = Local::now();
    let minutes = ((23 - now.hour() as i64) * 60 + (59 - now.minute() as i64)).max(1);
    pause_for(app, minutes);
}

pub fn resume(app: &AppHandle) {
    let state = state(app);
    let now = Local::now();
    {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.paused_until = None;
    }
    state.reschedule(now);
    log::info!("resumed");
    broadcast_status(app);
}

pub fn set_autostart_enabled(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let state = state(app);
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|e| format!("设置开机自启失败：{e}"))?;
    state.autostart.store(enabled, Ordering::Relaxed);

    let mut config = state.config.lock().unwrap().clone();
    config.general.auto_start = enabled;
    config::save_atomic(&state.config_path, &config)?;
    *state.config.lock().unwrap() = config.clone();
    log::info!("autostart set to {enabled}");

    let _ = app.emit("config:updated", &config);
    let _ = crate::tray::rebuild(app);
    broadcast_status(app);
    Ok(())
}

pub fn save_config_core(
    app: &AppHandle,
    raw: Config,
    broadcast_config: bool,
) -> Result<Config, String> {
    let state = state(app);
    let config = raw.normalize().map_err(|errors| errors.join("\n"))?;

    let current_autostart = state.autostart.load(Ordering::Relaxed);
    if config.general.auto_start != current_autostart {
        set_autostart_enabled(app, config.general.auto_start)?;
    }

    config::save_atomic(&state.config_path, &config)?;
    *state.config.lock().unwrap() = config.clone();
    state.reschedule(Local::now());
    apply_window_theme(app, config.general.theme);

    let _ = crate::tray::rebuild(app);
    if broadcast_config {
        let _ = app.emit("config:updated", &config);
    }
    broadcast_status(app);
    Ok(config)
}

pub fn toggle_autostart(app: &AppHandle) {
    let state = state(app);
    let next = !state.autostart.load(Ordering::Relaxed);
    if let Err(err) = set_autostart_enabled(app, next) {
        log::error!("{err}");
    }
}

pub fn broadcast_status(app: &AppHandle) {
    let state = state(app);
    let status = state.status();
    let text = serde_json::to_string(&status).unwrap_or_default();
    let changed = {
        let mut runtime = state.runtime.lock().unwrap();
        if runtime.last_status_json == text {
            false
        } else {
            runtime.last_status_json = text;
            true
        }
    };
    if changed {
        let _ = app.emit("status:updated", &status);
        let _ = crate::tray::update_tooltip(app, &status);
    }
}

pub fn status_tooltip(status: &Status) -> String {
    if let Some(paused) = &status.paused_until {
        if let Ok(until) = DateTime::parse_from_rfc3339(paused) {
            let local = until.with_timezone(&Local);
            return format!("桌面提醒 · 已暂停至 {}", local.format("%H:%M"));
        }
    }
    if let Some(next) = &status.next_due {
        if let Ok(due) = DateTime::parse_from_rfc3339(next) {
            let local = due.with_timezone(&Local);
            let name = status.next_type.as_deref().unwrap_or("提醒");
            return format!("桌面提醒 · 下次 {} {}", local.format("%H:%M"), name);
        }
    }
    "桌面提醒 · 暂无提醒计划".to_string()
}

pub fn handle_menu_event(app: &AppHandle, id: &str) {
    match id {
        "open" => show_settings(app),
        "pause:30" => pause_for(app, 30),
        "pause:60" => pause_for(app, 60),
        "pause:120" => pause_for(app, 120),
        "pause:today" => pause_until_end_of_day(app),
        "resume" => resume(app),
        "autostart" => toggle_autostart(app),
        "quit" => {
            let state = state(app);
            state.quitting.store(true, Ordering::Relaxed);
            app.exit(0);
        }
        _ if id.starts_with("remind:") => {
            let type_id = id.trim_start_matches("remind:");
            let state = state(app);
            toast::enqueue_type(app, &state, type_id, false);
        }
        _ => {}
    }
}

pub fn open_config_dir(app: &AppHandle) -> Result<(), String> {
    let state = state(app);
    let dir = state
        .config_path
        .parent()
        .ok_or_else(|| "配置目录无效".to_string())?;
    crate::platform::open_path(dir)
}

pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() == "settings" {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}
