import { describe, expect, it, vi } from "vitest";
import { MyAgentsFetchClient } from "@/services/my-agents/fetch-client";
import type { MyAgentsAPIError } from "@/services/my-agents/MyAgentsAPIError";

describe("MyAgentsFetchClient", () => {
  it("sets JSON content type for no-body mutations such as logout and ingest", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("application/json");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new MyAgentsFetchClient();

    await client.fetch("/auth/logout", { method: "POST" });
    await client.fetch("/documents/document-1/ingest", { method: "POST" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/my-agents/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/my-agents/documents/document-1/ingest",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });

  it.each([
    {
      detail: "email verification required",
      status: 403,
    },
    {
      detail: "too many auth attempts",
      status: 429,
    },
  ])(
    "surfaces backend auth hardening errors without custom fields: $detail",
    async ({ detail, status }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { detail },
            {
              status,
              statusText: status === 429 ? "Too Many Requests" : "Forbidden",
            },
          ),
        ),
      );

      const client = new MyAgentsFetchClient();

      await expect(
        client.fetch("/auth/login", {
          method: "POST",
          body: { email: "user@example.com", password: "wrong" },
        }),
      ).rejects.toMatchObject({
        name: "MyAgentsAPIError",
        message: detail,
        status,
        detail,
      } satisfies Partial<MyAgentsAPIError>);

      vi.unstubAllGlobals();
    },
  );
});
