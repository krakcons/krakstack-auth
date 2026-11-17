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
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronDownIcon,
  KeyRoundIcon,
  LinkIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { OrganizationSsoConnection } from "../auth/schema.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { KrakstackAuthLocale } from "./auth-provider.js";
import { organizationSsoAtoms } from "./organization-sso-atom.js";
import { organizationSsoMessages } from "./organization-sso-messages.js";

const builder = FormBuilder.empty
  .addField("issuer", Schema.Trim.check(Schema.isNonEmpty()))
  .addField("domain", Schema.Trim.check(Schema.isNonEmpty()))
  .addField("clientId", Schema.Trim.check(Schema.isNonEmpty()))
  .addField("clientSecret", Schema.String);

const SsoSettingsCard = ({
  title,
  description,
  icon,
  open,
  children,
}: {
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  open: boolean;
  children: ReactNode;
}) => (
  <details className="group rounded-lg border" open={open}>
    <summary className="hover:bg-muted/40 focus-visible:ring-ring flex cursor-pointer list-none items-center gap-3 rounded-lg p-4 focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
      <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-full border">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {description}
      </span>
      <ChevronDownIcon
        className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div className="px-4 pt-3 pb-4">{children}</div>
  </details>
);

export const OrganizationSsoSettingsPanel = ({
  organizationId,
  baseUrl,
  locale,
}: {
  organizationId: string;
  baseUrl?: string;
  locale: KrakstackAuthLocale;
}) => {
  const m = organizationSsoMessages[locale];
  const atoms = organizationSsoAtoms(baseUrl)(organizationId);
  const result = useAtomValue(atoms.settings);
  return AsyncResult.match(result, {
    onInitial: () => <p role="status">{m.sso_loading()}</p>,
    onFailure: () => <ErrorMessage text={m.sso_load_error()} />,
    onSuccess: ({ value }) => (
      <OrganizationSsoForm
        key={value?.providerId ?? "new"}
        atoms={atoms}
        connection={value}
        m={m}
      />
    ),
  });
};

