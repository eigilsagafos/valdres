import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const target = path.resolve(process.argv[2])
const entry = process.argv[3] || 'dist'
const extension = entry === 'src' ? 'ts' : 'js'
const { collection, store } = await import(pathToFileURL(path.join(target, entry, `index.${extension}`)))
const { query } = await import(pathToFileURL(path.join(target, entry, `query.${extension}`)))
const keys = handles => handles.map(handle => handle.key)
const value = (active = true, revision = 0) => ({ tag: 'yes', active, revision })
const results = []

const fixture = () => {
    const rows = collection({ indexes: { tag: rowValue => rowValue.tag, active: rowValue => rowValue.active } })
    const all = query(rows, { where: { tag: { eq: 'yes' } } })
    const active = query(rows, { where: { active: { eq: true } } })
    const root = store()
    const values = new Map(['a', 'b', 'c'].map(key => [key, value()]))
    for (const [key, rowValue] of values) root.set(rows(key), rowValue)
    const parent = root.scope('parent')
    parent.delete(rows('a'))
    parent.reset(rows('a'))
    const child = parent.scope('child')
    const grandchild = child.scope('grandchild')
    const greatGrandchild = grandchild.scope('great-grandchild')
    const peer = parent.scope('peer')
    const scopes = { parent, child, grandchild, greatGrandchild, peer }
    const notifications = []
    const read = cursor => ({ rows: keys(cursor.get(rows)), all: keys(cursor.get(all)), active: keys(cursor.get(active)) })
    const warm = () => {
        for (const [name, scope] of Object.entries(scopes)) {
            read(scope)
            scope.sub(rows, () => notifications.push({ name, ...read(scope) }))
            scope.sub(all, () => {})
            scope.sub(active, () => {})
        }
    }
    const phases = []
    const check = (transaction, name, expectations) => {
        const observations = {}
        for (const [scopeName, expected] of Object.entries(expectations)) {
            const cursor = transaction ? transaction.scope(scopes[scopeName]) : scopes[scopeName]
            const expectedRows = Array.isArray(expected) ? expected : expected.rows
            const expectedActive = Array.isArray(expected) ? expected : expected.active
            const observed = read(cursor)
            assert.deepEqual(observed.rows, expectedRows, `${name}/${scopeName}/membership`)
            assert.deepEqual(observed.all, expectedRows, `${name}/${scopeName}/indexed order`)
            assert.deepEqual(observed.active, expectedActive, `${name}/${scopeName}/value predicate`)
            for (const key of ['a', 'b', 'c', 'd', 'missing']) {
                assert.equal(cursor.get(rows(key)) !== undefined, expectedRows.includes(key), `${name}/${scopeName}/${key}/presence`)
            }
            observations[scopeName] = observed
        }
        phases.push({ name, observations })
    }
    const done = () => ({ phases, notifications })
    return { rows, all, active, root, values, scopes, warm, check, done }
}

const restored = ['a', 'b', 'c']
const historical = ['b', 'c', 'a']
const allRestored = { parent: restored, child: restored, grandchild: restored, greatGrandchild: restored, peer: restored }
const childHistory = (rows = historical, active = rows) => ({
    parent: restored,
    child: { rows, active },
    grandchild: { rows, active },
    greatGrandchild: { rows, active },
    peer: restored,
})
const grandchildHistory = (rows = historical, active = rows) => ({
    parent: restored,
    child: restored,
    grandchild: { rows, active },
    greatGrandchild: { rows, active },
    peer: restored,
})

const run = (name, operation) => {
    try {
        results.push({ name, pass: true, evidence: operation() })
    } catch (error) {
        results.push({ name, pass: false, error: error.stack })
    }
}

