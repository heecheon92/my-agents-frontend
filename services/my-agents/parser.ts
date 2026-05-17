import { z } from "zod";

export function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema> {
  return schema.parse(value);
}

export function parseArrayWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.infer<TSchema>[] {
  return z.array(schema).parse(value);
}
