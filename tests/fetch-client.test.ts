import { describe, expect, it, vi } from "vitest";
import { MyAgentsFetchClient } from "@/services/my-agents/fetch-client";

describe("MyAgentsFetchClient", () => {
  it("sets JSON content type for no-body mutations such as logout and ingest", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("content-type")).toBe("application/json");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await new MyAgentsFetchClient().fetch("/auth/logout", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/my-agents/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
    vi.unstubAllGlobals();
  });
});
