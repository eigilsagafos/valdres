window.BENCHMARK_DATA = {
  "lastUpdate": 1775324199305,
  "repoUrl": "https://github.com/eigilsagafos/valdres",
  "entries": {
    "valdres benchmarks": [
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "6bf6778bcf75e9711141ff248a865278b668d2b9",
          "message": "Add CI benchmark suite comparing valdres vs jotai (#19)\n\n* Add CI benchmark suite comparing valdres vs jotai\n\nAdds performance benchmarks using mitata that run in GitHub Actions,\nfail on regressions, update a comparison table in README, and publish\nhistorical trends to GitHub Pages.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Create gh-pages branch if missing in benchmark workflow\n\nThe github-action-benchmark action requires the gh-pages branch to\nexist before it can push results. This adds a step to create it\non first run.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Move git config before gh-pages branch creation step\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix checkout after gh-pages creation using explicit SHA\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Split JSON generation from README update to avoid dirty working tree\n\nThe benchmark action switches to gh-pages internally and fails if\nREADME.md is modified. Now: generate JSON first, run the action,\nthen update README after.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address PR review feedback\n\n- Guard gh-pages creation to main-only pushes\n- Add pull-requests: write permission for comment-on-alert\n- Clean gh-pages orphan branch properly with git rm -rf\n- Run bench files serially (--concurrency 1) to prevent ndjson corruption\n- Clean stale ndjson before each bench run\n- Fix misleading \"set(atom, same)\" label — now tests actual new values\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-02T13:32:15-07:00",
          "tree_id": "8b95497023178eb2c51d6f1ea64cff6e60821446",
          "url": "https://github.com/eigilsagafos/valdres/commit/6bf6778bcf75e9711141ff248a865278b668d2b9"
        },
        "date": 1775161984923,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai: 54ns (15.2x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 82ns (2.0x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 725,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 724,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 708,
            "unit": "ns",
            "extra": "jotai: 450ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 645,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9214,
            "unit": "ns",
            "extra": "jotai: 7.9µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 83507,
            "unit": "ns",
            "extra": "jotai: 65.4µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6927,
            "unit": "ns",
            "extra": "jotai: 5.4µs (1.3x slower)"
          },
          {
            "name": "createStore",
            "value": 596,
            "unit": "ns",
            "extra": "jotai: 205ns (2.9x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 76816,
            "unit": "ns",
            "extra": "jotai: 293.0µs (3.8x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10822,
            "unit": "ns",
            "extra": "jotai: 73.5µs (6.8x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 253,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "a9dce4bf09cbd7d0504ed29762f2147fe757842c",
          "message": "Replace benchmark alerting with scale-aware regression checker (#23)\n\n* Replace single-threshold benchmark alerting with scale-aware regression checker\n\nThe built-in github-action-benchmark alerting used a single threshold for\nall tests, causing false positives on sub-nanosecond benchmarks (e.g.\nobj.value=n going from 1ns to 2ns). The new custom script compares against\nthe median of the last 10 runs and uses tiered thresholds based on the\nmagnitude of each benchmark.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Redesign PR comment table: valdres vs jotai side-by-side, skip baselines\n\nRead from ndjson directly to get both valdres and jotai timings. The table\nnow shows each benchmark with both libraries side by side, a \"vs Jotai\"\ncolumn, and the regression check columns. Baseline JS ops (plain object,\nMap) are excluded from the table entirely.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: robust comment posting, generated threshold table\n\n- Wrap postOrUpdateComment in try/catch so API failures don't fail the\n  regression check\n- Add per_page=100, res.ok and Array.isArray guards\n- Generate the threshold tiers table from the TIERS config to avoid drift\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:10:17-07:00",
          "tree_id": "c7c33fb522cd311a25bff210452c2fdc5ccbdc9c",
          "url": "https://github.com/eigilsagafos/valdres/commit/a9dce4bf09cbd7d0504ed29762f2147fe757842c"
        },
        "date": 1775229070335,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (17.4x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 43,
            "unit": "ns",
            "extra": "jotai: 83ns (1.9x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 702,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 693,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.8x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 687,
            "unit": "ns",
            "extra": "jotai: 477ns (1.4x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 51,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 16,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 667,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1195,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9149,
            "unit": "ns",
            "extra": "jotai: 7.9µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 81230,
            "unit": "ns",
            "extra": "jotai: 65.4µs (1.2x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6595,
            "unit": "ns",
            "extra": "jotai: 5.5µs (1.2x slower)"
          },
          {
            "name": "createStore",
            "value": 631,
            "unit": "ns",
            "extra": "jotai: 211ns (3.0x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 76921,
            "unit": "ns",
            "extra": "jotai: 251.8µs (3.3x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10857,
            "unit": "ns",
            "extra": "jotai: 74.1µs (6.8x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 254,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.2x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "9028f92667ce3bd6d3b7f8b40585a3fca51aff3b",
          "message": "Re-evaluate pending-promise selectors on dependency change (#21)\n\n* Re-evaluate pending-promise selectors on dependency change\n\nInstead of skipping unsubscribed pending-promise selectors during\npropagation (which left stale cached values), always re-evaluate them.\nRe-evaluation is cheap for async selectors since the actual work is\ndeferred to the promise. The old promise's .then() handler bails via\nthe existing reference guard (data.values.get(selector) !== oldPromise).\n\nThis replaces the dirty-marker approach (dirtySelectorsPendingPromise\nWeakSet) with a simpler structural fix: pending-promise selectors go\nthrough the re-evaluate path instead of the expire path, so no new\nmutable state is needed.\n\nEnables 3 more jotai compat tests:\n- \"should update async atom with delay (#1813)\"\n- \"async atom with subtle timing > case 2\"\n- \"can get async atom with deps more than once before resolving (#1668)\"\n\n57 pass, 44 todo, 0 fail (was 54/47/0)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Fix comments: use \"promise-valued\" instead of \"pending-promise\"\n\nisPromiseLike cannot distinguish pending from settled promises,\nso the comments should not imply otherwise.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:31:04-07:00",
          "tree_id": "ca372450360758fa1985dee04db55bfa107c0d8a",
          "url": "https://github.com/eigilsagafos/valdres/commit/9028f92667ce3bd6d3b7f8b40585a3fca51aff3b"
        },
        "date": 1775230319003,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 69ns (13.9x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 32,
            "unit": "ns",
            "extra": "jotai: 94ns (3.0x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 758,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 779,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 693,
            "unit": "ns",
            "extra": "jotai: 483ns (1.4x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 3,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 53,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 731,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9692,
            "unit": "ns",
            "extra": "jotai: 9.2µs (1.0x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 75945,
            "unit": "ns",
            "extra": "jotai: 71.1µs (1.1x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6040,
            "unit": "ns",
            "extra": "jotai: 6.1µs (1.0x faster)"
          },
          {
            "name": "createStore",
            "value": 661,
            "unit": "ns",
            "extra": "jotai: 233ns (2.8x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 74493,
            "unit": "ns",
            "extra": "jotai: 259.5µs (3.5x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 11422,
            "unit": "ns",
            "extra": "jotai: 81.6µs (7.1x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 270,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.5x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "e0b9d7abf8d27124108312e132ab3843e4e593e6",
          "message": "Optimize store creation: 6x faster with lazy WeakMaps (#22)\n\n* Optimize store creation with lazy WeakMaps and cheap IDs\n\nTwo changes to createStoreData that make store() 6x faster:\n\n1. Lazy WeakMap initialization via shared prototype with self-replacing\n   getters. Only `values` (always needed) is created eagerly. The other\n   5 WeakMaps are created on first access, then the getter replaces\n   itself with a direct property (zero overhead after init).\n\n2. Replace Math.random().toString(36) ID generation (~150ns) with a\n   sequential counter (~0ns). The ID is only used for identity comparison,\n   not as a human-readable or cross-process unique string.\n\nNote: prototype-based lazy properties are visible via `in` operator\neven before initialization. No current code checks lazy properties\nwith `in` (only `\"parent\" in data` for scope detection).\n\nBefore: createStore 450ns (3.7x slower than jotai)\nAfter:  createStore  78ns (1.5x faster than jotai)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review: prefix generated store IDs and use Object.prototype\n\n- Prefix auto-generated IDs with \"__valdres_store_\" to prevent collision\n  with user-provided store/scope IDs (which are compared in globalAtom.ts)\n- Use Object.create(Object.prototype) instead of Object.create(null) so\n  store data objects retain standard Object methods\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T08:44:56-07:00",
          "tree_id": "511bae0accc47d1c0e60c84863deea6e976f25e6",
          "url": "https://github.com/eigilsagafos/valdres/commit/e0b9d7abf8d27124108312e132ab3843e4e593e6"
        },
        "date": 1775231144206,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 4,
            "unit": "ns",
            "extra": "jotai: 59ns (15.4x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 86ns (2.1x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 697,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 732,
            "unit": "ns",
            "extra": "jotai: 1.3µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 704,
            "unit": "ns",
            "extra": "jotai: 453ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 668,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1202,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9765,
            "unit": "ns",
            "extra": "jotai: 7.8µs (1.2x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 85682,
            "unit": "ns",
            "extra": "jotai: 64.0µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6700,
            "unit": "ns",
            "extra": "jotai: 5.5µs (1.2x slower)"
          },
          {
            "name": "createStore",
            "value": 151,
            "unit": "ns",
            "extra": "jotai: 203ns (1.3x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 83362,
            "unit": "ns",
            "extra": "jotai: 268.3µs (3.2x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10014,
            "unit": "ns",
            "extra": "jotai: 75.6µs (7.6x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 238,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "83e46c4f14d8f7371fc4d3985589fbb9472f189e",
          "message": "Reject async selectors in core, wrap in jotai compat layer (#26)\n\n* Wrap store.get for async atoms to match jotai Promise semantics\n\nJotai always returns Promises for async atoms, even after resolution.\nValdres unwraps resolved values. The compat layer now tags async\nselectors and re-wraps resolved values in Promise.resolve() on get.\n\nEnables 2 more compat tests:\n- handles complex dependency chains\n- should not inf on subscribe or unsubscribe\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Reject async functions in selector() to prevent inconsistent return types\n\nAsync functions always return Promises, but valdres unwraps resolved\nvalues. This causes store.get() to return Promise on first call, then\nthe unwrapped value on subsequent calls — an inconsistent return type.\n\nSync functions returning Promises are still allowed and work correctly\nwith valdres's unwrap-on-resolve semantics.\n\nThe jotai compat layer wraps async read functions into sync wrappers\nbefore passing them to valdresSelector.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review: robust async detection, specific error assertion, deduplicate isPromiseLike\n\n- Use Object.prototype.toString.call instead of constructor.name for\n  async function detection (resilient to minification/realms)\n- Assert specific error message in test with toThrow(/async/i)\n- Import isPromiseLike from valdres instead of duplicating in compat\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T09:46:25-07:00",
          "tree_id": "251980b8247db6dc6ad7c743d7a5e9445454116b",
          "url": "https://github.com/eigilsagafos/valdres/commit/83e46c4f14d8f7371fc4d3985589fbb9472f189e"
        },
        "date": 1775234837806,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 57ns (20.3x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 40,
            "unit": "ns",
            "extra": "jotai: 83ns (2.1x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 698,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 710,
            "unit": "ns",
            "extra": "jotai: 1.2µs (1.7x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 681,
            "unit": "ns",
            "extra": "jotai: 435ns (1.6x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 51,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 2,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 720,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1391,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 9739,
            "unit": "ns",
            "extra": "jotai: 7.5µs (1.3x slower)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 81544,
            "unit": "ns",
            "extra": "jotai: 63.4µs (1.3x slower)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 6703,
            "unit": "ns",
            "extra": "jotai: 5.3µs (1.3x slower)"
          },
          {
            "name": "createStore",
            "value": 146,
            "unit": "ns",
            "extra": "jotai: 203ns (1.4x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 81322,
            "unit": "ns",
            "extra": "jotai: 254.3µs (3.1x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 10213,
            "unit": "ns",
            "extra": "jotai: 72.9µs (7.1x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 231,
            "unit": "ns",
            "extra": "jotai: 990ns (4.3x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "334397d17bc821f3c68a472ed2ebfc25717ef68a",
          "message": "Optimize selector propagation and store.get hot path (#25)\n\n* Optimize selector propagation and store.get hot path\n\n- store.get: fast-path cache hit via data.values.has(); reuse per-store\n  Set<Atom> instead of allocating a new one per call\n- evaluateSelector: track deps in array, skip dependency diff when deps\n  are unchanged (common case); reuse shared WeakSet for circular dep check\n- setValueInData: skip deepFreeze for primitives (immutable by nature)\n- propagateDirtySelectors: eliminate redundant Set clone, use size check\n  instead of symmetricDifference\n\nSelectors go from 1.2x slower than jotai to 1.2-1.6x faster.\nset(atom) improves ~1.8x, store.get(atom) improves ~1.4x.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback with regression tests\n\n- storeFromStoreData: wrap getState in try/finally to clear reusable\n  _initSet on error, preventing stale atoms from leaking to next get()\n- setValueInData: include functions in deepFreeze check (typeof function)\n  so function values with own properties remain frozen in dev mode\n- propagateUpdatedAtoms: remove stale console.log TODO — the detected\n  case (atoms initialized during propagation) is benign since newly-init'd\n  atoms cannot have pre-existing dependents\n- Add regression test for function value freezing\n- Add defensive test for stale _initSet after selector throw\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T09:48:39-07:00",
          "tree_id": "43f65432511aa5188e3387438225b0a031032078",
          "url": "https://github.com/eigilsagafos/valdres/commit/334397d17bc821f3c68a472ed2ebfc25717ef68a"
        },
        "date": 1775234971232,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (17.8x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 91ns (2.5x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 286,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.2x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 300,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.1x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 690,
            "unit": "ns",
            "extra": "jotai: 445ns (1.5x slower)"
          },
          {
            "name": "obj.value",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 3,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 50,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 19,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1233,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5267,
            "unit": "ns",
            "extra": "jotai: 9.3µs (1.8x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 46918,
            "unit": "ns",
            "extra": "jotai: 65.0µs (1.4x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4407,
            "unit": "ns",
            "extra": "jotai: 5.3µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 168,
            "unit": "ns",
            "extra": "jotai: 218ns (1.3x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 80284,
            "unit": "ns",
            "extra": "jotai: 243.8µs (3.0x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 9609,
            "unit": "ns",
            "extra": "jotai: 75.6µs (7.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 258,
            "unit": "ns",
            "extra": "jotai: 1.1µs (4.1x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "796b2b9e08bce7458981283415e3126554d2c095",
          "message": "Optimize atomFamily/selectorFamily and add creation benchmarks (#27)\n\n* Optimize atomFamily/selectorFamily creation and add benchmarks\n\n- createAtomFamily: inline createOptions + atomFamilyAtom into single\n  object allocation; hoist isSelectorFamily/typeof checks to family\n  creation time (289ns → 200ns, flips from 1.3x slower to 1.1x faster)\n- selectorFamily: same inlining — bypass intermediate createOptions and\n  selector() allocations, build selector object directly\n- selector: use cheaper async function detection\n  (constructor.name vs Object.prototype.toString.call)\n- Add selector(fn) creation benchmark (6.7x faster than jotai)\n- Add selectorFamily(id) creation benchmark (1.1x faster than jotai)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Remove unused imports in benchmark files\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T10:11:00-07:00",
          "tree_id": "98b22c256aef4f80a7c3c32bd5a1a94ff6e3d2b8",
          "url": "https://github.com/eigilsagafos/valdres/commit/796b2b9e08bce7458981283415e3126554d2c095"
        },
        "date": 1775236333126,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 68ns (14.9x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 28,
            "unit": "ns",
            "extra": "jotai: 97ns (3.4x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 331,
            "unit": "ns",
            "extra": "jotai: 1.2µs (3.6x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 305,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.1x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai: 453ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 309,
            "unit": "ns",
            "extra": "jotai: 441ns (1.4x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 15,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 8,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 98,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 432,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1470,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 10,
            "unit": "ns",
            "extra": "jotai: 73ns (7.7x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6306,
            "unit": "ns",
            "extra": "jotai: 10.8µs (1.7x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55762,
            "unit": "ns",
            "extra": "jotai: 80.5µs (1.4x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5151,
            "unit": "ns",
            "extra": "jotai: 6.0µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 329,
            "unit": "ns",
            "extra": "jotai: 246ns (1.3x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 84251,
            "unit": "ns",
            "extra": "jotai: 357.2µs (4.2x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7327,
            "unit": "ns",
            "extra": "jotai: 131.3µs (17.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 288,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.2x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "1f2f0573322c547314cb420cf6257d305cf7d356",
          "message": "Fix atom(value, writeFn) handling and enable React tree dependencies test (#28)\n\n* Fix atom(value, writeFn) handling and enable React tree dependencies test\n\nHandle writable primitive atoms (atom(value, writeFn)) by creating a\nselector with a constant read function instead of a plain atom, so\ncreateStoreWithSelectorSet properly handles the write method.\n\nAlso removes the get.length === 1 guard so write-only atoms like\natom((get) => ..., writeFn) work regardless of arity.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Support writable primitive atoms with backing atom and enable 3 React tests\n\natom(value, writeFn) now uses a backing valdres atom for mutable storage,\nwith a selector that reads from it. Self-sets are intercepted and redirected\nto the backing atom, fixing infinite recursion for self-referencing writes.\n\nNewly passing tests:\n- uses an async write-only atom\n- uses a writable atom without read function\n- write self atom (undocumented usage)\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-03T10:16:45-07:00",
          "tree_id": "13df948cff6f79a6ede47e2709c9affe37469264",
          "url": "https://github.com/eigilsagafos/valdres/commit/1f2f0573322c547314cb420cf6257d305cf7d356"
        },
        "date": 1775236667265,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 57ns (17.1x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 89ns (2.5x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 273,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.5x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai: 1.3µs (4.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 356,
            "unit": "ns",
            "extra": "jotai: 470ns (1.3x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 427,
            "unit": "ns",
            "extra": "jotai: 1.1µs (2.6x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 119,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 430,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1253,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai: 60ns (11.2x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6438,
            "unit": "ns",
            "extra": "jotai: 9.6µs (1.5x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 52344,
            "unit": "ns",
            "extra": "jotai: 92.2µs (1.8x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4884,
            "unit": "ns",
            "extra": "jotai: 5.8µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 207,
            "unit": "ns",
            "extra": "jotai: 217ns (1.0x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 92555,
            "unit": "ns",
            "extra": "jotai: 339.4µs (3.7x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7383,
            "unit": "ns",
            "extra": "jotai: 108.6µs (14.7x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 288,
            "unit": "ns",
            "extra": "jotai: 1.1µs (3.8x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "3db9468fc489b9dc6fb5648d05a24bf900522750",
          "message": "Add dependency-aware onMount/onUnmount lifecycle hooks (#30)\n\n* Add dependency-aware onMount/onUnmount lifecycle hooks\n\nPreviously, onMount only fired when store.sub() was called directly on an\natom. Now onMount fires when an atom becomes a transitive dependency of any\nsubscribed selector, and onUnmount fires when it's no longer reachable.\n\nThis enables patterns like starting a WebSocket when data is \"in use\" and\nstopping when it isn't, matching how jotai's mount/unmount system works.\n\nCore changes:\n- Add data.mounts WeakMap to track mounted atoms and cleanup functions\n- Add mountAtom.ts with helpers for transitive mount/unmount\n- subscribe.ts calls mountTransitiveDeps on first subscriber\n- unsubscribe.ts calls unmountOrphanedDeps when last subscriber leaves\n- propagateUpdatedAtoms processes dependency changes during re-evaluation\n- evaluateSelector exposes added/removed deps via optional out-params\n- createStoreWithSelectorSet stores storeRef on data for onMount callbacks\n- Fix reentrant mount by marking atom as mounted before calling onMountFn\n\nJotai compat changes:\n- atom.ts uses onMount getter/setter to convert jotai signature at\n  assignment time (not during store.sub), enabling propagation-time mounts\n- createStore.ts simplified (no longer needs temporary onMount swap)\n\nNewly passing jotai tests (4):\n- should recompute dependents' state after onMount (#2098)\n- should mount once with atom creator atom (#2314)\n- Unmount an atom that is no longer dependent (#2658)\n- should use the correct pending on unmount\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address review: error resilience in mount/unmount and type fixes\n\n- mountAtom: clean up data.mounts entry if onMountFn throws\n- unmountAtom: delete entry before calling cleanup to prevent stuck state\n- subscribe.ts: guard mountTransitiveDeps with !isFamily check\n- unsubscribe.ts: cast state to State<V> for unmountOrphanedDeps\n- Add storeRef to RootStoreData type, remove @ts-ignore\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:22:19-07:00",
          "tree_id": "8b400c735fd97b37f8456d206a6389bbc1aa4ea2",
          "url": "https://github.com/eigilsagafos/valdres/commit/3db9468fc489b9dc6fb5648d05a24bf900522750"
        },
        "date": 1775323404455,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 3,
            "unit": "ns",
            "extra": "jotai: 54ns (15.5x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 36,
            "unit": "ns",
            "extra": "jotai: 92ns (2.6x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 280,
            "unit": "ns",
            "extra": "jotai: 1.2µs (4.3x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 301,
            "unit": "ns",
            "extra": "jotai: 1.3µs (4.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 373,
            "unit": "ns",
            "extra": "jotai: 464ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 345,
            "unit": "ns",
            "extra": "jotai: 464ns (1.3x faster)"
          },
          {
            "name": "obj.value",
            "value": 5,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 129,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 18,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 472,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1951,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 67ns (11.4x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6458,
            "unit": "ns",
            "extra": "jotai: 12.7µs (2.0x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 55159,
            "unit": "ns",
            "extra": "jotai: 83.5µs (1.5x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5846,
            "unit": "ns",
            "extra": "jotai: 6.9µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 405,
            "unit": "ns",
            "extra": "jotai: 249ns (1.6x slower)"
          },
          {
            "name": "set 1000 atoms",
            "value": 91579,
            "unit": "ns",
            "extra": "jotai: 421.1µs (4.6x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 7760,
            "unit": "ns",
            "extra": "jotai: 154.6µs (19.9x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 407,
            "unit": "ns",
            "extra": "jotai: 1.2µs (3.0x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2f28885b68f18d0c0110df7695ce82b806359073",
          "message": "Optimize transaction performance and add benchmarks (#29)\n\n* Optimize transaction performance and add transaction benchmarks\n\n- Eager _atomMap creation in Transaction constructor (eliminates lazy\n  getter overhead on every set/get call)\n- Skip deepFreeze for primitives in txn.set(), add Object.isFrozen()\n  early return in deepFreeze to avoid double-freeze at commit time\n- Eliminate Set/array spread allocations in setAtoms()\n- Remove unused isProd import from transaction\n- Add transaction benchmarks: single-atom selectors and cross-atom\n  selectors (with and without subscribers)\n\nCross-atom selectors with subscribers show 5x speedup over jotai,\ndemonstrating the batching advantage of transactions.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Harden deepFreeze and fix benchmark nits\n\n- Add primitive type guard before WeakSet.has() to make deepFreeze safe\n  for any input type\n- Reorder checks: null/undefined → primitive → seen/frozen\n- Use forEach instead of map for side-effect-only subscription setup\n  in benchmarks\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:30:04-07:00",
          "tree_id": "58abe0930bb7ca909a7568f41e50c7b622d89462",
          "url": "https://github.com/eigilsagafos/valdres/commit/2f28885b68f18d0c0110df7695ce82b806359073"
        },
        "date": 1775323877390,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai: 45ns (18.7x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 29,
            "unit": "ns",
            "extra": "jotai: 78ns (2.7x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 223,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.6x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 221,
            "unit": "ns",
            "extra": "jotai: 1.0µs (4.6x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 361,
            "unit": "ns",
            "extra": "jotai: 444ns (1.2x faster)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 265,
            "unit": "ns",
            "extra": "jotai: 435ns (1.6x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 104,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 401,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1447,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 53ns (8.7x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 5090,
            "unit": "ns",
            "extra": "jotai: 9.3µs (1.8x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 42149,
            "unit": "ns",
            "extra": "jotai: 74.7µs (1.8x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4875,
            "unit": "ns",
            "extra": "jotai: 5.6µs (1.2x faster)"
          },
          {
            "name": "createStore",
            "value": 165,
            "unit": "ns",
            "extra": "jotai: 194ns (1.2x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 65177,
            "unit": "ns",
            "extra": "jotai: 319.8µs (4.9x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 6074,
            "unit": "ns",
            "extra": "jotai: 131.7µs (21.7x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 271,
            "unit": "ns",
            "extra": "jotai: 938ns (3.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 54592,
            "unit": "ns",
            "extra": "jotai: 74.2µs (1.4x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 59829,
            "unit": "ns",
            "extra": "jotai: 203.6µs (3.4x faster)"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 476530,
            "unit": "ns",
            "extra": "jotai: 978.8µs (2.1x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 550694,
            "unit": "ns",
            "extra": "jotai: 1.51ms (2.7x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 690282,
            "unit": "ns",
            "extra": "jotai: 6.10ms (8.8x faster)"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "eigil@sagafos.no",
            "name": "Eigil Sagafos",
            "username": "eigilsagafos"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "08ddfe4359b6951ce69ac7b3b5ad6770163601c3",
          "message": "Improve benchmark fairness and upgrade Jotai (#31)\n\n* Improve benchmark fairness and upgrade Jotai to v2.19.0\n\n- Upgrade Jotai 2.10.0 -> 2.19.0 to benchmark against latest\n- Randomize measurement order to eliminate systematic ordering bias\n- Use median (p50) instead of avg for outlier resistance\n- Add \"set with subscribers\" and \"atom lifecycle\" benchmarks for realism\n- Add atomFamily cache-hit benchmark (honestly shows Jotai is faster)\n- Separate high-threshold benchmarks into \"Optimization targets\" section\n- Show Jotai version in README footer\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n* Address Copilot review feedback\n\n- Use deterministic name-based hash instead of Math.random() for measurement order\n- Use distinct callback functions per subscriber to avoid deduplication\n- Only catch ENOENT when probing for Jotai version, rethrow other errors\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\n\n---------\n\nCo-authored-by: Claude Opus 4.6 <noreply@anthropic.com>",
          "timestamp": "2026-04-04T10:35:24-07:00",
          "tree_id": "03d10fb6490fffa0cca624604a274adc7fb4a801",
          "url": "https://github.com/eigilsagafos/valdres/commit/08ddfe4359b6951ce69ac7b3b5ad6770163601c3"
        },
        "date": 1775324198609,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 2,
            "unit": "ns",
            "extra": "jotai: 41ns (21.6x faster)"
          },
          {
            "name": "store.get(atom)",
            "value": 30,
            "unit": "ns",
            "extra": "jotai: 291ns (9.7x faster)"
          },
          {
            "name": "set(atom, value)",
            "value": 190,
            "unit": "ns",
            "extra": "jotai: 1.7µs (9.1x faster)"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 211,
            "unit": "ns",
            "extra": "jotai: 2.4µs (11.2x faster)"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 431,
            "unit": "ns",
            "extra": "jotai: 3.0µs (7.0x faster)"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 22349,
            "unit": "ns",
            "extra": "jotai: 227.2µs (10.2x faster)"
          },
          {
            "name": "atomFamily(id)",
            "value": 261,
            "unit": "ns",
            "extra": "jotai: 413ns (1.6x faster)"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 41,
            "unit": "ns",
            "extra": "jotai: 9ns (4.8x slower)"
          },
          {
            "name": "selectorFamily(id)",
            "value": 277,
            "unit": "ns",
            "extra": "jotai: 409ns (1.5x faster)"
          },
          {
            "name": "obj.value",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key)",
            "value": 13,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get",
            "value": 7,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 278,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n",
            "value": 4,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n)",
            "value": 14,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set",
            "value": 181,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 1953,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 6,
            "unit": "ns",
            "extra": "jotai: 50ns (8.9x faster)"
          },
          {
            "name": "set + read 10 selectors",
            "value": 4833,
            "unit": "ns",
            "extra": "jotai: 25.4µs (5.3x faster)"
          },
          {
            "name": "set + read 100 selectors",
            "value": 35413,
            "unit": "ns",
            "extra": "jotai: 215.9µs (6.1x faster)"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 4200,
            "unit": "ns",
            "extra": "jotai: 11.7µs (2.8x faster)"
          },
          {
            "name": "createStore",
            "value": 428,
            "unit": "ns",
            "extra": "jotai: 5.1µs (12.0x faster)"
          },
          {
            "name": "set 1000 atoms",
            "value": 63415,
            "unit": "ns",
            "extra": "jotai: 759.3µs (12.0x faster)"
          },
          {
            "name": "get 1000 atoms",
            "value": 6013,
            "unit": "ns",
            "extra": "jotai: 285.2µs (47.4x faster)"
          },
          {
            "name": "sub + unsub",
            "value": 733,
            "unit": "ns",
            "extra": "jotai: 2.1µs (2.8x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 47192,
            "unit": "ns",
            "extra": "jotai: 214.0µs (4.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 84117,
            "unit": "ns",
            "extra": "jotai: 461.8µs (5.5x faster)"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 436810,
            "unit": "ns",
            "extra": "jotai: 2.39ms (5.5x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 515018,
            "unit": "ns",
            "extra": "jotai: 3.18ms (6.2x faster)"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 623431,
            "unit": "ns",
            "extra": "jotai: 16.75ms (26.9x faster)"
          }
        ]
      }
    ]
  }
}