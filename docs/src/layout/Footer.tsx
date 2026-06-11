export function Footer() {
    return (
        <footer className="border-t border-border dark:border-border-dark mt-16">
            <div className="max-w-3xl mx-auto w-full px-6 py-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-400 dark:text-zinc-500">
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
            </div>
        </footer>
    )
}
