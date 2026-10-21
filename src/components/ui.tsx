import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "../lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "secondary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "btn",
          `btn-${variant}`,
          size === "sm" && "btn-sm",
          size === "icon" && "btn-icon",
          size === "icon-sm" && "btn-sm btn-icon",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("input", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("textarea", className)} {...props} />;
});

export function Field(props: {
  label?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={props.className}>
      {props.label ? (
        <label className="label" htmlFor={props.htmlFor}>
          {props.label}
        </label>
      ) : null}
      {props.children}
      {props.hint ? <div className="hint mt-1.5">{props.hint}</div> : null}
    </div>
  );
}

export function Switch(props: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <SwitchPrimitive.Root
      checked={props.checked}
      onCheckedChange={props.onCheckedChange}
      disabled={props.disabled}
      aria-label={props["aria-label"]}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
        props.disabled && "opacity-50",
        props.className,
      )}
      style={{ background: props.checked ? "var(--accent)" : "var(--track)" }}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          props.checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-[38px] w-full items-center justify-between gap-2 rounded-[10px] border px-3 text-[13px] outline-none transition",
        "hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]",
        className,
      )}
      style={{
        borderColor: "var(--border)",
        background: "var(--card-2)",
        color: "var(--text)",
      }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position="popper"
        sideOffset={6}
        className={cn("popover-content", className)}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn("menu-item", className)}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});

export const DropdownMenu = DropdownPrimitive.Root;

export const DropdownMenuTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Trigger>
>(function DropdownMenuTrigger({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Trigger
      ref={ref}
      className={cn("outline-none", className)}
      {...props}
    />
  );
});

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn("popover-content", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
});

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(function DropdownMenuItem({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn("menu-item", className)}
      {...props}
    />
  );
});

export function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialogPrimitive.Root
      open={props.open}
      onOpenChange={props.onOpenChange}
    >
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="overlay" />
        <AlertDialogPrimitive.Content className="dialog-content">
          <AlertDialogPrimitive.Title className="text-[15px] font-semibold">
            {props.title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description
            className="mt-2 text-[13px] leading-6"
            style={{ color: "var(--muted)" }}
          >
            {props.description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">取消</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button
                variant={props.destructive ? "danger" : "primary"}
                onClick={props.onConfirm}
                style={
                  props.destructive
                    ? { background: "var(--danger)", color: "#fff" }
                    : undefined
                }
              >
                {props.confirmText ?? "确定"}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={280}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip(props: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{props.children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={props.side ?? "top"}
          sideOffset={6}
          className="popover-content"
          style={{ minWidth: 0, padding: "6px 9px", fontSize: 12 }}
        >
          {props.label}
          <TooltipPrimitive.Arrow
            width={10}
            height={5}
            style={{ fill: "var(--card)" }}
          />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function NumberStepper(props: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const min = props.min ?? 0;
  const max = props.max ?? 9999;
  const step = props.step ?? 1;
  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  return (
    <div
      className={cn(
        "flex h-[38px] items-center rounded-[10px] border",
        props.className,
      )}
      style={{ borderColor: "var(--border)", background: "var(--card-2)" }}
    >
      <button
        type="button"
        aria-label="减少"
        className="flex h-full w-9 items-center justify-center rounded-l-[10px] transition-colors hover:bg-[var(--card)]"
        style={{ color: "var(--muted)" }}
        onClick={() => props.onChange(clamp(props.value - step))}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        aria-label={props["aria-label"]}
        type="number"
        className="w-11 bg-transparent text-center text-[13px] font-semibold tabular outline-none"
        value={Number.isFinite(props.value) ? props.value : 0}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          props.onChange(Number.isFinite(next) ? clamp(next) : min);
        }}
      />
      {props.suffix ? (
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>
          {props.suffix}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="增加"
        className="flex h-full w-9 items-center justify-center rounded-r-[10px] transition-colors hover:bg-[var(--card)]"
        style={{ color: "var(--muted)" }}
        onClick={() => props.onChange(clamp(props.value + step))}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("segmented", props.className)}>
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn("segment", props.value === option.value && "active")}
          onClick={() => props.onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Badge(props: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "accent" | "warning" | "success";
}) {
  const tone = props.tone ?? "default";
  const style =
    tone === "accent"
      ? { background: "var(--accent-soft)", color: "var(--accent-strong)" }
      : tone === "warning"
        ? { background: "rgba(245,158,11,.12)", color: "var(--warning)" }
        : tone === "success"
          ? { background: "rgba(16,185,129,.12)", color: "var(--success)" }
          : { background: "var(--card-2)", color: "var(--muted)" };
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-0 items-center rounded-full px-2.5 text-[11px] font-semibold",
        props.className,
      )}
      style={style}
    >
      {props.children}
    </span>
  );
}

export function TimeInput(props: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <input
      type="time"
      aria-label={props["aria-label"]}
      className={cn("input", props.className)}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
}
