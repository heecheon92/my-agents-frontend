import { API_PATH } from "@/constants/api-path";
import {
  type Document,
  type DocumentCreateRequest,
  type DocumentPermission,
  type DocumentPermissionPatchRequest,
  type DocumentUploadRequest,
  documentPermissionSchema,
  documentSchema,
  type ExtractionRun,
  extractionRunSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

export class MyAgentsDocumentAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
  ) {}

  async create(payload: DocumentCreateRequest): Promise<Document> {
    return parseWithSchema(
      documentSchema,
      await this.client.fetch(API_PATH.documents.root, {
        method: "POST",
        body: payload,
      }),
    );
  }

  async upload(payload: DocumentUploadRequest): Promise<Document> {
    const formData = new FormData();
    formData.set("title", payload.title);
    formData.set("file", payload.file);
    if (payload.group_id) formData.set("group_id", payload.group_id);
    if (payload.knowledge_base_id) {
      formData.set("knowledge_base_id", payload.knowledge_base_id);
    }

    return parseWithSchema(
      documentSchema,
      await this.client.fetch(API_PATH.documents.upload, {
        method: "POST",
        body: formData,
      }),
    );
  }

  async list(): Promise<Document[]> {
    return parseArrayWithSchema(
      documentSchema,
      await this.client.fetch(API_PATH.documents.root),
    );
  }

  async detail(documentId: string): Promise<Document> {
    return parseWithSchema(
      documentSchema,
      await this.client.fetch(API_PATH.documents.detail(documentId)),
    );
  }

  async remove(documentId: string): Promise<void> {
    await this.client.fetch(API_PATH.documents.detail(documentId), {
      method: "DELETE",
    });
  }

  async patchPermission(
    documentId: string,
    payload: DocumentPermissionPatchRequest,
  ): Promise<DocumentPermission> {
    return parseWithSchema(
      documentPermissionSchema,
      await this.client.fetch(API_PATH.documents.permissions(documentId), {
        method: "PATCH",
        body: payload,
      }),
    );
  }

  async ingest(documentId: string): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.ingest(documentId), {
        method: "POST",
      }),
    );
  }

  async ingestAsync(documentId: string): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.ingestAsync(documentId), {
        method: "POST",
      }),
    );
  }

  async extractionRuns(documentId: string): Promise<ExtractionRun[]> {
    return parseArrayWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.extractionRuns(documentId)),
    );
  }

  async extractionRun(
    documentId: string,
    runId: string,
  ): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(
        API_PATH.documents.extractionRun(documentId, runId),
      ),
    );
  }
}
