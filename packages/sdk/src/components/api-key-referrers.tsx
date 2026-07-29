import { Option, Schema } from "effect";

import { Badge } from "@/components/ui/badge";

const Metadata = Schema.Record(Schema.String, Schema.Unknown);
const MetadataJson = Schema.fromJsonString(Metadata);
const Referrers = Schema.Array(Schema.String);

const apiKeyMetadata = (metadata: unknown): Record<string, unknown> => {
  const decodedMetadata =
    typeof metadata === "string"
      ? Schema.decodeUnknownOption(MetadataJson)(metadata)
      : Schema.decodeUnknownOption(Metadata)(metadata);
  return Option.getOrElse(decodedMetadata, () => ({}));
};

export const apiKeyReferrers = (metadata: unknown) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Referrers)(
      apiKeyMetadata(metadata).allowedOrigins,
    ),
    () => [],
  );

export const withApiKeyReferrers = (
  metadata: unknown,
  referrers: ReadonlyArray<string>,
) => ({
  ...apiKeyMetadata(metadata),
  allowedOrigins: Array.from(referrers),
});

export const ApiKeyReferrers = ({
  metadata,
  unrestrictedLabel,
}: {
  metadata: unknown;
  unrestrictedLabel: string;
}) => {
  const referrers = apiKeyReferrers(metadata);
  if (referrers.length === 0) {
    return (
      <span className="text-muted-foreground text-sm">{unrestrictedLabel}</span>
    );
  }

  return (
    <div className="flex max-w-sm flex-wrap gap-1.5">
      {referrers.map((referrer) => (
        <Badge key={referrer} variant="secondary">
          {referrer}
        </Badge>
      ))}
    </div>
  );
};
