// The site theme as shipped: client.js next to demos.js (a docs page) or
// landing.js (the home page), under a controllable OS color scheme.
//
// Docs pages navigate through client.ts's own router — a link click, a
// fetched page, the content swap and `valdres:navigate` — so listener counts
// cover everything that runs on navigation.
//
// Usage: bun docs/test/fixtures/theme.ts <outdir> <docs|landing>
import { join } from "node:path"
import { check, loadBundle, report, startBrowser, waitFor } from "./browser"

const [outdir, layout] = process.argv.slice(2)
const DARK = "(prefers-color-scheme: dark)"

// ── a controllable OS color scheme ─────────────────────────────────────────
type ChangeListener = (event: { matches: boolean; media: string }) => void
const queries: { media: string; listeners: Set<ChangeListener> }[] = []
let systemDark = false
const evaluate = (media: string) =>
    media === DARK ? systemDark : media === "(prefers-color-scheme: light)" ? !systemDark : false

function setSystemDark(dark: boolean) {
    systemDark = dark
    for (const query of queries) {
        for (const listener of [...query.listeners]) listener({ matches: evaluate(query.media), media: query.media })
    }
}

/** Live `change` listeners on the dark-scheme query, across every MediaQueryList. */
const darkListeners = () =>
    queries.filter(q => q.media === DARK).reduce((n, q) => n + q.listeners.size, 0)

const dark = () => document.documentElement.classList.contains("dark")
const stored = () => localStorage.getItem("theme")

// ── pages ──────────────────────────────────────────────────────────────────
const toggle = `<button id="theme-toggle">theme</button>`
const docsPage = (content: string) =>
    `<html><body>${toggle}<div id="page-content">${content}<div id="api-demo"></div></div></body></html>`
const pages: Record<string, string> = {
    "/react/store": docsPage(""),
    "/react/atomFamily": docsPage(""),
    "/react/plugins/browser-color-scheme": docsPage(
        `<div data-plugin-demo="browser-color-scheme">Loading demo…</div>`,
    ),
    "/guides/introduction": docsPage("<p>Introduction</p>"),
}

const landingBody = `${toggle}
    <button id="demo-reset">Reset</button>
    <div id="react-island"></div><div id="vue-island"></div><div id="svelte-island"></div>
    <div id="solid-island"></div><div id="angular-island"></div>
    <div id="landing-keyboard-island"></div><div id="landing-online-island"></div>
    <div id="landing-location-island"></div>`

startBrowser(
    layout === "landing" ? "http://localhost/" : "http://localhost/guides/introduction",
    layout === "landing"
        ? landingBody
        : `${toggle}<div id="page-content"><p>Introduction</p><div id="api-demo"></div></div>`,
)

Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (media: string) => {
        const listeners = new Set<ChangeListener>()
        queries.push({ media, listeners })
        return {
            media,
            get matches() {
                return evaluate(media)
            },
            onchange: null,
            addEventListener: (type: string, listener: ChangeListener) => {
                if (type === "change") listeners.add(listener)
            },
            removeEventListener: (type: string, listener: ChangeListener) => {
                if (type === "change") listeners.delete(listener)
            },
            addListener: (listener: ChangeListener) => listeners.add(listener),
            removeListener: (listener: ChangeListener) => listeners.delete(listener),
            dispatchEvent: () => true,
        }
    },
})
Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (href: string) =>
        pages[href] ? new Response(pages[href]) : new Response("", { status: 404 }),
})

async function navigate(href: string) {
    const link = document.createElement("a")
    link.href = href
    document.getElementById("page-content")!.appendChild(link)
    link.click()
    return waitFor(() => location.pathname === href && !document.getElementById("page-content")!.contains(link))
}

// No stored preference: "system". The inline <head> script paints it dark.
localStorage.clear()
document.documentElement.classList.add("dark")

await loadBundle(join(outdir, "client.js"))
await loadBundle(join(outdir, layout === "landing" ? "landing.js" : "demos.js"))
await new Promise(resolve => setTimeout(resolve, 50))

check(dark(), `${layout}: loading keeps the first-paint theme`)
check(darkListeners() === 1, `${layout}: one OS-theme listener after load (${darkListeners()})`)

// ── "system" follows OS changes ────────────────────────────────────────────
setSystemDark(false)
check(!dark(), `${layout}: system preference follows the OS to light`)
setSystemDark(true)
check(dark(), `${layout}: system preference follows the OS to dark`)
check(stored() === null, `${layout}: following the OS stores no preference`)

if (layout === "docs") {
    // ── client-side navigation adds no listeners ───────────────────────────
    const route = ["/react/store", "/react/plugins/browser-color-scheme", "/react/atomFamily", "/guides/introduction"]
    let navigated = 0
    let extra = 0
    for (let i = 0; i < 12; i++) {
        const href = route[i % route.length]
        if (await navigate(href)) navigated++
        if (href.includes("browser-color-scheme")) {
            await waitFor(() => document.querySelector('[data-plugin-demo="browser-color-scheme"]')!.textContent!.includes("colorSchemeAtom"))
        } else if (darkListeners() !== 1) {
            extra++
        }
    }
    check(navigated === 12, `docs: 12 client-side navigations (${navigated})`)
    check(extra === 0, `docs: still one OS-theme listener on every page without a color-scheme demo`)

    await navigate("/react/plugins/browser-color-scheme")
    const demo = () => document.querySelector('[data-plugin-demo="browser-color-scheme"]')!.textContent!
    await waitFor(() => demo().includes("colorSchemeAtom"))
    setSystemDark(false)
    check(
        await waitFor(() => demo().includes("colorSchemeAtomlight")) && !dark(),
        "docs: one OS change updates both the color-scheme demo and the theme",
    )
    await navigate("/guides/introduction")
    check(darkListeners() === 1, `docs: leaving the color-scheme demo releases its listener (${darkListeners()})`)
    setSystemDark(true)
    check(dark(), "docs: OS following still works after navigation")
}

// ── an explicit choice wins over the OS ────────────────────────────────────
const themeToggle = document.getElementById("theme-toggle")!
themeToggle.click()
check(!dark() && stored() === "light", `${layout}: the toggle stores an explicit light choice`)
setSystemDark(false)
setSystemDark(true)
check(!dark(), `${layout}: OS changes do not override an explicit light choice`)
themeToggle.click()
check(dark() && stored() === "dark", `${layout}: the toggle flips once per click`)
setSystemDark(false)
check(dark(), `${layout}: OS changes do not override an explicit dark choice`)

localStorage.setItem("theme", "system")
setSystemDark(false)
check(!dark(), `${layout}: a stored "system" preference follows the OS`)

report()
