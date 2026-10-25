import type { ReactNode } from "react";

export type IconName =
  | "menu" | "close" | "panel" | "folder" | "captions" | "settings" | "user"
  | "chevron" | "play" | "pause" | "volume" | "expand" | "upload" | "search" | "globe"
  | "skipBack" | "skipForward"
  | "plus" | "minus" | "more" | "check" | "download" | "pencil" | "trash" | "clock" | "alert" | "spark"
  | "arrowLeft";

/**
 * Iconos de la interfaz.
 *
 * Una sola familia, un solo grosor de trazo (1.75) y siempre desde aquí:
 * ningún carácter Unicode ni emoji hace de icono. Todos comparten la misma
 * retícula de 24×24 para que el peso visual sea consistente.
 */
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths(name)}
    </svg>
  );
}

function paths(name: IconName): ReactNode {
  switch (name) {
    case "menu":
      return <path d="M4 7h16M4 12h16M4 17h16" />;
    case "close":
      return <path d="M6 6l12 12M18 6L6 18" />;
    case "panel":
      return <path d="M4 5h16v14H4zM9 5v14" />;
    case "folder":
      return <path d="M3 7h6l2 2h10v9H3z" />;
    case "captions":
      return <path d="M4 6h16v12H4zM7 11h4M7 14h7M13 11h4" />;
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </>
      );
    case "chevron":
      return <path d="M8 10l4 4 4-4" />;
    case "play":
      return <path d="M9 6.5l9 5.5-9 5.5z" />;
    case "pause":
      return <path d="M9 6v12M15 6v12" />;
    case "skipBack":
      return <path d="M11 7l-6 5 6 5zM19 7l-6 5 6 5z" />;
    case "skipForward":
      return <path d="M5 7l6 5-6 5zM13 7l6 5-6 5z" />;
    case "volume":
      return <path d="M4 10h3l4-3v10l-4-3H4zM16 9a4 4 0 0 1 0 6" />;
    case "expand":
      return <path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4" />;
    case "upload":
      return <path d="M12 16V6M8 9l4-4 4 4M5 19h14" />;
    case "download":
      return <path d="M12 5v10M8 12l4 4 4-4M5 19h14" />;
    case "search":
      return (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4-4" />
        </>
      );
    case "plus":
      return <path d="M12 5v14M5 12h14" />;
    case "arrowLeft":
      return <path d="M19 12H5M11 6l-6 6 6 6" />;
    case "minus":
      return <path d="M5 12h14" />;
    case "more":
      return (
        <>
          <circle cx="12" cy="5.5" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
          <circle cx="12" cy="18.5" r="1.25" fill="currentColor" stroke="none" />
        </>
      );
    case "check":
      return <path d="M5 12.5l4.5 4.5L19 7" />;
    case "pencil":
      return <path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4" />;
    case "trash":
      return <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />;
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5l3 1.5" />
        </>
      );
    case "alert":
      return <path d="M12 4l9 16H3zM12 10v4M12 17.2v.1" />;
    case "spark":
      return <path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8z" />;
    case "globe":
    default:
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16M12 4c2 2.2 3 4.8 3 8s-1 5.8-3 8c-2-2.2-3-4.8-3-8s1-5.8 3-8z" />
        </>
      );
  }
}
