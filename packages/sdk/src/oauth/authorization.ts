import { Option, Schema } from "effect";

const RepeatedOAuthValues = Schema.fromJsonString(
  Schema.NonEmptyArray(Schema.String),
).annotate({ identifier: "RepeatedOAuthQueryValues" });

/** Extract only the provider-signed parameters. Modern Better Auth queries
 * declare them with repeated ba_param entries, independent of URL ordering. */
export const getOAuthAuthorizationQuery = (searchString: string) => {
  const search = new URLSearchParams(searchString);
  if (!search.has("sig") || !search.has("client_id")) return null;
  // Recover links normalized by a JSON-first router. This only restores
  // known repeatable protocol fields; the provider still verifies the signature.
  for (const key of ["ba_param", "resource"]) {
    const values = search.getAll(key);
    if (values.length !== 1 || values[0] === undefined) continue;
    const parsed = Schema.decodeOption(RepeatedOAuthValues)(values[0]);
    if (Option.isSome(parsed)) {
      search.delete(key);
      for (const value of parsed.value) search.append(key, value);
    }
  }
  const parameterNames = search.getAll("ba_param");
  if (parameterNames.length) {
    const names = new Set([...parameterNames, "sig", "ba_param"]);
    const signed = new URLSearchParams();
    for (const [key, value] of search)
      if (names.has(key)) signed.append(key, value);
    return signed.toString();
  }
  // Compatibility with providers that do not publish a signed-field manifest.
  const signed = new URLSearchParams();
  for (const [key, value] of search) {
    signed.append(key, value);
    if (key === "sig") break;
  }
  return signed.toString();
};
