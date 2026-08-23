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
 * Two run modes, discriminated by which key the caller provides:
 * - `{ humanInput }` — shadow mode. The subject is derived via the jewel's
 *   projection (the human's decision fields never reach `propose`), and
 *   `humanInput` doubles as ground truth for grading.
 * - `{ subject }` — eval / event-shaped mode. No human action exists, so the
 *   record is ungraded.
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
}

export interface JewelVerdict {
  verdict: 'agree' | 'disagree' | 'skip';
  notes?: string;
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
 * one key. `?: never` on the other key rejects passing both.
 */
export type JewelRunParams<I, S> =
  | { humanInput: I; subject?: never }
  | { subject: S; humanInput?: never };

/**
 * The versioned, JSON-serializable output of one jewel run — the row the
 * pair ledger stores. Values are kept verbatim, so method inputs must be
 * JSON-safe (they already crossed the wire as JSON in real use).
 */
export interface JewelPairRecord<I = unknown, S = unknown> {
  v: 1;
  mode: 'shadow' | 'eval';
  /** Absent only when the projection itself threw (shadow mode). */
  subject?: S;
  /** null = abstention. Absent when propose failed. */
  proposed?: I | null;
  /** Absent when propose failed. */
  reasoning?: string;
  /** The human's input — present in shadow mode. */
  actual?: I;
  /** Present iff graded (shadow mode, propose succeeded). */
  verdict?: 'agree' | 'disagree' | 'skip';
  notes?: string;
  /** Present iff subject() or propose() threw. Grade errors become verdict 'skip'. */
  error?: { phase: 'subject' | 'propose'; message: string; stack?: string };
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

  const run = async (
    params: JewelRunParams<I, S>,
  ): Promise<JewelPairRecord<I, S>> => {
    const startedAt = Date.now();
    const done = (
      rest: Omit<JewelPairRecord<I, S>, 'v' | 'startedAt' | 'durationMs'>,
    ): JewelPairRecord<I, S> => ({
      v: 1,
      startedAt,
      durationMs: Date.now() - startedAt,
      ...rest,
    });

    // hasOwnProperty rather than truthiness: a zero-input method's
    // humanInput is legitimately undefined, and the caller's contract is
    // "exactly one key present".
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

    // Eval runs have no ground truth — the record stays ungraded.
    if (!isShadow) {
      return done({
        mode,
        subject,
        proposed: proposal.input,
        reasoning: proposal.reasoning,
      });
    }

    let verdict: JewelVerdict;
    if (config.grade) {
      try {
        verdict = normalizeVerdict(
          await config.grade({ proposed: proposal.input, actual: actual as I }),
        );
      } catch (e) {
        verdict = { verdict: 'skip', notes: `grade threw: ${errorInfo(e).message}` };
      }
    } else {
      verdict = deepEqual(proposal.input, actual)
        ? { verdict: 'agree' }
        : { verdict: 'disagree' };
    }

    return done({
      mode,
      subject,
      proposed: proposal.input,
      reasoning: proposal.reasoning,
      actual,
      verdict: verdict.verdict,
      ...(verdict.notes !== undefined ? { notes: verdict.notes } : {}),
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
