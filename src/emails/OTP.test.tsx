import { render } from "@react-email/components";
import { describe, expect, it } from "@effect/vitest";

import { OTPEmail } from "./OTP";

describe("OTPEmail", () => {
  it("renders project theme colors", async () => {
    const html = await render(
      <OTPEmail
        appName="VolunteerConnector"
        code="123456"
        description="Use this code to sign in."
        logo="https://example.org/volunteer-connector-logo.svg"
        theme={{
          background: "#F6F6F6",
          foreground: "#3E4B51",
          primary: "#F56476",
          muted: "#F9F9F9",
          border: "#D9D9D9",
        }}
      />,
    );

    expect(html).toContain("VolunteerConnector");
    expect(html).toContain("rgb(246,246,246)");
    expect(html).toContain("rgb(62,75,81)");
    expect(html).toContain("rgb(249,249,249)");
  });
});
