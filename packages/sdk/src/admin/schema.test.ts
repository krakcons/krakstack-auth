import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { AdminListQuery } from "./schema.js";

describe("AdminListQuery", () => {
  it("decodes numeric pagination strings and supplies Registry defaults", () => {
    expect(
      Schema.decodeUnknownSync(AdminListQuery)({ page: "0", pageSize: "10" }),
    ).toEqual({ page: 0, pageSize: 10 });
    expect(Schema.decodeUnknownSync(AdminListQuery)({})).toEqual({
      page: 0,
      pageSize: 20,
    });
    expect(() =>
      Schema.decodeUnknownSync(AdminListQuery)({ page: "-1" }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(AdminListQuery)({ pageSize: "101" }),
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
    const query = Schema.decodeUnknownSync(codec)(input);
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
    expect(Schema.decodeUnknownSync(codec)({ sort: "" }).sort).toEqual([]);
    expect(() => Schema.decodeUnknownSync(codec)({ sort: "name,-" })).toThrow();
  });

  it("preserves structured sorting and project scope in JSON atom keys", () => {
    const codec = Schema.fromJsonString(
      Schema.Struct({ query: AdminListQuery, reloadKey: Schema.Number }),
    );
    const request = Schema.decodeUnknownSync(
      Schema.Struct({ query: AdminListQuery, reloadKey: Schema.Number }),
    )({
      query: {
        page: 2,
        pageSize: 25,
        sort: [{ id: "name", direction: "desc" }],
        projectId: "project-1",
      },
      reloadKey: 1,
    });
    expect(
      Schema.decodeUnknownSync(codec)(Schema.encodeSync(codec)(request)),
    ).toEqual(request);
  });
});
