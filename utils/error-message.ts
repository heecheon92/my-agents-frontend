import { isMyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";
import { defaultLocalization, type Localization } from "@/utils/localization";

/**
 * Turns an unknown thrown value into copy that is safe to show a user.
 *
 * `AGENTS.md`: "Never display raw provider errors, stack traces, session IDs,
 * CSRF tokens, or hidden chain-of-thought." Rendering `error.message` directly
 * violated that in two ways:
 *
 *  - For non-API failures (zod parse errors, `TypeError: Failed to fetch`) the
 *    message is raw technical text that means nothing to a user and can carry
 *    internal field paths.
 *  - For API failures the message is the backend's `detail`, which is English
 *    prose rendered inside a Korean UI.
 *
 * The HTTP status therefore drives fully localized copy, and the backend
 * `detail` is not rendered at all.
 *
 * Dropping `detail` is a deliberate trade. `DESIGN.md` allows showing a safe
 * backend `{ detail }`, but the backend writes it in English, so surfacing it
 * puts "(Invalid credentials)" inside an otherwise Korean sentence — which is
 * both worse copy and worse localization than saying nothing. It also costs
 * specificity: a guest hitting a prompt limit now reads generic 403 copy.
 *
 * The fix is a stable machine-readable `code` alongside `detail`, which this
 * module can map to Korean the same way it maps status. That is recorded in
 * `docs/backend-requests.md`; until it lands, generic-but-correct Korean beats
 * specific-but-English.
 */

function copyForStatus(status: number, errors: Localization["errors"]) {
  const byStatus = errors.byStatus;
  if (status === 401) return byStatus.unauthorized;
  if (status === 403) return byStatus.forbidden;
  if (status === 404) return byStatus.notFound;
  if (status === 409) return byStatus.conflict;
  if (status === 413) return byStatus.payloadTooLarge;
  if (status === 422) return byStatus.unprocessable;
  if (status === 429) return byStatus.tooManyRequests;
  if (status >= 500) return byStatus.server;
  // 0 is what the fetch client reports when no response arrived at all.
  if (status === 0) return byStatus.network;
  return byStatus.unknown;
}

export function resolveErrorMessage(
  error: unknown,
  localization: Localization = defaultLocalization,
): string {
  if (isMyAgentsAPIError(error)) {
    return copyForStatus(error.status, localization.errors);
  }

  // A network failure surfaces as a plain TypeError with no useful public text.
  if (error instanceof TypeError) {
    return localization.errors.byStatus.network;
  }

  // Everything else — zod parse failures, unexpected throws — is deliberately
  // collapsed to generic copy. The raw message is never user-facing.
  return localization.status.defaultErrorDescription;
}
