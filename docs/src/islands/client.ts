// ════════════════════════════════════════════
// Prefetch — hover-triggered, delegated on document
// ════════════════════════════════════════════

const prefetched = new Set<string>()
document.addEventListener("pointerenter", (e) => {
    const link = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null
    if (!link) return
    const href = link.getAttribute("href")
    if (!href || !href.startsWith("/") || prefetched.has(href)) return
    prefetched.add(href)
    const el = document.createElement("link")
    el.rel = "prefetch"
    el.href = href
    document.head.appendChild(el)
}, true)

// ════════════════════════════════════════════
// Content init — re-runs after each navigation
// ════════════════════════════════════════════

let tocSpyCleanup: (() => void) | null = null

function initCodeBlocks() {
    document.querySelectorAll("pre.shiki:not([data-enhanced])").forEach(pre => {
        pre.setAttribute("data-enhanced", "")

        const wrapper = document.createElement("div")
        wrapper.className = "code-block-wrapper"
        pre.parentNode?.insertBefore(wrapper, pre)
        wrapper.appendChild(pre)

        const button = document.createElement("button")
        button.className = "copy-button"
        button.setAttribute("aria-label", "Copy code")
        button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`

        button.addEventListener("click", () => {
            const code = pre.querySelector("code")?.textContent || ""
            navigator.clipboard.writeText(code).then(() => {
                button.classList.add("copied")
                button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
                setTimeout(() => {
                    button.classList.remove("copied")
                    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
                }, 2000)
            })
        })

        wrapper.appendChild(button)

        const langClass = Array.from(pre.classList).find(c => c.startsWith("language-"))
        if (langClass) {
            const lang = langClass.replace("language-", "")
            const label = document.createElement("span")
            label.className = "code-lang"
            label.textContent = lang
            wrapper.appendChild(label)
        }
    })
}

function initHeadingAnchors() {
    document.querySelectorAll(".prose h2[id], .prose h3[id], .prose h4[id]").forEach(heading => {
        if (heading.querySelector(".heading-anchor")) return
        const id = heading.getAttribute("id")
        if (!id) return
        const anchor = document.createElement("a")
        anchor.href = `#${id}`
        anchor.className = "heading-anchor"
        anchor.setAttribute("aria-label", `Link to ${heading.textContent}`)
        anchor.textContent = "#"
        heading.prepend(anchor)
    })
}

function initTocSpy() {
    tocSpyCleanup?.()
    tocSpyCleanup = null

    const tocLinks = document.querySelectorAll<HTMLAnchorElement>(".toc-link")
    if (tocLinks.length === 0) return

    const headingIds = Array.from(tocLinks).map(link =>
        link.getAttribute("href")?.slice(1) || "",
    )

    function updateActiveToc() {
        let activeId = headingIds[0]
        for (const id of headingIds) {
            const el = document.getElementById(id)
            if (el && el.getBoundingClientRect().top <= 100) {
                activeId = id
            }
        }
        tocLinks.forEach(link => {
            const id = link.getAttribute("href")?.slice(1)
            link.classList.toggle("active", id === activeId)
        })
    }

    window.addEventListener("scroll", updateActiveToc, { passive: true })
    updateActiveToc()
    tocSpyCleanup = () => window.removeEventListener("scroll", updateActiveToc)
}

function initTabs() {
    document.querySelectorAll("[data-tabs]:not([data-enhanced])").forEach(tabs => {
        tabs.setAttribute("data-enhanced", "")
        const triggers = tabs.querySelectorAll<HTMLButtonElement>(".tab-trigger")
        const panels = tabs.querySelectorAll<HTMLElement>(".tab-panel")

        triggers.forEach(trigger => {
            trigger.addEventListener("click", () => {
                const target = trigger.dataset.tab
                triggers.forEach(t => t.classList.remove("active"))
                panels.forEach(p => p.classList.remove("active"))
                trigger.classList.add("active")
                tabs.querySelector<HTMLElement>(`.tab-panel[data-tab="${target}"]`)?.classList.add("active")
            })
        })
    })
}

