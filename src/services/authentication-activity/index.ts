import { Config, DateTime, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { DailyActiveUsersByDay } from "@krak-stack/auth/admin";
import { activeUserEvent } from "./schema";

export const authenticationActivitySummary = Effect.fn(
  "AuthenticationActivity.summary",
)(function* ({ projectId, days = 14 }: { projectId?: string; days?: number }) {
  const sql = yield* SqlClient.SqlClient;
  const organizationId = yield* Config.String(
    "VITE_KRAKSTACK_AUTH_ORGANIZATION_ID",
  );
  const now = yield* DateTime.now;
  const today = DateTime.toDateUtc(now);
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const rows = yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: DailyActiveUsersByDay,
    execute: () => sql`SELECT
          to_char(to_timestamp(e.occurred_at / 1000) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          count(DISTINCT e.user_id)::int AS count
          FROM events e
          WHERE e.source = 'server' AND e.event_name = ${activeUserEvent}
            AND e.organization_id = ${organizationId} AND e.user_id IS NOT NULL
            AND e.occurred_at >= ${start.getTime()} AND e.occurred_at <= ${DateTime.toEpochMillis(now)}
            ${
              projectId
                ? sql`AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(e.payload_json #> '{resourceLogs,0,scopeLogs,0,logRecords,0,attributes}') attribute
              WHERE attribute->>'key' = 'app.projectId' AND attribute->'value'->>'stringValue' = ${projectId}
            )`
                : sql``
            }
          GROUP BY 1`,
  })(undefined);
  const usersByDay = new Map(rows.map(({ date, count }) => [date, count]));
  return {
    dailyActiveUsers: usersByDay.get(today.toISOString().slice(0, 10)) ?? 0,
    dailyActiveUsersByDay: Array.from({ length: days }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, count: usersByDay.get(key) ?? 0 };
    }),
  };
});
