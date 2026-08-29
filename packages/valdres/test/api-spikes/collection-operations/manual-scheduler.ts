export interface ScheduledTask {
    readonly id: number
    readonly label: string
}

interface PendingTask extends ScheduledTask {
    readonly run: () => void
}

/**
 * A deliberately tiny, deterministic scheduler. Materialization never owns a
 * timer or microtask in this spike; tests decide exactly when each unit runs.
 */
export class ManualScheduler {
    private readonly queue: PendingTask[] = []
    private nextId = 1

    schedule(label: string, run: () => void): ScheduledTask {
        const task: PendingTask = Object.freeze({
            id: this.nextId++,
            label,
            run,
        })
        this.queue.push(task)
        return task
    }

    pending(): readonly ScheduledTask[] {
        return Object.freeze(
            this.queue.map(({ id, label }) => Object.freeze({ id, label })),
        )
    }

    runNext(): ScheduledTask | undefined {
        const task = this.queue.shift()
        if (task === undefined) return undefined
        task.run()
        return Object.freeze({ id: task.id, label: task.label })
    }

    runAll(limit = 10_000): readonly ScheduledTask[] {
        const ran: ScheduledTask[] = []
        while (this.queue.length > 0) {
            if (ran.length >= limit) {
                throw new Error(`ManualScheduler exceeded ${limit} tasks`)
            }
            const task = this.runNext()
            if (task !== undefined) ran.push(task)
        }
        return Object.freeze(ran)
    }
}
