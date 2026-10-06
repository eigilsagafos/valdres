import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const keys = rows => rows.map(row => row.key)
const results = []
const check = (name, operation) => {
    try {
        const details = operation()
        results.push({ name, pass: true, details })
    } catch (error) {
        results.push({ name, pass: false, error: error.stack })
    }
}
const setup = () => {
    const rows = valdres.collection({ indexes: { kind: value => value.kind } })
    const root = valdres.store()
    for (const key of ['a', 'b', 'c']) root.set(rows(key), { kind: 'yes', value: key })
    return { rows, root }
}

check('ordinary per-row reset retains append order (baseline control)', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    draft.delete(rows('b'))
    draft.reset(rows('b'))
    assert.deepEqual(keys(draft.get(rows)), ['a', 'c', 'b'])
    return keys(draft.get(rows))
})

check('nested clear through read-only middle restores row/membership/query coherence', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    draft.delete(rows('b'))
    const middle = draft.scope('middle')
    const leaf = middle.scope('leaf')
    leaf.set(rows('extra'), { kind: 'yes', value: 'extra' })
    const selected = query(rows, { where: { kind: { eq: 'yes' } } })
    const delivered = []
    leaf.sub(rows, () => delivered.push({ keys: keys(leaf.get(rows)), row: leaf.get(rows('b')), query: keys(leaf.get(selected)) }))
    leaf.sub(selected, () => {})
    const observed = {}
    root.txn(tx => {
        tx.scope(draft).resetAll()
        tx.scope(leaf).resetAll()
        observed.parent = keys(tx.scope(middle).get(rows))
        observed.leaf = keys(tx.scope(leaf).get(rows))
        observed.row = tx.scope(leaf).get(rows('b'))
        observed.query = keys(tx.scope(leaf).get(selected))
    })
    observed.committed = keys(leaf.get(rows))
    observed.committedRow = leaf.get(rows('b'))
    observed.committedQuery = keys(leaf.get(selected))
    observed.delivered = delivered
    console.log('NESTED_OBSERVATION', JSON.stringify(observed))
    assert.deepEqual(observed.leaf, observed.parent)
    assert.deepEqual(observed.committed, ['a', 'b', 'c'])
    assert.deepEqual(observed.committedQuery, ['a', 'b', 'c'])
    return observed
})

check('two adjacent clears restore parent order', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    draft.delete(rows('b'))
    const leaf = draft.scope('leaf')
    leaf.set(rows('extra'), { kind: 'yes', value: 'extra' })
    root.txn(tx => {
        tx.scope(draft).resetAll()
        tx.scope(leaf).resetAll()
        assert.deepEqual(keys(tx.scope(leaf).get(rows)), ['a', 'b', 'c'])
    })
    assert.deepEqual(keys(leaf.get(rows)), ['a', 'b', 'c'])
})

check('repeated clears erase all staged writes but keep later parent writes', () => {
    const { rows, root } = setup()
    const marker = valdres.atom(0)
    const draft = root.scope('draft')
    draft.set(marker, 8)
    draft.delete(rows('b'))
    root.txn(tx => {
        const cursor = tx.scope(draft)
        cursor.set(rows('before'), { kind: 'yes', value: 'before' })
        cursor.set(marker, 10)
        cursor.resetAll()
        tx.delete(rows('a'))
        tx.set(rows('a'), { kind: 'yes', value: 'a-new' })
        cursor.set(rows('between'), { kind: 'yes', value: 'between' })
        cursor.set(marker, 12)
        cursor.resetAll()
        tx.set(marker, 3)
        assert.equal(cursor.get(marker), 3)
        assert.deepEqual(keys(cursor.get(rows)), ['b', 'c', 'a'])
        cursor.set(rows('after'), { kind: 'yes', value: 'after' })
    })
    assert.equal(draft.get(marker), 3)
    assert.deepEqual(keys(draft.get(rows)), ['b', 'c', 'a', 'after'])
})

check('order residue resets and later indexed insert remains coherent', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    draft.delete(rows('a'))
    draft.reset(rows('a'))
    const selected = query(rows, { where: { kind: { eq: 'yes' } } })
    const child = draft.scope('child')
    const deliveries = []
    child.sub(selected, () => deliveries.push(keys(child.get(selected))))
    child.sub(rows, () => deliveries.push(keys(child.get(rows))))
    root.txn(tx => tx.scope(draft).resetAll())
    assert.deepEqual(keys(draft.get(rows)), ['a', 'b', 'c'])
    assert.deepEqual(keys(child.get(selected)), ['a', 'b', 'c'])
    assert.deepEqual(deliveries, [['a', 'b', 'c'], ['a', 'b', 'c']])
    root.set(rows('late'), { kind: 'yes', value: 'late' })
    assert.deepEqual(keys(child.get(selected)), ['a', 'b', 'c', 'late'])
})

check('retained selector unchanged-result avoids publication after clear/replay', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    const value = { kind: 'yes', value: 'local' }
    draft.set(rows('a'), value)
    const child = draft.scope('child')
    const selected = valdres.selector(get => get(rows('a')))
    let calls = 0
    child.sub(selected, () => calls++)
    root.txn(tx => {
        tx.scope(draft).resetAll()
        tx.scope(draft).set(rows('a'), value)
    })
    assert.equal(calls, 0)
    assert.equal(child.get(selected), value)
})

check('order-only clear invalidates a query already read in this transaction', () => {
    const { rows, root } = setup()
    const draft = root.scope('draft')
    draft.delete(rows('a'))
    draft.reset(rows('a'))
    const selected = query(rows, { where: { kind: { eq: 'yes' } } })
    const observed = {}
    root.txn(tx => {
        const cursor = tx.scope(draft)
        observed.before = keys(cursor.get(selected))
        cursor.resetAll()
        observed.membership = keys(cursor.get(rows))
        observed.query = keys(cursor.get(selected))
    })
    observed.committed = keys(draft.get(selected))
    console.log('ORDER_ONLY_QUERY_OBSERVATION', JSON.stringify(observed))
    assert.deepEqual(observed.query, observed.membership)
    return observed
})

console.log(JSON.stringify({ target, entry, runtime: process.versions, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
