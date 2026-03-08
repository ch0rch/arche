"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_CHAT_FONT_FAMILY,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_THEME_ID,
  getWorkspaceChatFontFamilyCookieName,
  getWorkspaceChatFontFamilyStorageKey,
  getWorkspaceChatFontSizeCookieName,
  getWorkspaceChatFontSizeStorageKey,
  getWorkspaceThemeCookieName,
  getWorkspaceThemeStorageKey,
  isWorkspaceChatFontFamily,
  isWorkspaceChatFontSize,
  isWorkspaceThemeId,
  WORKSPACE_CHAT_FONT_SIZES,
  type WorkspaceChatFontFamily,
  type WorkspaceChatFontSize,
  type WorkspaceThemeId,
} from '@/lib/workspace-theme'

export { DEFAULT_CHAT_FONT_FAMILY, DEFAULT_CHAT_FONT_SIZE, DEFAULT_THEME_ID } from '@/lib/workspace-theme'

export type DarkVariant = "ember" | "ash" | "nuclear";

export type WorkspaceTheme = {
  id: WorkspaceThemeId;
  name: string;
  /** Preview swatch colors for the picker UI */
  swatches: [string, string];
  /** Whether this theme uses dark mode colors */
  isDark: boolean;
  /** Dark mode color variant (only for dark themes) */
  darkVariant?: DarkVariant;
};

export const WORKSPACE_THEMES: Record<WorkspaceThemeId, WorkspaceTheme> = {
  "warm-papyrus": {
    id: "warm-papyrus",
    name: "Warm Papyrus",
    swatches: ["hsl(44 42% 93%)", "hsl(28 78% 58%)"],
    isDark: false,
  },
  "warm-sand": {
    id: "warm-sand",
    name: "Warm Sand",
    swatches: ["hsl(40 20% 97%)", "hsl(35 18% 92%)"],
    isDark: false,
  },
  "ocean-mist": {
    id: "ocean-mist",
    name: "Ocean Mist",
    swatches: ["hsl(200 25% 96%)", "hsl(195 30% 88%)"],
    isDark: false,
  },
  "forest-dew": {
    id: "forest-dew",
    name: "Forest Dew",
    swatches: ["hsl(140 18% 96%)", "hsl(150 25% 88%)"],
    isDark: false,
  },
  "lavender-haze": {
    id: "lavender-haze",
    name: "Lavender Haze",
    swatches: ["hsl(270 20% 97%)", "hsl(275 28% 90%)"],
    isDark: false,
  },
  "sunset-glow": {
    id: "sunset-glow",
    name: "Sunset Glow",
    swatches: ["hsl(25 30% 96%)", "hsl(340 30% 90%)"],
    isDark: false,
  },
  "midnight-ember": {
    id: "midnight-ember",
    name: "Midnight Ember",
    swatches: ["hsl(20 14% 14%)", "hsl(24 85% 55%)"],
    isDark: true,
    darkVariant: "ember",
  },
  "midnight-ash": {
    id: "midnight-ash",
    name: "Midnight Ash",
    swatches: ["hsl(0 0% 14%)", "hsl(24 85% 55%)"],
    isDark: true,
    darkVariant: "ash",
  },
  "nuclear": {
    id: "nuclear",
    name: "Nuclear",
    swatches: ["hsl(120 8% 10%)", "hsl(120 80% 50%)"],
    isDark: true,
    darkVariant: "nuclear",
  },
};

const ROOT_THEME_OWNER_ATTR = "data-arche-theme-owner";
const ALL_THEME_CLASSES = Object.keys(WORKSPACE_THEMES).map((id) => `theme-${id}`);
const ALL_DARK_VARIANT_CLASSES = ["dark-ember", "dark-ash", "dark-nuclear"];
const MIN_CHAT_FONT_SIZE = WORKSPACE_CHAT_FONT_SIZES[0]
const MAX_CHAT_FONT_SIZE = WORKSPACE_CHAT_FONT_SIZES[WORKSPACE_CHAT_FONT_SIZES.length - 1]

function readStoredThemeId(storageKey: string): WorkspaceThemeId | null {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored && isWorkspaceThemeId(stored) ? stored : null
  } catch {
    return null
  }
}

