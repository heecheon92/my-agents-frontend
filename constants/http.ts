export const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

export type HTTPMethod = (typeof HTTP_METHODS)[number];

export const HTTP_CONTENT_TYPE = {
  json: "application/json",
} as const;

export const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  methodNotAllowed: 405,
  conflict: 409,
  unsupportedMediaType: 415,
  internalServerError: 500,
  badGateway: 502,
} as const;
