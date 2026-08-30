/**
 * The `email` namespace: send, read and manage your app's OWN outbound email.
 *
 * `email.send()` is the send path. The older `mindstudio.sendEmail({...})` action
 * still works and shares exactly the same implementation, so nothing breaks — but
 * `send()` is the one to reach for: it returns a proper receipt (including the
 * `batchId` you read stats back with) and it lives alongside everything you do
 * with the result.
 *
 * The rest of the namespace is everything *after* the send: what happened to each
 * message, how a campaign performed, and who has unsubscribed.
 *
 * The point is that you can build your own email admin screen inside your own app
 * and never open the MindStudio dashboard. So this deliberately includes the
 * suppression writes, not just reads — anything the dashboard can do to your app's
 * unsubscribe list, this can do too.
 *
 * Every call is scoped to the executing app by its request token; there is no
 * appId parameter and no way to read or send as another app.
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

/**
 * How a message body is interpreted.
 *
 * `auto` (the default) sniffs it: something that looks like HTML is sent as HTML,
 * anything else is rendered from Markdown. Every message goes out multipart with a
 * plain-text alternative derived from the body, which mail providers reward.
 */
export type EmailBodyType = 'auto' | 'html' | 'markdown' | 'text';

export interface EmailAttachmentInput {
  url: string;
  /** Displayed filename. Derived from the URL when omitted. */
  filename?: string;
  contentType?: string;
}

export interface EmailSendOptions {
  /** Visible recipients. Optional only if you supply `cc` or `bcc`. */
  to?: string | string[];
  cc?: string | string[];
  /**
   * Hidden recipients. With no `to`/`cc`, the To: header is addressed to your
   * app's own sender — the standard "undisclosed recipients" pattern — so
   * recipients can't see each other.
   */
  bcc?: string | string[];

  subject: string;
  /** Plain text, Markdown, or HTML. See {@link EmailBodyType}. */
  body: string;
  bodyType?: EmailBodyType;
  /** Your own plain-text alternative, instead of the auto-derived one. */
  text?: string;
  attachments?: Array<string | EmailAttachmentInput>;

  /**
   * Sender handle — only if your app has a custom domain or platform subdomain.
   * `"support"`, `"support@your-domain.com"`, or `"Name <support@your-domain.com>"`.
   * The domain must be one your app owns or the send fails.
   */
  from?: string;
  replyTo?: string;

  /** Message-ID this replies to, for threading in a shared inbox. */
  inReplyTo?: string;
  /** Prior Message-IDs in the thread. */
  references?: string[];

  /**
   * **Defaults to `marketing`**, which is the consequential choice here.
   *
   * `marketing` attaches a one-click unsubscribe header pointing at your own
   * domain and skips anyone who previously unsubscribed from your app. Because
   * that link is per-recipient, a marketing send delivers one separate message per
   * recipient and `cc`/`bcc` are folded into that list — so they come back empty.
   *
   * `transactional` is for receipts, alerts and password resets: no unsubscribe
   * header, the unsubscribe list is ignored, and `cc`/`bcc` stay on one shared
   * message. Use it whenever cc/bcc semantics actually matter.
   */
  category?: 'transactional' | 'marketing';

  /**
   * Groups this send's per-recipient rows into one blast. Pass your own campaign
   * id (1–64 printable chars) to join our delivery stats onto your own tables with
   * no mapping; one is generated when omitted, and it's always returned.
   */
  batchId?: string;
}

export interface EmailSendResult {
  /** Addresses the message went to. */
  recipients: string[];
  /** Always empty for a marketing send — see `category`. */
  cc: string[];
  /** Always empty for a marketing send — see `category`. */
  bcc: string[];
  /** The resolved sender it went out as. */
  from: string;
  /**
   * Recipients skipped because they had unsubscribed from your app. **Not an
   * error** — the send succeeded and we honoured their opt-out. Always empty for
   * a transactional send.
   *
   * Worth surfacing to whoever triggered the send: "sent to 48 of 50, 2
   * unsubscribed" is the honest report, and silence here is what makes people
   * think mail vanished.
   */
  suppressed: string[];
  /** Read stats back with `email.batch(batchId)`. */
  batchId: string;
}

/** Your app's sending allowance for the current window. */
export interface EmailQuota {
  /** What the numbers count — `recipients`. */
  unit: string;
  window: 'day' | 'month' | 'total';
  /** `null` means unlimited. */
  limit: number | null;
  used: number;
  /** `null` when `limit` is null. */
  remaining: number | null;
  /** When `used` resets. */
  resetsAt: string | null;
}

export type EmailTransport = (op: string, body: unknown) => Promise<any>;

export interface Email {
  /**
   * Send an email.
   *
   * Two things to know before your first call. **`category` defaults to
   * `marketing`**, which fans a multi-recipient send out into one message each and
   * empties `cc`/`bcc` — pass `'transactional'` for receipts, alerts and codes.
   * And a non-empty `suppressed` in the result is a **success**, not a failure: it
   * lists people who had unsubscribed and were therefore skipped.
   *
   * Delivery is synchronous today: this resolves once the mail has been handed to
   * the provider, so a large marketing list takes a while. Outcomes (delivered,
   * bounced, complained) arrive later — read them with
   * `email.messages({ batchId })`.
   *
   * @example
   * ```ts
   * // A receipt: one message, cc preserved, no unsubscribe header.
   * await email.send({
   *   to: 'customer@example.com',
   *   cc: 'billing@your-co.com',
   *   subject: 'Your receipt',
   *   body: '# Thanks!\n\nOrder #1234 is confirmed.',
   *   category: 'transactional',
   * });
   *
   * // A campaign: per-recipient unsubscribe, your own id for joining stats.
   * const { suppressed, batchId } = await email.send({
   *   to: subscribers,
   *   subject: 'August newsletter',
   *   body: markdown,
   *   batchId: 'newsletter-2026-08',
   * });
   * console.log(`skipped ${suppressed.length} unsubscribed`);
   * const stats = await email.batch(batchId);
   * ```
   */
  send(options: EmailSendOptions): Promise<EmailSendResult>;
  /**
   * Your app's sending allowance and how much is left.
   *
   * Useful before a large send: check `remaining` and split the list rather than
   * discovering the limit as a failure partway through. Going over throws with
   * `outbound_daily_cap_exceeded`.
   */
  quota(): Promise<EmailQuota>;
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
    send(options) {
      return call('send', options);
    },
    quota() {
      return call('quota', {});
    },
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
