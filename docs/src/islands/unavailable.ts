// Integrations whose live demos cannot run on Valdres v1 yet. Their runtime
// modules must stay out of the island bundles — importing one fails the build,
// because each still depends on exports v1 removed — so their placeholders
// render this notice instead. The page content around them is unchanged and
// still documents the earlier API.
//
// docs/test/islands.test.ts asserts that none of these packages enters a
// bundle and that every placeholder here renders its notice.

export type V1Unavailable = {
    /** What the reader would have seen running; backticks mark code. */
    subject: string
    /** The removed v1 surface it still depends on. */
    missing: string
}

const globalAtomPackage = (name: string, missing = "`globalAtom`"): V1Unavailable => ({
    subject: `\`${name}\``,
    missing: `${missing}, which Valdres v1 removed`,
})

const adapter = (name: string, missing: string): V1Unavailable => ({
    subject: `\`${name}\``,
    missing: `${missing}, which Valdres v1 removed`,
})

export const v1Unavailable = {
    "@valdres/bandwidth": globalAtomPackage("@valdres/bandwidth", "`globalAtom` and `globalStore`"),
    "@valdres/browser-device-motion": globalAtomPackage("@valdres/browser-device-motion"),
    "@valdres/browser-device-orientation": globalAtomPackage("@valdres/browser-device-orientation"),
    "@valdres/browser-geolocation": globalAtomPackage("@valdres/browser-geolocation", "`globalAtom` and `globalStore`"),
    "@valdres/browser-screen": globalAtomPackage("@valdres/browser-screen"),
    "@valdres/browser-screen-details": globalAtomPackage("@valdres/browser-screen-details"),
    "@valdres/browser-window": globalAtomPackage("@valdres/browser-window"),
    "@valdres/color-mode": globalAtomPackage("@valdres/color-mode"),
    "@valdres/public-ip": globalAtomPackage("@valdres/public-ip"),
    "valdres-vue": adapter("valdres-vue", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres-svelte": adapter("valdres-svelte", "`isAtom`, `isPromiseLike`, `applyInitialize`, `hydrate` and the legacy `storeAdapter` adapter internals"),
    "valdres-solid": adapter("valdres-solid", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres-angular": adapter("valdres-angular", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres/cache": {
        subject: "atom caching and revalidation",
        missing: "async atoms with `maxAge`, `staleWhileRevalidate` and `staleIfError`, and `cacheMeta` — none of which are part of Valdres v1",
    },
} satisfies Record<string, V1Unavailable>

export type V1UnavailableKey = keyof typeof v1Unavailable

const code = (text: string) =>
    text.split("`").map((part, i) => {
        if (i % 2 === 0) return document.createTextNode(part)
        const el = document.createElement("code")
        el.textContent = part
        return el
    })

/**
 * Render the "not yet migrated" notice into a demo placeholder. `compact` is
 * for the small landing-page cards.
 */
export function mountV1Unavailable(
    el: HTMLElement,
    key: V1UnavailableKey,
    { compact = false }: { compact?: boolean } = {},
) {
    const { subject, missing } = v1Unavailable[key]
    el.innerHTML = ""
    const notice = document.createElement("div")
    notice.setAttribute("data-v1-unavailable", key)
    notice.setAttribute("role", "note")
    notice.className = compact
        ? "not-prose island-card flex-col gap-1 px-3 text-center text-[11px] leading-snug text-zinc-500 dark:text-zinc-400"
        : "not-prose my-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-4 text-sm text-zinc-600 dark:text-zinc-400"

    const title = document.createElement("div")
    title.className = compact
        ? "font-semibold text-zinc-600 dark:text-zinc-300"
        : "mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
    title.textContent = "Not yet migrated to Valdres v1"

    const body = document.createElement("div")
    if (compact) {
        body.append(...code(`Live ${subject} demo unavailable`))
    } else {
        body.append(
            ...code(`The live ${subject} demo is unavailable: it depends on ${missing}. `),
            document.createTextNode("The documentation on this page describes the earlier API."),
        )
    }

    notice.append(title, body)
    el.appendChild(notice)
    return () => notice.remove()
}
