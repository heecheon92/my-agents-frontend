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
  useDocuments,
  useExtractionRuns,
  useIngestDocument,
  useKnowledgeBases,
  usePatchDocumentPermission,
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
    await createKnowledgeBase.mutateAsync({ name, scope: "personal" });
    setName("");
  }

  return (
    <PageCard
      title={localization.knowledge.title}
      description={localization.knowledge.description}
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const activeDocumentId = selectedDocumentId ?? documents.data?.[0]?.id;
  const extractionRuns = useExtractionRuns(activeDocumentId);
  const ingest = useIngestDocument(activeDocumentId);
  const patchPermission = usePatchDocumentPermission(activeDocumentId);
  const [permissionUserId, setPermissionUserId] = useState("");
  const { localization } = useLocalization((state) => state.localization.admin);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createDocument.mutateAsync({ title, content });
    setTitle("");
    setContent("");
    setSelectedDocumentId(created.id);
  }

  async function handlePatchPermission(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    await patchPermission.mutateAsync({
      user_id: permissionUserId,
      can_read: true,
      can_write: false,
      can_manage: false,
      can_ingest: false,
    });
    setPermissionUserId("");
  }

  return (
    <PageCard
      title={localization.documents.title}
      description={localization.documents.description}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
        >
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
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">
            {localization.documents.selectedActions}
          </h2>
          {activeDocumentId ? (
            <p className="mt-1 text-sm text-slate-500">{activeDocumentId}</p>
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
            className="mt-4 grid gap-3 border-t border-slate-200 pt-4"
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
          <h3 className="mt-6 font-semibold">
            {localization.documents.extractionRuns}
          </h3>
          <div className="mt-3 grid gap-2">
            {extractionRuns.data?.length === 0 ? (
              <EmptyState
                title={localization.documents.noExtractionRunsTitle}
                description={localization.documents.noExtractionRunsDescription}
              />
            ) : null}
            {extractionRuns.data?.map((run) => (
              <div key={run.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Pill tone="green">{run.status}</Pill>
                  <span>
                    {run.chunk_count} {localization.common.chunks}
                  </span>
                </div>
                <p className="mt-2 text-slate-600">
                  {run.entity_count} {localization.common.entities} ·{" "}
                  {run.relationship_count} {localization.common.relationships}
                </p>
              </div>
            ))}
          </div>
        </section>
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
              meta={
                doc.knowledge_base_id
                  ? `${localization.common.knowledgeBasePrefix} ${doc.knowledge_base_id.slice(0, 8)}`
                  : localization.common.noKnowledgeBase
              }
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
    const created = await createGroup.mutateAsync({ name });
    setName("");
    setSelectedGroupId(created.id);
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await addMember.mutateAsync({ user_id: memberUserId, role: memberRole });
    setMemberUserId("");
  }

  async function handleUpdateMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateMember.mutateAsync({ role: updateRole });
    setUpdateUserId("");
  }

  return (
    <PageCard
      title={localization.groups.title}
      description={localization.groups.description}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
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
          {createGroup.error ? <ErrorState error={createGroup.error} /> : null}
        </form>
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">
            {localization.groups.membershipActions}
          </h2>
          {activeGroupId ? (
            <p className="mt-1 text-sm text-slate-500">
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
            className="mt-4 grid gap-3 border-t border-slate-200 pt-4"
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
            className="mt-4 grid gap-3 border-t border-slate-200 pt-4"
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
                !activeGroupId || !updateUserId.trim() || updateMember.isPending
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
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            {localization.groups.backendNote}
          </p>
        </section>
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
    <div className="mx-auto grid max-w-6xl gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      </header>
      {children}
    </div>
  );
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
    <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
      {loading ? (
        <p className="text-sm text-slate-500">{localization.common.loading}</p>
      ) : null}
      {error ? <ErrorState error={error} /> : null}
      {!loading && !error && !hasChildren ? (
        <EmptyState
          title={empty}
          description={localization.common.emptyListDescription}
        />
      ) : null}
      <div className="grid gap-2">{children}</div>
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
      className={`rounded-2xl border p-3 ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <Pill>{meta}</Pill>
      </div>
      <p
        className={`mt-1 text-xs ${active ? "text-slate-300" : "text-slate-500"}`}
      >
        {subtitle}
      </p>
    </div>
  );
}
