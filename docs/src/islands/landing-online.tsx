import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { onlineAtom } from "@valdres/browser-online"
import { docsStore } from "./shared-store"

function OnlineStatus() {
    const online = useValue(onlineAtom)
    return (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full">
            <div className="relative flex items-center justify-center">
                <div
                    className={`absolute inset-0 rounded-full transition-all duration-500 ${
                        online
                            ? "bg-emerald-500/30 animate-ping"
                            : "bg-rose-500/20"
                    }`}
                />
                <div
                    className={`relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                        online
                            ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                            : "border-rose-500 bg-rose-500/10 text-rose-500"
                    }`}
                >
                    {online ? (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                            <line x1="12" y1="20" x2="12.01" y2="20" />
                        </svg>
                    ) : (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="1" y1="1" x2="23" y2="23" />
                            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                            <line x1="12" y1="20" x2="12.01" y2="20" />
                        </svg>
                    )}
                </div>
            </div>
            <div
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                    online
                        ? "text-emerald-500"
                        : "text-rose-500"
                }`}
            >
                {online ? "Online" : "Offline"}
            </div>
        </div>
    )
}

export function mountOnlineDemo(el: HTMLElement) {
    createRoot(el).render(
        <Provider store={docsStore}>
            <OnlineStatus />
        </Provider>,
    )
}