function initContent() {
    initCodeBlocks()
    initHeadingAnchors()
    initTocSpy()
    initTabs()
}

// ════════════════════════════════════════════
// Sidebar init — re-runs after sidebar swap
// ════════════════════════════════════════════

function applySidebarState() {
    // Framework nav visibility (guide pages only)
    const fw = localStorage.getItem("valdres-framework")
    if (fw && !document.documentElement.dataset.framework) {
        document.querySelectorAll<HTMLElement>("[data-fw-nav]").forEach(el => {
            el.classList.toggle("hidden", el.dataset.fwNav !== fw)
        })
        document.querySelectorAll<HTMLElement>("[data-fw-label]").forEach(el => {
            el.classList.toggle("hidden", el.dataset.fwLabel !== fw)
        })
    }

    // Collapsed sections
    let collapsed: string[] = []
    try { collapsed = JSON.parse(localStorage.getItem("valdres-nav-collapsed") || "[]") } catch {}
    if (collapsed.length) {
        document.querySelectorAll<HTMLButtonElement>(".nav-section-toggle").forEach(btn => {
            const name = btn.textContent?.trim() || ""
            if (collapsed.includes(name)) {
                const items = btn.nextElementSibling as HTMLElement | null
                const chevron = btn.querySelector(".nav-chevron") as HTMLElement | null
                if (items) items.classList.add("hidden")
                if (chevron) chevron.classList.add("rotate-[-90deg]")
            }
        })
    }
}

function initNavCollapsing() {
    document.querySelectorAll<HTMLButtonElement>(".nav-section-toggle").forEach(btn => {
        if ((btn as any)._collapseInit) return
        ;(btn as any)._collapseInit = true

        btn.addEventListener("click", () => {
            const items = btn.nextElementSibling as HTMLElement | null
            const chevron = btn.querySelector(".nav-chevron") as HTMLElement | null
            if (!items) return

            const isHidden = items.classList.toggle("hidden")
            chevron?.classList.toggle("rotate-[-90deg]", isHidden)

            const name = btn.textContent?.trim() || ""
            let collapsed: string[] = []
            try { collapsed = JSON.parse(localStorage.getItem("valdres-nav-collapsed") || "[]") } catch {}
            if (isHidden) {
                if (!collapsed.includes(name)) collapsed.push(name)
            } else {
                const idx = collapsed.indexOf(name)
                if (idx !== -1) collapsed.splice(idx, 1)
            }
            localStorage.setItem("valdres-nav-collapsed", JSON.stringify(collapsed))
        })
    })
}

function initFrameworkDropdowns() {
    const fwDropdowns = [
        { trigger: "sidebar-fw-trigger", menu: "sidebar-fw-menu" },
        { trigger: "mobile-fw-trigger", menu: "mobile-fw-menu" },
    ]

    for (const { trigger: triggerId, menu: menuId } of fwDropdowns) {
        const trigger = document.getElementById(triggerId)
        const menu = document.getElementById(menuId)
        if (!trigger || !menu) continue
        if ((trigger as any)._fwInit) continue
        ;(trigger as any)._fwInit = true

        trigger.addEventListener("click", (e) => {
            e.stopPropagation()
            fwDropdowns.forEach(d => {
                if (d.menu !== menuId) document.getElementById(d.menu)?.classList.add("hidden")
            })
            menu.classList.toggle("hidden")
        })

        menu.querySelectorAll<HTMLButtonElement>(".fw-option").forEach(btn => {
            btn.addEventListener("click", () => {
                const fw = btn.dataset.fw
                if (fw) handleFrameworkSwitch(fw)
                menu.classList.add("hidden")
            })
        })
    }
}

