import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/reactivity";
import { Schema } from "effect";
import { useId, useState } from "react";
import { AppWindow, Building2, TriangleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { authClientApi } from "./auth-client-api.js";
import { requestAccountDeletion } from "./account-deletion-request.js";
import { refreshOnAuthChange } from "./auth-atoms.js";

const planQueries = Atom.family((baseUrl: string | undefined) =>
  Atom.family((userId: string) =>
    authClientApi(baseUrl)
      .query("authExtra", "getAccountDeletionPlan", {
        timeToLive: "0 seconds",
        serializationKey: `account-deletion:${userId}`,
      })
      .pipe(refreshOnAuthChange),
  ),
);
const plans = Atom.family((baseUrl: string | undefined) =>
  Atom.family((userId: string) =>
    Atom.optimistic(planQueries(baseUrl)(userId)),
  ),
);

export type AccountDeletionLabels = Record<
  | "title"
  | "description"
  | "projects"
  | "organizations"
  | "retention"
  | "missing"
  | "owner"
  | "admin"
  | "confirm"
  | "password"
  | "error"
  | "loadError"
  | "cancel"
  | "submit"
  | "done"
  | "complete",
  string
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
  const projectsId = useId();
  const organizationsId = useId();
  const [password, setPassword] = useState("");
  const planResult = useAtomValue(plans(props.baseUrl)(props.userId));
  const [mutation] = useState(() =>
    authClientApi(props.baseUrl).runtime.fn((password: string) =>
      requestAccountDeletion(password, props.baseUrl),
    ),
  );
  const remove = useAtomSet(mutation);
  const result = useAtomValue(mutation);
  const plan = AsyncResult.match(planResult, {
    onInitial: () => null,
    onFailure: () => null,
    onSuccess: ({ value }) => value,
  });
  const completed = AsyncResult.isSuccess(result) && result.value.success;
  const blockedByOrganizations = (plan?.organizations.length ?? 0) > 0;
  const busy = result.waiting;
  const disabled =
    !plan ||
    plan.organizations.length > 0 ||
    plan.adminAccount ||
    !Schema.is(Schema.Literal("DELETE"))(confirmation) ||
    busy;
  const labels = props.labels;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) {
          if (completed) props.onDeleted();
          else props.onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>
            {completed ? labels.complete : labels.description}
          </DialogDescription>
        </DialogHeader>
        {completed ? (
          <Button onClick={props.onDeleted}>{labels.done}</Button>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!disabled) remove(password);
            }}
          >
            {plan ? (
              <>
                {plan.projects.length ? (
                  <section aria-labelledby={projectsId} className="space-y-2">
                    <h3
                      id={projectsId}
                      className="text-muted-foreground text-xs font-medium"
                    >
                      {labels.projects}{" "}
                      <span className="ml-1 tabular-nums">
                        {plan.projects.length}
                      </span>
                    </h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {plan.projects.map((project) => (
                        <li key={project.id}>
                          <Card size="sm" className="h-full py-3 shadow-none">
                            <CardContent className="flex items-center gap-3 px-3">
                              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                                <AppWindow
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-medium break-words">
                                {project.name}
                              </span>
                              {!project.ready ? (
                                <span
                                  title={labels.missing}
                                  className="text-muted-foreground shrink-0"
                                >
                                  <TriangleAlert
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                  <span className="sr-only">
                                    {labels.missing}
                                  </span>
                                </span>
                              ) : null}
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                    {plan.projects.some((project) => !project.ready) ? (
                      <p
                        role="status"
                        className="text-muted-foreground text-xs"
                      >
                        {labels.missing}
                      </p>
                    ) : null}
                  </section>
                ) : null}
                {plan.organizations.length ? (
                  <section
                    aria-labelledby={organizationsId}
                    className="space-y-2"
                  >
                    <h3
                      id={organizationsId}
                      className="text-destructive text-xs font-medium"
                    >
                      {labels.organizations}{" "}
                      <span className="ml-1 tabular-nums">
                        {plan.organizations.length}
                      </span>
                    </h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {plan.organizations.map((organization) => (
                        <li key={organization.id}>
                          <Card
                            size="sm"
                            className="bg-destructive/5 ring-destructive/20 h-full py-3 shadow-none"
                          >
                            <CardContent className="flex items-center gap-3 px-3">
                              <span className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
                                {organization.personal ? (
                                  <UserRound
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                ) : (
                                  <Building2
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                )}
                              </span>
                              <span className="min-w-0 text-sm font-medium break-words">
                                {organization.name}
                              </span>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                    <p role="alert" className="text-destructive text-xs">
                      {labels.owner}
                    </p>
                  </section>
                ) : null}
                {plan.adminAccount ? (
                  <p role="alert" className="text-destructive text-sm">
                    {labels.admin}
                  </p>
                ) : null}
              </>
            ) : (
              <p role="status" className="text-muted-foreground text-sm">
                {labels.loadError}
              </p>
            )}
            {!blockedByOrganizations ? (
              <>
                <div className="flex flex-col gap-2">
                  <FieldLabel htmlFor={passwordId}>
                    {labels.password}
                  </FieldLabel>
                  <Input
                    id={passwordId}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <FieldLabel htmlFor={confirmationId}>
                    {labels.confirm}
                  </FieldLabel>
                  <Input
                    id={confirmationId}
                    value={confirmation}
                    autoComplete="off"
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
                {AsyncResult.isFailure(result) ? (
                  <p role="alert" className="text-destructive text-sm">
                    {labels.error}
                  </p>
                ) : null}
              </>
            ) : null}
            <p className="text-muted-foreground text-xs">{labels.retention}</p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={props.onClose}
              >
                {labels.cancel}
              </Button>
              {!blockedByOrganizations ? (
                <Button type="submit" variant="destructive" disabled={disabled}>
                  {labels.submit}
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
