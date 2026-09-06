/** Candidate-owned effective DAG. Edges point from reader to dependency.
 *
 * begin: committed adjacency -> empty provisional prefix
 * insert: rank check -> bounded forward search -> reject OR stable relabel
 * accept: keep prefix; rollback: replace prefix with prior committed edges
 * clear: discard the whole host generation
 *
 * A rank violation moves forward-reachable nodes in [dependency, reader] to
 * the interval's end, preserving both partitions' order. No edge can leave the
 * moved partition for an unmoved vertex inside the interval: search included
 * every such reachable vertex. Deletion cannot invalidate an existing order.
 * The order index owns weak handles only; no selector is pinned by its rank.
 */
interface Vertex {
    rank: number
    edges: object[]
}

export class DynamicTopologicalOrder {
    readonly vertices = new WeakMap<object, Vertex>()
    readonly order: WeakRef<object>[] = []
    readonly pending = new Map<object, object[]>()

    begin(node: object): void {
        let vertex = this.vertices.get(node)
        if (vertex === undefined) {
            vertex = { rank: this.order.length, edges: [] }
            this.vertices.set(node, vertex)
            this.order.push(new WeakRef(node))
        }
        if (this.pending.has(node)) throw Error("Duplicate topological frame")
        this.pending.set(node, vertex.edges)
        vertex.edges = []
    }

    insert(parent: object, dependency: object): readonly object[] | undefined {
        const target = this.vertices.get(parent)!
        const start = this.vertices.get(dependency)
        // Only selector bodies register vertices. Served atoms are terminals.
        if (start === undefined) return undefined
        if (parent === dependency) return [parent, parent]
        if (start.rank <= target.rank) {
            const parents = new Map<object, object | undefined>([
                [dependency, undefined],
            ])
            const stack = [dependency]
            while (stack.length > 0) {
                const node = stack.pop()!
                if (node === parent) {
                    const path: object[] = []
                    let cursor: object | undefined = parent
                    while (cursor !== undefined) {
                        path.push(cursor)
                        cursor = parents.get(cursor)
                    }
                    path.reverse()
                    return [parent, ...path]
                }
                const edges = this.vertices.get(node)!.edges
                // Push in reverse first-read order for deterministic DFS.
                for (let i = edges.length - 1; i >= 0; i--) {
                    const next = edges[i]!
                    if (
                        this.vertices.get(next)!.rank > target.rank ||
                        parents.has(next)
                    )
                        continue
                    parents.set(next, node)
                    stack.push(next)
                }
            }
            const low = start.rank
            const high = target.rank
            const before: WeakRef<object>[] = []
            const moved: WeakRef<object>[] = []
            for (let i = low; i <= high; i++) {
                const ref = this.order[i]!
                const node = ref.deref()
                ;(node !== undefined && parents.has(node)
                    ? moved
                    : before
                ).push(ref)
            }
            let rank = low
            for (const ref of [...before, ...moved]) {
                this.order[rank] = ref
                const node = ref.deref()
                if (node !== undefined) this.vertices.get(node)!.rank = rank
                rank++
            }
        }
        target.edges.push(dependency)
        return undefined
    }

    accept(node: object): void {
        this.pending.delete(node)
    }

    rollback(node: object): void {
        const previous = this.pending.get(node)
        if (previous === undefined) return
        this.vertices.get(node)!.edges = []
        for (const dependency of previous) {
            if (this.insert(node, dependency) !== undefined) {
                throw Error(
                    "Topological rollback would create a committed cycle",
                )
            }
        }
        this.pending.delete(node)
    }
}

const hosts = new WeakMap<object, DynamicTopologicalOrder>()
export function orderFor(host: object): DynamicTopologicalOrder {
    let order = hosts.get(host)
    if (order === undefined) {
        order = new DynamicTopologicalOrder()
        hosts.set(host, order)
    }
    return order
}
export function acceptTopologicalProposal(host: object, node: object): void {
    hosts.get(host)?.accept(node)
}
export function rollbackTopologicalProposal(host: object, node: object): void {
    hosts.get(host)?.rollback(node)
}
export function clearTopologicalHost(host: object): void {
    hosts.delete(host)
}
