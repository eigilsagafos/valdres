let waiting = false
let queue = []

export const trace = (event: string, state: Selector<any>) => {
    return
    if (!waiting) {
        waiting = true
        setTimeout(() => {
            waiting = false
            console.log("Valdres Stats", queue.length, new Set(queue).size)
            console.log("Valdres Stats", queue)
            queue = []
        }, 0)
        // Promise.resolve().then(() => {
        //     waiting = false
        //     console.log("Valdres Stats", queue.length)
        //     queue = []
        // })
    }
    queue.push([performance.now(), event, state])
}
