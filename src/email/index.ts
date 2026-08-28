/**
 * The `email` namespace: read and manage your app's OWN outbound email.
 *
 * Sending is not here — that's the `sendEmail` action
 * (`mindstudio.sendEmail({...})`). This namespace is everything *after* the send:
 * what happened to each message, how a campaign performed, and who has
 * unsubscribed.
 *
 * The point is that you can build your own email admin screen inside your own app
 * and never open the MindStudio dashboard. So this deliberately includes the
 * suppression writes, not just reads — anything the dashboard can do to your app's
 * unsubscribe list, this can do too.
 *
 * Every call is scoped to the executing app by its request token; there is no
 * appId parameter and no way to read another app's mail.
 */

/** Where a message got to. See `EmailMessage.status`. */
export type EmailMessageStatus =
  /** Recipient had unsubscribed — never handed to the provider. */
  | 'suppressed'
  /** Failed before the provider: daily cap, sender not allowed, bad address. */
  | 'failed'
  /** The provider accepted it. */
  | 'sent'
  /** The receiving mail server accepted it. NOT "landed in the inbox". */
  | 'delivered'
  /**
   * Dropped by the platform-wide suppression list — usually because of a hard
   * bounce recorded against this address for ANOTHER app. Not a sign that your
   * app did anything wrong, and it doesn't count toward your bounce rate.
   */
  | 'blocked'
  | 'bounced'
  | 'complained'
  | 'delayed'
  | 'rejected';

/** `method` = your app's `sendEmail` calls; `auth` = platform sign-in codes. */
export type EmailMessageKind = 'method' | 'auth';

