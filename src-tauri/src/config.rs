use chrono::{Local, NaiveDate, NaiveTime, TimeZone};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const CONFIG_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default = "default_version")]
    pub version: u32,
    pub types: Vec<ReminderType>,
    #[serde(default)]
    pub general: General,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderType {
    pub id: String,
    pub name: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub message: String,
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default)]
    pub mode: RuleMode,
    #[serde(default = "default_interval")]
    pub interval_min: u32,
    #[serde(default)]
    pub fixed_times: Vec<String>,
    #[serde(default = "default_start")]
    pub window_start: String,
    #[serde(default = "default_end")]
    pub window_end: String,
    #[serde(default = "default_days")]
    pub days: Vec<u8>,
    #[serde(default = "default_snooze")]
    pub snooze_min: u32,
    #[serde(default = "default_popup")]
    pub popup_sec: u32,
    /// 单次提醒的本地时间，格式 `YYYY-MM-DDTHH:MM`；其他模式忽略。
    #[serde(default)]
    pub once_at: String,
    /// 单次提醒弹窗关闭后删除该类型；仅在 `mode == Once` 时生效。
    #[serde(default)]
    pub delete_after: bool,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuleMode {
    #[default]
    Interval,
    Fixed,
    Once,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct General {
    pub auto_start: bool,
    pub idle_minutes: u32,
    pub sound: bool,
    pub position: PopupPosition,
    pub theme: Theme,
}

impl Default for General {
    fn default() -> Self {
        Self {
            auto_start: false,
            idle_minutes: 0,
            sound: true,
            position: PopupPosition::TopCenter,
            theme: Theme::System,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PopupPosition {
    #[default]
    TopCenter,
    TopRight,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

fn default_version() -> u32 {
    CONFIG_VERSION
}
fn default_true() -> bool {
    true
}
fn default_accent() -> String {
    "#38BDF8".to_string()
}
fn default_interval() -> u32 {
    60
}
fn default_start() -> String {
    "09:00".to_string()
}
fn default_end() -> String {
    "18:00".to_string()
}
fn default_days() -> Vec<u8> {
    vec![1, 2, 3, 4, 5]
}
fn default_snooze() -> u32 {
    10
}
fn default_popup() -> u32 {
    12
}

impl ReminderType {
    fn water() -> Self {
        Self {
            id: "water".to_string(),
            name: "喝水".to_string(),
            enabled: true,
            message: "该喝水啦，给身体补一点水。".to_string(),
            accent: "#38BDF8".to_string(),
            mode: RuleMode::Interval,
            interval_min: 60,
            fixed_times: Vec::new(),
            window_start: "09:00".to_string(),
            window_end: "18:00".to_string(),
            days: vec![1, 2, 3, 4, 5],
            snooze_min: 10,
            popup_sec: 12,
            once_at: String::new(),
            delete_after: false,
        }
    }

    fn stand() -> Self {
        Self {
            id: "stand".to_string(),
            name: "起立活动".to_string(),
            enabled: true,
            message: "坐久了，起来走走，活动一下肩颈。".to_string(),
            accent: "#F59E0B".to_string(),
            mode: RuleMode::Interval,
            interval_min: 60,
            fixed_times: Vec::new(),
            window_start: "09:30".to_string(),
            window_end: "18:00".to_string(),
            days: vec![1, 2, 3, 4, 5],
            snooze_min: 10,
            popup_sec: 12,
            once_at: String::new(),
            delete_after: false,
        }
    }
}

pub fn default_config() -> Config {
    Config {
        version: CONFIG_VERSION,
        types: vec![ReminderType::water(), ReminderType::stand()],
        general: General::default(),
    }
}

pub fn parse_hhmm(value: &str) -> Option<u32> {
    let trimmed = value.trim();
    let (hours, minutes) = trimmed.split_once(':')?;
    if hours.len() != 2 || minutes.len() != 2 {
        return None;
    }
    let h: u32 = hours.parse().ok()?;
    let m: u32 = minutes.parse().ok()?;
    if h > 23 || m > 59 {
        return None;
    }
    Some(h * 60 + m)
}

pub fn format_hhmm(minutes: u32) -> String {
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

pub fn valid_accent(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

impl Config {
    /// 规范化并校验配置；返回的配置会写回磁盘。
    pub fn normalize(mut self) -> Result<Self, Vec<String>> {
        let mut errors = Vec::new();
        self.version = CONFIG_VERSION;

        if self.types.len() > 50 {
            errors.push("提醒类型不能超过 50 个".to_string());
        }

        let mut ids = HashSet::new();
        for t in &mut self.types {
            t.id = t.id.trim().to_string();
            t.name = t.name.trim().to_string();
            t.message = t.message.trim().to_string();
            t.accent = t.accent.trim().to_uppercase();
            t.window_start = t.window_start.trim().to_string();
            t.window_end = t.window_end.trim().to_string();

            let label = if t.name.is_empty() {
                "未命名提醒".to_string()
            } else {
                t.name.clone()
            };
            let prefix = format!("[{}] ", label);

            if t.id.is_empty() {
                errors.push(format!("{prefix}缺少内部标识"));
            } else if !ids.insert(t.id.clone()) {
                errors.push(format!("{prefix}与其他类型使用了相同标识"));
            }
            if t.name.is_empty() {
                errors.push(format!("{prefix}名称不能为空"));
            }
            if t.name.chars().count() > 30 {
                errors.push(format!("{prefix}名称不能超过 30 个字符"));
            }
            if t.message.is_empty() {
                errors.push(format!("{prefix}提醒文案不能为空"));
            }
            if t.message.chars().count() > 200 {
                errors.push(format!("{prefix}提醒文案不能超过 200 个字符"));
            }
            if !valid_accent(&t.accent) {
                errors.push(format!("{prefix}强调色必须是 #RRGGBB 格式"));
            }
            if !(3..=60).contains(&t.popup_sec) {
                errors.push(format!("{prefix}弹窗停留需在 3–60 秒之间"));
            }
            if !(1..=120).contains(&t.snooze_min) {
                errors.push(format!("{prefix}稍后提醒需在 1–120 分钟之间"));
            }

            t.days.retain(|d| (1..=7).contains(d));
            t.days.sort_unstable();
            t.days.dedup();

            if t.mode == RuleMode::Once {
                t.once_at = t.once_at.trim().to_string();
                if t.once_at.is_empty() {
                    errors.push(format!("{prefix}请选择单次提醒的日期和时间"));
                } else if parse_once_at(&t.once_at).is_none() {
                    errors.push(format!("{prefix}单次提醒时间格式应为 YYYY-MM-DDTHH:MM"));
                }
                if t.days.is_empty() {
                    t.days = default_days();
                }
                continue;
            }

            if t.days.is_empty() {
                errors.push(format!("{prefix}至少选择一个生效星期"));
            }

            let start = parse_hhmm(&t.window_start);
            let end = parse_hhmm(&t.window_end);
            match (start, end) {
                (Some(s), Some(e)) if e > s => {
                    if t.mode == RuleMode::Interval {
                        if t.interval_min == 0 || t.interval_min > 1440 {
                            errors.push(format!("{prefix}间隔需在 1–1440 分钟之间"));
                        } else if t.interval_min >= e - s {
                            errors.push(format!("{prefix}间隔必须小于生效时段长度"));
                        }
                    } else {
                        let mut normalized = Vec::new();
                        for raw in &t.fixed_times {
                            match parse_hhmm(raw) {
                                Some(m) => {
                                    if m < s || m >= e {
                                        errors.push(format!(
                                            "{prefix}固定时刻 {} 不在生效时段内",
                                            raw.trim()
                                        ));
                                    } else {
                                        normalized.push(format_hhmm(m));
                                    }
                                }
                                None => errors.push(format!(
                                    "{prefix}固定时刻「{}」格式应为 HH:MM",
                                    raw.trim()
                                )),
                            }
                        }
                        normalized.sort();
                        normalized.dedup();
                        if normalized.is_empty() && !t.fixed_times.is_empty() {
                            // 全部格式错误时保留原值，便于用户修正
                        }
                        if t.fixed_times.is_empty() {
                            errors.push(format!("{prefix}请至少添加一个固定时刻"));
                        }
                        t.fixed_times = normalized;
                    }
                }
                (Some(_), Some(_)) => {
                    errors.push(format!("{prefix}生效时段的结束时间必须晚于开始时间"))
                }
                _ => errors.push(format!("{prefix}生效时段格式应为 HH:MM")),
            }

            if t.mode == RuleMode::Interval {
                t.fixed_times.retain(|v| parse_hhmm(v).is_some());
            }
        }

        if self.general.idle_minutes > 240 {
            errors.push("空闲判定不能超过 240 分钟".to_string());
        }

        if errors.is_empty() {
            Ok(self)
        } else {
            Err(errors)
        }
    }
}

pub struct LoadOutcome {
    pub config: Config,
    pub created: bool,
    pub warning: Option<String>,
}

pub fn load_or_default(path: &Path) -> LoadOutcome {
    if !path.exists() {
        return LoadOutcome {
            config: default_config(),
            created: true,
            warning: None,
        };
    }

    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) => {
            return LoadOutcome {
                config: default_config(),
                created: false,
                warning: Some(format!("读取配置失败，已使用默认设置：{err}")),
            };
        }
    };

    match serde_json::from_str::<Config>(&text) {
        Ok(config) => match config.normalize() {
            Ok(config) => LoadOutcome {
                config,
                created: false,
                warning: None,
            },
            Err(errors) => {
                let backup = backup_bad_config(path);
                LoadOutcome {
                    config: default_config(),
                    created: false,
                    warning: Some(format!(
                        "配置文件校验失败，已备份到 {} 并使用默认设置：{}",
                        backup
                            .map(|p| p.display().to_string())
                            .unwrap_or_else(|| "（备份失败）".to_string()),
                        errors.join("；")
                    )),
                }
            }
        },
        Err(err) => {
            let backup = backup_bad_config(path);
            LoadOutcome {
                config: default_config(),
                created: false,
                warning: Some(format!(
                    "配置文件解析失败，已备份到 {} 并使用默认设置：{err}",
                    backup
                        .map(|p| p.display().to_string())
                        .unwrap_or_else(|| "（备份失败）".to_string())
                )),
            }
        }
    }
}

fn backup_bad_config(path: &Path) -> Option<PathBuf> {
    let stem = path.file_stem()?.to_string_lossy();
    let backup = path.with_file_name(format!(
        "{stem}.bad-{}.json",
        Local::now().format("%Y%m%d-%H%M%S")
    ));
    fs::copy(path, &backup).ok().map(|_| backup)
}

pub fn save_atomic(path: &Path, config: &Config) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "配置目录无效".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败：{e}"))?;

    let mut tmp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("创建临时配置文件失败：{e}"))?;
    serde_json::to_writer_pretty(&mut tmp, config).map_err(|e| format!("序列化配置失败：{e}"))?;
    tmp.write_all(b"\n")
        .map_err(|e| format!("写入配置失败：{e}"))?;
    tmp.as_file()
        .sync_all()
        .map_err(|e| format!("刷新配置失败：{e}"))?;
    tmp.persist(path)
        .map_err(|e| format!("保存配置失败：{}", e.error))?;
    Ok(())
}

pub fn local_datetime(date: NaiveDate, minute_of_day: u32) -> Option<chrono::DateTime<Local>> {
    let time = NaiveTime::from_hms_opt(minute_of_day / 60, minute_of_day % 60, 0)?;
    let naive = date.and_time(time);
    for extra_hours in 0..3 {
        let candidate = naive + chrono::Duration::hours(extra_hours);
        if let Some(dt) = Local.from_local_datetime(&candidate).earliest() {
            return Some(dt);
        }
    }
    None
}

/// 解析单次提醒时间（`YYYY-MM-DDTHH:MM`，本地时区）。
pub fn parse_once_at(value: &str) -> Option<chrono::DateTime<Local>> {
    let (date, time) = value.trim().split_once('T')?;
    if date.len() != 10 {
        return None;
    }
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    local_datetime(date, parse_hhmm(time)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let config = default_config()
            .normalize()
            .expect("defaults must validate");
        assert_eq!(config.types.len(), 2);
        assert!(config.types.iter().all(|t| !t.days.is_empty()));
    }

    #[test]
    fn rejects_interval_larger_than_window() {
        let mut config = default_config();
        config.types[0].interval_min = 1000;
        assert!(config.normalize().is_err());
    }

    #[test]
    fn rejects_fixed_time_outside_window() {
        let mut config = default_config();
        config.types[0].mode = RuleMode::Fixed;
        config.types[0].fixed_times = vec!["19:30".to_string()];
        assert!(config.normalize().is_err());
    }

    #[test]
    fn normalizes_fixed_times() {
        let mut config = default_config();
        config.types[0].mode = RuleMode::Fixed;
        config.types[0].fixed_times = vec![
            "11:00".to_string(),
            "09:30".to_string(),
            "11:00".to_string(),
        ];
        let normalized = config.normalize().expect("valid fixed times");
        assert_eq!(
            normalized.types[0].fixed_times,
            vec!["09:30".to_string(), "11:00".to_string()]
        );
    }

    #[test]
    fn rejects_duplicate_ids() {
        let mut config = default_config();
        config.types[1].id = "water".to_string();
        assert!(config.normalize().is_err());
    }

    #[test]
    fn rejects_invalid_color() {
        let mut config = default_config();
        config.types[0].accent = "blue".to_string();
        assert!(config.normalize().is_err());
    }

    #[test]
    fn parses_time() {
        assert_eq!(parse_hhmm("09:05"), Some(545));
        assert_eq!(parse_hhmm("9:05"), None);
        assert_eq!(parse_hhmm("24:00"), None);
        assert_eq!(format_hhmm(545), "09:05");
    }

    #[test]
    fn once_mode_requires_valid_datetime() {
        let mut config = default_config();
        config.types[0].mode = RuleMode::Once;

        config.types[0].once_at = "2026-10-23 15:00".to_string();
        assert!(config.clone().normalize().is_err());

        config.types[0].once_at = "2026-10-23T15:00".to_string();
        assert!(config.normalize().is_ok());
    }

    #[test]
    fn once_mode_ignores_window_and_days() {
        let mut config = default_config();
        config.types[0].mode = RuleMode::Once;
        config.types[0].once_at = "2026-10-23T20:30".to_string();
        config.types[0].window_start = "19:00".to_string();
        config.types[0].window_end = "18:00".to_string();
        config.types[0].days.clear();
        assert!(config.normalize().is_ok());
    }

    #[test]
    fn legacy_config_defaults_once_fields() {
        let raw = r#"{
            "version": 1,
            "types": [{
                "id": "custom-1",
                "name": "一次性事项",
                "message": "记得处理"
            }],
            "general": {}
        }"#;
        let config: Config = serde_json::from_str(raw).expect("legacy config must parse");
        assert_eq!(config.types[0].once_at, "");
        assert!(!config.types[0].delete_after);
        assert_eq!(config.types[0].mode, RuleMode::Interval);
    }

    #[test]
    fn parses_once_at() {
        assert!(parse_once_at("2026-10-23T15:00").is_some());
        assert!(parse_once_at("2026-10-23 15:00").is_none());
        assert!(parse_once_at("2026-13-23T15:00").is_none());
        assert!(parse_once_at("2026-10-23T25:00").is_none());
    }
}
