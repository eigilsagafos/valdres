import {
    legacyExampleLabel,
    legacyNoticeTitle,
    legacyPageNotice,
    type V1UnavailableKey,
} from "../legacy-status"

// Marks legacy (pre-v1) examples where they appear on the website: across the
// top of a page about an integration that is not migrated to Valdres v1, or as
// a one-line label on a single example. The wording comes from
// ../legacy-status.ts, which the Markdown twins and llms.txt files share.

export const withCode = (text: string) =>
    text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))

export function LegacyNotice({
    integration,
    label = false,
}: {
    integration: V1UnavailableKey
    /** One line above a single example instead of a page-level callout. */
    label?: boolean
}) {
    if (label) {
        return (
            <div data-legacy-example={integration} className="not-prose mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                {withCode(legacyExampleLabel(integration))}
            </div>
        )
    }
    return (
        <div data-legacy-example={integration} className="callout callout-warning">
            <div className="callout-title">{legacyNoticeTitle}</div>
            {withCode(legacyPageNotice(integration))}
        </div>
    )
}
