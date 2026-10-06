import { Schema } from "effect";

export const DomainWrite = Schema.Struct({
  id: Schema.String,
  hostname: Schema.String,
  rootHostname: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  organizationId: Schema.NullOr(Schema.String),
  hostnameId: Schema.String,
  managed: Schema.Boolean,
  active: Schema.Boolean,
}).annotate({ identifier: "DomainWrite" });

export const DomainLinkUpdate = Schema.Struct({
  id: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  organizationId: Schema.NullOr(Schema.String),
  managed: Schema.Boolean,
}).annotate({ identifier: "DomainLinkUpdate" });

export const DomainStatusUpdate = Schema.Struct({
  id: Schema.String,
  active: Schema.Boolean,
}).annotate({ identifier: "DomainStatusUpdate" });

export const DomainMatchRequest = Schema.Struct({
  hostname: Schema.String,
  rootHostname: Schema.String,
}).annotate({ identifier: "DomainMatchRequest" });

export const DomainSiblingRequest = Schema.Struct({
  hostname: Schema.String,
  id: Schema.String,
}).annotate({ identifier: "DomainSiblingRequest" });

export const DomainRemovalRequest = Schema.Struct({
  id: Schema.String,
  hostnameId: Schema.String,
}).annotate({ identifier: "DomainRemovalRequest" });
