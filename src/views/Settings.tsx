import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Check,
  Info,
  ListChecks,
  Loader2,
  Pause,
  Play,
  Plus,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import type { Config, General, ReminderType, Snapshot, Status } from "../lib/types";
import { api, onConfig, onReminderDeleted, onStatus } from "../lib/api";
import { useResolvedTheme } from "../lib/use-theme";
import { kindOf, makeDefaultType, newId } from "../lib/defaults";
import { shortRuleSummary, statusText, statusTone } from "../lib/format";
import { TypeIcon } from "../components/type-icon";
import { TypeEditor } from "../components/TypeEditor";
import { GeneralPanel } from "../components/GeneralPanel";
import { AboutPanel } from "../components/AboutPanel";
import {
  Badge,
  Button,
  Switch,
  Tooltip,
  TooltipProvider,
} from "../components/ui";
import { cn } from "../lib/utils";

type Page = "types" | "general" | "about";
type SaveState = "idle" | "saving" | "saved" | "error";

export function Settings() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [page, setPage] = useState<Page>("types");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  useResolvedTheme(config?.general.theme ?? "system");
  const selected = useMemo(
    () => config?.types.find((rule) => rule.id === selectedId) ?? null,
    [config, selectedId],
  );

  // 后端可能删除已触发的一次性提醒，选中项随之失效。
  useEffect(() => {
    if (!config) return;
    if (selectedId && !config.types.some((rule) => rule.id === selectedId)) {
      setSelectedId(config.types[0]?.id ?? null);
    }
  }, [config, selectedId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next = await api.snapshot();
        if (!alive) return;
        setSnapshot(next);
        setConfig(next.config);
        setStatus(next.status);
        setSelectedId(next.config.types[0]?.id ?? null);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        await api.frontendReady();
      } catch (error) {
        if (!alive) return;
        setLoadError(String(error));
        void api.frontendReady().catch(() => undefined);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];
    void onStatus((next) => {
      if (active) setStatus(next);
    }).then((unlisten) => {
      if (active) unlisteners.push(unlisten);
      else unlisten();
    });
    void onConfig((next) => {
      if (!active) return;
      setConfig((previous) =>
        previous
          ? {
              ...previous,
              general: {
                ...previous.general,
                autoStart: next.general.autoStart,
              },
            }
          : next,
      );
    }).then((unlisten) => {
      if (active) unlisteners.push(unlisten);
      else unlisten();
    });
    void onReminderDeleted((typeId) => {
      if (!active) return;
      setConfig((previous) =>
        previous
          ? {
              ...previous,
              types: previous.types.filter((rule) => rule.id !== typeId),
            }
          : previous,
      );
    }).then((unlisten) => {
      if (active) unlisteners.push(unlisten);
      else unlisten();
    });
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  const initialized = useRef(false);
  const ignoreNext = useRef(false);
  const saveSeq = useRef(0);

  useEffect(() => {
    if (!config) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (ignoreNext.current) {
      ignoreNext.current = false;
      return;
    }
    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      const seq = ++saveSeq.current;
      try {
        const saved = await api.saveConfig(config);
        if (seq !== saveSeq.current) return;
        setSaveState("saved");
        setSaveError(null);
        if (JSON.stringify(saved) !== JSON.stringify(config)) {
          ignoreNext.current = true;
          setConfig(saved);
        }
      } catch (error) {
        if (seq !== saveSeq.current) return;
        setSaveState("error");
        setSaveError(String(error));
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [config]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = window.setTimeout(() => setSaveState("idle"), 2200);
    return () => window.clearTimeout(timer);
  }, [saveState]);

  const patchType = (id: string, patch: Partial<ReminderType>) => {
    setConfig((previous) =>
      previous
        ? {
            ...previous,
            types: previous.types.map((rule) =>
              rule.id === id ? { ...rule, ...patch } : rule,
            ),
          }
        : previous,
    );
  };

  const patchGeneral = (patch: Partial<General>) => {
    setConfig((previous) =>
      previous
        ? { ...previous, general: { ...previous.general, ...patch } }
        : previous,
    );
  };

  const addType = () => {
    const rule = makeDefaultType("custom");
    setConfig((previous) =>
      previous ? { ...previous, types: [...previous.types, rule] } : previous,
    );
    setSelectedId(rule.id);
    setPage("types");
    setWelcomeDismissed(true);
  };

  const duplicateType = (rule: ReminderType) => {
    const copy: ReminderType = {
      ...rule,
      id: newId(),
      name: `${rule.name} 副本`,
      days: [...rule.days],
      fixedTimes: [...rule.fixedTimes],
    };
    setConfig((previous) => {
      if (!previous) return previous;
      const index = previous.types.findIndex((item) => item.id === rule.id);
      const types = [...previous.types];
      types.splice(index + 1, 0, copy);
      return { ...previous, types };
    });
    setSelectedId(copy.id);
    setPage("types");
  };

  const deleteType = (rule: ReminderType) => {
    const remaining =
      config?.types.filter((item) => item.id !== rule.id) ?? [];
    setConfig((previous) =>
      previous
        ? {
            ...previous,
            types: previous.types.filter((item) => item.id !== rule.id),
          }
        : previous,
    );
    setSelectedId(remaining[0]?.id ?? null);
  };

  const resetType = (rule: ReminderType) => {
    const template = makeDefaultType(kindOf(rule), rule.id);
    patchType(rule.id, template);
  };

  const preview = async () => {
    if (!selected || !config) return;
    try {
      await api.previewToast(selected, config.general.theme);
      setSaveError(null);
    } catch (error) {
      setSaveError(String(error));
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
      setSaveError(null);
    } catch (error) {
      setSaveError(String(error));
    }
  };

  const pageTitle =
    page === "types" ? "提醒计划" : page === "general" ? "偏好设置" : "关于";
  const pageSubtitle =
    page === "types"
      ? "管理内置与自定义提醒，所有改动都会自动保存。"
      : page === "general"
        ? "调整外观、启动方式和提醒行为。"
        : "了解桌面提醒的工作方式与边界。";

  return (
    <TooltipProvider>
      <div className="flex h-full min-w-0">
        <aside
          className="flex w-[252px] shrink-0 flex-col border-r"
          style={{ background: "var(--sidebar)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3 px-5 pb-5 pt-6">
            <div className="brand-icon flex items-center justify-center">
              <Sparkles className="h-[19px] w-[19px]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight">
                桌面提醒
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--subtle)" }}>
                DeskReminder
              </div>
            </div>
          </div>

          <nav className="px-3">
            <NavItem
              active={page === "types"}
              icon={<ListChecks className="h-4 w-4" />}
              label="提醒计划"
              onClick={() => setPage("types")}
            />
            <NavItem
              active={page === "general"}
              icon={<Settings2 className="h-4 w-4" />}
              label="偏好设置"
              onClick={() => setPage("general")}
            />
            <NavItem
              active={page === "about"}
              icon={<Info className="h-4 w-4" />}
              label="关于"
              onClick={() => setPage("about")}
            />
          </nav>

          <div className="mt-5 flex items-center justify-between px-5 pb-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--subtle)" }}
            >
              提醒类型
            </span>
            <Tooltip label="新建自定义提醒">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="新建提醒"
                onClick={addType}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <div className="space-y-1">
              {config?.types.map((rule) => (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "type-item cursor-pointer",
                    page === "types" && selectedId === rule.id && "active",
                  )}
                  onClick={() => {
                    setSelectedId(rule.id);
                    setPage("types");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(rule.id);
                      setPage("types");
                    }
                  }}
                >
                  <TypeIcon rule={rule} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {rule.name || "未命名提醒"}
                    </div>
                    <div
                      className="truncate text-[10.5px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {rule.enabled ? shortRuleSummary(rule) : "已停用"}
                    </div>
                  </div>
                  <span onClick={(event) => event.stopPropagation()}>
                    <Switch
                      checked={rule.enabled}
                      aria-label={`启用 ${rule.name}`}
                      onCheckedChange={(enabled) =>
                        patchType(rule.id, { enabled })
                      }
                    />
                  </span>
                </div>
              ))}
              {config && config.types.length === 0 ? (
                <div className="hint px-2 py-6 text-center">还没有提醒类型</div>
              ) : null}
            </div>
          </div>

          <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--muted)" }}>
              <span className={cn("status-dot", statusTone(status))} />
              <span className="truncate">{statusText(status)}</span>
            </div>
            {status?.pausedUntil ? (
              <button
                type="button"
                className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: "var(--accent-strong)" }}
                onClick={() => runAction(() => api.pause(null))}
              >
                <Play className="h-3 w-3" />
                恢复提醒
              </button>
            ) : null}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-6">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">
                {pageTitle}
              </h1>
              <p className="hint mt-1">{pageSubtitle}</p>
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              <SaveIndicator state={saveState} />
              {page === "types" && selected ? (
                <Button variant="primary" size="sm" onClick={preview}>
                  <Sparkles className="h-3.5 w-3.5" />
                  预览提醒
                </Button>
              ) : null}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
            {loadError ? (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px]"
                style={{
                  borderColor: "rgba(239,68,68,.3)",
                  background: "rgba(239,68,68,.08)",
                  color: "var(--danger)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="whitespace-pre-line">{loadError}</div>
              </div>
            ) : null}

            {saveError ? (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px]"
                style={{
                  borderColor: "rgba(239,68,68,.3)",
                  background: "rgba(239,68,68,.08)",
                  color: "var(--danger)",
                }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1 whitespace-pre-line">{saveError}</div>
                <button
                  type="button"
                  aria-label="关闭错误提示"
                  onClick={() => setSaveError(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            {snapshot?.firstRun && !welcomeDismissed ? (
              <div className="welcome-banner mb-5 px-6 py-5">
                <div className="relative z-10 flex items-start justify-between gap-6">
                  <div>
                    <Badge tone="accent">首次使用</Badge>
                    <h2 className="mt-3 text-[17px] font-semibold">
                      欢迎使用桌面提醒
                    </h2>
                    <p className="mt-1.5 max-w-lg text-[12.5px] leading-6" style={{ color: "var(--muted)" }}>
                      已经内置「喝水」和「起立活动」两个提醒。你可以修改它们的规则，
                      也可以新建完全自定义的提醒类型。所有设置会自动保存。
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <Button variant="primary" size="sm" onClick={() => setWelcomeDismissed(true)}>
                        开始设置
                      </Button>
                      <Button variant="ghost" size="sm" onClick={preview}>
                        预览一条提醒
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="关闭欢迎提示"
                    className="rounded-lg p-1 transition-colors hover:bg-[var(--card-2)]"
                    style={{ color: "var(--muted)" }}
                    onClick={() => setWelcomeDismissed(true)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {status?.pausedUntil ? (
              <div
                className="mb-5 flex items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: "rgba(245,158,11,.3)",
                  background: "rgba(245,158,11,.08)",
                }}
              >
                <Pause className="h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} />
                <div className="min-w-0 flex-1 text-[12px]" style={{ color: "var(--text)" }}>
                  提醒已暂停，{statusText(status)}。恢复后会从下一次计划重新开始。
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runAction(() => api.pause(null))}
                >
                  恢复
                </Button>
              </div>
            ) : null}

            {page === "types" ? (
              selected && config ? (
                <TypeEditor
                  key={selected.id}
                  rule={selected}
                  onChange={(patch) => patchType(selected.id, patch)}
                  onDuplicate={() => duplicateType(selected)}
                  onDelete={() => deleteType(selected)}
                  onReset={() => resetType(selected)}
                />
              ) : (
                <EmptyState onAdd={addType} />
              )
            ) : null}

            {page === "general" && config ? (
              <GeneralPanel
                general={config.general}
                status={status}
                configPath={snapshot?.configPath ?? ""}
                version={snapshot?.version ?? "1.1.2"}
                onChange={patchGeneral}
                onPause={(minutes) => runAction(() => api.pause(minutes))}
                onPauseToday={() => runAction(() => api.pauseToday())}
                onResume={() => runAction(() => api.pause(null))}
                onOpenConfigDir={() => runAction(() => api.openConfigDir())}
              />
            ) : null}

            {page === "about" ? (
              <AboutPanel version={snapshot?.version ?? "1.1.2"} />
            ) : null}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function NavItem(props: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn("nav-item", props.active && "active")}
      onClick={props.onClick}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

function SaveIndicator(props: { state: SaveState }) {
  if (props.state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        保存中
      </span>
    );
  }
  if (props.state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--danger)" }}>
        <AlertCircle className="h-3.5 w-3.5" />
        保存失败
      </span>
    );
  }
  if (props.state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--success)" }}>
        <Check className="h-3.5 w-3.5" />
        已保存
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--subtle)" }}>
      <Check className="h-3.5 w-3.5" />
      自动保存
    </span>
  );
}

function EmptyState(props: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-[16px] font-semibold">还没有提醒类型</h2>
      <p className="hint mt-1 max-w-sm">
        新建一个提醒，设置自己的文案、间隔和生效时间。
      </p>
      <Button variant="primary" className="mt-5" onClick={props.onAdd}>
        <Plus className="h-4 w-4" />
        新建提醒
      </Button>
    </div>
  );
}
