/**
 * Jewels — agentic shadow companions for app methods.
 *
 * A jewel lives in `foo.jewel.ts` beside the method `foo.ts` it shadows. It
 * proposes what a careful teammate would have done — an input for the method
 * — without ever applying it: the method stays the only door for writes.
 *
 * ```ts
 * // updateIssue.jewel.ts
 * export default defineJewel(updateIssue, {
 *   subject: ({ issueId }) => ({ issueId }),
 *   propose: async ({ issueId }) => {
 *     // arbitrary TS: reads via plain imports, model calls via runTask
 *     return { input: { issueId, status: 'triaged' }, reasoning: '...' };
 *   },
 * });
 * ```
 *
 * `defineJewel` returns a CALLABLE — the executor — with the config attached
 * as properties (the Express-app pattern). That shape is deliberate: the
 * platform's sandbox worker invokes one exported function per execution
 * frame (`mod[handlerName](params)`), so a jewel run is an ordinary
 * method-execution frame with zero worker or protocol changes. Dev tooling
 * calls the same function, so dev and production share one executor body,
 * versioned here in the SDK.
 *
 * Three run modes, discriminated by which key the caller provides:
 * - `{ humanInput }` — shadow mode. The subject is derived via the jewel's
 *   projection (the human's decision fields never reach `propose`), and
 *   `humanInput` doubles as ground truth for grading.
 * - `{ subject }` — eval / arrival mode. No human action exists yet, so the
 *   record is ungraded (an arrival proposal is graded later, when the human
 *   acts — see the grade mode below).
 * - `{ grade: { proposed, actual } }` — grade-only mode: deferred grading of
 *   an earlier arrival proposal against the human's eventual action. Runs
 *   the jewel's own `grade` (or the default deep-equal) and nothing else.
 *
 * The executor NEVER throws: a shadow run must never break anything. Author
 * code failing (`subject`/`propose`) is captured in the record's `error`;
 * `grade` failing softens to verdict `'skip'`.
 */

//////////////////////////////////////////////////////////////////////////////
// Types
//////////////////////////////////////////////////////////////////////////////

/** Any app method a jewel can shadow: one JSON-serializable input, any result. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JewelMethod = (input: any) => any;

/**
 * The input type of the shadowed method. Guarded so a zero-parameter method
 * resolves to `undefined` instead of erroring on `Parameters<M>[0]`.
 */
export type JewelMethodInput<M extends JewelMethod> =
  Parameters<M> extends [] ? undefined : Parameters<M>[0];

/**
 * What `propose` returns. `input: null` is abstention — a first-class,
 * graded outcome, not an error. Reasoning is most valuable on abstention.
 */
export interface JewelProposal<I> {
  input: I | null;
  reasoning: string;
  /**
   * Transcript id(s) of the runTask call(s) that constitute this decision
   * (`task.traceId`; an array for escalation chains). Attaching preserves
   * the full model transcript with the pair — the training row and, at
   * auto, the audit trail. Helper/formatting calls stay unattached: the
   * attachment is the label for which run WAS the decision.
   */
  trace?: string | string[];
}

export interface JewelVerdict {
  verdict: 'agree' | 'disagree' | 'skip';
  notes?: string;
  /** Transcript id(s) of the judge's runTask call(s), when grade used one. */
  trace?: string | string[];
}

/**
 * Argument to a custom `grade`. `proposed` is null when the jewel abstained;
 * `actual` is always present — grading only happens in shadow mode, where
 * the human acted.
 */
