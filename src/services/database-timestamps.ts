import { types } from "pg";

// Legacy timestamp-without-time-zone columns store UTC, not the process timezone.
// Use pg's date parser so PostgreSQL's infinity values remain supported too.
export const parseUtcTimestamp = (value: string) =>
  types.getTypeParser(types.builtins.TIMESTAMPTZ)(
    value === "infinity" || value === "-infinity"
      ? value
      : value.replace(/(?= BC$)|$/, "Z"),
  );
