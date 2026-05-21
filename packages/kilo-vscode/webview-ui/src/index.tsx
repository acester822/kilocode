/* @refresh reload */
import "@kilocode/kilo-ui/styles"
import { render } from "solid-js/web"
import App from "./App"

// Apply FTR10 Theme Architect CSS variables as inline styles on <html> so they
// beat VS Code's dynamically injected --vscode-* stylesheet overrides.
function applyFtr10Vars(vars: Record<string, string>) {
  const root = document.documentElement
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}

// Handle live theme updates pushed from the extension host
window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data
  if (msg?.type === "ftr10VarsUpdate" && msg.vars) {
    ;(window as Window & { __FTR10_VARS__?: Record<string, string> }).__FTR10_VARS__ = msg.vars as Record<string, string>
    applyFtr10Vars(msg.vars as Record<string, string>)
  }
})

// Re-apply initial vars now that app JS has loaded (catches any components that
// rendered after VS Code's own --vscode-* injection settled, and also handles
// kilo-ui ThemeProvider writing its own tokens into <style id="oc-theme">)
const initialVars = (window as Window & { __FTR10_VARS__?: Record<string, string> }).__FTR10_VARS__
if (initialVars) {
  applyFtr10Vars(initialVars)
  // ThemeProvider's onMount + SolidJS reactive effects fire asynchronously — wait
  // long enough for all reactive cascades to settle before the final re-apply.
  setTimeout(() => applyFtr10Vars(initialVars), 100)
}

const root = document.getElementById("root")

if (!root) {
  throw new Error("Root element not found")
}

render(() => <App />, root)
