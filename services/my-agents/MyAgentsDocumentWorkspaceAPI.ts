import { API_PATH } from "@/constants/api-path";
import {
  type ConversationArtifact,
  type ConversationAttachment,
  conversationArtifactListSchema,
  conversationAttachmentListSchema,
  conversationAttachmentSchema,
} from "@/model/my-agents";
import { myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

/**
 * Temporary conversation files: upload, list, delete, and the artifacts a run
 * produced from them.
 *
 * Everything here is conversation-scoped and owner-checked server-side. The
 * client never assembles a provider URL and never sees provider identifiers.
 */
export class MyAgentsDocumentWorkspaceAPI {
  private readonly client = myAgentsFetchClient;

  /**
   * Transfers one file to the provider.
   *
   * `providerConsent` is a required form field rather than a default because
   * the backend rejects an unconsented upload with
   * `document_provider_consent_required` — the contract deliberately makes it
   * impossible to send bytes to OpenAI as a side effect of some other action.
   * The caller passes the user's actual answer; there is no default here to
   * accidentally inherit.
   */
  async createAttachment({
    conversationId,
    file,
    providerConsent,
  }: {
    conversationId: string;
    file: File;
    providerConsent: boolean;
  }): Promise<ConversationAttachment> {
    const body = new FormData();
    body.append("file", file);
    body.append("provider_consent", String(providerConsent));
    const value = await this.client.fetch(
      API_PATH.conversations.attachments(conversationId),
      { method: "POST", body },
    );
    return parseWithSchema(conversationAttachmentSchema, value);
  }

  /**
   * Refresh-safe metadata. Expired and deleted rows are returned rather than
   * omitted, which is what lets the UI say a file expired instead of quietly
   * losing it.
   */
  async listAttachments(
    conversationId: string,
  ): Promise<ConversationAttachment[]> {
    const value = await this.client.fetch(
      API_PATH.conversations.attachments(conversationId),
    );
    return parseWithSchema(conversationAttachmentListSchema, value);
  }

  /**
   * 204 on success. A failure must stay visible: it can mean the provider copy
   * still exists, so the caller must not optimistically drop the row.
   */
  async deleteAttachment({
    conversationId,
    attachmentId,
  }: {
    conversationId: string;
    attachmentId: string;
  }): Promise<void> {
    await this.client.fetch(
      API_PATH.conversations.attachment(conversationId, attachmentId),
      { method: "DELETE" },
    );
  }

  /**
   * Every artifact in the conversation, each carrying the `run_id` that
   * produced it. This is the only cold-load path that ties a generated file to
   * its answer: `AgentRunSummaryResponse` carries no artifacts.
   */
  async listArtifacts(conversationId: string): Promise<ConversationArtifact[]> {
    const value = await this.client.fetch(
      API_PATH.conversations.artifacts(conversationId),
    );
    return parseWithSchema(conversationArtifactListSchema, value);
  }

  /**
   * Fetches the bytes through the same-origin proxy.
   *
   * The path is rebuilt from the artifact's IDs rather than taken from the
   * served `download_url`. A server-supplied URL would be followed verbatim by
   * the browser, which at best bypasses the BFF's cookie and CSRF handling and
   * at worst points somewhere else entirely; the IDs are the part worth
   * trusting. `download_url` is parsed and kept for debugging, never navigated.
   *
   * Returns the raw `Response` so the caller owns the save interaction — the
   * viewer's sandbox, the filename, and the object-URL lifetime are all
   * presentation concerns.
   */
  async downloadArtifact({
    conversationId,
    artifactId,
  }: {
    conversationId: string;
    artifactId: string;
  }): Promise<Response> {
    return this.client.fetchResponse(
      API_PATH.conversations.artifactDownload(conversationId, artifactId),
    );
  }
}
