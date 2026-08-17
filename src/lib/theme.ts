// Light / dark theme preference, shared by every role. The choice is stored in
// localStorage and applied by toggling the `dark` class on <html>.
import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
const KEY = "eg.theme";

function apply(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) as ThemeMode | null;
    const initial: ThemeMode =
      stored ??
      (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(initial);
    apply(initial);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { mode, toggle };
}
