import type { Transaction } from "../index"
import { Transaction as AdapterTransaction } from "../adapter-internals"
import type { StoreData } from "../types/StoreData"

const assertTransactionSurfaces = (txn: Transaction, data: StoreData) => {
    // @ts-expect-error lifecycle is owned by store.txn
    txn.commit()
    // @ts-expect-error backing store internals are not callback capabilities
    txn.data

    const adapterTxn = new AdapterTransaction(data)
    const callbackTxn: Transaction = adapterTxn
    adapterTxn.commit()
    adapterTxn.abort()
    void callbackTxn
}

void assertTransactionSurfaces
