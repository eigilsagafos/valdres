# tx.onCommit: prior art and semantics

2026-10-09. Owner-approved experimental API, frozen revision 3. This records
the rationale for the narrow `tx.onCommit(callback): void` primitive and the
owner decisions below. `onRollback`, `onSuccess`,
`onFinally`, chaining and general event hooks remain out of scope.

## Prior art

The following primary documentation was consulted on 2026-10-09. These APIs support
the commit-hook concept; their timing, ownership and error policies are not interchangeable.

| API | Relevant precedent and distinction |
| --- | --- |
| [Django 5.2 `transaction.on_commit`](https://docs.djangoproject.com/en/5.2/topics/db/transactions/#performing-actions-after-commit) | Runs after successful commit, discards registrations on rollback, and preserves registration order. Outside an open transaction it runs immediately. Default callback errors stop later callbacks; `robust=True` logs errors and continues. Neither behavior defines Valdres's deferred host-error policy. |
| [Rails `ActiveRecord::Transaction`](https://api.rubyonrails.org/classes/ActiveRecord/Transaction.html#method-i-after_commit) | `after_commit` transfers nested registrations to the parent until the outermost commit, or drops them on rollback. It runs immediately when there is no transaction, but rejects registration on a finalized transaction. Callback failure cannot roll back an existing commit. Valdres scope cursors share one draft; they are not nested savepoints. |
| [Sequelize v6 `afterCommit`](https://sequelize.org/docs/v6/other-topics/transactions/#the-aftercommit-hook) | Supports transaction-local callbacks and excludes rollback. Its managed transaction or unmanaged `commit()` waits for async callbacks before settling. Valdres deliberately does not wait. |
| [Dexie transaction `complete`](https://dexie.org/docs/Transaction/Transaction.on.complete) | Documents `trans.on("complete", callback)` as an event-style completion hook. That surface is precedent for completion notification, not a reason to add a general emitter. This short page does not establish Valdres's lifetime, waiting or error policies. |

## Valdres policies

1. **Eligibility and lifetime are separate.** Commit makes a registration eligible;
   the registering cursor's scope can still cancel it through disposal before it
   starts. `tx.scope(root)` selects root lifetime without changing the enclosing
   draft's rollback boundary. See [Outcome and lifetime](../../packages/valdres/src/store.mdx#outcome-and-lifetime)
   for disposal between callbacks, already-started work and `resetAll` independence.
2. **Invocation is deferred.** Execution begins after settlement/notification
   restrictions unwind and the originating operation returns or throws. Transaction
   return does not await callbacks or their promises. See [Timing and ordering](../../packages/valdres/src/store.mdx#timing-and-ordering)
   for task yielding and the absence of a browser user-activation guarantee.
3. **FIFO orders starts.** It does not serialize async completion or wait for one
   returned promise before starting the next callback; the same timing section
   includes the serial-lane recipe.
4. **Delivery is in-memory.** At-most-once callback invocation in this runtime is
   not durable delivery or exactly-once external execution. Commit does not promise
   that a server persisted an effect; process loss can lose pending work.
5. **Application policies stay in helpers.** Latest-only channels, serial execution,
   retries/idempotency and outbox state machines remain outside core, as documented
   after the [serial-lane recipe](../../packages/valdres/src/store.mdx#timing-and-ordering).
6. **Host-error reporting is intentional policy.** Callback failure does not mean
   rollback, replace the originating error or stop later callback starts. The
   [error contract](../../packages/valdres/src/store.mdx#errors-and-inspection) describes
   reporting and its host consequences. The owner accepted this policy with
   revision 3; this note does not change it.
7. **Costs remain measured tradeoffs.** The bounded pinned Node 24.16.0/Bun 1.4.0
   binding comparison (preserved evidence below)
   measured revision 3's no-hook paired overhead at **2.45% Node / 2.48% Bun** over
   base, consistent with the reviewer's approximate 2–3%. These noisy measurements
   do not establish zero cost. The lazy alternatives were not adopted.

   Normal-host overload also has a cost: the reviewer's 300 ms `MessageChannel`
   producer experiment (three-run medians) recorded **363,910 scheduler timers for
   363,520 publications on Bun**, and **266,466 for 266,000 on Node** in revision 3.
   Roughly one timer per blocked publication was scheduled, nearly all inert;
   producer throughput was about **31% / 15% lower** than revision 1, respectively.
   Accumulation therefore also occurs on functioning hosts, not only when timers
   are withheld. There is no autonomous retry loop; these workload-specific counts
   are not universal latency bounds. The preserved reviewer report and revision-3
   handoff contain the raw-count provenance and scheduling explanation.

Prior art motivates the primitive; it does **not** prove that Valdres's bound-function
allocation or overload timer costs are necessary. The owner accepted these measured
costs, the documented callback/scope/inspection/error policies, and the exact approval proposal on 2026-10-09. The approximately 2.5%
figure is transaction-microbenchmark overhead, not application-wide overhead.
Neither getter experiment is adopted. Merging and publication remain unauthorized.

## Approved candidate and evidence

- Base: `603e94debfdb6a233737c22086f0804e6fa540b7`.
- Frozen revision-3 patch SHA-256: `fb4de09b7cf6c31fd29aa7eb443ebc85e79c2e5d58505b6889359f17913046a7`.
- Exact approved proposal SHA-256: `34a7533fd709c897fcfda86ffbe8d8756050a1a0717d2d5a5b3ba3d865c1ce5a`.
- Certified core/React runtime manifest SHA-256: `c26a118a42dfba11cbf4d2b71b549530d808cb35bbd623b9a4711bfd81eda877`.
- Approved core allowances: **5,779 raw / 2,322 gzip** bytes. Measured Store
  consumer: **72,063 / 19,591**; packed package: **546,411 / 146,773**.
  The proposal changes 16 feature-budget values and three fingerprint values;
  [size policy](../../scripts/size-baseline.json) and
  [contract approval record](../../contracts/v1/README.md#experimental-transaction-commit-callbacks)
  record the applied values and promoted public/callback metadata. No further
  budget increase or behavioral change is authorized by that approval.

Workspace evidence is preserved outside the shipped repository: the original
assessment at `.context/transaction-lifecycle/REPORT.md`, candidate and proposal
at `.context/on-commit-revision3/`, rejected experiments and paired measurements
at `.context/on-commit-binding/REPORT.md`, and the independent review copy at
`.context/on-commit-prior-art/reviewer-r3-REPORT.md` (SHA-256
`d241c6ff943482790ad6ac9360ce751f988002f43f55ff9be55d9401e3de7f15`).
These historical records retain their original pending-approval wording; the
owner decision above supersedes that status without rewriting frozen evidence.
