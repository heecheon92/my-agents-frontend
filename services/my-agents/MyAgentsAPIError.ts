export class MyAgentsAPIError extends Error {
  readonly name = "MyAgentsAPIError";
  readonly status: number;
  readonly detail?: string;
  readonly body?: unknown;

  constructor({
    message,
    status,
    detail,
    body,
  }: {
    message: string;
    status: number;
    detail?: string;
    body?: unknown;
  }) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

export function isMyAgentsAPIError(error: unknown): error is MyAgentsAPIError {
  return error instanceof MyAgentsAPIError;
}
