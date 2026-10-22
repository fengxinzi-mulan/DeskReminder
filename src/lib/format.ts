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
  if (rule.mode === "once") {
    const suffix = isOncePast(rule.onceAt) ? " · 已提醒" : "";
    return `单次 · ${formatOnceAt(rule.onceAt)}${suffix}`;
  }
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
  if (rule.mode === "once") {
    const suffix = isOncePast(rule.onceAt) ? " · 已提醒" : "";
    return `单次 · ${formatOnceAt(rule.onceAt)}${suffix}`;
  }
  const mode =
    rule.mode === "interval"
      ? `每 ${rule.intervalMin} 分钟`
      : rule.fixedTimes.join(" / ") || "未设置时刻";
  return `${formatDays(rule.days)} · ${mode}`;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 解析本地时间 `YYYY-MM-DDTHH:MM`；非法值返回 null。 */
function parseOnceAt(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hour) ||
    date.getMinutes() !== Number(minute)
  ) {
    return null;
  }
  return date;
}

/** 新建单次提醒时的默认时间：当前时间一小时后。 */
export function defaultOnceAt(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function onceDatePart(value: string): string {
  return parseOnceAt(value) ? value.slice(0, 10) : "";
}

export function onceTimePart(value: string): string {
  return parseOnceAt(value) ? value.slice(11, 16) : "09:00";
}

export function isOncePast(value: string): boolean {
  const date = parseOnceAt(value);
  return date !== null && date.getTime() <= Date.now();
}

export function formatOnceAt(value: string): string {
  const date = parseOnceAt(value);
  if (!date) return "未设置时间";
  const year =
    date.getFullYear() === new Date().getFullYear()
      ? ""
      : `${date.getFullYear()}年`;
  return `${year}${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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
    return `下次 ${dueLabel(status.nextDue)}${status.nextType ? ` · ${status.nextType}` : ""}`;
  }
  return "暂无提醒计划";
}

/** 今天只显示时刻，跨天时补上“明天”或具体日期。 */
function dueLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return hhmm(value);
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();
  return isTomorrow
    ? `明天 ${hhmm(value)}`
    : `${date.getMonth() + 1}月${date.getDate()}日 ${hhmm(value)}`;
}

export function statusTone(status: Status | null): "running" | "paused" | "idle" {
  if (status?.pausedUntil) return "paused";
  if (status?.nextDue) return "running";
  return "idle";
}

export function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
