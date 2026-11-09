import Link from "next/link";
import { Icon } from "@/components/icons";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-[8px]" : size === "lg" ? "h-10 w-10 rounded-[12px]" : "h-8 w-8 rounded-[9px]";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span
      className={`grid shrink-0 place-items-center bg-primary text-on-primary shadow-[var(--shadow-button)] ${box}`}
      aria-hidden="true"
    >
      <Icon name="captions" className={icon} />
    </span>
  );
}

export function Wordmark({
  label,
  href = "/",
  tone = "default",
  size = "md",
  className = "",
  hideLabelOnMobile = false,
}: {
  label: string;
  href?: string;
  tone?: "default" | "invert";
  size?: "sm" | "md";
  className?: string;
  hideLabelOnMobile?: boolean;
}) {
  const text = tone === "invert" ? "text-white" : "text-ink";
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg text-[0.9375rem] font-semibold tracking-[-0.02em] ${text} ${className}`}
    >
      <BrandMark size={size} />
      <span className={hideLabelOnMobile ? "hidden sm:inline" : ""}>{label}</span>
    </Link>
  );
}
