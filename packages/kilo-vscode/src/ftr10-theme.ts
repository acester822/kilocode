/**
 * FTR10 Theme Architect integration.
 *
 * Reads ~/.ftr10/vars.json (written by the FTR10 Codex extension) and exposes
 * the current --ftr10-* CSS custom properties to Kilo's webview so the active
 * Architect session colour palette is reflected inside the panel UI.
 */

import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const VARS_JSON = path.join(os.homedir(), ".ftr10", "vars.json")

/** Return the current map of --ftr10-* var names → values, or {} if unavailable. */
export function readFtr10Vars(): Record<string, string> {
  try {
    const raw = fs.readFileSync(VARS_JSON, "utf8")
    const parsed = JSON.parse(raw) as { values?: Record<string, string> }
    return parsed.values ?? {}
  } catch {
    return {}
  }
}

/**
 * Build a CSS `:root { ... }` block from a vars map.
 * This establishes all --ftr10-* custom properties as a CSS baseline.
 * The actual override of --vscode-* and kilo-ui semantic tokens is done via
 * an inline script in the webview HTML (see utils.ts) which applies vars as
 * element.style.setProperty() — inline styles beat all stylesheets and survive
 * VS Code's dynamic --vscode-* theme injection.
 * Returns an empty string when the map is empty (FTR10 not installed).
 */
export function buildFtr10StyleBlock(vars: Record<string, string>): string {
  const entries = Object.entries(vars)
  if (!entries.length) return ""
  const decls = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n")
  return `:root {\n${decls}\n}`
}

