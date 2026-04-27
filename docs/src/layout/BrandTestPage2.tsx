// Wild / conceptual logos inspired by:
// - Valdres: a mountain valley in Norway
// - "val-dress": dressing a value (wrapping/adorning data)
// - State management: atoms, reactivity, flow

const colors = {
    teal: "oklch(0.62 0.16 185)",
    tealLight: "oklch(0.75 0.12 185)",
    tealDark: "oklch(0.45 0.14 185)",
    tealFaint: "oklch(0.97 0.02 185)",
}

function MountainV({ color }: { color: string }) {
    // Mountain peaks forming a V — the valley between two peaks IS the V
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M6 36L16 16L24 28L32 16L42 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M6 36L16 16L24 28L32 16L42 36Z" fill="white" opacity="0.15" />
        </svg>
    )
}

function MountainSilhouette({ color }: { color: string }) {
    // Layered mountain silhouettes — the gap between layers forms a V
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M4 38L14 18L24 30L34 18L44 38Z" fill="white" opacity="0.2" />
            <path d="M8 38L18 22L24 30L30 22L40 38Z" fill="white" opacity="0.35" />
            <path d="M12 38L20 26L24 32L28 26L36 38Z" fill="white" opacity="0.55" />
        </svg>
    )
}

function NordicRune({ color }: { color: string }) {
    // Nordic/Viking-inspired angular V rune
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M14 12L24 36L34 12" stroke="white" strokeWidth="3" strokeLinecap="square" />
            <path d="M14 12L14 8" stroke="white" strokeWidth="3" strokeLinecap="square" />
            <path d="M34 12L34 8" stroke="white" strokeWidth="3" strokeLinecap="square" />
            <path d="M24 36L24 40" stroke="white" strokeWidth="3" strokeLinecap="square" />
        </svg>
    )
}

function ValleyTopographic({ color }: { color: string }) {
    // Topographic contour lines showing a valley (V shape in contour form)
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M10 14C14 14 18 22 24 30C30 22 34 14 38 14" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />
            <path d="M12 18C16 18 19 24 24 30C29 24 32 18 36 18" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5" />
            <path d="M14 22C18 22 20 26 24 30C28 26 30 22 34 22" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
            <path d="M16 26C20 26 21 28 24 30C27 28 28 26 32 26" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9" />
        </svg>
    )
}

function DressedValue({ color }: { color: string }) {
    // Angle brackets < > "dressing" a V — val-dress concept
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M16 14L24 32L32 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 18L6 24L10 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
            <path d="M38 18L42 24L38 30" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        </svg>
    )
}

function WrappedAtom({ color }: { color: string }) {
    // V with orbital rings — "dressing" an atom
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <ellipse cx="24" cy="24" rx="16" ry="8" stroke="white" strokeWidth="1.5" opacity="0.25" transform="rotate(-30 24 24)" />
            <ellipse cx="24" cy="24" rx="16" ry="8" stroke="white" strokeWidth="1.5" opacity="0.25" transform="rotate(30 24 24)" />
            <path d="M16 14L24 32L32 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function AuroraV({ color }: { color: string }) {
    // Northern lights / aurora borealis streaming into a V — very Norwegian
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill="#0a1a1a" />
            <path d="M14 8L14 14L24 34" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <path d="M34 8L34 14L24 34" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            <path d="M19 6L20 18L24 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            <path d="M29 6L28 18L24 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
            <circle cx="24" cy="34" r="2" fill={color} opacity="0.8" />
        </svg>
    )
}

function FjordV({ color }: { color: string }) {
    // Water/fjord cutting through land — the water forms the V
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M4 10L24 38L44 10" fill="white" opacity="0.15" />
            <path d="M8 10L24 34L40 10" fill="white" opacity="0.25" />
            <path d="M12 10L24 30L36 10" fill="white" opacity="0.4" />
            {/* ripple lines */}
            <path d="M18 20Q21 18 24 20Q27 22 30 20" stroke="white" strokeWidth="1" opacity="0.3" fill="none" />
            <path d="M20 24Q22 22 24 24Q26 26 28 24" stroke="white" strokeWidth="1" opacity="0.25" fill="none" />
        </svg>
    )
}

