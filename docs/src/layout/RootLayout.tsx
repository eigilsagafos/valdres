import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { TopNav } from "./TopNav"
import { SearchDialog } from "./SearchDialog"
import { MobileSidebar } from "./MobileSidebar"
import { Footer } from "./Footer"
import { PrevNext } from "./PrevNext"
import { TableOfContents, type TocItem } from "./TableOfContents"
import type { NavGroup } from "../../content/nav"
import type { Framework } from "../frameworks"

type Props = {
    title: string
    description?: string
    currentRoute: string
    nav: NavGroup[]
    headings: TocItem[]
    framework?: Framework
    frameworkMap?: Record<Framework, string | null>
    children: ReactNode
}

export function RootLayout({
    title,
    description,
    currentRoute,
    nav,
    headings,
    framework,
    frameworkMap,
    children,
}: Props) {
    const pageTitle = title ? `${title} - Valdres` : "Valdres"

    return (
        <html
            lang="en"
            className="dark"
            {...(framework ? { "data-framework": framework } : {})}
        >
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>{pageTitle}</title>
                {description && (
                    <meta name="description" content={description} />
                )}
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Valdres" />
                <meta property="og:title" content={pageTitle} />
                {description && (
                    <meta property="og:description" content={description} />
                )}
                <meta
                    property="og:url"
                    content={`https://valdres.dev${currentRoute}`}
                />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={pageTitle} />
                {description && (
                    <meta
                        name="twitter:description"
                        content={description}
                    />
                )}
                <link
                    rel="alternate"
                    type="text/markdown"
                    href={`${currentRoute}.md`}
                    title="Markdown version of this page"
                />
                <link rel="stylesheet" href="/styles.css" />
                <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='48' height='48' rx='12' fill='oklch(0.7 0.18 80)'/%3E%3Cpath d='M13 13L24 35' stroke='white' stroke-width='4' stroke-linecap='round' opacity='0.9'/%3E%3Cpath d='M35 13L24 35' stroke='white' stroke-width='4' stroke-linecap='round' opacity='0.6'/%3E%3C/svg%3E" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin=""
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
                    rel="stylesheet"
                />

                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.remove('dark');else if(t==='dark'||!t)document.documentElement.classList.add('dark');else if(window.matchMedia('(prefers-color-scheme: light)').matches)document.documentElement.classList.remove('dark')})()`,
                    }}
                />
            </head>
            <body className="bg-surface dark:bg-surface-dark text-zinc-800 dark:text-zinc-200 antialiased">
                <div className="flex min-h-screen">
                    <Sidebar
                        nav={nav}
                        currentRoute={currentRoute}
                        framework={framework}
                    />
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `(function(){var fw=localStorage.getItem('valdres-framework');if(fw&&!document.documentElement.dataset.framework){document.querySelectorAll('[data-fw-nav]').forEach(function(el){el.classList.toggle('hidden',el.dataset.fwNav!==fw)});document.querySelectorAll('[data-fw-label]').forEach(function(el){el.classList.toggle('hidden',el.dataset.fwLabel!==fw)})}var collapsed=[];try{collapsed=JSON.parse(localStorage.getItem('valdres-nav-collapsed')||'[]')}catch(e){}if(collapsed.length){document.querySelectorAll('.nav-section-toggle').forEach(function(btn){var name=btn.textContent.trim();if(collapsed.indexOf(name)!==-1){var items=btn.nextElementSibling;var chevron=btn.querySelector('.nav-chevron');if(items)items.classList.add('hidden');if(chevron)chevron.classList.add('rotate-[-90deg]')}})}var active=document.querySelector('aside nav .border-accent-500');if(active)active.scrollIntoView({block:'center'})})()`,
                        }}
                    />
                    <div className="flex-1 flex flex-col min-w-0">
                        <TopNav framework={framework} />
                        <div id="page-content" className="flex-1 flex">
                            <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 min-w-0">
                                <article className="prose dark:prose-invert prose-zinc max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-code:before:content-none prose-code:after:content-none prose-code:bg-surface-sunken prose-code:dark:bg-surface-raised-dark prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8125rem] prose-code:font-medium prose-pre:bg-transparent prose-pre:border-0 prose-pre:p-0">
                                    {children}
                                    <div id="api-demo" />
                                    <PrevNext
                                        currentRoute={currentRoute}
                                        nav={nav}
                                    />
                                </article>
                                <Footer />
                            </main>
                            <TableOfContents headings={headings} />
                        </div>
                    </div>
                </div>
                <MobileSidebar
                    nav={nav}
                    currentRoute={currentRoute}
                    framework={framework}
                />
                <SearchDialog />
                <script
                    type="application/json"
                    id="framework-map"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(frameworkMap),
                    }}
                />
                <script type="module" src="/client.js" />
                <script type="module" src="/demos.js" />
            </body>
        </html>
    )
}
