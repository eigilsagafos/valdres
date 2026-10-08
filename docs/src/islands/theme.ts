// The site theme. First paint is decided by the inline script in each layout's
// <head>: a stored "light" or "dark" wins, and without one the page starts
// dark. Nothing here repaints on load.
//
// A stored "light" or "dark" is an explicit choice; anything else means
// "system", and then the page follows live OS changes. The toggle stores an
// explicit choice, after which OS changes are ignored.
//
// client.ts calls initTheme() once per document load. Client-side navigation
// swaps page content but never re-runs it, so listeners do not accumulate.
// It is deliberately docs-owned and valdres-free: client.js loads on every
// page next to demos.js or landing.js, and a realm accepts one valdres runtime.

const STORAGE_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"

const hasExplicitTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark"
}

function applyTheme(dark: boolean) {
    const root = document.documentElement
    root.classList.add("theme-transition")
    root.classList.toggle("dark", dark)
    setTimeout(() => root.classList.remove("theme-transition"), 350)
}

let cleanup: (() => void) | undefined

/** Wire the theme toggle and OS-theme following; returns their teardown. */
export function initTheme(): () => void {
    if (cleanup) return cleanup

    const toggle = document.getElementById("theme-toggle")
    const onToggle = () => {
        const dark = !document.documentElement.classList.contains("dark")
        localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light")
        applyTheme(dark)
    }
    toggle?.addEventListener("click", onToggle)

    const media = window.matchMedia?.(DARK_QUERY)
    const onSystemChange = (event: MediaQueryListEvent) => {
        if (!hasExplicitTheme()) applyTheme(event.matches)
    }
    media?.addEventListener("change", onSystemChange)

    cleanup = () => {
        toggle?.removeEventListener("click", onToggle)
        media?.removeEventListener("change", onSystemChange)
        cleanup = undefined
    }
    return cleanup
}