run('later accepted writes, delete/rebirth and ordinary reset keep child/grandchild caches coherent', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'restored before any child event', allRestored)
        const child = transaction.scope(scopes.child)
        child.set(rows('b'), value(false, 1))
        check(transaction, 'first child event ends mirroring', childHistory(historical, ['c', 'a']))
        const firstMembership = child.get(rows)
        const firstGrandchild = transaction.scope(scopes.grandchild).get(rows)
        child.set(rows('a'), value(false, 2))
        child.update(rows('c'), current => ({ ...current, revision: 3 }))
        assert.equal(child.get(rows), firstMembership)
        assert.equal(transaction.scope(scopes.grandchild).get(rows), firstGrandchild)
        check(transaction, 'second and third presence-neutral events', childHistory(historical, ['c']))
        child.reset(rows('b'))
        assert.equal(child.get(rows), firstMembership)
        check(transaction, 'ownership reset does not regain eligibility', childHistory(historical, ['b', 'c']))
        child.delete(rows('b'))
        check(transaction, 'later death invalidates membership', childHistory(['c', 'a'], ['c']))
        child.set(rows('b'), value(true, 4))
        check(transaction, 'later birth appends despite existing scope history', childHistory(['c', 'a', 'b'], ['c', 'b']))
        child.reset(rows('b'))
        child.set(rows('d'), value(true, 5))
        check(transaction, 'new row after reset retains prior birth order', childHistory(['c', 'a', 'b', 'd'], ['c', 'b', 'd']))
        child.delete(rows('d'))
        check(transaction, 'final draft', childHistory(['c', 'a', 'b'], ['c', 'b']))
    })
    check(undefined, 'commit', childHistory(['c', 'a', 'b'], ['c', 'b']))
    assert.equal(scopes.child.get(rows('a')).revision, 2)
    assert.equal(scopes.greatGrandchild.get(rows('c')).revision, 3)
    assert.equal(scopes.child.get(rows('b')), lane.values.get('b'))
    return lane.done()
})

run('first event at grandchild releases its dependent cache but not its following parent', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'restored', allRestored)
        const grandchild = transaction.scope(scopes.grandchild)
        grandchild.set(rows('c'), value(false, 1))
        check(transaction, 'grandchild first event', grandchildHistory(historical, ['b', 'a']))
        grandchild.set(rows('b'), value(false, 2))
        grandchild.reset(rows('c'))
        check(transaction, 'grandchild later neutral events', grandchildHistory(historical, ['c', 'a']))
        grandchild.delete(rows('c'))
        check(transaction, 'grandchild later death', grandchildHistory(['b', 'a'], ['a']))
        grandchild.reset(rows('c'))
        grandchild.update(rows('b'), current => ({ ...current, active: true, revision: 3 }))
        check(transaction, 'grandchild later reset birth', grandchildHistory(['b', 'a', 'c']))
    })
    check(undefined, 'commit', grandchildHistory(['b', 'a', 'c']))
    return lane.done()
})

run('no-op writes do not consume first-event eligibility; accepted reset does', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    const owned = value(true, 7)
    scopes.child.set(rows('a'), owned)
    warm()
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'restored value-only owner', allRestored)
        const child = transaction.scope(scopes.child)
        const cached = child.get(rows)
        child.set(rows('a'), owned)
        child.update(rows('a'), current => current)
        child.reset(rows('missing'))
        assert.equal(child.get(rows), cached)
        check(transaction, 'three no-op operations still mirror', allRestored)
        child.reset(rows('a'))
        check(transaction, 'first accepted ownership reset', childHistory())
        const historicalCache = child.get(rows)
        child.delete(rows('missing'))
        child.delete(rows('missing'))
        child.reset(rows('missing'))
        assert.equal(child.get(rows), historicalCache)
        check(transaction, 'later presence-neutral missing-row events', childHistory())
    })
    check(undefined, 'commit', childHistory())
    assert.equal(scopes.child.get(rows('a')), lane.values.get('a'))
    return lane.done()
})

run('first accepted event on a never-present row invalidates dependent membership caches', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'restored', allRestored)
        const child = transaction.scope(scopes.child)
        child.delete(rows('missing'))
        check(transaction, 'first event is presence-neutral tombstone', childHistory())
        child.reset(rows('missing'))
        child.set(rows('a'), value(false, 1))
        check(transaction, 'later reset cannot regain mirroring', childHistory(historical, ['b', 'c']))
    })
    check(undefined, 'commit', childHistory(historical, ['b', 'c']))
    return lane.done()
})

