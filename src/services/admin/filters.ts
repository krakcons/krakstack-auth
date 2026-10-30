import type { ColumnFilter } from "@krak-stack/registry/query";
import type { SqlClient, Statement } from "effect/sql";

/** Call only after the endpoint-specific query schema has validated the filters. */
export const adminFilterPredicate = (
  sql: SqlClient.SqlClient,
  filters: readonly ColumnFilter[] = [],
  kind: "user" | "organization",
) => {
  const columns: Readonly<Record<string, Statement.Fragment>> =
    kind === "user"
      ? {
          name: sql`u.name`,
          email: sql`u.email`,
          role: sql`COALESCE(u.role, 'user')`,
          emailVerified: sql`u.email_verified`,
          banned: sql`COALESCE(u.banned, false)`,
          createdAt: sql`u.created_at`,
          lastSignedIn: sql`(SELECT max(filter_session.created_at) FROM session filter_session WHERE filter_session.user_id = u.id)`,
        }
      : {
          name: sql`o.name`,
          slug: sql`o.slug`,
          createdAt: sql`o.created_at`,
          userId: sql`CASE WHEN o.user_id IS NULL THEN 'standard' ELSE 'personal' END`,
        };
  return filters.length
    ? sql.and(
        filters.map((filter) => {
          const column = columns[filter.id];
          if (!column) return sql`FALSE`;
          switch (filter.kind) {
            case "text": {
              const value = filter.value.toLowerCase();
              if (filter.operator === "equals")
                return sql`LOWER(${column}) = ${value}`;
              const escaped = value.replace(/[\\%_]/g, "\\$&");
              const pattern =
                filter.operator === "startsWith"
                  ? `${escaped}%`
                  : filter.operator === "endsWith"
                    ? `%${escaped}`
                    : `%${escaped}%`;
              return sql`LOWER(${column}) LIKE ${pattern} ESCAPE ${"\\"}`;
            }
            case "boolean":
              return sql`${column} = ${filter.value}`;
            case "values":
              return sql.or(
                filter.values.map((value) => sql`${column} = ${value}`),
              );
            case "date":
              return sql.and([
                filter.from
                  ? sql`${column} >= ${`${filter.from}T00:00:00.000Z`}`
                  : sql`TRUE`,
                filter.to
                  ? sql`${column} < ${new Date(new Date(`${filter.to}T00:00:00.000Z`).getTime() + 86_400_000).toISOString()}`
                  : sql`TRUE`,
              ]);
            default:
              return sql`FALSE`;
          }
        }),
      )
    : sql`TRUE`;
};
