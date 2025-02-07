import type { Options } from "../../types/Options"

const FORM_TAGS = ["INPUT", "TEXTAREA", "SELECT"]

const isTargetAllowed = (target: HTMLElement, options: Options) => {
    const { enableOnContentEditable, enableOnFormTags } = options
    if (enableOnContentEditable && enableOnFormTags) return true
    const { isContentEditable, nodeName } = target
    if (!enableOnContentEditable && isContentEditable) return false
    if (!enableOnFormTags && FORM_TAGS.includes(nodeName)) return false
    return true
}

export const callbackHandler = (
    event: KeyboardEvent,
    callback: (event: KeyboardEvent) => void,
    options: Options,
) => {
    {
        const { target, type, repeat } = event
        if (repeat && !options.repeat) return
        if (target && !isTargetAllowed(target as HTMLElement, options)) return
        if (options.preventDefault) event?.preventDefault()
        if (type === "keydown" && options.keydown) callback(event)
        if (type === "keyup" && options.keyup) callback(event)
    }
}
