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
import { Field, inputClassName } from "./Field";
import { EmptyState, ErrorState, Pill } from "./Status";

export function KnowledgeSurface() {
  const knowledgeBases = useKnowledgeBases();
  const createKnowledgeBase = useCreateKnowledgeBase();
  const [name, setName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createKnowledgeBase.mutateAsync({ name, scope: "personal" });
    setName("");
  }

  return (
    <PageCard
      title="Knowledge bases"
      description="Create and list personal or group retrieval scopes."
    >
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <Field label="Knowledge base name">
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
          Create knowledge base
        </Button>
        {createKnowledgeBase.error ? (
          <ErrorState error={createKnowledgeBase.error} />
        ) : null}
      </form>
      <ResourceList
        loading={knowledgeBases.isLoading}
        error={knowledgeBases.error}
        empty="No knowledge bases yet."
      >
        {knowledgeBases.data?.map((kb) => (
          <ResourceRow
            key={kb.id}
            title={kb.name}
            subtitle={`${kb.scope} · ${kb.id}`}
            meta={kb.group_id ? `group ${kb.group_id.slice(0, 8)}` : "personal"}
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
      title="Documents"
      description="Manage document metadata, ingestion, extraction runs, and direct permission patches."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
        >
          <Field label="Title">
            <input
              className={inputClassName}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Content"
            hint="The backend stores content and deterministic ingestion creates chunks/entities."
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
            Create document
          </Button>
          {createDocument.error ? (
            <ErrorState error={createDocument.error} />
          ) : null}
        </form>
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Selected document actions</h2>
          {activeDocumentId ? (
            <p className="mt-1 text-sm text-slate-500">{activeDocumentId}</p>
          ) : (
            <EmptyState
              title="No document selected"
              description="Create or select a document."
            />
          )}
          <Button
            className="mt-4 w-full"
            onClick={() => ingest.mutate()}
            disabled={!activeDocumentId || ingest.isPending}
          >
            Run ingest
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
              label="Grant read permission to user id"
              hint="Backend currently exposes an ID-based permission contract. User search should be a backend request if needed."
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
              Patch permission
            </Button>
          </form>
          {patchPermission.error ? (
            <div className="mt-3">
              <ErrorState error={patchPermission.error} />
            </div>
          ) : null}
          <h3 className="mt-6 font-semibold">Extraction runs</h3>
          <div className="mt-3 grid gap-2">
            {extractionRuns.data?.length === 0 ? (
              <EmptyState
                title="No extraction runs"
                description="Run ingest to create one."
              />
            ) : null}
            {extractionRuns.data?.map((run) => (
              <div key={run.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <Pill tone="green">{run.status}</Pill>
                  <span>{run.chunk_count} chunks</span>
                </div>
                <p className="mt-2 text-slate-600">
                  {run.entity_count} entities · {run.relationship_count}{" "}
                  relationships
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <ResourceList
        loading={documents.isLoading}
        error={documents.error}
        empty="No documents yet."
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
                  ? `KB ${doc.knowledge_base_id.slice(0, 8)}`
                  : "No KB"
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
  const [memberRole, setMemberRole] = useState<
    "owner" | "admin" | "editor" | "viewer"
  >("viewer");
  const [updateUserId, setUpdateUserId] = useState("");
  const [updateRole, setUpdateRole] = useState<
    "owner" | "admin" | "editor" | "viewer"
  >("viewer");
  const updateMember = useUpdateMember(activeGroupId, updateUserId);

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
      title="Groups"
      description="Create/list groups and manage member roles through the backend ID-based membership routes."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4"
        >
          <Field label="Group name">
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
            Create group
          </Button>
          {createGroup.error ? <ErrorState error={createGroup.error} /> : null}
        </form>
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Membership actions</h2>
          {activeGroupId ? (
            <p className="mt-1 text-sm text-slate-500">
              Active group: {activeGroupId}
            </p>
          ) : (
            <EmptyState
              title="No group selected"
              description="Create or select a group first."
            />
          )}
          <form
            onSubmit={handleAddMember}
            className="mt-4 grid gap-3 border-t border-slate-200 pt-4"
          >
            <Field label="Add/update member user id">
              <input
                className={inputClassName}
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
              />
            </Field>
            <RoleSelect value={memberRole} onChange={setMemberRole} />
            <Button
              type="submit"
              disabled={
                !activeGroupId || !memberUserId.trim() || addMember.isPending
              }
            >
              Upsert member
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
            <Field label="Patch existing member user id">
              <input
                className={inputClassName}
                value={updateUserId}
                onChange={(event) => setUpdateUserId(event.target.value)}
              />
            </Field>
            <RoleSelect value={updateRole} onChange={setUpdateRole} />
            <Button
              type="submit"
              variant="outline"
              disabled={
                !activeGroupId || !updateUserId.trim() || updateMember.isPending
              }
            >
              Patch role
            </Button>
          </form>
          {updateMember.error ? (
            <div className="mt-3">
              <ErrorState error={updateMember.error} />
            </div>
          ) : null}
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            Backend currently exposes ID-based member operations. If user search
            or member listing is needed, add a backend request before changing
            ../my-agents.
          </p>
        </section>
      </div>
      <ResourceList
        loading={groups.isLoading}
        error={groups.error}
        empty="No groups yet."
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
              meta={group.role}
              active={activeGroupId === group.id}
            />
          </button>
        ))}
      </ResourceList>
    </PageCard>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: "owner" | "admin" | "editor" | "viewer";
  onChange: (value: "owner" | "admin" | "editor" | "viewer") => void;
}) {
  return (
    <Field label="Role">
      <select
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value as typeof value)}
      >
        <option value="viewer">viewer</option>
        <option value="editor">editor</option>
        <option value="admin">admin</option>
        <option value="owner">owner</option>
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
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4">
      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <ErrorState error={error} /> : null}
      {!loading && !error && !hasChildren ? (
        <EmptyState
          title={empty}
          description="Create one from the form above."
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
