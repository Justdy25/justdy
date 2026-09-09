"use client";

import * as React from "react";

type JustdyTheme = "light" | "dark";

interface JustdyThemeContextValue {
  theme: JustdyTheme;
  setTheme: (theme: JustdyTheme) => void;
  toggleTheme: () => void;
  mounted: boolean;
}

const JustdyThemeContext = React.createContext<JustdyThemeContextValue | null>(
  null,
);

const STORAGE_KEY = "justdy-theme";

function getSystemTheme(): JustdyTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): JustdyTheme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return null;
}

function applyTheme(theme: JustdyTheme, persist = true) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  if (persist) {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
}

interface ThemeStore {
  theme: JustdyTheme;
  mounted: boolean;
  listeners: Set<() => void>;
}

function createThemeStore(): ThemeStore {
  return {
    theme: "light",
    mounted: false,
    listeners: new Set(),
  };
}

function emitThemeStoreChange(store: ThemeStore) {
  store.listeners.forEach((listener) => {
    listener();
  });
}

function subscribeToThemeStore(
  store: ThemeStore,
  listener: () => void,
): () => void {
  store.listeners.add(listener);

  return () => {
    store.listeners.delete(listener);
  };
}

function getThemeSnapshot(store: ThemeStore): JustdyTheme {
  return store.theme;
}

function getMountedSnapshot(store: ThemeStore): boolean {
  return store.mounted;
}

function setStoreTheme(store: ThemeStore, theme: JustdyTheme) {
  if (store.theme === theme) {
    return;
  }

  store.theme = theme;
  emitThemeStoreChange(store);
}

function setStoreMounted(store: ThemeStore, mounted: boolean) {
  if (store.mounted === mounted) {
    return;
  }

  store.mounted = mounted;
  emitThemeStoreChange(store);
}

export function JustdyThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * The store is created through a lazy state initializer so it is stable
   * for the lifetime of this provider without reading or mutating a ref
   * during render.
   */
  const [store] = React.useState<ThemeStore>(createThemeStore);

  const theme = React.useSyncExternalStore(
    React.useCallback(
      (listener: () => void) => subscribeToThemeStore(store, listener),
      [store],
    ),
    React.useCallback(() => getThemeSnapshot(store), [store]),
    (): JustdyTheme => "light",
  );

  const mounted = React.useSyncExternalStore(
    React.useCallback(
      (listener: () => void) => subscribeToThemeStore(store, listener),
      [store],
    ),
    React.useCallback(() => getMountedSnapshot(store), [store]),
    (): boolean => false,
  );

  React.useEffect(() => {
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme ?? getSystemTheme();

    setStoreTheme(store, initialTheme);
    applyTheme(initialTheme, Boolean(storedTheme));
    setStoreMounted(store, true);

    if (storedTheme) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const savedTheme = getStoredTheme();

      // Once the user manually chooses a theme, stop following
      // the operating system preference.
      if (savedTheme) {
        return;
      }

      const nextTheme: JustdyTheme = event.matches ? "dark" : "light";

      setStoreTheme(store, nextTheme);
      applyTheme(nextTheme, false);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [store]);

  const setTheme = React.useCallback(
    (nextTheme: JustdyTheme) => {
      setStoreTheme(store, nextTheme);
      applyTheme(nextTheme, true);
    },
    [store],
  );

  const toggleTheme = React.useCallback(() => {
    const nextTheme: JustdyTheme = store.theme === "dark" ? "light" : "dark";

    setStoreTheme(store, nextTheme);
    applyTheme(nextTheme, true);
  }, [store]);

  const value = React.useMemo<JustdyThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      mounted,
    }),
    [theme, setTheme, toggleTheme, mounted],
  );

  return (
    <JustdyThemeContext.Provider value={value}>
      {children}
    </JustdyThemeContext.Provider>
  );
}

export function useJustdyTheme() {
  const context = React.useContext(JustdyThemeContext);

  if (!context) {
    throw new Error(
      "useJustdyTheme must be used inside <JustdyThemeProvider>.",
    );
  }

  return context;
}
