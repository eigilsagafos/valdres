import type { Atom, GlobalAtom, Store, Transaction } from "../index"
import { Transaction as AdapterTransaction } from "../adapter-internals/v1"

const assertTransactionSurfaces = (txn: Transaction, store: Store) => {
    // @ts-expect-error lifecycle is owned by store.txn
    txn.commit()
    // @ts-expect-error backing store internals are not callback capabilities
    txn.data

    const adapterTxn = new AdapterTransaction(store)
    const callbackTxn: Transaction = adapterTxn
    adapterTxn.commit()
    adapterTxn.abort()
    void callbackTxn
}

void assertTransactionSurfaces

const assertPublicStoreSurface = (publicStore: Store) => {
    publicStore.id satisfies string
    // @ts-expect-error StoreData is not part of the public Store surface
    publicStore.data
}
// @ts-expect-error Store no longer accepts a mutable runtime type parameter
type GenericStore = Store<{ values: Map<unknown, unknown> }>
// @ts-expect-error StoreData is not exported from the public entrypoint
type PublicStoreData = import("../index").StoreData
// @ts-expect-error global timer bookkeeping is engine-only
type PublicMaxAgeInterval = import("../index").MaxAgeInterval

void assertPublicStoreSurface

const assertPublicAtomSurface = (atom: Atom, globalAtom: GlobalAtom) => {
    // @ts-expect-error global synchronization callbacks are engine-only
    atom.onInit
    // @ts-expect-error registered StoreData instances are engine-only
    globalAtom.stores
    // @ts-expect-error raw StoreData detach is engine-only
    globalAtom.detach
}

void assertPublicAtomSurface
void (undefined as unknown as GenericStore)
void (undefined as unknown as PublicStoreData)
void (undefined as unknown as PublicMaxAgeInterval)