function handleFrameworkSwitch(fw: string) {
    localStorage.setItem("valdres-framework", fw)

    const isFrameworkPage = !!document.documentElement.dataset.framework
    if (isFrameworkPage) {
        const mapEl = document.getElementById("framework-map")
        if (mapEl) {
            try {
                const map = JSON.parse(mapEl.textContent || "{}")
                if (map[fw]) {
                    navigateTo(map[fw])
                    return
                }
            } catch {}
        }
    }

    // Non-framework pages: toggle sidebar in-place
    document.querySelectorAll<HTMLElement>("[data-fw-label]").forEach(el => {
        el.classList.toggle("hidden", el.dataset.fwLabel !== fw)
    })
    document.querySelectorAll<HTMLElement>(".fw-option").forEach(el => {
        const isCurrent = el.dataset.fw === fw
        el.classList.toggle("text-zinc-900", isCurrent)
        el.classList.toggle("dark:text-zinc-100", isCurrent)
        el.classList.toggle("font-semibold", isCurrent)
        el.classList.toggle("text-zinc-600", !isCurrent)
        el.classList.toggle("dark:text-zinc-400", !isCurrent)
    })
    if (!isFrameworkPage) {
        document.querySelectorAll<HTMLElement>("[data-fw-nav]").forEach(el => {
            el.classList.toggle("hidden", el.dataset.fwNav !== fw)
        })
    }
}

function initSidebar() {
    applySidebarState()
    initNavCollapsing()
    initFrameworkDropdowns()
}

// ════════════════════════════════════════════
// Client-side router
// ════════════════════════════════════════════

const pageCache = new Map<string, Document>()
let navigating = false

function isRoutable(href: string): boolean {
    if (!href.startsWith("/")) return false
    if (href.startsWith("/pagefind/")) return false
    if (href === "/") return false
    // Only route docs pages (guides + framework APIs)
    return href.startsWith("/guides/") ||
        /^\/(react|vue|svelte|solid|angular)\//.test(href)
}

async function fetchPage(href: string): Promise<Document | null> {
    const cached = pageCache.get(href)
    if (cached) return cached

    try {
        const res = await fetch(href)
        if (!res.ok) return null
        const html = await res.text()
        const doc = new DOMParser().parseFromString(html, "text/html")
        pageCache.set(href, doc)
        return doc
    } catch {
        return null
    }
}

async function navigateTo(href: string, pushState = true) {
    if (navigating) return
    navigating = true

    try {
        const doc = await fetchPage(href)
        if (!doc) {
            // Fallback to full page load
            window.location.href = href
            return
        }

        // Swap page content (main + ToC)
        const newContent = doc.getElementById("page-content")
        const currentContent = document.getElementById("page-content")
        if (!newContent || !currentContent) {
            window.location.href = href
            return
        }
        currentContent.innerHTML = newContent.innerHTML

        // Swap sidebar nav — apply state before restoring scroll so layout is stable
        const sidebarNav = document.querySelector<HTMLElement>("aside nav")
        const newSidebarNav = doc.querySelector<HTMLElement>("aside nav")
        if (sidebarNav && newSidebarNav) {
            const scrollTop = sidebarNav.scrollTop
            sidebarNav.innerHTML = newSidebarNav.innerHTML
            applySidebarState()
            initNavCollapsing()
            initFrameworkDropdowns()
            sidebarNav.scrollTop = scrollTop
        }

        // Swap mobile sidebar
        const mobileSidebar = document.getElementById("mobile-sidebar")
        const newMobileSidebar = doc.getElementById("mobile-sidebar")
        if (mobileSidebar && newMobileSidebar) {
            mobileSidebar.innerHTML = newMobileSidebar.innerHTML
        }

        // Update framework map
        const newMap = doc.getElementById("framework-map")
        const currentMap = document.getElementById("framework-map")
        if (newMap && currentMap) {
            currentMap.textContent = newMap.textContent
        }

        // Update html data-framework
        const newFw = doc.documentElement.dataset.framework
        if (newFw) {
            document.documentElement.dataset.framework = newFw
        } else {
            delete document.documentElement.dataset.framework
        }

        // Update title
        document.title = doc.title

        // Scroll to top
        window.scrollTo(0, 0)

        // Push history state
        if (pushState) {
            history.pushState({}, "", href)
        }

        // Re-initialize content + mobile sidebar
        initContent()
        initMobileSidebarListeners()

        // Notify demos
        document.dispatchEvent(new Event("valdres:navigate"))

    } finally {
        navigating = false
    }
}