function readStoredChatFontSize(storageKey: string): WorkspaceChatFontSize | null {
  try {
    const stored = window.localStorage.getItem(storageKey)
    const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN
    return isWorkspaceChatFontSize(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readStoredChatFontFamily(storageKey: string): WorkspaceChatFontFamily | null {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored && isWorkspaceChatFontFamily(stored) ? stored : null
  } catch {
    return null
  }
}

function persistThemeCookie(scope: string, themeId: WorkspaceThemeId) {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${getWorkspaceThemeCookieName(scope)}=${themeId}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function persistChatFontSizeCookie(scope: string, chatFontSize: WorkspaceChatFontSize) {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${getWorkspaceChatFontSizeCookieName(scope)}=${chatFontSize}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function persistChatFontFamilyCookie(scope: string, chatFontFamily: WorkspaceChatFontFamily) {
  if (typeof document === 'undefined') return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${getWorkspaceChatFontFamilyCookieName(scope)}=${chatFontFamily}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function applyThemeClasses(root: HTMLElement, theme: WorkspaceTheme) {
  root.classList.remove(...ALL_THEME_CLASSES, "dark", ...ALL_DARK_VARIANT_CLASSES);
  root.classList.add(`theme-${theme.id}`);
  if (theme.isDark) {
    root.classList.add("dark");
    if (theme.darkVariant) {
      root.classList.add(`dark-${theme.darkVariant}`);
    }
  }
}

type WorkspaceThemeContextValue = {
  theme: WorkspaceTheme;
  themeId: WorkspaceThemeId;
  chatFontFamily: WorkspaceChatFontFamily;
  chatFontSize: WorkspaceChatFontSize;
  setChatFontFamily: (family: WorkspaceChatFontFamily) => void;
  canDecreaseChatFontSize: boolean;
  canIncreaseChatFontSize: boolean;
  decreaseChatFontSize: () => void;
  increaseChatFontSize: () => void;
  setChatFontSize: (size: WorkspaceChatFontSize) => void;
  setThemeId: (id: WorkspaceThemeId) => void;
  themes: WorkspaceTheme[];
};

const WorkspaceThemeContext = createContext<WorkspaceThemeContextValue | null>(
  null
);

export function WorkspaceThemeProvider({
  children,
  storageScope = "global",
  initialChatFontFamily = DEFAULT_CHAT_FONT_FAMILY,
  initialChatFontSize = DEFAULT_CHAT_FONT_SIZE,
  initialThemeId = DEFAULT_THEME_ID,
}: {
  children: ReactNode;
  storageScope?: string;
  initialChatFontFamily?: WorkspaceChatFontFamily;
  initialChatFontSize?: WorkspaceChatFontSize;
  initialThemeId?: WorkspaceThemeId;
}) {
  const chatFontFamilyStorageKey = useMemo(() => getWorkspaceChatFontFamilyStorageKey(storageScope), [storageScope]);
  const chatFontSizeStorageKey = useMemo(() => getWorkspaceChatFontSizeStorageKey(storageScope), [storageScope]);
  const storageKey = useMemo(() => getWorkspaceThemeStorageKey(storageScope), [storageScope]);
  const rootThemeOwnerId = useId();

  const [chatFontFamily, setChatFontFamilyState] = useState<WorkspaceChatFontFamily>(initialChatFontFamily)
  const [chatFontSize, setChatFontSizeState] = useState<WorkspaceChatFontSize>(initialChatFontSize)
  const [themeId, setThemeIdState] = useState<WorkspaceThemeId>(initialThemeId)

  const setThemeId = useCallback(
    (id: WorkspaceThemeId) => {
      setThemeIdState(id)
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storageKey, id);
        } catch {
          // ignore storage errors
        }
        persistThemeCookie(storageScope, id)
      }
    },
    [storageKey, storageScope]
  );

  const setChatFontSize = useCallback(
    (size: WorkspaceChatFontSize) => {
      setChatFontSizeState(size)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(chatFontSizeStorageKey, String(size))
        } catch {
          // ignore storage errors
        }
        persistChatFontSizeCookie(storageScope, size)
      }
    },
    [chatFontSizeStorageKey, storageScope]
  )

  const setChatFontFamily = useCallback(
    (family: WorkspaceChatFontFamily) => {
      setChatFontFamilyState(family)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(chatFontFamilyStorageKey, family)
        } catch {
          // ignore storage errors
        }
        persistChatFontFamilyCookie(storageScope, family)
      }
    },
    [chatFontFamilyStorageKey, storageScope]
  )

  const canDecreaseChatFontSize = chatFontSize > MIN_CHAT_FONT_SIZE
  const canIncreaseChatFontSize = chatFontSize < MAX_CHAT_FONT_SIZE

  const decreaseChatFontSize = useCallback(() => {
    const nextChatFontSize = Math.max(MIN_CHAT_FONT_SIZE, chatFontSize - 1)
    if (isWorkspaceChatFontSize(nextChatFontSize)) {
      setChatFontSize(nextChatFontSize)
    }
  }, [chatFontSize, setChatFontSize])

  const increaseChatFontSize = useCallback(() => {
    const nextChatFontSize = Math.min(MAX_CHAT_FONT_SIZE, chatFontSize + 1)
    if (isWorkspaceChatFontSize(nextChatFontSize)) {
      setChatFontSize(nextChatFontSize)
    }
  }, [chatFontSize, setChatFontSize])

  const theme = WORKSPACE_THEMES[themeId];
  const themes = useMemo(() => Object.values(WORKSPACE_THEMES), []);

  useEffect(() => {
    const storedChatFontFamily = readStoredChatFontFamily(chatFontFamilyStorageKey)
    if (!storedChatFontFamily || storedChatFontFamily === chatFontFamily) return

    queueMicrotask(() => {
      setChatFontFamilyState((currentChatFontFamily) => currentChatFontFamily === storedChatFontFamily ? currentChatFontFamily : storedChatFontFamily)
    })
  }, [chatFontFamilyStorageKey, chatFontFamily])

  useEffect(() => {
    const storedChatFontSize = readStoredChatFontSize(chatFontSizeStorageKey)
    if (!storedChatFontSize || storedChatFontSize === chatFontSize) return

    queueMicrotask(() => {
      setChatFontSizeState((currentChatFontSize) => currentChatFontSize === storedChatFontSize ? currentChatFontSize : storedChatFontSize)
    })
  }, [chatFontSizeStorageKey, chatFontSize])

  useEffect(() => {
    const storedThemeId = readStoredThemeId(storageKey)
    if (!storedThemeId || storedThemeId === themeId) return

    queueMicrotask(() => {
      setThemeIdState((currentThemeId) => currentThemeId === storedThemeId ? currentThemeId : storedThemeId)
    })
  }, [storageKey, themeId])

  useEffect(() => {
    try {
      window.localStorage.setItem(chatFontFamilyStorageKey, chatFontFamily)
    } catch {
      // ignore storage errors
    }

    persistChatFontFamilyCookie(storageScope, chatFontFamily)
  }, [chatFontFamily, chatFontFamilyStorageKey, storageScope])

  useEffect(() => {
    try {
      window.localStorage.setItem(chatFontSizeStorageKey, String(chatFontSize))
    } catch {
      // ignore storage errors
    }

    persistChatFontSizeCookie(storageScope, chatFontSize)
  }, [chatFontSize, chatFontSizeStorageKey, storageScope])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, themeId)
    } catch {
      // ignore storage errors
    }

    persistThemeCookie(storageScope, themeId)
  }, [storageKey, storageScope, themeId])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        const nextThemeId = event.newValue && isWorkspaceThemeId(event.newValue)
          ? event.newValue
          : null

        if (!nextThemeId) return

        setThemeIdState(nextThemeId)
        persistThemeCookie(storageScope, nextThemeId)
        return
      }

      if (event.key === chatFontFamilyStorageKey) {
        const nextChatFontFamily = event.newValue && isWorkspaceChatFontFamily(event.newValue)
          ? event.newValue
          : null

        if (!nextChatFontFamily) return

        setChatFontFamilyState(nextChatFontFamily)
        persistChatFontFamilyCookie(storageScope, nextChatFontFamily)
        return
      }

      if (event.key !== chatFontSizeStorageKey) return

      const nextChatFontSize = event.newValue ? Number.parseInt(event.newValue, 10) : Number.NaN
      if (!isWorkspaceChatFontSize(nextChatFontSize)) return

      setChatFontSizeState(nextChatFontSize)
      persistChatFontSizeCookie(storageScope, nextChatFontSize)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [chatFontFamilyStorageKey, chatFontSizeStorageKey, storageKey, storageScope])

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(ROOT_THEME_OWNER_ATTR, rootThemeOwnerId);
    applyThemeClasses(root, theme);
    return () => {
      if (root.getAttribute(ROOT_THEME_OWNER_ATTR) !== rootThemeOwnerId) return;
      root.classList.remove(...ALL_THEME_CLASSES, "dark", ...ALL_DARK_VARIANT_CLASSES);
      root.removeAttribute(ROOT_THEME_OWNER_ATTR);
    };
  }, [rootThemeOwnerId, theme]);

  return (
    <WorkspaceThemeContext.Provider
      value={{
        canDecreaseChatFontSize,
        canIncreaseChatFontSize,
        chatFontFamily,
        chatFontSize,
        decreaseChatFontSize,
        increaseChatFontSize,
        setChatFontFamily,
        setChatFontSize,
        theme,
        themeId,
        setThemeId,
        themes,
      }}
    >
      {children}
    </WorkspaceThemeContext.Provider>
  );
}

export function useWorkspaceTheme() {
  const context = useContext(WorkspaceThemeContext);
  if (!context) {
    throw new Error(
      "useWorkspaceTheme must be used within a WorkspaceThemeProvider"
    );
  }
  return context;
}
