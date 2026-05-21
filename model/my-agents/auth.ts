import { z } from "zod";

export const userSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email().nullable(),
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
  })
  .strict();

export const signupRequestSchema = z
  .object({
    email: z.string().email(),
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

export const guestAccessResponseSchema = z
  .object({
    code: z.string().min(1).max(256),
    expires_at: z.string().datetime({ local: true, offset: true }).optional(),
  })
  .strict();

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

export const acceptedResponseSchema = z
  .object({
    status: z.string().default("accepted"),
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
  })
  .strict();

export type User = z.infer<typeof userSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type GuestAccessResponse = z.infer<typeof guestAccessResponseSchema>;
export type GuestLoginRequest = z.infer<typeof guestLoginRequestSchema>;
export type BackendLoginResponse = z.infer<typeof backendLoginResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmRequest = z.infer<
  typeof passwordResetConfirmRequestSchema
>;
export type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;
