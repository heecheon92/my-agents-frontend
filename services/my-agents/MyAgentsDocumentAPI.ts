import { API_PATH } from "@/constants/api-path";
import {
  type Document,
  type DocumentCreateRequest,
  type DocumentPermission,
  type DocumentPermissionPatchRequest,
  documentPermissionSchema,
  documentSchema,
  type ExtractionRun,
  extractionRunSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

export class MyAgentsDocumentAPI {
  constructor(
    private readonly client: MyAgentsFetchClient = myAgentsFetchClient,
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

  async extractionRuns(documentId: string): Promise<ExtractionRun[]> {
    return parseArrayWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.extractionRuns(documentId)),
    );
  }
}
