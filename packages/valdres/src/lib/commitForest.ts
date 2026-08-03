import type { Atom } from "../types/Atom"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { StoreData } from "../types/StoreData"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import { recordCommitError, type CommitErrors } from "./commitErrors"
import { endCommit } from "./onCommitEnd"

// Shape of a cross-store commit settlement: canonicalize the plan entries and
// global peer updates into one node per physical store, pick the roots to walk,
// and close the commit boundaries the walk opened.
//
// Structure only — no evaluation, no notification, no reporting. That is what
// keeps it a leaf: it imports the commit-boundary and error primitives and
// nothing from the write/propagation path, so it stays outside the core import
// cycle (see test/import-cycles) even though the walk that consumes it cannot.

export type ForestNode = CommitForestEntry

// Canonicalize local plan entries and global peer updates into one sparse
// forest node per physical StoreData. Ancestor placeholders carry no mutation
// groups; they exist only to make overlapping peer/origin paths one structural
// walk rather than a selector-level skip guard.
export const buildCommitForest = (
    entries: CommitForestEntry[],
    globalUpdates: Map<StoreData, Atom<any>[]> | undefined,
): {
    roots: ForestNode[]
    peerAtoms: Map<StoreData, Atom<any>[]> | undefined
} => {
    const nodes = new Map<StoreData, ForestNode>()
    const ensureNode = (data: StoreData): ForestNode => {
        const existing = nodes.get(data)
        if (existing) return existing
        const node: ForestNode = {
            data,
            updatedAtoms: [],
            deleted: undefined,
            unsetAtoms: undefined,
            children: undefined,
        }
        nodes.set(data, node)
        if (data.parent) {
            const parent = ensureNode(data.parent)
            if (parent.children) parent.children.push(node)
            else parent.children = [node]
        }
        return node
    }

    for (const entry of entries) {
        const node = ensureNode(entry.data)
        if (entry.updatedAtoms.length > 0)
            node.updatedAtoms.push(...entry.updatedAtoms)
        if (entry.deleted) {
            if (node.deleted) node.deleted.push(...entry.deleted)
            else node.deleted = entry.deleted
        }
        if (entry.unsetAtoms) {
            if (node.unsetAtoms) node.unsetAtoms.push(...entry.unsetAtoms)
            else node.unsetAtoms = entry.unsetAtoms
        }
    }
    if (globalUpdates) {
        for (const peer of globalUpdates.keys()) ensureNode(peer)
    }

    const roots: ForestNode[] = []
    const added = new Set<StoreData>()
    // One tree ⇔ one root, so tree identity is the dedupe key and `tree.root`
    // resolves the owner without walking `parent`.
    const addRoot = (data: StoreData) => {
        const root = data.tree.root
        if (!added.has(root)) {
            added.add(root)
            roots.push(ensureNode(root))
        }
    }
    const originTree = entries.length > 0 ? entries[0].data.tree : undefined
    if (globalUpdates) {
        for (const peer of globalUpdates.keys()) {
            if (peer.tree !== originTree) addRoot(peer)
        }
    }
    for (const entry of entries) {
        if (entry.data.tree !== originTree) addRoot(entry.data)
    }
    if (originTree) addRoot(originTree.root)
    if (!originTree && globalUpdates) {
        for (const peer of globalUpdates.keys()) addRoot(peer)
    }
    return { roots, peerAtoms: globalUpdates }
}

// Close every commit boundary a forest settlement opened. Each one gets its
// own try/catch so a throwing listener cannot strand the trees queued behind
// it — the failure mode this exists to prevent is a depth counter stuck above
// zero, which silences that tree's onCommitEnd for the rest of the process.
export const closeCommitBoundaries = (
    commitTrees: StoreTreeRuntime[],
    errors: CommitErrors,
    swallowErrors: boolean,
) => {
    for (const tree of commitTrees) {
        try {
            endCommit(tree, swallowErrors)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}
