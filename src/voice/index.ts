/**
 * The `voice` namespace — telephony actions for apps with a voice interface.
 *
 * `voice.call()` places an outbound phone call: the platform dials the
 * number and connects the callee to your app's voice agent (the persona,
 * engine, and tools from `src/interfaces/voice.md`). The method that invokes
 * it is the authorization gate — the voice interface's own `auth` block does
 * not apply to calls your backend places deliberately.
 *
 * ```ts
 * // routes/notifyOrderShipped.ts
 * import { voice, auth } from '@mindstudio-ai/agent';
 *
 * export async function notifyOrderShipped(input: { phone: string }) {
 *   auth.requireRole('member');
 *   const call = await voice.call({ to: input.phone, assumeIdentity: true });
 *   return { calling: call.to, from: call.from };
 * }
 * ```
 *
 * **Identity.** With `assumeIdentity: true` the call session runs as the user
 * who invoked this method — the agent's Current User block and every tool
 * call carry that user's identity and roles, exactly as if they'd opened the
 * voice interface themselves. The identity comes from the platform's own
 * execution context, never from arguments. System/cron invocations have no
 * human identity and run the call anonymously. Omitted or `false`: anonymous
 * session (role-gated tools decline).
 *
 * **Current status: dev sessions only.** Deployed apps need a dedicated
 * phone number (coming soon); until then `call()` from a production app
 * throws `phone_out_requires_dedicated_number`. Caller ID is a shared
 * platform pool number that varies per call — tell callees to expect an
 * unfamiliar number.
 *
 * **Limits.** Per-app: concurrent-session policy, a daily outbound-call cap,
 * and a per-call duration ceiling. A number already on an active call with
 * this app can't be dialed again (`voice_callee_busy`).
 *
 * **Compliance.** Automated calls require the callee's prior consent — call
 * your own users who opted in to calls from this app, honor reasonable
 * calling hours, and never dial purchased/cold lists. You are responsible
 * for TCPA (and local-equivalent) compliance.
 */

/** Transport for the `voice` namespace. @internal */
export type VoiceTransport = (op: string, body: unknown) => Promise<any>;

/** The accepted outbound call, already dialing. */
export interface VoiceCallResult {
  /** The call record's session id (appears in the app's voice call log). */
  sessionId: string;
  status: 'dialing';
  /** The caller-ID number the callee sees. */
  from: string;
  /** The dialed number. */
  to: string;
}

/** The `voice` namespace object. */
export interface Voice {
  /**
   * Place an outbound call to `to` (E.164, e.g. `+13105551234`) and connect
   * the callee to this app's voice agent. Returns as soon as dialing starts;
   * the outcome (answered, busy, no answer) lands on the call record.
   */
  call(params: { to: string; assumeIdentity?: boolean }): Promise<VoiceCallResult>;
}

/**
 * Create a Voice namespace bound to a transport.
 *
 * @internal Called by MindStudioAgent; not part of the public API — access
 * `voice` via the agent instance or the top-level export.
 */
export function createVoice(call: VoiceTransport): Voice {
  return {
    async call(params: {
      to: string;
      assumeIdentity?: boolean;
    }): Promise<VoiceCallResult> {
      return (await call('call', {
        to: params.to,
        assumeIdentity: params.assumeIdentity === true,
      })) as VoiceCallResult;
    },
  };
}
