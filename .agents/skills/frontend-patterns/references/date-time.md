# Date and time

## When to use

Classify a value before formatting it:

- an **instant** identifies one point on the global timeline and must carry an
  offset or epoch value;
- a **date-only** value is a calendar label such as a birthday or service day
  and must not shift when the viewer changes time zone;
- a **duration** is elapsed or planned time, not a timestamp.

Use a small pure formatter at a leaf when the product has already supplied an
explicit locale, display time zone, and fallback. The example handles all three
shapes without turning date-only values into local-midnight instants.

## Do not use

- Do not parse `2026-09-21` as an instant or append a guessed product time zone.
- Do not accept an offset-less timestamp such as `2026-09-21T09:00:00` as an
  instant; its meaning is ambiguous.
- Do not use a duration as a clock time or a `Date`.
- Do not silently substitute the browser locale/time zone or a company-wide
  time zone.
- Do not import a whole date utility namespace for `Intl` behavior the platform
  already provides.

## Required product decisions

The product must choose:

- the locale and IANA time zone for instant display;
- whether an API field is an instant, date-only value, or duration;
- the exact empty/invalid fallback copy;
- date/time styles, 12/24-hour policy, and whether seconds are visible;
- the duration unit, rounding, sign policy, and precision;
- whether malformed upstream data is only displayed as fallback or also
  reported through an owning observability boundary.

The medium date, short time, nonnegative duration, selected duration unit, and
one decimal place below are example-only presentation choices.

## Stable guarantees

- The function is pure and receives locale, time zone, and fallback explicitly.
- Missing, malformed, non-finite, and impossible-calendar inputs return the
  supplied fallback rather than throwing.
- Instant strings use the example's explicit ISO subset: complete date and
  time, optional millisecond precision, and `Z` or a colonized numeric offset.
  Offset-less timestamps and calendar overflow are rejected before `Date`.
- A structurally invalid locale or invalid instant time zone falls back when
  `Intl` throws. A valid but unavailable locale may use `Intl` locale
  negotiation instead; supported locales remain a caller decision.
- Date-only values are validated by calendar parts and formatted in UTC solely
  to preserve those parts; the product display time zone does not shift them.
- Durations use locale-aware number/unit formatting and never pass through
  `Date`.
- The implementation uses platform `Intl` only; utility promotion remains
  conditional on proven repetition.

## Complete example

```ts
export type TemporalValue =
  | { kind: "instant"; value: string | number | Date }
  | { kind: "date-only"; value: string }
  | { kind: "duration"; milliseconds: number };

export type DurationUnit = "second" | "minute" | "hour";

export type TemporalFormatOptions = {
  locale: string;
  timeZone: string;
  fallback: string;
  durationUnit: DurationUnit;
};

const instantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/;
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const millisecondsPerUnit: Record<DurationUnit, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
};

function parseDateOnly(value: string): Date | null {
  const match = dateOnlyPattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseInstant(value: string | number | Date): Date | null {
  if (typeof value !== "string") {
    const date =
      value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  const match = instantPattern.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] =
    match;
  const dateIsValid = parseDateOnly(`${year}-${month}-${day}`) !== null;
  const timeIsValid =
    Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59;
  const offsetIsValid =
    offsetHour === undefined ||
    (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59);
  if (!dateIsValid || !timeIsValid || !offsetIsValid) return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatTemporalValue(
  value: TemporalValue | null | undefined,
  options: TemporalFormatOptions,
): string {
  if (!value) return options.fallback;

  try {
    if (value.kind === "instant") {
      const instant = parseInstant(value.value);
      if (!instant) return options.fallback;

      return new Intl.DateTimeFormat(options.locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: options.timeZone,
      }).format(instant);
    }

    if (value.kind === "date-only") {
      const date = parseDateOnly(value.value);
      if (!date) return options.fallback;

      return new Intl.DateTimeFormat(options.locale, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
    }

    if (!Number.isFinite(value.milliseconds) || value.milliseconds < 0) {
      return options.fallback;
    }

    const amount = value.milliseconds / millisecondsPerUnit[options.durationUnit];
    return new Intl.NumberFormat(options.locale, {
      style: "unit",
      unit: options.durationUnit,
      unitDisplay: "short",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return options.fallback;
  }
}
```

The exported API is `formatTemporalValue(value, options)`, plus its discriminated
value/options types. Callers must pass options such as their localization
locale, chosen display zone, translated fallback, and product-selected duration
unit; the example does not declare a project-wide time-zone default.

## Alternatives

- Use a narrow `date-fns` import for calendar arithmetic or parsing only when
  that behavior is actually required; keep `Intl` for locale-aware output.
- Use the Temporal API or a deliberately selected library when the supported
  runtime baseline and domain require zoned arithmetic, recurrence, or
  daylight-saving disambiguation.
- Keep one-off formatting local. Promote a production helper only after multiple
  real call sites share the same value contract and presentation decisions.

## Verification

Exercise the pure export with fixed inputs and assert:

- the same instant (`2026-09-21T00:30:00Z`) renders differently in `UTC` and
  `Asia/Seoul`, while representing the same point in time;
- `2026-09-21` remains September 21 under both zones;
- leap day `2024-02-29` succeeds, while `2025-02-29`, `2026-13-01`, and partial
  date strings return the supplied fallback;
- offset-less timestamps, calendar-overflow instants such as
  `2026-02-30T00:00:00Z`, invalid `Date` objects, malformed strings, `NaN`, and
  infinities return the fallback;
- zero and fractional positive durations format in the selected unit, while a
  negative duration falls back;
- absent input and a structurally invalid locale return exactly the supplied
  fallback, and an invalid instant time zone does the same;
- formatting does not mutate a caller-owned `Date`.
