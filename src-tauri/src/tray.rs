use crate::actions;
use crate::state::{AppState, Status};
use std::sync::Arc;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<Arc<AppState>>().inner().clone();
    let menu = build_menu(app)?;
    let status = state.status();
    let tooltip = actions::status_tooltip(&status);

    #[cfg(target_os = "macos")]
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;

    #[cfg(not(target_os = "macos"))]
    let icon = match app.default_window_icon().cloned() {
        Some(icon) => icon,
        None => tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?,
    };

    let builder = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .tooltip(&tooltip)
        .show_menu_on_left_click(cfg!(target_os = "macos"))
        .on_menu_event(|app, event| {
            actions::handle_menu_event(app, event.id().as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            #[cfg(target_os = "windows")]
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                actions::show_settings(tray.app_handle());
            }
            #[cfg(target_os = "macos")]
            let _ = (tray, event);
        });

    #[cfg(target_os = "macos")]
    let builder = builder.icon_as_template(true);

    builder.build(app)?;
    Ok(())
}

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let state = app.state::<Arc<AppState>>().inner().clone();
    let config = state.config.lock().unwrap().clone();
    let autostart = state
        .autostart
        .load(std::sync::atomic::Ordering::Relaxed);

    let menu = Menu::new(app)?;
    let open = MenuItem::with_id(app, "open", "打开设置", true, None::<&str>)?;
    menu.append(&open)?;

    let remind = Submenu::new(app, "立即提醒", true)?;
    let enabled: Vec<_> = config.types.iter().filter(|t| t.enabled).collect();
    if enabled.is_empty() {
        let empty = MenuItem::with_id(app, "noop", "暂无提醒类型", false, None::<&str>)?;
        remind.append(&empty)?;
    } else {
        for rule in enabled {
            let item = MenuItem::with_id(
                app,
                format!("remind:{}", rule.id),
                &rule.name,
                true,
                None::<&str>,
            )?;
            remind.append(&item)?;
        }
    }
    menu.append(&remind)?;

    let pause = Submenu::new(app, "暂停提醒", true)?;
    for (id, label) in [
        ("pause:30", "暂停 30 分钟"),
        ("pause:60", "暂停 1 小时"),
        ("pause:120", "暂停 2 小时"),
        ("pause:today", "暂停到今天结束"),
    ] {
        let item = MenuItem::with_id(app, id, label, true, None::<&str>)?;
        pause.append(&item)?;
    }
    pause.append(&PredefinedMenuItem::separator(app)?)?;
    let resume = MenuItem::with_id(app, "resume", "恢复提醒", true, None::<&str>)?;
    pause.append(&resume)?;
    menu.append(&pause)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    let autostart_item = CheckMenuItem::with_id(
        app,
        "autostart",
        "开机自启",
        true,
        autostart,
        None::<&str>,
    )?;
    menu.append(&autostart_item)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    menu.append(&quit)?;

    Ok(menu)
}

pub fn rebuild(app: &AppHandle) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main") else {
        return Ok(());
    };
    let menu = build_menu(app).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

pub fn update_tooltip(app: &AppHandle, status: &Status) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main") else {
        return Ok(());
    };
    let text = actions::status_tooltip(status);
    tray.set_tooltip(Some(text.as_str()))
        .map_err(|e| e.to_string())
}