export interface JewelGradeContext<I> {
  proposed: I | null;
  actual: I;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Authoring config. Declare `subject` before `propose` — the subject type
 * is inferred from the projection's return and flows into `propose`'s
 * parameter.
 */
export interface JewelConfig<M extends JewelMethod, S> {
  /**
   * Projection: method input → subject. What the human was looking at,
   * never what they decided — this is what keeps the label out of the exam.
   */
  subject: (input: JewelMethodInput<M>) => S;
  /**
   * The proposal. Runs on the projection only; arbitrary TS (plain imports
   * for context, model calls via runTask). Throwing never propagates — it
   * becomes an `error` on the pair record.
   */
  propose: (subject: NoInfer<S>) => MaybePromise<JewelProposal<JewelMethodInput<M>>>;
  /**
   * The custom assertion. Omit for deep-equal on the method input. May be
   * async and call models. Throwing softens to verdict `'skip'`.
   *
   * Strict-safe field iteration, when grading only touched fields:
   * ```ts
   * grade: ({ proposed, actual }) => {
   *   if (!proposed) return { verdict: 'disagree', notes: 'abstained' };
   *   const keys = Object.keys(actual) as (keyof typeof actual)[];
   *   const misses = keys.filter((k) => proposed[k] !== actual[k]);
   *   return misses.length
   *     ? { verdict: 'disagree', notes: misses.join(', ') }
   *     : { verdict: 'agree' };
   * }
   * ```
   */
  grade?: (
    ctx: JewelGradeContext<JewelMethodInput<M>>,
  ) => MaybePromise<JewelVerdict>;
}

/**
 * Executor params — constructed by the platform (or dev tooling), exactly
 * one key. `?: never` on the other keys rejects passing more than one.
 */
export type JewelRunParams<I, S> =
  | { humanInput: I; subject?: never; grade?: never }
  | { subject: S; humanInput?: never; grade?: never }
  | { grade: JewelGradeContext<I>; humanInput?: never; subject?: never };

/**
 * The versioned, JSON-serializable output of one jewel run — the row the
 * pair ledger stores. Values are kept verbatim, so method inputs must be
 * JSON-safe (they already crossed the wire as JSON in real use).
 */
export interface JewelPairRecord<I = unknown, S = unknown> {
  v: 1;
  /** `grade` records are consumed by the platform (verdict extracted from a
   *  grade-only run) and never persisted as pair rows themselves. */
  mode: 'shadow' | 'eval' | 'grade';
  /** Absent only when the projection itself threw (shadow mode). */
  subject?: S;
  /** null = abstention. Absent when propose failed. */
  proposed?: I | null;
  /** Absent when propose failed. */
  reasoning?: string;
  /** The human's input — present in shadow mode. */
  actual?: I;
  /** Present iff graded (shadow or grade mode, propose succeeded). */
  verdict?: 'agree' | 'disagree' | 'skip';
  notes?: string;
  /** Present iff subject() or propose() threw. Grade errors become verdict 'skip'. */
  error?: { phase: 'subject' | 'propose'; message: string; stack?: string };
  /**
   * Transcript ids attached by propose. The transcripts themselves live
   * platform-side, recorded per turn and keyed by (run id, trace id) — the
   * record carries only the ids.
   */
  trace?: string[];
  /** Transcript ids attached by a custom grade's verdict. */
  gradeTrace?: string[];
  /**
   * Whether this jewel declares a custom `grade`. The platform's deferred
   * grading dispatches a grade-mode run when true; when false it grades
   * locally with an equivalent of the default deep-equal (no sandbox trip
   * to evaluate a pure structural comparison).
   */
  customGrade: boolean;
  startedAt: number;
  durationMs: number;
}

/**
 * The export of a `foo.jewel.ts` file: the executor, callable as an
 * ordinary handler, with the authored config attached for the compiler and
 * dev tooling. `method` carries the actual function reference — reference
 * identity is what lets the compiler verify the manifest's method↔jewel
 * pairing against the code. `grade` is `undefined` when the default
 * deep-equal grade applies; presence is the custom-grade signal.
 */
export interface Jewel<M extends JewelMethod, S> {
  (
    params: JewelRunParams<JewelMethodInput<M>, S>,
  ): Promise<JewelPairRecord<JewelMethodInput<M>, S>>;
  readonly kind: 'jewel';
  readonly method: M;
  readonly subject: (input: JewelMethodInput<M>) => S;
  readonly propose: (
    subject: S,
  ) => MaybePromise<JewelProposal<JewelMethodInput<M>>>;
  readonly grade:
    | ((ctx: JewelGradeContext<JewelMethodInput<M>>) => MaybePromise<JewelVerdict>)
    | undefined;
}

//////////////////////////////////////////////////////////////////////////////
// Arrival triggers — mindstudio.jewels.propose
//////////////////////////////////////////////////////////////////////////////

/**
 * What the platform did with a proposal, routed by the method's autonomy:
 * - `recorded` — shadow: proposal written to the pair ledger, graded later
 *   against the human's eventual action (within the attribution window).
 * - `queued` — approve: waiting in the review queue.
 * - `committed` — auto: the jewel's proposal was applied (the method ran);
 *   `output` carries the method's return value.
 * - `abstained` — the jewel chose not to act; recorded, still gradeable.
 * - `disabled` — the method has no jewel or autonomy is `manual`. Returned,
 *   never thrown: dialing a method down must not break the app code that
 *   proposes to it.
 * - `skipped` — dev session, jewel-descended recursion, or unsampled
 *   (sampleRate).
 * - `failed` — an auto commit was attempted and the method rejected it
 *   (e.g. the state was consumed concurrently). The moment stays pending.
 * - `pending` — a concurrent replay: the original propose for this
 *   idempotencyKey is still mid-run. Treat as accepted.
 */
export type JewelProposeOutcome =
  | 'recorded'
  | 'queued'
  | 'committed'
  | 'abstained'
  | 'disabled'
  | 'skipped'
  | 'failed'
  | 'pending';

export interface JewelProposeResult {
  outcome: JewelProposeOutcome;
  /** Present on `committed` — the method's return value. */
  output?: unknown;
  /** Present on `queued` — address the item via `jewels.queue.resolve`. */
  queueItemId?: string;
}

/** A pending approval-queue item awaiting a reviewer. */
export interface JewelQueueItem {
  id: string;
  methodId: string;
  subject: Record<string, unknown>;
  /** The method input the jewel proposes to apply. */
  proposed: unknown;
  reasoning: string | null;
  proposedAt: string;
  /** Unresolved items expire (verdict `expired`) at the attribution window. */
  expiresAt: string;
}

export type JewelQueueResolution = 'approved' | 'edited' | 'dismissed';

export interface JewelQueueResolveResult {
  resolution: JewelQueueResolution;
  /** Present on approve — the applied method's return value. */
  output?: unknown;
}

export interface JewelsApi {
  /**
   * Hand a decision moment to a method's jewel — the arrival-shaped trigger.
   * Place it where the app knows the moment was born (an ingest branch that
   * lands a row in its pending state). The platform routes by the method's
   * autonomy; see {@link JewelProposeOutcome}.
   *
   * `idempotencyKey` (Stripe semantics — a replayed key returns the ORIGINAL
   * outcome, so retried webhooks are invisible to this code) defaults to a
   * hash of the subject. Sibling proposals for one decision moment should
   * share a key so cross-verb grading can close them together.
   *
   * Backend/managed contexts only (rides the execution's hook token). Runs
   * the jewel synchronously — wrap chains in `mindstudio.waitUntil(...)` so
   * the calling method returns immediately:
   *
   * ```ts
   * mindstudio.waitUntil((async () => {
   *   const merge = await mindstudio.jewels.propose(
   *     'merge-issues', { sourceId: issue.id }, { idempotencyKey: issue.id });
   *   if (merge.outcome !== 'committed') {
   *     await mindstudio.jewels.propose(
   *       'triage-issue', { issueId: issue.id }, { idempotencyKey: issue.id });
   *   }
   * })());
   * ```
   */
  propose(
    methodId: string,
    subject: Record<string, unknown>,
    opts?: { idempotencyKey?: string },
  ): Promise<JewelProposeResult>;

