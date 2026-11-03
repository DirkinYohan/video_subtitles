import Link from "next/link";
import { Icon } from "@/components/icons";

/**
 * Marca del producto.
 *
 * Un cuadrado con el degradado de la marca (índigo → violeta, la familia del
 * acento) y el icono de subtítulos. Es el único sitio, junto a la portada,
 * donde aparece el degradado: la marca se reconoce sin teñir la interfaz.
 */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-7 w-7 rounded-lg" : size === "lg" ? "h-10 w-10 rounded-xl" : "h-8 w-8 rounded-[10px]";
  const icon = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span className={`brand-mark grid shrink-0 place-items-center ${box}`} aria-hidden="true">
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
      className={`group flex items-center gap-2.5 rounded-lg text-[0.9375rem] font-semibold tracking-[-0.01em] ${text} ${className}`}
    >
      <span className="transition-transform duration-300 ease-out group-hover:rotate-[-6deg] group-hover:scale-105">
        <BrandMark size={size} />
      </span>
      <span className={hideLabelOnMobile ? "hidden sm:inline" : ""}>{label}</span>
    </Link>
  );
}
