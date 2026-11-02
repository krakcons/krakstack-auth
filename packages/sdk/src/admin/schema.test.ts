import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  AdminListQuery,
  AdminUserListQuery,
  AdminOrganizationListQuery,
} from "./schema.js";

describe("AdminListQuery", () => {
  it("round-trips validated column filters with project scope through HTTP and atom keys", () => {
    const filters = [
      { id: "email", kind: "text", operator: "contains", value: "example.com" },
      { id: "emailVerified", kind: "boolean", value: false },
      { id: "createdAt", kind: "date", from: "2026-01-01", to: "2026-01-31" },
    ];
    const query = Schema.decodeUnknownSync(AdminUserListQuery)({
      filters,
      projectId: "project-a",
    });
    const http = Schema.toCodecStringTree(AdminUserListQuery);
    expect(Schema.decodeSync(http)(Schema.encodeSync(http)(query))).toEqual(
      query,
    );
    const atom = Schema.fromJsonString(AdminListQuery);
    expect(Schema.decodeSync(atom)(Schema.encodeSync(atom)(query))).toEqual(
      query,
    );
    expect(
      Schema.decodeSync(AdminOrganizationListQuery)({
        filters: [
          { id: "userId", kind: "values", values: ["standard", "personal"] },
        ],
      }).filters,
    ).toHaveLength(1);
  });

  it("rejects unsupported IDs, mismatched kinds, and unknown organization types", () => {
    for (const filter of [
      {
        id: "email; DROP TABLE user",
        kind: "text",
        operator: "contains",
        value: "a",
      },
      {
        id: "emailVerified",
        kind: "text",
        operator: "contains",
        value: "true",
      },
      { id: "projects", kind: "values", values: ["project-a"] },
    ])
      expect(() =>
        Schema.decodeUnknownSync(AdminUserListQuery)({ filters: [filter] }),
      ).toThrow();
    expect(() =>
      Schema.decodeSync(AdminOrganizationListQuery)({
        filters: [{ id: "userId", kind: "values", values: ["unknown"] }],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeSync(AdminOrganizationListQuery)({
        filters: [
          { id: "email", kind: "text", operator: "equals", value: "a" },
        ],
      }),
    ).toThrow();
  });
  it("decodes numeric pagination strings and supplies Registry defaults", () => {
    expect(
      Schema.decodeSync(AdminListQuery)({ page: "0", pageSize: "10" }),
    ).toEqual({ page: 0, pageSize: 10 });
    expect(Schema.decodeSync(AdminListQuery)({})).toEqual({
      page: 0,
      pageSize: 20,
    });
    expect(() => Schema.decodeSync(AdminListQuery)({ page: "-1" })).toThrow();
    expect(() =>
      Schema.decodeSync(AdminListQuery)({ pageSize: "101" }),
    ).toThrow();
  });

  it("decodes HTTP sorting into structured admin query state and preserves wire encoding", () => {
    const codec = Schema.toCodecStringTree(AdminListQuery);
    const input = {
      page: "2",
      pageSize: "25",
      sort: "-name,createdAt",
      projectId: "project-1",
    };
    const query = Schema.decodeSync(codec)(input);
    expect(query).toEqual({
      page: 2,
      pageSize: 25,
      sort: [
        { id: "name", direction: "desc" },
        { id: "createdAt", direction: "asc" },
      ],
      projectId: "project-1",
    });
    expect(Schema.encodeSync(codec)(query)).toEqual(input);
    expect(Schema.decodeSync(codec)({ sort: "" }).sort).toEqual([]);
    expect(() => Schema.decodeSync(codec)({ sort: "name,-" })).toThrow();
  });

  it("preserves structured sorting and project scope in JSON atom keys", () => {
    const codec = Schema.fromJsonString(
      Schema.Struct({ query: AdminListQuery, reloadKey: Schema.Finite }),
    );
    const request = Schema.decodeSync(
      Schema.Struct({ query: AdminListQuery, reloadKey: Schema.Finite }),
    )({
      query: {
        page: 2,
        pageSize: 25,
        sort: [{ id: "name", direction: "desc" }],
        projectId: "project-1",
      },
      reloadKey: 1,
    });
    expect(Schema.decodeSync(codec)(Schema.encodeSync(codec)(request))).toEqual(
      request,
    );
  });
});