// Intercept link clicks (delegated on document — survives DOM swaps)
document.addEventListener("click", (e) => {
    // Don't intercept modified clicks (new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    // Only intercept when we're on a page with the router layout
    if (!document.getElementById("page-content")) return

    const link = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null
    if (!link) return

    const href = link.getAttribute("href")
    if (!href || !isRoutable(href)) return

    // Don't navigate to the same page
    if (href === window.location.pathname) {
        e.preventDefault()
        return
    }

    e.preventDefault()
    navigateTo(href)
})

// Handle back/forward
window.addEventListener("popstate", () => {
    const href = window.location.pathname
    if (isRoutable(href)) {
        navigateTo(href, false)
    }
})

// ════════════════════════════════════════════
// Persistent UI — runs once on load
// ════════════════════════════════════════════

// Close framework dropdowns on outside click
document.addEventListener("click", () => {
    document.getElementById("sidebar-fw-menu")?.classList.add("hidden")
    document.getElementById("mobile-fw-menu")?.classList.add("hidden")
})

// Framework preference on initial load
const storedFw = localStorage.getItem("valdres-framework")
const initialFramework = document.documentElement.dataset.framework
if (storedFw && storedFw !== (initialFramework || "react")) {
    if (initialFramework) {
        // On framework pages, redirect to stored preference's equivalent
        const mapEl = document.getElementById("framework-map")
        if (mapEl) {
            try {
                const map = JSON.parse(mapEl.textContent || "{}")
                if (map[storedFw]) window.location.replace(map[storedFw])
            } catch {}
        }
    }
} else if (!storedFw) {
    localStorage.setItem("valdres-framework", initialFramework || "react")
} else if (initialFramework) {
    localStorage.setItem("valdres-framework", initialFramework)
}

// Theme toggle
const themeToggle = document.getElementById("theme-toggle")
if (themeToggle && !document.getElementById("react-island")) {
    themeToggle.addEventListener("click", () => {
        document.documentElement.classList.add("theme-transition")
        const isDark = document.documentElement.classList.toggle("dark")
        localStorage.setItem("theme", isDark ? "dark" : "light")
        setTimeout(() => document.documentElement.classList.remove("theme-transition"), 350)
    })
}

// Mobile sidebar open/close
function initMobileSidebarListeners() {
    const mobileToggle = document.getElementById("mobile-menu-toggle")
    const mobileSidebar = document.getElementById("mobile-sidebar")
    const mobileBackdrop = document.getElementById("mobile-sidebar-backdrop")
    const mobileClose = document.getElementById("mobile-sidebar-close")

    function openMobile() {
        if (!mobileSidebar) return
        mobileSidebar.classList.remove("hidden")
        mobileSidebar.classList.add("entering")
        requestAnimationFrame(() => {
            mobileSidebar.classList.remove("entering")
            mobileSidebar.classList.add("visible")
        })
    }

    function closeMobile() {
        if (!mobileSidebar) return
        mobileSidebar.classList.remove("visible")
        mobileSidebar.classList.add("hidden-sliding")
        setTimeout(() => {
            mobileSidebar.classList.add("hidden")
            mobileSidebar.classList.remove("hidden-sliding")
        }, 200)
    }

    // Remove old listeners by replacing elements (only for backdrop/close inside swapped mobile sidebar)
    mobileToggle?.addEventListener("click", openMobile)
    mobileBackdrop?.addEventListener("click", closeMobile)
    mobileClose?.addEventListener("click", closeMobile)
}
initMobileSidebarListeners()

