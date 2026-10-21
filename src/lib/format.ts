import type { ReminderType, Status } from "./types";

export const ACCENT_PRESETS = [
  "#38BDF8",
  "#34D399",
  "#F59E0B",
  "#A78BFA",
  "#F472B6",
  "#FB7185",
];

export const WEEKDAYS = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 7, label: "日" },
];

export function formatDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "未选择星期";
  if (sorted.length === 7) return "每天";
  if (sorted.join(",") === "1,2,3,4,5") return "工作日";
  if (sorted.join(",") === "6,7") return "周末";
  return sorted.map((d) => `周${WEEKDAYS.find((w) => w.value === d)?.label ?? d}`).join("、");
}

export function ruleSummary(rule: ReminderType): string {
  const time = `${rule.windowStart}–${rule.windowEnd}`;
  if (rule.mode === "interval") {
    return `${formatDays(rule.days)} ${time} · 每 ${rule.intervalMin} 分钟`;
  }
  if (rule.fixedTimes.length === 0) {
    return `${formatDays(rule.days)} ${time} · 未设置固定时刻`;
  }
  return `${formatDays(rule.days)} ${time} · ${rule.fixedTimes.join(" / ")}`;
}

export function shortRuleSummary(rule: ReminderType): string {
  const mode =
    rule.mode === "interval"
      ? `每 ${rule.intervalMin} 分钟`
      : rule.fixedTimes.join(" / ") || "未设置时刻";
  return `${formatDays(rule.days)} · ${mode}`;
}

export function hhmm(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function statusText(status: Status | null): string {
  if (!status) return "正在载入…";
  if (status.pausedUntil) return `已暂停至 ${hhmm(status.pausedUntil)}`;
  if (status.locked) return "屏幕已锁定，暂时静默";
  if (status.nextDue) {
    return `下次 ${hhmm(status.nextDue)}${status.nextType ? ` · ${status.nextType}` : ""}`;
  }
  return "暂无提醒计划";
}

export function statusTone(status: Status | null): "running" | "paused" | "idle" {
  if (status?.pausedUntil) return "paused";
  if (status?.nextDue) return "running";
  return "idle";
}

export function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
