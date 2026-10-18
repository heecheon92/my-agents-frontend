import { API_PATH } from "@/constants/api-path";
import {
  type Document,
  type DocumentCreateRequest,
  type DocumentOriginalDownload,
  type DocumentPermission,
  type DocumentPermissionPatchRequest,
  type DocumentReprocessRequest,
  type DocumentUploadCompleted,
  type DocumentUploadInitiateRequest,
  type DocumentUploadReceipt,
  type DocumentUploadRequest,
  documentOriginalDownloadSchema,
  documentPermissionSchema,
  documentReprocessRequestSchema,
  documentSchema,
  documentUploadCompletedSchema,
  documentUploadInitiateRequestSchema,
  documentUploadReceiptSchema,
  type ExtractionRun,
  extractionRunSchema,
  type KnowledgeBaseDocumentCreateRequest,
  type KnowledgeBaseDocumentUploadRequest,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseArrayWithSchema, parseWithSchema } from "./parser";

function buildDocumentUploadFormData(
  payload: KnowledgeBaseDocumentUploadRequest,
) {
  const formData = new FormData();
  formData.set("title", payload.title);
  formData.set("file", payload.file);
  if (payload.group_id) formData.set("group_id", payload.group_id);
  // Omitted, not defaulted: the backend then applies the user's saved mode.
  if (payload.ingestion_mode) {
    formData.set("ingestion_mode", payload.ingestion_mode);
  }
  return formData;
}

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

  async createInKnowledgeBase(
    knowledgeBaseId: string,
    payload: KnowledgeBaseDocumentCreateRequest,
  ): Promise<Document> {
    return parseWithSchema(
      documentSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documents(knowledgeBaseId),
        {
          method: "POST",
          body: payload,
        },
      ),
    );
  }

  async upload(payload: DocumentUploadRequest): Promise<Document> {
    const formData = buildDocumentUploadFormData(payload);
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

  async uploadToKnowledgeBase(
    knowledgeBaseId: string,
    payload: KnowledgeBaseDocumentUploadRequest,
  ): Promise<Document> {
    return parseWithSchema(
      documentSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.uploadDocument(knowledgeBaseId),
        {
          method: "POST",
          body: buildDocumentUploadFormData(payload),
        },
      ),
    );
  }

  async list(): Promise<Document[]> {
    return parseArrayWithSchema(
      documentSchema,
      await this.client.fetch(API_PATH.documents.root),
    );
  }

  async listByKnowledgeBase(knowledgeBaseId: string): Promise<Document[]> {
    return parseArrayWithSchema(
      documentSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documents(knowledgeBaseId),
      ),
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

  async ingestInKnowledgeBase(
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.ingestDocument(knowledgeBaseId, documentId),
        {
          method: "POST",
        },
      ),
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

  async ingestAsyncInKnowledgeBase(
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.ingestDocumentAsync(
          knowledgeBaseId,
          documentId,
        ),
        {
          method: "POST",
        },
      ),
    );
  }

  async extractionRuns(documentId: string): Promise<ExtractionRun[]> {
    return parseArrayWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.extractionRuns(documentId)),
    );
  }

  async extractionRunsInKnowledgeBase(
    knowledgeBaseId: string,
    documentId: string,
  ): Promise<ExtractionRun[]> {
    return parseArrayWithSchema(
      extractionRunSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.extractionRuns(knowledgeBaseId, documentId),
      ),
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

  async extractionRunInKnowledgeBase(
    knowledgeBaseId: string,
    documentId: string,
    runId: string,
  ): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.extractionRun(
          knowledgeBaseId,
          documentId,
          runId,
        ),
      ),
    );
  }

  /**
   * Starts a direct upload. The receipt carries a signed URL that is a
   * credential: hand it to `putDirectUpload` and nothing else.
   */
  async initiateUpload(
    knowledgeBaseId: string,
    payload: DocumentUploadInitiateRequest,
  ): Promise<DocumentUploadReceipt> {
    return parseWithSchema(
      documentUploadReceiptSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documentUploads(knowledgeBaseId),
        {
          method: "POST",
          body: documentUploadInitiateRequestSchema.parse(payload),
        },
      ),
    );
  }

  /** A fresh signed URL for the same upload, after a PUT was refused. */
  async refreshUpload(
    knowledgeBaseId: string,
    uploadId: string,
  ): Promise<DocumentUploadReceipt> {
    return parseWithSchema(
      documentUploadReceiptSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documentUploadRefresh(
          knowledgeBaseId,
          uploadId,
        ),
        { method: "POST" },
      ),
    );
  }

  /**
   * Turns the stored object into a document. Idempotent: repeating it returns
   * the same document and run. The run is `null` for a staged group upload.
   */
  async completeUpload(
    knowledgeBaseId: string,
    uploadId: string,
  ): Promise<DocumentUploadCompleted> {
    return parseWithSchema(
      documentUploadCompletedSchema,
      await this.client.fetch(
        API_PATH.knowledgeBases.documentUploadComplete(
          knowledgeBaseId,
          uploadId,
        ),
        { method: "POST" },
      ),
    );
  }

  /** Abandons a pending upload. Never deletes a completed document. */
  async abortUpload(knowledgeBaseId: string, uploadId: string): Promise<void> {
    await this.client.fetch(
      API_PATH.knowledgeBases.documentUpload(knowledgeBaseId, uploadId),
      { method: "DELETE" },
    );
  }

  /** A signed, short-lived link to the retained original file. */
  async originalDownload(
    documentId: string,
  ): Promise<DocumentOriginalDownload> {
    return parseWithSchema(
      documentOriginalDownloadSchema,
      await this.client.fetch(API_PATH.documents.original(documentId)),
    );
  }

  /**
   * Processes the retained original again. Unlike `ingest`, which re-indexes
   * the active text, this starts from the file; the previous active content is
   * kept if it fails.
   */
  async reprocess(
    documentId: string,
    payload: DocumentReprocessRequest = {},
  ): Promise<ExtractionRun> {
    return parseWithSchema(
      extractionRunSchema,
      await this.client.fetch(API_PATH.documents.reprocess(documentId), {
        method: "POST",
        body: documentReprocessRequestSchema.parse(payload),
      }),
    );
  }
}