  /**
   * The app-native approval queue for `approve`-mode methods. Build the
   * review UI in the app itself: a backend method lists items (gate it with
   * the app's reviewer role), the frontend renders the inbox, and a resolve
   * method approves or dismisses.
   */
  queue: {
    /** Pending items, oldest first. */
    list(opts?: {
      methodId?: string;
      limit?: number;
    }): Promise<{ items: JewelQueueItem[] }>;
    /**
     * Resolve one item. `approve` APPLIES the target method as the current
     * session user — the reviewer — so the effect belongs to the human who
     * clicked, and the target method's own auth checks are the real gate on
     * who may approve. Pass `input` to apply an edited version of the
     * proposal (captured as resolution `edited` — proposed/edited/final ride
     * the pair record; the richest training signal). `dismiss` records the
     * rejection and closes the item without running anything; other verbs'
     * proposals for the same moment stay open.
     */
    resolve(
      itemId: string,
      opts: { action: 'approve' | 'dismiss'; input?: Record<string, unknown> },
    ): Promise<JewelQueueResolveResult>;
  };
}

//////////////////////////////////////////////////////////////////////////////
// Runtime
//////////////////////////////////////////////////////////////////////////////

function errorInfo(e: unknown): { message: string; stack?: string } {
  if (e instanceof Error) return { message: e.message, stack: e.stack };
  return { message: String(e) };
}

/**
 * Structural deep equality with JSON semantics: keys whose value is
 * `undefined` are treated as absent (matching what survives
 * JSON.stringify), arrays compare positionally. `null === null` is true, so
 * double abstention grades 'agree'.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;
  if (aIsArray) {
    const aa = a as unknown[];
    const ba = b as unknown[];
    return aa.length === ba.length && aa.every((v, i) => deepEqual(v, ba[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bKeys = Object.keys(bo).filter((k) => bo[k] !== undefined);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => deepEqual(ao[k], bo[k]));
}

const VERDICTS = new Set(['agree', 'disagree', 'skip']);

/** Defensive: an untyped (JS) grade can return garbage. */
function normalizeVerdict(v: JewelVerdict): JewelVerdict {
  if (!v || !VERDICTS.has(v.verdict)) {
    return {
      verdict: 'skip',
      notes: `grade returned invalid verdict: ${JSON.stringify(v)}`,
    };
  }
  return v.notes === undefined
    ? { verdict: v.verdict }
    : { verdict: v.verdict, notes: v.notes };
}

/**
 * Define a jewel — the agentic shadow companion for an app method.
 *
 * @example
 * ```ts
 * export default defineJewel(updateIssue, {
 *   subject: ({ issueId }) => ({ issueId }),
 *   propose: async ({ issueId }) => {
 *     const issue = await resolveIssue(issueId);
 *     if (!issue || issue.status !== 'new') {
 *       return { input: null, reasoning: 'Nothing to propose.' };
 *     }
 *     // ...gather context, call a model via runTask + outputSchema...
 *     return { input: { issueId, status: 'triaged' }, reasoning: '...' };
 *   },
 *   grade: async ({ proposed, actual }) => {
 *     if (!proposed) return { verdict: 'disagree', notes: 'abstained' };
 *     return proposed.status === actual.status
 *       ? { verdict: 'agree' }
 *       : { verdict: 'disagree' };
 *   },
 * });
 * ```
 */
export function defineJewel<M extends JewelMethod, S>(
  method: M,
  config: JewelConfig<M, S>,
): Jewel<M, S> {
  type I = JewelMethodInput<M>;

  // Shared by the shadow path and grade-only mode: the jewel's own grade, or
  // the default deep-equal. Never throws — author failures soften to 'skip'.
  const runGrade = async (proposed: I | null, actual: I): Promise<JewelVerdict> => {
    if (config.grade) {
      try {
        return normalizeVerdict(await config.grade({ proposed, actual }));
      } catch (e) {
        return { verdict: 'skip', notes: `grade threw: ${errorInfo(e).message}` };
      }
    }
    return deepEqual(proposed, actual)
      ? { verdict: 'agree' }
      : { verdict: 'disagree' };
  };

  const run = async (
    params: JewelRunParams<I, S>,
  ): Promise<JewelPairRecord<I, S>> => {
    const startedAt = Date.now();
    const customGrade = config.grade !== undefined;
    const done = (
      rest: Omit<
        JewelPairRecord<I, S>,
        'v' | 'customGrade' | 'startedAt' | 'durationMs'
      >,
    ): JewelPairRecord<I, S> => ({
      v: 1,
      customGrade,
      startedAt,
      durationMs: Date.now() - startedAt,
      ...rest,
    });

    // Normalize an authored trace attachment (id | ids | absent) to the
    // record's array form.
    const traceIds = (t: string | string[] | undefined): string[] | undefined => {
      if (t === undefined) return undefined;
      const ids = (Array.isArray(t) ? t : [t]).filter(
        (id) => typeof id === 'string' && id.length > 0,
      );
      return ids.length > 0 ? ids : undefined;
    };

    // hasOwnProperty rather than truthiness: a zero-input method's
    // humanInput is legitimately undefined, and the caller's contract is
    // "exactly one key present".
    if (Object.prototype.hasOwnProperty.call(params, 'grade')) {
      // Grade-only mode: deferred grading of an arrival proposal against the
      // human's eventual action. Runs the grader and nothing else.
      const ctx = (params as { grade: JewelGradeContext<I> }).grade;
      const verdict = await runGrade(ctx.proposed, ctx.actual);
      const gradeTrace = traceIds(verdict.trace);
      return done({
        mode: 'grade',
        proposed: ctx.proposed,
        actual: ctx.actual,
        verdict: verdict.verdict,
        ...(verdict.notes !== undefined ? { notes: verdict.notes } : {}),
        ...(gradeTrace ? { gradeTrace } : {}),
      });
    }

    const isShadow = Object.prototype.hasOwnProperty.call(params, 'humanInput');
    const mode = isShadow ? ('shadow' as const) : ('eval' as const);
    const actual = isShadow ? (params as { humanInput: I }).humanInput : undefined;

    // The projection is author code on the shadow path — it must never
    // propagate either. In eval mode the subject arrives pre-built.
    let subject: S;
    if (isShadow) {
      try {
        subject = config.subject(actual as I);
      } catch (e) {
        return done({ mode, actual, error: { phase: 'subject', ...errorInfo(e) } });
      }
    } else {
      subject = (params as { subject: S }).subject;
    }

    let proposal: JewelProposal<I>;
    try {
      proposal = await config.propose(subject);
    } catch (e) {
      return done({
        mode,
        subject,
        actual,
        error: { phase: 'propose', ...errorInfo(e) },
      });
    }

    const trace = traceIds(proposal.trace);

    // Eval runs have no ground truth — the record stays ungraded.
    if (!isShadow) {
      return done({
        mode,
        subject,
        proposed: proposal.input,
        reasoning: proposal.reasoning,
        ...(trace ? { trace } : {}),
      });
    }

    const verdict = await runGrade(proposal.input, actual as I);
    const gradeTrace = traceIds(verdict.trace);

    return done({
      mode,
      subject,
      proposed: proposal.input,
      reasoning: proposal.reasoning,
      actual,
      verdict: verdict.verdict,
      ...(verdict.notes !== undefined ? { notes: verdict.notes } : {}),
      ...(trace ? { trace } : {}),
      ...(gradeTrace ? { gradeTrace } : {}),
    });
  };

  return Object.assign(run, {
    kind: 'jewel' as const,
    method,
    subject: config.subject,
    propose: config.propose,
    grade: config.grade,
  });
}
