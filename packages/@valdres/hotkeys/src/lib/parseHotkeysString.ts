const conversions: { [key: string]: string } = {
    command: "meta",
    cmd: "meta",
    ctrl: "control",
    left: "arrowleft",
    right: "arrowright",
    up: "arrowup",
    down: "arrowdown",
}

const convert = (key: string) => {
    if (key in conversions) return conversions[key]
    return key
}

export const parseHotkeysString = (string: string) => {
    const items = string.split(/,\s?/)
    return items.map(item => {
        return item
            .split(/\+(.[^+]*)/)
            .filter(k => k)
            .map(s => s.toLowerCase())
            .map(convert)
    })
}
