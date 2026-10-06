import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const mode = process.argv[4] || 'bulk'
const valdres = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'index.ts' : 'index.js')))
const { query } = await import(pathToFileURL(path.join(target, entry, entry === 'src' ? 'query.ts' : 'query.js')))
const results = []
const run = (name, operation) => {
    try { results.push({ name, pass: true, details: operation() }) }
    catch (error) { results.push({ name, pass: false, error: error.stack }) }
}
const clear = (cursor, targets) => {
    if (mode === 'loop') for (const state of targets) cursor.reset(state)
    else if (mode === 'bulk') cursor.resetAll()
}
const keys = rows => rows.map(row => row.key)

run('caller transaction: staged ownership, clear, parent writes, rebuild, notifications survive', () => {
    const root = valdres.store()
    const draft = root.scope('named')
    const child = draft.scope('readonly')
    const version = valdres.atom(1)
    const marker = valdres.atom('root')
    const lookup = valdres.family(key => valdres.atom(`fallback-${key}`))
    const rows = valdres.collection({ indexes: { kind: value => value.kind } })
    const selected = query(rows, { where: { kind: { eq: 'entity' } } })
    const rootA = { kind: 'entity', name: 'root-a' }
    const rootB = { kind: 'entity', name: 'root-b' }
    root.set(rows('a'), rootA)
    root.set(rows('b'), rootB)
    draft.set(marker, 'old')
    draft.set(lookup('owned'), 'old-lookup')
    draft.set(rows('old'), { kind: 'entity', name: 'old' })
    draft.delete(rows('b'))
    const subscriptions = [version, marker, lookup('owned'), rows('a'), rows('b'), rows('old'), rows('new'), rows, selected]
    const deliveries = subscriptions.map(() => [])
    const removers = subscriptions.map((state, index) => child.sub(state, () => deliveries[index].push({ version: child.get(version), marker: child.get(marker), family: child.get(lookup('owned')), rows: keys(child.get(rows)), query: keys(child.get(selected)) })))
    const finalA = { kind: 'entity', name: 'snapshot-plus-edit' }
    root.txn(tx => {
        tx.set(version, 2)
        const cursor = tx.scope(draft)
        cursor.set(lookup('staged'), 'staged-before')
        cursor.set(rows('before'), { kind: 'entity', name: 'before' })
        cursor.set(marker, 'staged-before')
        clear(cursor, [marker, lookup('owned'), lookup('staged'), rows('old'), rows('b'), rows('before')])
        assert.equal(cursor.get(version), 2)
        assert.equal(cursor.get(marker), 'root')
        assert.equal(cursor.get(lookup('owned')), 'fallback-owned')
        assert.equal(cursor.get(lookup('staged')), 'fallback-staged')
        assert.equal(cursor.get(rows('old')), undefined)
        assert.equal(cursor.get(rows('before')), undefined)
        assert.equal(cursor.get(rows('b')), rootB)
        tx.set(marker, 'parent-after')
        tx.set(lookup('owned'), 'parent-lookup-after')
        tx.set(rows('live'), { kind: 'entity', name: 'live-root-not-in-snapshot' })
        assert.equal(cursor.get(marker), 'parent-after')
        assert.equal(cursor.get(lookup('owned')), 'parent-lookup-after')
        cursor.set(rows('a'), finalA)
        cursor.delete(rows('b'))
        cursor.set(rows('new'), { kind: 'entity', name: 'new' })
        cursor.set(marker, 'final')
        cursor.set(lookup('owned'), 'final-lookup')
        assert.equal(deliveries.flat().length, 0)
        assert.deepEqual(keys(cursor.get(selected)), keys(cursor.get(rows)))
        assert.deepEqual(keys(tx.scope(child).get(rows)), keys(cursor.get(rows)))
    })
    assert.equal(root.scope('named'), draft)
    assert.equal(draft.scope('readonly'), child)
    assert.equal(root.get(version), 2)
    assert.equal(root.get(marker), 'parent-after')
    assert.equal(root.get(rows('a')), rootA)
    assert.equal(draft.get(rows('a')), finalA)
    assert.deepEqual(keys(child.get(rows)), ['a', 'live', 'new'])
    assert.equal(child.get(lookup('staged')), 'fallback-staged')
    for (const delivery of deliveries) {
        assert.ok(delivery.length <= 1)
        for (const observed of delivery) assert.deepEqual(observed, { version: 2, marker: 'final', family: 'final-lookup', rows: ['a', 'live', 'new'], query: ['a', 'live', 'new'] })
    }
    assert.ok(deliveries.flat().length >= 5)
    const counts = deliveries.map(delivery => delivery.length)
    draft.set(marker, 'later')
    assert.equal(deliveries[1].length, 2)
    assert.equal(child.get(marker), 'later')
    for (const remove of removers) remove()
    return counts
})

run('rollback restores exact row array and values; retry can clear', () => {
    const root = valdres.store()
    const draft = root.scope('draft')
    const marker = valdres.atom(0)
    const rows = valdres.collection()
    root.set(rows('a'), 1)
    draft.set(marker, 7)
    draft.set(rows('old'), 8)
    const before = draft.get(rows)
    let deliveries = 0
    draft.sub(rows, () => deliveries++)
    draft.sub(marker, () => deliveries++)
    const failure = new Error('replay failed')
    assert.throws(() => root.txn(tx => {
        tx.set(marker, 2)
        clear(tx.scope(draft), [marker, rows('old')])
        tx.scope(draft).set(rows('new'), 9)
        throw failure
    }), error => error === failure)
    assert.equal(root.get(marker), 0)
    assert.equal(draft.get(marker), 7)
    assert.equal(draft.get(rows), before)
    assert.equal(deliveries, 0)
    root.txn(tx => clear(tx.scope(draft), [marker, rows('old')]))
    assert.equal(draft.get(marker), 0)
    assert.deepEqual(keys(draft.get(rows)), ['a'])
})

run('unchanged clear/rebuild reuses row references and membership array', () => {
    const root = valdres.store()
    const draft = root.scope('draft')
    const rows = valdres.collection()
    const object = { content: 'same' }
    draft.set(rows('only'), object)
    const before = draft.get(rows)
    let deliveries = 0
    draft.sub(rows, () => deliveries++)
    draft.sub(rows('only'), () => deliveries++)
    root.txn(tx => {
        clear(tx.scope(draft), [rows('only')])
        tx.scope(draft).set(rows('only'), object)
    })
    assert.equal(draft.get(rows), before)
    assert.equal(draft.get(rows('only')), object)
    assert.equal(deliveries, 0)
})

console.log(JSON.stringify({ target, entry, mode, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
