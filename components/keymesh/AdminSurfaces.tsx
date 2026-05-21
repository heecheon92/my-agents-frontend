"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useAddMember,
  useCreateGroup,
  useGroups,
  useUpdateMember,
} from "@/hooks/use-groups";
import {
  useCreateDocument,
  useCreateKnowledgeBase,
  useDeleteDocument,
  useDocuments,
  useExtractionRuns,
  useIngestDocument,
  useKnowledgeBases,
  usePatchDocumentPermission,
  useUploadDocument,
} from "@/hooks/use-knowledge";
import { useLocalization } from "@/hooks/useLocalization";
import { Field, inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

type GroupRole = "owner" | "admin" | "editor" | "viewer";

export function KnowledgeSurface() {
  const knowledgeBases = useKnowledgeBases();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const [name, setName] = useState("");
  const { localization } = useLocalization((state) => state.localization.admin);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await createKnowledgeBase.mutateAsync({ name, scope: "personal" });
      setName("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.knowledge.title}
      description={localization.knowledge.description}
    >
      <form
        onSubmit={handleSubmit}
        className="cal-card grid gap-3 rounded-xl p-4"
      >
        <Field label={localization.knowledge.nameLabel}>
          <input
            className={inputClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Button
          type="submit"
          disabled={createKnowledgeBase.isPending || !name.trim()}
        >
          {localization.knowledge.createButton}
        </Button>
        {createKnowledgeBase.error ? (
          <ErrorState error={createKnowledgeBase.error} />
        ) : null}
      </form>
      <ResourceList
        loading={knowledgeBases.isLoading}
        error={knowledgeBases.error}
        empty={localization.knowledge.empty}
      >
        {knowledgeBases.data?.map((kb) => (
          <ResourceRow
            key={kb.id}
            title={kb.name}
            subtitle={`${kb.scope} · ${kb.id}`}
            meta={
              kb.group_id
                ? `${localization.common.groupPrefix} ${kb.group_id.slice(0, 8)}`
                : localization.common.scopePersonal
            }
          />
        ))}
      </ResourceList>
    </PageCard>
  );
}

export function DocumentsSurface() {
  const documents = useDocuments();
  const createDocument = useCreateDocument();
  const uploadDocument = useUploadDocument();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const activeDocumentId = selectedDocumentId ?? documents.data?.[0]?.id;
  const extractionRuns = useExtractionRuns(activeDocumentId);
  const ingest = useIngestDocument(activeDocumentId);
  const deleteDocument = useDeleteDocument(activeDocumentId);
  const patchPermission = usePatchDocumentPermission(activeDocumentId);
  const [permissionUserId, setPermissionUserId] = useState("");
  const { localization } = useLocalization((state) => state.localization.admin);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createDocument.mutateAsync({ title, content });
      setTitle("");
      setContent("");
      setSelectedDocumentId(created.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) return;
    try {
      const uploaded = await uploadDocument.mutateAsync({
        title: uploadTitle,
        file: uploadFile,
      });
      setUploadTitle("");
      setUploadFile(null);
      event.currentTarget.reset();
      setSelectedDocumentId(uploaded.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleDeleteDocument() {
    if (!activeDocumentId) return;
    const selectedDocument = documents.data?.find(
      (document) => document.id === activeDocumentId,
    );
    const title = selectedDocument?.title ?? activeDocumentId;
    if (
      !window.confirm(
        localization.documents.deleteConfirm.replace("{title}", title),
      )
    ) {
      return;
    }

    try {
      const nextDocumentId = documents.data?.find(
        (document) => document.id !== activeDocumentId,
      )?.id;
      await deleteDocument.mutateAsync();
      setSelectedDocumentId(nextDocumentId);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handlePatchPermission(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      await patchPermission.mutateAsync({
        user_id: permissionUserId,
        can_read: true,
        can_write: false,
        can_manage: false,
        can_ingest: false,
      });
      setPermissionUserId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.documents.title}
      description={localization.documents.description}
    >
      <div className="responsive-panel">
        <div className="responsive-panel-grid" data-layout="form-aside">
          <div className="grid gap-4">
            <form
              onSubmit={handleCreate}
              className="cal-card grid gap-3 rounded-xl p-4"
            >
              <h2 className="font-semibold">
                {localization.documents.textCreateTitle}
              </h2>
              <Field label={localization.documents.titleLabel}>
                <input
                  className={inputClassName}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </Field>
              <Field
                label={localization.documents.contentLabel}
                hint={localization.documents.contentHint}
              >
                <textarea
                  className={`${inputClassName} min-h-40`}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                disabled={createDocument.isPending || !title.trim()}
              >
                {localization.documents.createButton}
              </Button>
              {createDocument.error ? (
                <ErrorState error={createDocument.error} />
              ) : null}
            </form>
            <form
              onSubmit={handleUpload}
              className="cal-card grid gap-3 rounded-xl p-4"
            >
              <h2 className="font-semibold">
                {localization.documents.fileUploadTitle}
              </h2>
              <Field
                label={localization.documents.fileTitleLabel}
                hint={localization.documents.fileUploadHint}
              >
                <input
                  className={inputClassName}
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  required
                />
              </Field>
              <Field label={localization.documents.fileLabel}>
                <input
                  className={inputClassName}
                  type="file"
                  accept="application/pdf,text/markdown,text/plain,.pdf,.md,.markdown,.txt"
                  onChange={(event) => {
                    setUploadFile(event.target.files?.[0] ?? null);
                  }}
                  required
                />
              </Field>
              <Button
                type="submit"
                disabled={
                  uploadDocument.isPending || !uploadTitle.trim() || !uploadFile
                }
              >
                {localization.documents.uploadButton}
              </Button>
              {uploadDocument.error ? (
                <ErrorState error={uploadDocument.error} />
              ) : null}
            </form>
          </div>
          <section className="cal-card rounded-xl p-4">
            <h2 className="font-semibold">
              {localization.documents.selectedActions}
            </h2>
            {activeDocumentId ? (
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {activeDocumentId}
              </p>
            ) : (
              <EmptyState
                title={localization.documents.noSelectedTitle}
                description={localization.documents.noSelectedDescription}
              />
            )}
            <Button
              className="mt-4 w-full"
              onClick={() => ingest.mutate()}
              disabled={!activeDocumentId || ingest.isPending}
            >
              {localization.documents.runIngest}
            </Button>
            {ingest.error ? (
              <div className="mt-3">
                <ErrorState error={ingest.error} />
              </div>
            ) : null}
            <form
              onSubmit={handlePatchPermission}
              className="mt-4 grid gap-3 border-t border-cal-hairline pt-4"
            >
              <Field
                label={localization.documents.permissionLabel}
                hint={localization.documents.permissionHint}
              >
                <input
                  className={inputClassName}
                  value={permissionUserId}
                  onChange={(event) => setPermissionUserId(event.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="outline"
                disabled={
                  !activeDocumentId ||
                  !permissionUserId.trim() ||
                  patchPermission.isPending
                }
              >
                {localization.documents.patchPermission}
              </Button>
            </form>
            {patchPermission.error ? (
              <div className="mt-3">
                <ErrorState error={patchPermission.error} />
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 border-t border-cal-hairline pt-4">
              <div>
                <h3 className="font-semibold">
                  {localization.documents.deleteTitle}
                </h3>
                <p className="mt-1 text-sm leading-6 text-cal-muted">
                  {localization.documents.deleteDescription}
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteDocument}
                disabled={!activeDocumentId || deleteDocument.isPending}
              >
                {localization.documents.deleteButton}
              </Button>
              {deleteDocument.error ? (
                <ErrorState error={deleteDocument.error} />
              ) : null}
            </div>
            <h3 className="mt-6 font-semibold">
              {localization.documents.extractionRuns}
            </h3>
            <div className="mt-3 grid gap-2">
              {extractionRuns.data?.length === 0 ? (
                <EmptyState
                  title={localization.documents.noExtractionRunsTitle}
                  description={
                    localization.documents.noExtractionRunsDescription
                  }
                />
              ) : null}
              {extractionRuns.data?.map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg bg-cal-surface-soft p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Pill tone="green">{run.status}</Pill>
                    <span>
                      {run.chunk_count} {localization.common.chunks}
                    </span>
                  </div>
                  <p className="mt-2 text-cal-body">
                    {run.entity_count} {localization.common.entities} ·{" "}
                    {run.relationship_count} {localization.common.relationships}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <ResourceList
        loading={documents.isLoading}
        error={documents.error}
        empty={localization.documents.empty}
      >
        {documents.data?.map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setSelectedDocumentId(doc.id)}
            className="text-left"
          >
            <ResourceRow
              title={doc.title}
              subtitle={doc.id}
              meta={documentMeta(doc, localization)}
              active={activeDocumentId === doc.id}
            />
          </button>
        ))}
      </ResourceList>
    </PageCard>
  );
}

export function GroupsSurface() {
  const groups = useGroups();
  const createGroup = useCreateGroup();
  const [name, setName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const activeGroupId = selectedGroupId ?? groups.data?.[0]?.id;
  const addMember = useAddMember(activeGroupId);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<GroupRole>("viewer");
  const [updateUserId, setUpdateUserId] = useState("");
  const [updateRole, setUpdateRole] = useState<GroupRole>("viewer");
  const updateMember = useUpdateMember(activeGroupId, updateUserId);
  const { localization } = useLocalization((state) => state.localization.admin);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const created = await createGroup.mutateAsync({ name });
      setName("");
      setSelectedGroupId(created.id);
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await addMember.mutateAsync({ user_id: memberUserId, role: memberRole });
      setMemberUserId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  async function handleUpdateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await updateMember.mutateAsync({ role: updateRole });
      setUpdateUserId("");
    } catch {
      // React Query stores the API error on the mutation; render it below.
    }
  }

  return (
    <PageCard
      title={localization.groups.title}
      description={localization.groups.description}
    >
      <div className="responsive-panel">
        <div className="responsive-panel-grid" data-layout="form-aside">
          <form
            onSubmit={handleSubmit}
            className="cal-card grid gap-3 rounded-xl p-4"
          >
            <Field label={localization.groups.nameLabel}>
              <input
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Button
              type="submit"
              disabled={createGroup.isPending || !name.trim()}
            >
              {localization.groups.createButton}
            </Button>
            {createGroup.error ? (
              <ErrorState error={createGroup.error} />
            ) : null}
          </form>
          <section className="cal-card rounded-xl p-4">
            <h2 className="font-semibold">
              {localization.groups.membershipActions}
            </h2>
            {activeGroupId ? (
              <p className="mt-2 text-sm leading-6 text-cal-muted">
                {localization.groups.activeGroupLabel}: {activeGroupId}
              </p>
            ) : (
              <EmptyState
                title={localization.groups.noSelectedTitle}
                description={localization.groups.noSelectedDescription}
              />
            )}
            <form
              onSubmit={handleAddMember}
              className="mt-4 grid gap-3 border-t border-cal-hairline pt-4"
            >
              <Field label={localization.groups.addMemberLabel}>
                <input
                  className={inputClassName}
                  value={memberUserId}
                  onChange={(event) => setMemberUserId(event.target.value)}
                />
              </Field>
              <RoleSelect
                label={localization.groups.roleLabel}
                labels={localization.groups.roles}
                value={memberRole}
                onChange={setMemberRole}
              />
              <Button
                type="submit"
                disabled={
                  !activeGroupId || !memberUserId.trim() || addMember.isPending
                }
              >
                {localization.groups.upsertMember}
              </Button>
            </form>
            {addMember.error ? (
              <div className="mt-3">
                <ErrorState error={addMember.error} />
              </div>
            ) : null}
            <form
              onSubmit={handleUpdateMember}
              className="mt-4 grid gap-3 border-t border-cal-hairline pt-4"
            >
              <Field label={localization.groups.patchMemberLabel}>
                <input
                  className={inputClassName}
                  value={updateUserId}
                  onChange={(event) => setUpdateUserId(event.target.value)}
                />
              </Field>
              <RoleSelect
                label={localization.groups.roleLabel}
                labels={localization.groups.roles}
                value={updateRole}
                onChange={setUpdateRole}
              />
              <Button
                type="submit"
                variant="outline"
                disabled={
                  !activeGroupId ||
                  !updateUserId.trim() ||
                  updateMember.isPending
                }
              >
                {localization.groups.patchRole}
              </Button>
            </form>
            {updateMember.error ? (
              <div className="mt-3">
                <ErrorState error={updateMember.error} />
              </div>
            ) : null}
            <p className="mt-4 rounded-lg border border-cal-hairline bg-cal-surface-strong p-3 text-sm leading-6 text-cal-body">
              {localization.groups.backendNote}
            </p>
          </section>
        </div>
      </div>
      <ResourceList
        loading={groups.isLoading}
        error={groups.error}
        empty={localization.groups.empty}
      >
        {groups.data?.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedGroupId(group.id)}
            className="text-left"
          >
            <ResourceRow
              title={group.name}
              subtitle={group.id}
              meta={
                localization.groups.roles[
                  group.role as keyof typeof localization.groups.roles
                ] ?? group.role
              }
              active={activeGroupId === group.id}
            />
          </button>
        ))}
      </ResourceList>
    </PageCard>
  );
}

function RoleSelect({
  label,
  labels,
  value,
  onChange,
}: {
  label: string;
  labels: Record<GroupRole, string>;
  value: GroupRole;
  onChange: (value: GroupRole) => void;
}) {
  return (
    <Field label={label}>
      <select
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value as GroupRole)}
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

function PageCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <header>
        <h1 className="cal-heading cal-fluid-title">{title}</h1>
        <p className="cal-subcopy mt-3 max-w-3xl">{description}</p>
      </header>
      {children}
    </div>
  );
}

