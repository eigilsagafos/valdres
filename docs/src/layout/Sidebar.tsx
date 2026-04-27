import type { NavGroup } from "../../content/nav"
import { frameworks, frameworkList, type Framework } from "../frameworks"

type Props = {
    nav: NavGroup[]
    currentRoute: string
    framework?: Framework
}

function isApiName(title: string) {
    return /^[a-z]/.test(title) || title === "Provider"
}

const frameworkLogos: Record<Exclude<Framework, "vanilla">, string> = {
    react: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4"><circle cx="12" cy="12" r="2.5" fill="#61DAFB"/><ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" stroke-width="1" fill="none"/><ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" stroke-width="1" fill="none" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" stroke-width="1" fill="none" transform="rotate(120 12 12)"/></svg>`,
    vue: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4"><path d="M2 3L12 21L22 3H17.5L12 13L6.5 3H2Z" fill="#42B883"/><path d="M6.5 3L12 13L17.5 3H14.5L12 7.5L9.5 3H6.5Z" fill="#35495E"/></svg>`,
    svelte: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4"><path d="M19.8 4.8C17.9 2 14 1.2 11.2 3L5.8 6.6C4.5 7.5 3.6 8.8 3.3 10.3C3.1 11.5 3.2 12.7 3.7 13.8C3.3 14.3 3 14.9 2.8 15.5C2.3 17.1 2.4 18.8 3.2 20.2C5.1 23 9 23.8 11.8 22L17.2 18.4C18.5 17.5 19.4 16.2 19.7 14.7C19.9 13.5 19.8 12.3 19.3 11.2C19.7 10.7 20 10.1 20.2 9.5C20.7 7.9 20.6 6.2 19.8 4.8Z" fill="#FF3E00"/></svg>`,
    solid: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4"><path d="M3.5 5.5L8.5 2L21 8L16 11.5L3.5 5.5Z" fill="#76B3E1"/><path d="M16 11.5L21 8L21 16L16 19.5L16 11.5Z" fill="#4F88C6"/><path d="M3.5 5.5L3.5 13.5L16 19.5L16 11.5L3.5 5.5Z" fill="#2C4F7C"/></svg>`,
    angular: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4"><path d="M12 2L3 6.5L4.5 18.5L12 22L19.5 18.5L21 6.5L12 2Z" fill="#DD0031"/><path d="M12 2L12 22L19.5 18.5L21 6.5L12 2Z" fill="#C3002F"/><path d="M12 4.5L6.5 17.5H8.7L9.8 14.5H14.1L15.2 17.5H17.4L12 4.5ZM13.3 12.5H10.6L12 8.5L13.3 12.5Z" fill="white"/></svg>`,
}

function NavSection({ title, items, currentRoute, sublabels }: { title: string; items: NavGroup["items"]; currentRoute: string; sublabels?: Record<number, string> }) {
    return (
        <div className="mb-4">
            <button
                className="nav-section-toggle cursor-pointer flex items-center gap-1.5 w-full px-3 py-1 mb-0.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-chevron shrink-0 transition-transform">
                    <path d="m6 9 6 6 6-6" />
                </svg>
                <span>{title}</span>
            </button>
            <ul className="nav-section-items">
                {items.map((item, i) => {
                    const isActive = currentRoute === item.route
                    const api = isApiName(item.title)
                    const label = sublabels?.[i]
                    return (
                        <li key={item.route}>
                            {label && (
                                <div className={`flex items-center gap-2 ml-5 mr-3 ${i > 0 ? "mt-3 mb-1" : "mt-0.5 mb-1"}`}>
                                    <span className="text-[0.6rem] font-medium uppercase tracking-widest text-zinc-300 dark:text-zinc-600 shrink-0">{label}</span>
                                    <div className="flex-1 border-t border-border-subtle dark:border-border-subtle-dark" />
                                </div>
                            )}
                            <a
                                href={item.route}
                                className={`block px-3 py-1.5 ml-2 rounded-md text-sm transition-colors ${
                                    isActive
                                        ? "bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400 font-medium border-l-2 border-accent-500 ml-[calc(0.5rem-1px)]"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-surface-sunken dark:hover:bg-surface-raised-dark"
                                } ${api ? "font-mono text-[0.8125rem]" : ""}`}
                            >
                                {item.title}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export function Sidebar({ nav, currentRoute, framework }: Props) {
    const introGroup = nav.find(g => !g.framework)
    const fwGroups = nav.filter(g => !!g.framework)
    const activeFw = framework || "react"

    return (
        <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-border dark:border-border-dark bg-surface-raised dark:bg-surface-sunken-dark h-screen sticky top-0">
            {/* Logo */}
            <div className="px-4 pt-4 pb-3">
                <a href="/" className="flex items-center gap-2.5">
                    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                        <rect width="48" height="48" rx="12" className="fill-accent-500" />
                        <path d="M13 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                        <path d="M35 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                    </svg>
                    <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                        Valdres
                    </span>
                </a>
            </div>

            <nav className="flex-1 px-3 pb-6 overflow-y-auto">
                {/* Introduction group */}
                {introGroup && (
                    <NavSection title={introGroup.title} items={introGroup.items} currentRoute={currentRoute} sublabels={introGroup.sublabels} />
                )}

                {/* Divider */}
                <div className="mx-1 my-3 border-t border-border dark:border-border-dark" />

                {/* Framework selector */}
                <div className="mb-5">
                    <div className="relative" id="sidebar-fw-selector">
                        <button
                            id="sidebar-fw-trigger"
                            className="cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark hover:border-accent-400 dark:hover:border-accent-600 transition-colors"
                        >
                            {frameworkList.filter(f => f !== "vanilla").map(fw => (
                                <span
                                    key={fw}
                                    data-fw-label={fw}
                                    className={`flex items-center gap-2 flex-1 min-w-0 ${fw === activeFw ? "" : "hidden"}`}
                                >
                                    <span
                                        className="shrink-0"
                                        dangerouslySetInnerHTML={{
                                            __html: frameworkLogos[fw],
                                        }}
                                    />
                                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                                        {frameworks[fw].label}
                                    </span>
                                </span>
                            ))}
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 dark:text-zinc-500 shrink-0 ml-auto">
                                <path d="m7 10 5 5 5-5" />
                            </svg>
                        </button>
                        <div id="sidebar-fw-menu" className="hidden absolute left-0 right-0 top-full mt-1 rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-raised-dark shadow-lg z-50 py-1 overflow-hidden">
                            {frameworkList.filter(f => f !== "vanilla").map(fw => (
                                <button
                                    key={fw}
                                    data-fw={fw}
                                    className={`fw-option cursor-pointer w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-surface-sunken dark:hover:bg-surface-dark ${
                                        fw === activeFw
                                            ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                                            : "text-zinc-600 dark:text-zinc-400"
                                    }`}
                                >
                                    <span
                                        className="shrink-0"
                                        dangerouslySetInnerHTML={{
                                            __html: frameworkLogos[fw],
                                        }}
                                    />
                                    {frameworks[fw].label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Framework-aware groups (Getting Started + API per framework) */}
                {fwGroups.map(group => {
                    const isActiveFw = !framework
                        ? group.framework === "react"
                        : true

                    return (
                        <div
                            key={`${group.framework}-${group.title}`}
                            className={!isActiveFw ? "hidden" : ""}
                            data-fw-nav={group.framework}
                        >
                            <NavSection title={group.title} items={group.items} currentRoute={currentRoute} sublabels={group.sublabels} />
                        </div>
                    )
                })}
            </nav>
        </aside>
    )
}
