// Integrations whose live demos cannot run on Valdres v1 yet. Their runtime
// modules must stay out of the island bundles — importing one fails the build,
// because each still depends on exports v1 removed — so their placeholders
// render this notice instead. The page content around them is unchanged and
// still documents the earlier API. The list itself lives in ../legacy-status.ts.

import { legacyNoticeTitle, v1Unavailable, type V1UnavailableKey } from "../legacy-status"

export type { V1UnavailableKey }

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
    title.textContent = legacyNoticeTitle

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
