import type { State } from "valdres"
import type { HotkeyScope } from "./HotkeyScope"

export type HotkeyOptions = Readonly<{
    /**
     * Read when a keydown is dispatched, never a trigger: becoming enabled
     * later never acts on an earlier keydown. Default `true`.
     */
    enabled?: boolean | State<boolean>
    /** Layer of this binding. Default: the always-active base layer (priority 0). */
    scope?: HotkeyScope
    /** Order within the layer; finite. Default 0. Equal eligible ranks are a conflict. */
    priority?: number
    /** Run on auto-repeat keydowns too. Default `false`: repeats are swallowed. */
    repeat?: boolean
    /** Stay eligible while the keydown is aimed at text entry. Default `false`. */
    editable?: boolean
    /** Cancel the native keydown whenever this binding is selected. Default `false`. */
    preventDefault?: boolean
    /**
     * Stay eligible for a keydown that something had already cancelled before
     * the keyboard received it (`KeyDown.defaultPrevented`). Default `false`.
     */
    handleDefaultPrevented?: boolean
}>
