import { API_PATH } from "@/constants/api-path";
import {
  type AcceptedResponse,
  acceptedResponseSchema,
  type GuestAccessRequest,
  guestAccessResponseSchema,
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type PasswordResetConfirmRequest,
  type PasswordResetRequest,
  type SignupRequest,
  type SignupResponse,
  signupResponseSchema,
  type User,
  userSchema,
  type VerifyEmailRequest,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

export class MyAgentsAuthAPI {
  constructor(
    private readonly client: Pick<
      MyAgentsFetchClient,
      "fetch"
    > = myAgentsFetchClient,
  ) {}

  async signup(payload: SignupRequest): Promise<SignupResponse> {
    const value = await this.client.fetch(API_PATH.auth.signup, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(signupResponseSchema, value);
  }

  async verifyEmail(payload: VerifyEmailRequest): Promise<User> {
    const value = await this.client.fetch(API_PATH.auth.verifyEmail, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(userSchema, value);
  }

  async login(payload: LoginRequest): Promise<LoginResponse> {
    const value = await this.client.fetch(API_PATH.auth.login, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(loginResponseSchema, value);
  }

  async requestGuestAccess(
    payload: GuestAccessRequest,
  ): Promise<AcceptedResponse> {
    const value = await this.client.fetch(API_PATH.auth.guestRequest, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(guestAccessResponseSchema, value);
  }

  async loginGuest(code: string): Promise<LoginResponse> {
    const value = await this.client.fetch(API_PATH.auth.guestLogin, {
      method: "POST",
      body: { code },
    });
    return parseWithSchema(loginResponseSchema, value);
  }

  async requestPasswordReset(
    payload: PasswordResetRequest,
  ): Promise<AcceptedResponse> {
    const value = await this.client.fetch(API_PATH.auth.passwordResetRequest, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(acceptedResponseSchema, value);
  }

  async confirmPasswordReset(
    payload: PasswordResetConfirmRequest,
  ): Promise<void> {
    await this.client.fetch(API_PATH.auth.passwordResetConfirm, {
      method: "POST",
      body: payload,
    });
  }

  async logout(): Promise<void> {
    await this.client.fetch(API_PATH.auth.logout, { method: "POST" });
  }

  async me(): Promise<User> {
    const value = await this.client.fetch(API_PATH.auth.me, { method: "GET" });
    return parseWithSchema(userSchema, value);
  }
}
