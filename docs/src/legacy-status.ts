// Which integrations Valdres v1 cannot run yet, and the exact wording every
// docs output uses to say so: the website (live-demo notices here, page
// notices and example labels in components/LegacyNotice.tsx) and the Markdown
// twins and llms.txt files (generate-llms-txt.ts). Plain data and strings,
// with backticks marking code, so it loads in the browser bundles, the static
// renderer, and the Markdown generator alike.
//
// docs/test/islands.test.ts checks the island bundles against this list, and
// docs/test/outputs.test.ts checks the generated pages.

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

const dependsOnRemoved = (name: string, missing: string): V1Unavailable => ({
    subject: `\`${name}\``,
    missing: `${missing}, which Valdres v1 removed`,
})

export const v1Unavailable = {
    "@valdres/bandwidth": globalAtomPackage("@valdres/bandwidth", "`globalAtom` and `globalStore`"),
    "@valdres/browser-device-motion": globalAtomPackage("@valdres/browser-device-motion"),
    "@valdres/browser-device-orientation": globalAtomPackage("@valdres/browser-device-orientation"),
    "@valdres/browser-geolocation": globalAtomPackage("@valdres/browser-geolocation", "`globalAtom` and `globalStore`"),
    "@valdres/browser-screen-details": globalAtomPackage("@valdres/browser-screen-details"),
    "@valdres/color-mode": globalAtomPackage("@valdres/color-mode"),
    "@valdres/public-ip": globalAtomPackage("@valdres/public-ip"),
    "@valdres/redux-devtools": dependsOnRemoved("@valdres/redux-devtools", "`isAtomFamily`, `isSelectorFamily`, the `SnapshotEntry` type and the legacy `storeAdapter` adapter internals"),
    "valdres-vue": dependsOnRemoved("valdres-vue", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres-svelte": dependsOnRemoved("valdres-svelte", "`isAtom`, `isPromiseLike`, `applyInitialize`, `hydrate` and the legacy `storeAdapter` adapter internals"),
    "valdres-solid": dependsOnRemoved("valdres-solid", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres-angular": dependsOnRemoved("valdres-angular", "`isPromiseLike` and the legacy `storeAdapter` adapter internals"),
    "valdres/cache": {
        subject: "atom caching and revalidation",
        missing: "async atoms with `maxAge`, `staleWhileRevalidate` and `staleIfError`, and `cacheMeta` — none of which are part of Valdres v1",
    },
} satisfies Record<string, V1Unavailable>

export type V1UnavailableKey = keyof typeof v1Unavailable

export const isV1Unavailable = (key: string): key is V1UnavailableKey =>
    Object.hasOwn(v1Unavailable, key)

/** The adapter a framework's examples use, when it is not migrated to v1. */
export const unmigratedAdapter = (framework: string): V1UnavailableKey | undefined => {
    const adapter = `valdres-${framework}`
    return isV1Unavailable(adapter) ? adapter : undefined
}

export const legacyNoticeTitle = "Not yet migrated to Valdres v1"

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Opens a page about an integration that is not migrated to v1. */
export const legacyPageNotice = (key: V1UnavailableKey) =>
    `${capitalize(v1Unavailable[key].subject)} still depends on ${v1Unavailable[key].missing}. The examples and options on this page are legacy, pre-v1 examples — not Valdres v1 examples.`

/** Labels a single framework-specific example that uses an unmigrated adapter. */
export const legacyExampleLabel = (key: V1UnavailableKey) =>
    `Legacy example, not Valdres v1: ${v1Unavailable[key].subject} is not yet migrated.`

/** Labels every Sandpack playground: npm `latest` is still the pre-v1 release. */
export const playgroundLegacyLabel =
    "Legacy example, not Valdres v1: this playground installs `valdres-react@latest`, which is still the pre-v1 release."
