"use client";

import type * as React from "react";
import { Field, selectClassName } from "@/components/Field";
import type { Pill } from "@/components/Status";
import { i18n } from "@/i18n.config";
import { cn } from "@/lib/utils";

export type GroupRole = "owner" | "admin" | "editor" | "viewer";
export type PublishSourceKind = "document" | "knowledge-base";
export type DocumentDestination = "personal" | "team" | "system";
export type StatusTone = NonNullable<React.ComponentProps<typeof Pill>["tone"]>;

export type GroupManagementSection =
  | "members"
  | "invitations"
  | "source-spaces"
  | "publish-requests";

export function fileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return "";
  return fileName.slice(lastDot).toLowerCase();
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats a backend ISO timestamp for display.
 *
 * Group rows rendered `created_at` and `expires_at` straight through, so users
 * saw `2026-06-01T00:00:00.000Z` next to a member's name. Invalid or missing
 * values return an empty string rather than `Invalid Date`.
 */
export function formatDateTime(
  value: string | null | undefined,
  locale: string = i18n.defaultLocale,
) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function knowledgeSourceHref(sourceId: string) {
  return `/knowledge/${encodeURIComponent(sourceId)}`;
}

export function groupHref(groupId: string) {
  return `/groups/${encodeURIComponent(groupId)}`;
}

export function groupManagementHref(
  groupId: string,
  section: GroupManagementSection,
) {
  return `${groupHref(groupId)}/${section}`;
}

export function decodeRouteSegment(segment?: string) {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function extractionRunTone(status: string): StatusTone {
  if (status === "completed") return "green";
  if (status === "failed") return "rose";
  if (status === "pending") return "amber";
  return "blue";
}

export function isActiveExtractionRunStatus(status: string) {
  return status === "pending" || status === "running";
}

/**
 * Turns a backend extraction stage into readable copy.
 *
 * The ingestion history rendered `run.stage` directly, so a Korean UI showed
 * `chunking` and `embedding`. Same problem as the activity event types, and the
 * same shape of fix: a label map with a fallback, so a stage added server-side
 * degrades to a de-snaked phrase instead of leaking the raw enum.
 */
export function describeExtractionStage(
  stage: string | null | undefined,
  localization: { documents: { stages: Record<string, string> } },
) {
  if (!stage) return "";
  const known = localization.documents.stages[stage];
  if (known) return known;
  const humanized = stage.replace(/_/g, " ").trim();
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

export function InlineLoadingIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-cal-muted">
      <span
        aria-hidden="true"
        className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
      />
      {label}
    </span>
  );
}

export function invitationStatusTone(status: string): StatusTone {
  if (status === "accepted") return "green";
  if (status === "cancelled" || status === "expired") return "rose";
  return "amber";
}

export function RoleSelect({
  label,
  labels,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  labels: Record<GroupRole, string>;
  value: GroupRole;
  onChange: (value: GroupRole) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <select
        className={selectClassName}
        value={value}
        onChange={(event) => onChange(event.target.value as GroupRole)}
        disabled={disabled}
      >
        {Object.entries(labels).map(([role, roleLabel]) => (
          <option key={role} value={role}>
            {roleLabel}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PageCard({
  title,
  description,
  children,
  fullWidth = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-6",
        fullWidth ? "w-full max-w-none" : "mx-auto max-w-6xl",
      )}
    >
      <header>
        <h1 className="cal-heading cal-fluid-title">{title}</h1>
        <p className="cal-subcopy mt-3 max-w-3xl">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function documentMeta(
  doc: {
    knowledge_base_id: string | null;
    source_type?: string;
    source_filename?: string | null;
    source_page_count?: number | null;
  },
  localization: {
    documents: {
      pdfSourcePrefix: string;
      pdfSource: string;
      markdownSourcePrefix: string;
      markdownSource: string;
      uploadedTextSourcePrefix: string;
      uploadedTextSource: string;
      spreadsheetSourcePrefix: string;
      spreadsheetSource: string;
      presentationSourcePrefix: string;
      presentationSource: string;
      wordSourcePrefix: string;
      wordSource: string;
      textSource: string;
      pagesLabel: string;
    };
  },
) {
  const source = documentSourceLabel(doc, localization.documents);
  const pages = doc.source_page_count
    ? ` · ${doc.source_page_count} ${localization.documents.pagesLabel}`
    : "";
  return `${source}${pages}`;
}

/**
 * The parts of a document's metadata that `documentSourceLabel` does *not*
 * already say.
 *
 * The sources table rendered `documentSourceLabel` in its Type column and
 * `documentMeta` in its Details column — but `documentMeta` is
 * `documentSourceLabel` plus the page count, so the two columns printed the
 * same filename twice. This returns only the remainder, for surfaces that show
 * both.
 */
export function documentSecondaryMeta(
  doc: {
    source_page_count?: number | null;
    source_byte_size?: number | null;
  },
  localization: { documents: { pagesLabel: string } },
) {
  const parts: string[] = [];
  if (doc.source_page_count) {
    parts.push(`${doc.source_page_count} ${localization.documents.pagesLabel}`);
  }
  if (doc.source_byte_size) parts.push(formatFileSize(doc.source_byte_size));
  return parts.join(" · ");
}

export function documentSourceLabel(
  doc: {
    source_type?: string;
    source_filename?: string | null;
  },
  localization: {
    pdfSourcePrefix: string;
    pdfSource: string;
    markdownSourcePrefix: string;
    markdownSource: string;
    uploadedTextSourcePrefix: string;
    uploadedTextSource: string;
    spreadsheetSourcePrefix: string;
    spreadsheetSource: string;
    presentationSourcePrefix: string;
    presentationSource: string;
    wordSourcePrefix: string;
    wordSource: string;
    textSource: string;
  },
) {
  const extension = doc.source_filename
    ? fileExtension(doc.source_filename)
    : "";
  if (doc.source_type === "pdf") {
    return doc.source_filename
      ? `${localization.pdfSourcePrefix} ${doc.source_filename}`
      : localization.pdfSource;
  }
  if (doc.source_type === "markdown") {
    return doc.source_filename
      ? `${localization.markdownSourcePrefix} ${doc.source_filename}`
      : localization.markdownSource;
  }
  if (doc.source_type === "spreadsheet" || extension === ".xlsx") {
    return doc.source_filename
      ? `${localization.spreadsheetSourcePrefix} ${doc.source_filename}`
      : localization.spreadsheetSource;
  }
  if (doc.source_type === "presentation" || extension === ".pptx") {
    return doc.source_filename
      ? `${localization.presentationSourcePrefix} ${doc.source_filename}`
      : localization.presentationSource;
  }
  if (doc.source_type === "word_document" || extension === ".docx") {
    return doc.source_filename
      ? `${localization.wordSourcePrefix} ${doc.source_filename}`
      : localization.wordSource;
  }
  if (doc.source_filename) {
    return `${localization.uploadedTextSourcePrefix} ${doc.source_filename}`;
  }
  if (doc.source_type === "text" && doc.source_filename) {
    return localization.uploadedTextSource;
  }
  return localization.textSource;
}
