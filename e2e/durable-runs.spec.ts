import { expect, type Page, type Route, test } from "@playwright/test";
import ko from "@/localization/ko.json";
import { dismissOnboarding, mockWorkspace } from "./helpers/mock-workspace";

/**
 * Durable (server-owned) answers, against direct durable mocks.
 *
 * These cases mock the durable protocol directly, so every assertion observes
 * the app's real request paths, and a request to a legacy route is something
 * they can count.
 *
 * The contract is the one frozen in `docs/backend-requests.md`: admission
 * returns a receipt, a GET listener streams frames whose SSE `id` is a
 * delivery cursor, `/output` is a snapshot that replaces the view, and a
 * stream that closes without a terminal event means "reconnect from the last
 * id". The flag `durable_runs.enabled` selects the route for NEW answers and
 * regenerations only; recovery and resume follow each run's `execution_mode`
 * and are tested here with the flag off or absent.
 */

const CONVERSATION_ID = "c-visual";
const RUN_ID = "run-durable";
const API = "**/api/my-agents";

type Frame = { id: number; event: string; data: unknown };

function sse(frames: Frame[]) {
  return frames
    .map(
      (frame) =>
        `id: ${frame.id}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`,
    )
    .join("");
}

function completedRun(reply: string) {
  return {
    status: "completed",
    run_id: RUN_ID,
    conversation_id: CONVERSATION_ID,
    reply,
    route: {
      label: "general_assistant",
      explanation: "일반 질문으로 판단했습니다.",
    },
    // The only value the served schema accepts.
    handled_by: "personal_assistant_graph",
    retrieval_route: "no_retrieval",
    answer_mode: "general_knowledge",
    document_scope: "current_conversation",
    knowledge_base_selection: { mode: "all", knowledge_base_ids: [] },
    citations: [],
    warnings: [],
  };
}

function runSummary(status: string) {
  return {
    run_id: RUN_ID,
    conversation_id: CONVERSATION_ID,
    status,
    route_label: null,
    created_at: "2030-01-01T00:00:00.000Z",
    execution_mode: "durable",
    client_request_id: "11111111-1111-4111-8111-111111111111",
  };
}

const started = (id: number): Frame => ({
  id,
  event: "run_started",
  data: {
    run_id: RUN_ID,
    conversation_id: CONVERSATION_ID,
    status: "running",
  },
});

const delta = (id: number, text: string): Frame => ({
  id,
  event: "answer_delta",
  data: { delta: text, sequence: id },
});

/**
 * Serves health with the opt-in flag. `undefined` omits `durable_runs`
 * entirely, as an older backend would.
 */
async function mockDurableHealth(
  page: Page,
  durableRuns: { enabled: boolean; ready: boolean } | undefined,
) {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({
      json: {
        status: "ok",
        service: "my-agents",
        version: "test",
        frontend_config: {
          documents: { upload_concurrency: 3 },
          ...(durableRuns ? { durable_runs: durableRuns } : {}),
        },
      },
    }),
  );
}

/**
 * Sets the flag (on unless told otherwise), and makes the transcript and run list answer from a
 * `state` the test advances, so a completed run reads back as a stored
 * message the way the real backend reports it.
 */
async function mockDurableBackend(
  page: Page,
  state: { runStatus: string | null; reply: string | null },
  durableRuns: { enabled: boolean; ready: boolean } = {
    enabled: true,
    ready: true,
  },
) {
  await mockDurableHealth(page, durableRuns);
  await page.route(`${API}/conversations/${CONVERSATION_ID}/runs`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: state.runStatus ? [runSummary(state.runStatus)] : [],
        })
      : route.fallback(),
  );
  await page.route(
    `${API}/conversations/${CONVERSATION_ID}/messages`,
    (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: state.reply
              ? [
                  {
                    id: "m-user",
                    conversation_id: CONVERSATION_ID,
                    role: "user",
                    content: "질문",
                  },
                  {
                    id: "m-durable",
                    conversation_id: CONVERSATION_ID,
                    role: "assistant",
                    content: state.reply,
                  },
                ]
              : [],
          })
        : route.fallback(),
  );
}

async function send(page: Page, text: string) {
  const composer = page.getByPlaceholder(ko.chat.composerPlaceholder);
  await composer.fill(text);
  await composer.press("Enter");
}

