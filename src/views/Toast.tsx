import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Check,
  Droplet,
  PersonStanding,
  Settings,
  Sparkles,
} from "lucide-react";
import { api, onToastShow } from "../lib/api";
import type { ToastPayload } from "../lib/types";
import { useResolvedTheme } from "../lib/use-theme";
import { cn } from "../lib/utils";

export function Toast() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [closing, setClosing] = useState(false);
  const hovered = useRef(false);
  const remainingRef = useRef(0);
  const closingRef = useRef(false);
  const payloadRef = useRef<ToastPayload | null>(null);
  payloadRef.current = payload;

  useResolvedTheme(payload?.theme ?? "system");

  useEffect(() => {
    document.body.classList.add("toast-body");
    let active = true;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const fn = await onToastShow((next) => {
          if (!active) return;
          payloadRef.current = next;
          closingRef.current = false;
          setClosing(false);
          setPayload(next);
          const total = Math.max(1000, next.durationSec * 1000);
          remainingRef.current = total;
          setRemaining(total);
        });
        if (!active) {
          fn();
          return;
        }
        unlisten = fn;
        await api.toastReady();
      } catch (error) {
        console.error(error);
      }
    })();
    return () => {
      active = false;
      unlisten?.();
      document.body.classList.remove("toast-body");
    };
  }, []);

  const close = (action: "done" | "snooze" | "timeout") => {
    const current = payloadRef.current;
    if (!current || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => {
      void api.toastAction(current.id, action).catch(console.error);
    }, 170);
  };

  useEffect(() => {
    if (!payload || closing) return;
    const timer = window.setInterval(() => {
      if (hovered.current) return;
      const next = Math.max(0, remainingRef.current - 100);
      remainingRef.current = next;
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        close("timeout");
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [payload?.id, closing]);

  if (!payload) {
    return <div className="toast-stage" />;
  }

  const total = Math.max(1000, payload.durationSec * 1000);
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  const Icon =
    payload.typeId === "water"
      ? Droplet
      : payload.typeId === "stand"
        ? PersonStanding
        : Sparkles;

  return (
    <div className="toast-stage">
      <div
        key={payload.id}
        className={cn("toast-card", closing ? "leaving" : "entering")}
        style={{ "--accent": payload.accent } as CSSProperties}
        onMouseEnter={() => {
          hovered.current = true;
        }}
        onMouseLeave={() => {
          hovered.current = false;
        }}
        aria-live="polite"
      >
        <div className="flex items-start gap-3 px-4 pb-3 pt-4">
          <div className="toast-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
            <Icon className="h-[21px] w-[21px]" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold tracking-tight">
                {payload.name}
              </h1>
              {payload.preview ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent-strong)",
                  }}
                >
                  预览
                </span>
              ) : null}
            </div>
            <p
              className="mt-1 line-clamp-2 text-[12.5px] leading-5"
              style={{ color: "var(--muted)" }}
            >
              {payload.message}
            </p>
          </div>
          <button
            type="button"
            aria-label="打开设置"
            title="打开设置"
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--card-2)]"
            style={{ color: "var(--muted)" }}
            onClick={() => void api.openSettings().catch(console.error)}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex items-center gap-2 px-4 pb-4">
          <button
            type="button"
            className="btn btn-primary btn-sm flex-1"
            onClick={() => close("done")}
          >
            <Check className="h-3.5 w-3.5" />
            完成了
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm flex-1"
            onClick={() => close("snooze")}
          >
            稍后 {payload.snoozeMin} 分钟
          </button>
        </div>

        <div className="toast-progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
