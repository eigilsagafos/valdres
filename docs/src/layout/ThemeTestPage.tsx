import { bundledThemes, createHighlighter } from "shiki"

const sampleCode = `import { atom, store } from "valdres"
import { useAtom } from "valdres-react"

const countAtom = atom(0)
const nameAtom = atom("Valdres")

// A selector that derives from atoms
const greetingSelector = selector(get => {
  const name = get(nameAtom)
  const count = get(countAtom)
  return \`Hello \${name}! Count: \${count}\`
})

export function Counter() {
  const [count, setCount] = useAtom(countAtom)

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}`

const themePairs = [
    { name: "Vitesse", light: "vitesse-light", dark: "vitesse-dark" },
    { name: "GitHub", light: "github-light", dark: "github-dark" },
    { name: "Catppuccin", light: "catppuccin-latte", dark: "catppuccin-mocha" },
    { name: "Rose Pine", light: "rose-pine-dawn", dark: "rose-pine" },
    { name: "Solarized", light: "solarized-light", dark: "solarized-dark" },
    { name: "Min", light: "min-light", dark: "min-dark" },
    { name: "Slack", light: "slack-ochin", dark: "slack-dark" },
    { name: "Rose Pine Moon", light: "rose-pine-dawn", dark: "rose-pine-moon" },
] as const

export async function renderThemeTestPage() {
    const allThemes = themePairs.flatMap(p => [p.light, p.dark])
    const highlighter = await createHighlighter({
        themes: allThemes,
        langs: ["tsx"],
    })

    const sections = themePairs.map(pair => {
        const lightHtml = highlighter.codeToHtml(sampleCode, {
            lang: "tsx",
            theme: pair.light,
        })
        const darkHtml = highlighter.codeToHtml(sampleCode, {
            lang: "tsx",
            theme: pair.dark,
        })

        return { name: pair.name, light: pair.light, dark: pair.dark, lightHtml, darkHtml }
    })

    const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Syntax Theme Comparison — Valdres</title>
    <link rel="stylesheet" href="/styles.css" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
        .theme-block pre {
            border-radius: 0.75rem;
            padding: 1rem 1.25rem;
            font-size: 0.8125rem;
            line-height: 1.7;
            overflow-x: auto;
            margin: 0;
        }
        .theme-block pre code {
            font-family: "JetBrains Mono", ui-monospace, monospace;
        }
    </style>
</head>
<body class="bg-surface dark:bg-surface-dark text-zinc-800 dark:text-zinc-200 antialiased">
    <div class="max-w-7xl mx-auto px-6 py-12">
        <div class="mb-10 flex items-center justify-between">
            <div>
                <h1 class="text-3xl font-bold tracking-tight mb-2">Syntax Theme Comparison</h1>
                <p class="text-zinc-500 dark:text-zinc-400">Each pair shows light (left) and dark (right) variants of the same theme.</p>
            </div>
            <div class="flex items-center gap-3">
                <a href="/" class="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">&larr; Home</a>
                <button id="theme-toggle" class="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2 border border-border dark:border-border-dark rounded-lg" aria-label="Toggle theme">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dark:hidden"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden dark:block"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                </button>
            </div>
        </div>

        <div class="space-y-12">
            ${sections.map(s => `
            <div>
                <h2 class="text-lg font-semibold mb-1">${s.name}</h2>
                <p class="text-xs text-zinc-400 dark:text-zinc-500 mb-3 font-mono">${s.light} / ${s.dark}</p>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 theme-block">
                    <div class="rounded-xl border border-border dark:border-border-dark overflow-hidden">
                        <div class="px-3 py-1.5 text-[0.65rem] font-medium text-zinc-400 dark:text-zinc-500 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark uppercase tracking-wider">Light — ${s.light}</div>
                        ${s.lightHtml}
                    </div>
                    <div class="rounded-xl border border-border dark:border-border-dark overflow-hidden">
                        <div class="px-3 py-1.5 text-[0.65rem] font-medium text-zinc-400 dark:text-zinc-500 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark uppercase tracking-wider">Dark — ${s.dark}</div>
                        ${s.darkHtml}
                    </div>
                </div>
            </div>
            `).join("")}
        </div>
    </div>

    <script>
        (function() {
            const theme = localStorage.getItem('theme');
            if (theme === 'light') document.documentElement.classList.remove('dark');
            else if (theme === 'dark' || !theme) document.documentElement.classList.add('dark');
            else if (window.matchMedia('(prefers-color-scheme: light)').matches) document.documentElement.classList.remove('dark');
        })();
    </script>
    <script type="module" src="/client.js"></script>
</body>
</html>`

    return html
}
