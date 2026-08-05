import { IS_PROD } from "../IS_PROD"
import type { Selector } from "../../types/Selector"
import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"

const MAX_POOLED_FRAMES = 4
const MAX_RETAINED_ENTRIES = 1_024

export type SchedulerWorkspace = {
    meta: Map<Selector, number>
    nodes: Selector[]
    ready: Selector[]
    resweep: Selector[]
    batch: Selector[]
    inUse: boolean
}

type DfsFrame = {
    node: State
    it: Iterator<State>
}

export type LivenessWorkspace = {
    stack: State[]
    ordered: State[]
    dfs: DfsFrame[]
    onPath?: Set<State>
    region?: Set<State>
    live?: Set<State>
    wasLive?: Map<State, boolean>
    mountVisited?: Set<State>
    unmountVisited?: Set<State>
    inUse: boolean
    oversized: boolean
}

type WorkspacePool = {
    scheduler: SchedulerWorkspace[]
    liveness: LivenessWorkspace[]
}

const pools = new WeakMap<StoreData, WorkspacePool>()

const poolFor = (data: StoreData): WorkspacePool => {
    let pool = pools.get(data)
    if (!pool) {
        pool = { scheduler: [], liveness: [] }
        pools.set(data, pool)
    }
    return pool
}

const recordSchedulerAllocations = (data: StoreData, count: number) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation)
        instrumentation.counters.schedulerWorkAllocations += count
}

const recordLivenessAllocations = (data: StoreData, count: number) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation)
        instrumentation.counters.livenessWorkAllocations += count
}

const createSchedulerWorkspace = (data: StoreData): SchedulerWorkspace => {
    // One Map plus four reusable arrays.
    if (!IS_PROD) recordSchedulerAllocations(data, 5)
    return {
        meta: new Map(),
        nodes: [],
        ready: [],
        resweep: [],
        batch: [],
        inUse: true,
    }
}

const createLivenessWorkspace = (data: StoreData): LivenessWorkspace => {
    // Stack, reverse-order staging, and DFS arrays; Sets/Maps stay lazy.
    if (!IS_PROD) recordLivenessAllocations(data, 3)
    return {
        stack: [],
        ordered: [],
        dfs: [],
        inUse: true,
        oversized: false,
    }
}

export const acquireSchedulerWorkspace = (
    data: StoreData,
): SchedulerWorkspace => {
    const frames = poolFor(data).scheduler
    for (const frame of frames) {
        if (!frame.inUse) {
            frame.inUse = true
            return frame
        }
    }
    if (frames.length < MAX_POOLED_FRAMES) {
        const frame = createSchedulerWorkspace(data)
        frames.push(frame)
        return frame
    }
    return createSchedulerWorkspace(data)
}

const clearArray = <T>(array: T[]): T[] => {
    if (array.length > MAX_RETAINED_ENTRIES) return []
    array.length = 0
    return array
}

export const releaseSchedulerWorkspace = (frame: SchedulerWorkspace): void => {
    const size = frame.meta.size
    frame.meta.clear()
    if (size > MAX_RETAINED_ENTRIES) frame.meta = new Map()
    frame.nodes = clearArray(frame.nodes)
    frame.ready = clearArray(frame.ready)
    frame.resweep = clearArray(frame.resweep)
    frame.batch = clearArray(frame.batch)
    frame.inUse = false
}

export const acquireLivenessWorkspace = (
    data: StoreData,
): LivenessWorkspace => {
    const frames = poolFor(data).liveness
    for (const frame of frames) {
        if (!frame.inUse) {
            frame.inUse = true
            return frame
        }
    }
    if (frames.length < MAX_POOLED_FRAMES) {
        const frame = createLivenessWorkspace(data)
        frames.push(frame)
        return frame
    }
    return createLivenessWorkspace(data)
}

