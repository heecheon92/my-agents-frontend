import { z } from "zod";

export const userSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
  })
  .strict();

export const signupRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
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

export const signupResponseSchema = userSchema;

export type User = z.infer<typeof userSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type BackendLoginResponse = z.infer<typeof backendLoginResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
