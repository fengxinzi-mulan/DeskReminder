use crate::actions;
use crate::config;
use crate::platform;
use crate::schedule;
use crate::state::{AppState, ToastSource};
use crate::toast;
use chrono::{Duration, Local};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tauri::AppHandle;

pub fn start(app: AppHandle, state: Arc<AppState>) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(StdDuration::from_secs(5));
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            if state.quitting.load(Ordering::Relaxed) {
                break;
            }
            if let Err(err) = tick(&app, &state) {
                log::error!("scheduler tick failed: {err}");
            }
        }
    });
}

fn tick(app: &AppHandle, state: &Arc<AppState>) -> Result<(), String> {
    let now = Local::now();
    let config_snapshot = state.config.lock().unwrap().clone();

    // 识别睡眠/休眠/系统时间跳变：墙钟间隔异常时重新排期，不补发。
    let gap = {
        let mut runtime = state.runtime.lock().unwrap();
        let previous = runtime.last_tick;
        runtime.last_tick = Some(now);
        previous.map(|previous| (now - previous).num_seconds())
    };
    let mut status_changed = false;
    if let Some(gap) = gap {
        if gap > 90 || gap < -90 {
            state.reschedule(now);
            let mut runtime = state.runtime.lock().unwrap();
            runtime.resume_grace_until = Some(now + Duration::seconds(60));
            log::info!("system resume/time jump detected ({gap}s), schedules rebased");
            status_changed = true;
        }
    }

    // 暂停到期后重新排期，避免补发暂停期间的提醒。
    let pause_ended = {
        let mut runtime = state.runtime.lock().unwrap();
        if let Some(until) = runtime.paused_until {
            if now >= until {
                runtime.paused_until = None;
                true
            } else {
                false
            }
        } else {
            false
        }
    };
    if pause_ended {
        state.reschedule(now);
        log::info!("pause finished, schedules rebased");
        status_changed = true;
    }

    let paused = {
        let runtime = state.runtime.lock().unwrap();
        runtime.paused_until.is_some()
    };
    if paused {
        let mut runtime = state.runtime.lock().unwrap();
        if runtime.skip_reason.as_deref() != Some("paused") {
            log::info!("scheduler paused");
            runtime.skip_reason = Some("paused".to_string());
        }
        drop(runtime);
        if status_changed {
            actions::broadcast_status(app);
        }
        return Ok(());
    }

    let locked = platform::is_locked();
    let locked_changed = {
        let mut runtime = state.runtime.lock().unwrap();
        if runtime.locked != locked {
            runtime.locked = locked;
            true
        } else {
            false
        }
    };
    if locked_changed {
        log::info!("session lock state: {locked}");
        status_changed = true;
    }

    let now = Local::now();
    let grace = {
        let mut runtime = state.runtime.lock().unwrap();
        match runtime.resume_grace_until {
            Some(until) if now < until => true,
            Some(_) => {
                runtime.resume_grace_until = None;
                false
            }
            None => false,
        }
    };

    let idle_too_long = if config_snapshot.general.idle_minutes > 0 {
        let threshold = config_snapshot.general.idle_minutes as u64 * 60;
        platform::idle_seconds()
            .map(|seconds| seconds >= threshold)
            .unwrap_or(false)
    } else {
        false
    };

    let skip_reason = if locked {
        Some("locked")
    } else if grace {
        Some("resume grace")
    } else if idle_too_long {
        Some("idle")
    } else {
        None
    };

    if let Some(reason) = skip_reason {
        let mut runtime = state.runtime.lock().unwrap();
        if runtime.skip_reason.as_deref() != Some(reason) {
            log::info!("scheduler skipping: {reason}");
            runtime.skip_reason = Some(reason.to_string());
        }
        drop(runtime);
        if status_changed {
            actions::broadcast_status(app);
        }
        return Ok(());
    }

    let due: Vec<config::ReminderType> = {
        let runtime = state.runtime.lock().unwrap();
        config_snapshot
            .types
            .iter()
            .filter(|rule| rule.enabled)
            .filter(|rule| {
                runtime
                    .next_due
                    .get(&rule.id)
                    .map(|due| *due <= now)
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    };

    if !due.is_empty() {
        {
            let mut runtime = state.runtime.lock().unwrap();
            runtime.skip_reason = None;
            for rule in &due {
                match schedule::next_due(rule, now) {
                    Some(next) => {
                        runtime.next_due.insert(rule.id.clone(), next);
                    }
                    None => {
                        runtime.next_due.remove(&rule.id);
                    }
                }
            }
        }
        for rule in &due {
            log::info!(
                "reminder due: {} ({})",
                rule.name,
                schedule::human_time(now)
            );
            toast::enqueue_type(app, state, &rule.id, ToastSource::Scheduled);
        }
        status_changed = true;
    } else {
        let mut runtime = state.runtime.lock().unwrap();
        runtime.skip_reason = None;
    }

    if status_changed {
        actions::broadcast_status(app);
    }
    Ok(())
}