function ReactiveFlow({ color }: { color: string }) {
    // Data flowing down into a V funnel — reactive state flow
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <circle cx="14" cy="10" r="2.5" fill="white" opacity="0.4" />
            <circle cx="24" cy="8" r="2.5" fill="white" opacity="0.4" />
            <circle cx="34" cy="10" r="2.5" fill="white" opacity="0.4" />
            <path d="M14 12L24 32" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="2 3" />
            <path d="M24 10L24 32" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="2 3" />
            <path d="M34 12L24 32" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" strokeDasharray="2 3" />
            <path d="M13 16L24 34L35 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="38" r="2.5" fill="white" opacity="0.7" />
        </svg>
    )
}

function StaveChurch({ color }: { color: string }) {
    // Norwegian stave church roofline — angular V shapes stacked
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M24 8L18 16L24 12L30 16Z" fill="white" opacity="0.4" />
            <path d="M24 12L14 24L24 18L34 24Z" fill="white" opacity="0.5" />
            <path d="M24 18L10 34L24 26L38 34Z" fill="white" opacity="0.65" />
            <line x1="24" y1="8" x2="24" y2="40" stroke="white" strokeWidth="1.5" opacity="0.3" />
        </svg>
    )
}

function Glacier({ color }: { color: string }) {
    // Abstract glacier/ice crystal V
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <polygon points="24,34 12,14 18,14 24,26 30,14 36,14" fill="white" opacity="0.8" />
            <polygon points="24,34 15,18 19,18 24,28" fill="white" opacity="0.4" />
            <polygon points="24,34 29,18 33,18" fill="white" opacity="0.25" />
        </svg>
    )
}

function MinimalMountain({ color }: { color: string }) {
    // Single stroke mountain with snow cap — extremely minimal
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M8 36L24 12L40 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 18L24 12L28 18" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        </svg>
    )
}

const logos = [
    { name: "Mountain Valley", component: MountainV, desc: "Two peaks with the V as the valley between them" },
    { name: "Mountain Silhouette", component: MountainSilhouette, desc: "Layered mountain silhouettes, deepening perspective" },
    { name: "Minimal Mountain", component: MinimalMountain, desc: "Single peak with snow cap highlight" },
    { name: "Nordic Rune", component: NordicRune, desc: "Viking-era angular rune letterform" },
    { name: "Valley Topographic", component: ValleyTopographic, desc: "Contour map lines showing a valley" },
    { name: "Val-Dress", component: DressedValue, desc: "Angle brackets dressing/wrapping the V" },
    { name: "Wrapped Atom", component: WrappedAtom, desc: "Orbital rings dressing an atom-V" },
    { name: "Aurora", component: AuroraV, desc: "Northern lights streaming into a V — dark bg" },
    { name: "Fjord", component: FjordV, desc: "Water cutting through land, V as fjord" },
    { name: "Reactive Flow", component: ReactiveFlow, desc: "Data atoms flowing into a V funnel" },
    { name: "Stave Church", component: StaveChurch, desc: "Stacked angular rooflines (Norwegian stave church)" },
    { name: "Glacier", component: Glacier, desc: "Faceted ice crystal forming V" },
]

