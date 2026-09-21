/**
 * The single source of truth for which `@valdres/browser-*` packages have been
 * migrated to the public `externalAtom` primitive and are covered by the
 * repository's browser-media gates.
 *
 * The list is explicit and closed, never a glob over `packages/@valdres/*`.
 * Eleven other browser packages still import the removed `globalAtom` and are
 * neither implemented nor certified; a wildcard would quietly claim them.
 * `scripts/browser-media-packages.test.ts` enforces that every entry here is a
 * real, migrated package with the test wiring these gates assume.
 *
 * Listing a package here is a TESTING claim only. Release eligibility is
 * governed separately by `.changeset/config.json`, which still ignores all of
 * them.
 */

export interface BrowserMediaPackage {
    /** Directory under `packages/@valdres/`, and the unscoped package name. */
    readonly dir: string
    /** The read-only external atom the package publishes. */
    readonly atom: string
    /** One derived boolean selector. */
    readonly selector: string
    /** The media query the source observes. */
    readonly query: string
    /** Documented value when the query cannot be observed — also the SSR seed. */
    readonly unavailable: string
    /** The value reported once `query` matches. */
    readonly live: string
}

export const BROWSER_MEDIA_PACKAGES: readonly BrowserMediaPackage[] = [
    {
        dir: "browser-color-scheme",
        atom: "colorSchemeAtom",
        selector: "isDarkSelector",
        query: "(prefers-color-scheme: dark)",
        unavailable: "light",
        live: "dark",
    },
    {
        dir: "browser-contrast",
        atom: "contrastAtom",
        selector: "prefersMoreContrastSelector",
        query: "(prefers-contrast: more)",
        unavailable: "no-preference",
        live: "more",
    },
    {
        dir: "browser-reduced-motion",
        atom: "reducedMotionAtom",
        selector: "prefersReducedMotionSelector",
        query: "(prefers-reduced-motion: reduce)",
        unavailable: "no-preference",
        live: "reduce",
    },
    {
        dir: "browser-reduced-data",
        atom: "reducedDataAtom",
        selector: "prefersReducedDataSelector",
        query: "(prefers-reduced-data: reduce)",
        unavailable: "no-preference",
        live: "reduce",
    },
    {
        dir: "browser-reduced-transparency",
        atom: "reducedTransparencyAtom",
        selector: "prefersReducedTransparencySelector",
        query: "(prefers-reduced-transparency: reduce)",
        unavailable: "no-preference",
        live: "reduce",
    },
]

/** Scoped npm names, in list order. */
export const browserMediaPackageNames = (): readonly string[] =>
    BROWSER_MEDIA_PACKAGES.map(media => `@valdres/${media.dir}`)
