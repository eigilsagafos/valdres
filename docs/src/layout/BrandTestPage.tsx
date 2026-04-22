const colors = [
    { name: "Indigo", value: "oklch(0.59 0.2 265)", bg50: "oklch(0.97 0.02 265)", bg900: "oklch(0.31 0.1 265)" },
    { name: "Violet", value: "oklch(0.59 0.22 295)", bg50: "oklch(0.97 0.02 295)", bg900: "oklch(0.31 0.12 295)" },
    { name: "Blue", value: "oklch(0.59 0.18 245)", bg50: "oklch(0.97 0.02 245)", bg900: "oklch(0.31 0.1 245)" },
    { name: "Teal", value: "oklch(0.62 0.16 185)", bg50: "oklch(0.97 0.02 185)", bg900: "oklch(0.31 0.08 185)" },
    { name: "Emerald", value: "oklch(0.6 0.18 155)", bg50: "oklch(0.97 0.02 155)", bg900: "oklch(0.31 0.1 155)" },
    { name: "Amber", value: "oklch(0.7 0.18 80)", bg50: "oklch(0.97 0.03 80)", bg900: "oklch(0.35 0.1 80)" },
    { name: "Rose", value: "oklch(0.6 0.2 15)", bg50: "oklch(0.97 0.02 15)", bg900: "oklch(0.31 0.1 15)" },
    { name: "Cyan", value: "oklch(0.65 0.14 210)", bg50: "oklch(0.97 0.02 210)", bg900: "oklch(0.31 0.08 210)" },
]

function Logo1({ color }: { color: string }) {
    // Bold V lettermark in rounded square
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M14 14L24 36L34 14" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function Logo2({ color }: { color: string }) {
    // Minimal V with dot accent
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M15 15L24 33L33 15" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24" cy="38" r="2.5" fill="white" opacity="0.7" />
        </svg>
    )
}

function Logo3({ color }: { color: string }) {
    // Abstract V formed by two converging lines with gradient effect
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M13 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
            <path d="M35 13L24 35" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
        </svg>
    )
}

function Logo4({ color }: { color: string }) {
    // V inside a circle (coin style)
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <circle cx="24" cy="24" r="15" stroke="white" strokeWidth="2" opacity="0.3" />
            <path d="M16 16L24 34L32 16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function Logo5({ color }: { color: string }) {
    // Stacked chevrons forming V shape
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M14 16L24 28L34 16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M17 23L24 32L31 23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        </svg>
    )
}

function Logo6({ color }: { color: string }) {
    // Geometric V with sharp angles, pill shape
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="24" fill={color} />
            <path d="M15 16L24 34L33 16" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function Logo7({ color }: { color: string }) {
    // Atom/orbital style V
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M14 14L24 34L34 14" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="14" cy="14" r="3" fill="white" opacity="0.5" />
            <circle cx="34" cy="14" r="3" fill="white" opacity="0.5" />
            <circle cx="24" cy="34" r="3" fill="white" opacity="0.7" />
        </svg>
    )
}

function Logo8({ color }: { color: string }) {
    // Thick blocky V, brutalist
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="10" fill={color} />
            <polygon points="12,12 20,12 24,30 28,12 36,12 26,38 22,38" fill="white" />
        </svg>
    )
}

