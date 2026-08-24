import { Option, Schema } from "effect";

const Metadata = Schema.Record(Schema.String, Schema.Unknown);

export const mergeOrganizationMetadata = <T extends object>(
  current: typeof Schema.Unknown.Type,
  incoming: T,
): T => {
  const decoded = Schema.decodeUnknownOption(Metadata)(current);
  return Option.isSome(decoded) ? { ...decoded.value, ...incoming } : incoming;
};