test.describe("durable answers", () => {
  test("reconnects from the last delivery id without doubling text", async ({
    page,
  }) => {
    const state = {
      runStatus: null as string | null,
      reply: null as string | null,
    };
    await mockWorkspace(page);
    await mockDurableBackend(page, state);
    const admissions: unknown[] = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/async`,
      (route) => {
        admissions.push(route.request().postDataJSON());
        state.runStatus = "queued";
        return route.fulfill({
          status: 202,
          json: {
            run_id: RUN_ID,
            conversation_id: CONVERSATION_ID,
            status: "queued",
            client_request_id: (
              route.request().postDataJSON() as {
                client_request_id: string;
              }
            ).client_request_id,
          },
        });
      },
    );
    const afters: string[] = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/stream*`,
      (route) => {
        const after = new URL(route.request().url()).searchParams.get("after");
        afters.push(after ?? "");
        const reply = "안녕하세요. 반갑습니다.";
        // The first stream is cut after three frames, as a hosting limit
        // would. The second repeats frame 3, which must not be applied twice.
        const body =
          after === "0"
            ? sse([started(1), delta(2, "안녕"), delta(3, "하세요.")])
            : sse([
                delta(3, "하세요."),
                delta(4, " 반갑습니다."),
                { id: 5, event: "run_completed", data: completedRun(reply) },
              ]);
        if (after !== "0") {
          state.runStatus = "completed";
          state.reply = reply;
        }
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body,
        });
      },
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await send(page, "인사해 주세요");

    await expect(page.getByText("안녕하세요. 반갑습니다.")).toHaveCount(1);
    expect(afters).toEqual(["0", "3"]);
    expect(admissions).toHaveLength(1);
    expect(admissions[0]).toMatchObject({
      message: "인사해 주세요",
      knowledge_base_selection: { mode: "all" },
    });
    expect(
      (admissions[0] as { client_request_id: string }).client_request_id,
    ).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByText("하세요.하세요.")).toHaveCount(0);
  });

  test("a reload mid-answer restores the partial answer and keeps streaming", async ({
    page,
  }) => {
    const state = {
      runStatus: "running" as string | null,
      reply: null as string | null,
    };
    await mockWorkspace(page);
    // The flag is OFF: it selects only new work, and an existing durable run
    // is joined by its own `execution_mode`.
    await mockDurableBackend(page, state, { enabled: false, ready: false });
    let admitted = 0;
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/async`,
      (route) => {
        admitted += 1;
        return route.abort();
      },
    );
    let snapshots = 0;
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/output`,
      (route) => {
        snapshots += 1;
        return route.fulfill({
          json: {
            schema_version: 1,
            run_id: RUN_ID,
            conversation_id: CONVERSATION_ID,
            client_request_id: "11111111-1111-4111-8111-111111111111",
            status: "running",
            cursor: 4,
            partial_reply: "계약 갱신 위험을 정리하는 중",
            reasoning_summaries: [],
            activity_events: [
              {
                id: 1,
                event: "run_started",
                data: {
                  run_id: RUN_ID,
                  conversation_id: CONVERSATION_ID,
                  status: "running",
                },
              },
            ],
            interaction: null,
            result: null,
            error: null,
          },
        });
      },
    );
    const afters: string[] = [];
    let releaseStream: () => void = () => undefined;
    const streamReleased = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/stream*`,
      async (route: Route) => {
        afters.push(
          new URL(route.request().url()).searchParams.get("after") ?? "",
        );
        await streamReleased;
        const reply = "계약 갱신 위험을 정리하는 중입니다.";
        state.runStatus = "completed";
        state.reply = reply;
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            delta(5, "입니다."),
            { id: 6, event: "run_completed", data: completedRun(reply) },
          ]),
        });
      },
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);

    // The committed partial answer appears from the snapshot before any new
    // frame arrives, and the listener joins at the snapshot's cursor.
    await expect(page.getByText("계약 갱신 위험을 정리하는 중")).toBeVisible();
    await expect.poll(() => afters).toEqual(["4"]);
    releaseStream();
    await expect(
      page.getByText("계약 갱신 위험을 정리하는 중입니다."),
    ).toHaveCount(1);
    expect(snapshots).toBeGreaterThanOrEqual(1);
    // Joining reads only: nothing is admitted or re-run.
    expect(admitted).toBe(0);
  });

  test("a lost worker shows its failure instead of spinning", async ({
    page,
  }) => {
    const state = {
      runStatus: null as string | null,
      reply: null as string | null,
    };
    await mockWorkspace(page);
    await mockDurableBackend(page, state);
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/async`,
      (route) => {
        state.runStatus = "running";
        return route.fulfill({
          status: 202,
          json: {
            run_id: RUN_ID,
            conversation_id: CONVERSATION_ID,
            status: "queued",
            client_request_id: "11111111-1111-4111-8111-111111111111",
          },
        });
      },
    );
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/stream*`,
      (route) => {
        state.runStatus = "failed";
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            started(1),
            delta(2, "작성 중"),
            {
              id: 3,
              event: "run_failed",
              data: {
                run_id: RUN_ID,
                conversation_id: CONVERSATION_ID,
                status: "failed",
                code: "worker_lost",
                detail: "The answer worker stopped.",
              },
            },
          ]),
        });
      },
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await send(page, "요약해 주세요");

    await expect(page.getByText(ko.errors.byCode.worker_lost)).toBeVisible();
    // The served detail is internal text and is never rendered.
    await expect(page.getByText("The answer worker stopped.")).toHaveCount(0);
  });

  test("stop-and-send cancels the durable run, then sends the draft", async ({
    page,
  }) => {
    const state = {
      runStatus: null as string | null,
      reply: null as string | null,
    };
    await mockWorkspace(page);
    await mockDurableBackend(page, state);
    const admissions: Array<{ message: string }> = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/async`,
      (route) => {
        const body = route.request().postDataJSON() as {
          message: string;
          client_request_id: string;
        };
        admissions.push(body);
        state.runStatus = "running";
        const runId = admissions.length === 1 ? RUN_ID : "run-second";
        return route.fulfill({
          status: 202,
          json: {
            run_id: runId,
            conversation_id: CONVERSATION_ID,
            status: "queued",
            client_request_id: body.client_request_id,
          },
        });
      },
    );
    let cancelled = false;
    let releaseCancel: () => void = () => undefined;
    const cancelReceived = new Promise<void>((resolve) => {
      releaseCancel = resolve;
    });
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/cancel`,
      (route) => {
        cancelled = true;
        releaseCancel();
        return route.fulfill({
          json: {
            run_id: RUN_ID,
            conversation_id: CONVERSATION_ID,
            status: "cancelling",
          },
        });
      },
    );
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/stream*`,
      async (route: Route) => {
        const after = new URL(route.request().url()).searchParams.get("after");
        if (after === "0") {
          return route.fulfill({
            status: 200,
            contentType: "text/event-stream",
            body: sse([started(1), delta(2, "긴 보고서를 쓰는 중")]),
          });
        }
        // Held open until Stop, like a live answer.
        await cancelReceived;
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            {
              id: 3,
              event: "run_cancelled",
              data: {
                run_id: RUN_ID,
                conversation_id: CONVERSATION_ID,
                status: "cancelled",
                partial_reply_persisted: false,
              },
            },
          ]),
        });
      },
    );
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/run-second/stream*`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            delta(1, "짧게 답합니다."),
            {
              id: 2,
              event: "run_completed",
              data: { ...completedRun("짧게 답합니다."), run_id: "run-second" },
            },
          ]),
        }),
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await send(page, "긴 보고서를 써 주세요");
    await expect(page.getByText("긴 보고서를 쓰는 중")).toBeVisible();

    await page
      .getByPlaceholder(/질문|입력|답변/)
      .first()
      .fill("짧게 답해 주세요");
    await page.getByRole("button", { name: ko.chat.sendNow }).click();

    await expect.poll(() => cancelled).toBe(true);
    await expect.poll(() => admissions.length).toBe(2);
    expect(admissions[1]?.message).toBe("짧게 답해 주세요");
  });

  test("with no worker ready, a send fails clearly and never falls back", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await page.route(`${API}/health`, (route) =>
      route.fulfill({
        json: {
          status: "ok",
          service: "my-agents",
          version: "test",
          frontend_config: {
            documents: { upload_concurrency: 3 },
            durable_runs: { enabled: true, ready: false },
          },
        },
      }),
    );
    let admissions = 0;
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/async`,
      (route) => {
        admissions += 1;
        return route.fulfill({
          status: 503,
          json: {
            detail: "No answer worker is ready.",
            code: "durable_runs_unavailable",
          },
        });
      },
    );
    let legacyStreams = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/runs/stream")) legacyStreams += 1;
    });

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await send(page, "질문입니다");

    await expect(
      page.getByText(ko.errors.byCode.durable_runs_unavailable),
    ).toBeVisible();
    // A definite answer: not retried, and never replaced by the legacy stream.
    expect(admissions).toBe(1);
    expect(legacyStreams).toBe(0);
    await expect(page.getByText("No answer worker is ready.")).toHaveCount(0);
  });

  for (const [label, durableRuns] of [
    ["off", { enabled: false, ready: false }],
    ["absent", undefined],
  ] as const) {
    test(`with the flag ${label}, a new answer uses the legacy stream`, async ({
      page,
    }) => {
      await mockWorkspace(page);
      await mockDurableHealth(page, durableRuns);
      let durableAdmissions = 0;
      await page.route(
        `${API}/conversations/${CONVERSATION_ID}/runs/async`,
        (route) => {
          durableAdmissions += 1;
          return route.abort();
        },
      );
      const legacyStream = page.waitForRequest((request) =>
        request.url().endsWith(`/conversations/${CONVERSATION_ID}/runs/stream`),
      );
      await page.goto(`/chat/${CONVERSATION_ID}`);
      await dismissOnboarding(page);
      await send(page, "질문입니다");
      await legacyStream;
      expect(durableAdmissions).toBe(0);
    });

    test(`with the flag ${label}, regeneration uses the synchronous route`, async ({
      page,
    }) => {
      await mockWorkspace(page);
      await mockDurableHealth(page, durableRuns);
      let durableReplays = 0;
      await page.route(`${API}/**/replay/async`, (route) => {
        durableReplays += 1;
        return route.abort();
      });
      const synchronousReplay = page.waitForRequest((request) =>
        /\/messages\/m-assistant\/replay$/.test(
          new URL(request.url()).pathname,
        ),
      );
      await page.goto(`/chat/${CONVERSATION_ID}`);
      await dismissOnboarding(page);
      await page
        .getByRole("button", { name: ko.chat.replayAction })
        .first()
        .click();
      await synchronousReplay;
      expect(durableReplays).toBe(0);
    });
  }

  test("regeneration admits through replay/async, never the synchronous route", async ({
    page,
  }) => {
    await mockWorkspace(page);
    await mockDurableHealth(page, { enabled: true, ready: true });
    const replayBodies: unknown[] = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/messages/m-assistant/replay/async`,
      (route) => {
        replayBodies.push(route.request().postDataJSON());
        return route.fulfill({
          status: 202,
          json: {
            run_id: "run-regenerated",
            conversation_id: CONVERSATION_ID,
            status: "queued",
            client_request_id: "22222222-2222-4222-8222-222222222222",
          },
        });
      },
    );
    let synchronousReplays = 0;
    page.on("request", (request) => {
      if (/\/replay$/.test(new URL(request.url()).pathname)) {
        synchronousReplays += 1;
      }
    });
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/run-regenerated/stream*`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            delta(1, "새 답변"),
            {
              id: 2,
              event: "run_completed",
              data: {
                ...completedRun("새 답변입니다."),
                run_id: "run-regenerated",
              },
            },
          ]),
        }),
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await page
      .getByRole("button", { name: ko.chat.replayAction })
      .first()
      .click();

    await expect(page.getByText(ko.chat.replaySuccess)).toBeVisible();
    expect(replayBodies).toHaveLength(1);
    expect(
      (replayBodies[0] as { client_request_id: string }).client_request_id,
    ).toMatch(/^[0-9a-f-]{36}$/);
    expect(synchronousReplays).toBe(0);
  });

  test("a durable waiting run resumes through resume/async", async ({
    page,
  }) => {
    // No flag at all: resume follows the run's own `execution_mode`.
    await mockWorkspace(page, { interaction: "document_selection_v2" });
    let resumed = false;
    await page.route(`${API}/conversations/${CONVERSATION_ID}/runs`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: [
              {
                run_id: "run-waiting",
                conversation_id: CONVERSATION_ID,
                status: resumed ? "completed" : "waiting_for_input",
                route_label: null,
                created_at: "2030-01-01T00:00:00.000Z",
                execution_mode: "durable",
              },
            ],
          })
        : route.fallback(),
    );
    const resumeBodies: unknown[] = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/run-waiting/resume/async`,
      (route) => {
        resumeBodies.push(route.request().postDataJSON());
        resumed = true;
        return route.fulfill({
          status: 202,
          json: {
            run_id: "run-waiting",
            conversation_id: CONVERSATION_ID,
            status: "running",
            client_request_id: "33333333-3333-4333-8333-333333333333",
          },
        });
      },
    );
    // No cursor is known after a cold load, so the snapshot supplies it.
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/run-waiting/output`,
      (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            run_id: "run-waiting",
            conversation_id: CONVERSATION_ID,
            client_request_id: "33333333-3333-4333-8333-333333333333",
            status: "running",
            cursor: 5,
            partial_reply: "",
          },
        }),
    );
    const afters: string[] = [];
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/run-waiting/stream*`,
      (route) => {
        afters.push(
          new URL(route.request().url()).searchParams.get("after") ?? "",
        );
        return route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: sse([
            {
              id: 6,
              event: "run_resumed",
              data: {
                run_id: "run-waiting",
                interaction_id: "4a0b7c65-7c47-4bb3-9618-51ec95291843",
                interaction_schema_version: 2,
              },
            },
            delta(7, "선택한 문서로 답했습니다."),
            {
              id: 8,
              event: "run_completed",
              data: {
                ...completedRun("선택한 문서로 답했습니다."),
                run_id: "run-waiting",
              },
            },
          ]),
        });
      },
    );
    // The stored answer appears in the transcript once the resumed run ends.
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/messages`,
      (route) =>
        route.request().method() === "GET" && resumed
          ? route.fulfill({
              json: [
                {
                  id: "m-resumed",
                  conversation_id: CONVERSATION_ID,
                  role: "assistant",
                  content: "선택한 문서로 답했습니다.",
                },
              ],
            })
          : route.fallback(),
    );
    let legacyResumes = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/resume/stream")) legacyResumes += 1;
    });

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);
    await page
      .getByRole("button", { name: ko.chat.interactionChoose })
      .first()
      .click();

    await expect.poll(() => resumeBodies.length).toBe(1);
    expect(resumeBodies[0]).toMatchObject({
      answer: { kind: "select", document_id: "doc-contract" },
    });
    await expect.poll(() => afters).toEqual(["5"]);
    await expect(page.getByText("선택한 문서로 답했습니다.")).toBeVisible();
    expect(legacyResumes).toBe(0);
  });

  test("a stopped answer's partial text survives a reload beside the notice", async ({
    page,
  }) => {
    // Nothing was written to the transcript, so after a reload the partial
    // text exists only in the run's output. It is shown, never as an answer.
    await mockWorkspace(page);
    // Flag off: recovering an existing durable run does not depend on it.
    await mockDurableHealth(page, { enabled: false, ready: false });
    await page.route(`${API}/conversations/${CONVERSATION_ID}/runs`, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ json: [runSummary("cancelled")] })
        : route.fallback(),
    );
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/messages`,
      (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              json: [
                {
                  id: "m-user",
                  conversation_id: CONVERSATION_ID,
                  role: "user",
                  content: "긴 보고서를 써 주세요",
                },
              ],
            })
          : route.fallback(),
    );
    await page.route(
      `${API}/conversations/${CONVERSATION_ID}/runs/${RUN_ID}/output`,
      (route) =>
        route.fulfill({
          json: {
            schema_version: 1,
            run_id: RUN_ID,
            conversation_id: CONVERSATION_ID,
            client_request_id: "11111111-1111-4111-8111-111111111111",
            status: "cancelled",
            cursor: 3,
            partial_reply: "보고서의 첫 문단까지 작성했습니다",
          },
        }),
    );

    await page.goto(`/chat/${CONVERSATION_ID}`);
    await dismissOnboarding(page);

    await expect(
      page.getByText("보고서의 첫 문단까지 작성했습니다"),
    ).toBeVisible();
    await expect(page.getByText(ko.chat.cancelledRunNotice)).toBeVisible();
  });
});