export interface EmailMessage {
  id: string;
  recipient: string;
  status: EmailMessageStatus;
  category: string;
  kind: EmailMessageKind;
  subject: string | null;
  fromAddress: string | null;
  methodId: string | null;
  /** The blast this message was part of, if any. */
  batchId: string | null;
  /** Provider diagnostics — for a bounce, includes the SMTP reason. */
  diagnostic: Record<string, unknown> | null;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  delayedAt: string | null;
  rejectedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface EmailStats {
  counts: Record<EmailMessageStatus, number>;
  /**
   * Messages the provider accepted — the denominator behind every rate below.
   *
   * Worth checking before you render a percentage: 1 bounce out of 10 sends is a
   * 10% bounce rate, and showing that next to the 5% industry review threshold
   * alarms someone over a sample of ten. Below ~50 accepted, show counts instead.
   */
  accepted: number;
  rates: {
    bounceRate: number;
    complaintRate: number;
    deliveredRate: number;
  };
  byKind: Record<EmailMessageKind, number>;
  /** Bucketed counts over the window, for charting. */
  series: Array<{ t: string; counts: Record<string, number> }>;
}

/**
 * One blast, aggregated.
 *
 * `recipients` counts every row including those never handed to the provider;
 * `accepted` counts only those it took, and is the honest denominator for a rate.
 */
export interface EmailBatch {
  batchId: string;
  subject: string | null;
  startedAt: string;
  recipients: number;
  accepted: number;
  counts: Record<EmailMessageStatus, number>;
}

export interface EmailSuppression {
  id: string;
  email: string;
  /**
   * How the address ended up suppressed.
   *
   * `one_click` — the RFC 8058 one-click button in their mail client.
   * `link` — the visible unsubscribe link in the message body.
   * `owner` — you added them (dashboard, CLI, or `suppress()`).
   * `complaint` — the receiving provider reported it as spam.
   */
  source: 'one_click' | 'link' | 'owner' | 'complaint';
  createdAt: string;
}

/**
 * An address on the PLATFORM's suppression list, which is separate from your
 * app's. Populated automatically on hard bounces and complaints, shared across the
 * whole platform, and never cleared — re-sending to a hard-bounced address would
 * spend sending reputation belonging to everyone.
 *
 * So when this is non-null after an `unsuppress`, the address is off *your* list
 * but mail to it is still blocked. Tell the user that rather than reporting
 * success.
 */
export interface PlatformSuppression {
  /** `BOUNCE` or `COMPLAINT`. */
  reason: string;
  at: string | null;
}

export interface UnsuppressResult {
  ok: true;
  /** False when the address wasn't on your list to begin with. */
  removed: boolean;
  platformSuppression: PlatformSuppression | null;
}

export interface EmailListOptions {
  statuses?: EmailMessageStatus[];
  kind?: EmailMessageKind;
  category?: 'transactional' | 'marketing';
  methodId?: string;
  /** Exact address match — the fast path, and the one to use for a support lookup. */
  recipient?: string;
  /** One blast. */
  batchId?: string;
  /** Contains-match over recipient and subject. Bounded, and not paginated. */
  search?: string;
  start?: string | Date;
  end?: string | Date;
  sort?: 'newest' | 'oldest';
  cursor?: string;
  /** Ignored when `cursor` is set — the cursor is the precise mechanism. */
  offset?: number;
  limit?: number;
}

export interface EmailWindowOptions {
  start?: string | Date;
  end?: string | Date;
}

export type EmailTransport = (op: string, body: unknown) => Promise<any>;

export interface Email {
  /** Counts, rates and a timeseries over a window (default: last 24h). */
  stats(
    options?: EmailWindowOptions & { buckets?: number },
  ): Promise<EmailStats>;
  /**
   * The per-recipient delivery log, newest first.
   *
   * Includes messages that never reached the provider — unsubscribed, over the
   * daily cap, sender not allowed — which is where most "it didn't send" reports
   * actually land. Nothing is filtered by default, deliberately: defaulting to
   * your app's own mail would make a lookup for a missing sign-in code come back
   * empty.
   */
  messages(
    options?: EmailListOptions,
  ): Promise<{ messages: EmailMessage[]; nextCursor: string | null }>;
  /** One message, including bounce diagnostics. */
  message(messageId: string): Promise<EmailMessage>;
  /** One row per blast, newest first. */
  batches(
    options?: EmailWindowOptions & { limit?: number; offset?: number },
  ): Promise<{ batches: EmailBatch[]; total: number }>;
  /** Stats for a single blast — the id you passed to `sendEmail`, or the one it returned. */
  batch(batchId: string): Promise<EmailBatch>;
  /** Your app's unsubscribe list, newest first. */
  suppressions(options?: {
    cursor?: string;
    /** Ignored when `cursor` is set. */
    offset?: number;
    limit?: number;
  }): Promise<{
    suppressions: EmailSuppression[];
    nextCursor: string | null;
    total: number;
  }>;
  /** Add an address to your app's unsubscribe list. Idempotent. */
  suppress(email: string): Promise<{ ok: true }>;
  /**
   * Remove an address from your app's unsubscribe list.
   *
   * Check `platformSuppression` on the result before telling anyone mail will now
   * reach them — see {@link PlatformSuppression}.
   */
  unsuppress(email: string): Promise<UnsuppressResult>;
}

const iso = (v: string | Date | undefined): string | undefined =>
  v === undefined ? undefined : v instanceof Date ? v.toISOString() : v;

/**
 * Create an Email namespace bound to a transport.
 *
 * @internal Called by MindStudioAgent; not part of the public API — access
 * `email` via the agent instance or the top-level export.
 */
export function createEmail(call: EmailTransport): Email {
  return {
    stats(options) {
      return call('stats', {
        start: iso(options?.start),
        end: iso(options?.end),
        buckets: options?.buckets,
      });
    },
    messages(options) {
      return call('messages', {
        ...options,
        start: iso(options?.start),
        end: iso(options?.end),
      });
    },
    message(messageId) {
      return call('message', { messageId });
    },
    batches(options) {
      return call('batches', {
        start: iso(options?.start),
        end: iso(options?.end),
        limit: options?.limit,
        offset: options?.offset,
      });
    },
    batch(batchId) {
      return call('batch', { batchId });
    },
    suppressions(options) {
      return call('suppressions', options ?? {});
    },
    suppress(email) {
      return call('suppress', { email });
    },
    unsuppress(email) {
      return call('unsuppress', { email });
    },
  };
}
