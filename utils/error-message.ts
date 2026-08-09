import {
  isMyAgentsAPIError,
  type MyAgentsAPIError,
} from "@/services/my-agents/MyAgentsAPIError";
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
 * Copy is therefore chosen by the backend's machine-readable `code` where one
 * is present, falling back to the HTTP status. The backend's `detail` is never
 * rendered: it is English prose, so surfacing it puts "(Invalid credentials)"
 * inside an otherwise Korean sentence.
 *
 * The `code` field is the contract requested in `docs/backend-requests.md` and
 * implemented backend-side. Reading it is deliberately defensive — an absent or
 * unrecognized code falls through to status-based copy, so this behaves exactly
 * as before against any backend that does not send one.
 */

/** Codes worth distinguishing from their HTTP status. */
function copyForCode(
  code: string | undefined,
  errors: Localization["errors"],
): string | undefined {
  if (!code) return undefined;
  return (errors.byCode as Record<string, string> | undefined)?.[code];
}

/**
 * Reads `code` off the parsed error body without changing any response model.
 * `MyAgentsAPIError` already retains the raw body.
 */
function errorCodeOf(error: MyAgentsAPIError): string | undefined {
  const body = error.body;
  if (!body || typeof body !== "object") return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

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
  /**
   * Copy for when the backend gives no specific code, supplied by a caller that
   * knows what the user was trying to do.
   *
   * Status-based copy is context-blind, and that shows. Requesting guest access
   * returns 403 with the category code `permission_denied`, which rendered as
   * "이 작업을 할 권한이 없습니다" — permission framing aimed at someone who had
   * just typed their email into a form. A specific `byCode` match still wins;
   * this only replaces the generic status line.
   */
  fallbackDescription?: string,
): string {
  if (isMyAgentsAPIError(error)) {
    return (
      copyForCode(errorCodeOf(error), localization.errors) ??
      fallbackDescription ??
      copyForStatus(error.status, localization.errors)
    );
  }
  if (fallbackDescription && !(error instanceof TypeError)) {
    return fallbackDescription;
  }

  // A network failure surfaces as a plain TypeError with no useful public text.
  if (error instanceof TypeError) {
    return localization.errors.byStatus.network;
  }

  // Everything else — zod parse failures, unexpected throws — is deliberately
  // collapsed to generic copy. The raw message is never user-facing.
  return localization.status.defaultErrorDescription;
}
