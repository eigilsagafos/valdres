import { Analytics } from "./Analytics"

type BenchProps = {
    jscAverage: number | null
    v8Average: number | null
    jotaiVersion: string
    benchmarkCount: number
}

export function LandingPage({ bench }: { bench?: BenchProps }) {
    const jscAvg = bench?.jscAverage ?? 6.3
    const v8Avg = bench?.v8Average ?? 2.8
    const jotaiVer = bench?.jotaiVersion ?? "2.19.0"
    const benchCount = bench?.benchmarkCount ?? 28
    return (
        <html lang="en" className="dark">
            <head>
                <meta charSet="utf-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Valdres — Reactive State Management</title>
                <meta
                    name="description"
                    content="Reactive state management for React, Vue, Svelte, Solid, and Angular. One store, shared across frameworks. Inspired by Recoil and Jotai."
                />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Valdres" />
                <meta
                    property="og:title"
                    content="Valdres — Reactive State Management"
                />
                <meta
                    property="og:description"
                    content="Reactive state management for React, Vue, Svelte, Solid, and Angular. One store, shared across frameworks. Inspired by Recoil and Jotai."
                />
                <meta property="og:url" content="https://valdres.dev" />
                <meta name="twitter:card" content="summary" />
                <meta
                    name="twitter:title"
                    content="Valdres — Reactive State Management"
                />
                <meta
                    name="twitter:description"
                    content="Reactive state management for React, Vue, Svelte, Solid, and Angular. One store, shared across frameworks. Inspired by Recoil and Jotai."
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

                <Analytics />
            </head>
            <body className="bg-surface dark:bg-surface-dark text-zinc-800 dark:text-zinc-200 antialiased">
                <div className="min-h-screen flex flex-col">
                    {/* Nav */}
                    <header className="border-b border-border dark:border-border-dark bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm">
                        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-6">
                            <a href="/" className="flex items-center gap-2.5">
                                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                                    <rect width="48" height="48" rx="12" className="fill-accent-500" />
                                    <path d="M13 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
                                    <path d="M35 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                                </svg>
                                <span className="text-lg font-semibold tracking-tight">
                                    Valdres
                                </span>
                            </a>
                            <div className="flex items-center gap-4">
                                <a
                                    href="/guides/introduction"
                                    className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                                >
                                    Docs
                                </a>
                                <a
                                    href="https://github.com/eigilsagafos/valdres"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                    >
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                    </svg>
                                </a>
                                <button
                                    id="theme-toggle"
                                    className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
                                    aria-label="Toggle theme"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="dark:hidden"
                                    >
                                        <circle cx="12" cy="12" r="4" />
                                        <path d="M12 2v2" />
                                        <path d="M12 20v2" />
                                        <path d="m4.93 4.93 1.41 1.41" />
                                        <path d="m17.66 17.66 1.41 1.41" />
                                        <path d="M2 12h2" />
                                        <path d="M20 12h2" />
                                        <path d="m6.34 17.66-1.41 1.41" />
                                        <path d="m19.07 4.93-1.41 1.41" />
                                    </svg>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="hidden dark:block"
                                    >
                                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </header>

                    {/* Hero */}
                    <section className="flex-1 flex items-center justify-center px-6 py-24 sm:py-32">
                        <div className="max-w-3xl mx-auto text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 text-xs font-medium mb-8">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                                Open source state management
                            </div>
                            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                                Reactive state{" "}
                                <span className="text-accent-500">
                                    that scales
                                </span>
                            </h1>
                            <p className="text-lg sm:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                                Fast, lightweight state management for React, Vue, Svelte, Solid, and Angular.
                                Atoms, selectors, and families — inspired by Recoil, built for performance.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
                                <a
                                    href="/guides/introduction"
                                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white font-medium text-sm transition-colors"
                                >
                                    Get Started
                                </a>
                                <a
                                    href="https://github.com/eigilsagafos/valdres"
                                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg border border-border dark:border-border-dark hover:bg-surface-raised dark:hover:bg-surface-raised-dark text-sm font-medium transition-colors"
                                >
                                    GitHub
                                </a>
                            </div>
                            <div className="bg-surface-sunken dark:bg-surface-sunken-dark rounded-xl border border-border dark:border-border-dark p-4 text-left max-w-lg mx-auto">
                                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                                    <span className="text-zinc-500">$</span>{" "}
                                    npm install valdres valdres-react
                                </code>
                            </div>
                        </div>
                    </section>

                    {/* Cross-framework demo */}
                    <section className="border-t border-border dark:border-border-dark px-6 py-20">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                                    One store. Five frameworks.
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                                    Share state seamlessly across React, Vue, Svelte, Solid, and Angular.
                                    Click any counter — they all stay in sync through a single valdres store.
                                </p>
                            </div>

                            {/* Valdres store wrapper */}
                            <div className="relative rounded-2xl border border-accent-200 dark:border-accent-800/40 bg-accent-50/30 dark:bg-accent-900/10 p-3 sm:p-4 mb-8 select-none" id="framework-demo">
                                {/* Store label + reset */}
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-widest text-accent-600 dark:text-accent-400">
                                        valdres store
                                    </span>
                                    <button
                                        id="demo-reset"
                                        className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>

                                {/* Framework islands grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                            <span className="w-4 h-4"><ReactIcon /></span>
                                            <span className="text-xs font-medium">React</span>
                                        </div>
                                        <div id="react-island">
                                            <div className="island-card text-sm text-zinc-400">Loading...</div>
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                            <span className="w-4 h-4"><VueIcon /></span>
                                            <span className="text-xs font-medium">Vue</span>
                                        </div>
                                        <div id="vue-island" />
                                    </div>
                                    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                            <span className="w-4 h-4"><SvelteIcon /></span>
                                            <span className="text-xs font-medium">Svelte</span>
                                        </div>
                                        <div id="svelte-island" />
                                    </div>
                                    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                            <span className="w-4 h-4"><SolidIcon /></span>
                                            <span className="text-xs font-medium">Solid</span>
                                        </div>
                                        <div id="solid-island" />
                                    </div>
                                    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden sm:col-span-1 col-span-2">
                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                            <span className="w-4 h-4"><AngularIcon /></span>
                                            <span className="text-xs font-medium">Angular</span>
                                        </div>
                                        <div id="angular-island" />
                                    </div>
                                </div>
                            </div>

                            {/* Code tabs */}
                            <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
                                <div className="flex flex-wrap border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark" id="code-tabs">
                                    <button className="code-tab active px-4 py-2.5 text-sm font-medium border-b-2 border-accent-500 text-accent-600 dark:text-accent-400 -mb-px" data-tab="shared">
                                        shared.ts
                                    </button>
                                    <button className="code-tab px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 -mb-px" data-tab="react-code">
                                        React
                                    </button>
                                    <button className="code-tab px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 -mb-px" data-tab="vue-code">
                                        Vue
                                    </button>
                                    <button className="code-tab px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 -mb-px" data-tab="svelte-code">
                                        Svelte
                                    </button>
                                    <button className="code-tab px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 -mb-px" data-tab="solid-code">
                                        Solid
                                    </button>
                                    <button className="code-tab px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 -mb-px" data-tab="angular-code">
                                        Angular
                                    </button>
                                </div>
                                <div className="bg-[#24292e]">
                                    <pre id="code-shared" className="code-panel p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightShared() }} />
                                    </pre>
                                    <pre id="code-react-code" className="code-panel hidden p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightReact() }} />
                                    </pre>
                                    <pre id="code-vue-code" className="code-panel hidden p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightVue() }} />
                                    </pre>
                                    <pre id="code-svelte-code" className="code-panel hidden p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightSvelte() }} />
                                    </pre>
                                    <pre id="code-solid-code" className="code-panel hidden p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightSolid() }} />
                                    </pre>
                                    <pre id="code-angular-code" className="code-panel hidden p-5 text-sm font-mono leading-relaxed overflow-x-auto">
                                        <code dangerouslySetInnerHTML={{ __html: highlightAngular() }} />
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Browser APIs as reactive state */}
                    <section className="border-t border-border dark:border-border-dark px-6 py-20">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                                    Browser APIs, reactive by default.
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                                    Valdres ships official packages that expose browser APIs as atoms — keyboard, online status, geolocation, and more. Subscribe from any framework and the UI stays in sync with the browser.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {/* Keyboard */}
                                <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                        <span className="text-xs font-medium">Keyboard</span>
                                        <code className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">@valdres/browser-keyboard</code>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                                        <div id="landing-keyboard-island" className="flex items-center">
                                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 w-full text-center">Loading...</div>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
                                            Try typing — keys light up as you press them.
                                        </p>
                                    </div>
                                </div>

                                {/* Online */}
                                <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                        <span className="text-xs font-medium">Online</span>
                                        <code className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">@valdres/browser-online</code>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                                        <div id="landing-online-island" className="flex-1 flex items-center justify-center min-h-[80px]">
                                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Loading...</div>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
                                            Toggle offline in DevTools to see it react.
                                        </p>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden flex flex-col">
                                    <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                                        <span className="text-xs font-medium">Location</span>
                                        <code className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">@valdres/browser-geolocation</code>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                                        <div id="landing-location-island" className="flex-1 flex items-center justify-center min-h-[80px]">
                                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Loading...</div>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-center">
                                            Reactive geolocation — coords stream as atoms.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Features */}
                    <section className="border-t border-border dark:border-border-dark px-6 py-20">
                        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            <FeatureCard
                                title="Tiny footprint"
                                description="Minimal bundle size with zero dependencies. Only ship what you use."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                                }
                            />
                            <FeatureCard
                                title="Minimal re-renders"
                                description="Fine-grained subscriptions update only what changed — via useSyncExternalStore in React, and each framework's native reactivity everywhere else."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                }
                            />
                            <FeatureCard
                                title="No string keys"
                                description="Atoms and selectors are identified by reference. No more managing unique string identifiers."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                }
                            />
                            <FeatureCard
                                title="First-class families"
                                description="atomFamily and selectorFamily are first-class citizens, not just utilities. Subscribe to entire families."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="8" x="2" y="2" rx="2"/><rect width="8" height="8" x="14" y="2" rx="2"/><rect width="8" height="8" x="2" y="14" rx="2"/><rect width="8" height="8" x="14" y="14" rx="2"/></svg>
                                }
                            />
                            <FeatureCard
                                title="Transactions"
                                description="Batch multiple atom updates so subscribers only fire once. Essential for complex state changes."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/></svg>
                                }
                            />
                            <FeatureCard
                                title="Every framework"
                                description="First-class bindings for React, Vue, Svelte, Solid, and Angular. Same atoms, same store — pick your framework."
                                icon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                }
                            />
                        </div>
                    </section>

                    {/* Benchmarks */}
                    <section className="border-t border-border dark:border-border-dark px-6 py-20">
                        <div className="max-w-5xl mx-auto">
                            <div className="text-center mb-12">
                                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
                                    A fast core engine
                                </h2>
                                <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                                    The framework-agnostic core is benchmarked head-to-head against Jotai
                                    across two JavaScript engines. These measure the shared engine itself —
                                    the framework adapters build on each framework's own reactivity.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
                                <div className="rounded-xl border border-border dark:border-border-dark p-8 text-center">
                                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                                        Safari / JavaScriptCore
                                    </div>
                                    <div className="text-5xl sm:text-6xl font-bold text-accent-500 mb-2" id="jsc-avg">
                                        {jscAvg}x
                                    </div>
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                        faster than Jotai
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border dark:border-border-dark p-8 text-center">
                                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                                        Chrome / V8
                                    </div>
                                    <div className="text-5xl sm:text-6xl font-bold text-accent-500 mb-2" id="v8-avg">
                                        {v8Avg}x
                                    </div>
                                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                                        faster than Jotai
                                    </div>
                                </div>
                            </div>
                            <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
