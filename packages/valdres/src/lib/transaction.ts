import { isProd } from "../lib/isProd"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { GetValue } from "../types/GetValue"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { TransactionFn } from "../types/TransactionFn"
import { deepFreeze } from "../utils/deepFreeze"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isSelector } from "../utils/isSelector"
import { getState } from "./getState"
import { getAtomInitValue } from "./initAtom"
import { isFunction } from "./isFunction"
import {
    cloneAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./propagateUpdatedAtoms"
import { setAtoms } from "./setAtoms"

// const findDependencies = (
//     state: State,
//     data: StoreData,
//     result = new Set(),
// ) => {
//     const dependents = data.stateDependents.get(state)
//     if (dependents?.size) {
//         for (const dependent of dependents) {
//             if (!result.has(dependent)) {
//                 result.add(dependent)
//                 findDependencies(dependent, data, result)
//             }
//         }
//     }
//     return result
// }

const deleteAtomFamilyAtoms = (
    set: Set<AtomFamilyAtom<any, any>>,
    data: StoreData,
) => {
    set.forEach(atom => {
        data.values.delete(atom)
    })
}

export class Transaction {
    data: StoreData
    parentTransaction: Transaction | undefined
    dirty: boolean
    private _scopedTransactions: undefined | Map<string, Transaction>
    private _initializedAtomsSet: any
    private _deleteSet: any
    private _selectorDependencies: any
    private _selectorCache: any
    private _atomMap: any
    constructor(
        data: StoreData,
        parentTransaction?: Transaction,
        childTransaction?: Transaction,
    ) {
        this.data = data
        this.parentTransaction = parentTransaction
        this.dirty = false
        if (childTransaction) {
            this._scopedTransactions = new Map([
                [childTransaction.data.id, childTransaction],
            ])
        }
    }

    private valueFromTxnOrData: GetValue = (state: State) => {
        if (this.atomMap.has(state)) {
            return this.atomMap.get(state)
        }
        if (this.data.values.has(state)) {
            return this.data.values.get(state)
        }
        if (this.parentTransaction) {
            return this.parentTransaction.valueFromTxnOrData(state)
        }
    }

    get: GetValue = (state: State<any>) => {
        if (isAtom(state) || isAtomFamily(state)) {
            const value = this.valueFromTxnOrData(state)
            if (value) return value
            return getState(state, this.data, this.initializedAtomsSet)
        } else if (isSelector(state)) {
            if (this.dirty) {
                this.selectorCache.clear()
                this.selectorDependencies.clear()
                this.dirty = false
            } else if (this.selectorCache.has(state)) {
                // If the selector is cached and not dirty, return the cached value
                return this.selectorCache.get(state)
            }

            // @ts-ignore
            const res = state.get(s => {
                // Could we optimize this even further? Could we better track selector dependencies and if any of the deps are touched by the transaction?
                if (!this.selectorDependencies.has(s)) {
                    this.selectorDependencies.add(s)
                }
                return this.get(s)
            }, this.data.id)
            this.selectorCache.set(state, res)
            return res
        } else {
            throw new Error("Unsupported state")
        }
    }

    set = <V>(atom: Atom<V>, value: V | ((currentValue: V) => V)) => {
        if (!isAtom(atom)) throw new Error("Not an atom")
        if (isFunction(value)) {
            const currentValue = this.get(atom) as V
            value = value(currentValue)
        }

        if (isProd()) {
            this.atomMap.set(atom, value)
        } else {
            this.atomMap.set(atom, deepFreeze(value))
        }
        if (!this.dirty) this.dirty = true

        if (isFamilyAtom(atom)) {
            if (!this.atomMap.has(atom.family)) {
                // @ts-ignore
                this.cloneFamilyIntoTxn(atom.family)
            }
            const index = this.atomMap.get(atom.family).__index
            index.created.set(atom, performance.now())
            index.deleted.delete(atom)
            index.rendered = null
            index.renderedArray = null
            this.recursivlyUpdateAtomFamilyIndexes(atom.family)
        }
        return value
    }

    // @ts-ignore
    batchSetFamilyAtoms(family, pairs) {
        if (!this.atomMap.has(family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(family)
        }
        const index = this.atomMap.get(family).__index
        for (const [atom, value] of pairs) {
            if (atom.family !== family) {
                throw new Error("Atom does not belong to the provided family")
            }
            index.created.set(atom, performance.now())
            if (index.deleted.has(atom)) index.deleted.delete(atom)
            this.atomMap.set(atom, value)
        }
        index.rendered = null
        index.renderedArray = null
        this.recursivlyUpdateAtomFamilyIndexes(family)
    }

    del = (atom: AtomFamilyAtom<any, any>) => {
        if (!this.atomMap.has(atom.family)) {
            // @ts-ignore
            this.cloneFamilyIntoTxn(atom.family)
        }
        const index = this.atomMap.get(atom.family).__index
        index.created.delete(atom)
        index.deleted.set(atom, performance.now())
        index.rendered = null
        index.renderedArray = null
        this.atomMap.set(atom.family, renderAtomFamilyIndex(index))
        this.recursivlyUpdateAtomFamilyIndexes(atom.family)
        if (this.data.values.has(atom)) {
            this.deleteSet.add(atom)
        }
        if (this.atomMap.has(atom)) {
            this.atomMap.delete(atom)
        }
    }

    scope = (scopeId: string, callback: (txn: Transaction) => any) => {
        if (scopeId in this.data.scopes) {
            // @ts-ignore
            return this.scopedTransaction(scopeId).execute(callback, false)
        } else {
            throw new Error(
                `Scope '${scopeId}' not found. Registered scopes: ${Object.keys(this.data.scopes).join(", ")}`,
            )
        }
    }

    parentScope = (callback: (txn: Transaction) => any) => {
        if (!this.parentTransaction) {
            this.parentTransaction = new Transaction(
                // @ts-ignore
                this.data.parent,
                undefined,
                this,
            )
        }
        return this.parentTransaction.execute(callback, false)
    }

    reset = (atom: Atom) => {
        const value = getAtomInitValue(
            atom,
            this.data,
            this.initializedAtomsSet,
        )
        this.atomMap.set(atom, value)
        return value
    }

    execute = (callback: TransactionFn, autoCommit = true) => {
        const result = callback(this)
        if (autoCommit) this.txnCommit()
        return result
    }

    private txnCommit = () => {
        if (this.parentTransaction) {
            this.parentTransaction.txnCommit()
        } else {
            this.commit()
        }
    }

    commit = () => {
        const initializedAtomsSet = new Set<Atom>()
        setAtoms(this.atomMap, this.data, initializedAtomsSet)
        if (this.deleteSet?.size) {
            deleteAtomFamilyAtoms(this.deleteSet, this.data)
        }
        if (this._scopedTransactions) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.commit()
            }
        }
    }

    private get atomMap() {
        if (!this._atomMap) this._atomMap = new Map()
        return this._atomMap
    }
    private get selectorCache() {
        if (!this._selectorCache) this._selectorCache = new Map()
        return this._selectorCache
    }

    private get selectorDependencies() {
        if (!this._selectorDependencies) this._selectorDependencies = new Set()
        return this._selectorDependencies
    }
    private get deleteSet() {
        if (!this._deleteSet) this._deleteSet = new Set()
        return this._deleteSet
    }

    private get initializedAtomsSet() {
        if (!this._initializedAtomsSet) this._initializedAtomsSet = new Set()
        return this._initializedAtomsSet
    }

    private scopedTransaction(scopeId: string) {
        if (!this._scopedTransactions) this._scopedTransactions = new Map()
        if (!this._scopedTransactions.has(scopeId)) {
            const scopedData = this.data.scopes[scopeId]
            const scopedTransaction = new Transaction(scopedData, this)
            this._scopedTransactions.set(scopeId, scopedTransaction)
        }
        return this._scopedTransactions.get(scopeId)
    }

    private cloneFamilyIntoTxn(
        family: any,
        // @ts-ignore
        parentIndex,
        moveUpIfParent = true,
    ): void {
        if (moveUpIfParent && this.parentTransaction)
            return this.parentTransaction.cloneFamilyIntoTxn(
                family,
                parentIndex,
                moveUpIfParent,
            )
        const currentFamilyList = this.get(family)
        const clonedIndex = cloneAtomFamilyIndex(
            // @ts-ignore
            currentFamilyList.__index,
            parentIndex,
        )
        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.cloneFamilyIntoTxn(family, clonedIndex, false)
            }
        }
        this.atomMap.set(family, renderAtomFamilyIndex(clonedIndex))
    }

    private recursivlyUpdateAtomFamilyIndexes(
        atomFamily: AtomFamily<any, any>,
    ) {
        const currentIndex = this.atomMap.get(atomFamily).__index
        currentIndex.rendered = null
        currentIndex.renderedArray = null
        const updatedValue = renderAtomFamilyIndex(currentIndex)
        this.atomMap.set(atomFamily, updatedValue)

        if (this._scopedTransactions?.size) {
            for (const [, scopedTxn] of this._scopedTransactions) {
                scopedTxn.recursivlyUpdateAtomFamilyIndexes(atomFamily)
            }
        }
    }
}

export const transaction = (callback: TransactionFn, data: StoreData) => {
    const txn = new Transaction(data)
    return txn.execute(callback)
}