run('first-event detection is collection-local even when the scope already wrote another collection', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    const secondary = collection({ indexes: { tag: rowValue => rowValue.tag } })
    const selected = query(secondary, { where: { tag: { eq: 'yes' } } })
    root.set(secondary('x'), value())
    root.set(secondary('y'), value())
    scopes.parent.delete(secondary('x'))
    scopes.parent.reset(secondary('x'))
    warm()
    for (const scope of Object.values(scopes)) {
        scope.get(secondary)
        scope.get(selected)
        scope.sub(secondary, () => {})
        scope.sub(selected, () => {})
    }
    const secondaryCheck = (transaction, expectedChild) => {
        for (const [name, scope] of Object.entries(scopes)) {
            const cursor = transaction ? transaction.scope(scope) : scope
            const expected = ['parent', 'peer'].includes(name) ? ['x', 'y'] : expectedChild
            assert.deepEqual(keys(cursor.get(secondary)), expected)
            assert.deepEqual(keys(cursor.get(selected)), expected)
        }
    }
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'both collections restored', allRestored)
        secondaryCheck(transaction, ['x', 'y'])
        const child = transaction.scope(scopes.child)
        child.set(secondary('y'), value(true, 1))
        secondaryCheck(transaction, ['y', 'x'])
        check(transaction, 'unrelated first event leaves primary eligible', allRestored)
        child.set(rows('c'), value(false, 2))
        check(transaction, 'primary still receives its own first-event invalidation', childHistory(historical, ['b', 'a']))
        child.set(secondary('x'), value(true, 3))
        child.reset(secondary('y'))
        secondaryCheck(transaction, ['y', 'x'])
        check(transaction, 'later secondary events', childHistory(historical, ['b', 'a']))
    })
    secondaryCheck(undefined, ['y', 'x'])
    check(undefined, 'commit', childHistory(historical, ['b', 'a']))
    return lane.done()
})

run('an accepted event before restoration stays history-retaining through later writes', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    root.txn(transaction => {
        const child = transaction.scope(scopes.child)
        child.set(rows('b'), value(false, 1))
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'pre-clear first event keeps historical order', childHistory(historical, ['c', 'a']))
        child.reset(rows('b'))
        child.set(rows('c'), value(false, 2))
        check(transaction, 'post-clear later writes', childHistory(historical, ['b', 'a']))
    })
    check(undefined, 'commit', childHistory(historical, ['b', 'a']))
    return lane.done()
})

run('a later first event in a different scope still invalidates that scope independently', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    root.txn(transaction => {
        transaction.scope(scopes.parent).resetAll()
        check(transaction, 'restored', allRestored)
        transaction.scope(scopes.child).set(rows('b'), value(false, 1))
        check(transaction, 'child has consumed its first event', childHistory(historical, ['c', 'a']))
        const peer = transaction.scope(scopes.peer)
        peer.reset(rows('missing'))
        peer.set(rows('c'), value(false, 2))
        check(transaction, 'peer receives a separate later first event', {
            ...childHistory(historical, ['c', 'a']),
            peer: { rows: historical, active: ['b', 'a'] },
        })
        peer.reset(rows('c'))
        peer.delete(rows('b'))
        peer.reset(rows('b'))
        check(transaction, 'peer later birth retains its own history', {
            ...childHistory(historical, ['c', 'a']),
            peer: ['c', 'a', 'b'],
        })
    })
    check(undefined, 'commit', {
        ...childHistory(historical, ['c', 'a']),
        peer: ['c', 'a', 'b'],
    })
    return lane.done()
})

run('ordinary single-row reset retains existing append-order semantics without bulk restoration', () => {
    const lane = fixture()
    const { rows, root, scopes, warm, check } = lane
    warm()
    const historicalParent = expected => ({ ...expected, parent: historical, peer: historical })
    root.txn(transaction => {
        const child = transaction.scope(scopes.child)
        child.delete(rows('b'))
        check(transaction, 'ordinary delete', historicalParent(childHistory(['c', 'a'])))
        child.reset(rows('b'))
        check(transaction, 'ordinary reset rebirth', historicalParent(childHistory(['c', 'a', 'b'])))
        child.set(rows('a'), value(false, 1))
        check(transaction, 'ordinary later neutral write', historicalParent(childHistory(['c', 'a', 'b'], ['c', 'b'])))
    })
    check(undefined, 'ordinary commit', historicalParent(childHistory(['c', 'a', 'b'], ['c', 'b'])))
    return lane.done()
})

console.log(JSON.stringify({ target, entry, runtime: process.versions.bun || process.versions.node, results }, null, 2))
process.exitCode = results.every(result => result.pass) ? 0 : 1