const OrganizationSsoForm = ({
  atoms,
  connection,
  m,
}: {
  atoms: ReturnType<ReturnType<typeof organizationSsoAtoms>>;
  connection: typeof OrganizationSsoConnection.Type | null;
  m: (typeof organizationSsoMessages)[KrakstackAuthLocale];
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
        get.setResult(atoms.save, {
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
    if (AsyncResult.isSuccess(result) && !result.waiting) {
      clearSecret("");
    }
  }, [result, clearSecret]);
  const verify = useAtomSet(atoms.verify);
  const verificationResult = useAtomValue(atoms.verify);
  const enable = useAtomSet(atoms.enable);
  const enableResult = useAtomValue(atoms.enable);
  const remove = useAtomSet(atoms.remove);
  const removeResult = useAtomValue(atoms.remove);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [callbackInitiallyOpen] = useState(() => !connection?.enabled);
  const removeButton = useRef<HTMLButtonElement>(null);
  const restoreRemovalFocus = useRef(false);
  useLayoutEffect(() => {
    if (!confirmingRemoval && restoreRemovalFocus.current) {
      restoreRemovalFocus.current = false;
      removeButton.current?.focus();
    }
  }, [confirmingRemoval]);
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
  const callbackUrl = connection?.callbackURL;
  return (
    <>
      {confirmingRemoval ? (
        <section
          aria-label={m.sso_remove_title()}
          className="flex flex-col gap-4"
        >
          <div className="space-y-2">
            <h2 className="text-base font-medium">{m.sso_remove_title()}</h2>
            <p className="text-muted-foreground text-sm">
              {m.sso_remove_warning()}
            </p>
          </div>
          {AsyncResult.isFailure(removeResult) ? (
            <ErrorMessage text={m.sso_action_error()} />
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              autoFocus
              variant="outline"
              disabled={busy}
              onClick={() => {
                // Restore focus after React has made the settings visible,
                // before the dialog handles the removed confirmation button.
                restoreRemovalFocus.current = true;
                setConfirmingRemoval(false);
              }}
            >
              {m.sso_cancel()}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => remove()}
            >
              {m.sso_remove_confirm()}
            </Button>
          </div>
        </section>
      ) : null}
      <section
        className={confirmingRemoval ? "hidden" : "flex min-w-0 flex-col gap-4"}
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm leading-none font-medium">
              {m.sso_settings_title()}
            </h2>
            {connection ? (
              <Badge
                variant={connection.enabled ? "default" : "secondary"}
                role="status"
              >
                {connection.enabled
                  ? m.sso_status_enabled()
                  : m.sso_status_disabled()}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">
            {m.sso_settings_description()}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <SsoSettingsCard
            title={m.sso_connection_details()}
            icon={<KeyRoundIcon className="size-5" aria-hidden="true" />}
            open={!connection}
            description={
              connection ? (
                <span className="text-muted-foreground mt-1 block text-xs break-all">
                  {connection.domain}
                </span>
              ) : null
            }
          >
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
                    placeholder="https://accounts.google.com"
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
                    description={
                      connection ? m.sso_secret_unchanged() : undefined
                    }
                  />
                  <p className="text-muted-foreground text-sm">
                    {connection ? m.sso_update_help() : m.sso_save_help()}
                  </p>
                  <SubmitButton form={form}>{m.sso_save()}</SubmitButton>
                </fieldset>
              </form>
            </form.Initialize>
          </SsoSettingsCard>
          {connection ? (
            <>
              {callbackUrl ? (
                <SsoSettingsCard
                  title={m.sso_callback_step()}
                  icon={<LinkIcon className="size-5" aria-hidden="true" />}
                  open={callbackInitiallyOpen}
                  description={
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {m.sso_callback_help()}
                    </span>
                  }
                >
                  <div className="flex flex-col gap-2">
                    <label
                      className="text-muted-foreground text-sm"
                      htmlFor="sso-callback"
                    >
                      {m.sso_callback()}
                    </label>
                    <div className="flex min-w-0 gap-2">
                      <Input id="sso-callback" readOnly value={callbackUrl} />
                      <CopyButton value={callbackUrl} />
                    </div>
                  </div>
                </SsoSettingsCard>
              ) : null}
              <SsoSettingsCard
                title={m.sso_domain_verification()}
                icon={<ShieldCheckIcon className="size-5" aria-hidden="true" />}
                open={!connection.domainVerified}
                description={
                  <Badge
                    variant={
                      connection.domainVerified ? "default" : "secondary"
                    }
                    className="mt-1"
                  >
                    {connection.domainVerified
                      ? m.sso_verified()
                      : m.sso_unverified()}
                  </Badge>
                }
              >
                {connection.verificationToken ? (
                  <>
                    <p className="text-muted-foreground text-sm">
                      {m.sso_dns_help()}
                    </p>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <dt>{m.sso_dns_name()}</dt>
                      <dd className="bg-muted/50 flex min-w-0 items-center gap-2 rounded-md border p-2 text-sm">
                        <code className="min-w-0 flex-1 break-all">
                          {connection.verificationName}
                        </code>
                        <CopyButton value={connection.verificationName} />
                      </dd>
                      <dt>{m.sso_dns_value()}</dt>
                      <dd className="bg-muted/50 flex min-w-0 items-center gap-2 rounded-md border p-2 text-sm">
                        <code className="min-w-0 flex-1 break-all">
                          {connection.verificationToken}
                        </code>
                        <CopyButton value={connection.verificationToken} />
                      </dd>
                    </dl>
                    {!connection.domainVerified ? (
                      <Button
                        className="mt-3"
                        disabled={busy}
                        onClick={() => verify()}
                      >
                        {m.sso_verify()}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </SsoSettingsCard>
            </>
          ) : null}
        </div>
        {connection ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={connection.enabled ? "outline" : "default"}
              disabled={busy || !connection.domainVerified}
              onClick={() => enable(!connection.enabled)}
            >
              {connection.enabled ? m.sso_disable() : m.sso_enable()}
            </Button>
            <Button
              ref={removeButton}
              variant="destructive"
              disabled={busy}
              onClick={() => setConfirmingRemoval(true)}
            >
              {m.sso_remove()}
            </Button>
          </div>
        ) : null}
        {failed ? <ErrorMessage text={m.sso_action_error()} /> : null}
      </section>
    </>
  );
};
