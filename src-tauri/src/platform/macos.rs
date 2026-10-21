use super::WorkArea;
use std::ffi::c_void;
use std::path::Path;
use std::process::Command;
use tauri::{Manager, WebviewWindow};

use core_foundation_sys::base::{CFRelease, CFTypeRef};
use core_foundation_sys::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
use core_foundation_sys::string::CFStringCreateWithCString;

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn CGSessionCopyCurrentDictionary() -> CFDictionaryRef;
}

#[link(name = "CoreGraphics", kind = "framework")]
unsafe extern "C" {
    fn CGEventSourceSecondsSinceLastEventType(state: i32, event_type: u32) -> f64;
}

#[link(name = "AppKit", kind = "framework")]
unsafe extern "C" {
    fn NSBeep();
}

#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFBooleanGetValue(boolean: *const c_void) -> u8;
}

#[link(name = "objc")]
unsafe extern "C" {
    fn objc_msgSend(receiver: *mut c_void, selector: *mut c_void) -> *mut c_void;
    fn sel_registerName(name: *const std::ffi::c_char) -> *mut c_void;
}

const CF_STRING_ENCODING_UTF8: u32 = 0x0800_0100;

pub fn is_locked() -> bool {
    unsafe {
        let dictionary = CGSessionCopyCurrentDictionary();
        if dictionary.is_null() {
            return false;
        }

        let key = CFStringCreateWithCString(
            std::ptr::null(),
            c"CGSSessionScreenIsLocked".as_ptr(),
            CF_STRING_ENCODING_UTF8,
        );
        let locked = if key.is_null() {
            false
        } else {
            let value = CFDictionaryGetValue(dictionary, key as *const c_void);
            !value.is_null() && CFBooleanGetValue(value) != 0
        };

        if !key.is_null() {
            CFRelease(key as CFTypeRef);
        }
        CFRelease(dictionary as CFTypeRef);
        locked
    }
}

pub fn idle_seconds() -> Option<u64> {
    unsafe {
        let seconds = CGEventSourceSecondsSinceLastEventType(0, 0xFFFF_FFFF);
        if seconds.is_finite() && seconds >= 0.0 {
            Some(seconds as u64)
        } else {
            None
        }
    }
}

pub fn beep() {
    unsafe {
        NSBeep();
    }
}

pub fn primary_work_area(app: &tauri::AppHandle) -> Option<WorkArea> {
    let monitor = app.primary_monitor().ok().flatten()?;
    let position = monitor.position();
    let size = monitor.size();
    let scale = monitor.scale_factor();
    // 预留 macOS 菜单栏（含刘海屏）高度。
    let menu_bar = (40.0 * scale) as i32;
    Some(WorkArea {
        x: position.x,
        y: position.y + menu_bar,
        width: size.width,
        height: size.height.saturating_sub(menu_bar as u32),
    })
}

pub fn hide_toast(window: &WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())?;
    let _ = window.set_position(tauri::PhysicalPosition::new(-10000, -10000));
    Ok(())
}

pub fn show_without_activating(window: &WebviewWindow) -> Result<(), String> {
    let app = window.app_handle().clone();
    let window = window.clone();
    app.run_on_main_thread(move || {
        if let Ok(ns_window) = window.ns_window() {
            unsafe {
                let selector = sel_registerName(c"orderFrontRegardless".as_ptr());
                if !selector.is_null() {
                    objc_msgSend(ns_window as *mut c_void, selector);
                }
            }
        }
        let _ = window.set_visible_on_all_workspaces(true);
        let _ = window.set_always_on_top(true);
    })
    .map_err(|e| e.to_string())
}

pub fn open_path(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("打开目录失败：{e}"))
}
