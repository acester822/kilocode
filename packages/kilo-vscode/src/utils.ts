import * as crypto from "crypto"
import * as vscode from "vscode"
import { buildCspString } from "./webview-html-utils"

function getNonce(): string {
  return crypto.randomBytes(16).toString("hex")
}

const SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]

function clamp(size: number) {
  if (!Number.isFinite(size)) return 13
  return Math.min(24, Math.max(10, Math.round(size)))
}

export function getWebviewFontSize(): number {
  const raw = vscode.workspace.getConfiguration("kilo-code.new").get<number>("fontSize", 13)
  return clamp(raw)
}

function fontStyle(): string {
  const base = getWebviewFontSize()
  const vars = SIZES.map((size) => `--kilo-font-size-${size}: ${(base * size) / 13}px;`).join("\n      ")
  return `:root {
      ${vars}
      --kilo-font-scale: ${base / 13};
      --font-size-x-small: var(--kilo-font-size-10);
      --font-size-small: var(--kilo-font-size-11);
      --font-size-base: var(--kilo-font-size-13);
      --font-size-large: var(--kilo-font-size-16);
    }`
}

export function buildWebviewHtml(
  webview: vscode.Webview,
  opts: {
    scriptUri: vscode.Uri
    styleUri: vscode.Uri
    iconsBaseUri: vscode.Uri
    title: string
    port?: number
    extraStyles?: string
    /** Optional CSS :root block injected from ~/.ftr10/vars.json (FTR10 theme vars). */
    ftr10StyleBlock?: string
    /** FTR10 vars as JSON — applied as inline styles to beat VS Code's dynamic --vscode-* injection. */
    ftr10VarsJson?: string
  },
): string {
  const nonce = getNonce()
  const csp = buildCspString(webview.cspSource, nonce, opts.port)

  return `<!DOCTYPE html>
<html lang="en" data-theme="kilo-vscode">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${opts.styleUri}">
  <title>${opts.title}</title>
  <style>
    ${fontStyle()}
    html {
      scrollbar-color: auto;

      ::-webkit-scrollbar-thumb {
        border: 3px solid transparent !important;
        background-clip: padding-box !important;
      }
    }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    body {
      background-color: transparent;
      color: var(--vscode-foreground);
      font-family: var(--ftr10-body-font, var(--vscode-font-family));
    }
    /* Beat VS Code's body.vscode-dark specificity so FTR10 theme applies */
    body.vscode-dark,
    body.vscode-light,
    body.vscode-high-contrast {
      background-color: transparent;
      font-family: var(--ftr10-body-font, var(--vscode-font-family));
    }
    #root {
      height: 100%;
    }${opts.extraStyles ? `\n    ${opts.extraStyles}` : ""}
  </style>${opts.ftr10StyleBlock ? `\n  <style id="ftr10-vars">\n  ${opts.ftr10StyleBlock}\n  </style>` : ""}
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.ICONS_BASE_URI = "${opts.iconsBaseUri}";</script>${opts.ftr10VarsJson ? `
  <script nonce="${nonce}">
  (function(){
    var V=${opts.ftr10VarsJson};
    window.__FTR10_VARS__=V;
    function apply(vars){
      var r=document.documentElement;
      for(var k in vars){r.style.setProperty(k,vars[k]);}
    }
    apply(V);
    // Re-apply after all DOM mutations in <head> settle (VS Code --vscode-* injection,
    // kilo-ui ThemeProvider writing oc-theme, SolidJS reactive cascades, etc.)
    // Debounced so multiple rapid mutations collapse into a single trailing re-apply.
    var t=null;
    function schedule(){
      if(t)clearTimeout(t);
      t=setTimeout(function(){t=null;apply(window.__FTR10_VARS__||{});},50);
    }
    new MutationObserver(schedule).observe(document.head,{childList:true,subtree:true,characterData:true});
    // Also watch for data-theme / data-color-scheme attribute changes on <html>
    // which ThemeProvider sets after writing the style content.
    new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-color-scheme']});
  })();
  </script>` : ""}
  <script nonce="${nonce}" src="${opts.scriptUri}"></script>
</body>
</html>`
}
