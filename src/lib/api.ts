import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Config, ReminderType, Snapshot, Theme, ToastPayload } from "./types";

export const api = {
  snapshot: () => invoke<Snapshot>("get_snapshot"),
  saveConfig: (config: Config) => invoke<Config>("save_config", { config }),
  previewToast: (rule: ReminderType, theme: Theme) =>
    invoke<void>("preview_toast", { rule, theme }),
  toastAction: (id: string, action: "done" | "snooze" | "timeout") =>
    invoke<void>("toast_action", { id, action }),
  toastReady: () => invoke<void>("toast_ready"),
  frontendReady: () => invoke<void>("frontend_ready"),
  pause: (minutes: number | null) => invoke<void>("pause", { minutes }),
  pauseToday: () => invoke<void>("pause_today"),
  setAutostart: (enabled: boolean) => invoke<void>("set_autostart", { enabled }),
  openSettings: () => invoke<void>("open_settings"),
  openConfigDir: () => invoke<void>("open_config_dir"),
};

export function onToastShow(handler: (payload: ToastPayload) => void): Promise<UnlistenFn> {
  return listen<ToastPayload>("toast:show", (event) => handler(event.payload));
}

export function onStatus(handler: (payload: import("./types").Status) => void): Promise<UnlistenFn> {
  return listen<import("./types").Status>("status:updated", (event) => handler(event.payload));
}

export function onConfig(handler: (payload: Config) => void): Promise<UnlistenFn> {
  return listen<Config>("config:updated", (event) => handler(event.payload));
}

export function onReminderDeleted(handler: (typeId: string) => void): Promise<UnlistenFn> {
  return listen<string>("reminder:deleted", (event) => handler(event.payload));
}
