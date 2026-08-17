/**
 * Type → renderer lookup for durable interactions.
 *
 * The backend's interaction contract is protocol-neutral: it names *what* it
 * needs from the user (a document choice) and never names a widget. This module
 * is the frontend half of that boundary — the only place a wire `type` becomes
 * a component. Adding a second interaction type should be one entry here plus
 * one component, with no change to the run loop or the composer.
 *
 * Deliberately not a plugin system: a plain record and a lookup. One entry does
 * not justify dynamic imports, and the registry's job today is to make the
 * *second* entry cheap, not to be extensible in the abstract.
 *
 * Pure and generic over the renderer type so it can be unit-tested without a
 * DOM, and so it commits to no payload shape before the wire contract is
 * confirmed against the backend's OpenAPI document.
 */

/**
 * The interaction protocol major version this build understands.
 *
 * Pinned as a constant so the mismatch is a single visible fact rather than a
 * behaviour spread across parse sites. A backend that ships a new major must
 * fail loudly here — the fallback tells the user to reload for a newer app —
 * rather than quietly rendering a card with fields it cannot read.
 */
export const SUPPORTED_INTERACTION_PROTOCOL_MAJOR = 1;

export type InteractionSupport =
  /** This build can render it. */
  | { support: "supported"; type: string }
  /** Protocol understood, but this build has no renderer for that type. */
  | { support: "unsupported_type"; type: string }
  /**
   * Protocol major is newer (or older) than this build. Distinguished from an
   * unknown type because the user-facing remedy differs: reload for a new app
   * version, versus nothing the user can do.
   */
  | { support: "unsupported_version"; type: string; major: number };

export function classifyInteraction(
  { type, major }: { type: string; major: number },
  knownTypes: ReadonlySet<string> | ReadonlyArray<string>,
): InteractionSupport {
  if (major !== SUPPORTED_INTERACTION_PROTOCOL_MAJOR) {
    return { support: "unsupported_version", type, major };
  }
  // `Array.isArray`, not `instanceof Set`: the latter does not narrow a
  // `ReadonlySet<string> | ReadonlyArray<string>` union for TypeScript.
  const known = Array.isArray(knownTypes)
    ? knownTypes.includes(type)
    : (knownTypes as ReadonlySet<string>).has(type);
  return known
    ? { support: "supported", type }
    : { support: "unsupported_type", type };
}

/**
 * Resolves a renderer, always returning something.
 *
 * Never returns `undefined`. An unrenderable interaction must still produce a
 * card, because the run behind it is suspended: with no card there is no
 * cancel affordance, and the conversation is unusable until the interaction
 * expires — which defaults to 24 hours server-side. Failing to a visible
 * dead-end is recoverable; failing to nothing is not.
 */
export function resolveInteractionRenderer<TRenderer>(
  registry: Readonly<Record<string, TRenderer>>,
  type: string,
  fallback: TRenderer,
): TRenderer {
  // `Object.hasOwn`, not `registry[type] ?? fallback`. The type string comes
  // from the backend, and a plain object literal answers "constructor" and
  // "toString" with inherited members — truthy values that are not renderers
  // and would be handed straight to React.
  return Object.hasOwn(registry, type) ? registry[type] : fallback;
}

export function registeredInteractionTypes<TRenderer>(
  registry: Readonly<Record<string, TRenderer>>,
): string[] {
  return Object.keys(registry);
}
