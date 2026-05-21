window.BENCHMARK_DATA = {
  "lastUpdate": 1779397486206,
  "repoUrl": "https://github.com/eigilsagafos/valdres",
  "entries": {
    "valdres benchmarks": [
      {
        "commit": {
          "author": {
            "name": "Eigil Sagafos",
            "username": "eigilsagafos",
            "email": "eigil@sagafos.no"
          },
          "committer": {
            "name": "GitHub",
            "username": "web-flow",
            "email": "noreply@github.com"
          },
          "id": "e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e",
          "message": "Stabilize benchmarks with paired per-batch measurement (#120)\n\nThe atomFamily cache-hit assertion was flaking on CI (5.1× vs 5.0× threshold\non PR #119, despite the PR not touching the hot path). Root cause: each\nside was measured back-to-back for 1.5s in a fixed order. A noisy CPU\nwindow during one side's run would shift its median 2× while the other\nran clean, blowing the ratio up even when neither implementation changed.\nIQR trimming only handles transient outliers; sustained pressure across\nthe whole window stays in the distribution.\n\nReplaces the back-to-back model with paired per-batch sampling:\nalternating ~30µs batches of valdres and competitor share the same ~60µs\nnoise window, so CPU stalls hit numerator and denominator together and\ncancel out of the ratio. Sample count is sized by a 50ms wall-clock\nbudget — fast benchmarks get 1000+ pairs, slow ones get the 50-sample\nfloor.\n\nSide effects:\n\n- CI bench job ~3× faster (20s vs ~66s of measurement budget on main).\n- Per-side numbers will shift on most benchmarks since pairing removes\n  noise that was biasing toward valdres on the old methodology\n  (store.get(atom) is the biggest mover; cache-hit basically unchanged).\n  Marketing numbers in README/BENCHMARKS.md will regenerate on first\n  main merge. Consider triggering the `reset_baseline` workflow input\n  to purge stale historical CV data — dynamic regression thresholds in\n  check-bench-regression.ts use that history.",
          "timestamp": "2026-05-21T20:52:10Z",
          "url": "https://github.com/eigilsagafos/valdres/commit/e4dbc313d2f879e3eeea9df4b2f0a1e7ef5c510e"
        },
        "date": 1779397144231,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 5,
            "unit": "ns",
            "extra": "jotai=61 ratio=0.0821 12.2x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=340 ratio=0.0379 26.4x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 332,
            "unit": "ns",
            "extra": "jotai=4292 ratio=0.0767 13.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 344,
            "unit": "ns",
            "extra": "jotai=6559 ratio=0.0567 17.6x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 206,
            "unit": "ns",
            "extra": "jotai=3441 ratio=0.0616 16.2x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 17032,
            "unit": "ns",
            "extra": "jotai=262191 ratio=0.0649 15.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 289,
            "unit": "ns",
            "extra": "jotai=405 ratio=0.7027 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.3854 2.4x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 304,
            "unit": "ns",
            "extra": "jotai=423 ratio=0.7228 1.4x faster"
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
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 345,
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
            "value": 188,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3037,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 8,
            "unit": "ns",
            "extra": "jotai=67 ratio=0.0968 10.3x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 6658,
            "unit": "ns",
            "extra": "jotai=24406 ratio=0.2731 3.7x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 59361,
            "unit": "ns",
            "extra": "jotai=247113 ratio=0.2392 4.2x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 5967,
            "unit": "ns",
            "extra": "jotai=12999 ratio=0.4529 2.2x faster"
          },
          {
            "name": "createStore",
            "value": 238,
            "unit": "ns",
            "extra": "jotai=5936 ratio=0.0401 24.9x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 106539,
            "unit": "ns",
            "extra": "jotai=929484 ratio=0.1151 8.7x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 9017,
            "unit": "ns",
            "extra": "jotai=385020 ratio=0.0215 46.4x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1184,
            "unit": "ns",
            "extra": "jotai=3680 ratio=0.3114 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 86391,
            "unit": "ns",
            "extra": "jotai=291044 ratio=0.2920 3.4x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 135844,
            "unit": "ns",
            "extra": "jotai=546903 ratio=0.2393 4.2x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 948093,
            "unit": "ns",
            "extra": "jotai=3388137 ratio=0.2825 3.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 882470,
            "unit": "ns",
            "extra": "jotai=3579976 ratio=0.2463 4.1x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1361226,
            "unit": "ns",
            "extra": "jotai=18830237 ratio=0.0722 13.8x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 143488,
            "unit": "ns",
            "extra": "jotai=288279 ratio=0.4918 2.0x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 97783,
            "unit": "ns",
            "extra": "jotai=293569 ratio=0.3361 3.0x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 925897,
            "unit": "ns",
            "extra": "jotai=1395309 ratio=0.6499 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1133370,
            "unit": "ns",
            "extra": "jotai=1836906 ratio=0.6078 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1372502,
            "unit": "ns",
            "extra": "jotai=13216428 ratio=0.1059 9.4x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 43,
            "unit": "ns",
            "extra": "jotai=57 ratio=0.7768 1.3x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8226,
            "unit": "ns",
            "extra": "jotai=14272 ratio=0.5755 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81598,
            "unit": "ns",
            "extra": "jotai=129703 ratio=0.6294 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4418,
            "unit": "ns",
            "extra": "jotai=7157 ratio=0.6137 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 28,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5613 1.8x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 14,
            "unit": "ns",
            "extra": "jotai=156 ratio=0.0927 10.8x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 421,
            "unit": "ns",
            "extra": "jotai=1248 ratio=0.3360 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 298,
            "unit": "ns",
            "extra": "jotai=1468 ratio=0.2026 4.9x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 489,
            "unit": "ns",
            "extra": "jotai=1712 ratio=0.2823 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 31454,
            "unit": "ns",
            "extra": "jotai=143664 ratio=0.2174 4.6x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 166,
            "unit": "ns",
            "extra": "jotai=561 ratio=0.2956 3.4x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 80640,
            "unit": "ns",
            "extra": "jotai=488784 ratio=0.1651 6.1x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15789,
            "unit": "ns",
            "extra": "jotai=206135 ratio=0.0764 13.1x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 815,
            "unit": "ns",
            "extra": "jotai=1401 ratio=0.5786 1.7x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 184,
            "unit": "ns",
            "extra": "jotai=227 ratio=0.8036 1.2x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=10 ratio=2.7060 2.7x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 167,
            "unit": "ns",
            "extra": "jotai=208 ratio=0.8022 1.2x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 203,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 269,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1406,
            "unit": "ns",
            "extra": "baseline"
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
          "id": "56672784b854fb15223426980c49fe7ee896fb2d",
          "message": "Fix benchmark README push from detached HEAD (#121)\n\nactions/checkout@v6 (upgraded in #110) checks out the workflow SHA in\ndetached HEAD state. Bare `git push` then fails with \"You are not\ncurrently on a branch\" — first observed on a manual workflow_dispatch\nrun. Push events on main happened to keep working, but the workflow\nis fragile either way.\n\nPush HEAD explicitly to main so the job works regardless of how it\nwas triggered.",
          "timestamp": "2026-05-21T14:03:43-07:00",
          "tree_id": "402d7cd7aefe27ca2989e197101d88e3b744e4a8",
          "url": "https://github.com/eigilsagafos/valdres/commit/56672784b854fb15223426980c49fe7ee896fb2d"
        },
        "date": 1779397485146,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "atom(1)",
            "value": 9,
            "unit": "ns",
            "extra": "jotai=76 ratio=0.1362 7.3x faster"
          },
          {
            "name": "store.get(atom)",
            "value": 13,
            "unit": "ns",
            "extra": "jotai=341 ratio=0.0371 27.0x faster"
          },
          {
            "name": "set(atom, value)",
            "value": 328,
            "unit": "ns",
            "extra": "jotai=4540 ratio=0.0716 14.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1)",
            "value": 371,
            "unit": "ns",
            "extra": "jotai=5339 ratio=0.0663 15.1x faster"
          },
          {
            "name": "set(atom) with 10 subs",
            "value": 390,
            "unit": "ns",
            "extra": "jotai=6046 ratio=0.0641 15.6x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set)",
            "value": 16526,
            "unit": "ns",
            "extra": "jotai=271881 ratio=0.0609 16.4x faster"
          },
          {
            "name": "atomFamily(id)",
            "value": 323,
            "unit": "ns",
            "extra": "jotai=426 ratio=0.7345 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=12 ratio=2.2501 2.3x slower"
          },
          {
            "name": "selectorFamily(id)",
            "value": 284,
            "unit": "ns",
            "extra": "jotai=383 ratio=0.7418 1.3x faster"
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
            "value": 12,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get",
            "value": 350,
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
            "value": 192,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set",
            "value": 3031,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "selector(fn)",
            "value": 7,
            "unit": "ns",
            "extra": "jotai=69 ratio=0.0922 10.8x faster"
          },
          {
            "name": "set + read 10 selectors",
            "value": 8757,
            "unit": "ns",
            "extra": "jotai=40296 ratio=0.2272 4.4x faster"
          },
          {
            "name": "set + read 100 selectors",
            "value": 63631,
            "unit": "ns",
            "extra": "jotai=204597 ratio=0.3076 3.3x faster"
          },
          {
            "name": "set + read through 5 chained selectors",
            "value": 7858,
            "unit": "ns",
            "extra": "jotai=15466 ratio=0.5075 2.0x faster"
          },
          {
            "name": "createStore",
            "value": 246,
            "unit": "ns",
            "extra": "jotai=5944 ratio=0.0408 24.5x faster"
          },
          {
            "name": "set 1000 atoms",
            "value": 109006,
            "unit": "ns",
            "extra": "jotai=967112 ratio=0.1136 8.8x faster"
          },
          {
            "name": "get 1000 atoms",
            "value": 8987,
            "unit": "ns",
            "extra": "jotai=357137 ratio=0.0252 39.7x faster"
          },
          {
            "name": "sub + unsub",
            "value": 1310,
            "unit": "ns",
            "extra": "jotai=3834 ratio=0.3141 3.2x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read",
            "value": 73790,
            "unit": "ns",
            "extra": "jotai=280682 ratio=0.2537 3.9x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs",
            "value": 136458,
            "unit": "ns",
            "extra": "jotai=597912 ratio=0.2050 4.9x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read",
            "value": 925240,
            "unit": "ns",
            "extra": "jotai=2748512 ratio=0.3291 3.0x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read",
            "value": 843670,
            "unit": "ns",
            "extra": "jotai=3056855 ratio=0.2762 3.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs",
            "value": 1104959,
            "unit": "ns",
            "extra": "jotai=18459931 ratio=0.0600 16.7x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, set + read [Node]",
            "value": 138222,
            "unit": "ns",
            "extra": "jotai=289096 ratio=0.4778 2.1x faster"
          },
          {
            "name": "txn: 10 atoms × 10 selectors, with subs [Node]",
            "value": 94809,
            "unit": "ns",
            "extra": "jotai=268403 ratio=0.3534 2.8x faster"
          },
          {
            "name": "txn: 10 atoms × 100 selectors, set + read [Node]",
            "value": 892658,
            "unit": "ns",
            "extra": "jotai=1362407 ratio=0.6520 1.5x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, set + read [Node]",
            "value": 1092015,
            "unit": "ns",
            "extra": "jotai=1748947 ratio=0.6214 1.6x faster"
          },
          {
            "name": "txn: cross-atom 1000 selectors, with subs [Node]",
            "value": 1103316,
            "unit": "ns",
            "extra": "jotai=11966024 ratio=0.1018 9.8x faster"
          },
          {
            "name": "selector(fn) [Node]",
            "value": 42,
            "unit": "ns",
            "extra": "jotai=62 ratio=0.7337 1.4x faster"
          },
          {
            "name": "set + read 10 selectors [Node]",
            "value": 8176,
            "unit": "ns",
            "extra": "jotai=13987 ratio=0.5844 1.7x faster"
          },
          {
            "name": "set + read 100 selectors [Node]",
            "value": 81835,
            "unit": "ns",
            "extra": "jotai=132090 ratio=0.6229 1.6x faster"
          },
          {
            "name": "set + read through 5 chained selectors [Node]",
            "value": 4346,
            "unit": "ns",
            "extra": "jotai=6996 ratio=0.6189 1.6x faster"
          },
          {
            "name": "atom(1) [Node]",
            "value": 27,
            "unit": "ns",
            "extra": "jotai=53 ratio=0.5158 1.9x faster"
          },
          {
            "name": "store.get(atom) [Node]",
            "value": 24,
            "unit": "ns",
            "extra": "jotai=164 ratio=0.1457 6.9x faster"
          },
          {
            "name": "set(atom, value) [Node]",
            "value": 427,
            "unit": "ns",
            "extra": "jotai=1253 ratio=0.3371 3.0x faster"
          },
          {
            "name": "set(atom, curr => curr+1) [Node]",
            "value": 287,
            "unit": "ns",
            "extra": "jotai=1497 ratio=0.1911 5.2x faster"
          },
          {
            "name": "set(atom) with 10 subs [Node]",
            "value": 501,
            "unit": "ns",
            "extra": "jotai=1746 ratio=0.2850 3.5x faster"
          },
          {
            "name": "atom lifecycle (create+100get+100set) [Node]",
            "value": 32281,
            "unit": "ns",
            "extra": "jotai=145580 ratio=0.2210 4.5x faster"
          },
          {
            "name": "createStore [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=539 ratio=0.3032 3.3x faster"
          },
          {
            "name": "set 1000 atoms [Node]",
            "value": 89269,
            "unit": "ns",
            "extra": "jotai=466943 ratio=0.1908 5.2x faster"
          },
          {
            "name": "get 1000 atoms [Node]",
            "value": 15775,
            "unit": "ns",
            "extra": "jotai=205374 ratio=0.0744 13.4x faster"
          },
          {
            "name": "sub + unsub [Node]",
            "value": 797,
            "unit": "ns",
            "extra": "jotai=1427 ratio=0.5577 1.8x faster"
          },
          {
            "name": "atomFamily(id) [Node]",
            "value": 164,
            "unit": "ns",
            "extra": "jotai=240 ratio=0.7293 1.4x faster"
          },
          {
            "name": "atomFamily(id) cache hit [Node]",
            "value": 60,
            "unit": "ns",
            "extra": "jotai=31 ratio=1.8971 1.9x slower"
          },
          {
            "name": "selectorFamily(id) [Node]",
            "value": 117,
            "unit": "ns",
            "extra": "jotai=169 ratio=0.6956 1.4x faster"
          },
          {
            "name": "obj.value [Node]",
            "value": 0,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.get(key) [Node]",
            "value": 9,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres get [Node]",
            "value": 17,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai get [Node]",
            "value": 199,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "obj.value = n [Node]",
            "value": 1,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "map.set(key, n) [Node]",
            "value": 6,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "valdres set [Node]",
            "value": 279,
            "unit": "ns",
            "extra": "baseline"
          },
          {
            "name": "jotai set [Node]",
            "value": 1383,
            "unit": "ns",
            "extra": "baseline"
          }
        ]
      }
    ]
  }
}