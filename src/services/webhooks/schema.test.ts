import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import {
  ConfigureProjectWebhook,
  allowDevelopmentWebhookLoopback,
  configureProjectWebhookSchema,
} from "./schema";

describe("Project webhook URL validation", () => {
  it("enables the application exception only in Vite development mode", () => {
    const development = import.meta.env.DEV && import.meta.env.MODE === "development";
    expect(allowDevelopmentWebhookLoopback).toBe(development);
    expect(Schema.is(ConfigureProjectWebhook)({ url: "http://localhost:3000/api/webhooks/auth" })).toBe(development);
  });
  it("allows HTTP loopback only in the development schema, not private networks or credentials", () => {
    const development = configureProjectWebhookSchema(true);
    const production = configureProjectWebhookSchema(false);
    for (const url of [
      "http://localhost:3000/api/webhooks/auth",
      "http://127.0.0.1:3000/api/webhooks/auth",
      "http://[::1]:3000/api/webhooks/auth",
    ]) {
      expect(Schema.is(development)({ url })).toBe(true);
      expect(Schema.is(production)({ url })).toBe(false);
    }
    for (const url of [
      "http://10.0.0.1/hook",
      "http://169.254.169.254/hook",
      "http://localhost.example/hook",
      "http://user:pass@localhost/hook",
    ]) {
      expect(Schema.is(development)({ url })).toBe(false);
    }
  });
  it("accepts public HTTPS destinations", () => {
    expect(
      Schema.is(ConfigureProjectWebhook)({
        url: "https://receiver.example.com/api/webhooks/auth",
      }),
    ).toBe(true);
  });

  it("rejects insecure, malformed, credential-bearing, and private destinations", () => {
    for (const url of [
      "http://localhost:3000/api/webhooks/auth",
      "https://localhost:3000/api/webhooks/auth",
      "https://127.0.0.1/api/webhooks/auth",
      "https://192.168.1.1/api/webhooks/auth",
      "https://[::1]/api/webhooks/auth",
      "https://user:password@example.com/api/webhooks/auth",
      "http://example.com/api/webhooks/auth",
      "https://",
    ])
      expect(Schema.is(configureProjectWebhookSchema(false))({ url })).toBe(false);
  });
});