function documentMeta(
  doc: {
    knowledge_base_id: string | null;
    source_type?: string;
    source_filename?: string | null;
    source_page_count?: number | null;
  },
  localization: {
    common: { knowledgeBasePrefix: string };
    documents: {
      pdfSourcePrefix: string;
      pdfSource: string;
      markdownSourcePrefix: string;
      markdownSource: string;
      uploadedTextSourcePrefix: string;
      uploadedTextSource: string;
      textSource: string;
      pagesLabel: string;
    };
  },
) {
  const source = documentSourceLabel(doc, localization.documents);
  const pages = doc.source_page_count
    ? ` · ${doc.source_page_count} ${localization.documents.pagesLabel}`
    : "";
  const kb = doc.knowledge_base_id
    ? ` · ${localization.common.knowledgeBasePrefix} ${doc.knowledge_base_id.slice(0, 8)}`
    : "";
  return `${source}${pages}${kb}`;
}

function documentSourceLabel(
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
    textSource: string;
  },
) {
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
  if (doc.source_filename) {
    return `${localization.uploadedTextSourcePrefix} ${doc.source_filename}`;
  }
  if (doc.source_type === "text" && doc.source_filename) {
    return localization.uploadedTextSource;
  }
  return localization.textSource;
}

function ResourceList({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: string;
  children: React.ReactNode;
}) {
  const { localization } = useLocalization((state) => state.localization.admin);
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <section className="cal-card grid min-w-0 gap-3 rounded-xl p-4">
      {loading ? (
        <p className="text-sm text-cal-muted">{localization.common.loading}</p>
      ) : null}
      {error ? <ErrorState error={error} /> : null}
      {!loading && !error && !hasChildren ? (
        <EmptyState
          title={empty}
          description={localization.common.emptyListDescription}
        />
      ) : null}
      <div className="grid min-w-0 gap-2">{children}</div>
    </section>
  );
}

function ResourceRow({
  title,
  subtitle,
  meta,
  active,
}: {
  title: string;
  subtitle: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border p-3 ${active ? "border-cal-primary bg-cal-primary text-white" : "border-cal-hairline bg-cal-canvas"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 break-words font-medium">{title}</p>
        <Pill>{meta}</Pill>
      </div>
      <p
        className={`mt-1 break-all text-xs ${active ? "text-white/70" : "text-cal-muted"}`}
      >
        {subtitle}
      </p>
    </div>
  );
}