function Logo9({ color }: { color: string }) {
    // Outline V on dark bg with accent border
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1.5" y="1.5" width="45" height="45" rx="10.5" fill="#0a0a0a" stroke={color} strokeWidth="3" />
            <path d="M15 15L24 34L33 15" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function Logo10({ color }: { color: string }) {
    // V with horizontal line — like a price/value symbol
    return (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" rx="12" fill={color} />
            <path d="M14 14L24 32L34 14" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="17" y1="21" x2="31" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
    )
}

const logos = [
    { name: "Bold Lettermark", component: Logo1, desc: "Clean V in rounded square" },
    { name: "Dot Accent", component: Logo2, desc: "Minimal V with dot below" },
    { name: "Converging Lines", component: Logo3, desc: "Two-opacity layered strokes" },
    { name: "Coin", component: Logo4, desc: "V inside a subtle ring" },
    { name: "Chevrons", component: Logo5, desc: "Stacked chevron layers" },
    { name: "Pill", component: Logo6, desc: "V inside a circle/pill" },
    { name: "Orbital", component: Logo7, desc: "V with node dots at vertices" },
    { name: "Brutalist", component: Logo8, desc: "Thick blocky filled V" },
    { name: "Outline", component: Logo9, desc: "Colored outline on dark" },
    { name: "Crossbar", component: Logo10, desc: "V with horizontal crossbar" },
]

export function BrandTestPage() {
    return (
        <html lang="en" className="dark">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Valdres — Brand Test</title>
                <link rel="stylesheet" href="/styles.css" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
                <div className="max-w-6xl mx-auto px-6 py-12">
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Brand Test</h1>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                                10 logo variants × 8 color palettes. Click the theme toggle to compare light/dark.
                            </p>
                        </div>
                        <button
                            id="theme-toggle"
                            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                            aria-label="Toggle theme"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="dark:hidden">
                                <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hidden dark:block">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                            </svg>
                        </button>
                    </div>

                    {/* Logo grid */}
                    <section className="mb-16">
                        <h2 className="text-xl font-semibold mb-6">Logos × Colors</h2>
                        <div className="space-y-10">
                            {logos.map((logo, i) => {
                                const LogoComponent = logo.component
                                return (
                                    <div key={i}>
                                        <div className="flex items-baseline gap-3 mb-3">
                                            <h3 className="text-sm font-semibold">
                                                {i + 1}. {logo.name}
                                            </h3>
                                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                                                {logo.desc}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-4">
                                            {colors.map((color, ci) => (
                                                <div key={ci} className="flex flex-col items-center gap-2">
                                                    <div className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                                        <LogoComponent color={color.value} />
                                                    </div>
                                                    <span className="text-[0.625rem] text-zinc-400 dark:text-zinc-500 font-medium">
                                                        {color.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* In-context preview */}
                    <section className="mb-16">
                        <h2 className="text-xl font-semibold mb-6">In Context — Sidebar Preview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {logos.slice(0, 6).map((logo, i) => {
                                const LogoComponent = logo.component
                                const color = colors[0] // indigo
                                return (
                                    <div
                                        key={i}
                                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                                    >
                                        <div className="p-5 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2.5">
                                                <LogoComponent color={color.value} />
                                                <div>
                                                    <div className="text-lg font-semibold tracking-tight">
                                                        Valdres
                                                    </div>
                                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        Reactive state management
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white dark:bg-zinc-950">
                                            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1.5">
                                                Getting Started
                                            </div>
                                            <div
                                                className="px-3 py-1.5 rounded-md text-sm font-medium border-l-2 -ml-px"
                                                style={{
                                                    backgroundColor: color.bg50,
                                                    borderColor: color.value,
                                                    color: color.value,
                                                }}
                                            >
                                                Introduction
                                            </div>
                                            <div className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                                Motivation
                                            </div>
                                            <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-3 mb-1.5 mt-3">
                                                valdres-react
                                            </div>
                                            <div className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono text-[0.8125rem]">
                                                useAtom
                                            </div>
                                            <div className="px-3 py-1.5 text-sm text-zinc-500 dark:text-zinc-400 font-mono text-[0.8125rem]">
                                                useValue
                                            </div>
                                        </div>
                                        <div className="px-3 pb-2 text-center">
                                            <span className="text-[0.6rem] text-zinc-400 dark:text-zinc-500">
                                                {logo.name}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* Color palette detail */}
                    <section className="mb-16">
                        <h2 className="text-xl font-semibold mb-6">Color Palettes</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {colors.map((color, i) => (
                                <div
                                    key={i}
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                                >
                                    <div
                                        className="h-20 flex items-end p-3"
                                        style={{ backgroundColor: color.value }}
                                    >
                                        <span className="text-white font-semibold text-sm">
                                            {color.name}
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex gap-1.5">
                                            {[0.97, 0.87, 0.68, 0.59, 0.45, 0.31].map(
                                                (l, si) => (
                                                    <div
                                                        key={si}
                                                        className="h-6 flex-1 rounded"
                                                        style={{
                                                            backgroundColor: color.value.replace(
                                                                /oklch\([^ ]+/,
                                                                `oklch(${l}`,
                                                            ),
                                                        }}
                                                    />
                                                ),
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <a
                                                href="#"
                                                className="text-sm font-medium block"
                                                style={{ color: color.value }}
                                            >
                                                Sample link text
                                            </a>
                                            <button
                                                className="px-4 py-1.5 rounded-lg text-white text-sm font-medium"
                                                style={{ backgroundColor: color.value }}
                                            >
                                                Get Started
                                            </button>
                                            <div
                                                className="text-xs px-3 py-2 rounded-lg border-l-3"
                                                style={{
                                                    backgroundColor: color.bg50,
                                                    borderLeftColor: color.value,
                                                    borderLeftWidth: "3px",
                                                }}
                                            >
                                                Callout text in {color.name.toLowerCase()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Hero preview with different colors */}
                    <section>
                        <h2 className="text-xl font-semibold mb-6">Hero Accent Preview</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {colors.slice(0, 4).map((color, i) => (
                                <div
                                    key={i}
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center"
                                >
                                    <div
                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium mb-4"
                                        style={{
                                            borderColor: color.value,
                                            color: color.value,
                                            backgroundColor: color.bg50,
                                        }}
                                    >
                                        <span
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: color.value }}
                                        />
                                        Open source state management
                                    </div>
                                    <h3 className="text-2xl font-bold tracking-tight mb-3">
                                        Reactive state{" "}
                                        <span style={{ color: color.value }}>that scales</span>
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
                                        Fast, lightweight state management for JS and React.
                                    </p>
                                    <button
                                        className="px-5 py-2 rounded-lg text-white text-sm font-medium"
                                        style={{ backgroundColor: color.value }}
                                    >
                                        Get Started
                                    </button>
                                    <span className="text-[0.6rem] block mt-3 text-zinc-400">
                                        {color.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
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
                                }
                            })();
                            document.getElementById('theme-toggle')?.addEventListener('click', () => {
                                const isDark = document.documentElement.classList.toggle('dark');
                                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                            });
                        `,
                    }}
                />
            </body>
        </html>
    )
}
