import type { ReactNode } from "react";
import {
  FolderOpen,
  Monitor,
  Moon,
  Pause,
  Play,
  Sun,
  Volume2,
} from "lucide-react";
import type { General, Status } from "../lib/types";
import { hhmm, statusText } from "../lib/format";
import {
  Badge,
  Button,
  Field,
  NumberStepper,
  Segmented,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "./ui";

export function GeneralPanel(props: {
  general: General;
  status: Status | null;
  configPath: string;
  version: string;
  onChange: (patch: Partial<General>) => void;
  onPause: (minutes: number) => void;
  onPauseToday: () => void;
  onResume: () => void;
  onOpenConfigDir: () => void;
}) {
  const paused = Boolean(props.status?.pausedUntil);

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">外观</h2>
            <p className="hint mt-1">默认跟随系统，也可以固定为浅色或深色。</p>
          </div>
          <Badge tone="accent">双主题</Badge>
        </div>
        <div className="card-body grid grid-cols-2 gap-5">
          <Field label="主题">
            <Segmented
              value={props.general.theme}
              onChange={(theme) => props.onChange({ theme })}
              options={[
                {
                  value: "system",
                  label: "跟随系统",
                  icon: <Monitor className="h-3.5 w-3.5" />,
                },
                {
                  value: "light",
                  label: "浅色",
                  icon: <Sun className="h-3.5 w-3.5" />,
                },
                {
                  value: "dark",
                  label: "深色",
                  icon: <Moon className="h-3.5 w-3.5" />,
                },
              ]}
              className="w-full [&>button]:flex-1"
            />
          </Field>
          <Field label="弹窗位置" hint="提醒始终出现在工作区顶部，不会覆盖任务栏或菜单栏。">
            <Select
              value={props.general.position}
              onValueChange={(value) =>
                props.onChange({ position: value as General["position"] })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="选择位置" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-center">顶部居中</SelectItem>
                <SelectItem value="top-right">顶部靠右</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">运行</h2>
            <p className="hint mt-1">锁屏和睡眠时自动静默，恢复后不会补发睡眠期间的提醒。</p>
          </div>
        </div>
        <div className="card-body divide-y" style={{ borderColor: "var(--border)" }}>
          <ToggleRow
            title="开机自启"
            description="登录 Windows / macOS 后自动在托盘运行。"
            checked={props.general.autoStart}
            onChange={(autoStart) => props.onChange({ autoStart })}
          />
          <ToggleRow
            title="提示音"
            description="提醒弹出时播放一声轻提示音。"
            checked={props.general.sound}
            onChange={(sound) => props.onChange({ sound })}
            icon={<Volume2 className="h-4 w-4" />}
          />
          <div className="flex items-center justify-between gap-5 py-4">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">离开时暂停</div>
              <p className="hint mt-0.5">
                超过设定时间没有键鼠操作时视为离开，不弹提醒。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {props.general.idleMinutes > 0 ? (
                <NumberStepper
                  value={props.general.idleMinutes}
                  min={1}
                  max={240}
                  step={5}
                  suffix="分钟"
                  aria-label="空闲暂停分钟数"
                  onChange={(idleMinutes) => props.onChange({ idleMinutes })}
                />
              ) : null}
              <Switch
                checked={props.general.idleMinutes > 0}
                aria-label="离开时暂停"
                onCheckedChange={(checked) =>
                  props.onChange({ idleMinutes: checked ? 10 : 0 })
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">临时暂停</h2>
            <p className="hint mt-1">{statusText(props.status)}</p>
          </div>
          {paused ? <Badge tone="warning">暂停中</Badge> : <Badge tone="success">运行中</Badge>}
        </div>
        <div className="card-body">
          <div className="flex flex-wrap items-center gap-2">
            {paused ? (
              <Button variant="primary" onClick={props.onResume}>
                <Play className="h-4 w-4" />
                恢复提醒
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => props.onPause(30)}>
                  <Pause className="h-4 w-4" />
                  30 分钟
                </Button>
                <Button variant="secondary" onClick={() => props.onPause(60)}>
                  <Pause className="h-4 w-4" />
                  1 小时
                </Button>
                <Button variant="secondary" onClick={() => props.onPause(120)}>
                  <Pause className="h-4 w-4" />
                  2 小时
                </Button>
                <Button variant="secondary" onClick={props.onPauseToday}>
                  <Pause className="h-4 w-4" />
                  今天
                </Button>
              </>
            )}
            {paused && props.status?.pausedUntil ? (
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                将于 {hhmm(props.status.pausedUntil)} 自动恢复
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">数据与版本</h2>
            <p className="hint mt-1">桌面提醒只在本地保存配置和日志，不联网。</p>
          </div>
        </div>
        <div className="card-body space-y-4">
          <Field label="配置目录" hint={props.configPath}>
            <div className="flex items-center gap-2">
              <div
                className="flex h-[38px] min-w-0 flex-1 items-center truncate rounded-[10px] border px-3 font-mono text-[11px]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--card-2)",
                  color: "var(--muted)",
                }}
              >
                {props.configPath}
              </div>
              <Button variant="secondary" onClick={props.onOpenConfigDir}>
                <FolderOpen className="h-4 w-4" />
                打开目录
              </Button>
            </div>
          </Field>
          <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--muted)" }}>
            <span>DeskReminder {props.version}</span>
            <span>Tauri 2 · React 19 · 本地运行</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow(props: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start gap-3">
        {props.icon ? (
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--card-2)", color: "var(--muted)" }}
          >
            {props.icon}
          </span>
        ) : null}
        <div>
          <div className="text-[13px] font-semibold">{props.title}</div>
          <p className="hint mt-0.5">{props.description}</p>
        </div>
      </div>
      <Switch
        checked={props.checked}
        onCheckedChange={props.onChange}
        aria-label={props.title}
      />
    </div>
  );
}
