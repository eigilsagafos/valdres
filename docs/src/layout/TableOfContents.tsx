export type TocItem = {
    id: string
    text: string
    level: number
}

type Props = {
    headings: TocItem[]
}

export function TableOfContents({ headings }: Props) {
    if (headings.length === 0) return null

    return (
        <div className="hidden xl:block w-56 shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <h4 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                    On this page
                </h4>
                <ul className="space-y-1">
                    {headings.map(h => (
                        <li key={h.id}>
                            <a
                                href={`#${h.id}`}
                                className={`toc-link block text-[0.8125rem] leading-snug border-l-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors ${
                                    h.level === 3 ? "pl-6" : "pl-3"
                                } py-1`}
                            >
                                {h.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
