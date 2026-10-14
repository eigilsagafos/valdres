// packages/valdres/src/v1-internal/committed-store-tree/commit-hooks.ts
var pending;
var cursor = 0;
var scheduled;
var draining = false;
var ENTRIES_PER_TASK = 1024;
var budget = ENTRIES_PER_TASK;
var resetGeneration;
var fallbackReport = (error) => {
  setTimeout(() => {
    throw error;
  }, 0);
};
var report = (error) => {
  const failed = (failure) => fallbackReport(new AggregateError([error, failure], "Commit callback and error reporter failed"));
  try {
    const reporter = globalThis.reportError;
    if (typeof reporter !== "function")
      return fallbackReport(error);
    const result = reporter.call(globalThis, error);
    if (result !== null && (typeof result === "object" || typeof result === "function"))
      Promise.prototype.then.call(Promise.resolve(result), undefined, failed);
  } catch (failure) {
    failed(failure);
  }
};
var schedule = () => {
  if (draining || pending === undefined)
    return;
  const wake = () => {
    if (scheduled !== wake)
      return;
    scheduled = undefined;
    drain();
  };
  scheduled = wake;
  queueMicrotask(wake);
};
var scheduleReset = () => {
  const generation = resetGeneration ??= {};
  setTimeout(() => {
    if (resetGeneration !== generation || draining)
      return;
    resetGeneration = undefined;
    budget = ENTRIES_PER_TASK;
    drain();
  }, 0);
};
var drain = () => {
  if (draining || pending === undefined)
    return;
  scheduled = undefined;
  if (resetGeneration === undefined)
    scheduleReset();
  draining = true;
  try {
    while (pending !== undefined && cursor < pending.length && budget > 0) {
      const entry = pending[cursor];
      pending[cursor++] = undefined;
      budget--;
      if (entry === undefined || entry.scope.status !== "live")
        continue;
      try {
        const callback = entry.callback;
        const result = callback();
        if (result !== null && (typeof result === "object" || typeof result === "function"))
          Promise.prototype.then.call(Promise.resolve(result), undefined, report);
      } catch (error) {
        report(error);
      }
    }
  } finally {
    draining = false;
    if (pending !== undefined && cursor === pending.length)
      pending = undefined;
    else if (pending !== undefined)
      pending.splice(0, cursor);
    cursor = 0;
    if (pending !== undefined && budget === 0)
      scheduleReset();
  }
};
var publishCommit = (draft) => {
  const entries = draft.commitEntries;
  if (entries === undefined)
    return;
  draft.commitEntries = undefined;
  if (pending === undefined)
    pending = entries;
  else
    for (const entry of entries)
      pending.push(entry);
  schedule();
};
var discardDisposedCommits = () => {
  if (pending === undefined)
    return;
  for (let i = cursor;i < pending.length; i++) {
    if (pending[i]?.scope.status !== "live")
      pending[i] = undefined;
  }
};

// packages/valdres/src/v1-internal/selector-evaluator/errors.ts
class ImmutableSelectorError extends Error {
  #selectorError = true;
  static is(value) {
    return typeof value === "object" && value !== null && #selectorError in value;
  }
  seal() {
    Object.freeze(this);
  }
}
var ownStack;
var probeOwnStack = () => {
  if (ownStack !== undefined)
    return ownStack;
  ownStack = "";
  try {
    const limit = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
    if (limit?.writable === true) {
      let probe;
      Error.stackTraceLimit = 0;
      try {
        probe = new Error;
      } finally {
        Error.stackTraceLimit = limit.value;
      }
      const stack = Object.getOwnPropertyDescriptor(probe, "stack");
      if (stack !== undefined && "get" in stack) {
        ownStack = "accessor";
        return ownStack;
      }
    }
    const bun = Object.getOwnPropertyDescriptor(globalThis, "Bun");
    if (bun !== undefined && "value" in bun && bun.writable === false && bun.configurable === false && typeof bun.value === "object" && bun.value !== null) {
      ownStack = "lazy";
    }
  } catch {}
  return ownStack;
};
var READ_ONLY = { writable: false, configurable: false };
var sealPropagated = (error, metadata) => {
  if (probeOwnStack() !== "lazy") {
    Object.freeze(error);
    return;
  }
  for (const key of ["message", "code", "name", metadata, "cause"]) {
    Object.defineProperty(error, key, READ_ONLY);
  }
  Object.preventExtensions(error);
};
var framelessError = (Type, subject, cause) => {
  const limit = probeOwnStack() === "accessor" && ImmutableSelectorError.is(cause) ? Object.getOwnPropertyDescriptor(Error, "stackTraceLimit") : undefined;
  if (limit?.writable !== true)
    return;
  Error.stackTraceLimit = 0;
  try {
    return new Type(subject, cause);
  } finally {
    Error.stackTraceLimit = limit.value;
  }
};

class SelectorGetterError extends ImmutableSelectorError {
  code = "VALDRES_SELECTOR_GETTER_ERROR";
  selector;
  cause;
  name = "SelectorGetterError";
  constructor(selector, cause) {
    super("Selector getter failed");
    this.selector = selector;
    this.cause = cause;
    sealPropagated(this, "selector");
  }
}

class SelectorDependencyError extends ImmutableSelectorError {
  code = "VALDRES_SELECTOR_DEPENDENCY_ERROR";
  dependency;
  cause;
  name = "SelectorDependencyError";
  constructor(dependency, cause) {
    super("Selector dependency failed");
    this.dependency = dependency;
    this.cause = cause;
    sealPropagated(this, "dependency");
  }
}

class SelectorCircularDependencyError extends ImmutableSelectorError {
  code = "VALDRES_SELECTOR_CIRCULAR_DEPENDENCY";
  selector;
  path;
  constructor(selector, path) {
    super("Selector dependency graph must be acyclic");
    this.name = "SelectorCircularDependencyError";
    this.selector = selector;
    this.path = Object.freeze([...path]);
    this.seal();
  }
}

class InvalidSynchronousSelectorResultError extends ImmutableSelectorError {
  code = "VALDRES_INVALID_SYNCHRONOUS_SELECTOR_RESULT";
  phase;
  constructor(phase) {
    super(`Selector ${phase} returned or threw a thenable`);
    this.name = "InvalidSynchronousSelectorResultError";
    this.phase = phase;
    this.seal();
  }
}

class InvalidSelectorComparatorResultError extends ImmutableSelectorError {
  code = "VALDRES_INVALID_SELECTOR_COMPARATOR_RESULT";
  constructor() {
    super("Selector comparator must return exactly true or false");
    this.name = "InvalidSelectorComparatorResultError";
    this.seal();
  }
}

class SelectorComparatorError extends ImmutableSelectorError {
  code = "VALDRES_SELECTOR_COMPARATOR_ERROR";
  selector;
  cause;
  constructor(selector, cause) {
    super("Selector comparator failed");
    this.name = "SelectorComparatorError";
    this.selector = selector;
    this.cause = cause;
    this.seal();
  }
}

class SelectorReadRevokedError extends ImmutableSelectorError {
  code = "VALDRES_SELECTOR_READ_REVOKED";
  constructor() {
    super("Selector supplied get is no longer active");
    this.name = "SelectorReadRevokedError";
    this.seal();
  }
}

// packages/valdres/src/v1-internal/selector-evaluator/evaluate.ts
var NOT_THENABLE = Object.freeze({ kind: "not-thenable" });
var NOOP = () => {};
var APPLY = Reflect.apply;
var DEPENDENCY_PATH_ROOT = Symbol("selector dependency path root");
var inspectThenable = (value) => {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return NOT_THENABLE;
  }
  try {
    const then = value.then;
    return typeof then === "function" ? Object.freeze({
      kind: "thenable",
      target: value,
      then
    }) : NOT_THENABLE;
  } catch (error) {
    return Object.freeze({ kind: "inspection-error", error });
  }
};
var containThenable = (inspected) => {
  try {
    APPLY(inspected.then, inspected.target, [undefined, NOOP]);
  } catch {}
};
var freezeOutcome = (outcome) => Object.freeze(outcome);
var freezeDependencies = (dependencies) => Object.freeze(dependencies);
var makeProposal = (selector, token, outcome, dependencies) => {
  const frozenDependencies = freezeDependencies(dependencies);
  return Object.freeze({
    selector,
    token,
    outcome: freezeOutcome(outcome),
    dependencies: frozenDependencies,
    attemptedPrefix: outcome.kind === "value" ? EMPTY_ATTEMPTED_PREFIX : Object.freeze(frozenDependencies.map((dependency) => dependency.node))
  });
};
var EMPTY_ATTEMPTED_PREFIX = Object.freeze([]);
var NEW_EDGE_MEMO_MIN_SEED_SIZE = 32;
var NEW_EDGE_MEMO_MAX_ANCHOR_SIZE = 8192;
var NEW_EDGE_MEMO_MAX_MISS_WORK = 2 * NEW_EDGE_MEMO_MIN_SEED_SIZE;
var REVERSE_PROOF_MAX_WORK = 128;
var TOPOLOGY_DELTA_REVERSE_SNAPSHOT_MAX_ENTRIES = 4096;

class NewEdgeProofMemo {
  passiveSearches;
  searches = 0;
  constructor(passiveSearches, diagnostics) {
    this.passiveSearches = passiveSearches;
    if (diagnostics !== undefined)
      this.diagnostics = diagnostics;
  }
  get enabled() {
    return this.disabled !== true;
  }
  beginSearch() {
    this.searches++;
    if (this.diagnostics !== undefined) {
      this.diagnosticsCompleted = false;
      this.mapProbes = 0;
      this.prunedNodes = 0;
    }
    const consult = this.enabled && this.searches > this.passiveSearches && this.first !== undefined;
    if (consult) {
      this.consultCurrentSearch = true;
      this.hits = 0;
    } else if (this.consultCurrentSearch === true) {
      this.consultCurrentSearch = undefined;
    }
    if (consult && this.passiveOrigin === true && this.searches === this.passiveSearches + 1 && this.passiveProbeBudget === undefined) {
      this.passiveProbeBudget = Math.min(NEW_EDGE_MEMO_MAX_ANCHOR_SIZE, 2 * this.first.size);
    }
    return consult;
  }
  hasProvenNoPath(node) {
    if (!this.enabled)
      return false;
    const first = this.first;
    if (first !== undefined) {
      const remaining = this.passiveProbeBudget;
      if (remaining === 0) {
        this.disable("passive-probe-budget");
        return false;
      }
      if (first.has(node)) {
        this.hits = (this.hits ?? 0) | 1;
        this.passiveOrigin = undefined;
        this.passiveProbeBudget = undefined;
        return true;
      }
      if (remaining !== undefined) {
        this.passiveProbeBudget = remaining - 1;
        if (remaining === 1) {
          this.disable("passive-probe-budget");
          return false;
        }
      }
    }
    const second = this.second;
    if (second !== undefined) {
      const remaining = this.passiveProbeBudget;
      if (remaining === 0) {
        this.disable("passive-probe-budget");
        return false;
      }
      if (second.has(node)) {
        this.hits = (this.hits ?? 0) | 2;
        this.passiveOrigin = undefined;
        this.passiveProbeBudget = undefined;
        return true;
      }
      if (remaining !== undefined) {
        this.passiveProbeBudget = remaining - 1;
        if (remaining === 1) {
          this.disable("passive-probe-budget");
          return false;
        }
      }
    }
    return false;
  }
  hasProvenNoPathMeasured(node) {
    if (!this.enabled)
      return false;
    const first = this.first;
    if (first !== undefined) {
      const remaining = this.passiveProbeBudget;
      if (remaining === 0) {
        this.disable("passive-probe-budget");
        return false;
      }
      this.mapProbes = (this.mapProbes ?? 0) + 1;
      if (first.has(node)) {
        this.hits = (this.hits ?? 0) | 1;
        this.prunedNodes = (this.prunedNodes ?? 0) + 1;
        this.passiveOrigin = undefined;
        this.passiveProbeBudget = undefined;
        return true;
      }
      if (remaining !== undefined) {
        this.passiveProbeBudget = remaining - 1;
        if (remaining === 1) {
          this.disable("passive-probe-budget");
          return false;
        }
      }
    }
    const second = this.second;
    if (second !== undefined) {
      const remaining = this.passiveProbeBudget;
      if (remaining === 0) {
        this.disable("passive-probe-budget");
        return false;
      }
      this.mapProbes = (this.mapProbes ?? 0) + 1;
      if (second.has(node)) {
        this.hits = (this.hits ?? 0) | 2;
        this.prunedNodes = (this.prunedNodes ?? 0) + 1;
        this.passiveOrigin = undefined;
        this.passiveProbeBudget = undefined;
        return true;
      }
      if (remaining !== undefined) {
        this.passiveProbeBudget = remaining - 1;
        if (remaining === 1) {
          this.disable("passive-probe-budget");
          return false;
        }
      }
    }
    return false;
  }
  completeNegative(closure) {
    if (!this.enabled)
      return;
    if (this.searches <= this.passiveSearches) {
      const mayRetain2 = closure.size >= NEW_EDGE_MEMO_MIN_SEED_SIZE && closure.size <= NEW_EDGE_MEMO_MAX_ANCHOR_SIZE;
      let seed;
      if (this.searches === 1 && mayRetain2) {
        this.first = closure;
        this.firstIndependentlyClosed = true;
        this.passiveOrigin = true;
        seed = "initial";
      } else if (this.searches === this.passiveSearches && mayRetain2) {
        seed = this.first === undefined ? "initial" : "activation-replacement";
        this.first = closure;
        this.firstIndependentlyClosed = true;
        this.second = undefined;
        this.secondIndependentlyClosed = undefined;
        this.passiveOrigin = undefined;
        this.passiveProbeBudget = undefined;
      }
      this.completeDiagnostics(seed);
      return;
    }
    if ((this.hits ?? 0) !== 0) {
      if (closure.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE) {
        this.disable("over-cap-hit");
        return;
      }
      const priorFirst = this.first;
      const priorSecond = this.second;
      const priorFirstIndependentlyClosed = this.firstIndependentlyClosed === true;
      const priorSecondIndependentlyClosed = this.secondIndependentlyClosed === true;
      this.first = undefined;
      this.second = undefined;
      this.firstIndependentlyClosed = undefined;
      this.secondIndependentlyClosed = undefined;
      this.retain(priorFirst, priorFirstIndependentlyClosed);
      this.retain(priorSecond, priorSecondIndependentlyClosed);
      const retainedApproach = this.retain(closure, false);
      this.locked = true;
      this.missWork = 0;
      this.completeDiagnostics(retainedApproach ? "hit-derived" : undefined);
      return;
    }
    if (closure.size === 1) {
      this.completeDiagnostics();
      return;
    }
    const mayRetain = closure.size >= NEW_EDGE_MEMO_MIN_SEED_SIZE && closure.size <= NEW_EDGE_MEMO_MAX_ANCHOR_SIZE;
    if (this.first === undefined) {
      if (mayRetain) {
        this.first = closure;
        this.firstIndependentlyClosed = true;
      }
      this.completeDiagnostics(mayRetain ? "initial" : undefined);
      return;
    }
    this.missWork = (this.missWork ?? 0) + Math.min(closure.size, NEW_EDGE_MEMO_MIN_SEED_SIZE);
    if (this.locked !== true && this.second === undefined && mayRetain) {
      this.second = closure;
      this.secondIndependentlyClosed = true;
      this.completeDiagnostics("secondary");
      return;
    }
    if ((this.missWork ?? 0) >= NEW_EDGE_MEMO_MAX_MISS_WORK) {
      this.disable("miss-budget");
      return;
    }
    this.completeDiagnostics();
  }
  completePositive() {
    this.completeDiagnostics();
  }
  advanceGraphVersion(addedEdges) {
    if (!this.enabled || addedEdges === undefined) {
      this.reset();
      return false;
    }
    const closedFirst = this.firstIndependentlyClosed === true ? this.first : undefined;
    const closedSecond = this.secondIndependentlyClosed === true ? this.second : undefined;
    const anchor = closedFirst === undefined || closedSecond !== undefined && closedSecond.size > closedFirst.size ? closedSecond : closedFirst;
    if (anchor === undefined) {
      this.reset();
      return false;
    }
    if (this.passiveProbeBudget === undefined) {
      this.passiveOrigin = true;
      this.passiveProbeBudget = Math.min(NEW_EDGE_MEMO_MAX_ANCHOR_SIZE, 2 * anchor.size);
    }
    let mapProbes = 0;
    for (const edge of addedEdges) {
      const tailIsInside = this.hasWithinCrossVersionBudget(anchor, edge.tail);
      if (tailIsInside === undefined) {
        this.diagnostics?.recordMapProbes?.(mapProbes);
        this.reset();
        return false;
      }
      mapProbes++;
      if (!tailIsInside)
        continue;
      const headIsInside = this.hasWithinCrossVersionBudget(anchor, edge.head);
      if (headIsInside === undefined) {
        this.diagnostics?.recordMapProbes?.(mapProbes);
        this.reset();
        return false;
      }
      mapProbes++;
      if (!headIsInside) {
        this.diagnostics?.recordMapProbes?.(mapProbes);
        this.reset();
        return false;
      }
    }
    this.diagnostics?.recordMapProbes?.(mapProbes);
    if (this.passiveProbeBudget === 0) {
      this.reset();
      return false;
    }
    this.first = anchor;
    this.firstIndependentlyClosed = true;
    this.second = undefined;
    this.secondIndependentlyClosed = undefined;
    this.hits = undefined;
    this.consultCurrentSearch = undefined;
    this.diagnosticsCompleted = undefined;
    this.mapProbes = undefined;
    this.prunedNodes = undefined;
    return true;
  }
  reset() {
    this.first = undefined;
    this.second = undefined;
    this.firstIndependentlyClosed = undefined;
    this.secondIndependentlyClosed = undefined;
    this.hits = undefined;
    this.missWork = undefined;
    this.locked = undefined;
    this.disabled = undefined;
    this.searches = 0;
    this.consultCurrentSearch = undefined;
    this.passiveOrigin = undefined;
    this.passiveProbeBudget = undefined;
    this.diagnosticsCompleted = undefined;
    this.mapProbes = undefined;
    this.prunedNodes = undefined;
  }
  retain(candidate, independentlyClosed = false) {
    if (candidate === undefined || candidate.size > NEW_EDGE_MEMO_MAX_ANCHOR_SIZE || candidate === this.first) {
      return false;
    }
    if (this.first === undefined || candidate.size > this.first.size) {
      this.second = this.first;
      this.secondIndependentlyClosed = this.firstIndependentlyClosed;
      this.first = candidate;
      this.firstIndependentlyClosed = independentlyClosed;
      return true;
    }
    if (this.second === undefined || candidate.size > this.second.size) {
      this.second = candidate;
      this.secondIndependentlyClosed = independentlyClosed;
      return true;
    }
    return false;
  }
  disable(reason) {
    this.first = undefined;
    this.second = undefined;
    this.firstIndependentlyClosed = undefined;
    this.secondIndependentlyClosed = undefined;
    this.missWork = undefined;
    this.disabled = true;
    this.passiveOrigin = undefined;
    this.passiveProbeBudget = undefined;
    this.completeDiagnostics(undefined, reason);
  }
  hasWithinCrossVersionBudget(anchor, node) {
    const remaining = this.passiveProbeBudget;
    if (remaining === undefined || remaining === 0)
      return;
    const contains = anchor.has(node);
    this.passiveProbeBudget = remaining - 1;
    return contains;
  }
  completeDiagnostics(seed, disable) {
    const diagnostics = this.diagnostics;
    if (diagnostics === undefined || this.diagnosticsCompleted === true) {
      return;
    }
    this.diagnosticsCompleted = true;
    const mapProbes = this.mapProbes ?? 0;
    diagnostics.completeSearch(this.consultCurrentSearch === true ? (this.hits ?? 0) !== 0 ? "consulted-pruned" : "consulted-no-prune" : "observing", seed, disable, mapProbes, this.prunedNodes ?? 0, (this.first?.size ?? 0) + (this.second?.size ?? 0));
  }
}
var createNewEdgeProofMemo = (passiveSearches, diagnostics) => new NewEdgeProofMemo(passiveSearches, diagnostics);
var finishReverseProof = (outcome, budget2, nodeVisits, liveDependents, maxFrontier, measurement) => {
  if (measurement !== undefined) {
    measurement.nodeVisits = nodeVisits;
    measurement.dependentProbes = REVERSE_PROOF_MAX_WORK - budget2.remaining - nodeVisits;
    measurement.liveDependents = liveDependents;
    measurement.maxFrontier = maxFrontier;
  }
  return outcome;
};
var tryProveNoDependencyPathReverse = (start, target, host, session, measurement, allowTraversal = true, transientDependents) => {
  if (measurement !== undefined) {
    measurement.nodeVisits = 0;
    measurement.dependentProbes = 0;
    measurement.liveDependents = 0;
    measurement.maxFrontier = 0;
  }
  const visitDependents = host.visitSelectorDependents;
  if (visitDependents === undefined)
    return "unsupported";
  if (transientDependents === undefined && !session.isSoleActiveSelector(host, target)) {
    return "ineligible-active-frames";
  }
  if (!Object.is(start, target)) {
    const transient = transientDependents === undefined ? undefined : session.getTransientDependencies(host, start);
    if (transient !== undefined) {
      if (transient.length === 0)
        return "proven-terminal";
    } else {
      const getDependencies = host.getSelectorDependencyNodes;
      if (getDependencies !== undefined) {
        const dependencies = getDependencies.call(host, start);
        if (dependencies === undefined || dependencies.length === 0) {
          return "proven-terminal";
        }
      }
    }
  }
  if (!allowTraversal)
    return "disabled";
  const budget2 = {
    remaining: REVERSE_PROOF_MAX_WORK
  };
  const pending2 = [target];
  const visited = new Set(pending2);
  let nodeVisits = 0;
  let liveDependents = 0;
  let maxFrontier = 1;
  while (pending2.length > 0) {
    if (budget2.remaining === 0) {
      return finishReverseProof("budget-exhausted", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
    }
    budget2.remaining--;
    nodeVisits++;
    const node = pending2.pop();
    if (Object.is(node, start)) {
      return finishReverseProof("path-possible", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
    }
    let reachedStart = false;
    const visitDependent = (dependent) => {
      liveDependents++;
      if (Object.is(dependent, start)) {
        reachedStart = true;
        return false;
      }
      if (!visited.has(dependent)) {
        visited.add(dependent);
        pending2.push(dependent);
        if (pending2.length > maxFrontier) {
          maxFrontier = pending2.length;
        }
      }
      return true;
    };
    const exhausted = visitDependents.call(host, node, budget2, visitDependent);
    if (reachedStart) {
      return finishReverseProof("path-possible", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
    }
    if (!exhausted) {
      return finishReverseProof("budget-exhausted", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
    }
    const transient = transientDependents?.get(node);
    if (transient !== undefined) {
      for (const dependent of transient) {
        if (budget2.remaining === 0) {
          return finishReverseProof("budget-exhausted", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
        }
        budget2.remaining--;
        if (!visitDependent(dependent)) {
          return finishReverseProof("path-possible", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
        }
      }
    }
  }
  return finishReverseProof("proven-reverse", budget2, nodeVisits, liveDependents, maxFrontier, measurement);
};
var findDependencyPathFast = (start, target, host, session, _site, _acceptedPrefixLength, getNewEdgeProofMemo, topologyDeltaReverseProof) => {
  if (_site === 1 || _site === 2) {
    const reverseProof = tryProveNoDependencyPathReverse(start, target, host, session, undefined, _site === 1 ? getNewEdgeProofMemo?.reverseProofEnabled ?? true : topologyDeltaReverseProof?.reverseProofEnabled ?? true, topologyDeltaReverseProof?.transientDependents);
    if (reverseProof === "proven-terminal" || reverseProof === "proven-reverse") {
      return;
    }
    if (reverseProof === "budget-exhausted") {
      if (_site === 1 && getNewEdgeProofMemo !== undefined) {
        getNewEdgeProofMemo.reverseProofEnabled = false;
      } else if (topologyDeltaReverseProof !== undefined) {
        topologyDeltaReverseProof.reverseProofEnabled = false;
      }
    }
  }
  const newEdgeProofMemo = getNewEdgeProofMemo?.();
  let consultMemo = newEdgeProofMemo?.beginSearch() ?? false;
  const pending2 = [start];
  const parent = new Map([
    [start, DEPENDENCY_PATH_ROOT]
  ]);
  while (pending2.length > 0) {
    const node = pending2.pop();
    if (Object.is(node, target)) {
      const reversed = [];
      let cursor2 = node;
      while (cursor2 !== DEPENDENCY_PATH_ROOT) {
        reversed.push(cursor2);
        cursor2 = parent.get(cursor2);
      }
      reversed.reverse();
      newEdgeProofMemo?.completePositive();
      return Object.freeze(reversed);
    }
    const transient = session.getTransientDependencies(host, node);
    if (transient) {
      if (transient.length === 0)
        continue;
      if (consultMemo) {
        const proven = newEdgeProofMemo.hasProvenNoPath(node);
        if (!newEdgeProofMemo.enabled)
          consultMemo = false;
        if (proven)
          continue;
      }
      for (const dependency of transient) {
        if (parent.has(dependency.node))
          continue;
        parent.set(dependency.node, node);
        pending2.push(dependency.node);
      }
      continue;
    }
    if (host.getSelectorDependencyNodes !== undefined) {
      const dependencies = host.getSelectorDependencyNodes(node);
      if (dependencies === undefined || dependencies.length === 0) {
        continue;
      }
      if (consultMemo) {
        const proven = newEdgeProofMemo.hasProvenNoPath(node);
        if (!newEdgeProofMemo.enabled)
          consultMemo = false;
        if (proven)
          continue;
      }
      for (const dependency of dependencies) {
        if (parent.has(dependency))
          continue;
        parent.set(dependency, node);
        pending2.push(dependency);
      }
      continue;
    }
    const record = host.getSelectorRecord(node);
    if (!record || record.dependencies.length === 0)
      continue;
    if (consultMemo) {
      const proven = newEdgeProofMemo.hasProvenNoPath(node);
      if (!newEdgeProofMemo.enabled)
        consultMemo = false;
      if (proven)
        continue;
    }
    for (const dependency of record.dependencies) {
      if (parent.has(dependency.node))
        continue;
      parent.set(dependency.node, node);
      pending2.push(dependency.node);
    }
  }
  newEdgeProofMemo?.completeNegative(parent);
  return;
};
var classifyThrown = (thrown, phase) => {
  const inspected = inspectThenable(thrown);
  if (inspected.kind === "thenable") {
    containThenable(inspected);
    return new InvalidSynchronousSelectorResultError(phase);
  }
  if (inspected.kind === "inspection-error")
    return inspected.error;
  return thrown;
};
var classifyReturned = (returned, phase) => {
  const inspected = inspectThenable(returned);
  if (inspected.kind === "thenable") {
    containThenable(inspected);
    return Object.freeze({
      kind: "error",
      error: new InvalidSynchronousSelectorResultError(phase)
    });
  }
  if (inspected.kind === "inspection-error") {
    return Object.freeze({ kind: "error", error: inspected.error });
  }
  return Object.freeze({ kind: "value", value: returned });
};
var evaluateSelector = (definition, host, session, cycleSearch = findDependencyPathFast, newEdgeProofDiagnostics, topologyDeltaReverseSnapshotDiagnostics) => {
  const { node: selector } = definition;
  const dependencies = [];
  const currentRecord = host.getSelectorRecord(selector);
  const currentDependencies = currentRecord?.dependencies;
  let dependencyNodes = currentDependencies === undefined ? new Set : undefined;
  let unorderedCurrentDependencyNodes;
  let prefixTruncationRevision = 0;
  const comparisonBaseline = host.getComparisonBaseline(selector);
  let suppliedReadActive = true;
  const materializeDependencyNodes = () => {
    let current = dependencyNodes;
    if (current !== undefined)
      return current;
    current = new Set;
    for (const dependency of dependencies) {
      current.add(dependency.node);
    }
    dependencyNodes = current;
    return current;
  };
  session.enter(host, selector, dependencies);
  const graphVersionAtEntry = host.getSelectorGraphVersion();
  const sessionPublicationsAtEntry = session.getSelectorGraphPublicationCount(host);
  let prefixProofVersion = graphVersionAtEntry;
  let prefixProofSessionPublications = sessionPublicationsAtEntry;
  let observedGraphVersion = graphVersionAtEntry;
  let observedSessionPublications = sessionPublicationsAtEntry;
  let graphObservation;
  let graphObservationStarted = false;
  let newEdgeProofMemoVersion = graphVersionAtEntry;
  let newEdgeProofsInEpoch = 0;
  let newEdgeProofMemo;
  let requestedNewEdgeProofMemoVersion = graphVersionAtEntry;
  let provideNewEdgeProofMemo;
  const reconcileNewEdgeProofMemoVersion = (graphVersion, addedEdges) => {
    if (graphVersion === newEdgeProofMemoVersion)
      return;
    newEdgeProofMemoVersion = graphVersion;
    if (newEdgeProofMemo === undefined) {
      newEdgeProofsInEpoch = 0;
      return;
    }
    if (newEdgeProofMemo.advanceGraphVersion(addedEdges))
      return;
    newEdgeProofsInEpoch = 0;
    newEdgeProofDiagnostics?.graphVersionReset();
  };
  const getNewEdgeProofMemo = (graphVersion) => {
    if (graphVersion !== newEdgeProofMemoVersion) {
      reconcileNewEdgeProofMemoVersion(graphVersion, undefined);
    }
    newEdgeProofsInEpoch++;
    if ((currentDependencies?.length ?? 0) === 0 && newEdgeProofsInEpoch < 3) {
      newEdgeProofDiagnostics?.admissionSkipped();
      return;
    }
    if (newEdgeProofMemo === undefined) {
      const warmNarrowParent = currentDependencies !== undefined && currentDependencies.length > 0 && currentDependencies.length < 3;
      newEdgeProofMemo = createNewEdgeProofMemo(warmNarrowParent ? 3 : 0, newEdgeProofDiagnostics);
    }
    if (!newEdgeProofMemo.enabled) {
      newEdgeProofDiagnostics?.disabled();
      return;
    }
    return newEdgeProofMemo;
  };
  const beginGraphObservation = (dependency) => {
    if (graphObservationStarted)
      return;
    const observation = host.beginSelectorGraphObservation?.(dependency);
    if (observation === undefined)
      return;
    graphObservationStarted = true;
    graphObservation = observation;
  };
  const hasOnlyAttributedPublications = (graphVersionBefore, sessionPublicationsBefore, graphVersionAfter, sessionPublicationsAfter) => graphVersionAfter - graphVersionBefore === sessionPublicationsAfter - sessionPublicationsBefore;
  const revalidateOwnPrefix = (graphVersion = host.getSelectorGraphVersion(), sessionPublications = session.getSelectorGraphPublicationCount(host), onlyAttributed = hasOnlyAttributedPublications(prefixProofVersion, prefixProofSessionPublications, graphVersion, sessionPublications)) => {
    if (graphVersion === prefixProofVersion)
      return;
    if (!graphObservationStarted && host.beginSelectorGraphObservation !== undefined) {
      reconcileNewEdgeProofMemoVersion(graphVersion, undefined);
      prefixProofVersion = graphVersion;
      prefixProofSessionPublications = sessionPublications;
      return;
    }
    const addedEdges = graphObservation?.takeAddedEdges();
    reconcileNewEdgeProofMemoVersion(graphVersion, addedEdges);
    if (onlyAttributed) {
      prefixProofVersion = graphVersion;
      prefixProofSessionPublications = sessionPublications;
      return;
    }
    if (addedEdges !== undefined) {
      const transientDependents = addedEdges.length === 0 || host.visitSelectorDependents === undefined ? undefined : session.captureTransientReverseDependents(host, selector, dependencies.length, TOPOLOGY_DELTA_REVERSE_SNAPSHOT_MAX_ENTRIES, topologyDeltaReverseSnapshotDiagnostics);
      const topologyDeltaReverseProof = addedEdges.length === 0 ? undefined : {
        transientDependents,
        reverseProofEnabled: true
      };
      let addedEdgeMayCloseCycle = false;
      for (const edge of addedEdges) {
        if (cycleSearch(edge.head, edge.tail, host, session, 2, dependencies.length, undefined, topologyDeltaReverseProof) !== undefined) {
          addedEdgeMayCloseCycle = true;
          break;
        }
      }
      if (!addedEdgeMayCloseCycle) {
        prefixProofVersion = graphVersion;
        prefixProofSessionPublications = sessionPublications;
        return;
      }
    }
    for (let index = 0;index < dependencies.length; index++) {
      const dependency = dependencies[index];
      const cyclePath = cycleSearch(dependency.node, selector, host, session, 0, dependencies.length);
      if (!cyclePath)
        continue;
      if (dependencyNodes !== undefined) {
        for (let removeIndex = dependencies.length - 1;removeIndex >= index; removeIndex--) {
          dependencyNodes.delete(dependencies[removeIndex].node);
        }
      }
      dependencies.length = index;
      prefixTruncationRevision++;
      const controlFault = session.getControlFault();
      if (controlFault.kind === "fault")
        return;
      const error = new SelectorCircularDependencyError(selector, [
        selector,
        ...cyclePath
      ]);
      session.latchCycle(host, selector, error);
      return;
    }
    prefixProofVersion = graphVersion;
    prefixProofSessionPublications = sessionPublications;
  };
  const revalidateAcceptedPrefix = () => {
    const graphVersion = host.getSelectorGraphVersion();
    const sessionPublications = session.getSelectorGraphPublicationCount(host);
    observedGraphVersion = graphVersion;
    observedSessionPublications = sessionPublications;
    const onlyAttributed = hasOnlyAttributedPublications(prefixProofVersion, prefixProofSessionPublications, graphVersion, sessionPublications);
    if (!onlyAttributed) {
      session.revalidateAncestorPrefixes(host, selector);
    }
    revalidateOwnPrefix(graphVersion, sessionPublications, onlyAttributed);
  };
  session.setPrefixRevalidator(host, selector, revalidateOwnPrefix);
  const suppliedGet = (dependency) => {
    if (!suppliedReadActive)
      throw new SelectorReadRevokedError;
    const priorControlFault = session.getControlFaultForSuppliedRead();
    if (priorControlFault.kind === "fault") {
      throw priorControlFault.error;
    }
    const priorCycle = session.getCycle(host, selector);
    if (priorCycle !== undefined)
      throw priorCycle;
    const activePath = session.activeCyclePath(host, dependency);
    if (activePath) {
      const error = new SelectorCircularDependencyError(selector, activePath);
      session.latchCycle(host, selector, error);
      throw error;
    }
    const dependencyIndex = dependencies.length;
    let wasAcceptedBeforeServe;
    let wasCurrentDirectDependency = false;
    if (dependencyNodes === undefined) {
      const positional = currentDependencies?.[dependencyIndex];
      if (positional !== undefined && Object.is(positional.node, dependency)) {
        wasAcceptedBeforeServe = false;
        wasCurrentDirectDependency = true;
      } else {
        wasAcceptedBeforeServe = materializeDependencyNodes().has(dependency);
      }
    } else {
      wasAcceptedBeforeServe = dependencyNodes.has(dependency);
    }
    if (!wasAcceptedBeforeServe && !wasCurrentDirectDependency && currentDependencies !== undefined && currentDependencies.length > 0) {
      const positional = currentDependencies[dependencies.length];
      if (positional !== undefined && Object.is(positional.node, dependency)) {
        wasCurrentDirectDependency = true;
      } else {
        if (unorderedCurrentDependencyNodes === undefined) {
          unorderedCurrentDependencyNodes = new Set;
          for (const current of currentDependencies) {
            unorderedCurrentDependencyNodes.add(current.node);
          }
        }
        wasCurrentDirectDependency = unorderedCurrentDependencyNodes.has(dependency);
      }
    }
    const truncationRevisionBeforeServe = prefixTruncationRevision;
    const served = host.serve(dependency, session);
    revalidateAcceptedPrefix();
    const invalidatedPrefixCycle = session.getCycle(host, selector);
    if (invalidatedPrefixCycle !== undefined) {
      throw invalidatedPrefixCycle;
    }
    const alreadyAccepted = dependencyNodes !== undefined ? dependencyNodes.has(dependency) : prefixTruncationRevision === truncationRevisionBeforeServe && dependencies.length === dependencyIndex ? false : materializeDependencyNodes().has(dependency);
    const graphVersionAfterServe = observedGraphVersion;
    const sessionPublicationsAfterServe = observedSessionPublications;
    const mayReusePriorProof = alreadyAccepted || wasCurrentDirectDependency && graphVersionAfterServe === graphVersionAtEntry;
    const maySkipColdParentGraphProof = currentDependencies === undefined && hasOnlyAttributedPublications(graphVersionAtEntry, sessionPublicationsAtEntry, graphVersionAfterServe, sessionPublicationsAfterServe);
    if (!mayReusePriorProof && !maySkipColdParentGraphProof) {
      requestedNewEdgeProofMemoVersion = graphVersionAfterServe;
      if (provideNewEdgeProofMemo === undefined) {
        provideNewEdgeProofMemo = () => getNewEdgeProofMemo(requestedNewEdgeProofMemoVersion);
        provideNewEdgeProofMemo.reverseProofEnabled = true;
      }
      const cyclePath = cycleSearch(dependency, selector, host, session, 1, dependencies.length, provideNewEdgeProofMemo);
      if (cyclePath) {
        const controlFault2 = session.getControlFault();
        if (controlFault2.kind === "fault")
          throw controlFault2.error;
        const error = new SelectorCircularDependencyError(selector, [
          selector,
          ...cyclePath
        ]);
        session.latchCycle(host, selector, error);
        throw error;
      }
    }
    if (!alreadyAccepted) {
      const previousSnapshot = currentRecord?.dependencies[dependencies.length];
      dependencyNodes?.add(dependency);
      dependencies.push(previousSnapshot !== undefined && Object.is(previousSnapshot.node, dependency) && Object.is(previousSnapshot.token, served.token) ? previousSnapshot : Object.freeze({ node: dependency, token: served.token }));
      beginGraphObservation(dependency);
    }
    prefixProofVersion = graphVersionAfterServe;
    prefixProofSessionPublications = sessionPublicationsAfterServe;
    if (served.outcome.kind === "control-error") {
      session.latchControlFault(served.outcome.error, served.outcome.origin);
      const fault = session.getControlFault();
      if (fault.kind === "fault")
        throw fault.error;
      throw served.outcome.error;
    }
    const controlFault = session.getControlFault();
    if (controlFault.kind === "fault")
      throw controlFault.error;
    if (served.outcome.kind === "error") {
      throw framelessError(SelectorDependencyError, dependency, served.outcome.error) ?? new SelectorDependencyError(dependency, served.outcome.error);
    }
    return served.outcome.value;
  };
  try {
    let returned;
    let getterError;
    let getterThrew = false;
    try {
      returned = definition.get(suppliedGet);
    } catch (error) {
      getterThrew = true;
      getterError = error;
    } finally {
      suppliedReadActive = false;
    }
    if (getterThrew)
      getterError = classifyThrown(getterError, "getter");
    const classifiedResult = getterThrew ? undefined : classifyReturned(returned, "getter");
    revalidateAcceptedPrefix();
    const controlFault = session.getControlFault();
    if (controlFault.kind === "fault") {
      return makeProposal(selector, host.createOutcomeToken(), {
        ...controlFault,
        kind: "control-error"
      }, dependencies);
    }
    const cycleError = session.getCycle(host, selector);
    if (cycleError !== undefined) {
      return makeProposal(selector, host.createOutcomeToken(), { kind: "error", error: cycleError }, dependencies);
    }
    if (getterThrew) {
      return makeProposal(selector, host.createOutcomeToken(), {
        kind: "error",
        error: getterError instanceof InvalidSynchronousSelectorResultError ? getterError : framelessError(SelectorGetterError, selector, getterError) ?? new SelectorGetterError(selector, getterError)
      }, dependencies);
    }
    if (classifiedResult === undefined) {
      throw new Error("Selector result classification was not completed");
    }
    const postResultControlFault = session.getControlFault();
    if (postResultControlFault.kind === "fault") {
      return makeProposal(selector, host.createOutcomeToken(), {
        ...postResultControlFault,
        kind: "control-error"
      }, dependencies);
    }
    if (classifiedResult.kind === "error") {
      return makeProposal(selector, host.createOutcomeToken(), {
        kind: "error",
        error: classifiedResult.error instanceof InvalidSynchronousSelectorResultError ? classifiedResult.error : framelessError(SelectorGetterError, selector, classifiedResult.error) ?? new SelectorGetterError(selector, classifiedResult.error)
      }, dependencies);
    }
    let nextValue = classifiedResult.value;
    let token;
    if (comparisonBaseline) {
      const compare = definition.equal ?? Object.is;
      let comparison;
      let comparisonError;
      let comparisonThrew = false;
      try {
        comparison = compare(comparisonBaseline.value, nextValue);
      } catch (error) {
        comparisonThrew = true;
        comparisonError = classifyThrown(error, "comparator");
      }
      const classifiedComparison = comparisonThrew ? undefined : classifyReturned(comparison, "comparator");
      revalidateAcceptedPrefix();
      const comparatorControlFault = session.getControlFault();
      if (comparatorControlFault.kind === "fault") {
        return makeProposal(selector, host.createOutcomeToken(), {
          ...comparatorControlFault,
          kind: "control-error"
        }, dependencies);
      }
      const comparatorCycleError = session.getCycle(host, selector);
      if (comparatorCycleError !== undefined) {
        return makeProposal(selector, host.createOutcomeToken(), { kind: "error", error: comparatorCycleError }, dependencies);
      }
      if (comparisonThrew) {
        return makeProposal(selector, host.createOutcomeToken(), {
          kind: "error",
          error: comparisonError instanceof InvalidSynchronousSelectorResultError ? comparisonError : new SelectorComparatorError(selector, comparisonError)
        }, dependencies);
      }
      if (classifiedComparison === undefined) {
        throw new Error("Selector comparator classification was not completed");
      }
      const postComparatorControlFault = session.getControlFault();
      if (postComparatorControlFault.kind === "fault") {
        return makeProposal(selector, host.createOutcomeToken(), {
          ...postComparatorControlFault,
          kind: "control-error"
        }, dependencies);
      }
      if (classifiedComparison.kind === "error") {
        return makeProposal(selector, host.createOutcomeToken(), {
          kind: "error",
          error: classifiedComparison.error instanceof InvalidSynchronousSelectorResultError ? classifiedComparison.error : new SelectorComparatorError(selector, classifiedComparison.error)
        }, dependencies);
      }
      if (classifiedComparison.value !== true && classifiedComparison.value !== false) {
        return makeProposal(selector, host.createOutcomeToken(), {
          kind: "error",
          error: new InvalidSelectorComparatorResultError
        }, dependencies);
      }
      if (classifiedComparison.value === true) {
        nextValue = comparisonBaseline.value;
        token = comparisonBaseline.current ? comparisonBaseline.token : undefined;
      }
    }
    return makeProposal(selector, token ?? host.createOutcomeToken(), { kind: "value", value: nextValue }, dependencies);
  } finally {
    try {
      graphObservation?.close();
    } finally {
      session.leave(host, selector);
    }
  }
};

// packages/valdres/src/v1-internal/selector-evaluator/types.ts
class SelectorEvaluationSession {
  #frames = [];
  #leftFrame;
  #selectorGraphPublicationHost;
  #selectorGraphPublicationCount = 0;
  #otherSelectorGraphPublications;
  #controlFault = NO_CONTROL_FAULT;
  #suppliedReadGuard;
  latchControlFault(error, origin = {}) {
    if (this.#controlFault.kind === "fault")
      return;
    this.#controlFault = Object.freeze({ kind: "fault", error, origin });
  }
  getControlFault() {
    return this.#controlFault;
  }
  setSuppliedReadGuard(guard) {
    const previous = this.#suppliedReadGuard;
    this.#suppliedReadGuard = guard;
    return previous;
  }
  getControlFaultForSuppliedRead() {
    this.#suppliedReadGuard?.();
    return this.#controlFault;
  }
  noteSelectorGraphPublication(host) {
    const firstHost = this.#selectorGraphPublicationHost;
    if (firstHost === undefined) {
      this.#selectorGraphPublicationHost = host;
      this.#selectorGraphPublicationCount = 1;
      return;
    }
    if (Object.is(firstHost, host)) {
      this.#selectorGraphPublicationCount++;
      return;
    }
    const others = this.#otherSelectorGraphPublications ?? (this.#otherSelectorGraphPublications = new WeakMap);
    others.set(host, (others.get(host) ?? 0) + 1);
  }
  getSelectorGraphPublicationCount(host) {
    return Object.is(this.#selectorGraphPublicationHost, host) ? this.#selectorGraphPublicationCount : this.#otherSelectorGraphPublications?.get(host) ?? 0;
  }
  enter(host, selector, dependencyPrefix) {
    this.#frames.push({
      host,
      selector,
      dependencyPrefix,
      revalidatePrefix: undefined,
      cycleError: undefined
    });
  }
  leave(host, selector) {
    const frame = this.#frames.pop();
    if (!frame || !Object.is(frame.host, host) || !Object.is(frame.selector, selector)) {
      throw new Error("Selector evaluation frame corruption");
    }
    this.#leftFrame = frame;
  }
  get evaluating() {
    return this.#frames.length !== 0;
  }
  getProposedDependencies(host, selector) {
    const frame = this.#leftFrame;
    return frame !== undefined && Object.is(frame.host, host) && Object.is(frame.selector, selector) && Object.isFrozen(frame.dependencyPrefix) ? frame.dependencyPrefix : undefined;
  }
  isActive(host, node) {
    return this.#frames.some((frame) => Object.is(frame.host, host) && Object.is(frame.selector, node));
  }
  isSoleActiveSelector(host, selector) {
    let found = false;
    for (const frame of this.#frames) {
      if (!Object.is(frame.host, host))
        continue;
      if (found || !Object.is(frame.selector, selector))
        return false;
      found = true;
    }
    return found;
  }
  activeCyclePath(host, node) {
    const index = this.#frames.findIndex((frame) => Object.is(frame.host, host) && Object.is(frame.selector, node));
    if (index === -1)
      return;
    return Object.freeze([
      ...this.#frames.slice(index).filter((frame) => Object.is(frame.host, host)).map((frame) => frame.selector),
      node
    ]);
  }
  setPrefixRevalidator(host, selector, revalidate) {
    const frame = this.#currentFrame(host, selector);
    if (frame.revalidatePrefix !== undefined) {
      throw new Error("Selector prefix revalidator is already installed");
    }
    frame.revalidatePrefix = revalidate;
  }
  revalidateAncestorPrefixes(host, selector) {
    this.#currentFrame(host, selector);
    for (let index = 0;index < this.#frames.length - 1; index++) {
      const frame = this.#frames[index];
      if (!Object.is(frame.host, host))
        continue;
      const revalidate = frame.revalidatePrefix;
      if (revalidate === undefined) {
        throw new Error("Selector prefix revalidator is not installed");
      }
      revalidate();
    }
  }
  getTransientDependencies(host, node) {
    for (let index = this.#frames.length - 1;index >= 0; index--) {
      const frame = this.#frames[index];
      if (Object.is(frame.host, host) && Object.is(frame.selector, node)) {
        return frame.dependencyPrefix;
      }
    }
    return;
  }
  captureTransientReverseDependents(host, selector, acceptedPrefixLength, maxEntries, diagnostics) {
    const seenSelectors = new Set;
    const mutable = new Map;
    let matchedSelector = false;
    let scannedFrames = 0;
    let activeFrames = 0;
    let edgeCount = 0;
    for (const frame of this.#frames) {
      scannedFrames++;
      if (scannedFrames > maxEntries) {
        diagnostics?.recordSnapshot("overflow", scannedFrames, activeFrames, edgeCount);
        return;
      }
      if (!Object.is(frame.host, host))
        continue;
      activeFrames++;
      if (frame.revalidatePrefix === undefined || seenSelectors.has(frame.selector)) {
        diagnostics?.recordSnapshot("unavailable", scannedFrames, activeFrames, edgeCount);
        return;
      }
      seenSelectors.add(frame.selector);
      if (Object.is(frame.selector, selector)) {
        if (matchedSelector || frame.dependencyPrefix.length !== acceptedPrefixLength) {
          diagnostics?.recordSnapshot("unavailable", scannedFrames, activeFrames, edgeCount);
          return;
        }
        matchedSelector = true;
      }
      for (const dependency of frame.dependencyPrefix) {
        edgeCount++;
        if (edgeCount > maxEntries) {
          diagnostics?.recordSnapshot("overflow", scannedFrames, activeFrames, edgeCount);
          return;
        }
        const dependents = mutable.get(dependency.node);
        if (dependents === undefined) {
          mutable.set(dependency.node, [frame.selector]);
        } else {
          dependents.push(frame.selector);
        }
      }
    }
    if (!matchedSelector) {
      diagnostics?.recordSnapshot("unavailable", scannedFrames, activeFrames, edgeCount);
      return;
    }
    const snapshot = new Map;
    for (const [dependency, dependents] of mutable) {
      snapshot.set(dependency, Object.freeze(dependents));
    }
    diagnostics?.recordSnapshot("completed", scannedFrames, activeFrames, edgeCount);
    return snapshot;
  }
  latchCycle(host, selector, error) {
    const frame = this.#activeFrame(host, selector);
    frame.cycleError ??= error;
  }
  getCycle(host, selector) {
    return this.#currentFrame(host, selector).cycleError;
  }
  #currentFrame(host, selector) {
    const frame = this.#frames[this.#frames.length - 1];
    if (!frame || !Object.is(frame.host, host) || !Object.is(frame.selector, selector)) {
      throw new Error("Selector evaluation frame is not active");
    }
    return frame;
  }
  #activeFrame(host, selector) {
    for (let index = this.#frames.length - 1;index >= 0; index--) {
      const frame = this.#frames[index];
      if (Object.is(frame.host, host) && Object.is(frame.selector, selector)) {
        return frame;
      }
    }
    throw new Error("Selector evaluation frame is not active");
  }
}
var NO_CONTROL_FAULT = Object.freeze({ kind: "none" });

// packages/valdres/src/v1-internal/committed-store-tree/runtime-domain.ts
var REACQUIRABLE_ATOMS = Symbol();
var DEFINITION_CALLBACK_FRAME = Symbol();
var FAMILY_DEFINITIONS = Symbol();
var COLLECTION_KERNEL = Symbol();
var sameOutcome = (previous, next) => previous.kind === next.kind && (previous.kind === "value" ? Object.is(previous.value, next.value) : Object.is(previous.error, next.error));
var NOT_THENABLE2 = Object.freeze({ kind: "not-thenable" });
var NOOP2 = () => {};
var APPLY2 = Reflect.apply;
var RUNTIME_OWNER_KEY = Symbol.for("valdres.runtime-owner/v1");

class ImmutableRuntimeError extends Error {
  seal() {
    Object.freeze(this);
  }
}
var runtimeMismatches = new WeakSet;
var isInternalRuntimeMismatch = (error) => runtimeMismatches.has(error);

class RuntimeMismatchError extends ImmutableRuntimeError {
  code = "VALDRES_RUNTIME_MISMATCH";
  constructor() {
    super("Valdres handles belong to a different runtime domain");
    this.name = "RuntimeMismatchError";
    this.seal();
  }
}

class SubscriberNotificationError extends ImmutableRuntimeError {
  code = "VALDRES_SUBSCRIBER_NOTIFICATION";
  cause;
  causes;
  committed = true;
  phase = "notifying";
  source;
  constructor(causes, source = "owned-mutation") {
    super("One or more Store subscribers threw during notification");
    this.name = "SubscriberNotificationError";
    this.causes = Object.freeze([...causes]);
    this.cause = this.causes[0];
    this.source = source;
    this.seal();
  }
}

class CallbackCapabilityError extends ImmutableRuntimeError {
  code = "VALDRES_CALLBACK_CAPABILITY";
  constructor() {
    super("This callback cannot use captured Valdres runtime capabilities");
    this.name = "CallbackCapabilityError";
    this.seal();
  }
}

class SelectorCapabilityError extends ImmutableRuntimeError {
  code = "VALDRES_SELECTOR_CAPABILITY_ERROR";
  constructor(operation) {
    super(`A selector callback cannot call ${operation} directly`);
    this.name = "SelectorCapabilityError";
    this.seal();
  }
}

class SettleLimitError extends ImmutableRuntimeError {
  code = "VALDRES_SETTLE_LIMIT";
  constructor() {
    super("Store updates did not settle");
    this.name = "SettleLimitError";
    this.seal();
  }
}

class TransactionPhaseError extends ImmutableRuntimeError {
  code = "VALDRES_TRANSACTION_PHASE";
  constructor() {
    super("Captured StoreTree work is forbidden during a transaction");
    this.name = "TransactionPhaseError";
    this.seal();
  }
}

class TransactionClosedError extends ImmutableRuntimeError {
  code = "VALDRES_TRANSACTION_CLOSED";
  constructor() {
    super("The Transaction cursor is no longer active");
    this.name = "TransactionClosedError";
    this.seal();
  }
}

class InvalidTransactionCallbackResultError extends ImmutableRuntimeError {
  code = "VALDRES_INVALID_TRANSACTION_CALLBACK_RESULT";
  constructor() {
    super("Transaction callbacks must return synchronously");
    this.name = "InvalidTransactionCallbackResultError";
    this.seal();
  }
}

class InvalidSynchronousAtomValueError extends ImmutableRuntimeError {
  code = "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE";
  constructor() {
    super("Atom values and lazy initializers must be synchronous");
    this.name = "InvalidSynchronousAtomValueError";
    this.seal();
  }
}

class InvalidAtomComparatorResultError extends ImmutableRuntimeError {
  code = "VALDRES_INVALID_ATOM_COMPARATOR_RESULT";
  constructor() {
    super("Atom comparators must return exactly true or false synchronously");
    this.name = "InvalidAtomComparatorResultError";
    this.seal();
  }
}

class StoreDisposedError extends ImmutableRuntimeError {
  code = "VALDRES_STORE_DISPOSED";
  constructor() {
    super("This Store has been disposed");
    this.name = "StoreDisposedError";
    this.seal();
  }
}

class ScopeNotFoundError extends ImmutableRuntimeError {
  code = "VALDRES_SCOPE_NOT_FOUND";
  constructor() {
    super("The named child Store does not exist");
    this.name = "ScopeNotFoundError";
    this.seal();
  }
}

class StoreTreeMismatchError extends ImmutableRuntimeError {
  code = "VALDRES_STORE_TREE_MISMATCH";
  constructor() {
    super("The Store belongs to a different StoreTree");
    this.name = "StoreTreeMismatchError";
    this.seal();
  }
}

class InvalidTransactionTargetError extends ImmutableRuntimeError {
  code = "VALDRES_INVALID_TRANSACTION_TARGET";
  constructor() {
    super("Transaction.scope requires a Store or named child");
    this.name = "InvalidTransactionTargetError";
    this.seal();
  }
}
var inspectThenable2 = (value) => {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return NOT_THENABLE2;
  }
  try {
    const then = value.then;
    return typeof then === "function" ? Object.freeze({
      kind: "thenable",
      target: value,
      then
    }) : NOT_THENABLE2;
  } catch (error) {
    return Object.freeze({ kind: "inspection-error", error });
  }
};
var containThenable2 = (inspected) => {
  try {
    APPLY2(inspected.then, inspected.target, [undefined, NOOP2]);
  } catch {}
};
var inspectSynchronousAtomValue = (value) => {
  const inspected = inspectThenable2(value);
  if (inspected.kind === "not-thenable") {
    return Object.freeze({ kind: "value", value });
  }
  if (inspected.kind === "inspection-error") {
    return Object.freeze({ kind: "error", error: inspected.error });
  }
  containThenable2(inspected);
  return Object.freeze({
    kind: "error",
    error: new InvalidSynchronousAtomValueError
  });
};
var runLazyInitializer = (initialize) => {
  try {
    return inspectSynchronousAtomValue(initialize());
  } catch (thrown) {
    const inspected = inspectThenable2(thrown);
    if (inspected.kind === "not-thenable") {
      return Object.freeze({ kind: "error", error: thrown });
    }
    if (inspected.kind === "inspection-error") {
      return Object.freeze({
        kind: "error",
        error: inspected.error
      });
    }
    containThenable2(inspected);
    return Object.freeze({
      kind: "error",
      error: new InvalidSynchronousAtomValueError
    });
  }
};
var runInRuntimeActivity = (domain, activity, operation) => {
  const previous = domain.activity;
  domain.activity = activity;
  try {
    return operation();
  } finally {
    domain.activity = previous;
  }
};
var runGuardedCallback = (domain, session, operation) => {
  const previous = domain.activity;
  const selectorActivity = previous?.kind === "selector" ? previous : previous !== undefined && ("selectorActivity" in previous) ? previous.selectorActivity : undefined;
  const activity = selectorActivity === undefined ? Object.freeze({ kind: "guarded-callback", session }) : Object.freeze({
    kind: "guarded-callback",
    session,
    selectorActivity
  });
  try {
    return runInRuntimeActivity(domain, activity, operation);
  } finally {
    const fault = session.getControlFault();
    if (fault.kind === "fault") {
      domain.externalRuntime?.guard(fault.error);
      throw fault.error;
    }
  }
};
var runSubscriberActivity = (domain, session, operation) => {
  try {
    return runInRuntimeActivity(domain, Object.freeze({ kind: "subscriber", session }), operation);
  } finally {
    const controlFault = session.getControlFault();
    if (controlFault.kind === "fault")
      throw controlFault.error;
  }
};
var runSelectorActivity = (domain, session, operation) => {
  const previous = domain.activity;
  const currentSelectorActivity = previous?.kind === "selector" ? previous : previous !== undefined && ("selectorActivity" in previous) ? previous.selectorActivity : undefined;
  const parentSelectorActivity = Object.is(currentSelectorActivity?.session, session) ? currentSelectorActivity?.parentSelectorActivity : currentSelectorActivity;
  const activity = parentSelectorActivity === undefined ? Object.freeze({ kind: "selector", session }) : Object.freeze({
    kind: "selector",
    session,
    parentSelectorActivity
  });
  return runInRuntimeActivity(domain, activity, operation);
};
var runTransactionActivity = (domain, transaction, operation) => runInRuntimeActivity(domain, Object.freeze({ kind: "transaction", transaction }), operation);
var runTransactionResultActivity = (domain, session, operation) => {
  try {
    return runInRuntimeActivity(domain, Object.freeze({ kind: "transaction-result", session }), operation);
  } finally {
    const controlFault = session.getControlFault();
    if (controlFault.kind === "fault")
      throw controlFault.error;
  }
};
var rejectCallbackOperation = (domain) => {
  const error = new CallbackCapabilityError;
  domain.externalRuntime?.guard(error);
  throw error;
};
var assertStoreOperationAllowed = (domain, operation) => {
  const activity = domain.activity;
  if (activity === undefined)
    return;
  if (activity.kind === "selector") {
    throw new SelectorCapabilityError(operation);
  }
  if (activity.kind === "transaction" || activity.kind === "transaction-result") {
    throw new TransactionPhaseError;
  }
  rejectCallbackOperation(domain);
};
var assertStoreReadAllowed = (domain, operation) => {
  if (domain.activity?.kind === "subscriber")
    return domain.activity.session;
  assertStoreOperationAllowed(domain, operation);
};
var rejectGuardedSelectorRead = (callbackSession, selectorSession) => {
  const selectorFault = selectorSession.getControlFault();
  const callbackFault = callbackSession.getControlFault();
  const error = selectorFault.kind === "fault" ? selectorFault.error : callbackFault.kind === "fault" ? callbackFault.error : new CallbackCapabilityError;
  callbackSession.latchControlFault(error);
  selectorSession.latchControlFault(error);
  throw error;
};
var assertUnsubscribeAllowed = (domain) => {
  assertStoreReadAllowed(domain, "Store unsubscribe");
};
var assertCursorOperationAllowed = (domain, transaction, active) => {
  if (!active)
    throw new TransactionClosedError;
  const activity = domain.activity;
  if (activity?.kind === "transaction" && Object.is(activity.transaction, transaction)) {
    return;
  }
  if (activity?.kind === "selector") {
    throw new SelectorCapabilityError("Transaction cursor operation");
  }
  if (activity?.kind === "guarded-callback" || activity?.kind.startsWith("external-")) {
    rejectCallbackOperation(domain);
  }
  throw new TransactionPhaseError;
};
var currentFaultSession = (domain, fallback) => {
  const activity = domain.activity;
  return activity !== undefined && "session" in activity ? activity.session : fallback;
};
var classifyOwner = (domain, value, session) => {
  if (domain.states.has(value) || domain.stores.has(value) || domain.transactionCursors.has(value)) {
    return "local";
  }
  if (value !== null && value !== undefined) {
    const ownerDescriptor = Object.getOwnPropertyDescriptor(value, RUNTIME_OWNER_KEY);
    if (ownerDescriptor !== undefined && "value" in ownerDescriptor && !Object.is(ownerDescriptor.value, domain.ownerToken)) {
      const error = new RuntimeMismatchError;
      runtimeMismatches.add(error);
      currentFaultSession(domain, session).latchControlFault(error);
      throw error;
    }
  }
  return "invalid";
};
var classifyEntryOwner = (domain, value, session) => {
  if (domain.states.has(value) || domain.stores.has(value) || domain.transactionCursors.has(value)) {
    return "local";
  }
  const activity = domain.activity;
  const faultSession = currentFaultSession(domain, session);
  if (activity !== undefined && "session" in activity) {
    try {
      return classifyOwner(domain, value, faultSession);
    } finally {
      const fault = faultSession.getControlFault();
      if (fault.kind === "fault")
        throw fault.error;
    }
  }
  return runGuardedCallback(domain, faultSession, () => classifyOwner(domain, value, faultSession));
};
var brandRuntimeHandle = (value, ownerToken) => {
  Object.defineProperty(value, RUNTIME_OWNER_KEY, {
    value: ownerToken,
    enumerable: false,
    writable: false,
    configurable: false
  });
  return value;
};
var assertRuntimeDefinitionConstructionAllowed = (domain) => {
  const frame = domain[DEFINITION_CALLBACK_FRAME];
  if (frame === undefined || frame.allowDefinitions)
    return;
  const controlFault = frame.session.getControlFault();
  if (controlFault.kind === "fault")
    throw controlFault.error;
  const error = new CallbackCapabilityError;
  frame.session.latchControlFault(error);
  throw error;
};
var makeStateHandle = (kind) => ({ kind });
var registerRuntimeStateHandle = (domain, mutableHandle) => {
  assertRuntimeDefinitionConstructionAllowed(domain);
  const frame = domain[DEFINITION_CALLBACK_FRAME];
  const handle = Object.freeze(brandRuntimeHandle(mutableHandle, domain.ownerToken));
  domain.states.add(handle);
  frame?.definitions?.add(handle);
  return handle;
};

// packages/valdres/src/v1-internal/committed-store-tree/scratch-selector-host.ts
var NO_COMMITTED_BASELINE = Symbol("no-committed-selector-baseline");

class ScratchSelectorHost {
  #bindings;
  #selectorRecords = new Map;
  #sourceRecords = new Map;
  #committedBaselines = new Map;
  #generation;
  #nextToken = 1;
  #selectorGraphVersion = 0;
  #evaluate;
  #path;
  constructor(bindings, generation, evaluate) {
    this.#bindings = bindings;
    this.#generation = generation;
    this.#evaluate = evaluate;
    this.#path = bindings.trackPath ? [] : undefined;
  }
  readSelector(selector) {
    const session = new SelectorEvaluationSession;
    const served = this.serve(selector, session);
    if (served.outcome.kind !== "value")
      throw served.outcome.error;
    return served.outcome.value;
  }
  advanceGeneration(generation) {
    if (generation !== this.#generation + 1) {
      throw new Error("Scratch selector generation is not contiguous");
    }
    this.#generation = generation;
    this.#selectorRecords.clear();
    this.#sourceRecords.clear();
  }
  revoke() {
    this.#selectorRecords.clear();
    this.#sourceRecords.clear();
    this.#committedBaselines.clear();
    this.#bindings = undefined;
  }
  serve(node, session) {
    if (this.#path === undefined)
      return this.#serve(node, session);
    this.#path.push(node);
    try {
      return this.#serve(node, session);
    } finally {
      this.#path.pop();
    }
  }
  #serve(node, session) {
    const bindings = this.#activeBindings();
    const resolved = bindings.resolve(node, session);
    if (resolved.kind !== "selector") {
      const current2 = this.#sourceRecords.get(node);
      if (current2 !== undefined)
        return current2;
      const served2 = Object.freeze({
        token: this.createOutcomeToken(),
        outcome: bindings.read(node, resolved.kind, session, this.#path)
      });
      this.#sourceRecords.set(node, served2);
      return served2;
    }
    const current = this.#selectorRecords.get(node);
    if (current !== undefined)
      return current.served;
    const proposal = bindings.run(session, () => this.#evaluate(resolved.definition, this, session));
    if (proposal.outcome.kind === "control-error") {
      throw proposal.outcome.error;
    }
    const served = Object.freeze({
      token: proposal.token,
      outcome: proposal.outcome
    });
    this.#selectorGraphVersion++;
    session.noteSelectorGraphPublication(this);
    this.#selectorRecords.set(node, Object.freeze({
      served,
      dependencies: proposal.dependencies
    }));
    return served;
  }
  getSelectorRecord(node) {
    const record = this.#selectorRecords.get(node);
    return record === undefined ? undefined : Object.freeze({ dependencies: record.dependencies });
  }
  getSelectorGraphVersion() {
    return this.#selectorGraphVersion;
  }
  getComparisonBaseline(node) {
    let baseline = this.#committedBaselines.get(node);
    if (baseline === undefined) {
      baseline = this.#activeBindings().baseline(node) ?? NO_COMMITTED_BASELINE;
      this.#committedBaselines.set(node, baseline);
    }
    return baseline === NO_COMMITTED_BASELINE ? undefined : Object.freeze({
      current: false,
      value: baseline.value
    });
  }
  createOutcomeToken() {
    return Object.freeze({ id: this.#nextToken++ });
  }
  #activeBindings() {
    if (this.#bindings === undefined) {
      throw new Error("Scratch selector host is revoked");
    }
    return this.#bindings;
  }
}

// packages/valdres/src/v1-internal/committed-store-tree/scope-node.ts
var MAX_OBSERVED_SELECTOR_EDGE_ADDITIONS = 4096;
var EMPTY_SELECTOR_EDGE_ADDITIONS = Object.freeze([]);

class WeakHandleSet {
  onDeadReference;
  onEmptinessProbe;
  #byValue = new WeakMap;
  #references = new Set;
  constructor(onDeadReference, onEmptinessProbe) {
    this.onDeadReference = onDeadReference;
    this.onEmptinessProbe = onEmptinessProbe;
  }
  add(value) {
    if (this.#byValue.has(value))
      return;
    const reference = new WeakRef(value);
    this.#byValue.set(value, reference);
    this.#references.add(reference);
  }
  delete(value) {
    const reference = this.#byValue.get(value);
    if (reference === undefined)
      return;
    this.#byValue.delete(value);
    this.#references.delete(reference);
  }
  forEach(visitor) {
    for (const reference of this.#references) {
      const value = reference.deref();
      if (value === undefined) {
        this.#references.delete(reference);
        this.onDeadReference?.();
        continue;
      }
      visitor(value);
    }
  }
  visitWithin(budget2, visitor) {
    for (const reference of this.#references) {
      if (budget2.remaining === 0)
        return false;
      budget2.remaining--;
      const value = reference.deref();
      if (value === undefined) {
        this.#references.delete(reference);
        this.onDeadReference?.();
        continue;
      }
      if (!visitor(value))
        return false;
    }
    return true;
  }
  isEmpty() {
    for (const reference of this.#references) {
      this.onEmptinessProbe?.();
      if (reference.deref() !== undefined)
        return false;
      this.#references.delete(reference);
      this.onDeadReference?.();
    }
    return true;
  }
  clear() {
    this.#references.clear();
    this.#byValue = new WeakMap;
  }
}

class WeakOwnedAtoms {
  scope;
  onSwept;
  #byAtom = new WeakMap;
  #references = new Set;
  #sweepAt = 64;
  constructor(scope, onSwept) {
    this.scope = scope;
    this.onSwept = onSwept;
  }
  add(atom) {
    if (this.#byAtom.has(atom))
      return false;
    const reference = new WeakRef(atom);
    this.#byAtom.set(atom, reference);
    this.#references.add(reference);
    if (this.#references.size >= this.#sweepAt)
      this.sweep();
    return true;
  }
  sweep() {
    let removed = 0;
    for (const reference of this.#references) {
      const atom = reference.deref();
      if (atom !== undefined && this.scope.atomOverrides.has(atom))
        continue;
      if (atom !== undefined)
        this.#byAtom.delete(atom);
      this.#references.delete(reference);
      removed++;
    }
    this.#sweepAt = Math.max(64, this.#references.size * 2);
    if (removed !== 0)
      this.onSwept?.(removed);
    return removed;
  }
  collect(into) {
    let removed = 0;
    for (const reference of this.#references) {
      const atom = reference.deref();
      if (atom !== undefined) {
        into.push(atom);
        continue;
      }
      this.#references.delete(reference);
      removed++;
    }
    if (removed !== 0)
      this.onSwept?.(removed);
  }
}

class StoreScopeNode {
  coordinator;
  parent;
  name;
  children;
  namedChildren = new Map;
  atomOverrides = new WeakMap;
  ownedAtoms;
  #atomViews = new WeakMap;
  #liveAtomViews;
  #selectorRecords = new WeakMap;
  #selectorDependencyNodes;
  #reverseEdges = new WeakMap;
  #dirtySelectors = new WeakSet;
  #retrySelectors;
  #selectorGraphVersion = 0;
  #selectorGraphObserverCount = 0;
  #observedSelectorEdgeAdditions;
  #selectorGraphObservationIncomplete = false;
  #facade;
  #status = "live";
  constructor(coordinator, parent, name) {
    this.coordinator = coordinator;
    this.parent = parent;
    this.name = name;
    this.children = this.#weakRoutes();
    this.#liveAtomViews = this.#weakRoutes();
  }
  get status() {
    return this.#status;
  }
  get facade() {
    if (this.#facade === undefined) {
      throw new Error("Store scope facade is not installed");
    }
    return this.#facade;
  }
  installFacade(facade) {
    if (this.#facade !== undefined) {
      throw new Error("Store scope facade is already installed");
    }
    this.#facade = facade;
  }
  markDisposing() {
    if (this.#status === "live")
      this.#status = "disposing";
  }
  markDisposed() {
    this.#status = "disposed";
  }
  getAtomView(atom) {
    return this.#atomViews.get(atom);
  }
  getMaterializedServedOutcome(state) {
    if (state.kind !== "selector")
      return this.#atomViews.get(state)?.served;
    const selector = state;
    const selectorRecord = this.#selectorRecords.get(selector);
    return selectorRecord !== undefined && !this.#dirtySelectors.has(selector) ? selectorRecord.served : undefined;
  }
  createAtomView(atom, outcome, inheritedFrom) {
    const current = this.#atomViews.get(atom);
    if (current !== undefined)
      return current;
    const record = {
      scope: this,
      atom,
      served: Object.freeze({
        token: this.createOutcomeToken(),
        outcome
      }),
      inheritedFrom,
      inheritingChildren: this.#weakRoutes()
    };
    this.#atomViews.set(atom, record);
    this.#liveAtomViews.add(record);
    if (inheritedFrom !== undefined) {
      inheritedFrom.inheritingChildren.add(record);
      this.coordinator.recordCounter(11 /* routeAdds */);
    }
    return record;
  }
  attachAtomView(record, inheritedFrom) {
    if (Object.is(record.inheritedFrom, inheritedFrom))
      return;
    this.detachAtomView(record);
    record.inheritedFrom = inheritedFrom;
    inheritedFrom.inheritingChildren.add(record);
    this.coordinator.recordCounter(11 /* routeAdds */);
  }
  detachAtomView(record) {
    if (record.inheritedFrom === undefined)
      return;
    record.inheritedFrom.inheritingChildren.delete(record);
    record.inheritedFrom = undefined;
    this.coordinator.recordCounter(12 /* routeRemoves */);
  }
  updateAtomView(record, outcome) {
    record.served = Object.freeze({
      token: this.createOutcomeToken(),
      outcome
    });
    this.coordinator.reachSubscriptionTarget(this, record.atom);
  }
  captureCommittedSelectorSuccess(selector) {
    const lastSuccess = this.#selectorRecords.get(selector)?.lastSuccess;
    return lastSuccess === undefined ? undefined : Object.freeze({ value: lastSuccess.value });
  }
  isSelectorDirty(selector) {
    return this.#dirtySelectors.has(selector);
  }
  getCommittedSelectorDependencies(selector) {
    return this.#selectorRecords.get(selector)?.dependencies;
  }
  externalRecord(node) {
    return this.#selectorRecords.get(node);
  }
  replaceExternalRecord(node, record) {
    this.#selectorRecords.set(node, record);
  }
  externalDependents(node) {
    return this.#reverseEdges.get(node);
  }
  markDependents(node) {
    this.#reverseEdges.get(node)?.forEach((selector) => {
      if (this.coordinator.enqueueSelector(this, selector)) {
        this.#dirtySelectors.add(selector);
      }
    });
  }
  dropRecords() {
    this.coordinator.runtimeDomain[COLLECTION_KERNEL]?.scope(this);
    this.#liveAtomViews.forEach((record) => {
      this.detachAtomView(record);
      record.inheritingChildren.clear();
    });
    this.#liveAtomViews.clear();
    this.atomOverrides = new WeakMap;
    this.ownedAtoms = undefined;
    this[REACQUIRABLE_ATOMS]?.release(this.coordinator);
    this[REACQUIRABLE_ATOMS] = undefined;
    this.#atomViews = new WeakMap;
    this.#selectorRecords = new WeakMap;
    this.#selectorDependencyNodes = undefined;
    this.#reverseEdges = new WeakMap;
    this.#dirtySelectors = new WeakSet;
    this.#retrySelectors = undefined;
    this.#selectorGraphVersion++;
    this.#invalidateSelectorGraphObservation();
  }
  serve(node, session) {
    const domain = this.coordinator.runtimeDomain;
    if (classifyOwner(domain, node, session) === "invalid") {
      throw new TypeError("Selector get requires a valid State");
    }
    return this.serveKnownLocal(node, session);
  }
  serveKnownLocal(node, session) {
    const domain = this.coordinator.runtimeDomain;
    if (domain.atoms.has(node)) {
      const current2 = this.#atomViews.get(node);
      if (current2 !== undefined)
        return current2.served;
      return this.coordinator.serveScopeAtom(this, node, session);
    }
    const definition = domain.selectors.get(node);
    if (definition === undefined) {
      if (domain.externalAtoms?.has(node))
        return this.coordinator.reachExternal().serve(this, node, session);
      const served = domain[COLLECTION_KERNEL]?.scope(this, node, session);
      if (served !== undefined) {
        return served;
      }
      throw new TypeError("Unknown committed StoreTree state");
    }
    const selector = node;
    let current = this.#selectorRecords.get(selector);
    if (current?.lifecycleInClosure && !this.#dirtySelectors.has(selector)) {
      this.coordinator.external?.refresh(this, selector, session);
      current = this.#selectorRecords.get(selector);
    }
    if (current !== undefined && this.coordinator.postSourceApply) {
      this.coordinator.prepareSelectorRead(this, selector, session);
      current = this.#selectorRecords.get(selector);
    }
    if (current !== undefined && !this.#dirtySelectors.has(selector) && !(this.coordinator.postSourceApply && this.#claimRetry(selector))) {
      return current.served;
    }
    let proposal;
    try {
      proposal = runSelectorActivity(domain, session, () => this.coordinator.evaluate(definition, this, session));
    } catch (error) {
      return this.publishEscapedFailure(selector, error, session);
    }
    if (proposal.outcome.kind === "control-error" && (!this.coordinator.postSourceApply || this.coordinator.external?.dormantPull === true)) {
      throw proposal.outcome.error;
    }
    return this.#installSelectorProposal(selector, proposal, session);
  }
  getSelectorRecord(node) {
    const record = this.#selectorRecords.get(node);
    return record === undefined ? undefined : Object.freeze({ dependencies: record.dependencies });
  }
  getSelectorDependencyNodes(node) {
    const record = this.#selectorRecords.get(node);
    if (record === undefined)
      return;
    const selector = node;
    let selectorDependencyNodes = this.#selectorDependencyNodes?.get(selector);
    if (selectorDependencyNodes === undefined) {
      const filtered = [];
      for (const dependency of record.dependencies) {
        if (this.coordinator.runtimeDomain.selectors.has(dependency.node)) {
          filtered.push(dependency.node);
        }
      }
      selectorDependencyNodes = Object.freeze(filtered);
      let cache = this.#selectorDependencyNodes;
      if (cache === undefined) {
        cache = new WeakMap;
        this.#selectorDependencyNodes = cache;
      }
      cache.set(selector, selectorDependencyNodes);
    }
    return selectorDependencyNodes;
  }
  visitSelectorDependents(node, budget2, visitor) {
    const dependents = this.#reverseEdges.get(node);
    return dependents?.visitWithin(budget2, visitor) ?? true;
  }
  getSelectorGraphVersion() {
    return this.#selectorGraphVersion;
  }
  beginSelectorGraphObservation(newlyAcceptedDependency) {
    if (!this.coordinator.runtimeDomain.selectors.has(newlyAcceptedDependency)) {
      return;
    }
    if (this.#selectorGraphObserverCount === 0) {
      this.#observedSelectorEdgeAdditions = [];
      this.#selectorGraphObservationIncomplete = false;
    }
    this.#selectorGraphObserverCount++;
    let cursor2 = this.#observedSelectorEdgeAdditions?.length ?? 0;
    let closed = false;
    return Object.freeze({
      takeAddedEdges: () => {
        if (closed || this.#selectorGraphObservationIncomplete) {
          return;
        }
        const additions = this.#observedSelectorEdgeAdditions;
        if (additions === undefined)
          return;
        if (cursor2 === additions.length) {
          return EMPTY_SELECTOR_EDGE_ADDITIONS;
        }
        const result = Object.freeze(additions.slice(cursor2));
        cursor2 = additions.length;
        return result;
      },
      close: () => {
        if (closed)
          return;
        closed = true;
        this.#selectorGraphObserverCount--;
        if (this.#selectorGraphObserverCount !== 0)
          return;
        this.#observedSelectorEdgeAdditions = undefined;
        this.#selectorGraphObservationIncomplete = false;
      }
    });
  }
  getComparisonBaseline(node) {
    const record = this.#selectorRecords.get(node);
    if (record?.lastSuccess === undefined)
      return;
    return record.served.outcome.kind === "value" ? Object.freeze({
      current: true,
      value: record.lastSuccess.value,
      token: record.served.token
    }) : Object.freeze({
      current: false,
      value: record.lastSuccess.value
    });
  }
  createOutcomeToken() {
    return this.coordinator.createOutcomeToken();
  }
  publishEscapedFailure(selector, error, session) {
    const previous = this.#selectorRecords.get(selector);
    const dependencies = session.getProposedDependencies(this, selector) ?? previous?.dependencies;
    const fault = session.getControlFault();
    const retry = fault.kind !== "fault" && (dependencies === undefined || dependencies.length === 0);
    if (fault.kind === "fault" ? !this.coordinator.postSourceApply || this.coordinator.external?.dormantPull === true : retry && previous === undefined && !session.evaluating)
      throw error;
    this.coordinator.reportSelectorFailure(error);
    const served = this.#installSelectorProposal(selector, {
      token: this.createOutcomeToken(),
      outcome: Object.freeze(fault.kind === "fault" ? { ...fault, kind: "control-error" } : { kind: "error", error }),
      dependencies: dependencies ?? EMPTY_DEPENDENCIES
    }, session);
    if (retry)
      (this.#retrySelectors ??= new WeakMap).set(selector, this.coordinator.settlementEpoch);
    return served;
  }
  #claimRetry(selector) {
    const epoch = this.#retrySelectors?.get(selector);
    if (epoch === undefined || epoch === this.coordinator.settlementEpoch)
      return false;
    this.#retrySelectors.delete(selector);
    return true;
  }
  #installSelectorProposal(selector, proposal, session) {
    const previous = this.#selectorRecords.get(selector);
    const served = Object.freeze({
      token: proposal.token,
      outcome: proposal.outcome
    });
    let record = {
      served,
      dependencies: proposal.dependencies,
      lastSuccess: proposal.outcome.kind === "value" ? Object.freeze({
        value: proposal.outcome.value,
        token: proposal.token
      }) : previous?.lastSuccess
    };
    record = this.coordinator.external?.selectorRecord(this, record, session) ?? Object.freeze(record);
    const topologyChanged = this.#replaceReverseEdges(selector, previous?.dependencies ?? EMPTY_DEPENDENCIES, proposal.dependencies);
    const addedSelectorEdges = topologyChanged ? this.#collectObservedSelectorEdgeAdditions(selector, previous?.dependencies ?? EMPTY_DEPENDENCIES, proposal.dependencies) : undefined;
    if (topologyChanged)
      this.#selectorDependencyNodes?.delete(selector);
    this.#selectorGraphVersion++;
    session.noteSelectorGraphPublication(this);
    this.#selectorRecords.set(selector, record);
    this.coordinator.external?.publishedSelector(this, selector, previous, record);
    this.#dirtySelectors.delete(selector);
    this.#retrySelectors?.delete(selector);
    if (addedSelectorEdges !== undefined) {
      this.#appendObservedSelectorEdgeAdditions(addedSelectorEdges);
    }
    if (previous !== undefined && !Object.is(previous.served.token, proposal.token)) {
      this.coordinator.reachSubscriptionTarget(this, selector);
      this.markDependents(selector);
    }
    if (proposal.outcome.kind === "control-error") {
      this.coordinator.latchPropagationControlFault(record.served.outcome);
    }
    return record.served;
  }
  #replaceReverseEdges(selector, previous, next) {
    if (previous.length === next.length) {
      let index = 0;
      while (index < previous.length && Object.is(previous[index].node, next[index].node)) {
        index++;
      }
      if (index === previous.length)
        return false;
    }
    for (const dependency of previous) {
      const dependents = this.#reverseEdges.get(dependency.node);
      dependents?.delete(selector);
      if (dependents?.isEmpty()) {
        this.#reverseEdges.delete(dependency.node);
      }
    }
    for (const dependency of next) {
      let dependents = this.#reverseEdges.get(dependency.node);
      if (dependents === undefined) {
        dependents = this.#weakRoutes();
        this.#reverseEdges.set(dependency.node, dependents);
      }
      dependents.add(selector);
    }
    return true;
  }
  #collectObservedSelectorEdgeAdditions(selector, previous, next) {
    if (this.#selectorGraphObserverCount === 0 || this.#selectorGraphObservationIncomplete) {
      return;
    }
    const observed = this.#observedSelectorEdgeAdditions;
    if (observed === undefined) {
      this.#invalidateSelectorGraphObservation();
      return;
    }
    const remainingCapacity = MAX_OBSERVED_SELECTOR_EDGE_ADDITIONS - observed.length;
    const selectors = this.coordinator.runtimeDomain.selectors;
    const previousSelectorNodes = new Set;
    for (const dependency of previous) {
      if (selectors.has(dependency.node)) {
        previousSelectorNodes.add(dependency.node);
      }
    }
    const added = [];
    for (const dependency of next) {
      if (selectors.has(dependency.node) && !previousSelectorNodes.has(dependency.node)) {
        added.push(Object.freeze({ tail: selector, head: dependency.node }));
        if (added.length > remainingCapacity) {
          this.#invalidateSelectorGraphObservation();
          return;
        }
      }
    }
    return added;
  }
  #appendObservedSelectorEdgeAdditions(additions) {
    if (additions.length === 0)
      return;
    const observed = this.#observedSelectorEdgeAdditions;
    if (observed === undefined || observed.length + additions.length > MAX_OBSERVED_SELECTOR_EDGE_ADDITIONS) {
      this.#invalidateSelectorGraphObservation();
      return;
    }
    observed.push(...additions);
  }
  #invalidateSelectorGraphObservation() {
    if (this.#selectorGraphObserverCount === 0)
      return;
    this.#observedSelectorEdgeAdditions = [];
    this.#selectorGraphObservationIncomplete = true;
  }
  #weakRoutes() {
    return new WeakHandleSet(this.coordinator.instrumented ? () => this.coordinator.recordCounter(2 /* deadRouteCompactions */) : undefined);
  }
}
var EMPTY_DEPENDENCIES = Object.freeze([]);

// packages/valdres/src/v1-internal/committed-store-tree/tree-transaction.ts
class TreeDraft {
  commitEntries;
  transaction = Object.freeze({});
  onAllocation;
  #singleIntentScope;
  #singleIntent;
  #secondIntent;
  #intentBucket;
  #intentScopes;
  #singleBaselineScope;
  #singleBaselineAtom;
  #singleBaseline;
  #secondBaselineAtom;
  #secondBaseline;
  #baselineBucket;
  #baselineScopes;
  #singleFallbackAtom;
  #singleFallback;
  #fallbackMemo;
  #scratchHosts;
  externalCaptures;
  #rowRelease;
  #hasRowIntents = false;
  generation = 0;
  active = true;
  constructor(onStorageAllocation) {
    this.onAllocation = onStorageAllocation;
  }
  get hasIntents() {
    return this.#singleIntent !== undefined || this.#secondIntent !== undefined || this.#intentBucket !== undefined || this.#intentScopes !== undefined;
  }
  get hasRows() {
    return this.#hasRowIntents;
  }
  installRows(release) {
    const current = this.#rowRelease;
    if (current !== undefined && current !== release) {
      throw new Error;
    }
    this.#rowRelease = release;
  }
  markRow(expectedGeneration) {
    if (this.#rowRelease === undefined) {
      throw new Error;
    }
    if (expectedGeneration !== this.generation) {
      throw new Error;
    }
    this.#hasRowIntents = true;
    this.#advanceGeneration();
  }
  get singleIntentScope() {
    return this.#singleIntentScope;
  }
  get singleIntent() {
    return this.#secondIntent === undefined ? this.#singleIntent : undefined;
  }
  stage(scope, intent) {
    const intentScopes = this.#intentScopes;
    if (intentScopes !== undefined) {
      let intents = intentScopes.get(scope);
      if (intents === undefined) {
        intents = this.#allocateMap();
        intentScopes.set(scope, intents);
      }
      intents.set(intent.atom, intent);
      this.#advanceGeneration();
      return;
    }
    const intentBucket = this.#intentBucket;
    if (intentBucket !== undefined) {
      if (Object.is(this.#singleIntentScope, scope)) {
        intentBucket.set(intent.atom, intent);
      } else {
        const scopes = this.#allocateMap();
        scopes.set(this.#singleIntentScope, intentBucket);
        const next = this.#allocateMap();
        next.set(intent.atom, intent);
        scopes.set(scope, next);
        this.#intentScopes = scopes;
        this.#intentBucket = undefined;
        this.#singleIntentScope = undefined;
      }
      this.#advanceGeneration();
      return;
    }
    const singleIntent = this.#singleIntent;
    if (singleIntent === undefined) {
      this.#singleIntentScope = scope;
      this.#singleIntent = intent;
      this.#advanceGeneration();
      return;
    }
    if (Object.is(this.#singleIntentScope, scope) && Object.is(singleIntent.atom, intent.atom)) {
      this.#singleIntent = intent;
      this.#advanceGeneration();
      return;
    }
    if (Object.is(this.#singleIntentScope, scope)) {
      const secondIntent = this.#secondIntent;
      if (secondIntent === undefined) {
        this.#secondIntent = intent;
        this.#advanceGeneration();
        return;
      }
      if (Object.is(secondIntent.atom, intent.atom)) {
        this.#secondIntent = intent;
        this.#advanceGeneration();
        return;
      }
      const intents = this.#allocateMap();
      intents.set(singleIntent.atom, singleIntent);
      intents.set(secondIntent.atom, secondIntent);
      intents.set(intent.atom, intent);
      this.#intentBucket = intents;
    } else {
      const scopes = this.#allocateMap();
      const first = this.#allocateMap();
      first.set(singleIntent.atom, singleIntent);
      if (this.#secondIntent !== undefined) {
        first.set(this.#secondIntent.atom, this.#secondIntent);
      }
      scopes.set(this.#singleIntentScope, first);
      const next = this.#allocateMap();
      next.set(intent.atom, intent);
      scopes.set(scope, next);
      this.#intentScopes = scopes;
      this.#singleIntentScope = undefined;
    }
    this.#singleIntent = undefined;
    this.#secondIntent = undefined;
    this.#advanceGeneration();
  }
  forEachIntent(visit) {
    const singleIntent = this.#singleIntent;
    if (singleIntent !== undefined) {
      visit(this.#singleIntentScope, singleIntent);
      if (this.#secondIntent !== undefined) {
        visit(this.#singleIntentScope, this.#secondIntent);
      }
      return;
    }
    const intentBucket = this.#intentBucket;
    if (intentBucket !== undefined) {
      const scope = this.#singleIntentScope;
      for (const intent of intentBucket.values())
        visit(scope, intent);
      return;
    }
    const intentScopes = this.#intentScopes;
    if (intentScopes === undefined)
      return;
    for (const [scope, intents] of intentScopes) {
      for (const intent of intents.values())
        visit(scope, intent);
    }
  }
  getIntent(scope, atom) {
    const singleIntent = this.#singleIntent;
    if (singleIntent !== undefined && Object.is(this.#singleIntentScope, scope) && Object.is(singleIntent.atom, atom)) {
      return singleIntent;
    }
    const secondIntent = this.#secondIntent;
    if (secondIntent !== undefined && Object.is(this.#singleIntentScope, scope) && Object.is(secondIntent.atom, atom)) {
      return secondIntent;
    }
    if (Object.is(this.#singleIntentScope, scope)) {
      return this.#intentBucket?.get(atom);
    }
    return this.#intentScopes?.get(scope)?.get(atom);
  }
  getAtomBaseline(scope, atom) {
    if (this.#singleBaseline !== undefined && Object.is(this.#singleBaselineScope, scope) && Object.is(this.#singleBaselineAtom, atom)) {
      return this.#singleBaseline;
    }
    if (this.#secondBaseline !== undefined && Object.is(this.#singleBaselineScope, scope) && Object.is(this.#secondBaselineAtom, atom)) {
      return this.#secondBaseline;
    }
    if (Object.is(this.#singleBaselineScope, scope)) {
      return this.#baselineBucket?.get(atom);
    }
    return this.#baselineScopes?.get(scope)?.get(atom);
  }
  setAtomBaseline(scope, atom, baseline) {
    const baselineScopes = this.#baselineScopes;
    if (baselineScopes !== undefined) {
      let baselines = baselineScopes.get(scope);
      if (baselines === undefined) {
        baselines = this.#allocateMap();
        baselineScopes.set(scope, baselines);
      }
      if (!baselines.has(atom))
        baselines.set(atom, baseline);
      return;
    }
    const baselineBucket = this.#baselineBucket;
    if (baselineBucket !== undefined) {
      if (Object.is(this.#singleBaselineScope, scope)) {
        if (!baselineBucket.has(atom)) {
          baselineBucket.set(atom, baseline);
        }
      } else {
        const scopes = this.#allocateMap();
        scopes.set(this.#singleBaselineScope, baselineBucket);
        const next = this.#allocateMap();
        next.set(atom, baseline);
        scopes.set(scope, next);
        this.#baselineScopes = scopes;
        this.#baselineBucket = undefined;
        this.#singleBaselineScope = undefined;
      }
      return;
    }
    const singleBaseline = this.#singleBaseline;
    if (singleBaseline === undefined) {
      this.#singleBaselineScope = scope;
      this.#singleBaselineAtom = atom;
      this.#singleBaseline = baseline;
      return;
    }
    if (Object.is(this.#singleBaselineScope, scope) && Object.is(this.#singleBaselineAtom, atom)) {
      return;
    }
    if (Object.is(this.#singleBaselineScope, scope)) {
      const secondBaseline = this.#secondBaseline;
      if (secondBaseline === undefined) {
        this.#secondBaselineAtom = atom;
        this.#secondBaseline = baseline;
        return;
      }
      if (Object.is(this.#secondBaselineAtom, atom))
        return;
      const baselines = this.#allocateMap();
      baselines.set(this.#singleBaselineAtom, singleBaseline);
      baselines.set(this.#secondBaselineAtom, secondBaseline);
      baselines.set(atom, baseline);
      this.#baselineBucket = baselines;
    } else {
      const scopes = this.#allocateMap();
      const first = this.#allocateMap();
      first.set(this.#singleBaselineAtom, singleBaseline);
      if (this.#secondBaselineAtom !== undefined && this.#secondBaseline !== undefined) {
        first.set(this.#secondBaselineAtom, this.#secondBaseline);
      }
      scopes.set(this.#singleBaselineScope, first);
      const next = this.#allocateMap();
      next.set(atom, baseline);
      scopes.set(scope, next);
      this.#baselineScopes = scopes;
      this.#singleBaselineScope = undefined;
    }
    this.#singleBaselineAtom = undefined;
    this.#singleBaseline = undefined;
    this.#secondBaselineAtom = undefined;
    this.#secondBaseline = undefined;
  }
  getFallback(atom) {
    if (Object.is(this.#singleFallbackAtom, atom)) {
      return this.#singleFallback;
    }
    return this.#fallbackMemo?.get(atom);
  }
  hasFallback(atom) {
    return Object.is(this.#singleFallbackAtom, atom) || (this.#fallbackMemo?.has(atom) ?? false);
  }
  setFallback(atom, outcome) {
    const fallbackMemo = this.#fallbackMemo;
    if (fallbackMemo !== undefined) {
      fallbackMemo.set(atom, outcome);
      return;
    }
    if (this.#singleFallback === undefined) {
      this.#singleFallbackAtom = atom;
      this.#singleFallback = outcome;
      return;
    }
    if (Object.is(this.#singleFallbackAtom, atom)) {
      this.#singleFallback = outcome;
      return;
    }
    const memo = this.#allocateMap();
    memo.set(this.#singleFallbackAtom, this.#singleFallback);
    memo.set(atom, outcome);
    this.#fallbackMemo = memo;
    this.#singleFallbackAtom = undefined;
    this.#singleFallback = undefined;
  }
  forEachFallback(visit) {
    if (this.#singleFallbackAtom !== undefined && this.#singleFallback !== undefined) {
      visit(this.#singleFallbackAtom, this.#singleFallback);
    }
    if (this.#fallbackMemo !== undefined) {
      for (const [atom, outcome] of this.#fallbackMemo) {
        visit(atom, outcome);
      }
    }
  }
  #advanceGeneration() {
    this.generation += 1;
    const scratchHosts = this.#scratchHosts;
    if (scratchHosts !== undefined) {
      for (const scratchHost of scratchHosts.values()) {
        scratchHost.advanceGeneration(this.generation);
      }
    }
  }
  getScratchHost(scope) {
    return this.#scratchHosts?.get(scope);
  }
  installScratchHost(scope, scratchHost) {
    let scratchHosts = this.#scratchHosts;
    const allocated = scratchHosts === undefined;
    if (scratchHosts === undefined) {
      scratchHosts = new Map;
      this.#scratchHosts = scratchHosts;
    }
    scratchHosts.set(scope, scratchHost);
    return allocated;
  }
  close() {
    if (!this.active)
      return;
    this.active = false;
    const scratchHosts = this.#scratchHosts;
    if (scratchHosts !== undefined) {
      for (const scratchHost of scratchHosts.values()) {
        scratchHost.revoke();
      }
      scratchHosts.clear();
    }
    this.#scratchHosts = undefined;
  }
  release() {
    this.commitEntries = undefined;
    const releaseRows = this.#rowRelease;
    this.#rowRelease = undefined;
    this.#hasRowIntents = false;
    try {
      this.#intentBucket?.clear();
      if (this.#intentScopes !== undefined) {
        for (const intents of this.#intentScopes.values()) {
          intents.clear();
        }
        this.#intentScopes.clear();
      }
      this.#baselineBucket?.clear();
      if (this.#baselineScopes !== undefined) {
        for (const baselines of this.#baselineScopes.values()) {
          baselines.clear();
        }
        this.#baselineScopes.clear();
      }
      this.#fallbackMemo?.clear();
      this.#singleIntentScope = undefined;
      this.#singleIntent = undefined;
      this.#secondIntent = undefined;
      this.#intentBucket = undefined;
      this.#intentScopes = undefined;
      this.#singleBaselineScope = undefined;
      this.#singleBaselineAtom = undefined;
      this.#singleBaseline = undefined;
      this.#secondBaselineAtom = undefined;
      this.#secondBaseline = undefined;
      this.#baselineBucket = undefined;
      this.#baselineScopes = undefined;
      this.#singleFallbackAtom = undefined;
      this.#singleFallback = undefined;
      this.#fallbackMemo = undefined;
      this.#scratchHosts?.clear();
      this.#scratchHosts = undefined;
      this.externalCaptures?.clear();
      this.externalCaptures = undefined;
    } finally {
      releaseRows?.(this);
    }
  }
  #allocateMap() {
    this.onAllocation?.();
    return new Map;
  }
}

class RootTransactionCursor {
  constructor(host, draft, scope) {
    this.onCommit = (callback) => host.registerCommit(draft, scope, callback);
    this.get = (state) => host.transactionGet(draft, scope, state);
    this.set = (target, value) => host.mutate(draft, scope, "set", target, value);
    this.update = (target, update) => host.mutate(draft, scope, "update", target, update);
    this.reset = (target) => host.mutate(draft, scope, "reset", target);
    this.delete = (row) => host.mutate(draft, scope, "delete", row);
    this.resetAll = function() {
      host.resetAll(draft, scope, arguments.length);
    };
    this.scope = (...args) => host.transactionScope(draft, scope, args[0], args.length, args[1]);
    brandRuntimeHandle(this, host.runtimeDomain.ownerToken);
    host.runtimeDomain.transactionCursors.set(this, draft);
    Object.freeze(this);
  }
}
var createRootTransactionCursor = (host, draft, scope) => new RootTransactionCursor(host, draft, scope);
var inspectTransactionCallbackResult = (result) => {
  const inspected = inspectThenable2(result);
  if (inspected.kind === "not-thenable")
    return;
  if (inspected.kind === "inspection-error")
    throw inspected.error;
  containThenable2(inspected);
  throw new InvalidTransactionCallbackResultError;
};
var rethrowTransactionCallbackThrow = (thrown) => {
  const inspected = inspectThenable2(thrown);
  if (inspected.kind === "not-thenable")
    throw thrown;
  if (inspected.kind === "inspection-error")
    throw inspected.error;
  containThenable2(inspected);
  throw new InvalidTransactionCallbackResultError;
};

// packages/valdres/src/v1-internal/committed-store-tree/committed-store-tree.ts
var REACTION_WAVE_LIMIT = 64;
var createUnsubscribe = (registration) => function unsubscribe() {
  const target = registration.target;
  if (target === undefined)
    return;
  target.host.removeSubscription(registration);
};
var definitionDomainRecords = Symbol("definition domain records");
var getDefinitionDomainIdentity = (domain) => domain[definitionDomainRecords].ownerToken;
var getExternalDomainRecords = (domain) => domain[definitionDomainRecords];
var ensureCollectionKernel = (domain, create) => {
  const records = domain[definitionDomainRecords];
  const current = records[COLLECTION_KERNEL];
  if (current !== undefined)
    return current;
  const created = create(records);
  records[COLLECTION_KERNEL] = created;
  return created;
};
var EMPTY_READ_GUARDS = Object.freeze([]);
var runDefinitionCallback = (domain, phase, callback, args, validate, createAccessorFault) => {
  const records = domain[definitionDomainRecords];
  const session = new SelectorEvaluationSession;
  const currentActivity = records.activity;
  let selectorActivity = currentActivity?.kind === "selector" ? currentActivity : currentActivity?.kind === "guarded-callback" ? currentActivity.selectorActivity : undefined;
  const selectorSessions = [];
  while (selectorActivity !== undefined) {
    const selectorSession = selectorActivity.session;
    if (!selectorSessions.includes(selectorSession)) {
      selectorSessions.push(selectorSession);
    }
    selectorActivity = selectorActivity.parentSelectorActivity;
  }
  const allowDefinitions = phase === "factory";
  const previous = records[DEFINITION_CALLBACK_FRAME];
  records[DEFINITION_CALLBACK_FRAME] = {
    session,
    definitions: allowDefinitions ? new WeakSet : undefined,
    allowDefinitions,
    ...createAccessorFault === undefined ? {} : { createAccessorFault }
  };
  const previousReadGuards = selectorSessions.length === 0 ? EMPTY_READ_GUARDS : selectorSessions.map((selectorSession) => Object.freeze({
    selectorSession,
    previous: selectorSession.setSuppliedReadGuard(() => {
      const activity = records.activity;
      return rejectGuardedSelectorRead(activity?.kind === "guarded-callback" ? activity.session : session, selectorSession);
    })
  }));
  try {
    return runGuardedCallback(records, session, () => {
      const result = Reflect.apply(callback, undefined, args);
      return validate === undefined ? result : validate(result);
    });
  } finally {
    for (let index = previousReadGuards.length - 1;index >= 0; index--) {
      const guard = previousReadGuards[index];
      guard.selectorSession.setSuppliedReadGuard(guard.previous);
    }
    if (previous === undefined) {
      delete records[DEFINITION_CALLBACK_FRAME];
    } else {
      records[DEFINITION_CALLBACK_FRAME] = previous;
    }
  }
};
var assertDefinitionAccessorCallAllowed = (domain) => {
  const frame = domain[definitionDomainRecords][DEFINITION_CALLBACK_FRAME];
  if (frame === undefined || frame.allowDefinitions)
    return;
  const controlFault = frame.session.getControlFault();
  if (controlFault.kind === "fault")
    throw controlFault.error;
  const error = frame.createAccessorFault === undefined ? new CallbackCapabilityError : frame.accessorFault ??= frame.createAccessorFault();
  frame.session.latchControlFault(error);
  throw error;
};
var assertDefinitionConstructionAllowed = (domain) => assertRuntimeDefinitionConstructionAllowed(domain[definitionDomainRecords]);
var assertDefinitionFamilyCallAllowed = assertDefinitionAccessorCallAllowed;
var registerDefinitionHandle = (domain, mutableHandle) => registerRuntimeStateHandle(domain[definitionDomainRecords], mutableHandle);
var classifyDefinitionHandleOwner = (domain, value) => classifyEntryOwner(domain[definitionDomainRecords], value, new SelectorEvaluationSession);
var assertDefinitionState = (domain, value) => {
  const records = domain[definitionDomainRecords];
  if ((typeof value === "object" || typeof value === "function") && value !== null && records.states.has(value) && (records.atoms.has(value) || records.selectors.has(value) || records.externalAtoms?.has(value))) {
    const frame = records[DEFINITION_CALLBACK_FRAME];
    if (frame?.definitions?.has(value) || records[FAMILY_DEFINITIONS]?.has(value)) {
      return value;
    }
    return;
  }
  classifyEntryOwner(records, value, new SelectorEvaluationSession);
  return;
};

class RetainedFamilyAtoms extends Set {
  release(coordinator) {
    coordinator.recordCounter(34 /* familyOwnerReleases */, this.size);
  }
}

class ReacquirableAtoms extends WeakSet {
  apply(scope, { atom, kind }) {
    let retained = scope[REACQUIRABLE_ATOMS];
    if (kind === "set") {
      if (!this.has(atom))
        return false;
      if (retained === undefined) {
        retained = scope[REACQUIRABLE_ATOMS] = new RetainedFamilyAtoms;
        scope.coordinator.recordCounter(32 /* familyOwnerRetentionSetsCreated */);
      }
      const before = retained.size;
      retained.add(atom);
      if (retained.size !== before)
        scope.coordinator.recordCounter(33 /* familyOwnerRetains */);
      return true;
    } else {
      if (retained?.delete(atom))
        scope.coordinator.recordCounter(34 /* familyOwnerReleases */);
      if (retained?.size === 0)
        scope[REACQUIRABLE_ATOMS] = undefined;
      return false;
    }
  }
}
var markReacquirableDefinitionState = (domain, state) => {
  const records = domain[definitionDomainRecords];
  const definitions = records[FAMILY_DEFINITIONS] ?? (records[FAMILY_DEFINITIONS] = new WeakSet);
  definitions.add(state);
  if (!records.atoms.has(state))
    return;
  const reacquirable = records[REACQUIRABLE_ATOMS] ?? (records[REACQUIRABLE_ATOMS] = new ReacquirableAtoms);
  reacquirable.add(state);
};
var internalInstrumentationCounters = new WeakMap;
var valueOutcome = (value) => Object.freeze({ kind: "value", value });
var errorOutcome = (error) => Object.freeze({ kind: "error", error });
var fromSynchronousResult = (result) => result.kind === "value" ? valueOutcome(result.value) : errorOutcome(result.error);
var collectionSource = (domain, node) => domain[COLLECTION_KERNEL]?.has(node) ? domain[COLLECTION_KERNEL] : undefined;
var readCollectionValue = (kernel, draft, scope, node) => {
  const outcome = kernel.read(draft, scope, node);
  if (outcome.kind !== "value")
    throw outcome.error;
  return outcome.value;
};
var createCommitWorksets = (onAllocation) => ({
  onAllocation,
  preflightAtom: undefined,
  preflightScope: undefined,
  preflightOutcome: undefined,
  secondPreflightAtom: undefined,
  secondPreflightScope: undefined,
  secondPreflightOutcome: undefined,
  preflight: undefined,
  consideredRecord: undefined,
  secondConsideredRecord: undefined,
  considered: undefined,
  affectedRecord: undefined,
  affectedBefore: undefined,
  secondAffectedRecord: undefined,
  secondAffectedBefore: undefined,
  affected: undefined
});
var allocateCommitMap = (worksets) => {
  worksets.onAllocation?.();
  return new Map;
};
var allocateCommitSet = (worksets) => {
  worksets.onAllocation?.();
  return new Set;
};
var getPreflightOutcome = (worksets, atom, scope) => {
  if (worksets.preflightOutcome !== undefined && Object.is(worksets.preflightAtom, atom) && Object.is(worksets.preflightScope, scope)) {
    return worksets.preflightOutcome;
  }
  if (worksets.secondPreflightOutcome !== undefined && Object.is(worksets.secondPreflightAtom, atom) && Object.is(worksets.secondPreflightScope, scope)) {
    return worksets.secondPreflightOutcome;
  }
  return worksets.preflight?.get(atom)?.get(scope);
};
var setPreflightOutcome = (worksets, atom, scope, outcome) => {
  if (worksets.preflightOutcome === undefined) {
    worksets.preflightAtom = atom;
    worksets.preflightScope = scope;
    worksets.preflightOutcome = outcome;
    return;
  }
  if (Object.is(worksets.preflightAtom, atom) && Object.is(worksets.preflightScope, scope)) {
    return;
  }
  if (worksets.secondPreflightOutcome === undefined) {
    worksets.secondPreflightAtom = atom;
    worksets.secondPreflightScope = scope;
    worksets.secondPreflightOutcome = outcome;
    return;
  }
  if (Object.is(worksets.secondPreflightAtom, atom) && Object.is(worksets.secondPreflightScope, scope)) {
    return;
  }
  let preflight = worksets.preflight;
  if (preflight === undefined) {
    preflight = allocateCommitMap(worksets);
    worksets.preflight = preflight;
  }
  let byScope = preflight.get(atom);
  if (byScope === undefined) {
    byScope = allocateCommitMap(worksets);
    preflight.set(atom, byScope);
  }
  byScope.set(scope, outcome);
};
var markConsidered = (worksets, record) => {
  if (Object.is(worksets.consideredRecord, record) || Object.is(worksets.secondConsideredRecord, record)) {
    return false;
  }
  if (worksets.consideredRecord === undefined) {
    worksets.consideredRecord = record;
    return true;
  }
  if (worksets.secondConsideredRecord === undefined) {
    worksets.secondConsideredRecord = record;
    return true;
  }
  let considered = worksets.considered;
  if (considered === undefined) {
    considered = allocateCommitSet(worksets);
    worksets.considered = considered;
  }
  if (considered.has(record))
    return false;
  considered.add(record);
  return true;
};
var markAffected = (worksets, record, before) => {
  if (worksets.affectedRecord === undefined) {
    worksets.affectedRecord = record;
    worksets.affectedBefore = before;
    return;
  }
  if (worksets.secondAffectedRecord === undefined) {
    worksets.secondAffectedRecord = record;
    worksets.secondAffectedBefore = before;
    return;
  }
  let affected = worksets.affected;
  if (affected === undefined) {
    affected = allocateCommitMap(worksets);
    worksets.affected = affected;
  }
  affected.set(record, before);
};

class CommittedStoreTreeHost {
  #fallbackRecords = new WeakMap;
  #external;
  #operationCursor;
  #operationEpoch;
  subscriberReading = false;
  #rootScope;
  #nextToken = 1;
  sourceEpoch = 0;
  #postSourceApply = false;
  #propagationQueue;
  #propagationStatusScope;
  #propagationStatusSelector;
  #propagationStatusBits = 0;
  #propagationStatuses;
  #propagationControlFault;
  #subscriptionTargets;
  #nextNotificationEpoch = 1;
  #notificationEpoch = 0;
  #notificationTarget;
  #remainingNotificationTargets;
  #reactionQueue;
  #reactionDepth = 0;
  #reactionFailure;
  #settlementFailures;
  #externalSettlement = false;
  settlementEpoch = 0;
  #domain;
  #counters;
  #trace;
  evaluate;
  constructor(domain, instrumentation, trace) {
    this.#domain = domain;
    this.#counters = instrumentation === undefined ? undefined : internalInstrumentationCounters.get(instrumentation);
    this.#trace = trace;
    this.evaluate = trace?.evaluate ?? evaluateSelector;
    this.#rootScope = new StoreScopeNode(this);
    this.recordCounter(7 /* scopeNodesCreated */);
  }
  get runtimeDomain() {
    return this.#domain;
  }
  get postSourceApply() {
    return this.#postSourceApply;
  }
  get instrumented() {
    return this.#counters !== undefined;
  }
  get rootScope() {
    return this.#rootScope;
  }
  recordCounter(counter, amount = 1) {
    const counters = this.#counters;
    if (counters === undefined)
      return;
    counters(counter, amount);
  }
  createDraft() {
    this.recordCounter(14 /* draftCreations */);
    return new TreeDraft(this.instrumented ? () => this.recordCounter(18 /* draftStorageAllocations */) : undefined);
  }
  get(scope, state) {
    const session = new SelectorEvaluationSession;
    const node = state;
    const ownerStatus = classifyEntryOwner(this.#domain, node, session);
    const subscriberSession = assertStoreReadAllowed(this.#domain, "StoreTree.get");
    this.#assertScopeLive(scope);
    if (ownerStatus === "invalid") {
      throw new TypeError("StoreTree.get requires a valid State");
    }
    const served = (subscriberSession === undefined && !this.#external ? scope.getMaterializedServedOutcome(node) : undefined) ?? this.#read(scope, node, session, subscriberSession);
    if (served.outcome.kind !== "value") {
      if (served.outcome.kind === "control-error")
        subscriberSession?.latchControlFault(served.outcome.error);
      throw served.outcome.error;
    }
    return served.outcome.value;
  }
  #read(scope, node, session, subscriberSession) {
    const outer = subscriberSession === undefined && !this.#external?.current(scope, node) && this.#beginOperation(1 /* read */);
    let served;
    this.subscriberReading = subscriberSession !== undefined;
    try {
      served = this.subscriberReading || !this.#external ? scope.serveKnownLocal(node, session) : this.#external.observe(scope, node, session);
    } catch (error) {
      const fault = session.getControlFault();
      if (fault.kind === "fault")
        subscriberSession?.latchControlFault(fault.error);
      if (outer)
        this.#external?.failure(error);
      throw error;
    } finally {
      this.subscriberReading = false;
      if (outer) {
        this.#operationCursor = undefined;
        this.#external?.finish();
      }
    }
    return (outer ? this.#external?.installed(scope, node) : undefined) ?? served;
  }
  #beginOperation(kind) {
    if (this.#operationCursor || this.#external?.idle === false)
      return false;
    this.#operationCursor = kind;
    this.#operationEpoch = this.sourceEpoch;
    this.external;
    return true;
  }
  #phase(phase) {
    if (this.#operationCursor)
      this.#operationCursor = phase + 1 << 2 /* phaseShift */ | this.#operationCursor & 3 /* kindMask */;
    this.#external?.phase(phase);
  }
  get external() {
    const plane = this.#external;
    if (plane?.idle && this.#operationCursor) {
      plane.beginHost(this.#operationCursor, this.#operationEpoch, this.#propagationControlFault);
      this.#propagationControlFault = undefined;
    }
    return plane;
  }
  reachExternal() {
    this.#external ??= this.#domain.externalRuntime.createTree(this);
    return this.external;
  }
  hasSubscription(scope, node) {
    return this.#subscriptionTargets?.get(scope)?.has(node) === true;
  }
  sub(scope, state, handlers) {
    const node = state;
    let session;
    const ownerStatus = this.#domain.states.has(node) ? "local" : classifyEntryOwner(this.#domain, node, session = new SelectorEvaluationSession);
    this.#assertScopeLive(scope, "StoreTree.sub");
    if (ownerStatus === "invalid" || !this.#domain.atoms.has(node) && !this.#domain.selectors.has(node) && !this.#domain.externalAtoms?.has(node) && !collectionSource(this.#domain, node)) {
      throw new TypeError("StoreTree.sub requires a valid State");
    }
    let callback = handlers;
    let reaction;
    if (typeof handlers !== "function") {
      let rest;
      ({
        settle: reaction,
        notify: callback,
        ...rest
      } = handlers ?? {});
      this.#assertScopeLive(scope);
      if (Reflect.ownKeys(rest).length > 0 || (reaction ?? callback) === undefined || reaction !== undefined && typeof reaction !== "function" || callback !== undefined && typeof callback !== "function") {
        throw new TypeError("StoreTree.sub requires a callback or settle/notify handlers");
      }
    }
    const current = scope.getMaterializedServedOutcome(node);
    const outer = (current === undefined || this.#external) && this.#beginOperation(2 /* subscribe */);
    try {
      const served = !this.#external ? current ?? scope.serveKnownLocal(node, session ?? new SelectorEvaluationSession) : this.#external.observe(scope, node, session ?? new SelectorEvaluationSession);
      if (served.outcome.kind === "control-error") {
        throw served.outcome.error;
      }
      let targets = this.#subscriptionTargets;
      if (targets === undefined) {
        targets = new Map;
        this.#subscriptionTargets = targets;
        if (this.instrumented) {
          this.recordCounter(20 /* subscriptionIndexMapsCreated */);
        }
      }
      let byState = targets.get(scope);
      if (byState === undefined) {
        byState = new Map;
        targets.set(scope, byState);
        if (this.instrumented) {
          this.recordCounter(20 /* subscriptionIndexMapsCreated */);
          this.recordCounter(25 /* activeSubscriptionScopes */);
        }
      }
      let target = byState.get(node);
      if (target === undefined) {
        target = {
          host: this,
          scope,
          state: node,
          head: undefined,
          tail: undefined,
          reachedEpoch: 0,
          reactions: 0
        };
        byState.set(node, target);
        if (this.instrumented) {
          this.recordCounter(21 /* subscriptionTargetsCreated */);
          this.recordCounter(26 /* activeSubscriptionTargets */);
        }
      }
      const registration = {
        callback,
        reaction,
        target,
        previous: target.tail,
        next: undefined
      };
      if (reaction)
        target.reactions++;
      if (target.tail === undefined) {
        target.head = registration;
      } else {
        target.tail.next = registration;
      }
      target.tail = registration;
      if (this.instrumented) {
        this.recordCounter(22 /* subscriptionRegistrations */);
        this.recordCounter(27 /* activeSubscriptions */);
        this.recordCounter(24 /* unsubscribeClosuresCreated */);
      }
      this.#external?.admit(registration, served.token);
      return createUnsubscribe(registration);
    } catch (error) {
      if (outer)
        this.#external?.failure(error);
      throw error;
    } finally {
      if (outer) {
        this.#operationCursor = undefined;
        this.#external?.finish();
      }
    }
  }
  removeSubscription(registration) {
    const target = registration.target;
    if (target === undefined)
      return;
    assertUnsubscribeAllowed(this.#domain);
    if (this.#external?.idle)
      return this.#external.cleanup(() => this.removeSubscription(registration));
    const previous = registration.previous;
    const next = registration.next;
    if (previous === undefined) {
      target.head = next;
    } else {
      previous.next = next;
    }
    if (next === undefined) {
      target.tail = previous;
    } else {
      next.previous = previous;
    }
    if (registration.reaction !== undefined) {
      registration.reaction = undefined;
      target.reactions--;
    }
    registration.callback = undefined;
    registration.target = undefined;
    registration.previous = undefined;
    registration.next = undefined;
    const instrumented = this.instrumented;
    if (instrumented) {
      this.recordCounter(23 /* subscriptionRemovals */);
      this.recordCounter(27 /* activeSubscriptions */, -1);
    }
    if (target.head !== undefined)
      return;
    const targets = this.#subscriptionTargets;
    const byState = targets?.get(target.scope);
    if (byState?.get(target.state) === target) {
      byState.delete(target.state);
      if (instrumented) {
        this.recordCounter(26 /* activeSubscriptionTargets */, -1);
      }
    }
    if (byState !== undefined && byState.size === 0) {
      targets?.delete(target.scope);
      if (instrumented) {
        this.recordCounter(25 /* activeSubscriptionScopes */, -1);
      }
    }
    if (targets?.size === 0)
      this.#subscriptionTargets = undefined;
    this.#external?.releaseRoot(target.scope, target.state);
  }
  scope(parent, argumentCount, id) {
    if (argumentCount !== 0 && (typeof id === "object" || typeof id === "function") && id !== null) {
      classifyEntryOwner(this.#domain, id, new SelectorEvaluationSession);
    }
    this.#assertScopeLive(parent, "StoreTree.scope");
    if (argumentCount === 0)
      return this.#createChildScope(parent);
    if (argumentCount !== 1 || typeof id !== "string") {
      throw new TypeError("StoreTree.scope requires a string name");
    }
    const existing = parent.namedChildren.get(id);
    if (existing !== undefined) {
      this.recordCounter(9 /* namedScopeHits */);
      return existing.facade;
    }
    this.recordCounter(10 /* namedScopeMisses */);
    return this.#createChildScope(parent, id);
  }
  dispose(scope) {
    assertStoreOperationAllowed(this.#domain, "StoreTree.dispose");
    if (scope.status !== "live")
      return;
    if (this.#external?.idle)
      return this.#external.cleanup(() => this.dispose(scope));
    const postorder = [];
    const pending2 = [Object.freeze({ node: scope, expanded: false })];
    while (pending2.length > 0) {
      const { node, expanded } = pending2.pop();
      if (expanded) {
        postorder.push(node);
        continue;
      }
      node.markDisposing();
      pending2.push(Object.freeze({ node, expanded: true }));
      const children = [];
      node.children.forEach((child) => children.push(child));
      for (let index = children.length - 1;index >= 0; index--) {
        pending2.push(Object.freeze({
          node: children[index],
          expanded: false
        }));
      }
    }
    for (const node of postorder) {
      this.recordCounter(5 /* disposalVisits */);
      const parent = node.parent;
      if (parent !== undefined) {
        if (node.name !== undefined && Object.is(parent.namedChildren.get(node.name), node)) {
          parent.namedChildren.delete(node.name);
        }
        parent.children.delete(node);
      }
      this.#dropSubscriptions(node);
      node.dropRecords();
      node.namedChildren.clear();
      node.children.clear();
      node.markDisposed();
    }
    discardDisposedCommits();
    if (Object.is(scope, this.#rootScope)) {
      this.#fallbackRecords = new WeakMap;
      this.#external = undefined;
    }
  }
  txn(scope, callback, name) {
    this.#assertScopeLive(scope, "StoreTree.txn");
    if (typeof callback !== "function" || name !== undefined && typeof name !== "string")
      throw new TypeError("StoreTree.txn requires a callback");
    const outer = this.#beginOperation(3 /* mutation */);
    try {
      return this.#transact(scope, callback);
    } catch (error) {
      if (outer)
        this.#external?.failure(error);
      throw error;
    } finally {
      if (outer) {
        this.#operationCursor = undefined;
        this.#external?.finish();
      }
    }
  }
  #transact(scope, callback) {
    const draft = this.createDraft();
    try {
      const cursor2 = createRootTransactionCursor(this, draft, scope);
      const result = runTransactionActivity(this.#domain, draft.transaction, () => callback(cursor2));
      draft.close();
      const resultSession = new SelectorEvaluationSession;
      runTransactionResultActivity(this.#domain, resultSession, () => inspectTransactionCallbackResult(result));
      this.#commitDraft(draft);
      return result;
    } finally {
      draft.close();
      draft.release();
    }
  }
  registerCommit(draft, scope, callback) {
    assertCursorOperationAllowed(this.#domain, draft.transaction, draft.active);
    this.#assertScopeLive(scope);
    if (typeof callback !== "function")
      throw new TypeError("Transaction.onCommit requires a function");
    (draft.commitEntries ??= []).push({ scope, callback });
  }
  get fallbackRecords() {
    return this.#fallbackRecords;
  }
  transactionGet(draft, scope, state) {
    const node = state;
    const session = new SelectorEvaluationSession;
    const ownerStatus = classifyEntryOwner(this.#domain, node, session);
    assertCursorOperationAllowed(this.#domain, draft.transaction, draft.active);
    this.#assertScopeLive(scope);
    if (ownerStatus === "invalid") {
      throw new TypeError("Transaction.get requires a valid State");
    }
    if (this.#domain.atoms.has(node)) {
      const outcome = this.readDraftAtomOutcome(draft, scope, node, session);
      if (outcome.kind !== "value")
        throw outcome.error;
      return outcome.value;
    }
    if (!this.#domain.selectors.has(node) && !this.#domain.externalAtoms?.has(node)) {
      const collectionKernel = collectionSource(this.#domain, node);
      if (!collectionKernel) {
        throw new TypeError("Transaction.get requires a readable State");
      }
      return readCollectionValue(collectionKernel, draft, scope, node);
    }
    let scratchHost = draft.getScratchHost(scope);
    if (scratchHost === undefined) {
      scratchHost = this.createScratchSelectorHost(draft, scope);
      if (draft.installScratchHost(scope, scratchHost)) {
        this.recordCounter(15 /* scratchMapAllocations */);
      }
    }
    return scratchHost.readSelector(node);
  }
  mutate(draft, scope, intent, target, input) {
    const node = target;
    const session = new SelectorEvaluationSession;
    const operation = `${draft === undefined ? "StoreTree" : "Transaction"}.${intent}`;
    const ownerStatus = classifyEntryOwner(this.#domain, node, session);
    if (draft === undefined) {
      assertStoreOperationAllowed(this.#domain, operation);
    } else {
      assertCursorOperationAllowed(this.#domain, draft.transaction, draft.active);
    }
    this.#assertScopeLive(scope);
    const atom = ownerStatus === "local" && this.#domain.atoms.has(node);
    let kernel;
    const invalid = atom ? intent === "delete" : ownerStatus !== "local" || typeof node === "function" || (kernel = collectionSource(this.#domain, node)) === undefined;
    if (invalid) {
      throw new TypeError(`${operation} requires a valid State`);
    }
    const outer = draft === undefined && this.#beginOperation(3 /* mutation */);
    try {
      const ownDraft = draft === undefined;
      const activeDraft = draft ?? this.createDraft();
      try {
        if (kernel !== undefined) {
          kernel.stage(activeDraft, scope, intent, node, input, session);
        } else if (intent === "set") {
          this.#stageAtomSet(activeDraft, scope, node, input, session);
        } else if (intent === "update") {
          this.#stageAtomUpdate(activeDraft, scope, node, input, session, operation);
        } else {
          this.#stageAtomReset(activeDraft, scope, node, session);
        }
        if (!ownDraft)
          return;
        activeDraft.close();
        this.#commitDraft(activeDraft);
      } finally {
        if (ownDraft) {
          activeDraft.close();
          activeDraft.release();
        }
      }
    } catch (error) {
      if (outer)
        this.#external?.failure(error);
      throw error;
    } finally {
      if (outer) {
        this.#operationCursor = undefined;
        this.#external?.finish();
      }
    }
  }
  transactionScope(draft, scope, target, argumentCount, callback) {
    const session = new SelectorEvaluationSession;
    if (typeof target !== "string") {
      classifyEntryOwner(this.#domain, target, session);
    }
    assertCursorOperationAllowed(this.#domain, draft.transaction, draft.active);
    this.#assertScopeLive(scope);
    const targetScope = this.#resolveTransactionScopeTarget(scope, target);
    if (argumentCount !== 1 && argumentCount !== 2) {
      throw new TypeError("Transaction.scope requires a target and optional callback");
    }
    const cursor2 = createRootTransactionCursor(this, draft, targetScope);
    if (argumentCount === 1)
      return cursor2;
    if (typeof callback !== "function") {
      throw new TypeError("Transaction.scope requires a callback function");
    }
    let result;
    try {
      result = callback(cursor2);
    } catch (thrown) {
      const resultSession2 = new SelectorEvaluationSession;
      return runTransactionResultActivity(this.#domain, resultSession2, () => rethrowTransactionCallbackThrow(thrown));
    }
    const resultSession = new SelectorEvaluationSession;
    runTransactionResultActivity(this.#domain, resultSession, () => inspectTransactionCallbackResult(result));
    return result;
  }
  createOutcomeToken() {
    return Object.freeze({ id: this.#nextToken++ });
  }
  createScratchSelectorHost(draft, scope, hydration = false) {
    this.recordCounter(3 /* scratchHostAllocations */);
    return new ScratchSelectorHost(Object.freeze({
      trackPath: hydration,
      resolve: (node, session) => this.#resolveScratchState(node, session),
      read: (source, kind, session, path) => this.#readDraftSourceOutcome(draft, scope, source, kind, session, path),
      baseline: hydration ? () => {
        return;
      } : (selector) => scope.captureCommittedSelectorSuccess(selector),
      run: (session, operation) => runSelectorActivity(this.#domain, session, operation)
    }), draft.generation, this.evaluate);
  }
  #resolveScratchState(node, session) {
    if (classifyOwner(this.#domain, node, session) === "invalid") {
      throw new TypeError("Selector get requires a valid State");
    }
    if (this.#domain.atoms.has(node)) {
      return Object.freeze({ kind: "atom" });
    }
    const definition = this.#domain.selectors.get(node);
    if (definition !== undefined) {
      return Object.freeze({ kind: "selector", definition });
    }
    if (collectionSource(this.#domain, node)) {
      return Object.freeze({ kind: "collection" });
    }
    if (this.#domain.externalAtoms?.has(node)) {
      return Object.freeze({ kind: "external" });
    }
    throw new TypeError("Unknown scratch StoreTree State");
  }
  #createChildScope(parent, name) {
    const child = new StoreScopeNode(this, parent, name);
    this.recordCounter(7 /* scopeNodesCreated */);
    const facade = new CommittedStoreTreeFacade(this, child, this.#trace);
    parent.children.add(child);
    if (name !== undefined)
      parent.namedChildren.set(name, child);
    return facade;
  }
  #resolveTransactionScopeTarget(current, target) {
    if (typeof target === "string") {
      const child = current.namedChildren.get(target);
      if (child === undefined)
        throw new ScopeNotFoundError;
      this.#assertScopeLive(child);
      return child;
    }
    const targetObject = target;
    const registeredStore = this.#domain.stores.get(targetObject);
    if (registeredStore !== undefined) {
      const targetScope = registeredStore;
      this.#assertScopeLive(targetScope);
      if (!Object.is(targetScope.coordinator, this)) {
        throw new StoreTreeMismatchError;
      }
      return targetScope;
    }
    const registeredCursor = this.#domain.transactionCursors.get(targetObject);
    if (registeredCursor !== undefined) {
      if (!registeredCursor.active) {
        throw new TransactionClosedError;
      }
      throw new InvalidTransactionTargetError;
    }
    throw new InvalidTransactionTargetError;
  }
  #assertScopeLive(scope, operation) {
    if (operation !== undefined)
      assertStoreOperationAllowed(this.#domain, operation);
    if (scope.status !== "live")
      throw new StoreDisposedError;
  }
  #dropSubscriptions(scope) {
    const targets = this.#subscriptionTargets;
    const byState = targets?.get(scope);
    if (byState === undefined)
      return;
    let removed = 0;
    for (const target of byState.values()) {
      let registration = target.head;
      while (registration !== undefined) {
        const next = registration.next;
        registration.callback = undefined;
        registration.reaction = undefined;
        registration.target = undefined;
        registration.previous = undefined;
        registration.next = undefined;
        removed++;
        registration = next;
      }
      target.head = undefined;
      target.tail = undefined;
      target.reactions = 0;
      this.#external?.releaseRoot(scope, target.state);
    }
    targets.delete(scope);
    if (targets.size === 0)
      this.#subscriptionTargets = undefined;
    if (this.instrumented) {
      this.recordCounter(23 /* subscriptionRemovals */, removed);
      this.recordCounter(27 /* activeSubscriptions */, -removed);
      this.recordCounter(26 /* activeSubscriptionTargets */, -byState.size);
      this.recordCounter(25 /* activeSubscriptionScopes */, -1);
    }
  }
  #stageAtomSet(draft, scope, atom, value, session) {
    const inspected = runGuardedCallback(this.#domain, session, () => inspectSynchronousAtomValue(value));
    if (inspected.kind === "error")
      throw inspected.error;
    const baseline = this.#getDraftAtomBaseline(draft, scope, atom, session);
    this.#stageAlreadyInspectedAtomSet(draft, scope, atom, inspected.value, baseline, session);
  }
  #stageAtomUpdate(draft, scope, atom, update, session, operation) {
    if (typeof update !== "function") {
      throw new TypeError(`${operation} requires an updater function`);
    }
    const baseline = this.#getDraftAtomBaseline(draft, scope, atom, session);
    const current = draft.hasIntents ? this.readDraftAtomOutcome(draft, scope, atom, session) : baseline.outcome;
    if (current.kind !== "value")
      throw current.error;
    const candidate = this.#runAtomUpdater(update, current.value, session);
    this.#stageAlreadyInspectedAtomSet(draft, scope, atom, candidate, baseline, session);
  }
  #stageAtomReset(draft, scope, atom, session) {
    draft.stage(scope, this.#resolveAtomReset(draft, scope, atom, session));
  }
  #resolveAtomReset(draft, scope, atom, session) {
    this.#getDraftAtomBaseline(draft, scope, atom, session);
    const after = scope.parent === undefined ? Object.freeze({
      outcome: this.#getDraftFallbackOutcome(draft, atom, session),
      reachesFallback: true
    }) : this.#readDraftAtomResolution(draft, scope.parent, atom, session);
    if (after.outcome.kind !== "value")
      throw after.outcome.error;
    const publishDraftFallback = after.reachesFallback && draft.hasFallback(atom);
    return Object.freeze({
      kind: "reset",
      atom,
      publishDraftFallback
    });
  }
  resetAll(draft, scope, argumentCount) {
    assertCursorOperationAllowed(this.#domain, draft.transaction, draft.active);
    this.#assertScopeLive(scope);
    if (argumentCount !== 0) {
      throw new TypeError("Transaction.resetAll accepts no arguments");
    }
    if (scope.parent === undefined) {
      throw new TypeError("Transaction.resetAll requires a child scope cursor");
    }
    const candidates = [];
    scope.ownedAtoms?.collect(candidates);
    scope[REACQUIRABLE_ATOMS]?.forEach((atom) => candidates.push(atom));
    draft.forEachIntent((intentScope, intent) => {
      if (Object.is(intentScope, scope))
        candidates.push(intent.atom);
    });
    const session = new SelectorEvaluationSession;
    const resets = [];
    const visited = new Set;
    for (const atom of candidates) {
      if (visited.has(atom))
        continue;
      visited.add(atom);
      const staged = draft.getIntent(scope, atom);
      if (staged === undefined) {
        if (!scope.atomOverrides.has(atom))
          continue;
      } else if (staged.kind === "reset")
        continue;
      resets.push(this.#resolveAtomReset(draft, scope, atom, session));
    }
    for (const intent of resets)
      draft.stage(scope, intent);
    this.#domain[COLLECTION_KERNEL]?.resetAll?.(draft, scope);
  }
  #getDraftAtomBaseline(draft, scope, atom, session) {
    const existing = draft.getAtomBaseline(scope, atom);
    if (existing !== undefined)
      return existing;
    const owned = scope.atomOverrides.has(atom);
    let current = scope;
    let inherited;
    while (current !== undefined) {
      if (current.atomOverrides.has(atom)) {
        inherited = valueOutcome(current.atomOverrides.get(atom));
        break;
      }
      current = current.parent;
    }
    const reachesFallback = inherited === undefined;
    const baseline = Object.freeze({
      owned,
      outcome: inherited ?? this.#getDraftFallbackOutcome(draft, atom, session),
      reachesFallback
    });
    draft.setAtomBaseline(scope, atom, baseline);
    return baseline;
  }
  readDraftAtomOutcome(draft, scope, atom, session) {
    return this.#readDraftAtomResolution(draft, scope, atom, session).outcome;
  }
  #readDraftSourceOutcome(draft, scope, source, kind, session, serverPath) {
    if (kind === "atom") {
      return this.readDraftAtomOutcome(draft, scope, source, session);
    }
    if (kind === "external")
      return this.#domain.externalRuntime.read(draft, source, session, serverPath, this.#counters);
    return this.#domain[COLLECTION_KERNEL].read(draft, scope, source);
  }
  #readDraftAtomResolution(draft, scope, atom, session) {
    let current = scope;
    while (current !== undefined) {
      const intent = draft.getIntent(current, atom);
      if (intent?.kind === "set") {
        return Object.freeze({
          outcome: valueOutcome(intent.value),
          reachesFallback: false
        });
      }
      if (intent === undefined && current.atomOverrides.has(atom)) {
        return Object.freeze({
          outcome: valueOutcome(current.atomOverrides.get(atom)),
          reachesFallback: false
        });
      }
      current = current.parent;
    }
    return Object.freeze({
      outcome: this.#getDraftFallbackOutcome(draft, atom, session),
      reachesFallback: true
    });
  }
  #getDraftFallbackOutcome(draft, atom, session) {
    const committed = this.#fallbackRecords.get(atom);
    if (committed !== undefined)
      return committed;
    const definition = this.#atomDefinition(atom);
    if (definition.fallback.kind === "eager") {
      return valueOutcome(definition.fallback.value);
    }
    const initialize = definition.fallback.initialize;
    const memoized = draft.getFallback(atom);
    if (memoized !== undefined)
      return memoized;
    const outcome = fromSynchronousResult(runGuardedCallback(this.#domain, session, () => runLazyInitializer(initialize)));
    draft.setFallback(atom, outcome);
    return outcome;
  }
  #canonicalizeAtomCandidate(atom, baseline, candidate, session) {
    const compare = this.#atomDefinition(atom).equal;
    if (compare === undefined) {
      return Object.is(baseline, candidate) ? baseline : candidate;
    }
    return this.#runAtomComparator(compare, baseline, candidate, session) ? baseline : candidate;
  }
  #runAtomComparator(compare, baseline, candidate, session) {
    return runGuardedCallback(this.#domain, session, () => {
      let returned;
      try {
        returned = compare(baseline, candidate);
      } catch (thrown) {
        const inspected2 = inspectThenable2(thrown);
        if (inspected2.kind === "not-thenable")
          throw thrown;
        if (inspected2.kind === "inspection-error") {
          throw inspected2.error;
        }
        containThenable2(inspected2);
        throw new InvalidAtomComparatorResultError;
      }
      const inspected = inspectThenable2(returned);
      if (inspected.kind === "inspection-error")
        throw inspected.error;
      if (inspected.kind === "thenable") {
        containThenable2(inspected);
        throw new InvalidAtomComparatorResultError;
      }
      if (returned !== true && returned !== false) {
        throw new InvalidAtomComparatorResultError;
      }
      return returned;
    });
  }
  #runAtomUpdater(update, current, session) {
    return runGuardedCallback(this.#domain, session, () => {
      let returned;
      try {
        returned = update(current);
      } catch (thrown) {
        const inspected2 = inspectThenable2(thrown);
        if (inspected2.kind === "not-thenable")
          throw thrown;
        if (inspected2.kind === "inspection-error") {
          throw inspected2.error;
        }
        containThenable2(inspected2);
        throw new InvalidSynchronousAtomValueError;
      }
      const inspected = inspectSynchronousAtomValue(returned);
      if (inspected.kind === "error")
        throw inspected.error;
      return inspected.value;
    });
  }
  #commitDraft(draft) {
    this.#phase(2 /* preflight */);
    let collectionPlan;
    if (draft.hasRows) {
      collectionPlan = this.#domain[COLLECTION_KERNEL]?.plan(draft);
      if (collectionPlan === undefined)
        throw new Error;
    }
    if (!draft.hasIntents && collectionPlan === undefined) {
      publishCommit(draft);
      return;
    }
    const singleIntent = draft.singleIntent;
    const singleScope = draft.singleIntentScope;
    if (collectionPlan === undefined && singleIntent?.kind === "reset" && singleScope !== undefined && !singleIntent.publishDraftFallback && draft.getAtomBaseline(singleScope, singleIntent.atom)?.owned === false) {
      publishCommit(draft);
      return;
    }
    const worksets = createCommitWorksets(this.instrumented ? () => this.recordCounter(19 /* commitWorksetAllocations */) : undefined);
    let firstPlan;
    let remainingPlan;
    if (singleIntent !== undefined && singleScope !== undefined) {
      firstPlan = this.#prepareAtomApplyPlan(draft, singleScope, singleIntent, worksets);
    } else {
      draft.forEachIntent((scope, intent) => {
        const entry = this.#prepareAtomApplyPlan(draft, scope, intent, worksets);
        if (firstPlan === undefined) {
          firstPlan = entry;
          return;
        }
        if (remainingPlan === undefined)
          remainingPlan = [];
        remainingPlan.push(entry);
      });
    }
    this.#phase(6 /* instrumenting */);
    this.#trace?.(1, draft, this.#domain.atoms);
    this.#phase(3 /* applying */);
    if (firstPlan !== undefined) {
      this.#publishPlanFallback(draft, firstPlan);
    }
    if (remainingPlan !== undefined) {
      for (const entry of remainingPlan) {
        this.#publishPlanFallback(draft, entry);
      }
    }
    let ownershipChanged = firstPlan === undefined ? false : this.#applyPlanOwner(firstPlan);
    if (remainingPlan !== undefined) {
      for (const entry of remainingPlan) {
        const entryOwnershipChanged = this.#applyPlanOwner(entry);
        ownershipChanged ||= entryOwnershipChanged;
      }
    }
    if (collectionPlan !== undefined) {
      const collectionOwnershipChanged = collectionPlan.commit(0);
      ownershipChanged ||= collectionOwnershipChanged;
    }
    publishCommit(draft);
    if (firstPlan !== undefined)
      this.#rewirePlanAtomView(firstPlan);
    if (remainingPlan !== undefined) {
      for (const entry of remainingPlan) {
        this.#rewirePlanAtomView(entry);
      }
    }
    if (collectionPlan !== undefined) {
      collectionPlan.commit(1);
    }
    const nested = this.#reactionDepth !== 0;
    if (!nested)
      this.beginNotificationSettlement();
    try {
      let firstChangedSource;
      let remainingChangedSources;
      const firstAffectedRecord = worksets.affectedRecord;
      const firstAffectedBefore = worksets.affectedBefore;
      if (firstAffectedRecord !== undefined && firstAffectedBefore !== undefined) {
        firstChangedSource = this.#settleAffectedAtomView(worksets, firstAffectedRecord, firstAffectedBefore);
      }
      const secondAffectedRecord = worksets.secondAffectedRecord;
      const secondAffectedBefore = worksets.secondAffectedBefore;
      if (secondAffectedRecord !== undefined && secondAffectedBefore !== undefined) {
        const source = this.#settleAffectedAtomView(worksets, secondAffectedRecord, secondAffectedBefore);
        if (source !== undefined) {
          if (firstChangedSource === undefined) {
            firstChangedSource = source;
          } else {
            remainingChangedSources = [source];
          }
        }
      }
      if (worksets.affected !== undefined) {
        for (const [record, before] of worksets.affected) {
          const source = this.#settleAffectedAtomView(worksets, record, before);
          if (source === undefined)
            continue;
          if (firstChangedSource === undefined) {
            firstChangedSource = source;
          } else {
            if (remainingChangedSources === undefined) {
              remainingChangedSources = [];
            }
            remainingChangedSources.push(source);
          }
        }
      }
      if (collectionPlan !== undefined) {
        const sources = collectionPlan.commit(2);
        if (sources !== undefined) {
          for (const source of sources) {
            const current = source;
            if (firstChangedSource === undefined) {
              firstChangedSource = current;
            } else {
              if (remainingChangedSources === undefined) {
                remainingChangedSources = [];
              }
              remainingChangedSources.push(current);
            }
          }
        }
      }
      if (ownershipChanged) {
        this.sourceEpoch += 1;
        this.recordCounter(0 /* sourceEpoch */);
      }
      this.#phase(6 /* instrumenting */);
      try {
        this.#trace?.(2, firstChangedSource === undefined ? 0 : 1 + (remainingChangedSources?.length ?? 0));
      } catch (error) {
        if (nested)
          this.#reactionFailure ??= { error };
        else if (!this.#external)
          throw error;
        else
          this.#external.failure(error, "instrumenting");
      }
      this.propagateFromSources(firstChangedSource, remainingChangedSources);
    } catch (error) {
      if (!nested)
        this.clearNotificationSettlement();
      throw error;
    }
  }
  #prepareAtomApplyPlan(draft, scope, intent, worksets) {
    const baseline = draft.getAtomBaseline(scope, intent.atom);
    if (baseline === undefined) {
      throw new Error("TreeDraft atom baseline is missing");
    }
    this.#readFinalAtomOutcome(draft, scope, intent.atom, worksets);
    const entry = Object.freeze({
      scope,
      intent,
      ownershipChanged: intent.kind === "set" ? !baseline.owned || !Object.is(scope.atomOverrides.get(intent.atom), intent.value) : baseline.owned
    });
    const record = scope.getAtomView(intent.atom);
    if (record !== undefined) {
      this.#collectAffectedAtomViews(draft, record, worksets);
    }
    return entry;
  }
  #publishPlanFallback(draft, entry) {
    if (!entry.intent.publishDraftFallback)
      return;
    const fallback = draft.getFallback(entry.intent.atom);
    if (fallback !== undefined && !this.#fallbackRecords.has(entry.intent.atom)) {
      this.#fallbackRecords.set(entry.intent.atom, fallback);
      this.recordCounter(13 /* fallbackPublications */);
    }
  }
  #applyPlanOwner(entry) {
    const { intent, scope } = entry;
    if (intent.kind === "set") {
      scope.atomOverrides.set(intent.atom, intent.value);
    } else
      scope.atomOverrides.delete(intent.atom);
    const family = this.#domain[REACQUIRABLE_ATOMS]?.apply(scope, intent);
    if (scope.parent !== undefined && family !== true) {
      if (intent.kind === "set" && (scope.ownedAtoms ?? this.#createOwnedAtoms(scope)).add(intent.atom))
        this.recordCounter(51 /* ownedAtomRetains */);
    }
    return entry.ownershipChanged;
  }
  #createOwnedAtoms(scope) {
    return scope.ownedAtoms = new WeakOwnedAtoms(scope, this.#counters === undefined ? undefined : (removed) => this.recordCounter(52 /* ownedAtomSweptReferences */, removed));
  }
  #rewirePlanAtomView({ scope, intent }) {
    const record = scope.getAtomView(intent.atom);
    if (record === undefined)
      return;
    if (intent.kind === "set" || scope.parent === undefined) {
      scope.detachAtomView(record);
    } else {
      scope.attachAtomView(record, this.#materializeAtomViewInert(scope.parent, intent.atom));
    }
  }
  #settleAffectedAtomView(worksets, record, before) {
    const after = getPreflightOutcome(worksets, record.atom, record.scope);
    if (after === undefined) {
      throw new Error("Affected AtomView final outcome is missing");
    }
    this.recordCounter(16 /* finalResolutionVisits */);
    if (sameOutcome(before, after))
      return;
    record.scope.updateAtomView(record, after);
    return record;
  }
  #collectAffectedAtomViews(draft, record, worksets) {
    const pending2 = [record];
    while (pending2.length !== 0) {
      const current = pending2.pop();
      if (!markConsidered(worksets, current))
        continue;
      const before = current.served.outcome;
      const after = this.#readFinalAtomOutcome(draft, current.scope, current.atom, worksets);
      if (sameOutcome(before, after))
        continue;
      markAffected(worksets, current, before);
      const firstChild = pending2.length;
      current.inheritingChildren.forEach((child) => {
        this.recordCounter(1 /* routeVisits */);
        pending2.push(child);
      });
      for (let left = firstChild, right = pending2.length - 1;left < right; left++, right--) {
        const child = pending2[left];
        pending2[left] = pending2[right];
        pending2[right] = child;
      }
    }
  }
  #readFinalAtomOutcome(draft, scope, atom, worksets) {
    const existing = getPreflightOutcome(worksets, atom, scope);
    if (existing !== undefined)
      return existing;
    let current = scope;
    let firstUnresolved;
    let remainingUnresolved;
    let outcome;
    while (current !== undefined) {
      const memoized = getPreflightOutcome(worksets, atom, current);
      if (memoized !== undefined) {
        outcome = memoized;
        break;
      }
      if (firstUnresolved === undefined) {
        firstUnresolved = current;
      } else {
        if (remainingUnresolved === undefined)
          remainingUnresolved = [];
        remainingUnresolved.push(current);
      }
      const intent = draft.getIntent(current, atom);
      if (intent?.kind === "set") {
        outcome = valueOutcome(intent.value);
        break;
      }
      if (intent === undefined && current.atomOverrides.has(atom)) {
        outcome = valueOutcome(current.atomOverrides.get(atom));
        break;
      }
      current = current.parent;
    }
    outcome ??= this.#readFinalFallbackOutcome(draft, atom);
    if (firstUnresolved !== undefined) {
      setPreflightOutcome(worksets, atom, firstUnresolved, outcome);
      this.recordCounter(17 /* finalPreflightVisits */);
    }
    if (remainingUnresolved !== undefined) {
      for (const unresolvedScope of remainingUnresolved) {
        setPreflightOutcome(worksets, atom, unresolvedScope, outcome);
        this.recordCounter(17 /* finalPreflightVisits */);
      }
    }
    return outcome;
  }
  #readFinalFallbackOutcome(draft, atom) {
    const committed = this.#fallbackRecords.get(atom);
    if (committed !== undefined)
      return committed;
    const memoized = draft.getFallback(atom);
    if (memoized !== undefined)
      return memoized;
    const definition = this.#atomDefinition(atom);
    if (definition.fallback.kind === "eager") {
      return valueOutcome(definition.fallback.value);
    }
    throw new Error("Final Atom fallback was not resolved during staging");
  }
  #readCommittedFallbackOutcomeInert(atom) {
    const committed = this.#fallbackRecords.get(atom);
    if (committed !== undefined)
      return committed;
    const definition = this.#atomDefinition(atom);
    if (definition.fallback.kind === "eager") {
      return valueOutcome(definition.fallback.value);
    }
    throw new Error("Committed Atom fallback is not materialized");
  }
  #materializeAtomViewInert(scope, atom) {
    let currentScope = scope;
    const unresolved = [];
    let current;
    while (true) {
      const materialized = currentScope.getAtomView(atom);
      if (materialized !== undefined) {
        current = materialized;
        break;
      }
      if (currentScope.atomOverrides.has(atom)) {
        current = currentScope.createAtomView(atom, valueOutcome(currentScope.atomOverrides.get(atom)));
        break;
      }
      if (currentScope.parent === undefined) {
        current = currentScope.createAtomView(atom, this.#readCommittedFallbackOutcomeInert(atom));
        break;
      }
      unresolved.push(currentScope);
      currentScope = currentScope.parent;
    }
    for (let index = unresolved.length - 1;index >= 0; index--) {
      current = unresolved[index].createAtomView(atom, current.served.outcome, current);
    }
    return current;
  }
  serveScopeAtom(scope, atom, session) {
    let currentScope = scope;
    const unresolved = [];
    let current;
    while (true) {
      const materialized = currentScope.getAtomView(atom);
      if (materialized !== undefined) {
        current = materialized;
        break;
      }
      if (currentScope.atomOverrides.has(atom)) {
        current = currentScope.createAtomView(atom, valueOutcome(currentScope.atomOverrides.get(atom)));
        break;
      }
      if (currentScope.parent === undefined) {
        current = currentScope.createAtomView(atom, this.#getCommittedFallbackOutcome(atom, session));
        break;
      }
      this.recordCounter(6 /* warmParentHops */);
      unresolved.push(currentScope);
      currentScope = currentScope.parent;
    }
    for (let index = unresolved.length - 1;index >= 0; index--) {
      current = unresolved[index].createAtomView(atom, current.served.outcome, current);
    }
    return current.served;
  }
  #getCommittedFallbackOutcome(atom, session) {
    const current = this.#fallbackRecords.get(atom);
    if (current !== undefined)
      return current;
    const definition = this.#atomDefinition(atom);
    if (definition.fallback.kind === "eager") {
      return valueOutcome(definition.fallback.value);
    }
    const initialize = definition.fallback.initialize;
    const outcome = fromSynchronousResult(runGuardedCallback(this.#domain, session, () => runLazyInitializer(initialize)));
    this.#fallbackRecords.set(atom, outcome);
    this.recordCounter(13 /* fallbackPublications */);
    return outcome;
  }
  #atomDefinition(atom) {
    const definition = this.#domain.atoms.get(atom);
    if (definition === undefined) {
      throw new TypeError("Unknown committed StoreTree Atom");
    }
    return definition;
  }
  propagateFromSources(firstSource, remainingSources, prepare) {
    const nested = this.#reactionDepth !== 0;
    if (firstSource === undefined && prepare === undefined) {
      if (!nested)
        this.clearNotificationSettlement();
      return;
    }
    if (firstSource !== undefined)
      this.recordCounter(4 /* propagationSettlements */);
    const previousPull = this.#external?.beginPropagation();
    this.#phase(4 /* propagating */);
    this.#propagationQueue = [];
    this.#postSourceApply = true;
    this.#externalSettlement = prepare !== undefined;
    if (!nested)
      this.settlementEpoch++;
    let settlementFailures;
    try {
      try {
        prepare?.();
        firstSource?.scope.markDependents(firstSource.atom);
        if (remainingSources !== undefined) {
          for (const source of remainingSources) {
            source.scope.markDependents(source.atom);
          }
        }
        let cursor2 = 0;
        while (cursor2 < this.#propagationQueue.length || this.#external?.pendingLifecycle) {
          if (cursor2 >= this.#propagationQueue.length) {
            this.#propagationStatusScope = undefined;
            this.#propagationStatusSelector = undefined;
            this.#propagationStatusBits = 0;
            this.#propagationStatuses = undefined;
            this.#external.settleLifecycle();
            continue;
          }
          const scope = this.#propagationQueue[cursor2++];
          const selector = this.#propagationQueue[cursor2++];
          try {
            this.#settleSelector(scope, selector);
          } catch (cause) {
            if (nested)
              this.#reactionFailure ??= { error: cause };
            else if (prepare === undefined)
              throw cause;
            else
              this.#external.failure(cause, "settling");
          }
        }
      } finally {
        settlementFailures = this.#settlementFailures;
        this.#settlementFailures = undefined;
        this.#postSourceApply = false;
        this.#externalSettlement = false;
        this.#propagationQueue = undefined;
        this.#propagationStatusScope = undefined;
        this.#propagationStatusSelector = undefined;
        this.#propagationStatusBits = 0;
        this.#propagationStatuses = undefined;
        this.#external?.endPropagation(previousPull);
      }
      if (nested)
        return;
      const reactionErrors = this.#reactionQueue === undefined ? settlementFailures : this.#drainReactions(settlementFailures);
      const subscriberErrors = this.#deliverSubscriptionSnapshot();
      const authoritativeControlFault = this.#propagationControlFault?.[0]?.error;
      const errors = reactionErrors === undefined ? subscriberErrors : subscriberErrors === undefined ? reactionErrors : [...reactionErrors, ...subscriberErrors];
      if (errors === undefined) {
        if (authoritativeControlFault !== undefined)
          throw authoritativeControlFault;
        return;
      }
      if (errors === settlementFailures && errors.length === 1 && authoritativeControlFault === undefined)
        throw errors[0];
      const error = new SubscriberNotificationError(authoritativeControlFault === undefined ? errors : [authoritativeControlFault, ...errors]);
      throw this.#external?.notificationFailure(error) ?? error;
    } finally {
      if (!nested)
        this.#propagationControlFault = undefined;
    }
  }
  #drainReactions(errors) {
    let queue;
    let index = 0;
    try {
      for (let wave = 0;this.#reactionQueue !== undefined; wave++) {
        queue = this.#reactionQueue;
        this.#reactionQueue = undefined;
        index = 0;
        if (wave === REACTION_WAVE_LIMIT) {
          (errors ??= []).push(new SettleLimitError);
          break;
        }
        for (;index < queue.length; index++) {
          const registration = queue[index];
          registration.pending = false;
          const run = registration.reaction;
          const target = registration.target;
          if (run === undefined || target === undefined)
            continue;
          const failure = this.#runReaction(target.scope, run);
          if (failure !== undefined)
            (errors ??= []).push(failure.error);
        }
      }
    } finally {
      if (queue !== undefined)
        for (;index < queue.length; index++)
          queue[index].pending = false;
    }
    return errors;
  }
  #runReaction(scope, run) {
    let failure;
    this.#reactionDepth++;
    try {
      this.#trace?.(3, scope);
      this.#transact(scope, run);
      failure = this.#reactionFailure;
    } catch (thrown) {
      let error = thrown;
      try {
        runTransactionResultActivity(this.#domain, new SelectorEvaluationSession, () => {
          const inspected = inspectThenable2(thrown);
          if (inspected.kind === "thenable")
            containThenable2(inspected);
        });
      } catch (fault) {
        error = fault;
      }
      failure = { error };
    } finally {
      this.#reactionDepth--;
      this.#reactionFailure = undefined;
    }
    try {
      this.#trace?.(4, failure !== undefined);
    } catch (error) {
      failure ??= { error };
    }
    return failure;
  }
  beginNotificationSettlement() {
    this.#notificationTarget = undefined;
    this.#remainingNotificationTargets = undefined;
    this.#notificationEpoch = this.#subscriptionTargets === undefined ? 0 : this.#nextNotificationEpoch++;
  }
  clearNotificationSettlement() {
    this.#notificationEpoch = 0;
    this.#notificationTarget = undefined;
    this.#remainingNotificationTargets = undefined;
    const queue = this.#reactionQueue;
    if (queue === undefined)
      return;
    this.#reactionQueue = undefined;
    for (const registration of queue)
      registration.pending = false;
  }
  reachSubscriptionTarget(scope, state) {
    const epoch = this.#notificationEpoch;
    const target = this.#subscriptionTargets?.get(scope)?.get(state);
    if (epoch === 0 || target === undefined)
      return;
    if (target.reactions !== 0)
      this.#queueReactions(target);
    if (target.reachedEpoch === epoch)
      return;
    target.reachedEpoch = epoch;
    if (this.instrumented) {
      this.recordCounter(28 /* notificationTargetsReached */);
    }
    if (this.#notificationTarget === undefined) {
      this.#notificationTarget = target;
      return;
    }
    if (this.#remainingNotificationTargets === undefined) {
      this.#remainingNotificationTargets = [target];
    } else {
      this.#remainingNotificationTargets.push(target);
    }
  }
  #queueReactions(target) {
    let registration = target.head;
    while (registration !== undefined) {
      if (registration.reaction !== undefined && !registration.pending && registration.status !== "provisional") {
        registration.pending = true;
        (this.#reactionQueue ??= []).push(registration);
      }
      registration = registration.next;
    }
  }
  #deliverSubscriptionSnapshot() {
    const firstTarget = this.#notificationTarget;
    if (firstTarget === undefined) {
      this.clearNotificationSettlement();
      return;
    }
    let firstCallback;
    let snapshot;
    const capture = (target) => {
      let registration = target.head;
      while (registration !== undefined) {
        const callback = !this.#external ? registration.callback : this.#external.notificationCallback(registration);
        if (callback !== undefined) {
          if (firstCallback === undefined) {
            firstCallback = callback;
          } else if (snapshot === undefined) {
            snapshot = [firstCallback, callback];
          } else {
            snapshot.push(callback);
          }
        }
        registration = registration.next;
      }
    };
    capture(firstTarget);
    const remainingTargets = this.#remainingNotificationTargets;
    if (remainingTargets !== undefined) {
      for (const target of remainingTargets)
        capture(target);
    }
    this.clearNotificationSettlement();
    if (firstCallback === undefined) {
      return;
    }
    this.#phase(7 /* notifying */);
    const frozenSnapshot = Object.freeze(snapshot ?? [firstCallback]);
    const instrumented = this.instrumented;
    if (instrumented)
      this.recordCounter(29 /* notificationSnapshots */);
    let subscriberErrors;
    for (const callback of frozenSnapshot) {
      if (instrumented) {
        this.recordCounter(30 /* subscriberCallbacksAttempted */);
      }
      const session = new SelectorEvaluationSession;
      try {
        runSubscriberActivity(this.#domain, session, () => {
          let inspected;
          try {
            inspected = inspectThenable2(callback());
            if (inspected.kind === "thenable")
              containThenable2(inspected);
          } catch (thrown) {
            const completion = inspectThenable2(thrown);
            if (completion.kind === "thenable")
              containThenable2(completion);
            throw thrown;
          }
          if (inspected.kind === "inspection-error")
            throw inspected.error;
        });
      } catch (error) {
        (subscriberErrors ??= []).push(error);
        if (instrumented)
          this.recordCounter(31 /* subscriberErrors */);
      }
    }
    return subscriberErrors;
  }
  reportSelectorFailure(error) {
    if (this.#propagationQueue === undefined)
      return;
    if (this.#reactionDepth !== 0)
      this.#reactionFailure ??= { error };
    else if (this.#externalSettlement)
      this.#external.failure(error, "settling");
    else
      (this.#settlementFailures ??= []).push(error);
  }
  enqueueSelector(scope, selector) {
    const queue = this.#propagationQueue;
    if (queue === undefined)
      return false;
    let status = this.#getPropagationStatus(scope, selector);
    if ((status & 4 /* settled */) !== 0) {
      this.#updatePropagationStatus(scope, selector, 0, 4 /* settled */ | 1 /* queued */);
      status &= ~(4 /* settled */ | 1 /* queued */);
    }
    if ((status & 1 /* queued */) !== 0)
      return true;
    this.#updatePropagationStatus(scope, selector, 1 /* queued */);
    queue.push(scope, selector);
    return true;
  }
  prepareSelectorRead(scope, selector, session) {
    if (this.#propagationQueue === undefined)
      return;
    if (this.#external?.skipSelectorRead(scope, selector, session))
      return;
    this.#settleSelector(scope, selector, session);
  }
  #settleSelector(scope, selector, session) {
    const status = this.#getPropagationStatus(scope, selector);
    if ((status & (4 /* settled */ | 2 /* settling */)) !== 0) {
      return;
    }
    this.#updatePropagationStatus(scope, selector, 8 /* walking */);
    try {
      const graphVersionBeforeDependencies = scope.getSelectorGraphVersion();
      const dependencies = (status & 8 /* walking */) !== 0 ? undefined : scope.getCommittedSelectorDependencies(selector);
      if (dependencies !== undefined) {
        for (const dependency of dependencies) {
          if (this.#domain.selectors.has(dependency.node)) {
            this.#settleSelector(scope, dependency.node);
          }
        }
      }
      if (scope.isSelectorDirty(selector)) {
        this.#updatePropagationStatus(scope, selector, 2 /* settling */);
        const graphStayedCurrent = graphVersionBeforeDependencies === scope.getSelectorGraphVersion();
        const settleSession = session !== undefined && graphStayedCurrent ? session : new SelectorEvaluationSession;
        try {
          scope.serve(selector, settleSession);
        } catch (error) {
          if (this.#external?.dormantPull === true)
            throw error;
          scope.publishEscapedFailure(selector, error, settleSession);
        }
      }
      this.#updatePropagationStatus(scope, selector, 4 /* settled */);
    } catch (error) {
      if (this.#external?.recordSelectorFault(scope, selector, error)) {
        this.#updatePropagationStatus(scope, selector, 4 /* settled */);
      }
      throw error;
    } finally {
      this.#updatePropagationStatus(scope, selector, 0, (2 /* settling */ | 8 /* walking */) & ~status);
    }
  }
  #getPropagationStatus(scope, selector) {
    if (Object.is(this.#propagationStatusScope, scope) && Object.is(this.#propagationStatusSelector, selector)) {
      return this.#propagationStatusBits;
    }
    return this.#propagationStatuses?.get(scope)?.get(selector) ?? 0;
  }
  #updatePropagationStatus(scope, selector, add, remove = 0) {
    if (this.#propagationStatusScope === undefined) {
      this.#propagationStatusScope = scope;
      this.#propagationStatusSelector = selector;
      this.#propagationStatusBits = add & ~remove;
      return;
    }
    if (Object.is(this.#propagationStatusScope, scope) && Object.is(this.#propagationStatusSelector, selector)) {
      this.#propagationStatusBits = (this.#propagationStatusBits | add) & ~remove;
      return;
    }
    let statuses = this.#propagationStatuses;
    if (statuses === undefined) {
      statuses = new Map;
      this.#propagationStatuses = statuses;
    }
    let bySelector = statuses.get(scope);
    if (bySelector === undefined) {
      bySelector = new Map;
      statuses.set(scope, bySelector);
    }
    bySelector.set(selector, ((bySelector.get(selector) ?? 0) | add) & ~remove);
  }
  latchPropagationControlFault(outcome) {
    if (this.#external?.idle === false) {
      this.#external.failure(outcome.error, "settling", outcome.origin);
    } else
      (this.#propagationControlFault ??= []).push(outcome);
  }
  #stageAlreadyInspectedAtomSet(draft, scope, atom, candidate, baseline, session) {
    const canonical = baseline.outcome.kind === "value" ? this.#canonicalizeAtomCandidate(atom, baseline.outcome.value, candidate, session) : candidate;
    draft.stage(scope, Object.freeze({
      kind: "set",
      atom,
      value: canonical,
      publishDraftFallback: baseline.reachesFallback && draft.hasFallback(atom)
    }));
  }
}
class CommittedStoreTreeFacade {
  constructor(host, scope, trace) {
    this.get = (state) => host.get(scope, state);
    this.sub = (state, handlers) => host.sub(scope, state, handlers);
    this.set = (target, value) => host.mutate(undefined, scope, "set", target, value);
    this.update = (target, update) => host.mutate(undefined, scope, "update", target, update);
    this.reset = (target) => host.mutate(undefined, scope, "reset", target);
    this.delete = (row) => host.mutate(undefined, scope, "delete", row);
    this.txn = (callback, name) => host.txn(scope, callback, name);
    this.scope = function(id) {
      return host.scope(scope, arguments.length, id);
    };
    this.dispose = () => host.dispose(scope);
    scope.installFacade(this);
    brandRuntimeHandle(this, host.runtimeDomain.ownerToken);
    host.runtimeDomain.stores.set(this, scope);
    host.recordCounter(8 /* storeFacadesCreated */);
    trace?.(0, this, scope);
    Object.freeze(this);
  }
}
var readAtomOptions = (options) => {
  if (options.equal !== undefined && typeof options.equal !== "function") {
    throw new TypeError("Atom equal must be a function");
  }
  return {
    ...options.name === undefined ? {} : { name: options.name },
    ...options.equal === undefined ? {} : {
      equal: options.equal
    }
  };
};
var createDefinitionDomain = () => {
  const records = {
    states: new WeakSet,
    atoms: new WeakMap,
    selectors: new WeakMap,
    stores: new WeakMap,
    transactionCursors: new WeakMap,
    ownerToken: Object.freeze({}),
    activity: undefined
  };
  return Object.freeze({ [definitionDomainRecords]: records });
};
var createDomainAtom = (domain, fallback, options = {}) => {
  const records = domain[definitionDomainRecords];
  assertRuntimeDefinitionConstructionAllowed(records);
  const session = new SelectorEvaluationSession;
  const inspected = runGuardedCallback(records, session, () => inspectSynchronousAtomValue(fallback));
  if (inspected.kind === "error")
    throw inspected.error;
  const handle = registerRuntimeStateHandle(records, makeStateHandle("atom"));
  records.atoms.set(handle, Object.freeze({
    fallback: Object.freeze({
      kind: "eager",
      value: inspected.value
    }),
    ...readAtomOptions(options)
  }));
  return handle;
};
var createDomainLazyAtom = (domain, initialize, options = {}) => {
  const records = domain[definitionDomainRecords];
  assertRuntimeDefinitionConstructionAllowed(records);
  if (typeof initialize !== "function") {
    throw new TypeError("atomLazy requires an initializer function");
  }
  const handle = registerRuntimeStateHandle(records, makeStateHandle("atom"));
  records.atoms.set(handle, Object.freeze({
    fallback: Object.freeze({
      kind: "lazy",
      initialize
    }),
    ...readAtomOptions(options)
  }));
  return handle;
};
var createDomainSelector = (domain, get, options = {}) => {
  const records = domain[definitionDomainRecords];
  assertRuntimeDefinitionConstructionAllowed(records);
  if (typeof get !== "function") {
    throw new TypeError("selector requires a getter function");
  }
  if (options.equal !== undefined && typeof options.equal !== "function") {
    throw new TypeError("selector equal must be a function");
  }
  const handle = registerRuntimeStateHandle(records, makeStateHandle("selector"));
  const definition = Object.freeze({
    node: handle,
    get,
    ...options.name === undefined ? {} : { name: options.name },
    ...options.equal === undefined ? {} : { equal: options.equal }
  });
  records.selectors.set(handle, definition);
  return handle;
};
var createDomainStore = (domain, instrumentation, trace) => {
  const records = domain[definitionDomainRecords];
  assertStoreOperationAllowed(records, "createStoreTree");
  const host = new CommittedStoreTreeHost(records, instrumentation, trace);
  return new CommittedStoreTreeFacade(host, host.rootScope, trace);
};

// packages/valdres/src/v1-internal/committed-store-tree/external-projection.ts
var recordedExternalFailure = Symbol();
var invalidator = (generation) => () => generation.owner?.invalidate(generation);

class ExternalProjectionPlane {
  #bindings;
  #projections = new WeakMap;
  #retains = new WeakMap;
  #pull;
  #operation;
  #attachments = new Set;
  #releases = new Set;
  #unattached = new Set;
  #dirty = new Set;
  #delivery;
  #bounds;
  constructor(host, delivery, bounds) {
    this.#bindings = {
      event: host.evaluate.recordExtension,
      domain: host.runtimeDomain,
      propagating: () => host.postSourceApply,
      subscriberRead: () => host.subscriberReading,
      subscribed: (scope, node) => host.hasSubscription(scope, node),
      token: () => host.createOutcomeToken(),
      epoch: () => host.sourceEpoch,
      count: (counter, amount) => host.recordCounter(counter, amount),
      advanceEpoch: () => {
        host.sourceEpoch++;
        host.recordCounter(0 /* sourceEpoch */);
        host.recordCounter(4 /* propagationSettlements */);
      },
      reach: (scope, node) => {
        host.reachSubscriptionTarget(scope, node);
        scope.markDependents(node);
      },
      settleRead: (prepare) => {
        host.beginNotificationSettlement();
        try {
          host.propagateFromSources(undefined, undefined, () => {
            try {
              prepare();
            } catch (error) {
              this.failure(error, "sampling");
            }
          });
        } catch (error) {
          this.failure(error);
        } finally {
          host.clearNotificationSettlement();
        }
      }
    };
    this.#delivery = delivery;
    this.#bounds = bounds;
  }
  inspectRetryRequired(node) {
    return this.#projections.get(node)?.generation?.retryRequired === true;
  }
  #event(code, node) {
    const event = this.#bindings.event;
    if (event === undefined)
      return;
    const previous = this.#operation?.phase;
    this.phase(6 /* instrumenting */);
    try {
      event(code, node, node === undefined ? undefined : this.#bindings.domain.externalAtoms.get(node)?.name);
    } catch (error) {
      this.failure(error, "instrumenting");
    } finally {
      if (previous !== undefined)
        this.phase(previous);
    }
  }
  reaches(scope, node) {
    return scope.externalRecord(node)?.lifecycleInClosure ?? this.#bindings.domain.externalAtoms.has(node);
  }
  reachesDormant(scope, node) {
    return scope.externalRecord(node)?.dormantExternalInClosure ?? (this.#bindings.domain.externalAtoms.has(node) && !this.active(node));
  }
  selectorRecord(scope, record, session) {
    return Object.freeze({
      ...record,
      lifecycleInClosure: record.dependencies.some((dependency) => this.reaches(scope, dependency.node)),
      dormantExternalInClosure: record.dependencies.some((dependency) => this.reachesDormant(scope, dependency.node))
    });
  }
  refreshActivity(scope, node) {
    const pending2 = [];
    scope.externalDependents(node)?.forEach((parent) => pending2.push(parent));
    for (let index = 0;index < pending2.length; index++) {
      const current = pending2[index], record = scope.externalRecord(current);
      if (record === undefined)
        continue;
      const dormantExternalInClosure = record.dependencies.some((dependency) => this.reachesDormant(scope, dependency.node));
      if (dormantExternalInClosure === record.dormantExternalInClosure)
        continue;
      scope.replaceExternalRecord(current, Object.freeze({ ...record, dormantExternalInClosure }));
      scope.externalDependents(current)?.forEach((parent) => pending2.push(parent));
    }
  }
  publishedSelector(scope, node, previous, record) {
    if (previous !== undefined && previous.dormantExternalInClosure !== record.dormantExternalInClosure)
      this.refreshActivity(scope, node);
    this.reconcile(scope, node);
    if (previous === undefined || previous.lifecycleInClosure === record.lifecycleInClosure)
      return;
    const pending2 = [];
    scope.externalDependents(node)?.forEach((parent) => pending2.push(parent));
    for (let index = 0;index < pending2.length; index++) {
      const current = pending2[index], entry = scope.externalRecord(current);
      if (entry === undefined)
        continue;
      const lifecycleInClosure = entry.dependencies.some((dependency) => this.reaches(scope, dependency.node));
      if (lifecycleInClosure !== entry.lifecycleInClosure) {
        scope.replaceExternalRecord(current, Object.freeze({ ...entry, lifecycleInClosure }));
        scope.externalDependents(current)?.forEach((parent) => pending2.push(parent));
      }
      this.reconcile(scope, current);
    }
  }
  observe(scope, node, session) {
    if (!this.reaches(scope, node) && (!this.#bindings.domain.selectors.has(node) || scope.getSelectorRecord(node) !== undefined))
      return scope.serveKnownLocal(node, session);
    return this.read(scope, node, session);
  }
  admit(registration, token) {
    registration.status = "provisional";
    registration.admissionToken = token;
    this.#operation.registration = registration;
    const target = registration.target;
    this.retainRoot(target.scope, target.state);
    this.startup();
  }
  notificationCallback(registration) {
    if (registration.target === undefined || registration.status === "rolled-back")
      return;
    const callback = registration.callback;
    if (registration.status === "provisional") {
      const target = registration.target;
      const token = target.scope.getMaterializedServedOutcome(target.state)?.token;
      if (!this.admissionAllowed || registration.admissionNotified || token !== undefined && token === registration.admissionToken)
        return;
      if (callback !== undefined)
        registration.admissionNotified = true;
    }
    return callback;
  }
  beginHost(cursor2, epoch, faults) {
    const kind = cursor2 & 3 /* kindMask */;
    const phase = cursor2 >> 2 /* phaseShift */;
    this.begin(kind === 1 /* read */ ? "external-read" : kind === 2 /* subscribe */ ? "external-startup" : "owned-mutation", epoch, phase === 0 ? undefined : phase - 1, faults);
  }
  begin(source, epoch, phase, faults) {
    this.#operation = {
      source,
      initialSource: source,
      phase: phase ?? (source === "owned-mutation" ? 1 /* drafting */ : source === "external-cleanup" ? 10 /* disposing */ : 0 /* materializingRead */),
      epoch,
      failures: [],
      internal: [],
      originals: [],
      controlOrigins: new Set,
      terminal: false,
      attachments: 0
    };
    if (faults !== undefined)
      for (const fault of faults)
        this.failure(fault.error, "settling", fault.origin);
    this.#pull = this.#newPull(source === "external-read" || source === "external-startup");
    for (const projection of this.#unattached) {
      if (projection.retains > 0 && projection.status === "dormant")
        this.#attachments.add(projection);
    }
  }
  cleanup(operation) {
    return this.run("external-cleanup", operation);
  }
  run(source, operation) {
    if (!this.idle)
      return operation();
    this.begin(source, this.#bindings.epoch());
    let result;
    try {
      result = operation();
    } catch (error) {
      this.failure(error);
    } finally {
      this.finish();
    }
    return result;
  }
  finish() {
    const frame = this.#operation;
    try {
      try {
        this.startup();
      } catch (error) {
        this.failure(error);
      }
      this.#flushReleases();
      this.#drain();
      const registration = frame.registration;
      if (registration !== undefined) {
        if (frame.failures.length > 0) {
          try {
            registration.target?.host?.removeSubscription(registration);
          } catch (error) {
            this.failure(error, "cleanup");
          }
          registration.status = "rolled-back";
          this.#flushReleases();
        } else {
          registration.status = "active";
          delete registration.admissionToken;
          delete registration.admissionNotified;
        }
      }
    } finally {
      this.#operation = undefined;
      this.#pull = undefined;
    }
    if (frame.failures.length > 0) {
      if (frame.initialSource === "owned-mutation" && frame.originals.length === 1 && frame.failures.every((failure) => failure.source === "owned-mutation"))
        throw frame.originals[0];
      this.#bindings.domain.externalRuntime.fail(frame.failures, false, frame.internal);
    }
  }
  phase(phase) {
    if (this.#operation !== undefined)
      this.#operation.phase = phase;
  }
  failure(error, phase, origin) {
    if (error === recordedExternalFailure)
      return;
    const frame = this.#operation;
    if (frame === undefined)
      throw error;
    if (origin !== undefined) {
      if (frame.controlOrigins.has(origin))
        return;
      frame.controlOrigins.add(origin);
    }
    frame.originals.push(error);
    frame.internal.push(origin !== undefined);
    frame.failures.push({
      cause: error,
      phase: phase ?? this.#failurePhase(),
      source: frame.source,
      committed: this.#bindings.epoch() !== frame.epoch
    });
  }
  notificationFailure(error) {
    const frame = this.#operation;
    if (frame === undefined)
      return error;
    frame.originals.push(error);
    for (const cause of error.causes) {
      frame.internal.push(false);
      frame.failures.push({
        cause,
        phase: "notifying",
        source: frame.source,
        committed: this.#bindings.epoch() !== frame.epoch
      });
    }
    return recordedExternalFailure;
  }
  #failureMetadata(phase) {
    const frame = this.#operation;
    return {
      phase,
      source: frame.source,
      committed: this.#bindings.epoch() !== frame.epoch
    };
  }
  #failurePhase() {
    switch (this.#operation?.phase) {
      case 5 /* transitioningLifecycle */:
      case 1 /* drafting */:
      case 2 /* preflight */:
        return "admitting";
      case 0 /* materializingRead */:
      case 8 /* samplingExternal */:
        return "sampling";
      case 7 /* notifying */:
        return "notifying";
      case 6 /* instrumenting */:
        return "instrumenting";
      case 11 /* cleanup */:
      case 10 /* disposing */:
        return "cleanup";
      default:
        return "settling";
    }
  }
  startup() {
    if (this.#attachments.size === 0)
      return;
    const previous = this.#pull;
    const source = this.#operation.source;
    if (source === "external-cleanup")
      this.#operation.source = "external-startup";
    this.#pull = this.#newPull(false);
    this.#pull.epochAdvanced = false;
    try {
      this.#bindings.settleRead(() => {});
    } finally {
      this.#pull = previous;
      this.#operation.source = source;
    }
  }
  settleLifecycle() {
    if (this.#attachments.size === 0)
      return false;
    this.phase(5 /* transitioningLifecycle */);
    const pending2 = [...this.#attachments];
    this.#attachments.clear();
    for (const projection of pending2) {
      if (projection.retains === 0 || projection.status !== "dormant")
        continue;
      if (this.#operation.terminal)
        continue;
      if (this.#operation.attachments++ >= this.#bounds.samples) {
        this.#operation.terminal = true;
        this.failure(new ExternalSourceNonConvergenceError(this.#failureMetadata("admitting")), "admitting", {});
        continue;
      }
      try {
        this.#attach(projection);
      } catch (error) {
        this.failure(error, "admitting");
      }
    }
    this.phase(4 /* propagating */);
    return true;
  }
  #attach(projection) {
    const domain = this.#bindings.domain;
    const previousSource = this.#operation.source;
    this.#operation.source = "external-startup";
    const definition = domain.externalAtoms.get(projection.node);
    const generation = {
      owner: this,
      projection,
      cleanup: undefined
    };
    projection.generation = generation;
    projection.status = "attaching";
    this.#bindings.count(41 /* adapterSubscriptions */);
    this.#event(97 /* attach */, projection.node);
    const session = new SelectorEvaluationSession;
    let origin;
    try {
      runExternalCallback(domain, session, "external-subscribe", () => {
        let returned;
        try {
          returned = Reflect.apply(definition.subscribe, definition.source, [invalidator(generation)]);
        } catch (error) {
          throw this.#completionError(error);
        }
        const inspected = inspectThenable2(returned);
        if (inspected.kind === "inspection-error")
          throw inspected.error;
        if (inspected.kind === "thenable") {
          this.#bindings.count(45 /* thenableContainments */);
          containThenable2(inspected);
          throw this.#invalidCleanup();
        }
        if (typeof returned !== "function")
          throw this.#invalidCleanup();
        generation.cleanup = returned;
      }, generation, (token) => {
        origin = token;
      });
      this.#dirty.delete(generation);
      const sampled = this.#sample(projection.node, session);
      this.#publish(projection.node, sampled);
      projection.status = "active";
      projection.scopes.forEach((scope) => {
        if (scope.status === "live")
          this.refreshActivity(scope, projection.node);
      });
      this.#unattached.delete(projection);
    } catch (error) {
      const fault = session.getControlFault();
      this.failure(error, "admitting", fault.kind === "fault" ? fault.origin : origin);
      this.#cleanup(projection);
    } finally {
      this.#operation.source = previousSource;
    }
  }
  #revoke(projection) {
    const generation = projection.generation;
    if (generation === undefined)
      return;
    this.#dirty.delete(generation);
    const cleanup = generation.cleanup;
    generation.owner = undefined;
    generation.projection = undefined;
    generation.cleanup = undefined;
    delete projection.generation;
    return cleanup;
  }
  #invalidCleanup() {
    const error = new InvalidExternalCleanupError(this.#failureMetadata(this.#operation?.phase === 11 /* cleanup */ ? "cleanup" : "admitting"));
    this.#bindings.domain.externalRuntime.guard(error);
    return error;
  }
  #completionError(thrown) {
    const inspected = inspectThenable2(thrown);
    if (inspected.kind === "inspection-error")
      return inspected.error;
    if (inspected.kind === "thenable") {
      this.#bindings.count(45 /* thenableContainments */);
      containThenable2(inspected);
      return this.#invalidCleanup();
    }
    return thrown;
  }
  #cleanup(projection) {
    const previousPhase = this.#operation?.phase;
    this.phase(11 /* cleanup */);
    const cleanup = this.#revoke(projection);
    projection.status = "detaching";
    if (cleanup !== undefined) {
      this.#bindings.count(42 /* adapterCleanups */);
      this.#event(98 /* detach */, projection.node);
      const previous = this.#operation.source;
      this.#operation.source = "external-cleanup";
      let origin;
      try {
        runExternalCallback(this.#bindings.domain, new SelectorEvaluationSession, "external-cleanup", () => {
          let returned;
          try {
            returned = cleanup();
          } catch (error) {
            throw this.#completionError(error);
          }
          const inspected = inspectThenable2(returned);
          if (inspected.kind === "inspection-error")
            throw inspected.error;
          if (inspected.kind === "thenable") {
            this.#bindings.count(45 /* thenableContainments */);
            containThenable2(inspected);
            throw this.#invalidCleanup();
          }
        }, undefined, (token) => {
          origin = token;
        });
      } catch (error) {
        this.failure(error, "cleanup", origin);
      } finally {
        this.#operation.source = previous;
      }
    }
    projection.status = "dormant";
    projection.scopes.forEach((scope) => {
      if (scope.status === "live")
        this.refreshActivity(scope, projection.node);
    });
    if (previousPhase !== undefined)
      this.phase(previousPhase);
  }
  #flushReleases() {
    for (const projection of this.#releases) {
      this.#releases.delete(projection);
      if (projection.retains !== 0)
        continue;
      this.#unattached.delete(projection);
      this.#attachments.delete(projection);
      this.#cleanup(projection);
    }
  }
  invalidate(generation) {
    const projection = generation.projection;
    if (generation.owner !== this || projection === undefined)
      return;
    const activity = this.#bindings.domain.activity;
    if (activity?.kind === "external-subscribe" && activity.generation === generation) {
      if (this.#operation?.terminal)
        return;
      delete generation.retryRequired;
      this.#dirty.add(generation);
      return;
    }
    if (activity !== undefined && activity.kind !== "subscriber") {
      rejectCallbackOperation(this.#bindings.domain);
    }
    if (this.#operation?.terminal)
      return;
    delete generation.retryRequired;
    if (this.#operation !== undefined) {
      this.#event(99 /* invalidate */, projection.node);
      this.#dirty.add(generation);
      return;
    }
    const delivery = this.#delivery;
    if (delivery.depth === 0)
      delivery.work = 0;
    if (delivery.depth >= this.#bounds.deliveryDepth || delivery.work >= this.#bounds.deliveryWork) {
      generation.retryRequired = true;
      this.#bindings.count(47 /* deliveryLimitHits */);
      const limit = new ExternalSourceDeliveryLimitError;
      try {
        this.#event(103 /* deliveryLimit */, projection.node);
      } catch (cause) {
        this.#bindings.domain.externalRuntime.fail([
          {
            cause: limit,
            phase: "sampling",
            source: "external-invalidation",
            committed: false
          },
          {
            cause,
            phase: "instrumenting",
            source: "external-invalidation",
            committed: false
          }
        ]);
      }
      throw limit;
    }
    delivery.depth++;
    delivery.work++;
    this.#bindings.count(46 /* deliveryEntries */);
    try {
      this.run("external-invalidation", () => {
        this.#event(99 /* invalidate */, projection.node);
        this.#dirty.add(generation);
      });
    } finally {
      delivery.depth--;
    }
  }
  #drain() {
    let rounds = 0, samples = 0;
    const frame = this.#operation;
    while (this.#dirty.size > 0) {
      if (rounds >= this.#bounds.rounds || samples >= this.#bounds.samples) {
        this.#exhaust([...this.#dirty]);
        return;
      }
      const batch = [...this.#dirty];
      this.#dirty.clear();
      rounds++;
      this.#bindings.count(43 /* dirtyRounds */);
      this.#event(101 /* drain */);
      frame.source = rounds === 1 && frame.source === "external-invalidation" ? "external-invalidation" : "external-drain";
      frame.phase = 9 /* drainingExternal */;
      const outcomes = [];
      const sampleFailures = [];
      let cursor2 = 0;
      for (;cursor2 < batch.length; cursor2++) {
        const generation = batch[cursor2], projection = generation.projection;
        if (generation.owner !== this || projection?.status !== "active")
          continue;
        if (samples >= this.#bounds.samples)
          break;
        samples++;
        this.#bindings.count(44 /* dirtySamples */);
        const session = new SelectorEvaluationSession;
        try {
          outcomes.push([
            projection,
            this.#sample(projection.node, session)
          ]);
        } catch (error) {
          const fault = session.getControlFault();
          const origin = fault.kind === "fault" ? fault.origin : {};
          outcomes.push([
            projection,
            Object.freeze({ kind: "control-error", error, origin })
          ]);
          sampleFailures.push({ error, origin });
        }
      }
      if (cursor2 < batch.length) {
        const pending2 = [...batch.slice(cursor2), ...this.#dirty];
        this.#exhaust(pending2, outcomes, sampleFailures);
        return;
      }
      this.#round(outcomes, sampleFailures);
      this.#flushReleases();
    }
  }
  #round(outcomes, sampleFailures = []) {
    const previous = this.#pull;
    this.#pull = this.#newPull(false);
    this.#pull.epochAdvanced = false;
    try {
      this.#bindings.settleRead(() => {
        for (const [projection, outcome] of outcomes)
          this.#publish(projection.node, outcome);
        for (const { error, origin } of sampleFailures)
          this.failure(error, "sampling", origin);
      });
    } catch (error) {
      this.failure(error);
    } finally {
      this.#pull = previous;
    }
  }
  #exhaust(pending2, earlier = [], sampleFailures = []) {
    this.#operation.terminal = true;
    this.#operation.source = "external-drain";
    const error = new ExternalSourceNonConvergenceError({
      ...this.#failureMetadata("sampling"),
      committed: true
    });
    this.#bindings.count(48 /* nonConvergenceTerminations */);
    this.#event(102 /* nonconvergence */);
    const outcomes = [...earlier];
    for (const generation of new Set(pending2)) {
      if (generation.owner === this && generation.projection?.status === "active")
        outcomes.push([
          generation.projection,
          Object.freeze({ kind: "error", error })
        ]);
    }
    this.#dirty.clear();
    this.#round(outcomes, [...sampleFailures, { error }]);
    this.#flushReleases();
    this.#dirty.clear();
  }
  get dormantPull() {
    return this.#pull?.dormant === true;
  }
  get idle() {
    return this.#operation === undefined;
  }
  get pendingLifecycle() {
    return this.#attachments.size > 0;
  }
  active(node) {
    return this.#projections.get(node)?.status === "active";
  }
  get admissionAllowed() {
    return this.#operation?.failures.length === 0;
  }
  installed(scope, node) {
    return scope.getMaterializedServedOutcome(node) ?? this.#projections.get(node)?.served;
  }
  current(scope, node) {
    return this.active(node) || !this.reachesDormant(scope, node) && scope.getMaterializedServedOutcome(node) !== undefined;
  }
  #records(scope) {
    let records = this.#retains.get(scope);
    if (records === undefined)
      this.#retains.set(scope, records = new WeakMap);
    return records;
  }
  #dependencies(scope, node) {
    const result = new Set;
    for (const dependency of scope.getCommittedSelectorDependencies(node) ?? []) {
      if (this.reaches(scope, dependency.node))
        result.add(dependency.node);
    }
    return result;
  }
  #retain(scope, node) {
    const records = this.#records(scope);
    const pending2 = [node];
    while (pending2.length > 0) {
      const current = pending2.pop();
      this.#bindings.count(40 /* lifecycleEdgeVisits */);
      let record = records.get(current);
      if (record === undefined)
        records.set(current, record = {
          count: 0,
          root: false,
          dependencies: new Set
        });
      if (record.count++ !== 0)
        continue;
      if (this.#bindings.domain.externalAtoms.has(current)) {
        const projection = this.#projections.get(current);
        if (projection.retains++ === 0) {
          this.#bindings.count(49 /* lifecycleRetains */);
          this.#releases.delete(projection);
          if (projection.status === "dormant") {
            this.#attachments.add(projection);
            this.#unattached.add(projection);
          }
        }
        continue;
      }
      record.dependencies = this.#dependencies(scope, current);
      for (const dependency of record.dependencies)
        pending2.push(dependency);
    }
  }
  #release(scope, node) {
    const records = this.#retains.get(scope);
    const pending2 = [node];
    while (pending2.length > 0) {
      const current = pending2.pop();
      const record = records?.get(current);
      if (record === undefined || record.count === 0)
        continue;
      this.#bindings.count(40 /* lifecycleEdgeVisits */);
      if (--record.count !== 0)
        continue;
      if (this.#bindings.domain.externalAtoms.has(current)) {
        const projection = this.#projections.get(current);
        if (--projection.retains === 0) {
          this.#bindings.count(50 /* lifecycleReleases */);
          this.#releases.add(projection);
        }
      } else {
        for (const dependency of record.dependencies)
          pending2.push(dependency);
        record.dependencies.clear();
      }
      records.delete(current);
    }
  }
  retainRoot(scope, node) {
    if (!this.reaches(scope, node))
      return;
    if (this.#retains.get(scope)?.get(node)?.root)
      return;
    this.#retain(scope, node);
    this.#retains.get(scope).get(node).root = true;
  }
  releaseRoot(scope, node) {
    const record = this.#retains.get(scope)?.get(node);
    if (!record?.root)
      return;
    record.root = false;
    this.#release(scope, node);
  }
  reconcile(scope, node) {
    if (this.#bindings.subscribed(scope, node) && this.reaches(scope, node)) {
      this.retainRoot(scope, node);
    } else
      this.releaseRoot(scope, node);
    const record = this.#retains.get(scope)?.get(node);
    if (record === undefined || this.#bindings.domain.externalAtoms.has(node))
      return;
    const next = this.#dependencies(scope, node);
    for (const dependency of next) {
      if (!record.dependencies.has(dependency))
        this.#retain(scope, dependency);
    }
    for (const dependency of record.dependencies) {
      if (!next.has(dependency))
        this.#release(scope, dependency);
    }
    record.dependencies = next;
  }
  #newPull(dormant) {
    return {
      samples: new Map,
      refreshed: new WeakMap,
      dormant,
      epochAdvanced: !dormant
    };
  }
  beginPropagation() {
    const previous = this.#pull;
    this.#pull ??= this.#newPull(false);
    return previous;
  }
  endPropagation(previous) {
    this.#pull = previous;
  }
  recordSelectorFault(scope, node, error) {
    if (!this.#pull?.dormant)
      return false;
    const byScope = this.#pull.selectorFaults ??= new WeakMap;
    let faults = byScope.get(scope);
    if (faults === undefined)
      byScope.set(scope, faults = new Map);
    faults.set(node, error);
    return true;
  }
  skipSelectorRead(scope, node, session) {
    if (this.#pull?.dormant && !this.#pull.epochAdvanced)
      return true;
    const faults = this.#pull?.selectorFaults?.get(scope);
    if (!faults?.has(node))
      return false;
    const error = faults.get(node);
    session.latchControlFault(error);
    throw error;
  }
  read(scope, node, session) {
    if (this.current(scope, node))
      return scope.serveKnownLocal(node, session);
    this.#pull = this.#newPull(true);
    const failureCount = this.#operation.failures.length;
    let served;
    try {
      this.#bindings.settleRead(() => {
        this.refresh(scope, node, session);
        served = scope.serveKnownLocal(node, session);
      });
      if (this.#operation.failures.length !== failureCount)
        throw recordedExternalFailure;
      return scope.getMaterializedServedOutcome(node) ?? this.#projections.get(node)?.served ?? served;
    } finally {
      this.#pull = undefined;
    }
  }
  #rejectSubscriberRead(session) {
    if (!this.#bindings.subscriberRead() && this.#bindings.domain.activity?.kind !== "subscriber")
      return;
    const error = new DormantExternalReadError;
    session.latchControlFault(error);
    const activity = this.#bindings.domain.activity;
    if (activity?.kind === "subscriber")
      activity.session.latchControlFault(error);
    throw error;
  }
  refresh(scope, node, session) {
    if (!this.reaches(scope, node))
      return;
    if (!this.reachesDormant(scope, node))
      return;
    const pull = this.#pull;
    if (pull === undefined && !this.#bindings.subscriberRead() && this.#bindings.domain.activity?.kind !== "subscriber")
      return;
    let visited = pull?.refreshed.get(scope);
    if (visited === undefined)
      pull?.refreshed.set(scope, visited = new WeakSet);
    visited ??= new WeakSet;
    const pending2 = [node];
    while (pending2.length > 0) {
      const current = pending2.pop();
      if (this.#bindings.domain.externalAtoms.has(current)) {
        this.serve(scope, current, session);
        continue;
      }
      if (visited.has(current))
        continue;
      visited.add(current);
      this.#bindings.count(38 /* externalClosureVisits */);
      const dependencies = scope.getCommittedSelectorDependencies(current) ?? [];
      for (let index = dependencies.length - 1;index >= 0; index--) {
        const dependency = dependencies[index].node;
        if (this.reaches(scope, dependency))
          pending2.push(dependency);
      }
    }
  }
  serve(scope, node, session) {
    const active = this.#projections.get(node);
    if (active?.status === "active") {
      active.scopes.add(scope);
      return active.served;
    }
    this.#rejectSubscriberRead(session);
    if (this.#pull === undefined && this.#bindings.propagating())
      this.#pull = this.#newPull(false);
    const sampled = this.#pull?.samples.get(node);
    if (sampled !== undefined) {
      this.#projections.get(node).scopes.add(scope);
      return sampled;
    }
    if (this.#pull?.faults?.has(node)) {
      const error = this.#pull.faults.get(node);
      session.latchControlFault(error);
      throw error;
    }
    this.#bindings.count(38 /* externalClosureVisits */);
    let outcome;
    try {
      outcome = this.#sample(node, session);
    } catch (error) {
      if (this.#pull !== undefined)
        (this.#pull.faults ??= new Map).set(node, error);
      throw error;
    }
    const served = this.#publish(node, outcome);
    this.#projections.get(node).scopes.add(scope);
    return served;
  }
  #sample(node, session) {
    this.#bindings.count(35 /* liveSamples */);
    this.#event(96 /* sample */, node);
    const previous = this.#operation?.phase;
    this.phase(8 /* samplingExternal */);
    try {
      return sampleExternal(this.#bindings.domain, this.#bindings.domain.externalAtoms.get(node), session, undefined, () => this.#bindings.count(45 /* thenableContainments */));
    } finally {
      if (previous !== undefined)
        this.phase(previous);
    }
  }
  #publish(node, outcome) {
    let projection = this.#projections.get(node);
    const previous = projection?.served;
    const same = previous !== undefined && sameOutcome(previous.outcome, outcome);
    if (!same) {
      const served2 = Object.freeze({
        token: this.#bindings.token(),
        outcome
      });
      if (projection === undefined) {
        projection = {
          node,
          served: served2,
          retains: 0,
          status: "dormant",
          scopes: new WeakHandleSet(() => this.#bindings.count(2 /* deadRouteCompactions */))
        };
        this.#projections.set(node, projection);
      } else
        projection.served = served2;
      this.#bindings.count(39 /* projectionPublications */);
      if (previous !== undefined && this.#pull?.epochAdvanced === false) {
        this.#pull.epochAdvanced = true;
        this.#bindings.advanceEpoch();
      }
      this.#event(100 /* publish */, node);
    }
    const served = projection.served;
    this.#pull?.samples.set(node, served);
    if (previous !== undefined && previous !== served) {
      projection.scopes.forEach((route) => {
        this.#bindings.count(1 /* routeVisits */);
        if (route.status === "live")
          this.#bindings.reach(route, node);
      });
    }
    return served;
  }
}

// packages/valdres/src/v1-internal/committed-store-tree/external-atom.ts
var createInternalExternalAtom = (domain, ...args) => defineExternalAtom(getExternalDomainRecords(domain), args);
class InvalidSynchronousExternalSnapshotError extends Error {
  code = "VALDRES_INVALID_SYNCHRONOUS_EXTERNAL_SNAPSHOT";
  constructor() {
    super("External source snapshots must be synchronous");
    this.name = "InvalidSynchronousExternalSnapshotError";
    Object.freeze(this);
  }
}

class ServerSnapshotUnavailableError extends Error {
  code = "VALDRES_SERVER_SNAPSHOT_UNAVAILABLE";
  dependencyPath;
  constructor(path) {
    super("An external source has no server snapshot");
    this.name = "ServerSnapshotUnavailableError";
    this.dependencyPath = Object.freeze([...path]);
    Object.freeze(this);
  }
}

class DormantExternalReadError extends Error {
  code = "VALDRES_DORMANT_EXTERNAL_READ";
  constructor() {
    super("Subscriber callbacks cannot sample dormant external sources");
    this.name = "DormantExternalReadError";
    Object.freeze(this);
  }
}

class InvalidExternalCleanupError extends Error {
  code = "VALDRES_INVALID_EXTERNAL_CLEANUP";
  phase;
  source;
  committed;
  constructor(metadata = {
    phase: "admitting",
    source: "external-startup",
    committed: false
  }) {
    super("External source subscribe must return a synchronous cleanup function");
    this.name = "InvalidExternalCleanupError";
    this.phase = metadata.phase;
    this.source = metadata.source;
    this.committed = metadata.committed;
    Object.freeze(this);
  }
}

class ExternalSourceNonConvergenceError extends Error {
  code = "VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE";
  phase;
  source;
  committed;
  constructor(metadata = { phase: "sampling", source: "external-drain", committed: true }) {
    super("External sources did not settle within the synchronous work bound");
    this.name = "ExternalSourceNonConvergenceError";
    this.phase = metadata.phase;
    this.source = metadata.source;
    this.committed = metadata.committed;
    Object.freeze(this);
  }
}

class ExternalSourceDeliveryLimitError extends Error {
  code = "VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT";
  phase;
  source;
  committed;
  constructor(metadata = {
    phase: "sampling",
    source: "external-invalidation",
    committed: false
  }) {
    super("External source delivery exceeded the synchronous work bound");
    this.name = "ExternalSourceDeliveryLimitError";
    this.phase = metadata.phase;
    this.source = metadata.source;
    this.committed = metadata.committed;
    Object.freeze(this);
  }
}

class ExternalSourceOperationError extends Error {
  code = "VALDRES_EXTERNAL_SOURCE_OPERATION";
  failures;
  causes;
  cause;
  committed;
  phase;
  source;
  constructor(failures) {
    if (failures.length === 0)
      throw new TypeError("ExternalSourceOperationError requires at least one failure");
    super("An external source operation failed");
    this.name = "ExternalSourceOperationError";
    this.failures = Object.freeze(failures.map(({ cause, committed, phase, source }) => Object.freeze({ cause, committed, phase, source })));
    this.causes = Object.freeze(this.failures.map((failure) => failure.cause));
    this.cause = this.failures[0].cause;
    this.committed = this.failures[0].committed;
    this.phase = this.failures[0].phase;
    this.source = this.failures[0].source;
    Object.freeze(this);
  }
}
var callbackOccurrences = new WeakMap;
function runExternalCallback(domain, session, kind, callback, generation, onControl) {
  const previous = domain.activity;
  const inherited = callbackOccurrences.get(domain);
  const occurrences = onControl === undefined ? inherited : new Map;
  if (onControl !== undefined)
    callbackOccurrences.set(domain, occurrences);
  const selectorActivity = previous?.kind === "selector" ? previous : previous !== undefined && ("selectorActivity" in previous) ? previous.selectorActivity : undefined;
  const guards = [];
  let active = selectorActivity;
  while (active !== undefined) {
    const selectorSession = active.session;
    guards.push({
      session: selectorSession,
      previous: selectorSession.setSuppliedReadGuard(() => rejectGuardedSelectorRead(session, selectorSession))
    });
    active = active.parentSelectorActivity;
  }
  try {
    return runInRuntimeActivity(domain, {
      kind,
      session,
      ...selectorActivity === undefined ? {} : { selectorActivity },
      ...generation === undefined ? {} : { generation }
    }, () => {
      try {
        return callback();
      } finally {
        const fault = session.getControlFault();
        if (fault.kind === "fault")
          throw fault.error;
      }
    });
  } catch (error) {
    const fault = session.getControlFault();
    const origin = fault.kind === "fault" ? fault.origin ?? {} : occurrences?.get(error);
    if (origin !== undefined) {
      occurrences?.set(error, origin);
      onControl?.(origin);
    }
    throw error;
  } finally {
    if (onControl !== undefined) {
      if (inherited === undefined)
        callbackOccurrences.delete(domain);
      else
        callbackOccurrences.set(domain, inherited);
    }
    for (let index = guards.length - 1;index >= 0; index--) {
      const guard = guards[index];
      guard.session.setSuppliedReadGuard(guard.previous);
    }
  }
}
function defineExternalAtom(domain, args) {
  assertRuntimeDefinitionConstructionAllowed(domain);
  const session = new SelectorEvaluationSession;
  const definition = runExternalCallback(domain, session, "guarded-callback", () => {
    if (args.length < 1 || args.length > 2)
      throw new TypeError("externalAtom requires a source and optional options");
    const [source, options] = args;
    if (typeof source !== "object" || source === null || Array.isArray(source))
      throw new TypeError("externalAtom requires a source object");
    const getSnapshot = source.getSnapshot;
    const getServerSnapshot = source.getServerSnapshot;
    const subscribe = source.subscribe;
    if (typeof getSnapshot !== "function" || typeof subscribe !== "function" || getServerSnapshot !== undefined && typeof getServerSnapshot !== "function")
      throw new TypeError("External source methods must be functions");
    let name;
    if (options !== undefined) {
      if (typeof options !== "object" || options === null || Array.isArray(options) || Reflect.ownKeys(options).some((key) => key !== "name"))
        throw new TypeError("ExternalAtom options support only name");
      name = options.name;
      if (name !== undefined && typeof name !== "string")
        throw new TypeError("ExternalAtom name must be a string");
    }
    return Object.freeze({
      source,
      getSnapshot,
      subscribe,
      ...getServerSnapshot === undefined ? {} : { getServerSnapshot },
      ...name === undefined ? {} : { name }
    });
  });
  const handle = registerRuntimeStateHandle(domain, makeStateHandle("external"));
  const definitions = domain.externalAtoms ??= new WeakMap;
  definitions.set(handle, Object.freeze({
    ...definition,
    sample: (session2, path, onThenable) => sampleExternal(domain, definition, session2, path, onThenable)
  }));
  ensureExternalRuntime(domain);
  return handle;
}
function ensureExternalRuntime(domain) {
  if (domain.externalRuntime !== undefined)
    return;
  const delivery = { depth: 0, work: 0 };
  const bounds = {
    rounds: 64,
    samples: 4096,
    deliveryDepth: 32,
    deliveryWork: 4096
  };
  domain.externalRuntime ??= Object.freeze({
    bounds,
    guard: (error) => {
      callbackOccurrences.get(domain)?.set(error, {});
    },
    createTree: (host) => new ExternalProjectionPlane(host, delivery, bounds),
    read: (draft, node, session, serverPath, count) => {
      const sample = () => {
        count?.(serverPath === undefined ? 35 /* liveSamples */ : 36 /* serverSamples */, 1);
        const outcome2 = domain.externalAtoms.get(node).sample(session, serverPath, count === undefined ? undefined : () => count(45 /* thenableContainments */, 1));
        if (serverPath === undefined)
          count?.(37 /* transactionCaptures */, 1);
        return outcome2;
      };
      if (serverPath !== undefined)
        return sample();
      const current = draft.externalCaptures?.get(node);
      if (current !== undefined)
        return current;
      const outcome = sample();
      let captures = draft.externalCaptures;
      if (captures === undefined) {
        draft.onAllocation?.();
        captures = draft.externalCaptures = new Map;
      }
      captures.set(node, outcome);
      return outcome;
    },
    fail: (failures, preserveMetadata = false, internal = []) => {
      if (failures.length === 0)
        throw new TypeError("ExternalSourceOperationError requires at least one failure");
      if (failures.length > 1 && internal[0] && isInternalRuntimeMismatch(failures[0].cause) && failures.every((failure) => failure.source === "owned-mutation") && failures.slice(1).every((failure) => failure.phase === "notifying"))
        throw new SubscriberNotificationError(failures.map((failure) => failure.cause));
      if (failures.every((failure) => failure.phase === "notifying"))
        throw new SubscriberNotificationError(failures.map((failure) => failure.cause), failures[0].source);
      if (!preserveMetadata && failures.length === 1) {
        const failure = failures[0];
        if (failure.phase !== "admitting" && failure.phase !== "cleanup" || internal[0])
          throw failure.cause;
      }
      throw new ExternalSourceOperationError(failures);
    }
  });
}
function sampleExternal(domain, definition, session, serverPath, onThenable) {
  const server = serverPath !== undefined;
  const read = server ? definition.getServerSnapshot : definition.getSnapshot;
  if (read === undefined) {
    const error = new ServerSnapshotUnavailableError(serverPath);
    session.latchControlFault(error);
    throw error;
  }
  return runExternalCallback(domain, session, server ? "external-server-snapshot" : "external-snapshot", () => {
    let value;
    let threw = false;
    try {
      value = Reflect.apply(read, definition.source, []);
    } catch (error) {
      value = error;
      threw = true;
    }
    const inspected = inspectThenable2(value);
    if (inspected.kind === "inspection-error")
      return Object.freeze({ kind: "error", error: inspected.error });
    if (inspected.kind === "thenable") {
      onThenable?.();
      containThenable2(inspected);
      return Object.freeze({
        kind: "error",
        error: new InvalidSynchronousExternalSnapshotError
      });
    }
    return threw ? Object.freeze({ kind: "error", error: value }) : Object.freeze({ kind: "value", value });
  });
}

// packages/valdres/src/v1-internal/weak-member-cache.ts
var nativeWeakRuntime = {
  ref: (target) => new WeakRef(target),
  registry: (cleanup) => {
    const registry = new FinalizationRegistry(cleanup);
    return Object.freeze({
      register: (target, held, token) => registry.register(target, held, token),
      unregister: (token) => registry.unregister(token)
    });
  }
};

class WeakTupleMemberCache {
  #root = {
    parent: undefined,
    parentKey: undefined,
    children: undefined,
    entry: undefined
  };
  #registry;
  #createMember;
  #onReady;
  #recursionError;
  constructor(createMember, recursionError, weakRuntime = nativeWeakRuntime, onReady) {
    this.#createMember = createMember;
    this.#onReady = onReady;
    this.#recursionError = recursionError;
    this.#registry = weakRuntime.registry((entry) => {
      const route = entry.route;
      if (route.entry !== entry)
        return;
      route.entry = undefined;
      this.#prune(route);
    });
    this.#ref = (target) => weakRuntime.ref(target);
  }
  #ref;
  getOrCreateOne(key, args) {
    return this.#resolve(this.#descend(this.#root, key), args);
  }
  getOrCreateTuple(keys, args) {
    let route = this.#root;
    for (let index = 0;index < keys.length; index++) {
      route = this.#descend(route, keys[index]);
    }
    return this.#resolve(route, args);
  }
  get routeCount() {
    let count = 0;
    const visit = (route) => {
      if (route.children === undefined)
        return;
      for (const child of route.children.values()) {
        count++;
        visit(child);
      }
    };
    visit(this.#root);
    return count;
  }
  hasRoute(keys) {
    let route = this.#root;
    for (let index = 0;index < keys.length; index++) {
      const child = route.children?.get(keys[index]);
      if (child === undefined)
        return false;
      route = child;
    }
    return true;
  }
  #descend(parent, key) {
    const children = parent.children ?? (parent.children = new Map);
    let child = children.get(key);
    if (child !== undefined)
      return child;
    child = {
      parent,
      parentKey: key,
      children: undefined,
      entry: undefined
    };
    children.set(key, child);
    return child;
  }
  #resolve(route, args) {
    const current = route.entry;
    if (current?.kind === "ready") {
      const member = current.reference.deref();
      if (member !== undefined)
        return member;
      this.#registry.unregister(current);
      if (route.entry === current)
        route.entry = undefined;
    } else if (current?.kind === "building") {
      const fault = current.fault ?? this.#recursionError();
      current.fault = fault;
      throw fault;
    }
    const building = {
      kind: "building",
      route,
      fault: undefined
    };
    route.entry = building;
    try {
      const member = this.#createMember(args);
      if (building.fault !== undefined)
        throw building.fault;
      this.#onReady?.(member);
      const ready = {
        kind: "ready",
        route,
        reference: this.#ref(member)
      };
      route.entry = ready;
      this.#registry.register(member, ready, ready);
      return member;
    } catch (error) {
      if (route.entry === building)
        route.entry = undefined;
      this.#prune(route);
      throw building.fault ?? error;
    }
  }
  #prune(start) {
    let route = start;
    while (route.parent !== undefined && route.entry === undefined && (route.children === undefined || route.children.size === 0)) {
      const parent = route.parent;
      const children = parent.children;
      if (children?.get(route.parentKey) !== route)
        return;
      children.delete(route.parentKey);
      if (children.size === 0)
        parent.children = undefined;
      route = parent;
    }
  }
}

// packages/valdres/src/v1-internal/family.ts
var NOT_THENABLE3 = { kind: "not-thenable" };
var NOOP3 = () => {};
var inspectThenable3 = (value) => {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") {
    return NOT_THENABLE3;
  }
  try {
    const then = value.then;
    return typeof then === "function" ? Object.freeze({
      kind: "thenable",
      target: value,
      then
    }) : NOT_THENABLE3;
  } catch (error) {
    return Object.freeze({ kind: "inspection-error", error });
  }
};
var rejectThenable = (inspected) => {
  try {
    Reflect.apply(inspected.then, inspected.target, [undefined, NOOP3]);
  } catch {}
  throw new TypeError("Definition callbacks must complete synchronously");
};
var runSynchronousDefinitionCallback = (runDefinitionCallback2, phase, callback, args, validate) => runDefinitionCallback2(phase, (...callbackArgs) => {
  let result;
  try {
    result = Reflect.apply(callback, undefined, callbackArgs);
  } catch (thrown) {
    const inspected2 = inspectThenable3(thrown);
    if (inspected2.kind === "not-thenable")
      throw thrown;
    if (inspected2.kind === "inspection-error") {
      throw inspected2.error;
    }
    return rejectThenable(inspected2);
  }
  const inspected = inspectThenable3(result);
  if (inspected.kind === "not-thenable")
    return result;
  if (inspected.kind === "inspection-error")
    throw inspected.error;
  return rejectThenable(inspected);
}, args, validate);
var familyRecursionError = () => new TypeError("family cannot recursively construct the same member");
var isFamilyKey = (value) => value === null || value === undefined || typeof value !== "object" && typeof value !== "function";
var structuredFamilyKeyError = () => new TypeError("family keys must be primitive; use encodeKey for structured arguments");
var encodedFamilyKeyError = () => new TypeError("family encodeKey must return one primitive FamilyKey");
var familyArgumentCountError = () => new TypeError("family members require at least one key");
var createFamilyAccessor = (createNode, encodeKey, runDefinitionCallback2, assertMember, markReady, assertCallAllowed) => {
  let encodingFrame;
  const cache = new WeakTupleMemberCache((args) => runSynchronousDefinitionCallback(runDefinitionCallback2, "factory", createNode, args, assertMember), familyRecursionError, undefined, markReady);
  const callable = {
    family(first) {
      const args = arguments;
      const activeEncoding = encodingFrame;
      if (activeEncoding !== undefined) {
        const fault = activeEncoding.fault ?? new TypeError("family encodeKey cannot call its own family");
        activeEncoding.fault = fault;
        throw fault;
      }
      assertCallAllowed();
      if (args.length === 0)
        throw familyArgumentCountError();
      if (encodeKey !== undefined) {
        const frame = { fault: undefined };
        encodingFrame = frame;
        let key;
        try {
          key = runSynchronousDefinitionCallback(runDefinitionCallback2, "encoder", encodeKey, args);
        } catch (error) {
          throw frame.fault ?? error;
        } finally {
          encodingFrame = undefined;
        }
        if (frame.fault !== undefined)
          throw frame.fault;
        if (!isFamilyKey(key))
          throw encodedFamilyKeyError();
        return cache.getOrCreateOne(key, args);
      }
      if (args.length === 1) {
        if (!isFamilyKey(first))
          throw structuredFamilyKeyError();
        return cache.getOrCreateOne(first, args);
      }
      for (let index = 0;index < args.length; index++) {
        if (!isFamilyKey(args[index])) {
          throw structuredFamilyKeyError();
        }
      }
      return cache.getOrCreateTuple(args, args);
    }
  }.family;
  return Object.freeze(callable);
};

// packages/valdres/src/v1-internal/ordered-membership.ts
class OrderedMembership {
  entries = new Map;
  tail;
  nextRank = 0;
  constructor(rows) {
    for (const row of rows)
      this.append(row);
  }
  append(row) {
    const previous = this.tail;
    this.entries.set(row, { rank: this.nextRank++, previous });
    if (previous !== undefined)
      this.entries.get(previous).next = row;
    this.tail = row;
  }
  remove(row) {
    const entry = this.entries.get(row);
    if (entry === undefined)
      return;
    if (entry.previous !== undefined)
      this.entries.get(entry.previous).next = entry.next;
    if (entry.next !== undefined)
      this.entries.get(entry.next).previous = entry.previous;
    else
      this.tail = entry.previous;
    this.entries.delete(row);
  }
  changes(removals, births) {
    if (removals.length !== births.length)
      return true;
    const removed = new Set(removals);
    let cursor2 = this.tail;
    for (let i = births.length - 1;i >= 0; i--) {
      if (births[i] !== cursor2 || !removed.has(births[i]))
        return true;
      cursor2 = this.entries.get(cursor2)?.previous;
    }
    return false;
  }
}

// packages/valdres/src/v1-internal/collection-inspection-protocol.ts
var COLLECTION_ROW_INTENTS_STAGED = 35;
var COLLECTION_ROW_INTENT_STORAGE_ALLOCATIONS = 36;
var COLLECTION_ROW_FINAL_RESOLUTION_VISITS = 37;
var COLLECTION_ROW_ROUTE_VISITS = 38;
var COLLECTION_MEMBERSHIP_RECORD_CREATIONS = 39;
var COLLECTION_MEMBERSHIP_ROUTE_VISITS = 40;
var COLLECTION_MEMBERSHIP_ROWS_SCANNED = 41;
var COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS = 42;
var COLLECTION_ROW_SOURCES_CHANGED = 43;
var COLLECTION_MEMBERSHIP_SOURCES_CHANGED = 44;
var COLLECTION_EFFECTIVE_DELTAS_PREPARED = 45;
var COLLECTION_OWNER_RETENTION_SETS_CREATED = 46;
var COLLECTION_OWNER_RETAINS = 47;
var COLLECTION_OWNER_RELEASES = 48;
var COLLECTION_INTENT_SET = 64;
var COLLECTION_INTENT_UPDATE = 65;
var COLLECTION_INTENT_RESET = 66;
var COLLECTION_INTENT_DELETE = 67;
var COLLECTION_EFFECTIVE_INSERT = 68;
var COLLECTION_EFFECTIVE_UPDATE = 69;
var COLLECTION_EFFECTIVE_REMOVE = 70;
var COLLECTION_MEMBERSHIP_INSERT = 71;
var COLLECTION_MEMBERSHIP_REMOVE = 72;
var COLLECTION_ROW_PUBLISHED = 73;
var COLLECTION_MEMBERSHIP_PUBLISHED = 74;
var COLLECTION_ROW_MATERIALIZED = 75;
var COLLECTION_MEMBERSHIP_MATERIALIZED = 76;
var COLLECTION_INDEX_ROUTE_VISITS = 55;

// packages/valdres/src/v1-internal/collection-kernel.ts
var BASELINE_BIRTH = Symbol("collection baseline birth");
var restoredMembershipChanges = (before, after) => {
  const changes = new Map;
  const kept = new Set(after);
  for (const row of before)
    if (!kept.has(row))
      changes.set(row, {
        baselinePresent: true,
        transitions: [],
        birth: undefined
      });
  const previous = new Set(before);
  for (const row of after)
    if (!previous.has(row))
      changes.set(row, {
        baselinePresent: false,
        transitions: [],
        birth: 0
      });
  return changes;
};
var isDescendantOf = (scope, ancestor) => {
  for (let current = scope.parent;current !== undefined; current = current.parent)
    if (current === ancestor)
      return true;
  return false;
};

class ImmutableCollectionError extends Error {
  seal() {
    Object.freeze(this);
  }
}

class InvalidSynchronousCollectionValueError extends ImmutableCollectionError {
  code = "VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE";
  constructor() {
    super("Collection row values must be synchronous");
    this.name = "InvalidSynchronousCollectionValueError";
    this.seal();
  }
}

class UndefinedCollectionValueError extends ImmutableCollectionError {
  code = "VALDRES_UNDEFINED_COLLECTION_VALUE";
  constructor() {
    super("Collection row values cannot be undefined");
    this.name = "UndefinedCollectionValueError";
    this.seal();
  }
}

class MissingCollectionRowError extends ImmutableCollectionError {
  code = "VALDRES_MISSING_COLLECTION_ROW";
  constructor() {
    super("Cannot update an absent collection row");
    this.name = "MissingCollectionRowError";
    this.seal();
  }
}
var NONE = Object.freeze({ kind: "none" });
var ABSENT_LOCAL = Object.freeze({ kind: "absent" });
var ABSENT = Object.freeze({ kind: "absent" });
var EMPTY_ROWS = Object.freeze([]);
var presentLocal = (value) => Object.freeze({ kind: "present", value });
var presentOutcome = (value) => Object.freeze({ kind: "present", value });
var sameOutcome2 = (first, second) => first.kind === second.kind && (first.kind === "absent" || second.kind === "present" && Object.is(first.value, second.value));
var sameLocal = (first, second) => first.kind === second.kind && (first.kind !== "present" || second.kind === "present" && Object.is(first.value, second.value));
var freezeBaseline = (baseline) => {
  const local = baseline.local.kind === "present" ? presentLocal(baseline.local.value) : baseline.local.kind === "absent" ? ABSENT_LOCAL : NONE;
  const effective = baseline.effective.kind === "present" ? presentOutcome(baseline.effective.value) : ABSENT;
  const inherited = baseline.inherited.kind === "present" ? presentOutcome(baseline.inherited.value) : ABSENT;
  if (local.kind === "none" && !sameOutcome2(effective, inherited)) {
    throw new Error("Collection baseline without local ownership must equal inherited outcome");
  }
  if (local.kind === "present" && (effective.kind !== "present" || !Object.is(local.value, effective.value))) {
    throw new Error("Collection present local baseline must equal its effective outcome");
  }
  if (local.kind === "absent" && effective.kind !== "absent") {
    throw new Error("Collection absent local baseline must be effectively absent");
  }
  return Object.freeze({ local, effective, inherited });
};
var currentLocal = (coordinate) => {
  const final = coordinate.final;
  if (final === undefined)
    return coordinate.baseline.local;
  if (final.kind === "present")
    return presentLocal(final.value);
  return final.kind === "absent" ? ABSENT_LOCAL : NONE;
};
var outcomeForLocal = (local, inherited) => local.kind === "present" ? presentOutcome(local.value) : local.kind === "absent" ? ABSENT : inherited;
var servedOutcome = (outcome) => Object.freeze({
  kind: "value",
  value: outcome.kind === "present" ? outcome.value : undefined
});
var createCollectionKernel = (bindings, readBaselineOverride) => {
  let indexes;
  const lanes = new WeakMap;
  const scopeSidecars = new WeakMap;
  let membershipRebuildTraceForTest;
  let membershipPlacementTraceForTest;
  const extensionRecorder = (scope) => scope.coordinator?.evaluate?.recordExtension;
  const recordCounter = (scope, code, amount = 1) => {
    extensionRecorder(scope)?.(code, amount);
  };
  const recordDetail = (scope, code, target, related) => {
    extensionRecorder(scope)?.(code, scope, target, related);
  };
  const sameRowsWhileProducingSnapshot = (scope, first, second) => {
    if (first.length !== second.length)
      return false;
    const recorder = extensionRecorder(scope);
    if (recorder === undefined) {
      for (let index = 0;index < first.length; index++) {
        if (!Object.is(first[index], second[index]))
          return false;
      }
      return true;
    }
    for (let index = 0;index < first.length; index++) {
      if (!Object.is(first[index], second[index])) {
        recorder(COLLECTION_MEMBERSHIP_ROWS_SCANNED, index + 1);
        return false;
      }
    }
    if (first.length) {
      recorder(COLLECTION_MEMBERSHIP_ROWS_SCANNED, first.length);
    }
    return true;
  };
  const sidecarFor = (scope) => {
    let sidecar = scopeSidecars.get(scope);
    if (sidecar !== undefined)
      return sidecar;
    sidecar = {
      rowLocals: undefined,
      ownedRows: undefined,
      rowViews: undefined,
      liveRowViews: undefined,
      memberships: undefined,
      liveMemberships: undefined
    };
    scopeSidecars.set(scope, sidecar);
    return sidecar;
  };
  const committedLocal = (scope, row) => scopeSidecars.get(scope)?.rowLocals?.get(row) ?? NONE;
  const committedOutcome = (scope, row) => {
    let current = scope;
    while (current !== undefined) {
      const local = committedLocal(current, row);
      if (local.kind === "present")
        return presentOutcome(local.value);
      if (local.kind === "absent")
        return ABSENT;
      current = current.parent;
    }
    return ABSENT;
  };
  const readCommittedBaseline = (scope, row) => {
    const local = committedLocal(scope, row);
    const inherited = committedOutcome(scope.parent, row);
    return Object.freeze({
      local,
      effective: outcomeForLocal(local, inherited),
      inherited
    });
  };
  const readBaseline = readBaselineOverride ?? readCommittedBaseline;
  const draftLocal = (lane, scope, row, collection) => {
    const coordinate = lane.byScope.get(scope)?.get(row);
    if (coordinate !== undefined)
      return currentLocal(coordinate);
    return freezeBaseline(readBaseline(scope, row, collection)).local;
  };
  const draftOutcome = (lane, scope, row, collection) => {
    let current = scope;
    while (current !== undefined) {
      const local = draftLocal(lane, current, row, collection);
      if (local.kind === "present")
        return presentOutcome(local.value);
      if (local.kind === "absent")
        return ABSENT;
      if (readBaselineOverride !== undefined) {
        const coordinate = lane.byScope.get(current)?.get(row);
        if (coordinate !== undefined) {
          return coordinate.baseline.inherited;
        }
        return freezeBaseline(readBaseline(current, row, collection)).inherited;
      }
      current = current.parent;
    }
    return ABSENT;
  };
  const replayEnablingBirth = (lane, scope, row, collection) => {
    if (readBaselineOverride !== undefined) {
      const baseline = freezeBaseline(readBaseline(scope, row, collection));
      let present = baseline.effective.kind === "present";
      let birth = present ? BASELINE_BIRTH : undefined;
      for (const event of lane.byRow.get(row)?.historyByScope.get(scope) ?? []) {
        if (!Object.is(event.row, row) || !Object.is(event.scope, scope)) {
          continue;
        }
        const nextPresent = event.kind === "present" || event.kind === "reset" && baseline.inherited.kind === "present";
        if (!present && nextPresent)
          birth = event.sequence;
        else if (!nextPresent)
          birth = undefined;
        present = nextPresent;
      }
      return birth;
    }
    return replayRouteBirth(lane, scope, row, collection, undefined);
  };
  const createRowView = (scope, row, outcome, inheritedFrom) => {
    const sidecar = sidecarFor(scope);
    const existing = sidecar.rowViews?.get(row);
    if (existing !== undefined)
      return existing;
    const record = {
      scope,
      atom: row,
      served: Object.freeze({
        token: scope.createOutcomeToken(),
        outcome: servedOutcome(outcome)
      }),
      inheritedFrom,
      inheritingChildren: new WeakHandleSet(() => scope.coordinator.recordCounter(2 /* deadRouteCompactions */))
    };
    let rowViews = sidecar.rowViews;
    if (rowViews === undefined) {
      rowViews = new WeakMap;
      sidecar.rowViews = rowViews;
    }
    let liveRowViews = sidecar.liveRowViews;
    if (liveRowViews === undefined) {
      liveRowViews = new WeakHandleSet(() => scope.coordinator.recordCounter(2 /* deadRouteCompactions */));
      sidecar.liveRowViews = liveRowViews;
    }
    rowViews.set(row, record);
    liveRowViews.add(record);
    recordDetail(scope, COLLECTION_ROW_MATERIALIZED, row, bindings.lookupRow(row));
    if (inheritedFrom !== undefined) {
      inheritedFrom.inheritingChildren.add(record);
      scope.coordinator.recordCounter(11 /* routeAdds */);
    }
    return record;
  };
  const materializeRowView = (scope, row) => {
    let currentScope = scope;
    const unresolved = [];
    let current;
    while (true) {
      recordCounter(currentScope, COLLECTION_ROW_ROUTE_VISITS);
      const sidecar = scopeSidecars.get(currentScope);
      const materialized = sidecar?.rowViews?.get(row);
      if (materialized !== undefined) {
        current = materialized;
        break;
      }
      const local = sidecar?.rowLocals?.get(row);
      if (local !== undefined) {
        current = createRowView(currentScope, row, local.kind === "present" ? presentOutcome(local.value) : ABSENT);
        break;
      }
      if (currentScope.parent === undefined) {
        current = createRowView(currentScope, row, ABSENT);
        break;
      }
      unresolved.push(currentScope);
      currentScope = currentScope.parent;
    }
    for (let index = unresolved.length - 1;index >= 0; index--) {
      current = createRowView(unresolved[index], row, current.served.outcome.kind === "value" && current.served.outcome.value !== undefined ? presentOutcome(current.served.outcome.value) : ABSENT, current);
    }
    return current;
  };
  const detachRowView = (record) => {
    const inheritedFrom = record.inheritedFrom;
    if (inheritedFrom === undefined)
      return;
    inheritedFrom.inheritingChildren.delete(record);
    record.inheritedFrom = undefined;
    record.scope.coordinator.recordCounter(12 /* routeRemoves */);
  };
  const attachRowView = (record, inheritedFrom) => {
    if (Object.is(record.inheritedFrom, inheritedFrom))
      return;
    detachRowView(record);
    record.inheritedFrom = inheritedFrom;
    inheritedFrom.inheritingChildren.add(record);
    record.scope.coordinator.recordCounter(11 /* routeAdds */);
  };
  const membershipRows = (record) => {
    if (record.snapshotDirty) {
      const rows = Object.freeze([...record.ordered.entries.keys()]);
      recordCounter(record.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, rows.length);
      recordCounter(record.scope, COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS);
      record.served = servedMembership(record.scope, rows, record.served.token);
      record.snapshotDirty = false;
    }
    return record.served.outcome.kind === "value" ? record.served.outcome.value : EMPTY_ROWS;
  };
  const indexedMembership = (scope, collection) => {
    const record = materializeMembership(scope, collection);
    let current = record;
    while (current !== undefined && current.ordered === undefined) {
      current.ordered = new OrderedMembership(membershipRows(current));
      const parent = current.inheritedFrom;
      if (parent !== undefined) {
        (parent.indexedChildren ??= new WeakHandleSet).add(current);
      }
      current = parent;
    }
    return record.ordered;
  };
  const copyMembershipRows = (scope, rows) => {
    if (rows.length) {
      recordCounter(scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, rows.length);
    }
    const copy = Object.freeze([...rows]);
    recordCounter(scope, COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS);
    return copy;
  };
  const servedMembership = (scope, rows, token = scope.createOutcomeToken()) => Object.freeze({
    token,
    outcome: Object.freeze({ kind: "value", value: rows })
  });
  const registerMembershipRecord = (scope, collection, rows, deferred = false) => {
    const sidecar = sidecarFor(scope);
    const current = sidecar.memberships?.get(collection);
    if (current !== undefined)
      return current;
    const record = {
      scope,
      atom: collection,
      served: servedMembership(scope, rows, deferred ? EMPTY_ROWS : undefined),
      inheritedFrom: undefined,
      inheritingChildren: new WeakHandleSet(() => scope.coordinator.recordCounter(2 /* deadRouteCompactions */))
    };
    let memberships = sidecar.memberships;
    if (memberships === undefined) {
      memberships = new WeakMap;
      sidecar.memberships = memberships;
    }
    let liveMemberships = sidecar.liveMemberships;
    if (liveMemberships === undefined) {
      liveMemberships = new WeakHandleSet(() => scope.coordinator.recordCounter(2 /* deadRouteCompactions */));
      sidecar.liveMemberships = liveMemberships;
    }
    memberships.set(collection, record);
    liveMemberships.add(record);
    recordCounter(scope, COLLECTION_MEMBERSHIP_RECORD_CREATIONS);
    recordDetail(scope, COLLECTION_MEMBERSHIP_MATERIALIZED, collection);
    return record;
  };
  const detachMembership = (record) => {
    const inheritedFrom = record.inheritedFrom;
    if (inheritedFrom === undefined)
      return;
    inheritedFrom.inheritingChildren.delete(record);
    inheritedFrom.indexedChildren?.delete(record);
    record.inheritedFrom = undefined;
    record.scope.coordinator.recordCounter(12 /* routeRemoves */);
  };
  const attachMembership = (record, inheritedFrom) => {
    if (Object.is(record.inheritedFrom, inheritedFrom))
      return;
    detachMembership(record);
    record.inheritedFrom = inheritedFrom;
    inheritedFrom.inheritingChildren.add(record);
    record.scope.coordinator.recordCounter(11 /* routeAdds */);
  };
  const materializeMembership = (scope, collection) => {
    let currentScope = scope;
    const unresolved = [];
    let current;
    while (true) {
      recordCounter(currentScope, COLLECTION_MEMBERSHIP_ROUTE_VISITS);
      const materialized = scopeSidecars.get(currentScope)?.memberships?.get(collection);
      if (materialized !== undefined) {
        current = materialized;
        if (current.served.token === EMPTY_ROWS) {
          const rows = copyMembershipRows(currentScope, membershipRows(current));
          current.served = servedMembership(currentScope, rows);
        }
        break;
      }
      if (currentScope.parent === undefined) {
        current = registerMembershipRecord(currentScope, collection, copyMembershipRows(currentScope, EMPTY_ROWS));
        break;
      }
      unresolved.push(currentScope);
      currentScope = currentScope.parent;
    }
    for (let index = unresolved.length - 1;index >= 0; index--) {
      const scope2 = unresolved[index];
      const rows = copyMembershipRows(scope2, membershipRows(current));
      const child = registerMembershipRecord(scope2, collection, rows);
      attachMembership(child, current);
      current = child;
    }
    return current;
  };
  const releaseDraft = (draftValue) => {
    const draft = draftValue;
    indexes?.release(draft);
    const lane = lanes.get(draft);
    if (lane === undefined)
      return;
    lanes.delete(draft);
    for (const coordinates of lane.byScope.values()) {
      for (const coordinate of coordinates.values()) {
        coordinate.final = undefined;
        coordinate.finalOperation = undefined;
      }
      coordinates.clear();
    }
    lane.byScope.clear();
    lane.planOrder.length = 0;
    lane.history.length = 0;
    for (const byScope of lane.historyByCollectionScope.values()) {
      for (const history of byScope.values())
        history.length = 0;
      byScope.clear();
    }
    lane.historyByCollectionScope.clear();
    for (const rowLane of lane.byRow.values()) {
      for (const coordinates of rowLane.coordinatesByAncestor.values()) {
        coordinates.length = 0;
      }
      rowLane.coordinatesByAncestor.clear();
      for (const history of rowLane.historyByScope.values()) {
        history.length = 0;
      }
      rowLane.historyByScope.clear();
    }
    lane.byRow.clear();
    lane.revisionByCollection.clear();
    lane.queryRevisionByCollection?.clear();
    for (const byCollection of lane.membershipMemo.values()) {
      byCollection.clear();
    }
    lane.membershipMemo.clear();
  };
  const laneFor = (draft) => {
    let lane = lanes.get(draft);
    if (lane !== undefined)
      return lane;
    lane = {
      byScope: new Map,
      planOrder: [],
      history: [],
      historyByCollectionScope: new Map,
      byRow: new Map,
      revisionByCollection: new Map,
      membershipMemo: new Map,
      nextDiscoveryIndex: 0,
      hasAcceptedIntent: false
    };
    draft.installRows(releaseDraft);
    lanes.set(draft, lane);
    return lane;
  };
  const collectionForRow = (row) => {
    const collection = bindings.lookupRow(row);
    if (collection === undefined) {
      throw new TypeError("Collection draft operation requires a valid row");
    }
    return collection;
  };
  const advanceMembershipRevision = (lane, collection) => {
    lane.revisionByCollection.set(collection, (lane.revisionByCollection.get(collection) ?? 0) + 1);
  };
  const invalidateCollectionReads = (lane, collection) => {
    advanceMembershipRevision(lane, collection);
    const queryRevision = lane.queryRevisionByCollection?.get(collection);
    if (queryRevision !== undefined)
      lane.queryRevisionByCollection.set(collection, queryRevision + 1);
  };
  const restoringCollection = (lane, collection) => {
    for (const marker of lane.rebased?.values() ?? [])
      if (marker.collections.has(collection))
        return true;
    return false;
  };
  const coordinateFor = (draft, scope, row, collection = collectionForRow(row)) => {
    const lane = laneFor(draft);
    let coordinates = lane.byScope.get(scope);
    if (coordinates === undefined) {
      coordinates = new Map;
      lane.byScope.set(scope, coordinates);
    }
    let coordinate = coordinates.get(row);
    if (coordinate !== undefined)
      return coordinate;
    if (membershipPlacementTraceForTest !== undefined) {
      membershipPlacementTraceForTest.coordinates++;
    }
    const committed = freezeBaseline(readBaseline(scope, row, collection));
    const inherited = readBaselineOverride === undefined ? draftOutcome(lane, scope.parent, row, collection) : committed.inherited;
    const baseline = freezeBaseline({
      local: committed.local,
      effective: outcomeForLocal(committed.local, inherited),
      inherited
    });
    coordinate = {
      scope,
      row,
      collection,
      baseline,
      discoveryIndex: lane.nextDiscoveryIndex++,
      planIndex: undefined,
      final: undefined,
      finalOperation: undefined,
      enablingBirth: undefined
    };
    coordinates.set(row, coordinate);
    let rowLane = lane.byRow.get(row);
    if (rowLane === undefined) {
      rowLane = {
        coordinatesByAncestor: new Map,
        historyByScope: new Map
      };
      lane.byRow.set(row, rowLane);
    }
    let ancestor = scope;
    while (ancestor !== undefined) {
      let descendants = rowLane.coordinatesByAncestor.get(ancestor);
      if (descendants === undefined) {
        descendants = [];
        rowLane.coordinatesByAncestor.set(ancestor, descendants);
      }
      descendants.push(coordinate);
      ancestor = ancestor.parent;
    }
    coordinate.enablingBirth = replayEnablingBirth(lane, scope, row, collection);
    return coordinate;
  };
  const installEvent = (draft, coordinate, operation, final, local, effective) => {
    const beforeLocal = currentLocal(coordinate);
    const lane = laneFor(draft);
    const beforeEffective = draftOutcome(lane, coordinate.scope, coordinate.row, coordinate.collection);
    if (sameLocal(beforeLocal, local) && sameOutcome2(beforeEffective, effective)) {
      return;
    }
    if (!lane.hasAcceptedIntent) {
      lane.hasAcceptedIntent = true;
      recordCounter(coordinate.scope, COLLECTION_ROW_INTENT_STORAGE_ALLOCATIONS);
    }
    recordCounter(coordinate.scope, COLLECTION_ROW_INTENTS_STAGED);
    const affectedCoordinates = [];
    for (const candidate of lane.byRow.get(coordinate.row).coordinatesByAncestor.get(coordinate.scope) ?? []) {
      const candidateEffective = draftOutcome(lane, candidate.scope, candidate.row, candidate.collection);
      affectedCoordinates.push({
        coordinate: candidate,
        effective: candidateEffective,
        placement: candidateEffective.kind === "present" ? candidate.enablingBirth : undefined
      });
    }
    const sequence = draft.generation;
    if (coordinate.planIndex === undefined) {
      coordinate.planIndex = lane.planOrder.length;
      lane.planOrder.push(coordinate);
    }
    coordinate.final = final;
    coordinate.finalOperation = operation;
    const event = Object.freeze({
      coordinateId: coordinate.discoveryIndex,
      scope: coordinate.scope,
      row: coordinate.row,
      collection: coordinate.collection,
      kind: final.kind,
      sequence
    });
    lane.history.push(event);
    const rowLane = lane.byRow.get(coordinate.row);
    let scopeHistory = rowLane.historyByScope.get(coordinate.scope);
    if (scopeHistory === undefined) {
      scopeHistory = [];
      rowLane.historyByScope.set(coordinate.scope, scopeHistory);
    }
    scopeHistory.push(event);
    let byCollection = lane.historyByCollectionScope.get(coordinate.collection);
    if (byCollection === undefined) {
      byCollection = new Map;
      lane.historyByCollectionScope.set(coordinate.collection, byCollection);
    }
    let collectionScopeHistory = byCollection.get(coordinate.scope);
    if (collectionScopeHistory === undefined) {
      collectionScopeHistory = [];
      byCollection.set(coordinate.scope, collectionScopeHistory);
    }
    const firstScopeEvent = collectionScopeHistory.length === 0;
    collectionScopeHistory.push(event);
    let placementChanged = false;
    for (const before of affectedCoordinates) {
      const candidate = before.coordinate;
      const after = draftOutcome(lane, candidate.scope, candidate.row, candidate.collection);
      if (before.effective.kind === "absent" && after.kind === "present") {
        candidate.enablingBirth = sequence;
      } else if (after.kind === "absent") {
        candidate.enablingBirth = undefined;
      }
      const placement = after.kind === "present" ? candidate.enablingBirth : undefined;
      if (!Object.is(before.placement, placement)) {
        placementChanged = true;
      }
    }
    if (placementChanged || firstScopeEvent && lane.rebased !== undefined && restoringCollection(lane, coordinate.collection) && rebaseFor(lane, coordinate.scope, coordinate.collection) === undefined) {
      advanceMembershipRevision(lane, coordinate.collection);
    }
    const queryRevision = lane.queryRevisionByCollection?.get(coordinate.collection);
    if (queryRevision !== undefined)
      lane.queryRevisionByCollection.set(coordinate.collection, queryRevision + 1);
    draft.markRow(sequence);
  };
  const invalidSynchronousValue = () => new InvalidSynchronousCollectionValueError;
  const validateValue = (value) => {
    const inspected = bindings.inspectThenable(value);
    if (inspected.kind === "inspection-error")
      throw inspected.error;
    if (inspected.kind === "thenable") {
      bindings.containThenable(inspected);
      throw invalidSynchronousValue();
    }
    if (value === undefined)
      throw new UndefinedCollectionValueError;
    return value;
  };
  const runUpdater = (update, current, session) => bindings.runGuarded(session, () => {
    let candidate;
    try {
      candidate = Reflect.apply(update, undefined, [current]);
    } catch (thrown) {
      const inspected = bindings.inspectThenable(thrown);
      if (inspected.kind === "not-thenable")
        throw thrown;
      if (inspected.kind === "inspection-error") {
        throw inspected.error;
      }
      bindings.containThenable(inspected);
      throw invalidSynchronousValue();
    }
    return validateValue(candidate);
  });
  const stageSet = (draft, scope, row, value, session) => {
    const collection = collectionForRow(row);
    const admitted = bindings.runGuarded(session, () => validateValue(value));
    const coordinate = coordinateFor(draft, scope, row, collection);
    installEvent(draft, coordinate, "set", Object.freeze({ kind: "present", value: admitted }), presentLocal(admitted), presentOutcome(admitted));
  };
  const stageUpdate = (draft, scope, row, update, session) => {
    const collection = collectionForRow(row);
    if (typeof update !== "function") {
      throw new TypeError("Collection row update requires an updater");
    }
    const coordinate = coordinateFor(draft, scope, row, collection);
    const current = draftOutcome(laneFor(draft), scope, row, collection);
    if (current.kind === "absent")
      throw new MissingCollectionRowError;
    const admitted = runUpdater(update, current.value, session);
    installEvent(draft, coordinate, "update", Object.freeze({ kind: "present", value: admitted }), presentLocal(admitted), presentOutcome(admitted));
  };
  const stageDelete = (draft, scope, row) => {
    const coordinate = coordinateFor(draft, scope, row);
    installEvent(draft, coordinate, "delete", Object.freeze({ kind: "absent" }), ABSENT_LOCAL, ABSENT);
  };
  const stageReset = (draft, scope, row) => {
    const coordinate = coordinateFor(draft, scope, row);
    const inherited = readBaselineOverride === undefined ? draftOutcome(laneFor(draft), scope.parent, row, coordinate.collection) : coordinate.baseline.inherited;
    installEvent(draft, coordinate, "reset", Object.freeze({ kind: "reset" }), NONE, inherited);
  };
  const resetAllRows = (draft, scope) => {
    const start = draft.generation;
    const candidates = [];
    const committed = scopeSidecars.get(scope)?.ownedRows;
    if (committed !== undefined)
      for (const row of committed)
        candidates.push(row);
    const staged = lanes.get(draft)?.byScope.get(scope);
    if (staged !== undefined) {
      const planned = [];
      for (const coordinate of staged.values()) {
        if (coordinate.planIndex !== undefined)
          planned.push(coordinate);
      }
      planned.sort((a, b) => a.planIndex - b.planIndex);
      for (const coordinate of planned)
        candidates.push(coordinate.row);
    }
    const visited = new Set;
    const owned = [];
    for (const row of candidates) {
      if (visited.has(row))
        continue;
      visited.add(row);
      const coordinate = staged?.get(row);
      if (coordinate !== undefined) {
        if (currentLocal(coordinate).kind === "none")
          continue;
      } else if (committed?.has(row) !== true)
        continue;
      owned.push(row);
    }
    if (owned.length > 1 && !scope.children.isEmpty()) {
      const pending2 = new Set(owned);
      const ordered = [];
      for (const collection of new Set(owned.map(collectionForRow)))
        for (const row of readDraftCollection(draft, scope.parent, collection))
          if (pending2.delete(row))
            ordered.push(row);
      for (const row of owned)
        if (pending2.has(row))
          ordered.push(row);
      owned.length = 0;
      owned.push(...ordered);
    }
    for (const row of owned)
      stageReset(draft, scope, row);
    const collections = new Set;
    for (const row of visited)
      collections.add(collectionForRow(row));
    scopeSidecars.get(scope)?.liveMemberships?.forEach((record) => {
      if (record.localHistory)
        collections.add(record.atom);
    });
    const lane = laneFor(draft);
    for (let ancestor = scope.parent;ancestor !== undefined; ancestor = ancestor.parent)
      for (const collection of lane.rebased?.get(ancestor)?.collections ?? [])
        collections.add(collection);
    const previous = lane.cleared?.get(scope);
    if (previous !== undefined)
      for (const collection of previous.collections)
        collections.add(collection);
    const marker = {
      start,
      end: draft.generation,
      collections
    };
    (lane.cleared ??= new Map).set(scope, marker);
    if (collections.size === 0)
      return;
    (lane.rebased ??= new Map).set(scope, marker);
    for (const [descendant, cleared] of lane.cleared) {
      if (descendant === scope || !isDescendantOf(descendant, scope))
        continue;
      for (const collection of collections)
        cleared.collections.add(collection);
      lane.rebased.set(descendant, cleared);
    }
    for (const collection of collections)
      invalidateCollectionReads(lane, collection);
    draft.markRow(draft.generation);
  };
  const mirrorsParent = (lane, scope, collection, scopeBefore, parentBefore, parentAfter) => {
    if (lane.historyByCollectionScope.get(collection)?.get(scope)?.length)
      return false;
    if (scopeBefore.length !== parentBefore.length)
      return false;
    for (let index = 0;index < scopeBefore.length; index++)
      if (scopeBefore[index] !== parentBefore[index])
        return false;
    let present;
    for (const row of scopeSidecars.get(scope)?.ownedRows ?? []) {
      if (bindings.lookupRow(row) !== collection)
        continue;
      present ??= new Set(parentAfter());
      if (committedLocal(scope, row).kind === "present" !== present.has(row))
        return false;
    }
    return true;
  };
  const rebaseFor = (lane, scope, collection) => {
    const marker = lane.rebased?.get(scope);
    return marker?.collections.has(collection) ? marker : undefined;
  };
  const hasRestoredAncestor = (lane, scope, collection) => {
    for (let ancestor = scope.parent;ancestor !== undefined; ancestor = ancestor.parent)
      if (rebaseFor(lane, ancestor, collection) !== undefined)
        return true;
    return false;
  };
  const followsRebase = (draft, lane, scope, collection) => {
    if (rebaseFor(lane, scope, collection) !== undefined)
      return false;
    const parent = scope.parent;
    if (parent === undefined)
      return false;
    if (rebaseFor(lane, parent, collection) === undefined && !followsRebase(draft, lane, parent, collection))
      return false;
    return mirrorsParent(lane, scope, collection, membershipRows(materializeMembership(scope, collection)), membershipRows(materializeMembership(parent, collection)), () => readDraftCollection(draft, parent, collection));
  };
  const replayRouteBirth = (lane, scope, row, collection, chainTop) => {
    const route = [];
    const restored = new Set;
    const local = new Map;
    let current = scope;
    let inChain = chainTop !== undefined;
    while (current !== undefined) {
      if (current === chainTop)
        inChain = false;
      route.push(current);
      if (inChain && rebaseFor(lane, current, collection) !== undefined)
        restored.add(current);
      local.set(current, restored.has(current) ? "none" : freezeBaseline(readBaseline(current, row, collection)).local.kind);
      current = current.parent;
    }
    const events = [];
    const rowLane = lane.byRow.get(row);
    if (rowLane !== undefined) {
      for (const routeScope of route) {
        const marker = restored.has(routeScope) ? rebaseFor(lane, routeScope, collection) : undefined;
        for (const event of rowLane.historyByScope.get(routeScope) ?? [])
          if (marker === undefined || event.sequence >= marker.start)
            events.push(event);
      }
      events.sort((first, second) => first.sequence - second.sequence);
    }
    const isPresent = () => {
      for (const routeScope of route) {
        const kind = local.get(routeScope);
        if (kind === "present")
          return true;
        if (kind === "absent")
          return false;
      }
      return false;
    };
    let present = isPresent();
    let birth = present ? BASELINE_BIRTH : undefined;
    for (const event of events) {
      local.set(event.scope, event.kind === "present" ? "present" : event.kind === "absent" ? "absent" : "none");
      const nextPresent = isPresent();
      if (!present && nextPresent)
        birth = event.sequence;
      else if (!nextPresent)
        birth = undefined;
      present = nextPresent;
    }
    return birth;
  };
  const rebasedRows = (lane, scope, collection, base, chainTop) => {
    const history = lane.historyByCollectionScope.get(collection);
    const births = new Map;
    let routeScope = scope;
    while (routeScope !== undefined) {
      for (const event of history?.get(routeScope) ?? [])
        if (!births.has(event.row))
          births.set(event.row, replayRouteBirth(lane, scope, event.row, collection, chainTop));
      routeScope = routeScope.parent;
    }
    const next = [];
    for (const row of base) {
      if (!births.has(row) || births.get(row) === BASELINE_BIRTH)
        next.push(row);
    }
    const born = [];
    for (const [row, birth] of births)
      if (typeof birth === "number")
        born.push({ row, birth });
    born.sort((first, second) => first.birth - second.birth);
    for (const { row } of born)
      next.push(row);
    return next;
  };
  const restoreChainTop = (draft, lane, scope, collection) => {
    let top = scope.parent;
    while (rebaseFor(lane, top, collection) !== undefined || followsRebase(draft, lane, top, collection))
      top = top.parent;
    return top;
  };
  const readDraftRow = (draft, scope, row) => {
    const coordinate = coordinateFor(draft, scope, row);
    const outcome = draftOutcome(laneFor(draft), scope, row, coordinate.collection);
    return outcome.kind === "present" ? outcome.value : undefined;
  };
  const readDraftCollection = (draft, scope, collection) => {
    if (!bindings.lookupCollection(collection)) {
      throw new TypeError("Collection draft read requires a valid collection");
    }
    const lane = laneFor(draft);
    const revision = lane.revisionByCollection.get(collection) ?? 0;
    let byCollection = lane.membershipMemo.get(scope);
    const current = byCollection?.get(collection);
    if (current?.revision === revision)
      return current.rows;
    if (lane.rebased !== undefined && (rebaseFor(lane, scope, collection) !== undefined || followsRebase(draft, lane, scope, collection))) {
      let next;
      if (rebaseFor(lane, scope, collection) !== undefined) {
        const top = restoreChainTop(draft, lane, scope, collection);
        next = rebasedRows(lane, scope, collection, membershipRows(materializeMembership(top, collection)), top);
      } else
        next = readDraftCollection(draft, scope.parent, collection);
      const committedRows = membershipRows(materializeMembership(scope, collection));
      const rows2 = sameRowsWhileProducingSnapshot(scope, committedRows, next) ? committedRows : current !== undefined && sameRowsWhileProducingSnapshot(scope, current.rows, next) ? current.rows : Object.freeze([...next]);
      if (byCollection === undefined) {
        byCollection = new Map;
        lane.membershipMemo.set(scope, byCollection);
      }
      byCollection.set(collection, { revision, rows: rows2 });
      return rows2;
    }
    const baseline = readBaselineOverride === undefined && typeof scope.createOutcomeToken === "function" ? membershipRows(materializeMembership(scope, collection)) : EMPTY_ROWS;
    const candidates = new Map;
    const history = lane.historyByCollectionScope.get(collection);
    let routeScope = scope;
    while (routeScope !== undefined) {
      for (const event of history?.get(routeScope) ?? []) {
        if (!candidates.has(event.row)) {
          candidates.set(event.row, coordinateFor(draft, scope, event.row, collection));
        }
      }
      routeScope = routeScope.parent;
    }
    const rows = [];
    if (baseline.length) {
      recordCounter(scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, baseline.length);
    }
    for (const row of baseline) {
      const coordinate = candidates.get(row);
      if (coordinate === undefined || coordinate.enablingBirth === BASELINE_BIRTH) {
        rows.push(row);
      }
    }
    const births = [];
    if (candidates.size !== 0) {
      recordCounter(scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, candidates.size);
    }
    for (const coordinate of candidates.values()) {
      if (typeof coordinate.enablingBirth === "number" && draftOutcome(lane, coordinate.scope, coordinate.row, coordinate.collection).kind === "present") {
        births.push(coordinate);
      }
    }
    births.sort((first, second) => {
      const firstBirth = first.enablingBirth;
      const secondBirth = second.enablingBirth;
      if (firstBirth === secondBirth) {
        return first.discoveryIndex - second.discoveryIndex;
      }
      return firstBirth - secondBirth;
    });
    for (const coordinate of births)
      rows.push(coordinate.row);
    let snapshot;
    if (sameRowsWhileProducingSnapshot(scope, baseline, rows)) {
      snapshot = baseline;
    } else if (current !== undefined && sameRowsWhileProducingSnapshot(scope, current.rows, rows)) {
      snapshot = current.rows;
    } else {
      snapshot = Object.freeze(rows);
      recordCounter(scope, COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS);
    }
    if (byCollection === undefined) {
      byCollection = new Map;
      lane.membershipMemo.set(scope, byCollection);
    }
    byCollection.set(collection, Object.freeze({ revision, rows: snapshot }));
    return snapshot;
  };
  const inspectDraft = (draft) => {
    const lane = lanes.get(draft);
    if (lane === undefined)
      return;
    let membershipMemoCount = 0;
    for (const byCollection of lane.membershipMemo.values()) {
      membershipMemoCount += byCollection.size;
    }
    const revisionSnapshot = new WeakMap;
    for (const [collection, revision] of lane.revisionByCollection) {
      revisionSnapshot.set(collection, Object.freeze({ value: revision }));
    }
    const inspectCoordinate = (coordinate) => Object.freeze({
      id: coordinate.discoveryIndex,
      baselineLocal: coordinate.baseline.local.kind,
      baselineEffective: coordinate.baseline.effective.kind,
      baselineInherited: coordinate.baseline.inherited.kind,
      final: coordinate.final?.kind,
      enablingBirth: coordinate.enablingBirth === BASELINE_BIRTH ? "baseline" : coordinate.enablingBirth
    });
    return Object.freeze({
      discoveryOrder: Object.freeze([...lane.byScope.values()].flatMap((coordinates) => [...coordinates.values()]).sort((first, second) => first.discoveryIndex - second.discoveryIndex).map(inspectCoordinate)),
      planOrder: Object.freeze(lane.planOrder.map(inspectCoordinate)),
      history: Object.freeze(lane.history.map((event) => Object.freeze({
        coordinateId: event.coordinateId,
        kind: event.kind,
        sequence: event.sequence
      }))),
      membershipMemoCount,
      revision: (collection) => revisionSnapshot.get(collection)?.value ?? 0
    });
  };
  const planCommit = (draftValue) => {
    const draft = draftValue;
    if (!draft.hasRows)
      return;
    const lane = lanes.get(draft);
    if (lane === undefined) {
      throw new Error("Collection row draft lane is missing");
    }
    let orderedNodes;
    const rows = [];
    const rowSettlements = [];
    const membershipInstalls = [];
    const membershipSettlements = [];
    let historyMarks;
    const considered = new WeakSet;
    const nodesByRecord = new WeakMap;
    const nodesByScope = new Map;
    const collectionSlots = [];
    const slotsByCollection = new Map;
    const noMembershipTransitions = Object.freeze([]);
    const absentMembershipTimeline = {
      baselinePresent: false,
      transitions: noMembershipTransitions,
      birth: undefined
    };
    const presentMembershipTimeline = {
      baselinePresent: true,
      transitions: noMembershipTransitions,
      birth: BASELINE_BIRTH
    };
    const placementsByNode = new Map;
    const baselineRowsByNode = new Map;
    const rememberNode = (node) => {
      let byCollection = nodesByScope.get(node.scope);
      if (byCollection === undefined) {
        byCollection = new Map;
        nodesByScope.set(node.scope, byCollection);
      }
      byCollection.set(node.atom, node);
      if (node.existing !== undefined) {
        nodesByRecord.set(node.existing, node);
      }
    };
    const nodeForRecord = (target) => {
      const current = nodesByRecord.get(target);
      if (current !== undefined)
        return current;
      const unresolved = [];
      let record = target;
      let parent;
      while (record !== undefined) {
        recordCounter(record.scope, COLLECTION_MEMBERSHIP_ROUTE_VISITS);
        const known = nodesByRecord.get(record);
        if (known !== undefined) {
          parent = known;
          break;
        }
        unresolved.push(record);
        record = record.inheritedFrom;
      }
      for (let index = unresolved.length - 1;index >= 0; index--) {
        const existing = unresolved[index];
        const node = {
          scope: existing.scope,
          atom: existing.atom,
          existing,
          parent,
          beforeRows: existing.ordered === undefined ? membershipRows(existing) : EMPTY_ROWS,
          plannedChildren: [],
          finalRows: undefined,
          membershipChangedFromBefore: undefined,
          installed: undefined,
          affected: false,
          containsAffected: false
        };
        if (existing.ordered !== undefined) {
          let snapshot;
          Object.defineProperty(node, "beforeRows", {
            get: () => snapshot ??= membershipRows(existing)
          });
        }
        rememberNode(node);
        parent = node;
      }
      return parent;
    };
    const ensureMembershipPath = (scope, collection) => {
      const known = nodesByScope.get(scope)?.get(collection);
      if (known !== undefined)
        return known;
      const unresolved = [];
      let currentScope = scope;
      let parent;
      while (currentScope !== undefined) {
        const planned = nodesByScope.get(currentScope)?.get(collection);
        if (planned !== undefined) {
          recordCounter(currentScope, COLLECTION_MEMBERSHIP_ROUTE_VISITS);
          parent = planned;
          break;
        }
        const existing = scopeSidecars.get(currentScope)?.memberships?.get(collection);
        if (existing !== undefined) {
          parent = nodeForRecord(existing);
          break;
        }
        recordCounter(currentScope, COLLECTION_MEMBERSHIP_ROUTE_VISITS);
        unresolved.push(currentScope);
        currentScope = currentScope.parent;
      }
      for (let index = unresolved.length - 1;index >= 0; index--) {
        const node = {
          scope: unresolved[index],
          atom: collection,
          existing: undefined,
          parent,
          beforeRows: parent?.beforeRows ?? EMPTY_ROWS,
          plannedChildren: [],
          finalRows: undefined,
          membershipChangedFromBefore: undefined,
          installed: undefined,
          affected: false,
          containsAffected: false
        };
        parent?.plannedChildren.push(node);
        membershipInstalls.push(node);
        rememberNode(node);
        parent = node;
      }
      return parent;
    };
    const collectionSlot = (collection) => {
      let slot = slotsByCollection.get(collection);
      if (slot !== undefined)
        return slot;
      slot = { collection, top: undefined };
      slotsByCollection.set(collection, slot);
      collectionSlots.push(slot);
      return slot;
    };
    const markAffected2 = (slot, node) => {
      node.affected = true;
      const previousTop = slot.top;
      if (previousTop === undefined)
        slot.top = node;
      let firstPreviouslyMarked;
      let current = node;
      while (current !== undefined) {
        if (current.containsAffected) {
          firstPreviouslyMarked ??= current;
          if (Object.is(current, previousTop))
            return;
        } else {
          current.containsAffected = true;
        }
        current = current.parent;
      }
      if (previousTop !== undefined) {
        slot.top = firstPreviouslyMarked;
      }
    };
    const baselineContains = (node, row) => {
      if (node.existing?.ordered !== undefined)
        return node.existing.ordered.entries.has(row);
      let rows2 = baselineRowsByNode.get(node);
      if (rows2 === undefined) {
        if (node.beforeRows.length) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, node.beforeRows.length);
        }
        rows2 = new Set(node.beforeRows);
        baselineRowsByNode.set(node, rows2);
      }
      return rows2.has(row);
    };
    const mergeMembershipTimeline = (node, row, parent, events) => {
      if (membershipPlacementTraceForTest !== undefined) {
        membershipPlacementTraceForTest.states++;
      }
      let local = committedLocal(node.scope, row).kind;
      if (events === undefined) {
        return local === "none" ? parent : local === "present" ? presentMembershipTimeline : absentMembershipTimeline;
      }
      let parentPresent = parent.baselinePresent;
      let present = local === "present" || local === "none" && parentPresent;
      const baselinePresent = present;
      let birth = present ? BASELINE_BIRTH : undefined;
      const transitions = [];
      let parentIndex = 0;
      let eventIndex = 0;
      while (parentIndex < parent.transitions.length || eventIndex < events.length) {
        const parentTransition = parent.transitions[parentIndex];
        const event = events[eventIndex];
        let sequence;
        if (parentTransition !== undefined && (event === undefined || parentTransition.sequence < event.sequence)) {
          parentPresent = parentTransition.present;
          sequence = parentTransition.sequence;
          parentIndex++;
        } else {
          local = event.kind === "present" ? "present" : event.kind === "absent" ? "absent" : "none";
          sequence = event.sequence;
          eventIndex++;
        }
        const nextPresent = local === "present" || local === "none" && parentPresent;
        if (nextPresent === present)
          continue;
        present = nextPresent;
        birth = present ? sequence : undefined;
        transitions.push({ sequence, present });
      }
      if (!transitions.length) {
        return present ? presentMembershipTimeline : absentMembershipTimeline;
      }
      return { baselinePresent, transitions, birth };
    };
    const placementsFor = (target) => {
      const known = placementsByNode.get(target);
      if (known !== undefined)
        return known;
      const unresolved = [];
      let current = target;
      while (current !== undefined && !placementsByNode.has(current)) {
        unresolved.push(current);
        current = current.parent;
      }
      let parentPlacements = current === undefined ? new Map : placementsByNode.get(current);
      for (let index = unresolved.length - 1;index >= 0; index--) {
        const node = unresolved[index];
        const eventsByRow = new Map;
        for (const event of lane.historyByCollectionScope.get(node.atom)?.get(node.scope) ?? []) {
          let events = eventsByRow.get(event.row);
          if (events === undefined) {
            events = [];
            eventsByRow.set(event.row, events);
          }
          events.push(event);
        }
        const placements = new Map;
        if (parentPlacements.size !== 0) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, parentPlacements.size);
        }
        for (const [row, parentTimeline] of parentPlacements) {
          placements.set(row, mergeMembershipTimeline(node, row, parentTimeline, eventsByRow.get(row)));
          eventsByRow.delete(row);
        }
        for (const [row, events] of eventsByRow) {
          const parentTimeline = node.parent !== undefined && baselineContains(node.parent, row) ? presentMembershipTimeline : absentMembershipTimeline;
          placements.set(row, mergeMembershipTimeline(node, row, parentTimeline, events));
        }
        placementsByNode.set(node, placements);
        parentPlacements = placements;
      }
      return placementsByNode.get(target);
    };
    const isFollowerNode = (node) => node.follower ??= node.rebase === undefined && node.parent !== undefined && (node.parent.rebase !== undefined || isFollowerNode(node.parent)) && mirrorsParent(lane, node.scope, node.atom, node.beforeRows, node.parent.beforeRows, () => finalRowsFor(node.parent));
    const restoredRowsFor = (node) => {
      if (lane.rebased === undefined)
        return;
      let rows2;
      if (node.rebase !== undefined) {
        let base = node.parent;
        while (base.rebase !== undefined || isFollowerNode(base))
          base = base.parent;
        rows2 = rebasedRows(lane, node.scope, node.atom, base.beforeRows, base.scope);
      } else if (isFollowerNode(node)) {
        rows2 = finalRowsFor(node.parent);
      } else
        return;
      const before = node.beforeRows;
      const changed = !sameRowsWhileProducingSnapshot(node.scope, before, rows2);
      node.membershipChangedFromBefore = changed;
      node.finalRows = node.existing !== undefined && !changed ? before : Object.freeze([...rows2]);
      if (changed && node.existing !== undefined && extensionRecorder(node.scope) !== undefined)
        node.membershipChanges = restoredMembershipChanges(before, node.finalRows);
      if (node.existing?.ordered !== undefined && changed) {
        node.orderedRebuild = node.finalRows;
        (orderedNodes ??= []).push(node);
      }
      return node.finalRows;
    };
    const finalRowsFor = (node) => {
      if (node.finalRows !== undefined)
        return node.finalRows;
      const restored = restoredRowsFor(node);
      if (restored !== undefined)
        return restored;
      if (node.existing?.ordered !== undefined) {
        const placements = placementsFor(node);
        const removals = [];
        const births2 = [];
        for (const [row, placement] of placements) {
          if (placement.baselinePresent && placement.birth !== BASELINE_BIRTH)
            removals.push(row);
          if (typeof placement.birth === "number")
            births2.push({ row, birth: placement.birth });
        }
        births2.sort((a, b) => a.birth - b.birth);
        const born = births2.map((item) => item.row);
        node.membershipChangedFromBefore = node.existing.ordered.changes(removals, born);
        node.orderedPatch = { removals, births: born };
        (orderedNodes ??= []).push(node);
        node.membershipChanges = placements;
        return EMPTY_ROWS;
      }
      if (node.existing !== undefined) {
        membershipRebuildTraceForTest?.push(node.existing);
      }
      const next = [];
      const births = [];
      const captureMembershipChanges = node.existing !== undefined && extensionRecorder(node.scope) !== undefined;
      let classifiedPlacements;
      if (readBaselineOverride === undefined) {
        const placements = placementsFor(node);
        if (captureMembershipChanges) {
          classifiedPlacements = placements;
        }
        if (node.beforeRows.length) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, node.beforeRows.length);
        }
        for (const row of node.beforeRows) {
          const placement = placements.get(row);
          if (placement === undefined || placement.birth === BASELINE_BIRTH) {
            next.push(row);
          }
        }
        if (placements.size !== 0) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, placements.size);
        }
        for (const [row, placement] of placements) {
          if (classifiedPlacements !== undefined && (placement.baselinePresent && placement.birth === undefined || !placement.baselinePresent && typeof placement.birth === "number")) {
            node.membershipChanges = classifiedPlacements;
          }
          if (typeof placement.birth === "number") {
            births.push({ row, birth: placement.birth });
          }
        }
      } else {
        const candidates = new Map;
        const history = lane.historyByCollectionScope.get(node.atom);
        let currentScope = node.scope;
        while (currentScope !== undefined) {
          for (const event of history?.get(currentScope) ?? []) {
            if (!candidates.has(event.row)) {
              candidates.set(event.row, coordinateFor(draft, node.scope, event.row, node.atom));
            }
          }
          currentScope = currentScope.parent;
        }
        if (node.beforeRows.length) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, node.beforeRows.length);
        }
        for (const row of node.beforeRows) {
          const coordinate = candidates.get(row);
          if (coordinate === undefined || coordinate.enablingBirth === BASELINE_BIRTH) {
            next.push(row);
          }
        }
        if (candidates.size !== 0) {
          recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROWS_SCANNED, candidates.size);
        }
        for (const coordinate of candidates.values()) {
          if (typeof coordinate.enablingBirth === "number" && draftOutcome(lane, coordinate.scope, coordinate.row, coordinate.collection).kind === "present") {
            births.push({
              row: coordinate.row,
              birth: coordinate.enablingBirth
            });
          }
        }
      }
      births.sort((first, second) => {
        return first.birth - second.birth;
      });
      for (const birth of births)
        next.push(birth.row);
      const membershipChangedFromBefore = !sameRowsWhileProducingSnapshot(node.scope, node.beforeRows, next);
      node.membershipChangedFromBefore = membershipChangedFromBefore;
      if (node.existing !== undefined && !membershipChangedFromBefore) {
        node.finalRows = node.beforeRows;
      } else {
        node.finalRows = Object.freeze(next);
        recordCounter(node.scope, COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS);
      }
      return node.finalRows;
    };
    for (const coordinate of lane.planOrder) {
      const final = coordinate.final;
      if (final === undefined)
        continue;
      recordCounter(coordinate.scope, COLLECTION_ROW_FINAL_RESOLUTION_VISITS);
      const local = final.kind === "present" ? presentLocal(final.value) : final.kind === "absent" && coordinate.scope.parent !== undefined ? ABSENT_LOCAL : NONE;
      const ownershipChanged = !sameLocal(committedLocal(coordinate.scope, coordinate.row), local);
      rows.push(Object.freeze({ coordinate, local, ownershipChanged }));
      const slot = collectionSlot(coordinate.collection);
      const baseline = freezeBaseline(readBaseline(coordinate.scope, coordinate.row, coordinate.collection));
      const localKindChanged = baseline.local.kind !== local.kind;
      if (localKindChanged) {
        ensureMembershipPath(coordinate.scope, coordinate.collection);
        if (coordinate.scope.parent !== undefined) {
          (historyMarks ??= []).push({
            scope: coordinate.scope,
            collection: coordinate.collection,
            history: true
          });
        }
      }
      const baselinePlacement = baseline.effective.kind === "present" ? BASELINE_BIRTH : undefined;
      if (!Object.is(baselinePlacement, coordinate.enablingBirth)) {
        markAffected2(slot, ensureMembershipPath(coordinate.scope, coordinate.collection));
        if (!localKindChanged && coordinate.scope.parent !== undefined)
          (historyMarks ??= []).push({
            scope: coordinate.scope,
            collection: coordinate.collection,
            history: true
          });
      }
      const materialized = scopeSidecars.get(coordinate.scope)?.rowViews?.get(coordinate.row);
      if (materialized === undefined)
        continue;
      const pending2 = [materialized];
      while (pending2.length) {
        const record = pending2.pop();
        if (considered.has(record))
          continue;
        considered.add(record);
        recordCounter(record.scope, COLLECTION_ROW_ROUTE_VISITS);
        const before = record.served.outcome.kind === "value" && record.served.outcome.value !== undefined ? presentOutcome(record.served.outcome.value) : ABSENT;
        const after = draftOutcome(lane, record.scope, record.atom, coordinate.collection);
        if (sameOutcome2(before, after))
          continue;
        rowSettlements.push(Object.freeze({
          scope: record.scope,
          atom: record.atom,
          record,
          before,
          outcome: after
        }));
        const children = [];
        record.inheritingChildren.forEach((child) => {
          record.scope.coordinator.recordCounter(1 /* routeVisits */);
          children.push(child);
        });
        for (let index = children.length - 1;index >= 0; index--) {
          pending2.push(children[index]);
        }
      }
    }
    if (lane.rebased !== undefined)
      for (const [scope, marker] of lane.rebased) {
        const scopeHistory = lane.historyByCollectionScope;
        for (const collection of marker.collections) {
          const node = ensureMembershipPath(scope, collection);
          node.rebase = marker;
          markAffected2(collectionSlot(collection), node);
          (historyMarks ??= []).push({
            scope,
            collection,
            history: (scopeHistory.get(collection)?.get(scope) ?? []).some((event) => event.sequence >= marker.end)
          });
        }
      }
    if (lane.rebased !== undefined)
      for (const [collection, byScope] of lane.historyByCollectionScope) {
        if (!restoringCollection(lane, collection))
          continue;
        for (const [scope, events] of byScope) {
          if (events.length === 0 || rebaseFor(lane, scope, collection) !== undefined || !hasRestoredAncestor(lane, scope, collection))
            continue;
          markAffected2(collectionSlot(collection), ensureMembershipPath(scope, collection));
          (historyMarks ??= []).push({
            scope,
            collection,
            history: true
          });
        }
      }
    for (const slot of collectionSlots) {
      const top = slot.top;
      if (top === undefined)
        continue;
      const visited = new Set;
      const pending2 = [{ node: top, affected: false }];
      while (pending2.length) {
        const entry = pending2.pop();
        const node = entry.node;
        if (visited.has(node))
          continue;
        visited.add(node);
        recordCounter(node.scope, COLLECTION_MEMBERSHIP_ROUTE_VISITS);
        const affected = entry.affected || node.affected;
        if (affected) {
          const finalRows = finalRowsFor(node);
          if (node.existing !== undefined && (node.orderedPatch !== undefined ? node.membershipChangedFromBefore : !Object.is(finalRows, node.beforeRows))) {
            membershipSettlements.push(Object.freeze({
              scope: node.scope,
              atom: node.atom,
              node,
              record: node.existing,
              rows: finalRows
            }));
          }
        }
        const children = [];
        node.existing?.inheritingChildren.forEach((child) => {
          node.scope.coordinator.recordCounter(1 /* routeVisits */);
          const childNode = affected ? nodeForRecord(child) : nodesByRecord.get(child);
          if (childNode !== undefined && (affected || childNode.containsAffected)) {
            children.push(childNode);
          }
        });
        for (const child of node.plannedChildren) {
          if (affected || child.containsAffected)
            children.push(child);
        }
        for (let index = children.length - 1;index >= 0; index--) {
          pending2.push({
            node: children[index],
            affected
          });
        }
      }
    }
    for (const node of membershipInstalls) {
      if (node.finalRows !== undefined)
        continue;
      if (node.parent === undefined) {
        finalRowsFor(node);
        continue;
      }
      node.finalRows = node.beforeRows;
      node.membershipChangedFromBefore = false;
    }
    let indexPlan;
    const rebuilt = lane.rebased === undefined ? undefined : orderedNodes?.filter((node) => node.orderedRebuild !== undefined);
    if (indexes !== undefined && (lane.planOrder.some((coordinate) => indexes.active(coordinate.collection)) || rebuilt?.some((node) => indexes.active(node.atom)))) {
      const changed = new Map;
      for (const coordinate of lane.planOrder) {
        if (!indexes.active(coordinate.collection))
          continue;
        const root = scopeSidecars.get(coordinate.scope)?.memberships?.get(coordinate.collection);
        if (root === undefined)
          continue;
        const pending2 = [root];
        while (pending2.length) {
          const record = pending2.pop();
          if (record.ordered === undefined)
            continue;
          recordCounter(record.scope, COLLECTION_INDEX_ROUTE_VISITS);
          let rows2 = changed.get(record);
          if (rows2 === undefined)
            changed.set(record, rows2 = new Set);
          rows2.add(coordinate.row);
          record.indexedChildren?.forEach((child) => pending2.push(child));
        }
      }
      const deltas = [];
      for (const node of rebuilt ?? []) {
        const record = node.existing;
        const ordered = record.ordered;
        const ranks = new Map;
        node.orderedRebuild.forEach((row, index) => ranks.set(row, ordered.nextRank + index));
        const changes = [];
        for (const row of new Set([
          ...ordered.entries.keys(),
          ...node.orderedRebuild
        ])) {
          const before = committedOutcome(record.scope, row);
          const after = draftOutcome(lane, record.scope, row, record.atom);
          changes.push({
            row,
            before: before.kind === "present" ? before.value : undefined,
            after: after.kind === "present" ? after.value : undefined,
            rank: ranks.get(row)
          });
        }
        if (changes.length)
          deltas.push({
            scope: record.scope,
            collection: record.atom,
            changes
          });
      }
      for (const [record, rows2] of changed) {
        if (record.ordered === undefined)
          continue;
        if (nodesByRecord.get(record)?.orderedRebuild !== undefined)
          continue;
        const node = nodeForRecord(record);
        const restored = lane.rebased !== undefined && (node.rebase !== undefined || isFollowerNode(node));
        const placements = restored ? undefined : placementsFor(node);
        const changes = [];
        for (const row of rows2) {
          const before = committedOutcome(record.scope, row);
          const after = draftOutcome(lane, record.scope, row, record.atom);
          const birth = placements?.get(row)?.birth;
          if (sameOutcome2(before, after) && typeof birth !== "number")
            continue;
          changes.push({
            row,
            before: before.kind === "present" ? before.value : undefined,
            after: after.kind === "present" ? after.value : undefined,
            rank: after.kind === "absent" ? undefined : typeof birth === "number" ? record.ordered.nextRank + birth : record.ordered.entries.get(row)?.rank
          });
        }
        if (changes.length)
          deltas.push({
            scope: record.scope,
            collection: record.atom,
            changes
          });
      }
      indexPlan = indexes.prepare(deltas);
    }
    const plan = {
      commit: commitPlan,
      indexPlan,
      orderedNodes,
      historyMarks,
      rows: Object.freeze(rows),
      rowSettlements: Object.freeze(rowSettlements),
      membershipInstalls: Object.freeze(membershipInstalls),
      membershipSettlements: Object.freeze(membershipSettlements),
      sources: Object.freeze([
        ...rowSettlements,
        ...membershipSettlements
      ])
    };
    return plan;
  };
  const applyCommit = (planValue) => {
    const plan = planValue;
    let ownershipChanged = false;
    for (const settlement of plan.rowSettlements) {
      const { record, before, outcome: after } = settlement;
      recordCounter(record.scope, COLLECTION_EFFECTIVE_DELTAS_PREPARED);
      recordDetail(record.scope, before.kind === "absent" ? COLLECTION_EFFECTIVE_INSERT : after.kind === "absent" ? COLLECTION_EFFECTIVE_REMOVE : COLLECTION_EFFECTIVE_UPDATE, record.atom, bindings.lookupRow(record.atom));
    }
    for (const settlement of plan.membershipSettlements) {
      for (const [row, placement] of settlement.node.membershipChanges ?? []) {
        const code = placement.baselinePresent && placement.birth === undefined ? COLLECTION_MEMBERSHIP_REMOVE : !placement.baselinePresent && typeof placement.birth === "number" ? COLLECTION_MEMBERSHIP_INSERT : undefined;
        if (code !== undefined) {
          recordDetail(settlement.node.scope, code, row, settlement.node.atom);
        }
      }
    }
    for (const rowPlan of plan.rows) {
      const operation = rowPlan.coordinate.finalOperation;
      if (operation !== undefined) {
        recordDetail(rowPlan.coordinate.scope, operation === "set" ? COLLECTION_INTENT_SET : operation === "update" ? COLLECTION_INTENT_UPDATE : operation === "reset" ? COLLECTION_INTENT_RESET : COLLECTION_INTENT_DELETE, rowPlan.coordinate.row, rowPlan.coordinate.collection);
      }
      if (!rowPlan.ownershipChanged)
        continue;
      ownershipChanged = true;
      const { row, scope } = rowPlan.coordinate;
      if (rowPlan.local.kind === "none") {
        const sidecar2 = scopeSidecars.get(scope);
        sidecar2?.rowLocals?.delete(row);
        if (sidecar2?.ownedRows?.delete(row)) {
          recordCounter(scope, COLLECTION_OWNER_RELEASES);
        }
        if (sidecar2?.ownedRows?.size === 0) {
          sidecar2.ownedRows = undefined;
          sidecar2.rowLocals = undefined;
          if (sidecar2.liveRowViews === undefined && sidecar2.liveMemberships === undefined) {
            scopeSidecars.delete(scope);
          }
        }
        continue;
      }
      const sidecar = sidecarFor(scope);
      let rowLocals = sidecar.rowLocals;
      if (rowLocals === undefined) {
        rowLocals = new WeakMap;
        sidecar.rowLocals = rowLocals;
      }
      let ownedRows = sidecar.ownedRows;
      if (ownedRows === undefined) {
        ownedRows = new Set;
        sidecar.ownedRows = ownedRows;
        recordCounter(scope, COLLECTION_OWNER_RETENTION_SETS_CREATED);
      }
      rowLocals.set(row, rowPlan.local);
      if (!ownedRows.has(row)) {
        ownedRows.add(row);
        recordCounter(scope, COLLECTION_OWNER_RETAINS);
      }
    }
    for (const node of plan.membershipInstalls) {
      node.installed = registerMembershipRecord(node.scope, node.atom, node.finalRows, node.parent !== undefined && node.finalRows === node.beforeRows);
    }
    for (const node of plan.orderedNodes ?? []) {
      const record = node.existing;
      if (node.orderedRebuild !== undefined) {
        const ordered = record.ordered;
        const nextRank = ordered.nextRank;
        ordered.entries.clear();
        ordered.tail = undefined;
        ordered.nextRank = nextRank;
        for (const row of node.orderedRebuild)
          ordered.append(row);
        record.snapshotDirty = true;
        record.served = servedMembership(record.scope, EMPTY_ROWS, record.served.token);
        continue;
      }
      const patch = node.orderedPatch;
      if (!node.membershipChangedFromBefore)
        continue;
      for (const row of patch.removals)
        record.ordered.remove(row);
      for (const row of patch.births)
        record.ordered.append(row);
      record.snapshotDirty = true;
      record.served = servedMembership(record.scope, EMPTY_ROWS, record.served.token);
    }
    if (plan.membershipSettlements.length)
      return true;
    for (const node of plan.membershipInstalls) {
      if (node.membershipChangedFromBefore)
        return true;
    }
    return ownershipChanged;
  };
  const rewireCommit = (planValue) => {
    const plan = planValue;
    for (const rowPlan of plan.rows) {
      if (!rowPlan.ownershipChanged)
        continue;
      const { row, scope } = rowPlan.coordinate;
      const record = scopeSidecars.get(scope)?.rowViews?.get(row);
      if (record === undefined)
        continue;
      if (rowPlan.local.kind !== "none" || scope.parent === undefined) {
        detachRowView(record);
      } else {
        attachRowView(record, materializeRowView(scope.parent, row));
      }
    }
    for (const node of plan.membershipInstalls) {
      const record = node.installed;
      const parent = node.parent?.existing ?? node.parent?.installed;
      if (record !== undefined && parent !== undefined) {
        attachMembership(record, parent);
      }
    }
    if (plan.historyMarks !== undefined)
      for (const { scope, collection, history } of plan.historyMarks) {
        const record = scopeSidecars.get(scope)?.memberships?.get(collection);
        if (record !== undefined)
          record.localHistory = history;
      }
  };
  const settleCommit = (planValue) => {
    const plan = planValue;
    for (const settlement of plan.rowSettlements) {
      const { record, outcome } = settlement;
      record.served = Object.freeze({
        token: record.scope.createOutcomeToken(),
        outcome: servedOutcome(outcome)
      });
      recordCounter(record.scope, COLLECTION_ROW_SOURCES_CHANGED);
      recordDetail(record.scope, COLLECTION_ROW_PUBLISHED, record.atom, bindings.lookupRow(record.atom));
      record.scope.coordinator.reachSubscriptionTarget(record.scope, record.atom);
    }
    for (const settlement of plan.membershipSettlements) {
      const { record, rows } = settlement;
      record.served = servedMembership(record.scope, record.ordered === undefined ? rows : record.served.outcome.kind === "value" ? record.served.outcome.value : EMPTY_ROWS);
      recordCounter(record.scope, COLLECTION_MEMBERSHIP_SOURCES_CHANGED);
      recordDetail(record.scope, COLLECTION_MEMBERSHIP_PUBLISHED, record.atom);
      record.scope.coordinator.reachSubscriptionTarget(record.scope, record.atom);
    }
    const indexSources = plan.indexPlan?.publish();
    if (indexSources?.length)
      return [...plan.sources, ...indexSources];
    return plan.sources.length ? plan.sources : undefined;
  };
  const commitPlan = function(phase) {
    if (phase === 0)
      return applyCommit(this);
    if (phase === 1)
      return rewireCommit(this);
    return settleCommit(this);
  };
  const disposeScope = (scopeValue) => {
    const scope = scopeValue;
    indexes?.dispose(scope);
    const sidecar = scopeSidecars.get(scope);
    if (sidecar === undefined)
      return;
    sidecar.liveRowViews?.forEach((record) => {
      detachRowView(record);
      record.inheritingChildren.clear();
    });
    sidecar.liveMemberships?.forEach((record) => {
      detachMembership(record);
      record.inheritingChildren.clear();
      record.indexedChildren?.clear();
      record.ordered?.entries.clear();
      record.ordered = undefined;
      record.snapshotDirty = false;
      record.served = servedMembership(record.scope, EMPTY_ROWS, record.served.token);
    });
    sidecar.liveRowViews?.clear();
    sidecar.liveMemberships?.clear();
    const ownedRowCount = sidecar.ownedRows?.size ?? 0;
    if (ownedRowCount !== 0) {
      recordCounter(scope, COLLECTION_OWNER_RELEASES, ownedRowCount);
    }
    sidecar.ownedRows?.clear();
    sidecar.rowLocals = undefined;
    sidecar.ownedRows = undefined;
    sidecar.rowViews = undefined;
    sidecar.liveRowViews = undefined;
    sidecar.memberships = undefined;
    sidecar.liveMemberships = undefined;
    scopeSidecars.delete(scope);
  };
  const kernel = Object.freeze({
    installIndexes: (create) => indexes ?? (indexes = create({
      revision: (draft, collection) => {
        const lane = laneFor(draft);
        const revisions = lane.queryRevisionByCollection ??= new Map;
        const revision = revisions.get(collection) ?? 0;
        revisions.set(collection, revision);
        return revision;
      },
      membership: indexedMembership,
      value: (scope, row) => {
        const outcome = committedOutcome(scope, row);
        return outcome.kind === "present" ? outcome.value : undefined;
      },
      draftRows: readDraftCollection,
      draftValue: (draft, scope, row) => {
        const lane = laneFor(draft);
        let current = scope;
        while (current !== undefined) {
          const coordinate = lane.byScope.get(current)?.get(row);
          const local = coordinate === undefined ? committedLocal(current, row) : currentLocal(coordinate);
          if (local.kind === "present")
            return local.value;
          if (local.kind === "absent")
            return;
          current = current.parent;
        }
        return;
      }
    })),
    has: (node) => indexes?.has(node) === true || bindings.lookupRow(node) !== undefined || bindings.lookupCollection(node),
    diagnosticName: bindings.lookupDiagnosticName,
    read: (draftValue, scopeValue, node) => {
      const draft = draftValue;
      const scope = scopeValue;
      if (indexes?.has(node))
        return {
          kind: "value",
          value: indexes.read(draft, scope, node)
        };
      if (bindings.lookupRow(node) !== undefined) {
        return Object.freeze({
          kind: "value",
          value: readDraftRow(draft, scope, node)
        });
      }
      if (bindings.lookupCollection(node)) {
        return Object.freeze({
          kind: "value",
          value: readDraftCollection(draft, scope, node)
        });
      }
      throw new TypeError("Unknown collection scratch source");
    },
    stage: (draftValue, scopeValue, operation, row, input, session) => {
      const draft = draftValue;
      const scope = scopeValue;
      if (operation === "set") {
        stageSet(draft, scope, row, input, session);
      } else if (operation === "update") {
        stageUpdate(draft, scope, row, input, session);
      } else if (operation === "delete") {
        stageDelete(draft, scope, row);
      } else {
        stageReset(draft, scope, row);
      }
    },
    scope: (scopeValue, node, session) => {
      if (node === undefined) {
        disposeScope(scopeValue);
        return;
      }
      if (indexes?.has(node))
        return indexes.scope(scopeValue, node, session);
      if (bindings.lookupRow(node) !== undefined) {
        return materializeRowView(scopeValue, node).served;
      }
      if (!bindings.lookupCollection(node))
        return;
      const record = materializeMembership(scopeValue, node);
      membershipRows(record);
      return record.served;
    },
    plan: planCommit,
    resetAll: (draftValue, scopeValue) => resetAllRows(draftValue, scopeValue),
    stageSet,
    stageUpdate,
    stageDelete,
    stageReset,
    readDraftRow,
    readDraftCollection,
    beginMembershipRebuildTraceForTest: () => {
      if (membershipRebuildTraceForTest !== undefined) {
        throw new Error("A membership rebuild trace is already active");
      }
      let trace = [];
      membershipRebuildTraceForTest = trace;
      return () => {
        if (trace === undefined) {
          throw new Error("The membership rebuild trace is already finished");
        }
        membershipRebuildTraceForTest = undefined;
        const result = Object.freeze([...trace]);
        trace.length = 0;
        trace = undefined;
        return result;
      };
    },
    beginMembershipPlacementTraceForTest: () => {
      if (membershipPlacementTraceForTest !== undefined) {
        throw new Error("A membership placement trace is already active");
      }
      let trace = {
        coordinates: 0,
        states: 0
      };
      membershipPlacementTraceForTest = trace;
      return () => {
        if (trace === undefined) {
          throw new Error("The membership placement trace is already finished");
        }
        membershipPlacementTraceForTest = undefined;
        const result = Object.freeze({ ...trace });
        trace = undefined;
        return result;
      };
    },
    inspectDraft
  });
  return kernel;
};

// packages/valdres/src/v1-internal/collection.ts
var referencePresenceNatively = (target) => new WeakRef(target);
var definitionRegistries;
var registryFor = (domain) => {
  const identity = getDefinitionDomainIdentity(domain);
  const registries = definitionRegistries ?? (definitionRegistries = new WeakMap);
  let registry = registries.get(identity);
  if (registry !== undefined)
    return registry;
  registry = {
    collections: new WeakMap,
    rows: new WeakMap
  };
  registries.set(identity, registry);
  return registry;
};
class InvalidCollectionKeyError extends Error {
  code = "VALDRES_INVALID_COLLECTION_KEY";
  constructor() {
    super("Collection keys must be strings, finite numbers, bigints, booleans, or null");
    this.name = "InvalidCollectionKeyError";
    Object.freeze(this);
  }
}
var invalidCollectionKey = () => new InvalidCollectionKeyError;
var canonicalizeCollectionKey = (value) => {
  if (value === null)
    return null;
  switch (typeof value) {
    case "string":
    case "bigint":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value))
        throw invalidCollectionKey();
      return Object.is(value, -0) ? 0 : value;
    default:
      throw invalidCollectionKey();
  }
};
var rejectThenableCollectionKey = (inspected) => {
  containThenable2(inspected);
  throw invalidCollectionKey();
};
var runCollectionEncoder = (domain, encodeKey, input) => runDefinitionCallback(domain, "collection-encoder", (callbackInput) => {
  let result;
  try {
    result = Reflect.apply(encodeKey, undefined, [callbackInput]);
  } catch (thrown) {
    const inspected2 = inspectThenable2(thrown);
    if (inspected2.kind === "not-thenable")
      throw thrown;
    if (inspected2.kind === "inspection-error") {
      throw inspected2.error;
    }
    return rejectThenableCollectionKey(inspected2);
  }
  const inspected = inspectThenable2(result);
  if (inspected.kind === "not-thenable")
    return result;
  if (inspected.kind === "inspection-error")
    throw inspected.error;
  return rejectThenableCollectionKey(inspected);
}, [input], canonicalizeCollectionKey, () => new TypeError("collection encodeKey cannot call family or collection accessors"));
var inspectCollectionOptions = (options) => {
  if (options === undefined)
    return {};
  if (typeof options !== "object" || options === null) {
    throw new TypeError("collection options must be an object");
  }
  for (const key of Reflect.ownKeys(options)) {
    if (key !== "encodeKey" && key !== "indexes" && key !== "name") {
      throw new TypeError("collection options contain an unknown option");
    }
  }
  let encodeKey;
  if (Object.prototype.hasOwnProperty.call(options, "encodeKey")) {
    const candidate = Reflect.get(options, "encodeKey");
    if (typeof candidate !== "function") {
      throw new TypeError("collection encodeKey must be a function");
    }
    encodeKey = candidate;
  }
  const name = Reflect.get(options, "name");
  return {
    ...encodeKey === undefined ? {} : { encodeKey },
    ...name === undefined ? {} : { name }
  };
};
var collectionRowRecursionError = () => new TypeError("collection cannot recursively construct the same row");
var invalidCollectionRow = () => new TypeError("presence requires a same-domain CollectionRow");
var rowRecordFor = (domain, value) => {
  const registry = definitionRegistries?.get(getDefinitionDomainIdentity(domain));
  if (typeof value === "object" && value !== null || typeof value === "function") {
    const record = registry?.rows.get(value);
    if (record !== undefined)
      return record;
  }
  classifyDefinitionHandleOwner(domain, value);
  throw invalidCollectionRow();
};
function createCollectionDefinition(domain, options, weakRuntime) {
  assertDefinitionConstructionAllowed(domain);
  const { encodeKey, name } = inspectCollectionOptions(options);
  let indexes;
  if (options !== undefined && Object.prototype.hasOwnProperty.call(options, "indexes")) {
    const input = Reflect.get(options, "indexes");
    if (typeof input !== "object" || input === null || Array.isArray(input))
      throw new TypeError("collection indexes must be an extractor map");
    const entries = Reflect.ownKeys(input).map((key) => {
      const extract = Reflect.get(input, key);
      if (typeof key !== "string" || typeof extract !== "function")
        throw new TypeError("collection indexes must be named scalar extractors");
      return [key, extract];
    });
    if (entries.length)
      indexes = Object.freeze(Object.fromEntries(entries));
  }
  const rowFactoryArguments = [];
  let definition;
  const mutableCollection = Object.assign(function collection2(input) {
    assertDefinitionAccessorCallAllowed(domain);
    const key = encodeKey === undefined ? canonicalizeCollectionKey(input) : runCollectionEncoder(domain, encodeKey, input);
    rowFactoryArguments[0] = key;
    try {
      return definition.rows.getOrCreateOne(key, rowFactoryArguments);
    } finally {
      rowFactoryArguments.pop();
    }
  }, { kind: "collection" });
  const collection = registerDefinitionHandle(domain, mutableCollection);
  let registry;
  const rows = new WeakTupleMemberCache((args) => {
    const key = args[0];
    return registerDefinitionHandle(domain, {
      kind: "collection-row",
      key
    });
  }, collectionRowRecursionError, weakRuntime, (row) => {
    if (registry === undefined) {
      throw new Error("Collection definition registry is not ready");
    }
    registry.rows.set(row, {
      definition,
      presence: undefined
    });
  });
  definition = Object.freeze({
    collection,
    indexes,
    ...name === undefined ? {} : { name },
    rows,
    referencePresence: weakRuntime === undefined ? referencePresenceNatively : (target) => weakRuntime.ref(target)
  });
  registry = registryFor(domain);
  registry.collections.set(collection, definition);
  ensureCollectionKernel(domain, (records) => createCollectionKernel({
    lookupRow: (row) => registry.rows.get(row)?.definition.collection,
    lookupCollection: (candidate) => registry.collections.has(candidate),
    lookupDiagnosticName: (node) => {
      const rowDefinition = registry.rows.get(node)?.definition;
      return rowDefinition?.name ?? registry.collections.get(node)?.name;
    },
    runGuarded: (session, operation) => runGuardedCallback(records, session, operation),
    inspectThenable: inspectThenable2,
    containThenable: containThenable2
  }));
  return collection;
}
var getCollectionPresence = (domain, row) => {
  assertDefinitionAccessorCallAllowed(domain);
  const record = rowRecordFor(domain, row);
  const current = record.presence?.deref();
  if (current !== undefined)
    return current;
  const presence = createDomainSelector(domain, (get) => get(row) !== undefined);
  record.presence = record.definition.referencePresence(presence);
  return presence;
};

// packages/valdres/src/v1-internal/public-domain.ts
var v1Domain = createDefinitionDomain();

// packages/valdres/src/v1.ts
var atomLazy = (initialize, options = {}) => createDomainLazyAtom(v1Domain, initialize, options);
var atomEager = (initial, options = {}) => createDomainAtom(v1Domain, initial, options);
Object.defineProperty(atomEager, "lazy", {
  configurable: false,
  enumerable: true,
  value: atomLazy,
  writable: false
});
var atom = Object.freeze(atomEager);
var selector = (read, options = {}) => createDomainSelector(v1Domain, read, options);
var externalAtom = (...args) => createInternalExternalAtom(v1Domain, ...args);
function collection(options) {
  return createCollectionDefinition(v1Domain, options);
}
var presence = (row) => getCollectionPresence(v1Domain, row);
var defineFamily = (...parameters) => {
  if (parameters.length === 0 || parameters.length > 2) {
    throw new TypeError("family requires a State factory and options");
  }
  const [createNode, options] = parameters;
  if (typeof createNode !== "function") {
    throw new TypeError("family requires a State factory function");
  }
  if (options !== undefined && (typeof options !== "object" || options === null)) {
    throw new TypeError("family options must be an object");
  }
  const encodeKey = options?.encodeKey;
  if (encodeKey !== undefined && typeof encodeKey !== "function") {
    throw new TypeError("family encodeKey must be a function");
  }
  return createFamilyAccessor(createNode, encodeKey, (phase, callback, args, validate) => runDefinitionCallback(v1Domain, phase, callback, args, validate), (value) => {
    const member = assertDefinitionState(v1Domain, value);
    if (member === undefined) {
      throw new TypeError("family factories must construct or return a family State");
    }
    return member;
  }, (member) => markReacquirableDefinitionState(v1Domain, member), () => assertDefinitionFamilyCallAllowed(v1Domain));
};
var family = defineFamily;
function store() {
  if (arguments.length !== 0) {
    throw new TypeError("store() accepts no arguments");
  }
  return createDomainStore(v1Domain);
}

// packages/valdres/src/equality.ts
var hasMap = typeof Map === "function";
var hasSet = typeof Set === "function";
var hasArrayBuffer = typeof ArrayBuffer === "function" && typeof ArrayBuffer.isView === "function";
var hasSharedArrayBuffer = typeof SharedArrayBuffer === "function";
var arrayBufferPrototype = typeof ArrayBuffer === "function" ? ArrayBuffer.prototype : undefined;
var sharedArrayBufferPrototype = hasSharedArrayBuffer ? SharedArrayBuffer.prototype : undefined;
var getIntrinsicGetter = (target, key) => {
  if (target === undefined)
    return;
  return Object.getOwnPropertyDescriptor(target, key)?.get;
};
var arrayBufferByteLengthGetter = getIntrinsicGetter(arrayBufferPrototype, "byteLength");
var sharedArrayBufferByteLengthGetter = getIntrinsicGetter(sharedArrayBufferPrototype, "byteLength");
var dataViewByteLengthGetter = getIntrinsicGetter(typeof DataView === "function" ? DataView.prototype : undefined, "byteLength");
var typedArrayTagGetter = getIntrinsicGetter(typeof Uint8Array === "function" ? Object.getPrototypeOf(Uint8Array.prototype) : undefined, Symbol.toStringTag);
var typedArrayPrototype = typeof Uint8Array === "function" ? Object.getPrototypeOf(Uint8Array.prototype) : undefined;
var typedArrayBufferGetter = getIntrinsicGetter(typedArrayPrototype, "buffer");
var typedArrayByteOffsetGetter = getIntrinsicGetter(typedArrayPrototype, "byteOffset");
var typedArrayByteLengthGetter = getIntrinsicGetter(typedArrayPrototype, "byteLength");
var dataViewBufferGetter = getIntrinsicGetter(typeof DataView === "function" ? DataView.prototype : undefined, "buffer");
var dataViewByteOffsetGetter = getIntrinsicGetter(typeof DataView === "function" ? DataView.prototype : undefined, "byteOffset");
var mapSizeGetter = getIntrinsicGetter(hasMap ? Map.prototype : undefined, "size");
var mapKeys = hasMap ? Map.prototype.keys : undefined;
var mapHas = hasMap ? Map.prototype.has : undefined;
var mapGet = hasMap ? Map.prototype.get : undefined;
var setSizeGetter = getIntrinsicGetter(hasSet ? Set.prototype : undefined, "size");
var setValues = hasSet ? Set.prototype.values : undefined;
var setHas = hasSet ? Set.prototype.has : undefined;
var regExpSourceGetter = getIntrinsicGetter(RegExp.prototype, "source");
var regExpFlagGetters = [
  "hasIndices",
  "global",
  "ignoreCase",
  "multiline",
  "dotAll",
  "unicode",
  "unicodeSets",
  "sticky"
].map((key) => getIntrinsicGetter(RegExp.prototype, key));
var dateValueOf = Date.prototype.valueOf;
var numberValueOf = Number.prototype.valueOf;
var stringValueOf = String.prototype.valueOf;
var booleanValueOf = Boolean.prototype.valueOf;
var bigintValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : undefined;
var symbolValueOf = Symbol.prototype.valueOf;
var functionToString = Function.prototype.toString;
var hasOwn = Object.prototype.hasOwnProperty;
var isEnumerable = Object.prototype.propertyIsEnumerable;
var sameValueZero = (left, right) => left === right || left !== left && right !== right;
var equalBytes = (leftBuffer, leftByteOffset, rightBuffer, rightByteOffset, byteLength) => {
  if (byteLength === 0)
    return true;
  if (byteLength >= 64 && ((leftByteOffset | rightByteOffset) & 3) === 0) {
    const wordLength = Math.floor(byteLength / 4);
    const leftWords = new Uint32Array(leftBuffer, leftByteOffset, wordLength);
    const rightWords = new Uint32Array(rightBuffer, rightByteOffset, wordLength);
    for (let index = wordLength;index-- !== 0; ) {
      if (leftWords[index] !== rightWords[index])
        return false;
    }
    const wordByteLength = wordLength * 4;
    const remaining = byteLength - wordByteLength;
    if (remaining === 0)
      return true;
    leftByteOffset += wordByteLength;
    rightByteOffset += wordByteLength;
    byteLength = remaining;
  }
  const leftBytes = new Uint8Array(leftBuffer, leftByteOffset, byteLength);
  const rightBytes = new Uint8Array(rightBuffer, rightByteOffset, byteLength);
  for (let index = byteLength;index-- !== 0; ) {
    if (leftBytes[index] !== rightBytes[index])
      return false;
  }
  return true;
};
var equalOwnSymbols = (left, right, leftSymbols, rightSymbols, state) => {
  let leftCount = 0;
  for (let index = leftSymbols.length;index-- !== 0; ) {
    const key = leftSymbols[index];
    if (!isEnumerable.call(left, key))
      continue;
    leftCount++;
    if (!isEnumerable.call(right, key))
      return false;
    if (!deepEqualInternal(left[key], right[key], state))
      return false;
  }
  let rightCount = 0;
  for (let index = rightSymbols.length;index-- !== 0; ) {
    if (isEnumerable.call(right, rightSymbols[index]))
      rightCount++;
  }
  return leftCount === rightCount;
};
var equalOwnEnumerable = (left, right, state) => {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length)
    return false;
  for (let index = leftKeys.length;index-- !== 0; ) {
    const key = leftKeys[index];
    if (!hasOwn.call(right, key))
      return false;
    if (!deepEqualInternal(left[key], right[key], state))
      return false;
  }
  return equalOwnSymbols(left, right, Object.getOwnPropertySymbols(left), Object.getOwnPropertySymbols(right), state);
};
var isDensePlainArray = (value, length) => {
  const keys = Reflect.ownKeys(value);
  return keys.length === length + 1 && keys[length] === "length";
};
var intrinsicNumber = (getter, value) => getter.call(value);
var intrinsicBuffer = (getter, value) => getter.call(value);
var hasPrototypeGetter = (value, key) => {
  let prototype = Object.getPrototypeOf(value);
  while (prototype !== null) {
    if (typeof Object.getOwnPropertyDescriptor(prototype, key)?.get === "function") {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return false;
};
var getBinaryDescriptor = (value, allowCrossRealmBufferProbe) => {
  if (!hasArrayBuffer)
    return;
  if (ArrayBuffer.isView(value)) {
    const typedArrayTag = typedArrayTagGetter?.call(value);
    if (typeof typedArrayTag === "string") {
      return {
        brand: typedArrayTag,
        buffer: intrinsicBuffer(typedArrayBufferGetter, value),
        byteOffset: intrinsicNumber(typedArrayByteOffsetGetter, value),
        byteLength: intrinsicNumber(typedArrayByteLengthGetter, value)
      };
    }
    return {
      brand: "DataView",
      buffer: intrinsicBuffer(dataViewBufferGetter, value),
      byteOffset: intrinsicNumber(dataViewByteOffsetGetter, value),
      byteLength: intrinsicNumber(dataViewByteLengthGetter, value)
    };
  }
  if (value instanceof ArrayBuffer) {
    return {
      brand: "ArrayBuffer",
      buffer: value,
      byteOffset: 0,
      byteLength: intrinsicNumber(arrayBufferByteLengthGetter, value)
    };
  }
  if (hasSharedArrayBuffer && value instanceof SharedArrayBuffer) {
    return {
      brand: "SharedArrayBuffer",
      buffer: value,
      byteOffset: 0,
      byteLength: intrinsicNumber(sharedArrayBufferByteLengthGetter, value)
    };
  }
  if (!allowCrossRealmBufferProbe)
    return;
  if (!hasPrototypeGetter(value, "byteLength"))
    return;
  try {
    return {
      brand: "ArrayBuffer",
      buffer: value,
      byteOffset: 0,
      byteLength: intrinsicNumber(arrayBufferByteLengthGetter, value)
    };
  } catch {}
  if (hasSharedArrayBuffer) {
    try {
      return {
        brand: "SharedArrayBuffer",
        buffer: value,
        byteOffset: 0,
        byteLength: intrinsicNumber(sharedArrayBufferByteLengthGetter, value)
      };
    } catch {
      return;
    }
  }
  return;
};
var isDomNode = (value) => {
  if (typeof Node !== "undefined" && value instanceof Node)
    return true;
  return typeof value.nodeType === "number" && typeof value.nodeName === "string" && typeof value.cloneNode === "function" && "ownerDocument" in value;
};
var isStructurallyComparableObject = (value) => {
  let prototype = Object.getPrototypeOf(value);
  if (prototype === null || prototype === Object.prototype)
    return true;
  while (prototype !== null && prototype !== Object.prototype) {
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
    if (typeof constructor === "function" && /\{\s*\[native code\]\s*\}/.test(functionToString.call(constructor))) {
      return false;
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return true;
};
var deepEqualInternal = (left, right, state) => {
  if (sameValueZero(left, right))
    return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    return false;
  }
  const leftObject = left;
  const rightObject = right;
  const leftPrototype = Object.getPrototypeOf(leftObject);
  const rightPrototype = Object.getPrototypeOf(rightObject);
  const prototypesMatch = leftPrototype === rightPrototype;
  const leftBinary = getBinaryDescriptor(leftObject, !prototypesMatch || leftPrototype !== null && leftPrototype !== Object.prototype && leftPrototype !== arrayBufferPrototype && (!hasSharedArrayBuffer || leftPrototype !== sharedArrayBufferPrototype));
  const rightBinary = getBinaryDescriptor(rightObject, !prototypesMatch || rightPrototype !== null && rightPrototype !== Object.prototype && rightPrototype !== arrayBufferPrototype && (!hasSharedArrayBuffer || rightPrototype !== sharedArrayBufferPrototype));
  if (!prototypesMatch && (leftBinary === undefined || rightBinary === undefined || leftBinary.brand !== rightBinary.brand)) {
    return false;
  }
  const comparisonState = state ?? {
    leftAncestors: [],
    rightAncestors: []
  };
  if (comparisonState.leftAncestors.includes(leftObject) || comparisonState.rightAncestors.includes(rightObject)) {
    return false;
  }
  comparisonState.leftAncestors.push(leftObject);
  comparisonState.rightAncestors.push(rightObject);
  try {
    return deepEqualObjects(leftObject, rightObject, comparisonState, leftBinary, rightBinary);
  } finally {
    comparisonState.leftAncestors.pop();
    comparisonState.rightAncestors.pop();
  }
};
var deepEqualObjects = (leftObject, rightObject, state, leftBinary, rightBinary) => {
  if (Array.isArray(leftObject)) {
    if (!Array.isArray(rightObject))
      return false;
    const length = leftObject.length;
    if (length !== rightObject.length)
      return false;
    for (let index = length;index-- !== 0; ) {
      if (!deepEqualInternal(leftObject[index], rightObject[index], state)) {
        return false;
      }
    }
    if (!isDensePlainArray(leftObject, length) || !isDensePlainArray(rightObject, length)) {
      return equalOwnEnumerable(leftObject, rightObject, state);
    }
    return true;
  }
  if (hasMap && (leftObject instanceof Map || rightObject instanceof Map)) {
    if (!(leftObject instanceof Map) || !(rightObject instanceof Map)) {
      return false;
    }
    let leftSize;
    let rightSize;
    try {
      leftSize = mapSizeGetter.call(leftObject);
      rightSize = mapSizeGetter.call(rightObject);
    } catch {
      return false;
    }
    if (leftSize !== rightSize)
      return false;
    for (const key of mapKeys.call(leftObject)) {
      if (!mapHas.call(rightObject, key))
        return false;
      if (!deepEqualInternal(mapGet.call(leftObject, key), mapGet.call(rightObject, key), state)) {
        return false;
      }
    }
    return equalOwnEnumerable(leftObject, rightObject, state);
  }
  if (hasSet && (leftObject instanceof Set || rightObject instanceof Set)) {
    if (!(leftObject instanceof Set) || !(rightObject instanceof Set)) {
      return false;
    }
    let leftSize;
    let rightSize;
    try {
      leftSize = setSizeGetter.call(leftObject);
      rightSize = setSizeGetter.call(rightObject);
    } catch {
      return false;
    }
    if (leftSize !== rightSize)
      return false;
    for (const value of setValues.call(leftObject)) {
      if (!setHas.call(rightObject, value))
        return false;
    }
    return equalOwnEnumerable(leftObject, rightObject, state);
  }
  if (leftBinary !== undefined || rightBinary !== undefined) {
    if (leftBinary === undefined || rightBinary === undefined || leftBinary.brand !== rightBinary.brand || leftBinary.byteLength !== rightBinary.byteLength) {
      return false;
    }
    return equalBytes(leftBinary.buffer, leftBinary.byteOffset, rightBinary.buffer, rightBinary.byteOffset, leftBinary.byteLength);
  }
  if (leftObject instanceof RegExp || rightObject instanceof RegExp) {
    if (!(leftObject instanceof RegExp) || !(rightObject instanceof RegExp)) {
      return false;
    }
    try {
      if (regExpSourceGetter.call(leftObject) !== regExpSourceGetter.call(rightObject)) {
        return false;
      }
      for (const getter of regExpFlagGetters) {
        if (getter !== undefined && getter.call(leftObject) !== getter.call(rightObject)) {
          return false;
        }
      }
    } catch {
      return false;
    }
    return equalOwnEnumerable(leftObject, rightObject, state);
  }
  if (leftObject instanceof Date || rightObject instanceof Date) {
    if (!(leftObject instanceof Date) || !(rightObject instanceof Date)) {
      return false;
    }
    try {
      if (!sameValueZero(dateValueOf.call(leftObject), dateValueOf.call(rightObject))) {
        return false;
      }
    } catch {
      return false;
    }
    return equalOwnEnumerable(leftObject, rightObject, state);
  }
  const boxedValueOf = leftObject instanceof Number || rightObject instanceof Number ? numberValueOf : leftObject instanceof String || rightObject instanceof String ? stringValueOf : leftObject instanceof Boolean || rightObject instanceof Boolean ? booleanValueOf : typeof BigInt === "function" && (leftObject instanceof BigInt || rightObject instanceof BigInt) ? bigintValueOf : leftObject instanceof Symbol || rightObject instanceof Symbol ? symbolValueOf : undefined;
  if (boxedValueOf !== undefined) {
    try {
      if (!sameValueZero(boxedValueOf.call(leftObject), boxedValueOf.call(rightObject))) {
        return false;
      }
    } catch {
      return false;
    }
    return equalOwnEnumerable(leftObject, rightObject, state);
  }
  const leftPrototype = Object.getPrototypeOf(leftObject);
  const rightPrototype = Object.getPrototypeOf(rightObject);
  const leftIsPlain = leftPrototype === null || leftPrototype === Object.prototype;
  const rightIsPlain = rightPrototype === null || rightPrototype === Object.prototype;
  if (!leftIsPlain && (isDomNode(leftObject) || !isStructurallyComparableObject(leftObject)) || !rightIsPlain && (isDomNode(rightObject) || !isStructurallyComparableObject(rightObject))) {
    return false;
  }
  const leftValueOf = leftObject.valueOf;
  const rightValueOf = rightObject.valueOf;
  const hasCustomValueOf = typeof leftValueOf === "function" && leftValueOf !== Object.prototype.valueOf || typeof rightValueOf === "function" && rightValueOf !== Object.prototype.valueOf;
  if (hasCustomValueOf) {
    if (typeof leftValueOf !== "function" || typeof rightValueOf !== "function") {
      return false;
    }
    const leftValue = leftValueOf.call(leftObject);
    const rightValue = rightValueOf.call(rightObject);
    const leftIsPrimitive = leftValue === null || typeof leftValue !== "object" && typeof leftValue !== "function";
    const rightIsPrimitive = rightValue === null || typeof rightValue !== "object" && typeof rightValue !== "function";
    if (leftIsPrimitive !== rightIsPrimitive)
      return false;
    if (leftIsPrimitive && !sameValueZero(leftValue, rightValue)) {
      return false;
    }
  } else {
    const leftToString = leftObject.toString;
    const rightToString = rightObject.toString;
    const hasCustomToString = typeof leftToString === "function" && leftToString !== Object.prototype.toString || typeof rightToString === "function" && rightToString !== Object.prototype.toString;
    if (hasCustomToString) {
      if (typeof leftToString !== "function" || typeof rightToString !== "function" || leftToString.call(leftObject) !== rightToString.call(rightObject)) {
        return false;
      }
    }
  }
  const leftKeys = Object.keys(leftObject);
  if (leftKeys.length !== Object.keys(rightObject).length)
    return false;
  for (let index = leftKeys.length;index-- !== 0; ) {
    if (!hasOwn.call(rightObject, leftKeys[index]))
      return false;
  }
  for (let index = leftKeys.length;index-- !== 0; ) {
    const key = leftKeys[index];
    if ((key === "_owner" || key === "__v" || key === "__o") && leftObject.$$typeof) {
      continue;
    }
    if (!deepEqualInternal(leftObject[key], rightObject[key], state)) {
      return false;
    }
  }
  const leftSymbols = Object.getOwnPropertySymbols(leftObject);
  const rightSymbols = Object.getOwnPropertySymbols(rightObject);
  if (leftSymbols.length !== 0 || rightSymbols.length !== 0) {
    return equalOwnSymbols(leftObject, rightObject, leftSymbols, rightSymbols, state);
  }
  return true;
};
var deepEqual = (left, right) => deepEqualInternal(left, right);

// packages/valdres/src/index.ts
var atom2 = atom;
var collection2 = collection;
var externalAtom2 = externalAtom;
var family2 = family;
var presence2 = presence;
var selector2 = selector;
var store2 = store;
var CallbackCapabilityError2 = CallbackCapabilityError;
var InvalidAtomComparatorResultError2 = InvalidAtomComparatorResultError;
var InvalidCollectionKeyError2 = InvalidCollectionKeyError;
var InvalidSynchronousCollectionValueError2 = InvalidSynchronousCollectionValueError;
var InvalidSynchronousAtomValueError2 = InvalidSynchronousAtomValueError;
var InvalidTransactionCallbackResultError2 = InvalidTransactionCallbackResultError;
var InvalidTransactionTargetError2 = InvalidTransactionTargetError;
var MissingCollectionRowError2 = MissingCollectionRowError;
var RuntimeMismatchError2 = RuntimeMismatchError;
var ScopeNotFoundError2 = ScopeNotFoundError;
var SelectorCapabilityError2 = SelectorCapabilityError;
var SelectorCircularDependencyError2 = SelectorCircularDependencyError;
var SettleLimitError2 = SettleLimitError;
var StoreDisposedError2 = StoreDisposedError;
var StoreTreeMismatchError2 = StoreTreeMismatchError;
var SubscriberNotificationError3 = SubscriberNotificationError;
var TransactionClosedError2 = TransactionClosedError;
var TransactionPhaseError2 = TransactionPhaseError;
var UndefinedCollectionValueError2 = UndefinedCollectionValueError;
var DormantExternalReadError2 = DormantExternalReadError;
var ExternalSourceDeliveryLimitError2 = ExternalSourceDeliveryLimitError;
var ExternalSourceNonConvergenceError2 = ExternalSourceNonConvergenceError;
var ExternalSourceOperationError2 = ExternalSourceOperationError;
var InvalidExternalCleanupError2 = InvalidExternalCleanupError;
var InvalidSynchronousExternalSnapshotError2 = InvalidSynchronousExternalSnapshotError;
var ServerSnapshotUnavailableError2 = ServerSnapshotUnavailableError;
export {
  CallbackCapabilityError2 as CallbackCapabilityError,
  DormantExternalReadError2 as DormantExternalReadError,
  ExternalSourceDeliveryLimitError2 as ExternalSourceDeliveryLimitError,
  ExternalSourceNonConvergenceError2 as ExternalSourceNonConvergenceError,
  ExternalSourceOperationError2 as ExternalSourceOperationError,
  InvalidAtomComparatorResultError2 as InvalidAtomComparatorResultError,
  InvalidCollectionKeyError2 as InvalidCollectionKeyError,
  InvalidExternalCleanupError2 as InvalidExternalCleanupError,
  InvalidSynchronousAtomValueError2 as InvalidSynchronousAtomValueError,
  InvalidSynchronousCollectionValueError2 as InvalidSynchronousCollectionValueError,
  InvalidSynchronousExternalSnapshotError2 as InvalidSynchronousExternalSnapshotError,
  InvalidTransactionCallbackResultError2 as InvalidTransactionCallbackResultError,
  InvalidTransactionTargetError2 as InvalidTransactionTargetError,
  MissingCollectionRowError2 as MissingCollectionRowError,
  RuntimeMismatchError2 as RuntimeMismatchError,
  ScopeNotFoundError2 as ScopeNotFoundError,
  SelectorCapabilityError2 as SelectorCapabilityError,
  SelectorCircularDependencyError2 as SelectorCircularDependencyError,
  ServerSnapshotUnavailableError2 as ServerSnapshotUnavailableError,
  SettleLimitError2 as SettleLimitError,
  StoreDisposedError2 as StoreDisposedError,
  StoreTreeMismatchError2 as StoreTreeMismatchError,
  SubscriberNotificationError3 as SubscriberNotificationError,
  TransactionClosedError2 as TransactionClosedError,
  TransactionPhaseError2 as TransactionPhaseError,
  UndefinedCollectionValueError2 as UndefinedCollectionValueError,
  atom2 as atom,
  collection2 as collection,
  deepEqual,
  externalAtom2 as externalAtom,
  family2 as family,
  presence2 as presence,
  selector2 as selector,
  store2 as store
};

//# debugId=2042CBCB576C0D3E64756E2164756E21
