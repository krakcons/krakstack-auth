import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import {
  ErrorMessage,
  SubmitButton,
  TextField,
} from "@krak-stack/registry/effect-form";
import { CopyButton } from "@krak-stack/registry/copy-button";
import { AsyncResult } from "effect/reactivity";
import { Schema } from "effect";
import { useEffect, useState } from "react";
import type { OrganizationSsoConnection } from "@krak-stack/auth/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages";
import { SsoDomain, SsoIssuer } from "../schema";
import {
  organizationSsoAtom,
  saveOrganizationSsoAtom,
  verifyOrganizationSsoAtom,
  enableOrganizationSsoAtom,
  deleteOrganizationSsoAtom,
} from "./atom";

const builder = FormBuilder.empty
  .addField("issuer", SsoIssuer)
  .addField("domain", SsoDomain)
  .addField("clientId", Schema.NonEmptyString)
  .addField("clientSecret", Schema.String);

export const OrganizationSsoSettingsPanel = ({
  organizationId,
}: {
  organizationId: string;
}) => {
  const result = useAtomValue(organizationSsoAtom(organizationId));
  return AsyncResult.match(result, {
    onInitial: () => <p role="status">{m.sso_loading()}</p>,
    onFailure: () => <ErrorMessage text={m.sso_load_error()} />,
    onSuccess: ({ value }) => (
      <OrganizationSsoForm
        key={value?.providerId ?? "new"}
        organizationId={organizationId}
        connection={value}
      />
    ),
  });
};

const OrganizationSsoForm = ({
  organizationId,
  connection,
}: {
  organizationId: string;
  connection: typeof OrganizationSsoConnection.Type | null;
}) => {
  const [form] = useState(() =>
    FormReact.make(builder, {
      fields: {
        issuer: TextField,
        domain: TextField,
        clientId: TextField,
        clientSecret: TextField,
      },
      onSubmit: (_, { decoded: { clientSecret, ...value }, get }) =>
        get.setResult(saveOrganizationSsoAtom(organizationId), {
          ...value,
          clientSecret: clientSecret || undefined,
        }),
    }),
  );
  const submit = useAtomSet(form.submit);
  const result = useAtomValue(form.submit);
  const clearSecret = useAtomSet(
    form.getFieldAtoms(form.fields.clientSecret).setValue,
  );
  useEffect(() => {
    if (AsyncResult.isSuccess(result) && !result.waiting) clearSecret("");
  }, [result, clearSecret]);
  const verify = useAtomSet(verifyOrganizationSsoAtom(organizationId));
  const verificationResult = useAtomValue(
    verifyOrganizationSsoAtom(organizationId),
  );
  const enable = useAtomSet(enableOrganizationSsoAtom(organizationId));
  const enableResult = useAtomValue(enableOrganizationSsoAtom(organizationId));
  const remove = useAtomSet(deleteOrganizationSsoAtom(organizationId));
  const removeResult = useAtomValue(deleteOrganizationSsoAtom(organizationId));
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const busy =
    result.waiting ||
    verificationResult.waiting ||
    enableResult.waiting ||
    removeResult.waiting;
  const failed =
    AsyncResult.isFailure(result) ||
    AsyncResult.isFailure(verificationResult) ||
    AsyncResult.isFailure(enableResult) ||
    AsyncResult.isFailure(removeResult);
  const callbackUrl = connection
    ? (connection.callbackURL ??
      `${window.location.origin}/api/auth/sso/callback/${connection.providerId}`)
    : "";
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="font-medium">{m.sso_settings_title()}</h2>
        <p className="text-muted-foreground text-sm">
          {m.sso_settings_description()}
        </p>
      </div>
      <form.Initialize
        defaultValues={{
          issuer: connection?.issuer ?? "",
          domain: connection?.domain ?? "",
          clientId: connection?.clientId ?? "",
          clientSecret: "",
        }}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submit();
          }}
        >
          <fieldset disabled={busy} className="contents">
            <form.issuer
              label={m.sso_issuer()}
              disabled={Boolean(connection)}
              placeholder="https://login.microsoftonline.com/…/v2.0"
            />
            <form.domain
              label={m.sso_domain()}
              disabled={Boolean(connection)}
              placeholder="example.com"
            />
            <form.clientId label={m.sso_client_id()} autoComplete="off" />
            <form.clientSecret
              label={m.sso_client_secret()}
              type="password"
              required={!connection}
              autoComplete="new-password"
              description={connection ? m.sso_secret_unchanged() : undefined}
            />
            <p className="text-muted-foreground text-sm">{m.sso_save_help()}</p>
            <SubmitButton form={form}>{m.sso_save()}</SubmitButton>
          </fieldset>
        </form>
      </form.Initialize>
      {connection ? (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="sso-callback">{m.sso_callback()}</label>
            <div className="flex gap-2">
              <Input id="sso-callback" readOnly value={callbackUrl} />
              <CopyButton value={callbackUrl} />
            </div>
          </div>
          <div className="rounded-md border p-4">
            <h3 className="font-medium">{m.sso_domain_verification()}</h3>
            <p className="text-muted-foreground text-sm">{m.sso_dns_help()}</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <dt>{m.sso_dns_name()}</dt>
              <dd className="font-mono break-all">
                {connection.verificationName}
              </dd>
              <dt>{m.sso_dns_value()}</dt>
              <dd className="font-mono break-all">
                {connection.verificationToken}
              </dd>
            </dl>
            <p className="my-3" role="status">
              {connection.domainVerified
                ? m.sso_verified()
                : m.sso_unverified()}
            </p>
            {!connection.domainVerified ? (
              <Button disabled={busy} onClick={() => verify()}>
                {m.sso_verify()}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || !connection.domainVerified}
              onClick={() => enable(!connection.enabled)}
            >
              {connection.enabled ? m.sso_disable() : m.sso_enable()}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmingRemoval(true)}
            >
              {m.sso_remove()}
            </Button>
          </div>
          <p role="status">
            {connection.enabled
              ? m.sso_enabled_status()
              : m.sso_disabled_status()}
          </p>
          {confirmingRemoval ? (
            <div className="rounded-md border p-4">
              <p>{m.sso_remove_warning()}</p>
              <div className="mt-3 flex gap-3">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => remove()}
                >
                  {m.sso_remove_confirm()}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmingRemoval(false)}
                >
                  {m.sso_cancel()}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {failed ? <ErrorMessage text={m.sso_action_error()} /> : null}
    </section>
  );
};
