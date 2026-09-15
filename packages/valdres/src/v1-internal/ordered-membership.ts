/** Optional membership storage for materialized indexes. Arrays are made only
 * when a collection reader asks for them; writes touch changed links only. */
export class OrderedMembership {
    readonly entries = new Map<
        object,
        {
            rank: number
            previous?: object | undefined
            next?: object | undefined
        }
    >()
    tail: object | undefined
    nextRank = 0

    constructor(rows: readonly object[]) {
        for (const row of rows) this.append(row)
    }

    append(row: object): void {
        const previous = this.tail
        this.entries.set(row, { rank: this.nextRank++, previous })
        if (previous !== undefined) this.entries.get(previous)!.next = row
        this.tail = row
    }

    remove(row: object): void {
        const entry = this.entries.get(row)
        if (entry === undefined) return
        if (entry.previous !== undefined)
            this.entries.get(entry.previous)!.next = entry.next
        if (entry.next !== undefined)
            this.entries.get(entry.next)!.previous = entry.previous
        else this.tail = entry.previous
        this.entries.delete(row)
    }

    /** Moving an already ordered suffix to the end has no observable effect. */
    changes(removals: readonly object[], births: readonly object[]): boolean {
        if (removals.length !== births.length) return true
        const removed = new Set(removals)
        let cursor = this.tail
        for (let i = births.length - 1; i >= 0; i--) {
            if (births[i] !== cursor || !removed.has(births[i]!)) return true
            cursor = this.entries.get(cursor!)?.previous
        }
        return false
    }
}