/**
 * Darken a #rrggbb or #rrggbbaa hex color by multiplying each RGB channel
 * by `factor` (0–1) while preserving the original alpha channel.
 */
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace("#", "")
  if (h.length !== 6 && h.length !== 8) return hex
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor)
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor)
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor)
  const alpha = h.length === 8 ? h.slice(6, 8) : "ff"
  const toHex = (n: number) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha}`
}

/**
 * Build the full map of vars to apply as inline styles on document.documentElement.
 * Includes all --ftr10-* vars PLUS derived mappings for --vscode-* and kilo-ui
 * semantic tokens. Inline styles win over every stylesheet including VS Code's
 * dynamically injected --vscode-* theme vars.
 */
// eslint-disable-next-line complexity
export function buildFtr10InlineVars(vars: Record<string, string>): Record<string, string> {
  if (!Object.keys(vars).length) return {}

  const bgSolid = vars["--ftr10-bg-sticky"] ?? "#0c0e13"
  const bgGlass = vars["--ftr10-glass-bg-widget"] ?? bgSolid
  const bgGlassStrong = vars["--ftr10-glass-bg-widget-strong"] ?? bgSolid
  const bgOverlay = vars["--ftr10-glass-bg-overlay"] ?? bgSolid
  const bgHover = vars["--ftr10-glass-bg-hover"] ?? bgGlass
  const bgActive = vars["--ftr10-glass-bg-active"] ?? bgGlass
  const bgMenu = vars["--ftr10-glass-bg-menu"] ?? bgGlassStrong
  const accent = vars["--ftr10-accent-1"] ?? "#ca2bee"
  const accent2 = vars["--ftr10-accent-2"] ?? "#e425a8"
  const accent3 = vars["--ftr10-accent-3"] ?? "#5a19e6"
  // Darkened accent tints: same hue/alpha as the accent but ~25% brightness —
  // used for partial-background UI elements so they harmonise with the active palette.
  const accentTintBg = darkenHex(accent, 0.25)
  const accent3TintBg = darkenHex(accent3, 0.25)
  const font = vars["--ftr10-body-font"] ?? "'Victor Mono', monospace"
  const codeFont = vars["--ftr10-code-font"] ?? "'Victor Mono', monospace"
  const text = vars["--ftr10-text"] ?? "#ffffffe6"
  const textMuted = vars["--ftr10-text-muted"] ?? "#ffffff73"
  const success = vars["--ftr10-success"] ?? "#65bc4a"
  const error = vars["--ftr10-error"] ?? "#ff5c75"
  const warning = vars["--ftr10-warning"] ?? "#f0b429"
  const border = vars["--ftr10-border"] ?? "#ca2bee20"
  const borderBase = vars["--ftr10-border-base"] ?? "#ca2bee1a"

  return {
    // All raw FTR10 vars
    ...vars,
    // Computed tints — exposed as vars for any CSS that references them
    "--ftr10-accent-tint-bg": accentTintBg,
    "--ftr10-accent-3-tint-bg": accent3TintBg,

    // --vscode-* overrides (beat VS Code's injected stylesheet)
    "--vscode-font-family": font,
    "--vscode-editor-font-family": codeFont,
    "--vscode-foreground": text,
    "--vscode-editor-foreground": text,
    "--vscode-descriptionForeground": textMuted,
    "--vscode-disabledForeground": textMuted,
    "--vscode-editor-background": "transparent",
    "--vscode-sideBar-background": "transparent",
    "--vscode-editorWidget-background": accentTintBg,
    "--vscode-input-background": accentTintBg,
    "--vscode-menu-background": bgMenu,
    "--vscode-list-hoverBackground": bgHover,
    "--vscode-list-activeSelectionBackground": bgActive,
    "--vscode-list-activeSelectionForeground": text,
    "--vscode-list-inactiveSelectionBackground": bgGlass,
    "--vscode-button-background": accent,
    "--vscode-button-foreground": "#ffffff",
    "--vscode-button-hoverBackground": accent2,
    "--vscode-button-secondaryBackground": accent3TintBg,
    "--vscode-button-secondaryForeground": text,
    "--vscode-button-secondaryHoverBackground": accent3,
    "--vscode-focusBorder": accent,
    "--vscode-textLink-foreground": accent2,
    "--vscode-panel-border": border,
    "--vscode-widget-border": borderBase,
    "--vscode-editorGroup-border": border,
    "--vscode-toolbar-hoverBackground": bgHover,
    "--vscode-toolbar-activeBackground": bgActive,

    // kilo-ui semantic background tokens
    "--background-base": "transparent",
    "--background-weak": bgGlass,
    "--background-strong": bgSolid,
    "--background-stronger": accentTintBg,
    "--surface-base": accent3TintBg,
    "--base": "transparent",
    "--base2": accent3TintBg,
    "--base3": accentTintBg,
    "--surface-base-hover": bgHover,
    "--surface-base-active": bgActive,
    "--surface-inset-base": accentTintBg,
    "--surface-inset-strong": accentTintBg,
    "--surface-raised-base": accentTintBg,
    "--surface-raised-strong": accentTintBg,
    "--surface-raised-stronger": accentTintBg,
    "--surface-raised-stronger-non-alpha": accentTintBg,
    "--surface-float-base": accentTintBg,
    "--surface-float-base-hover": bgHover,
    "--surface-weak": accentTintBg,
    "--surface-weaker": accentTintBg,
    "--surface-strong": accentTintBg,
    "--surface-brand-base": accent,
    "--surface-brand-hover": accent2,
    "--surface-interactive-base": bgActive,
    "--surface-interactive-hover": bgHover,
    "--surface-interactive-active": bgActive,
    "--surface-interactive-weak": bgGlass,
    "--input-base": accentTintBg,
    "--input-hover": accentTintBg,
    "--input-active": accentTintBg,
    "--input-focus": accentTintBg,

    // kilo-ui semantic text tokens
    "--text-base": text,
    "--text-weak": textMuted,
    "--text-weaker": textMuted,
    "--text-strong": text,
    "--text-invert-base": text,
    "--text-interactive-base": accent2,
    "--foreground-secondary": textMuted,

    // Font
    "--font-family": font,

    // Borders
    "--border-base": border,
    "--border-hover": border,
    "--border-weak-base": borderBase,
    "--border-weak-hover": borderBase,
    "--border-strong-base": `${accent}33`,
    "--border-active": accent,
    "--border-focus": accent,
    "--border-selected": accent,
    "--border-contrast": "transparent",

    // Status
    "--surface-success-strong": success,
    "--surface-critical-strong": error,
    "--surface-warning-strong": warning,
    "--surface-success-base": `${success}20`,
    "--surface-critical-base": `${error}20`,
    "--surface-warning-base": `${warning}20`,

    // Buttons
    "--button-secondary-base": accent3TintBg,
    "--button-secondary-hover": accent3,
    "--button-ghost-hover": bgHover,
    "--button-ghost-hover2": bgActive,
  }
}

/**
 * Watch vars.json for changes and call `onChange` with fresh vars.
 * Returns a cleanup function that stops the watcher.
 */
export function watchFtr10Vars(onChange: (vars: Record<string, string>) => void): () => void {
  let watcher: fs.FSWatcher | undefined
  try {
    watcher = fs.watch(VARS_JSON, () => {
      onChange(readFtr10Vars())
    })
  } catch {
    // ~/.ftr10/vars.json does not exist — FTR10 Codex not installed, silently skip
  }
  return () => {
    try {
      watcher?.close()
    } catch {
      // ignore
    }
  }
}
