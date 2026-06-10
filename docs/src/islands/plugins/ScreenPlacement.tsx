// A scaled diagram of the physical screen arrangement for the
// browser-screen-details demo: each screen drawn as a rectangle positioned by
// its left/top/width/height (like the OS "arrange displays" panel), with the
// current and primary screens highlighted. Reads screensAtom / currentScreenAtom
// live, so it updates when displays are added, removed, or rearranged.
import { useSyncExternalStore } from "react"
import { useStore } from "valdres-react"
import {
    screensAtom,
    currentScreenAtom,
    type ScreenDetail,
} from "@valdres/browser-screen-details"

function useAtom<T>(state: unknown): T {
    const store = useStore()
    return useSyncExternalStore(
        cb => store.sub(state as any, cb),
        () => store.get(state as any) as T,
        () => store.get(state as any) as T,
    )
}

export function ScreenPlacement() {
    const screens = useAtom<ScreenDetail[]>(screensAtom)
    const current = useAtom<ScreenDetail | null>(currentScreenAtom)

    if (!screens || screens.length === 0) return null

    const minLeft = Math.min(...screens.map(s => s.left))
    const minTop = Math.min(...screens.map(s => s.top))
    const maxRight = Math.max(...screens.map(s => s.left + s.width))
    const maxBottom = Math.max(...screens.map(s => s.top + s.height))
    const totalW = maxRight - minLeft || 1
    const totalH = maxBottom - minTop || 1

    const isCurrent = (s: ScreenDetail) =>
        current != null && s.left === current.left && s.top === current.top

    return (
        <div className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                placement
            </div>
            <div
                className="relative w-full mx-auto rounded-lg border border-border dark:border-border-dark bg-surface-sunken dark:bg-surface-raised-dark"
                style={{
                    aspectRatio: `${totalW} / ${totalH}`,
                    // Bound height to ~14rem via max-WIDTH (= height × ratio) so
                    // the aspect ratio is preserved at any size — a max-height
                    // would clamp height while width stayed full, distorting it.
                    maxWidth: `${(14 * totalW) / totalH}rem`,
                }}
            >
                {screens.map((s, i) => (
                    <div
                        key={i}
                        data-screen-box
                        title={`${s.label || `Screen ${i + 1}`} — ${s.width}×${s.height} at (${s.left}, ${s.top})`}
                        className={`absolute flex flex-col items-center justify-center gap-0.5 rounded-[3px] border text-center overflow-hidden ${
                            isCurrent(s)
                                ? "border-accent-500 bg-accent-500/15 text-accent-600 dark:text-accent-400"
                                : "border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400"
                        }`}
                        style={{
                            left: `${((s.left - minLeft) / totalW) * 100}%`,
                            top: `${((s.top - minTop) / totalH) * 100}%`,
                            width: `${(s.width / totalW) * 100}%`,
                            height: `${(s.height / totalH) * 100}%`,
                        }}
                    >
                        <span className="text-[10px] font-medium truncate max-w-full px-1">
                            {s.label || `Screen ${i + 1}`}
                            {s.isPrimary ? " ★" : ""}
                        </span>
                        <span className="text-[9px] font-mono opacity-80">
                            {s.width}×{s.height}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
