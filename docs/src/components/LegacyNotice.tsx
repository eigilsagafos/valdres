import { v1Unavailable, type V1UnavailableKey } from "../islands/unavailable"

// Marks legacy (pre-v1) examples where they appear: across the top of a page
// about an integration that is not migrated to Valdres v1, or as a one-line
// label on a single example. Same source of truth as the islands' notices.

const withCode = (text: string) =>
    text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))

export const isV1Unavailable = (key: string): key is V1UnavailableKey =>
    Object.hasOwn(v1Unavailable, key)

export function LegacyNotice({
    integration,
    label = false,
}: {
    integration: V1UnavailableKey
    /** One line above a single example instead of a page-level callout. */
    label?: boolean
}) {
    const { subject, missing } = v1Unavailable[integration]
    if (label) {
        return (
            <div data-legacy-example={integration} className="not-prose mb-2 text-xs font-medium text-amber-600 dark:text-amber-400">
                {withCode(`Legacy example, not Valdres v1: ${subject} is not yet migrated.`)}
            </div>
        )
    }
    return (
        <div data-legacy-example={integration} className="callout callout-warning">
            <div className="callout-title">Not yet migrated to Valdres v1</div>
            {withCode(
                `${subject[0]!.toUpperCase()}${subject.slice(1)} still depends on ${missing}. The examples and options on this page are legacy, pre-v1 examples — not Valdres v1 examples.`,
            )}
        </div>
    )
}
