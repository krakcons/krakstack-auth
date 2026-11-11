import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react";
import {
  CheckboxField,
  SelectField,
  SubmitButton,
  SubmitError,
  TextField,
} from "@krak-stack/registry/effect-form";
import { Schema } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";

import { m } from "@/paraglide/messages";
import { McpEndpointUrl, type ProjectMcp } from "../schema";
import { configureProjectMcpAtom, projectMcpAtom } from "./atom";

export const ProjectMcpSettings = ({ projectId }: { projectId: string }) => {
  const result = useAtomValue(projectMcpAtom(projectId));
  return AsyncResult.match(result, {
    onInitial: () => <p role="status">{m.webhooks_loading()}</p>,
    onFailure: () => <p role="alert">{m.project_mcp_load_error()}</p>,
    onSuccess: ({ value }) => (
      <ProjectMcpForm projectId={projectId} config={value} />
    ),
  });
};

const builder = FormBuilder.empty
  .addField("url", McpEndpointUrl)
  .addField("access", Schema.Literals(["read", "read-write"]))
  .addField("enabled", Schema.Boolean);

const makeForm = (projectId: string) =>
  FormReact.make(builder, {
    fields: { url: TextField, access: SelectField, enabled: CheckboxField },
    onSubmit: (_, { decoded: { access, ...settings }, get }) =>
      get.setResult(configureProjectMcpAtom(projectId), {
        ...settings,
        dynamicClientRegistration: true,
        scopes:
          access === "read-write" ? ["mcp:read", "mcp:write"] : ["mcp:read"],
      }),
  });

export const ProjectMcpForm = ({
  projectId,
  config,
}: {
  projectId: string;
  config: ProjectMcp | null;
}) => {
  const [form] = useState(() => makeForm(projectId));
  const submit = useAtomSet(form.submit);
  const result = useAtomValue(form.submit);
  return (
    <section className="flex flex-col gap-3 pt-4">
      <h3 className="font-medium">{m.project_mcp_title()}</h3>
      <p className="text-muted-foreground text-sm">
        {m.project_mcp_description()}
      </p>
      <form.Initialize
        defaultValues={{
          url: config?.url ?? "",
          access:
            config && !config.scopes.includes("mcp:write")
              ? "read"
              : "read-write",
          enabled: config?.enabled ?? false,
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
          <form.url label={m.project_mcp_url()} />
          <p className="text-muted-foreground text-sm">
            {m.project_mcp_domain_help()}
          </p>
          <form.enabled label={m.project_mcp_enabled()} />
          <form.access
            label={m.project_mcp_access()}
            options={[
              { label: m.project_mcp_access_read(), value: "read" },
              { label: m.project_mcp_access_read_write(), value: "read-write" },
            ]}
            description={m.project_mcp_access_help()}
          />
          <p className="text-muted-foreground text-sm">
            {m.project_mcp_disable_help()}
          </p>
          <SubmitError result={result} />
          <SubmitButton form={form}>{m.project_mcp_save()}</SubmitButton>
        </form>
      </form.Initialize>
    </section>
  );
};
