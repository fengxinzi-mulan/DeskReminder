use crate::config::{
    ReminderType, RuleMode, format_hhmm, local_datetime, parse_hhmm, parse_once_at,
};
use chrono::{DateTime, Datelike, Duration, Local, Timelike};

/// 计算严格晚于 `now` 的下一次触发时间。
///
/// 间隔模式从生效时段起点对齐：09:00 起每 60 分钟 => 10:00、11:00…
/// 固定时刻模式只取落在生效时段内、且在 `now` 之后的时间点。
/// 单次模式只返回指定的日期时间，过后返回 `None`，不会重复。
pub fn next_due(rule: &ReminderType, now: DateTime<Local>) -> Option<DateTime<Local>> {
    if !rule.enabled {
        return None;
    }
    if rule.mode == RuleMode::Once {
        let at = parse_once_at(&rule.once_at)?;
        return (at > now).then_some(at);
    }
    let start_min = parse_hhmm(&rule.window_start)?;
    let end_min = parse_hhmm(&rule.window_end)?;
    if end_min <= start_min || rule.days.is_empty() {
        return None;
    }

    let interval = rule.interval_min as i64;
    if rule.mode == RuleMode::Interval && interval <= 0 {
        return None;
    }

    let fixed: Vec<u32> = rule
        .fixed_times
        .iter()
        .filter_map(|value| parse_hhmm(value))
        .filter(|minute| *minute >= start_min && *minute <= end_min)
        .collect();

    let today = now.date_naive();
    for offset in 0..=8i64 {
        let date = today + Duration::days(offset);
        let weekday = date.weekday().number_from_monday() as u8;
        if !rule.days.contains(&weekday) {
            continue;
        }
        let start = local_datetime(date, start_min)?;
        let end = local_datetime(date, end_min)?;
        if offset == 0 && now >= end {
            continue;
        }

        match rule.mode {
            // 单次模式已在函数开头返回。
            RuleMode::Once => return None,
            RuleMode::Interval => {
                let mut slot = start + Duration::minutes(interval);
                while slot < end {
                    if slot > now {
                        return Some(slot);
                    }
                    slot += Duration::minutes(interval);
                }
            }
            RuleMode::Fixed => {
                for minute in &fixed {
                    let slot = local_datetime(date, *minute)?;
                    if slot > now && slot < end {
                        return Some(slot);
                    }
                }
            }
        }
    }

    None
}

pub fn reschedule_map(
    config: &crate::config::Config,
    now: DateTime<Local>,
) -> std::collections::HashMap<String, DateTime<Local>> {
    let mut map = std::collections::HashMap::new();
    for rule in config.types.iter().filter(|rule| rule.enabled) {
        if let Some(next) = next_due(rule, now) {
            map.insert(rule.id.clone(), next);
        }
    }
    map
}

pub fn human_time(value: DateTime<Local>) -> String {
    format_hhmm(value.hour() * 60 + value.minute())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::default_config;
    use chrono::TimeZone;

    fn at(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> DateTime<Local> {
        Local
            .with_ymd_and_hms(year, month, day, hour, minute, 0)
            .single()
            .expect("unambiguous local time")
    }

    fn rule() -> ReminderType {
        default_config().types[0].clone()
    }

    #[test]
    fn first_slot_is_after_window_start() {
        let next = next_due(&rule(), at(2026, 10, 19, 8, 0)).unwrap();
        assert_eq!(next, at(2026, 10, 19, 10, 0));
    }

    #[test]
    fn skips_current_slot() {
        let next = next_due(&rule(), at(2026, 10, 19, 10, 0)).unwrap();
        assert_eq!(next, at(2026, 10, 19, 11, 0));
    }

    #[test]
    fn after_window_moves_to_next_day() {
        let next = next_due(&rule(), at(2026, 10, 19, 17, 30)).unwrap();
        assert_eq!(next, at(2026, 10, 20, 10, 0));
    }

    #[test]
    fn window_end_is_exclusive() {
        let next = next_due(&rule(), at(2026, 10, 19, 17, 0)).unwrap();
        assert_eq!(next, at(2026, 10, 20, 10, 0));
    }

    #[test]
    fn weekend_moves_to_monday() {
        // 2026-10-24 是周六
        let next = next_due(&rule(), at(2026, 10, 24, 10, 0)).unwrap();
        assert_eq!(next, at(2026, 10, 26, 10, 0));
    }

    #[test]
    fn fixed_times_respect_window_and_order() {
        let mut r = rule();
        r.mode = RuleMode::Fixed;
        r.fixed_times = vec!["09:30".to_string(), "11:00".to_string()];
        assert_eq!(
            next_due(&r, at(2026, 10, 19, 9, 0)).unwrap(),
            at(2026, 10, 19, 9, 30)
        );
        assert_eq!(
            next_due(&r, at(2026, 10, 19, 10, 0)).unwrap(),
            at(2026, 10, 19, 11, 0)
        );
        assert_eq!(
            next_due(&r, at(2026, 10, 19, 11, 0)).unwrap(),
            at(2026, 10, 20, 9, 30)
        );
    }

    #[test]
    fn disabled_rule_has_no_due() {
        let mut r = rule();
        r.enabled = false;
        assert!(next_due(&r, at(2026, 10, 19, 9, 0)).is_none());
    }

    #[test]
    fn no_selected_days_has_no_due() {
        let mut r = rule();
        r.days.clear();
        assert!(next_due(&r, at(2026, 10, 19, 9, 0)).is_none());
    }

    #[test]
    fn once_mode_fires_at_selected_time() {
        let mut r = rule();
        r.mode = RuleMode::Once;
        r.once_at = "2026-10-23T15:00".to_string();
        assert_eq!(
            next_due(&r, at(2026, 10, 23, 14, 0)).unwrap(),
            at(2026, 10, 23, 15, 0)
        );
        assert!(next_due(&r, at(2026, 10, 23, 15, 0)).is_none());
        assert!(next_due(&r, at(2026, 10, 23, 16, 0)).is_none());
    }

    #[test]
    fn once_mode_ignores_window_and_days() {
        let mut r = rule();
        r.mode = RuleMode::Once;
        r.once_at = "2026-10-24T20:00".to_string();
        r.window_start = "09:00".to_string();
        r.window_end = "18:00".to_string();
        r.days = vec![1];
        assert_eq!(
            next_due(&r, at(2026, 10, 23, 14, 0)).unwrap(),
            at(2026, 10, 24, 20, 0)
        );
    }
}
