export type RuleMode = "interval" | "fixed" | "once";
export type Theme = "system" | "light" | "dark";
export type PopupPosition = "top-center" | "top-right";

export interface ReminderType {
  id: string;
  name: string;
  enabled: boolean;
  message: string;
  accent: string;
  mode: RuleMode;
  intervalMin: number;
  fixedTimes: string[];
  windowStart: string;
  windowEnd: string;
  days: number[];
  snoozeMin: number;
  popupSec: number;
  onceAt: string;
  deleteAfter: boolean;
}

export interface General {
  autoStart: boolean;
  idleMinutes: number;
  sound: boolean;
  position: PopupPosition;
  theme: Theme;
}

export interface Config {
  version: number;
  types: ReminderType[];
  general: General;
}

export interface Status {
  nextDue: string | null;
  nextType: string | null;
  pausedUntil: string | null;
  locked: boolean;
}

export interface Snapshot {
  config: Config;
  status: Status;
  autostart: boolean;
  configPath: string;
  version: string;
  firstRun: boolean;
}

export interface ToastPayload {
  id: string;
  typeId: string;
  name: string;
  message: string;
  accent: string;
  snoozeMin: number;
  durationSec: number;
  theme: Theme;
  preview: boolean;
}
