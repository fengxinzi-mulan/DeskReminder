import type { ReminderType } from "./types";

export type TypeKind = "water" | "stand" | "custom";

export function makeDefaultType(kind: TypeKind, id?: string): ReminderType {
  if (kind === "water") {
    return {
      id: id ?? "water",
      name: "喝水",
      enabled: true,
      message: "该喝水啦，给身体补一点水。",
      accent: "#38BDF8",
      mode: "interval",
      intervalMin: 60,
      fixedTimes: [],
      windowStart: "09:00",
      windowEnd: "18:00",
      days: [1, 2, 3, 4, 5],
      snoozeMin: 10,
      popupSec: 12,
    };
  }
  if (kind === "stand") {
    return {
      id: id ?? "stand",
      name: "起立活动",
      enabled: true,
      message: "坐久了，起来走走，活动一下肩颈。",
      accent: "#F59E0B",
      mode: "interval",
      intervalMin: 60,
      fixedTimes: [],
      windowStart: "09:30",
      windowEnd: "18:00",
      days: [1, 2, 3, 4, 5],
      snoozeMin: 10,
      popupSec: 12,
    };
  }
  return {
    id: id ?? newId(),
    name: "自定义提醒",
    enabled: true,
    message: "该休息一下啦，停下来活动活动。",
    accent: "#A78BFA",
    mode: "interval",
    intervalMin: 45,
    fixedTimes: [],
    windowStart: "09:00",
    windowEnd: "18:00",
    days: [1, 2, 3, 4, 5],
    snoozeMin: 10,
    popupSec: 12,
  };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function kindOf(rule: Pick<ReminderType, "id">): TypeKind {
  if (rule.id === "water") return "water";
  if (rule.id === "stand") return "stand";
  return "custom";
}
