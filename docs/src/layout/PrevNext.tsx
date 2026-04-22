import type { NavGroup } from "../../content/nav"

type Props = {
    currentRoute: string
    nav: NavGroup[]
}

export function PrevNext({ currentRoute, nav }: Props) {
    const allItems = nav.flatMap(g => g.items)
    const currentIndex = allItems.findIndex(item => item.route === currentRoute)
    if (currentIndex === -1) return null

    const prev = currentIndex > 0 ? allItems[currentIndex - 1] : null
    const next =
        currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null

    if (!prev && !next) return null

    return (
        <nav className="grid grid-cols-2 gap-4 mt-16 not-prose">
            {prev ? (
                <a href={prev.route} className="prev-next-link group">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        Previous
                    </span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-accent-500 dark:group-hover:text-accent-400 transition-colors">
                        ← {prev.title}
                    </span>
                </a>
            ) : (
                <div />
            )}
            {next ? (
                <a
                    href={next.route}
                    className="prev-next-link group text-right"
                >
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        Next
                    </span>
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-accent-500 dark:group-hover:text-accent-400 transition-colors">
                        {next.title} →
                    </span>
                </a>
            ) : (
                <div />
            )}
        </nav>
    )
}
