import { expect, test } from "@playwright/test";
import ko from "@/localization/ko.json";

const now = "2026-06-01T00:00:00.000Z";
const user = {
  id: "u-citation-reader",
  email: "reader@example.com",
  email_verified_at: now,
  is_guest: false,
};
const conversation = {
  id: "c-citations",
  title: "Compact citations",
  owner_user_id: user.id,
};
const run = {
  run_id: "run-citations",
  conversation_id: conversation.id,
  status: "completed",
  route_label: "research_helper",
  created_at: now,
};
const citation = {
  id: "citation-1",
  document_id: "doc-compact",
  knowledge_base_id: "kb-compact",
  chunk_id: "chunk-compact",
  snippet: "A compact citation should not dominate the assistant answer.",
  source_page: 3,
  source_filename: "workspace-guide.pdf",
};

async function mockCompactCitationChat(page: import("@playwright/test").Page) {
  await page.route("**/api/my-agents/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/my-agents", "");
    const method = request.method();
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });

    if (method === "GET" && path === "/auth/me") return json(user);
    if (method === "GET" && path === "/groups") return json([]);
    if (method === "GET" && path === "/knowledge-bases") return json([]);
    if (method === "GET" && path === "/conversations") {
      return json([conversation]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}`) {
      return json(conversation);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/messages`
    ) {
      return json([
        {
          id: "m-user",
          conversation_id: conversation.id,
          role: "user",
          content: "How should citations behave?",
        },
        {
          id: "m-assistant",
          conversation_id: conversation.id,
          role: "assistant",
          content:
            "Citations stay close to the answer, but details stay folded.",
        },
      ]);
    }
    if (method === "GET" && path === `/conversations/${conversation.id}/runs`) {
      return json([run]);
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}`
    ) {
      return json({
        ...run,
        reply: "Citations stay close to the answer, but details stay folded.",
        route: {
          label: "research_helper",
          explanation: "Use added knowledge.",
        },
        handled_by: "personal_assistant_graph",
        citations: [citation],
      });
    }
    if (
      method === "GET" &&
      path === `/conversations/${conversation.id}/runs/${run.run_id}/events`
    ) {
      return json([
        {
          id: "event-1",
          run_id: run.run_id,
          sequence: 1,
          event_type: "retrieval_completed",
          payload: { documents: 1 },
        },
      ]);
    }

    return json([]);
  });
}

test("assistant citation references stay compact until opened", async ({
  page,
}) => {
  await mockCompactCitationChat(page);
  await page.goto("/chat");

  const footer = page.getByTestId("assistant-message-footer").last();
  await expect(
    page.getByText("Citations stay close to the answer"),
  ).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(
    footer.getByText(ko.chat.citationSummary.replace("{count}", "1")),
  ).toBeVisible();
  await expect(footer.getByText(citation.source_filename)).toBeHidden();
  await expect(footer.getByText(citation.snippet)).toBeHidden();
  await expect(footer.getByText(citation.document_id)).toBeHidden();

  await footer.getByLabel(new RegExp(ko.chat.viewCitationDetails)).click();

  await expect(footer.getByText(citation.source_filename)).toBeVisible();
  await expect(footer.getByText(citation.snippet)).toBeVisible();
  await expect(footer.getByText(citation.document_id)).toBeHidden();

  await footer.getByText(ko.chat.advancedDetails).first().click();
  await expect(footer.getByText(citation.document_id)).toBeVisible();
});
