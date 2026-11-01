import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/reactivity";
import { Effect, Schema } from "effect";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { authClientApi, authHttpClient } from "./auth-client-api.js";

const plans = Atom.family((baseUrl: string | undefined) => Atom.family((userId: string) => Atom.optimistic(authClientApi(baseUrl).query("authExtra", "getAccountDeletionPlan", { timeToLive: "0 seconds", serializationKey: `account-deletion:${userId}` }))));

export type AccountDeletionLabels = Record<
  "title" | "description" | "projects" | "missing" | "owner" | "admin" | "confirm" | "password" | "error" | "loadError" | "cancel" | "submit" | "done" | "complete", string
>;

export const AccountDeletionDialog = (props: {
  baseUrl?: string | undefined;
  userId: string;
  labels: AccountDeletionLabels;
  onClose: () => void;
  onDeleted: () => void;
}) => {
  const [confirmation, setConfirmation] = useState("");
  const passwordId = useId();
  const confirmationId = useId();
  const [password, setPassword] = useState("");
  const planResult = useAtomValue(plans(props.baseUrl)(props.userId));
  const [mutation] = useState(() => authClientApi(props.baseUrl).runtime.fn((password: string) => authHttpClient(props.baseUrl).pipe(
    Effect.flatMap((client) => client.auth.deleteUser({ payload: { password: password || undefined } })),
  )));
  const remove = useAtomSet(mutation);
  const result = useAtomValue(mutation);
  const plan = AsyncResult.match(planResult, { onInitial: () => null, onFailure: () => null, onSuccess: ({ value }) => value });
  const completed = AsyncResult.isSuccess(result) && result.value.success;
  const disabled = !plan || plan.organizations.length > 0 || plan.adminAccount || !Schema.is(Schema.Literal("DELETE"))(confirmation) || result.waiting;
  const labels = props.labels;
  return <Dialog open onOpenChange={(open) => {
    if (!open && !result.waiting) {
      if (completed) props.onDeleted();
      else props.onClose();
    }
  }}>
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{labels.title}</DialogTitle><DialogDescription>{completed ? labels.complete : labels.description}</DialogDescription></DialogHeader>
      {completed ? <Button onClick={props.onDeleted}>{labels.done}</Button> : <form className="flex flex-col gap-4" onSubmit={(event) => {
        event.preventDefault();
        if (!disabled) remove(password);
      }}>
        {plan ? <>
          <div><p className="font-medium">{labels.projects}</p><ul>{plan.projects.map((project) => <li key={project.id}>{project.name}</li>)}</ul></div>
          {plan.projects.some((project) => !project.ready) ? <p role="status">{labels.missing}</p> : null}
          {plan.organizations.length ? <div role="alert"><p>{labels.owner}</p><ul>{plan.organizations.map((organization) => <li key={organization.id}>{organization.name}</li>)}</ul></div> : null}
          {plan.adminAccount ? <p role="alert">{labels.admin}</p> : null}
        </> : <p role="status">{labels.loadError}</p>}
        <div className="flex flex-col gap-2"><FieldLabel htmlFor={passwordId}>{labels.password}</FieldLabel><Input id={passwordId} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>
        <div className="flex flex-col gap-2"><FieldLabel htmlFor={confirmationId}>{labels.confirm}</FieldLabel><Input id={confirmationId} value={confirmation} autoComplete="off" onChange={(event) => setConfirmation(event.target.value)} /></div>
        {AsyncResult.isFailure(result) ? <p role="alert">{labels.error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={result.waiting} onClick={props.onClose}>{labels.cancel}</Button><Button type="submit" variant="destructive" disabled={disabled}>{labels.submit}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
};
