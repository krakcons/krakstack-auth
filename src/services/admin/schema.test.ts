import { describe, expect, it } from "@effect/vitest";
import { AdminListQuery } from "@krak-stack/auth/admin";
import { Schema } from "effect";

import { AdminListRequest } from "./schema";

describe("AdminListRequest", () => {
  it("keeps numeric pagination defaults and structured sorting at the SQL boundary", () => {
    const query = Schema.decodeUnknownSync(
      Schema.toCodecStringTree(AdminListQuery),
    )({
      sort: "-name",
      projectId: "project-1",
    });
    expect(Schema.encodeSync(AdminListRequest)(query)).toEqual({
      page: 0,
      pageSize: 20,
      sort: [{ id: "name", direction: "desc" }],
      projectId: "project-1",
    });
  });
});
