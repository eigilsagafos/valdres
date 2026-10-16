// Classic script that runs BEFORE the probe module is imported. It records
// every listener the packages attach (by target kind and type), every
// `matchMedia` resolution query they create, and — through its own observers,
// installed before the recording starts so they are never counted — the order
// in which the engine fires the native events.
;(() => {
    // Per physical target: one store tree reuses a single listener function
    // across the successive resolution queries it watches.
    const targets = new Map() // target -> Map<type, Set<listener>>
    const queries = []
    const natives = []
    const t0 = performance.now()
    const note = (kind, type, detail) =>
        natives.push({
            at: Math.round(performance.now() - t0),
            event: `${kind}:${type}`,
            ...detail,
        })

    const kindOf = target =>
        target === window
            ? "window"
            : target === window.screen
              ? "screen"
              : target === window.screen.orientation
                ? "orientation"
                : target instanceof MediaQueryList
                  ? "resolution"
                  : "other"

    addEventListener("resize", () =>
        note("window", "resize", {
            inner: [innerWidth, innerHeight],
            outer: [outerWidth, outerHeight],
        }),
    )
    screen.orientation?.addEventListener("change", () =>
        note("orientation", "change", {
            type: screen.orientation.type,
            angle: screen.orientation.angle,
        }),
    )
    if (typeof screen.addEventListener === "function")
        screen.addEventListener("change", () =>
            note("screen", "change", { width: screen.width }),
        )

    const add = EventTarget.prototype.addEventListener
    const remove = EventTarget.prototype.removeEventListener
    const nativeMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = query => {
        const list = nativeMatchMedia(query)
        if (/resolution/.test(query)) {
            queries.push(query)
            add.call(list, "change", () =>
                note("resolution", "change", {
                    query,
                    matches: list.matches,
                    ratio: devicePixelRatio,
                }),
            )
        }
        return list
    }

    // Only the packages' listeners count: the page's own (an error reporter)
    // are added through `__geometry.untracked`.
    EventTarget.prototype.addEventListener = function (
        type,
        listener,
        ...rest
    ) {
        if (!targets.has(this)) targets.set(this, new Map())
        const types = targets.get(this)
        if (!types.has(type)) types.set(type, new Set())
        types.get(type).add(listener)
        return add.call(this, type, listener, ...rest)
    }
    EventTarget.prototype.removeEventListener = function (
        type,
        listener,
        ...rest
    ) {
        targets.get(this)?.get(type)?.delete(listener)
        return remove.call(this, type, listener, ...rest)
    }

    window.__geometry = {
        untracked: (target, type, listener) => add.call(target, type, listener),
        attached: () => {
            const counts = {}
            for (const [target, types] of targets)
                for (const [type, set] of types) {
                    const key = `${kindOf(target)}:${type}`
                    if (set.size > 0 && !key.startsWith("other:"))
                        counts[key] = (counts[key] ?? 0) + set.size
                }
            return Object.fromEntries(Object.entries(counts).sort())
        },
        queries: () => [...queries],
        natives: () => natives.splice(0),
        environment: () => ({
            userAgent: navigator.userAgent,
            screenIsEventTarget: typeof screen.addEventListener === "function",
            hasScreenOrientation:
                typeof screen.orientation?.addEventListener === "function",
        }),
    }
})()
