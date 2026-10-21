import { useState } from "react";
import {
  CalendarDays,
  Clock3,
  Copy,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { ReminderType } from "../lib/types";
import { ACCENT_PRESETS, WEEKDAYS, isTimeValue, ruleSummary } from "../lib/format";
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Input,
  NumberStepper,
  Segmented,
  Switch,
  Textarea,
  TimeInput,
} from "./ui";

export function TypeEditor(props: {
  rule: ReminderType;
  onChange: (patch: Partial<ReminderType>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  const { rule, onChange } = props;
  const [newTime, setNewTime] = useState("10:00");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const timeOutsideWindow =
    isTimeValue(newTime) &&
    (newTime < rule.windowStart || newTime > rule.windowEnd);
  const duplicate = rule.fixedTimes.includes(newTime);
  const canAddTime = isTimeValue(newTime) && !timeOutsideWindow && !duplicate;
  const accentIsPreset = ACCENT_PRESETS.includes(rule.accent.toUpperCase());

  const addTime = () => {
    if (!canAddTime) return;
    onChange({
      fixedTimes: [...rule.fixedTimes, newTime].sort((a, b) => a.localeCompare(b)),
    });
  };

  const removeTime = (value: string) => {
    onChange({ fixedTimes: rule.fixedTimes.filter((time) => time !== value) });
  };

  const toggleDay = (day: number) => {
    const exists = rule.days.includes(day);
    const next = exists
      ? rule.days.filter((value) => value !== day)
      : [...rule.days, day].sort((a, b) => a - b);
    if (next.length > 0) onChange({ days: next });
  };

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">基本信息</h2>
            <p className="hint mt-1">名称、文案和强调色会直接体现在提醒弹窗上。</p>
          </div>
          <div className="flex items-center gap-2.5 pt-0.5">
            <span className="text-[12px]" style={{ color: "var(--muted)" }}>
              启用
            </span>
            <Switch
              checked={rule.enabled}
              onCheckedChange={(checked) => onChange({ enabled: checked })}
              aria-label="启用提醒"
            />
          </div>
        </div>
        <div className="card-body grid grid-cols-2 gap-5">
          <Field label="提醒名称" hint="显示在提醒标题和左侧列表中。">
            <Input
              value={rule.name}
              maxLength={30}
              placeholder="例如：喝水"
              onChange={(event) => onChange({ name: event.target.value })}
            />
          </Field>
          <Field label="强调色" hint="用于类型图标和弹窗的渐变强调。">
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`使用颜色 ${color}`}
                  className="relative h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: color,
                    boxShadow:
                      rule.accent.toUpperCase() === color
                        ? `0 0 0 2px var(--card), 0 0 0 4px ${color}`
                        : "none",
                  }}
                  onClick={() => onChange({ accent: color })}
                />
              ))}
              <label
                className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border"
                style={{
                  background:
                    !accentIsPreset && /^#[0-9a-fA-F]{6}$/.test(rule.accent)
                      ? rule.accent
                      : "var(--card-2)",
                  borderColor: "var(--border)",
                }}
                title="自定义颜色"
              >
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(rule.accent) ? rule.accent : "#38BDF8"}
                  onChange={(event) => onChange({ accent: event.target.value.toUpperCase() })}
                  className="color-input"
                />
                <Plus
                  className="pointer-events-none h-3.5 w-3.5"
                  style={{
                    color: accentIsPreset ? "var(--muted)" : "#fff",
                    filter: accentIsPreset
                      ? "none"
                      : "drop-shadow(0 1px 2px rgba(0,0,0,.55))",
                  }}
                />
              </label>
            </div>
          </Field>
          <Field
            label="提醒文案"
            hint="最多 200 个字，会显示在提醒卡片正文。"
            className="col-span-2"
          >
            <Textarea
              value={rule.message}
              maxLength={200}
              rows={2}
              placeholder="提醒自己停下来休息一下"
              onChange={(event) => onChange({ message: event.target.value })}
              className="!min-h-[64px] resize-none"
            />
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">定时规则</h2>
            <p className="hint mt-1">所有提醒类型都支持独立的规则。</p>
          </div>
          <Badge
            tone="accent"
            className="max-w-[300px] truncate"
          >
            <span className="truncate" title={ruleSummary(rule)}>
              {ruleSummary(rule)}
            </span>
          </Badge>
        </div>
        <div className="card-body space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={rule.mode}
              onChange={(mode) =>
                onChange({
                  mode,
                  ...(mode === "fixed" && rule.fixedTimes.length === 0
                    ? { fixedTimes: ["10:00"] }
                    : {}),
                })
              }
              options={[
                { value: "interval", label: "按间隔", icon: <Clock3 className="h-3.5 w-3.5" /> },
                { value: "fixed", label: "固定时刻", icon: <CalendarDays className="h-3.5 w-3.5" /> },
              ]}
            />
            {rule.mode === "interval" ? (
              <div className="flex items-center gap-2.5">
                <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                  每隔
                </span>
                <NumberStepper
                  value={rule.intervalMin}
                  min={1}
                  max={720}
                  step={5}
                  suffix="分钟"
                  aria-label="提醒间隔"
                  onChange={(intervalMin) => onChange({ intervalMin })}
                />
              </div>
            ) : null}
          </div>

          {rule.mode === "fixed" ? (
            <Field
              label="固定时刻"
              hint={
                timeOutsideWindow
                  ? "该时刻不在生效时段内。"
                  : duplicate
                    ? "这个时刻已经添加过了。"
                    : "按 HH:MM 添加，回车即可；可添加多个时刻。"
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {rule.fixedTimes.map((time) => (
                  <span key={time} className="chip">
                    <Clock3 className="h-3 w-3" style={{ color: "var(--muted)" }} />
                    {time}
                    <button
                      type="button"
                      aria-label={`删除 ${time}`}
                      onClick={() => removeTime(time)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-2">
                  <TimeInput
                    value={newTime}
                    onChange={setNewTime}
                    className="!w-[108px]"
                    aria-label="新的固定时刻"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canAddTime}
                    onClick={addTime}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加
                  </Button>
                </div>
              </div>
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-5">
            <Field label="生效时段" hint="每天只在这个时间段内提醒，结束时刻不含。">
              <div className="flex items-center gap-2">
                <TimeInput
                  value={rule.windowStart}
                  aria-label="生效开始时间"
                  onChange={(windowStart) => onChange({ windowStart })}
                />
                <span style={{ color: "var(--subtle)" }}>–</span>
                <TimeInput
                  value={rule.windowEnd}
                  aria-label="生效结束时间"
                  onChange={(windowEnd) => onChange({ windowEnd })}
                />
              </div>
            </Field>
            <Field label="生效星期" hint="点击圆点切换；至少保留一天。">
              <div className="flex flex-wrap items-center gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    aria-label={`周${day.label}`}
                    className={`day-pill ${rule.days.includes(day.value) ? "active" : ""}`}
                    onClick={() => toggleDay(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
                <div className="ml-1 flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--card-2)]"
                    style={{ color: "var(--accent-strong)" }}
                    onClick={() => onChange({ days: [1, 2, 3, 4, 5] })}
                  >
                    工作日
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--card-2)]"
                    style={{ color: "var(--accent-strong)" }}
                    onClick={() => onChange({ days: [1, 2, 3, 4, 5, 6, 7] })}
                  >
                    每天
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--card-2)]"
                    style={{ color: "var(--muted)" }}
                    onClick={() => onChange({ days: [6, 7] })}
                  >
                    周末
                  </button>
                </div>
              </div>
            </Field>
          </div>

          <div
            className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
            style={{ borderColor: "var(--border)", background: "var(--card-2)" }}
          >
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
            <div className="text-[12px] leading-5" style={{ color: "var(--muted)" }}>
              {ruleSummary(rule)}
              {rule.mode === "interval" ? (
                <span>
                  ，首次在 {rule.windowStart} 之后一个间隔弹出。
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="text-[15px] font-semibold">提醒方式</h2>
            <p className="hint mt-1">控制弹窗停留时间和稍后提醒的间隔。</p>
          </div>
        </div>
        <div className="card-body grid grid-cols-2 gap-5">
          <Field label="弹窗停留" hint="超时后自动收起，不会打断当前操作。">
            <NumberStepper
              value={rule.popupSec}
              min={3}
              max={60}
              suffix="秒"
              aria-label="弹窗停留秒数"
              onChange={(popupSec) => onChange({ popupSec })}
            />
          </Field>
          <Field label="稍后提醒" hint="点击“稍后”后延后多久再次弹出。">
            <NumberStepper
              value={rule.snoozeMin}
              min={1}
              max={120}
              suffix="分钟"
              aria-label="稍后提醒分钟数"
              onChange={(snoozeMin) => onChange({ snoozeMin })}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 pb-2">
        <Button variant="ghost" onClick={props.onDuplicate}>
          <Copy className="h-4 w-4" />
          复制提醒
        </Button>
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          <RotateCcw className="h-4 w-4" />
          恢复默认
        </Button>
        <div className="ml-auto">
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            删除提醒
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="删除这个提醒？"
        description={`「${rule.name}」会被移除，此操作不可撤销。`}
        confirmText="删除"
        destructive
        onConfirm={props.onDelete}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="恢复默认设置？"
        description="提醒的名称、文案、颜色和定时规则会恢复为默认值。"
        confirmText="恢复默认"
        onConfirm={props.onReset}
      />
    </div>
  );
}