export function BrandTestPage2() {
    return (
        <html lang="en" className="dark">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Valdres — Wild Brand Concepts</title>
                <link rel="stylesheet" href="/styles.css" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
            </head>
            <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold tracking-tight">Wild Concepts</h1>
                        <div className="flex gap-3">
                            <a href="/brand-test" className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                                ← Original test
                            </a>
                            <button
                                id="theme-toggle"
                                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                                aria-label="Toggle theme"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:hidden"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden dark:block"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                            </button>
                        </div>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-12 max-w-2xl">
                        Valdres is a mountain valley in Norway. It's also a wordplay on "val-dress" — dressing a value.
                        These concepts explore mountains, fjords, aurora, runes, topography, and the idea of wrapping/adorning data.
                    </p>

                    {/* Big grid */}
                    <section className="mb-16">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {logos.map((logo, i) => {
                                const LogoComponent = logo.component
                                return (
                                    <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                        <div className="flex items-center justify-center py-10 bg-zinc-50 dark:bg-zinc-900/30">
                                            <div className="transform scale-[2]">
                                                <LogoComponent color={colors.teal} />
                                            </div>
                                        </div>
                                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-baseline justify-between mb-1">
                                                <h3 className="text-sm font-semibold">{i + 1}. {logo.name}</h3>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{logo.desc}</p>
                                        </div>
                                        {/* Size variants */}
                                        <div className="flex items-center gap-3 px-4 pb-4">
                                            <div className="transform scale-100"><LogoComponent color={colors.teal} /></div>
                                            <div style={{ width: 32, height: 32 }}>
                                                <svg viewBox="0 0 48 48" width="32" height="32">
                                                    <LogoComponent color={colors.teal} />
                                                </svg>
                                            </div>
                                            <div style={{ width: 20, height: 20 }}>
                                                <svg viewBox="0 0 48 48" width="20" height="20">
                                                    <LogoComponent color={colors.teal} />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* Sidebar context */}
                    <section className="mb-16">
                        <h2 className="text-xl font-semibold mb-6">In-Context Sidebar</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {logos.map((logo, i) => {
                                const LogoComponent = logo.component
                                return (
                                    <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                        <div className="p-5 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2.5">
                                                <svg viewBox="0 0 48 48" width="28" height="28">
                                                    <LogoComponent color={colors.teal} />
                                                </svg>
                                                <div>
                                                    <div className="text-lg font-semibold tracking-tight">Valdres</div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">Reactive state management</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-zinc-950">
                                            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1.5">Getting Started</div>
                                            <div className="px-3 py-1.5 rounded-md text-sm font-medium border-l-2 -ml-px" style={{ backgroundColor: colors.tealFaint, borderColor: colors.teal, color: colors.teal }}>Introduction</div>
                                            <div className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">Motivation</div>
                                            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1.5 mt-3">valdres-react</div>
                                            <div className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono text-[0.8125rem]">useAtom</div>
                                        </div>
                                        <div className="px-3 pb-2 text-center">
                                            <span className="text-[0.6rem] text-zinc-400 dark:text-zinc-500">{logo.name}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* Hero previews */}
                    <section>
                        <h2 className="text-xl font-semibold mb-6">Hero Preview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {logos.slice(0, 4).map((logo, i) => {
                                const LogoComponent = logo.component
                                return (
                                    <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
                                        <div className="flex justify-center mb-5">
                                            <div className="transform scale-150">
                                                <LogoComponent color={colors.teal} />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-bold tracking-tight mb-2">
                                            Valdres
                                        </h3>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                                            Reactive state that scales
                                        </p>
                                        <button className="px-5 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: colors.teal }}>
                                            Get Started
                                        </button>
                                        <span className="text-[0.6rem] block mt-3 text-zinc-400">{logo.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                </div>

                <script dangerouslySetInnerHTML={{ __html: `
                    (function() {
                        const theme = localStorage.getItem('theme');
                        if (theme === 'light') document.documentElement.classList.remove('dark');
                        else if (theme === 'dark' || !theme) document.documentElement.classList.add('dark');
                    })();
                    document.getElementById('theme-toggle')?.addEventListener('click', () => {
                        const isDark = document.documentElement.classList.toggle('dark');
                        localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    });
                ` }} />
            </body>
        </html>
    )
}
