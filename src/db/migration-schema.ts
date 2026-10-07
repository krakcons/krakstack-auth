import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const Definition = Schema.Struct({
  name: Schema.String,
  definition: Schema.String,
}).annotate({ identifier: "MigrationSchemaDefinition" });

export const applicationTables = [
  "account",
  "apikey",
  "domains",
  "invitation",
  "jwks",
  "member",
  "oauth_access_token",
  "oauth_client",
  "oauth_client_assertion",
  "oauth_client_resource",
  "oauth_consent",
  "oauth_refresh_token",
  "oauth_resource",
  "organization",
  "project",
  "project_organization",
  "project_user",
  "session",
  "two_factor",
  "user",
  "verification",
];

// Compare complete application definitions, excluding unrelated workflow tables.
// Column order and PostgreSQL 18's NOT NULL constraint names are not semantic;
// nullability itself is checked on the columns.
export const schemaDefinitions = Effect.fn("Database.schemaDefinitions")(
  function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* SqlSchema.findAll({
      Request: Schema.Void,
      Result: Definition,
      execute: () => sql`
      SELECT c.relname AS name, jsonb_build_object(
        'table', c.relname, 'kind', c.relkind, 'persistence', c.relpersistence,
        'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity,
        'columns', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
            'notNull', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
            'default', pg_get_expr(d.adbin, d.adrelid),
            'collation', CASE WHEN a.attcollation = 0 THEN NULL ELSE
              (SELECT cn.nspname || '.' || co.collname FROM pg_collation co
                JOIN pg_namespace cn ON cn.oid = co.collnamespace WHERE co.oid = a.attcollation) END,
            'enum', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = a.atttypid)
          ) ORDER BY a.attname)
          FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ), '[]'::jsonb),
        'constraints', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', con.conname, 'definition', pg_get_constraintdef(con.oid),
            'deferrable', con.condeferrable, 'deferred', con.condeferred, 'validated', con.convalidated
          ) ORDER BY con.conname) FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype <> 'n'
        ), '[]'::jsonb),
        'indexes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', ic.relname, 'definition', pg_get_indexdef(i.indexrelid),
            'valid', i.indisvalid, 'ready', i.indisready, 'live', i.indislive
          ) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid WHERE i.indrelid = c.oid
        ), '[]'::jsonb),
        'triggers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', t.tgname, 'definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled
          ) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
        ), '[]'::jsonb),
        'policies', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive,
            'roles', (SELECT jsonb_agg(CASE WHEN role_id = 0 THEN 'public' ELSE pg_get_userbyid(role_id) END ORDER BY role_id)
              FROM unnest(p.polroles) AS role_id),
            'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)
          ) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = c.oid
        ), '[]'::jsonb)
      )::text AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND ${sql.in("c.relname", applicationTables)}
      ORDER BY c.relname
    `,
    })();
  },
);
