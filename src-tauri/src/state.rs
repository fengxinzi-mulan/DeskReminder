use crate::config::{Config, Theme};
use crate::schedule;
use chrono::{DateTime, Local};
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub id: String,
    pub type_id: String,
    pub name: String,
    pub message: String,
    pub accent: String,
    pub snooze_min: u32,
    pub duration_sec: u32,
    pub theme: Theme,
    pub preview: bool,
}

#[derive(Debug, Clone)]
pub struct ToastItem {
    pub payload: ToastPayload,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub next_due: Option<String>,
    pub next_type: Option<String>,
    pub paused_until: Option<String>,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub config: Config,
    pub status: Status,
    pub autostart: bool,
    pub config_path: String,
    pub version: String,
    pub first_run: bool,
}

#[derive(Default)]
pub struct Runtime {
    pub next_due: HashMap<String, DateTime<Local>>,
    pub paused_until: Option<DateTime<Local>>,
    pub active: Option<ToastItem>,
    pub queue: VecDeque<ToastItem>,
    pub toast_ready: bool,
    pub last_tick: Option<DateTime<Local>>,
    pub locked: bool,
    pub resume_grace_until: Option<DateTime<Local>>,
    pub last_status_json: String,
    pub skip_reason: Option<String>,
}

pub struct AppState {
    pub config: Mutex<Config>,
    pub runtime: Mutex<Runtime>,
    pub config_path: PathBuf,
    pub first_run: bool,
    pub autostart: AtomicBool,
    pub settings_ready: AtomicBool,
    pub pending_show_settings: AtomicBool,
    pub quitting: AtomicBool,
    pub toast_seq: AtomicU64,
}

impl AppState {
    pub fn new(
        config: Config,
        config_path: PathBuf,
        first_run: bool,
        autostart: bool,
    ) -> Self {
        let now = Local::now();
        let runtime = Runtime {
            next_due: schedule::reschedule_map(&config, now),
            last_tick: Some(now),
            ..Runtime::default()
        };
        Self {
            config: Mutex::new(config),
            runtime: Mutex::new(runtime),
            config_path,
            first_run,
            autostart: AtomicBool::new(autostart),
            settings_ready: AtomicBool::new(false),
            pending_show_settings: AtomicBool::new(false),
            quitting: AtomicBool::new(false),
            toast_seq: AtomicU64::new(1),
        }
    }

    pub fn reschedule(&self, now: DateTime<Local>) {
        let config = self.config.lock().unwrap().clone();
        let mut runtime = self.runtime.lock().unwrap();
        runtime.next_due = schedule::reschedule_map(&config, now);
    }

    pub fn status(&self) -> Status {
        let config = self.config.lock().unwrap();
        let runtime = self.runtime.lock().unwrap();
        let next = runtime
            .next_due
            .iter()
            .min_by_key(|(_, due)| **due)
            .map(|(id, due)| (id.clone(), *due));
        let next_type = next.as_ref().and_then(|(id, _)| {
            config
                .types
                .iter()
                .find(|t| &t.id == id)
                .map(|t| t.name.clone())
        });
        Status {
            next_due: next.map(|(_, due)| due.to_rfc3339()),
            next_type,
            paused_until: runtime.paused_until.map(|value| value.to_rfc3339()),
            locked: runtime.locked,
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        let config = self.config.lock().unwrap().clone();
        Snapshot {
            config,
            status: self.status(),
            autostart: self.autostart.load(std::sync::atomic::Ordering::Relaxed),
            config_path: self.config_path.display().to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            first_run: self.first_run,
        }
    }

    pub fn next_toast_id(&self) -> String {
        format!(
            "toast-{}",
            self.toast_seq
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        )
    }
}
