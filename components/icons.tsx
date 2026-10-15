import type { ReactNode } from "react";

export type IconName =
  | "menu" | "close" | "panel" | "folder" | "captions" | "settings" | "user"
  | "chevron" | "play" | "pause" | "volume" | "expand" | "upload" | "search" | "globe" | "skipBack" | "skipForward";

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      {paths(name)}
    </svg>
  );
}

function paths(name: IconName): ReactNode {
  if (name === "menu") return <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />;
  if (name === "close") return <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />;
  if (name === "panel") return <path d="M4 5h16v14H4zM9 5v14" strokeLinejoin="round" />;
  if (name === "folder") return <path d="M3 7h6l2 2h10v9H3z" strokeLinejoin="round" />;
  if (name === "captions") return <path d="M4 6h16v12H4zM7 11h4M7 14h7M13 11h4" strokeLinecap="round" strokeLinejoin="round" />;
  if (name === "settings") return <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM4 12h2M18 12h2M12 4v2M12 18v2" strokeLinecap="round" />;
  if (name === "user") return <path d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12zM5 19a7 7 0 0 1 14 0" strokeLinecap="round" />;
  if (name === "chevron") return <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />;
  if (name === "play") return <path d="M8 6l10 6-10 6z" strokeLinejoin="round" />;
  if (name === "skipBack") return <path d="M11 7l-6 5 6 5zM19 7l-6 5 6 5z" strokeLinejoin="round" />;
  if (name === "skipForward") return <path d="M5 7l6 5-6 5zM13 7l6 5-6 5z" strokeLinejoin="round" />;
  if (name === "pause") return <path d="M8 6v12M16 6v12" strokeLinecap="round" />;
  if (name === "volume") return <path d="M4 10h3l4-3v10l-4-3H4zM16 9a4 4 0 0 1 0 6" strokeLinecap="round" strokeLinejoin="round" />;
  if (name === "expand") return <path d="M8 4H4v4M16 4h4v4M4 16v4h4M20 16v4h-4" strokeLinecap="round" strokeLinejoin="round" />;
  if (name === "upload") return <path d="M12 16V6M8 9l4-4 4 4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />;
  if (name === "search") return <path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-3.5-3.5" strokeLinecap="round" />;
  return <path d="M12 4a8 8 0 1 0 8 8M4 12h16M12 4c2 2.2 3 4.8 3 8s-1 5.8-3 8c-2-2.2-3-4.8-3-8s1-5.8 3-8z" />;
}