export const noteLivenessWorkspaceSize = (frame: LivenessWorkspace): void => {
    if (
        frame.stack.length > MAX_RETAINED_ENTRIES ||
        frame.ordered.length > MAX_RETAINED_ENTRIES ||
        frame.dfs.length > MAX_RETAINED_ENTRIES ||
        (frame.onPath?.size ?? 0) > MAX_RETAINED_ENTRIES ||
        (frame.region?.size ?? 0) > MAX_RETAINED_ENTRIES ||
        (frame.live?.size ?? 0) > MAX_RETAINED_ENTRIES ||
        (frame.wasLive?.size ?? 0) > MAX_RETAINED_ENTRIES ||
        (frame.mountVisited?.size ?? 0) > MAX_RETAINED_ENTRIES ||
        (frame.unmountVisited?.size ?? 0) > MAX_RETAINED_ENTRIES
    ) {
        frame.oversized = true
    }
}

export const ensureOnPath = (
    frame: LivenessWorkspace,
    data: StoreData,
): Set<State> => {
    if (!frame.onPath) {
        recordLivenessAllocations(data, 1)
        frame.onPath = new Set()
    }
    return frame.onPath
}

export const ensureRegion = (
    frame: LivenessWorkspace,
    data: StoreData,
): Set<State> => {
    if (!frame.region) {
        recordLivenessAllocations(data, 1)
        frame.region = new Set()
    }
    return frame.region
}

export const ensureLive = (
    frame: LivenessWorkspace,
    data: StoreData,
): Set<State> => {
    if (!frame.live) {
        recordLivenessAllocations(data, 1)
        frame.live = new Set()
    }
    return frame.live
}

export const ensureWasLive = (
    frame: LivenessWorkspace,
    data: StoreData,
): Map<State, boolean> => {
    if (!frame.wasLive) {
        recordLivenessAllocations(data, 1)
        frame.wasLive = new Map()
    }
    return frame.wasLive
}

export const ensureMountVisited = (
    frame: LivenessWorkspace,
    data: StoreData,
): Set<State> => {
    if (!frame.mountVisited) {
        recordLivenessAllocations(data, 1)
        frame.mountVisited = new Set()
    }
    return frame.mountVisited
}

export const ensureUnmountVisited = (
    frame: LivenessWorkspace,
    data: StoreData,
): Set<State> => {
    if (!frame.unmountVisited) {
        recordLivenessAllocations(data, 1)
        frame.unmountVisited = new Set()
    }
    return frame.unmountVisited
}

const clearSet = <T>(set: Set<T> | undefined): Set<T> | undefined => {
    if (!set) return undefined
    const size = set.size
    set.clear()
    return size > MAX_RETAINED_ENTRIES ? undefined : set
}

const clearMap = <K, V>(map: Map<K, V> | undefined): Map<K, V> | undefined => {
    if (!map) return undefined
    const size = map.size
    map.clear()
    return size > MAX_RETAINED_ENTRIES ? undefined : map
}

export const releaseLivenessWorkspace = (frame: LivenessWorkspace): void => {
    if (frame.oversized) {
        frame.stack = []
        frame.ordered = []
        frame.dfs = []
        frame.onPath = undefined
        frame.region = undefined
        frame.live = undefined
        frame.wasLive = undefined
        frame.mountVisited = undefined
        frame.unmountVisited = undefined
        frame.oversized = false
        frame.inUse = false
        return
    }
    frame.stack = clearArray(frame.stack)
    frame.ordered = clearArray(frame.ordered)
    frame.dfs = clearArray(frame.dfs)
    frame.onPath = clearSet(frame.onPath)
    frame.region = clearSet(frame.region)
    frame.live = clearSet(frame.live)
    frame.wasLive = clearMap(frame.wasLive)
    frame.mountVisited = clearSet(frame.mountVisited)
    frame.unmountVisited = clearSet(frame.unmountVisited)
    frame.inUse = false
}

/** Explicit disposal release. Undisposed stores are still weakly owned. */
export const dropGraphWorkspaces = (data: StoreData): void => {
    pools.delete(data)
}
