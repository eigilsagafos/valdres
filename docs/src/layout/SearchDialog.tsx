export function SearchDialog() {
    return (
        <div
            id="search-dialog"
            className="hidden fixed inset-0 z-[100]"
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
        >
            <div id="search-backdrop" className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative flex items-start justify-center pt-[15vh] px-4">
                <div className="w-full max-w-lg bg-surface dark:bg-surface-raised-dark rounded-xl shadow-2xl border border-border dark:border-border-dark overflow-hidden">
                    <div className="flex items-center gap-3 px-4 border-b border-border dark:border-border-dark">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-zinc-400 shrink-0"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.3-4.3" />
                        </svg>
                        <input
                            id="search-input"
                            type="text"
                            placeholder="Search documentation..."
                            className="flex-1 py-3 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
                            autoComplete="off"
                        />
                        <kbd className="text-xs text-zinc-400 bg-surface-sunken dark:bg-surface-raised-dark px-1.5 py-0.5 rounded font-mono">
                            Esc
                        </kbd>
                    </div>
                    <div
                        id="search-results"
                        className="max-h-80 overflow-y-auto p-2"
                    >
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">
                            Start typing to search...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
