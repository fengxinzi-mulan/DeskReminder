import { Droplet, PersonStanding, Sparkles } from "lucide-react";
import type { ReminderType } from "../lib/types";
import { cn } from "../lib/utils";

export function TypeIcon(props: {
  rule: Pick<ReminderType, "id" | "accent" | "name">;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon =
    props.rule.id === "water"
      ? Droplet
      : props.rule.id === "stand"
        ? PersonStanding
        : Sparkles;
  const color = /^#[0-9a-fA-F]{6}$/.test(props.rule.accent)
    ? props.rule.accent
    : "#38BDF8";
  return (
    <span
      className={cn(
        "icon-tile type-icon",
        props.size === "sm" && "!h-8 !w-8 !rounded-[10px]",
        props.className,
      )}
      style={{ background: `${color}1F`, color }}
    >
      <Icon className={props.size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} />
    </span>
  );
}