// Search
const searchDialog = document.getElementById("search-dialog")
const searchBackdrop = document.getElementById("search-backdrop")
const searchInput = document.getElementById("search-input") as HTMLInputElement
const searchResults = document.getElementById("search-results")
const searchTrigger = document.getElementById("search-trigger")

let pagefind: any = null

function openSearch() {
    if (!searchDialog) return
    searchDialog.classList.remove("hidden")
    searchDialog.classList.add("entering")
    requestAnimationFrame(() => {
        searchDialog.classList.remove("entering")
        searchDialog.classList.add("visible")
    })
    searchInput?.focus()
}

function closeSearch() {
    if (!searchDialog) return
    searchDialog.classList.remove("visible")
    searchDialog.classList.add("entering")
    setTimeout(() => {
        searchDialog.classList.add("hidden")
        searchDialog.classList.remove("entering")
        if (searchInput) searchInput.value = ""
        if (searchResults) {
            searchResults.innerHTML =
                '<p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Start typing to search...</p>'
        }
    }, 150)
}

searchTrigger?.addEventListener("click", openSearch)
searchBackdrop?.addEventListener("click", closeSearch)

// Keyboard shortcuts
document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (searchDialog?.classList.contains("hidden")) openSearch()
        else closeSearch()
    }
    if (e.key === "Escape") {
        if (!searchDialog?.classList.contains("hidden")) closeSearch()
        const mobileSidebar = document.getElementById("mobile-sidebar")
        if (mobileSidebar && !mobileSidebar.classList.contains("hidden")) {
            mobileSidebar.classList.remove("visible")
            mobileSidebar.classList.add("hidden")
        }
    }
})

async function loadPagefind() {
    if (pagefind) return pagefind
    try {
        pagefind = await import("/pagefind/pagefind.js" as string)
        await pagefind.init()
        return pagefind
    } catch {
        return null
    }
}

let debounceTimer: ReturnType<typeof setTimeout>

searchInput?.addEventListener("input", () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
        const query = searchInput.value.trim()
        if (!query) {
            if (searchResults) {
                searchResults.innerHTML =
                    '<p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Start typing to search...</p>'
            }
            return
        }

        const pf = await loadPagefind()
        if (!pf) {
            if (searchResults) {
                searchResults.innerHTML =
                    '<p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">Search is not available</p>'
            }
            return
        }

        const search = await pf.search(query)
        if (!searchResults) return

        if (search.results.length === 0) {
            searchResults.innerHTML =
                '<p class="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No results found</p>'
            return
        }

        const results = await Promise.all(
            search.results.slice(0, 8).map((r: any) => r.data()),
        )

        searchResults.innerHTML = results
            .map(
                (r: any) => `
                <a href="${r.url}" class="block px-3 py-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                    <div class="text-sm font-medium text-zinc-900 dark:text-zinc-100">${r.meta?.title || r.url}</div>
                    <div class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">${r.excerpt}</div>
                </a>
            `,
            )
            .join("")
    }, 150)
})

// Landing page code tabs
const codeTabs = document.getElementById("code-tabs")
if (codeTabs) {
    codeTabs.querySelectorAll<HTMLButtonElement>(".code-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab
            codeTabs.querySelectorAll(".code-tab").forEach(t => {
                t.classList.remove("active", "border-accent-500", "text-accent-600", "dark:text-accent-400")
                t.classList.add("border-transparent", "text-zinc-500", "dark:text-zinc-400")
            })
            tab.classList.add("active", "border-accent-500", "text-accent-600", "dark:text-accent-400")
            tab.classList.remove("border-transparent", "text-zinc-500", "dark:text-zinc-400")

            document.querySelectorAll<HTMLElement>(".code-panel").forEach(panel => {
                panel.classList.add("hidden")
            })
            document.getElementById(`code-${target}`)?.classList.remove("hidden")
        })
    })
}

// ════════════════════════════════════════════
// Initial page setup
// ════════════════════════════════════════════

initSidebar()
initContent()
