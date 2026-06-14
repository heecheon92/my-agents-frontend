import { z } from "zod";

export const userTypeSchema = z.enum(["normal", "root", "system"]);

export const userSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email().nullable(),
    nickname: z.string().min(1).max(40),
    email_verified_at: z
      .string()
      .datetime({ local: true, offset: true })
      .nullable(),
    is_guest: z.boolean().optional(),
    guest_expires_at: z
      .string()
      .datetime({ local: true, offset: true })
      .nullable()
      .optional(),
    approval_status: z.enum(["approved", "pending", "rejected"]).optional(),
    user_type: userTypeSchema.optional(),
    can_manage_system_knowledge: z.boolean().default(false),
  })
  .strict();

export const signupRequestSchema = z
  .object({
    email: z.string().email(),
    nickname: z.string().trim().min(1).max(40),
    password: z.string().min(8).max(128),
  })
  .strict();

export const verifyEmailRequestSchema = z
  .object({
    token: z.string().min(1).max(256),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
  })
  .strict();

export const acceptedResponseSchema = z
  .object({
    status: z.string().default("accepted"),
  })
  .strict();

export const guestAccessRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export const guestAccessResponseSchema = z.preprocess(
  (value) => value ?? {},
  acceptedResponseSchema,
);

export const guestLoginRequestSchema = z
  .object({
    code: z.string().min(1).max(256),
  })
  .strict();

export const passwordResetRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();

export const passwordResetConfirmRequestSchema = z
  .object({
    token: z.string().min(1).max(256),
    new_password: z.string().min(8).max(128),
  })
  .strict();

export const accountNicknameUpdateRequestSchema = z
  .object({
    current_password: z.string().min(1).max(128),
    nickname: z.string().trim().min(1).max(40),
  })
  .strict();

export const accountPasswordUpdateRequestSchema = z
  .object({
    current_password: z.string().min(1).max(128),
    new_password: z.string().min(8).max(128),
  })
  .strict();

export const backendLoginResponseSchema = z
  .object({
    user: userSchema,
    csrf_token: z.string().min(1),
  })
  .strict();

export const loginResponseSchema = z
  .object({
    user: userSchema,
  })
  .strict();

export const signupResponseSchema = z
  .object({
    user: userSchema,
    verification_email_sent: z.boolean(),
    approval_required: z.boolean().default(false),
  })
  .strict();

export type User = z.infer<typeof userSchema>;
export type UserType = z.infer<typeof userTypeSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type GuestAccessRequest = z.infer<typeof guestAccessRequestSchema>;
export type GuestAccessResponse = z.infer<typeof guestAccessResponseSchema>;
export type GuestLoginRequest = z.infer<typeof guestLoginRequestSchema>;
export type BackendLoginResponse = z.infer<typeof backendLoginResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmRequest = z.infer<
  typeof passwordResetConfirmRequestSchema
>;
export type AccountNicknameUpdateRequest = z.infer<
  typeof accountNicknameUpdateRequestSchema
>;
export type AccountPasswordUpdateRequest = z.infer<
  typeof accountPasswordUpdateRequestSchema
>;
export type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;

export function canManageSystemKnowledge(
  user?: Pick<User, "can_manage_system_knowledge"> | null,
) {
  return user?.can_manage_system_knowledge === true;
}