Core-engine geometric mean across {benchCount} JS micro-benchmarks vs Jotai {jotaiVer}. {" "}
                                <a href="/guides/performance" className="text-accent-500 hover:underline">
                                    View detailed benchmarks
                                </a>
                            </p>
                        </div>
                    </section>

                    {/* Footer */}
                    <footer className="border-t border-border dark:border-border-dark">
                        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400 dark:text-zinc-500">
                            <p>
                                Built with{" "}
                                <a
                                    href="https://github.com/eigilsagafos/valdres"
                                    className="text-zinc-500 dark:text-zinc-400 hover:text-accent-500 transition-colors"
                                >
                                    Valdres
                                </a>
                            </p>
                            <div className="flex items-center gap-4">
                                <a
                                    href="https://github.com/eigilsagafos/valdres"
                                    className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                >
                                    GitHub
                                </a>
                                <a
                                    href="https://www.npmjs.com/package/valdres"
                                    className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                                >
                                    npm
                                </a>
                            </div>
                        </div>
                    </footer>
                </div>

                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                const theme = localStorage.getItem('theme');
                                if (theme === 'light') {
                                    document.documentElement.classList.remove('dark');
                                } else if (theme === 'dark' || !theme) {
                                    document.documentElement.classList.add('dark');
                                } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                                    document.documentElement.classList.remove('dark');
                                }
                            })();
                        `,
                    }}
                />
                <script type="module" src="/client.js" />
                <script type="module" src="/landing.js" />
            </body>
        </html>
    )
}

function FeatureCard({
    title,
    description,
    icon,
}: {
    title: string
    description: string
    icon: React.ReactNode
}) {
    return (
        <div className="rounded-xl border border-border dark:border-border-dark p-6 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center text-accent-500 mb-4">
                {icon}
            </div>
            <h3 className="text-sm font-semibold mb-2">{title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {description}
            </p>
        </div>
    )
}


function FrameworkPanel({
    name,
    color,
    icon,
    id,
}: {
    name: string
    color: string
    icon: React.ReactNode
    id: string
}) {
    return (
        <div className="rounded-xl border border-border dark:border-border-dark overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border dark:border-border-dark bg-surface-raised dark:bg-surface-raised-dark">
                <span className="w-5 h-5">{icon}</span>
                <span className="text-sm font-medium">{name}</span>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
                <div
                    className="text-5xl font-bold tabular-nums transition-all duration-150"
                    id={`${id}-count`}
                    style={{ color }}
                >
                    0
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="demo-btn w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-lg font-medium transition-colors flex items-center justify-center"
                        data-framework={id}
                        data-action="decrement"
                    >
                        −
                    </button>
                    <button
                        className="demo-btn w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-lg font-medium transition-colors flex items-center justify-center"
                        data-framework={id}
                        data-action="increment"
                    >
                        +
                    </button>
                    <button
                        className="demo-btn h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-400 transition-colors"
                        data-framework={id}
                        data-action="reset"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}

function ReactIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="2.5" fill="#61DAFB" />
            <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" strokeWidth="1" fill="none" />
            <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(60 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61DAFB" strokeWidth="1" fill="none" transform="rotate(120 12 12)" />
        </svg>
    )
}

function VueIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 3L12 21L22 3H17.5L12 13L6.5 3H2Z" fill="#42B883" />
            <path d="M6.5 3L12 13L17.5 3H14.5L12 7.5L9.5 3H6.5Z" fill="#35495E" />
        </svg>
    )
}

function SvelteIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.8 4.8C17.9 2 14 1.2 11.2 3L5.8 6.6C4.5 7.5 3.6 8.8 3.3 10.3C3.1 11.5 3.2 12.7 3.7 13.8C3.3 14.3 3 14.9 2.8 15.5C2.3 17.1 2.4 18.8 3.2 20.2C5.1 23 9 23.8 11.8 22L17.2 18.4C18.5 17.5 19.4 16.2 19.7 14.7C19.9 13.5 19.8 12.3 19.3 11.2C19.7 10.7 20 10.1 20.2 9.5C20.7 7.9 20.6 6.2 19.8 4.8Z" fill="#FF3E00" />
            <path d="M9.6 20.2C8.1 20.6 6.4 20.1 5.5 18.8C4.9 17.9 4.7 16.8 4.9 15.8L5.1 15.1L5.4 15.4C6 16 6.8 16.5 7.6 16.8L7.9 16.9L7.9 17.2C7.8 17.6 7.9 18 8.2 18.4C8.6 19 9.4 19.2 10 18.9L15.4 15.3C15.7 15.1 15.9 14.8 16 14.4C16.1 14 16 13.6 15.7 13.3C15.3 12.7 14.5 12.5 13.9 12.8L11.6 14.3C10.3 15.1 8.5 14.8 7.5 13.5C6.9 12.6 6.7 11.5 6.9 10.5C7.1 9.5 7.7 8.6 8.5 8.1L13.9 4.5C14.5 4.1 15.2 3.9 16 3.8C17.5 3.4 19.2 3.9 20.1 5.2C20.7 6.1 20.9 7.2 20.7 8.2L20.5 8.9L20.2 8.6C19.6 8 18.8 7.5 18 7.2L17.7 7.1V6.8C17.8 6.4 17.7 6 17.4 5.6C17 5 16.2 4.8 15.6 5.1L10.2 8.7C9.9 8.9 9.7 9.2 9.6 9.6C9.5 10 9.6 10.4 9.9 10.7C10.3 11.3 11.1 11.5 11.7 11.2L14 9.7C15.3 8.9 17.1 9.2 18.1 10.5C18.7 11.4 18.9 12.5 18.7 13.5C18.5 14.5 17.9 15.4 17.1 15.9L11.7 19.5C11.1 19.9 10.4 20.1 9.6 20.2Z" fill="white" />
        </svg>
    )
}

function SolidIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.5 5.5L8.5 2L21 8L16 11.5L3.5 5.5Z" fill="#76B3E1" />
            <path d="M16 11.5L21 8L21 16L16 19.5L16 11.5Z" fill="#4F88C6" />
            <path d="M3.5 5.5L3.5 13.5L16 19.5L16 11.5L3.5 5.5Z" fill="#2C4F7C" />
            <path d="M3.5 13.5L8.5 10L16 14L16 19.5L3.5 13.5Z" fill="#335D92" opacity="0.7" />
        </svg>
    )
}

function AngularIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 6.5L4.5 18.5L12 22L19.5 18.5L21 6.5L12 2Z" fill="#DD0031" />
            <path d="M12 2L12 22L19.5 18.5L21 6.5L12 2Z" fill="#C3002F" />
            <path d="M12 4.5L6.5 17.5H8.7L9.8 14.5H14.1L15.2 17.5H17.4L12 4.5ZM13.3 12.5H10.6L12 8.5L13.3 12.5Z" fill="white" />
        </svg>
    )
}

// Syntax-highlighted code snippets using CSS classes for light/dark theming
const kw = (s: string) => `<span class="syn-kw">${s}</span>`
const str = (s: string) => `<span class="syn-str">${s}</span>`
const fn = (s: string) => `<span class="syn-fn">${s}</span>`
const name = (s: string) => `<span class="syn-name">${s}</span>`
const comment = (s: string) => `<span class="syn-comment">${s}</span>`
const tag = (s: string) => `<span class="syn-tag">${s}</span>`
const plain = (s: string) => `<span class="syn-plain">${s}</span>`
const num = (s: string) => `<span class="syn-num">${s}</span>`

function highlightShared() {
    return [
        `${comment("// shared.ts — this file is the same for all frameworks")}`,
        `${kw("import")} ${plain("{ atom }")} ${kw("from")} ${str('"valdres"')}`,
        ``,
        `${kw("export const")} ${num("countAtom")} ${plain("=")} ${fn("atom")}${plain("(")}${num("0")}${plain(")")}`,
    ].join("\n")
}

function highlightReact() {
    return [
        `${kw("import")} ${plain("{ useAtom }")} ${kw("from")} ${str('"valdres-react"')}`,
        `${kw("import")} ${plain("{ countAtom }")} ${kw("from")} ${str('"./shared"')}`,
        ``,
        `${kw("export function")} ${fn("Counter")}${plain("() {")}`,
        `  ${kw("const")} ${plain("[count, setCount] =")} ${fn("useAtom")}${plain("(countAtom)")}`,
        ``,
        `  ${kw("return")} ${plain("(")}`,
        `    ${plain("<")}${tag("div")}${plain(">")}`,
        `      ${plain("<")}${tag("span")}${plain(">")}{count}${plain("</")}${tag("span")}${plain(">")}`,
        `      ${plain("<")}${tag("button")} ${name("onClick")}${plain("={() =>")} ${fn("setCount")}${plain("(c => c + 1)}>+</")}${tag("button")}${plain(">")}`,
        `    ${plain("</")}${tag("div")}${plain(">")}`,
        `  ${plain(")")}`,
        `${plain("}")}`,
    ].join("\n")
}

function highlightVue() {
    return [
        `${plain("<")}${tag("script")} ${name("setup")}${plain(">")}`,
        `${kw("import")} ${plain("{ useAtom }")} ${kw("from")} ${str('"valdres-vue"')}`,
        `${kw("import")} ${plain("{ countAtom }")} ${kw("from")} ${str('"./shared"')}`,
        ``,
        `${kw("const")} ${plain("count =")} ${fn("useAtom")}${plain("(countAtom)")}`,
        `${plain("</")}${tag("script")}${plain(">")}`,
        ``,
        `${plain("<")}${tag("template")}${plain(">")}`,
        `  ${plain("<")}${tag("div")}${plain(">")}`,
        `    ${plain("<")}${tag("span")}${plain(">")}{{ count }}${plain("</")}${tag("span")}${plain(">")}`,
        `    ${plain("<")}${tag("button")} ${name("@click")}${plain("=")}${str('"count++"')}${plain(">+</")}${tag("button")}${plain(">")}`,
        `  ${plain("</")}${tag("div")}${plain(">")}`,
        `${plain("</")}${tag("template")}${plain(">")}`,
    ].join("\n")
}

function highlightSvelte() {
    return [
        `${plain("<")}${tag("script")}${plain(">")}`,
        `  ${kw("import")} ${plain("{ fromState }")} ${kw("from")} ${str('"valdres-svelte"')}`,
        `  ${kw("import")} ${plain("{ countAtom }")} ${kw("from")} ${str('"./shared"')}`,
        ``,
        `  ${kw("const")} ${plain("count =")} ${fn("fromState")}${plain("(countAtom)")}`,
        `${plain("</")}${tag("script")}${plain(">")}`,
        ``,
        `${plain("<")}${tag("div")}${plain(">")}`,
        `  ${plain("<")}${tag("span")}${plain(">")}${plain("{count.current}")}${plain("</")}${tag("span")}${plain(">")}`,
        `  ${plain("<")}${tag("button")} ${name("onclick")}${plain("={() => count.current++}>+</")}${tag("button")}${plain(">")}`,
        `${plain("</")}${tag("div")}${plain(">")}`,
    ].join("\n")
}

function highlightSolid() {
    return [
        `${kw("import")} ${plain("{ createAtom }")} ${kw("from")} ${str('"valdres-solid"')}`,
        `${kw("import")} ${plain("{ countAtom }")} ${kw("from")} ${str('"./shared"')}`,
        ``,
        `${kw("export function")} ${fn("Counter")}${plain("() {")}`,
        `  ${kw("const")} ${plain("[count, setCount] =")} ${fn("createAtom")}${plain("(countAtom)")}`,
        ``,
        `  ${kw("return")} ${plain("(")}`,
        `    ${plain("<")}${tag("div")}${plain(">")}`,
        `      ${plain("<")}${tag("span")}${plain(">")}{${fn("count")}()}${plain("</")}${tag("span")}${plain(">")}`,
        `      ${plain("<")}${tag("button")} ${name("onClick")}${plain("={() =>")} ${fn("setCount")}${plain("(c => c + 1)}>+</")}${tag("button")}${plain(">")}`,
        `    ${plain("</")}${tag("div")}${plain(">")}`,
        `  ${plain(")")}`,
        `${plain("}")}`,
    ].join("\n")
}

function highlightAngular() {
    return [
        `${kw("import")} ${plain("{ Component }")} ${kw("from")} ${str('"@angular/core"')}`,
        `${kw("import")} ${plain("{ injectAtom }")} ${kw("from")} ${str('"valdres-angular"')}`,
        `${kw("import")} ${plain("{ countAtom }")} ${kw("from")} ${str('"./shared"')}`,
        ``,
        `${name("@Component")}${plain("({")}`,
        `  ${name("template")}${plain(":")} ${str('`')}`,
        `    ${plain("<")}${tag("span")}${plain(">{{ count() }}</")}${tag("span")}${plain(">")}`,
        `    ${plain("<")}${tag("button")} ${name("(click)")}${plain("=")}${str('"count.update(c => c + 1)"')}${plain(">+</")}${tag("button")}${plain(">")}`,
        `  ${str('`')}`,
        `${plain("})")}`,
        `${kw("export class")} ${fn("Counter")} ${plain("{")}`,
        `  ${plain("count =")} ${fn("injectAtom")}${plain("(countAtom)")}`,
        `${plain("}")}`,
    ].join("\n")
}

