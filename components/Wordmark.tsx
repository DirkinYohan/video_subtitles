import Link from "next/link";
import { Icon } from "@/components/icons";

/**
 * Marca del producto.
 *
 * Un cuadrado con el icono de subtítulos y el nombre. Sin degradados ni
 * sombras de color: la identidad la da la forma, no el brillo.
 */
export function Wordmark({
  label,
  href = "/",
  tone = "default",
  size = "md",
  className = "",
}: {
  label: string;
  href?: string;
  tone?: "default" | "invert";
  size?: "sm" | "md";
  className?: string;
}) {
  const box =
    tone === "invert"
      ? "bg-paper text-ink"
      : "bg-ink text-paper";
  const text = tone === "invert" ? "text-paper" : "text-ink";
  const boxSize = size === "sm" ? "h-7 w-7 rounded-md" : "h-8 w-8 rounded-lg";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg text-sm font-semibold tracking-tight ${text} ${className}`}
    >
      <span className={`grid place-items-center ${boxSize} ${box}`}>
        <Icon name="captions" className={iconSize} />
      </span>
      <span>{label}</span>
    </Link>
  );
}
