use crate::config::{General, PopupPosition, ReminderType, RuleMode};
use crate::platform::{self, WorkArea};
use crate::state::{AppState, ToastItem, ToastPayload, ToastSource};
use chrono::{Duration, Local};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

fn payload_from(
    rule: &ReminderType,
    general: &General,
    preview: bool,
    id: String,
) -> ToastPayload {
    ToastPayload {
        id,
        type_id: rule.id.clone(),
        name: if rule.name.trim().is_empty() {
            "提醒".to_string()
        } else {
            rule.name.clone()
        },
        message: if rule.message.trim().is_empty() {
            "该休息一下啦。".to_string()
        } else {
            rule.message.clone()
        },
        accent: if crate::config::valid_accent(&rule.accent) {
            rule.accent.clone()
        } else {
            "#38BDF8".to_string()
        },
        snooze_min: rule.snooze_min.clamp(1, 120),
        duration_sec: rule.popup_sec.clamp(3, 60),
        theme: general.theme,
        preview,
    }
}

pub fn enqueue_type(app: &AppHandle, state: &Arc<AppState>, type_id: &str, source: ToastSource) {
    let (payload, general_sound) = {
        let config = state.config.lock().unwrap();
        let Some(rule) = config.types.iter().find(|t| t.id == type_id) else {
            return;
        };
        (
            payload_from(
                rule,
                &config.general,
                source == ToastSource::Preview,
                state.next_toast_id(),
            ),
            config.general.sound,
        )
    };
    enqueue(app, state, ToastItem { payload, source }, general_sound);
}

pub fn enqueue_preview(
    app: &AppHandle,
    state: &Arc<AppState>,
    rule: ReminderType,
    theme: crate::config::Theme,
) {
    let general = General {
        theme,
        ..General::default()
    };
    let payload = payload_from(&rule, &general, true, state.next_toast_id());
    enqueue(
        app,
        state,
        ToastItem {
            payload,
            source: ToastSource::Preview,
        },
        false,
    );
}

fn enqueue(app: &AppHandle, state: &Arc<AppState>, item: ToastItem, sound: bool) {
    {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.queue.push_back(item);
    }
    if sound {
        if let Err(err) = app.run_on_main_thread(platform::beep) {
            log::warn!("beep failed: {err}");
        }
    }
    pump(app, state);
}

pub fn pump(app: &AppHandle, state: &Arc<AppState>) {
    let app = app.clone();
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        pump_now(&app, &state);
    });
}

fn pump_now(app: &AppHandle, state: &Arc<AppState>) {
    let item = {
        let mut runtime = state.runtime.lock().unwrap();
        if !runtime.toast_ready || runtime.active.is_some() {
            return;
        }
        match runtime.queue.pop_front() {
            Some(item) => {
                runtime.active = Some(item.clone());
                item
            }
            None => return,
        }
    };

    let Some(window) = app.get_webview_window("toast") else {
        log::warn!("toast window not found");
        return;
    };

    position_toast(app, state, &window);

    if let Err(err) = platform::show_without_activating(&window) {
        log::warn!("show toast failed: {err}");
    }
    if let Err(err) = app.emit("toast:show", &item.payload) {
        log::warn!("emit toast failed: {err}");
    }

    let app_handle = app.clone();
    let state_handle = state.clone();
    let id = item.payload.id.clone();
    let timeout = item.payload.duration_sec as u64 + 120;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(timeout)).await;
        finish(&app_handle, &state_handle, &id, "timeout");
    });
}

fn position_toast(app: &AppHandle, state: &Arc<AppState>, window: &tauri::WebviewWindow) {
    let work = platform::primary_work_area(app).or_else(|| {
        app.primary_monitor().ok().flatten().map(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            WorkArea {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            }
        })
    });
    let Some(work) = work else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let margin = (12.0 * scale) as i32;
    let right_margin = (16.0 * scale) as i32;
    let position = state.config.lock().unwrap().general.position;

    let max_x = work.x + work.width as i32 - size.width as i32;
    let x = match position {
        PopupPosition::TopCenter => {
            work.x + ((work.width as i32 - size.width as i32) / 2).max(0)
        }
        PopupPosition::TopRight => max_x - right_margin,
    }
    .clamp(work.x, max_x.max(work.x));
    let y = (work.y + margin)
        .min(work.y + work.height as i32 - size.height as i32)
        .max(work.y);

    if let Err(err) = window.set_position(PhysicalPosition::new(x, y)) {
        log::warn!("position toast failed: {err}");
    }
}

pub fn finish(app: &AppHandle, state: &Arc<AppState>, id: &str, action: &str) {
    let app = app.clone();
    let state = state.clone();
    let id = id.to_string();
    let action = action.to_string();
    tauri::async_runtime::spawn(async move {
        finish_now(&app, &state, &id, &action);
    });
}

fn finish_now(app: &AppHandle, state: &Arc<AppState>, id: &str, action: &str) {
    let item = {
        let mut runtime = state.runtime.lock().unwrap();
        match runtime.active.as_ref() {
            Some(item) if item.payload.id == id => runtime.active.take(),
            _ => None,
        }
    };
    let Some(item) = item else {
        return;
    };

    if action == "snooze" && !item.payload.preview {
        let now = Local::now();
        let mut runtime = state.runtime.lock().unwrap();
        runtime.next_due.insert(
            item.payload.type_id.clone(),
            now + Duration::minutes(item.payload.snooze_min as i64),
        );
        log::info!(
            "snooze {} for {} min",
            item.payload.type_id,
            item.payload.snooze_min
        );
    }

    if let Some(window) = app.get_webview_window("toast") {
        if let Err(err) = platform::hide_toast(&window) {
            log::warn!("hide toast failed: {err}");
        }
    }
    if action != "snooze" && item.source == ToastSource::Scheduled {
        delete_one_shot_if_needed(app, state, &item.payload.type_id);
    }
    crate::actions::broadcast_status(app);

    let app_handle = app.clone();
    let state_handle = state.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(180)).await;
        pump(&app_handle, &state_handle);
    });
}

/// 单次提醒关闭后按配置删除；只有调度器触发的提醒才动配置，预览和手动提醒不受影响。
fn delete_one_shot_if_needed(app: &AppHandle, state: &Arc<AppState>, type_id: &str) {
    let next = {
        let config = state.config.lock().unwrap();
        let Some(rule) = config.types.iter().find(|rule| rule.id == type_id) else {
            return;
        };
        if rule.mode != RuleMode::Once || !rule.delete_after {
            return;
        }
        let mut next = config.clone();
        next.types.retain(|rule| rule.id != type_id);
        next
    };

    match crate::actions::save_config_core(app, next, false) {
        Ok(_) => {
            let _ = app.emit("reminder:deleted", type_id);
            log::info!("one-shot reminder {type_id} deleted after closing");
        }
        Err(err) => log::error!("delete one-shot reminder failed: {err}"),
    }
}

pub fn clear_all(app: &AppHandle, state: &Arc<AppState>) {
    let app = app.clone();
    let state = state.clone();
    tauri::async_runtime::spawn(async move {
        clear_all_now(&app, &state);
    });
}

fn clear_all_now(app: &AppHandle, state: &Arc<AppState>) {
    let had_active = {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.queue.clear();
        runtime.active.take().is_some()
    };
    if had_active {
        if let Some(window) = app.get_webview_window("toast") {
            let _ = platform::hide_toast(&window);
        }
    }
}
