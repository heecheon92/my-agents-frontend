import { z } from "zod";

export const userMemorySettingsSchema = z
  .object({
    enabled: z.boolean(),
    updated_at: z.string().datetime({ local: true, offset: true }),
  })
  .strict();

export const userMemorySettingsPatchRequestSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export type UserMemorySettings = z.infer<typeof userMemorySettingsSchema>;
export type UserMemorySettingsPatchRequest = z.infer<
  typeof userMemorySettingsPatchRequestSchema
>;
