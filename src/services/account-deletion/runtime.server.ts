import { Layer, ManagedRuntime } from "effect";
import { AccountDeletions } from "./index";
import { accountDeletionEventsLayer } from "./subscriber";
import { sqlLayer } from "@/services/database";

export const accountDeletionRuntime = ManagedRuntime.make(
  AccountDeletions.layer.pipe(
    Layer.provideMerge(accountDeletionEventsLayer),
    Layer.provide(sqlLayer),
  ),
);

if (import.meta.hot)
  import.meta.hot.dispose(() => accountDeletionRuntime.dispose());
