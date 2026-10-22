mod actions;
mod config;
mod platform;
mod schedule;
mod scheduler;
mod state;
mod toast;
mod tray;

use crate::state::{AppState, Snapshot, ToastSource};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[tauri::command]
fn get_snapshot(state: State<'_, Arc<AppState>>) -> Snapshot {
    state.snapshot()
}

#[tauri::command]
fn save_config(
    app: tauri::AppHandle,
    config: config::Config,
) -> Result<config::Config, String> {
    actions::save_config_core(&app, config, false)
}

#[tauri::command]
fn preview_toast(
    app: tauri::AppHandle,
    rule: config::ReminderType,
    theme: config::Theme,
) {
    let state = actions::state(&app);
    toast::enqueue_preview(&app, &state, rule, theme);
}

#[tauri::command]
fn toast_action(app: tauri::AppHandle, id: String, action: String) {
    let state = actions::state(&app);
    toast::finish(&app, &state, &id, &action);
}

#[tauri::command]
fn toast_ready(app: tauri::AppHandle) {
    actions::toast_ready(&app);
}

#[tauri::command]
fn frontend_ready(app: tauri::AppHandle) {
    actions::frontend_ready(&app);
}

#[tauri::command]
fn pause(app: tauri::AppHandle, minutes: Option<u32>) {
    match minutes {
        Some(minutes) => actions::pause_for(&app, minutes as i64),
        None => actions::resume(&app),
    }
}

#[tauri::command]
fn pause_today(app: tauri::AppHandle) {
    actions::pause_until_end_of_day(&app);
}

#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    actions::set_autostart_enabled(&app, enabled)
}

#[tauri::command]
fn open_settings(app: tauri::AppHandle) {
    actions::show_settings(&app);
}

#[tauri::command]
fn open_config_dir(app: tauri::AppHandle) -> Result<(), String> {
    actions::open_config_dir(&app)
}

fn position_settings_window(app: &tauri::AppHandle) {
    use tauri::{Manager, PhysicalPosition};

    let Some(window) = app.get_webview_window("settings") else {
        return;
    };
    let Some(work) = platform::primary_work_area(app) else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let x = work.x + ((work.width as i32 - size.width as i32) / 2).max(0);
    let centered = work.y + ((work.height as i32 - size.height as i32) / 2).max(0);
    let clear_of_toast = work.y + (204.0 * scale) as i32;
    let max_y = work.y + work.height as i32 - size.height as i32;
    let y = clear_of_toast.max(centered).min(max_y).max(work.y);
    if let Err(err) = window.set_position(PhysicalPosition::new(x, y)) {
        log::warn!("position settings failed: {err}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                // 不要在单实例的同步窗口消息里直接操作窗口，先让主线程回到消息循环。
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                let demo = argv.iter().any(|arg| arg == "--demo");
                if !demo {
                    actions::show_settings(&app);
                }
                if demo {
                    let state = actions::state(&app);
                    if let Some(id) = state
                        .config
                        .lock()
                        .unwrap()
                        .types
                        .first()
                        .map(|rule| rule.id.clone())
                    {
                        toast::enqueue_type(&app, &state, &id, ToastSource::Preview);
                    }
                }
            });
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("app".to_string()),
                    },
                ))
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .max_file_size(1_000_000)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            save_config,
            preview_toast,
            toast_action,
            toast_ready,
            frontend_ready,
            pause,
            pause_today,
            set_autostart,
            open_settings,
            open_config_dir
        ])
        .setup(|app| {
            let config_dir = app.path().config_dir()?.join("DeskReminder");
            let config_path = config_dir.join("config.json");
            let mut outcome = config::load_or_default(&config_path);

            let actual_autostart = app.autolaunch().is_enabled().unwrap_or(false);
            if outcome.config.general.auto_start != actual_autostart {
                log::info!(
                    "autostart state differs (config={}, actual={}); using actual",
                    outcome.config.general.auto_start,
                    actual_autostart
                );
                outcome.config.general.auto_start = actual_autostart;
            }

            if outcome.created {
                if let Err(err) = config::save_atomic(&config_path, &outcome.config) {
                    log::error!("save default config failed: {err}");
                }
            }
            if let Some(warning) = &outcome.warning {
                log::warn!("{warning}");
            }

            let state = Arc::new(AppState::new(
                outcome.config,
                config_path,
                outcome.created,
                actual_autostart,
            ));
            app.manage(state.clone());

            let toast_builder = tauri::WebviewWindowBuilder::new(
                app.handle(),
                "toast",
                tauri::WebviewUrl::App("index.html#/toast".into()),
            )
            .title("桌面提醒")
            .inner_size(436.0, 176.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .shadow(false)
            .visible(false)
            .focused(false);
            #[cfg(target_os = "macos")]
            let toast_builder = toast_builder.visible_on_all_workspaces(true);
            let toast = toast_builder.build()?;
            platform::prepare_toast_window(&toast)?;

            position_settings_window(app.handle());
            actions::apply_window_theme(app.handle(), state.config.lock().unwrap().general.theme);
            tray::create(app.handle())?;
            scheduler::start(app.handle().clone(), state.clone());

            let args: Vec<String> = std::env::args().collect();
            if outcome.created
                || outcome.warning.is_some()
                || args.iter().any(|arg| arg == "--settings")
            {
                state.pending_show_settings.store(true, Ordering::Relaxed);
            }

            actions::schedule_settings_fallback(app.handle().clone());

            if args.iter().any(|arg| arg == "--demo") {
                let type_id = state
                    .config
                    .lock()
                    .unwrap()
                    .types
                    .first()
                    .map(|rule| rule.id.clone());
                if let Some(type_id) = type_id {
                    toast::enqueue_type(app.handle(), &state, &type_id, ToastSource::Preview);
                }
            }

            actions::broadcast_status(app.handle());

            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            actions::handle_window_event(window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running DeskReminder");
}
