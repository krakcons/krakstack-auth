import { Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

import { LocaleContext, LocaleSchema } from "@/lib/localization";

const RecipientLocale = Schema.Struct({
  locale: Schema.NullOr(Schema.String),
}).annotate({ identifier: "RecipientLocale" });

export const resolveRecipientLocale = Effect.fn("Auth.resolveRecipientLocale")(
  function* ({
    email,
    request,
  }: {
    email: string;
    request?: Request | undefined;
  }) {
    const sql = yield* SqlClient.SqlClient;
    const recipients = yield* SqlSchema.findAll({
      Request: Schema.String,
      Result: RecipientLocale,
      execute: (address) =>
        sql`SELECT locale FROM "user" WHERE email = ${address.toLowerCase()} LIMIT 1`,
    })(email);
    return Schema.decodeUnknownOption(LocaleSchema)(recipients[0]?.locale).pipe(
      Option.getOrElse(() =>
        request ? LocaleContext.fromRequest(request).locale : "en",
      ),
    );
  },
);
