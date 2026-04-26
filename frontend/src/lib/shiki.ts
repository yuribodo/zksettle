import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
  type ThemeRegistration,
} from "shiki";

const FOREST = "#0c3d2e";
const EMERALD = "#1a6b4a";
const INK = "#1a1917";
const QUILL = "#4a4640";
const STONE = "#6b6762";
const MUTED = "#8a8880";
const SURFACE_DEEP = "#efede8";

export const ZKSETTLE_THEME_NAME = "zksettle";

export const zksettleTheme: ThemeRegistration = {
  name: ZKSETTLE_THEME_NAME,
  type: "light",
  colors: {
    "editor.background": SURFACE_DEEP,
    "editor.foreground": INK,
  },
  fg: INK,
  bg: SURFACE_DEEP,
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: MUTED, fontStyle: "italic" } },
    { scope: ["string", "string.quoted", "punctuation.definition.string"], settings: { foreground: STONE } },
    { scope: ["constant.numeric", "constant.language", "constant.other"], settings: { foreground: EMERALD } },
    { scope: ["keyword", "keyword.control", "keyword.operator.new", "storage.type", "storage.modifier"], settings: { foreground: FOREST } },
    { scope: ["entity.name.function", "support.function", "meta.function-call.method"], settings: { foreground: FOREST } },
    { scope: ["entity.name.type", "entity.name.class", "support.type", "support.class"], settings: { foreground: EMERALD } },
    { scope: ["variable", "variable.other", "meta.definition.variable"], settings: { foreground: INK } },
    { scope: ["variable.parameter"], settings: { foreground: QUILL } },
    { scope: ["punctuation", "meta.brace", "meta.delimiter"], settings: { foreground: QUILL } },
    { scope: ["meta.import keyword.control.import", "keyword.control.from"], settings: { foreground: FOREST } },
  ],
};

export type SupportedLang = Extract<BundledLanguage, "typescript" | "rust">;

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [zksettleTheme],
      langs: ["typescript", "rust"],
    });
  }
  return highlighterPromise;
}

export async function codeToHtml(code: string, lang: SupportedLang): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    theme: ZKSETTLE_THEME_NAME,
  });
}
