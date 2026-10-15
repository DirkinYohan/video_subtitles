import type { MessageKey } from "@/lib/i18n";

const KNOWN = [
  "PENDING", "QUEUED", "PROCESSING", "TRANSCRIBING", "TRANSLATING",
  "GENERATING_SUBTITLES", "COMPLETED", "FAILED", "CANCELLED", "SUCCESS", "PARTIAL",
] as const;

export function statusKey(status: string): MessageKey {
  if ((KNOWN as readonly string[]).includes(status)) return `status.${status}` as MessageKey;
  return "status.PENDING";
}

export function statusTone(status: string): "neutral" | "ok" | "warn" | "danger" {
  if (status === "COMPLETED" || status === "SUCCESS") return "ok";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "PARTIAL" || status === "PENDING" || status === "QUEUED") return "warn";
  return "neutral";
}

export function isDone(status: string): boolean {
  return status === "COMPLETED" || status === "SUCCESS" || status === "PARTIAL";
}

export function isFailed(status: string): boolean {
  return status === "FAILED" || status === "CANCELLED";
}

export function isActive(status: string): boolean {
  return !isDone(status) && !isFailed(status);
}
