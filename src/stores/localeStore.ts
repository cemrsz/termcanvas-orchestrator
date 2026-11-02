import { create } from "zustand";

export type Locale = "en" | "zh" | "tr";

function getLocalStorage():
  | Pick<Storage, "getItem" | "setItem">
  | null {
  const candidate = (
    globalThis as { localStorage?: { getItem?: unknown; setItem?: unknown } }
  ).localStorage;

  if (
    candidate &&
    typeof candidate.getItem === "function" &&
    typeof candidate.setItem === "function"
  ) {
    return candidate as Pick<Storage, "getItem" | "setItem">;
  }

  return null;
}

function detectLocale(): Locale {
  const saved = getLocalStorage()?.getItem("termcanvas-locale") ?? null;
  if (saved === "en" || saved === "zh" || saved === "tr") return saved;
  if (typeof navigator !== "undefined") {
    if (navigator.language.startsWith("zh")) return "zh";
    if (navigator.language.startsWith("tr")) return "tr";
  }
  return "en";
}

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Keep <html lang> in step with the UI language: CSS uppercase then follows
 * the language's rules (Turkish "diğer" → "DİĞER", not "DIĞER") and screen
 * readers pick the right voice.
 */
function applyDocumentLanguage(locale: Locale) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }
}

const initialLocale = detectLocale();
applyDocumentLanguage(initialLocale);

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    getLocalStorage()?.setItem("termcanvas-locale", locale);
    applyDocumentLanguage(locale);
    set({ locale });
  },
}));
