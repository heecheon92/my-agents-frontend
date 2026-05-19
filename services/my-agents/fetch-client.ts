import { toFrontendAPIPath } from "@/constants/api-path";
import { JSON_CONTENT_TYPE } from "@/constants/header";
import { defaultLocalization } from "@/utils/localization";
import { MyAgentsAPIError } from "./MyAgentsAPIError";

export type RequestBody = BodyInit | Record<string, unknown> | undefined;

export type MyAgentsFetchInit = Omit<RequestInit, "body"> & {
  body?: RequestBody;
};

function buildBody(body: RequestBody) {
  if (body === undefined) return undefined;
  if (typeof body === "string" || body instanceof FormData) return body;
  return JSON.stringify(body);
}

function buildHeaders(
  headers: HeadersInit | undefined,
  body: RequestBody,
  method?: string,
) {
  const nextHeaders = new Headers(headers);
  const shouldSendJsonType =
    !(body instanceof FormData) && method !== undefined && method !== "GET";
  if (shouldSendJsonType && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", JSON_CONTENT_TYPE);
  }
  return nextHeaders;
}

async function readResponse(response: Response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function safeDetail(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return undefined;
}

export class MyAgentsFetchClient {
  async fetchResponse(path: string, init: MyAgentsFetchInit = {}) {
    const response = await fetch(toFrontendAPIPath(path), {
      ...init,
      body: buildBody(init.body),
      credentials: "include",
      headers: buildHeaders(init.headers, init.body, init.method),
    });
    if (response.ok) return response;

    const body = await readResponse(response);
    const detail = safeDetail(body);
    throw new MyAgentsAPIError({
      message:
        detail ??
        response.statusText ??
        defaultLocalization.errors.requestFailed,
      status: response.status,
      detail,
      body,
    });
  }

  async fetch(path: string, init: MyAgentsFetchInit = {}) {
    return readResponse(await this.fetchResponse(path, init));
  }
}

export const myAgentsFetchClient = new MyAgentsFetchClient();
