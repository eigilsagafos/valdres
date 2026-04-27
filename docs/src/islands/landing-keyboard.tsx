import { useEffect, useRef } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { pressedCodesSelector, toggleKeyAtom } from "@valdres/browser-keyboard"
import type { KeyboardCode } from "@valdres/browser-keyboard"
import { docsStore } from "./shared-store"

type KeyDef = { code: KeyboardCode; label: string; sub?: string; flex?: number }

const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)

const letterRow = (letters: string): KeyDef[] =>
    letters.split("").map(l => ({ code: `Key${l}` as KeyboardCode, label: l }))

const numberRow: KeyDef[] = [
    { code: "Backquote", label: "`" },
    { code: "Digit1", label: "1" },
    { code: "Digit2", label: "2" },
    { code: "Digit3", label: "3" },
    { code: "Digit4", label: "4" },
    { code: "Digit5", label: "5" },
    { code: "Digit6", label: "6" },
    { code: "Digit7", label: "7" },
    { code: "Digit8", label: "8" },
    { code: "Digit9", label: "9" },
    { code: "Digit0", label: "0" },
    { code: "Minus", label: "-" },
    { code: "Equal", label: "=" },
    { code: "Backspace", label: "⌫", flex: 1.5 },
]

const tabRow: KeyDef[] = [
    { code: "Tab", label: "⇥", flex: 1.5 },
    ...letterRow("QWERTYUIOP"),
    { code: "BracketLeft", label: "[" },
    { code: "BracketRight", label: "]" },
    { code: "Backslash", label: "\\" },
]

const capsRow: KeyDef[] = [
    { code: "CapsLock", label: "⇪", flex: 1.75 },
    ...letterRow("ASDFGHJKL"),
    { code: "Semicolon", label: ";" },
    { code: "Quote", label: "'" },
    { code: "Enter", label: "↵", flex: 1.75 },
]

const shiftRow: KeyDef[] = [
    { code: "ShiftLeft", label: "⇧", flex: 2.25 },
    ...letterRow("ZXCVBNM"),
    { code: "Comma", label: "," },
    { code: "Period", label: "." },
    { code: "Slash", label: "/" },
    { code: "ShiftRight", label: "⇧", flex: 2.25 },
]

const macBottomRow: KeyDef[] = [
    { code: "ControlLeft", label: "⌃", flex: 1.25 },
    { code: "AltLeft", label: "⌥", flex: 1.25 },
    { code: "MetaLeft", label: "⌘", flex: 1.5 },
    { code: "Space", label: "", flex: 7.75 },
    { code: "MetaRight", label: "⌘", flex: 1.5 },
    { code: "AltRight", label: "⌥", flex: 1.25 },
]

const winBottomRow: KeyDef[] = [
    { code: "ControlLeft", label: "ctrl", flex: 1.5 },
    { code: "MetaLeft", label: "win", flex: 1.25 },
    { code: "AltLeft", label: "alt", flex: 1.25 },
    { code: "Space", label: "", flex: 6.5 },
    { code: "AltRight", label: "alt", flex: 1.25 },
    { code: "MetaRight", label: "win", flex: 1.25 },
    { code: "ControlRight", label: "ctrl", flex: 1.5 },
]

const rows: KeyDef[][] = [
    numberRow,
    tabRow,
    capsRow,
    shiftRow,
    isMac ? macBottomRow : winBottomRow,
]

function Key({
    def,
    pressed,
    indicator,
}: {
    def: KeyDef
    pressed: boolean
    indicator?: boolean
}) {
    const base =
        "relative h-full flex items-center justify-center rounded-[3px] text-[9px] font-sans font-medium tracking-tight border transition-all duration-75 select-none"
    const idle =
        "border-zinc-600/60 dark:border-zinc-400/50 bg-zinc-600 dark:bg-zinc-300 text-zinc-200 dark:text-zinc-700"
    const active =
        "border-accent-500 bg-accent-500 text-white shadow-[0_0_6px_rgba(251,191,36,0.55)]"
    const style = { flexGrow: def.flex ?? 1, flexBasis: 0, minWidth: 0 }
    return (
        <div className={`${base} ${pressed ? active : idle}`} style={style}>
            {def.label}
            {indicator && (
                <span
                    className="absolute left-1 top-1 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.9)]"
                    aria-label="caps lock on"
                />
            )}
        </div>
    )
}

function Keyboard() {
    const pressed = useValue(pressedCodesSelector)
    const capsLock = useValue(toggleKeyAtom("CapsLock"))
    const pressedSet = new Set(pressed)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        let visible = false
        const io = new IntersectionObserver(
            entries => {
                for (const entry of entries) visible = entry.isIntersecting
            },
            { threshold: 0 },
        )
        io.observe(el)
        const onKey = (e: KeyboardEvent) => {
            if (!visible) return
            if (e.code !== "Space") return
            const target = e.target as HTMLElement | null
            if (!target) return
            const tag = target.tagName
            if (tag === "INPUT" || tag === "TEXTAREA") return
            if (target.isContentEditable) return
            e.preventDefault()
        }
        document.addEventListener("keydown", onKey)
        return () => {
            io.disconnect()
            document.removeEventListener("keydown", onKey)
        }
    }, [])

    return (
        <div
            ref={containerRef}
            className="flex flex-col gap-0.5 w-full"
            style={{ aspectRatio: "14.5 / 5.25" }}
        >
            {rows.map((row, i) => (
                <div key={i} className="flex gap-0.5 flex-1 min-h-0">
                    {row.map(def => (
                        <Key
                            key={def.code}
                            def={def}
                            pressed={pressedSet.has(def.code)}
                            indicator={def.code === "CapsLock" && capsLock === true}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

export function mountKeyboardDemo(el: HTMLElement) {
    createRoot(el).render(
        <Provider store={docsStore}>
            <Keyboard />
        </Provider>,
    )
}
