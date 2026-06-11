import type { DocEntry } from "../src/discover"
import type { Framework } from "../src/frameworks"
import { frameworks, frameworkList } from "../src/frameworks"

export type NavItem = {
    title: string
    route: string
}

export type NavGroup = {
    title: string
    items: NavItem[]
    framework?: Framework
    /** Render a subtle sub-label before the item at this index */
    sublabels?: Record<number, string>
}

// General articles shown above the framework selector
const introduction: NavGroup = {
    title: "Introduction",
    items: [
        { title: "Introduction", route: "/guides/introduction" },
        { title: "Core Concepts", route: "/guides/core-concepts" },
        { title: "Patterns & Recipes", route: "/guides/patterns" },
        { title: "Transactions", route: "/guides/transactions" },
        { title: "Scoped Stores", route: "/guides/scoped-stores" },
        { title: "TypeScript", route: "/guides/typescript" },
        { title: "Works Everywhere", route: "/guides/outside-react" },
        { title: "Performance", route: "/guides/performance" },
        { title: "Motivation", route: "/guides/motivation" },
    ],
}

const examples: NavGroup = {
    title: "Examples",
    items: [
        { title: "Todo List", route: "/guides/example-todo" },
        { title: "Currency Converter", route: "/guides/example-currency" },
        { title: "Profile Editor", route: "/guides/example-profile-editor" },
        { title: "User Dashboard", route: "/guides/example-dashboard" },
        { title: "Shared Notepad", route: "/guides/example-notepad" },
    ],
}

// Core valdres API names — routes are framework-scoped
const coreApiNames = ["atom", "selector", "atomFamily", "selectorFamily", "store"]

// Extra Getting Started items per framework
const frameworkGettingStarted: Partial<Record<Framework, NavItem[]>> = {
    react: [
        { title: "Migration Guide", route: "/guides/migration" },
        { title: "Valdres vs Jotai", route: "/guides/vs-jotai" },
        { title: "Valdres vs Recoil", route: "/guides/vs-recoil" },
    ],
    vue: [
        { title: "Quick Start", route: "/guides/quick-start-vue" },
    ],
    svelte: [
        { title: "Quick Start", route: "/guides/quick-start-svelte" },
    ],
    solid: [
        { title: "Quick Start", route: "/guides/quick-start-solid" },
    ],
    angular: [
        { title: "Quick Start", route: "/guides/quick-start-angular" },
    ],
}

function getGettingStartedGroup(fw: Framework): NavGroup {
    const items: NavItem[] = [
        { title: "Installation", route: "/guides/installation" },
        ...(frameworkGettingStarted[fw] || []),
    ]
    return {
        title: "Getting Started",
        items,
        framework: fw,
    }
}

function getApiGroup(
    fw: Framework,
    entries: DocEntry[],
): NavGroup {
    const coreItems: NavItem[] = coreApiNames.map(name => ({
        title: name,
        route: `/${fw}/${name}`,
    }))

    const fwEntries = fw !== "vanilla"
        ? entries
            .filter(e =>
                e.framework === fw &&
                e.type === "api" &&
                !e.route.includes("/plugins/") &&
                !coreApiNames.includes(e.route.split("/").pop() || ""),
            )
            .map(e => ({
                title: e.frontmatter.title,
                route: e.route,
            }))
        : []

    return {
        title: "API",
        items: [...coreItems, ...fwEntries],
        framework: fw,
        sublabels: fwEntries.length > 0
            ? { 0: "Core", [coreItems.length]: frameworks[fw].label }
            : undefined,
    }
}

function getPluginsGroup(
    fw: Framework,
    entries: DocEntry[],
): NavGroup | null {
    const items = entries
        .filter(e => e.framework === fw && e.type === "plugin")
        .map(e => ({ title: e.frontmatter.title, route: e.route }))
        .sort((a, b) => a.title.localeCompare(b.title))

    if (items.length === 0) return null

    return { title: "Plugins", items, framework: fw }
}

export function getNav(
    framework: Framework,
    entries: DocEntry[],
): NavGroup[] {
    const groups: NavGroup[] = [
        introduction,
        getGettingStartedGroup(framework),
        getApiGroup(framework, entries),
    ]
    const plugins = getPluginsGroup(framework, entries)
    if (plugins) groups.push(plugins)
    groups.push(examples)
    return groups
}

export function getNavAllFrameworks(
    entries: DocEntry[],
): NavGroup[] {
    const groups: NavGroup[] = [introduction]

    for (const fw of frameworkList) {
        if (fw === "vanilla") continue
        groups.push(getGettingStartedGroup(fw))
        groups.push(getApiGroup(fw, entries))
        const plugins = getPluginsGroup(fw, entries)
        if (plugins) groups.push(plugins)
    }

    groups.push(examples)

    return groups
}
