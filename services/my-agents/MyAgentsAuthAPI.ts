import { API_PATH } from "@/constants/api-path";
import {
  type LoginRequest,
  type LoginResponse,
  loginResponseSchema,
  type SignupRequest,
  type SignupResponse,
  signupResponseSchema,
  type User,
  userSchema,
} from "@/model/my-agents";
import { type MyAgentsFetchClient, myAgentsFetchClient } from "./fetch-client";
import { parseWithSchema } from "./parser";

export class MyAgentsAuthAPI {
  constructor(
    private readonly client: MyAgentsFetchClient = myAgentsFetchClient,
  ) {}

  async signup(payload: SignupRequest): Promise<SignupResponse> {
    const value = await this.client.fetch(API_PATH.auth.signup, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(signupResponseSchema, value);
  }

  async login(payload: LoginRequest): Promise<LoginResponse> {
    const value = await this.client.fetch(API_PATH.auth.login, {
      method: "POST",
      body: payload,
    });
    return parseWithSchema(loginResponseSchema, value);
  }

  async logout(): Promise<void> {
    await this.client.fetch(API_PATH.auth.logout, { method: "POST" });
  }

  async me(): Promise<User> {
    const value = await this.client.fetch(API_PATH.auth.me, { method: "GET" });
    return parseWithSchema(userSchema, value);
  }
}
