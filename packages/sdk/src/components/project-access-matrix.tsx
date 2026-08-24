import { Check, Minus } from "lucide-react";

import type { ProjectAccessLabelCatalog, ProjectAccessLabels } from "../access";

export type ProjectAccessMatrixAccess<Action extends string = string> = {
  readonly actions: ReadonlyArray<Action>;
  readonly apiKeys: {
    readonly user: ReadonlyArray<Action>;
    readonly organization: ReadonlyArray<Action>;
  };
  readonly project: string;
  readonly roles: Readonly<Record<string, ReadonlyArray<Action> | undefined>>;
};

export type ProjectAccessMatrixMessages = {
  action: string;
  allowed: string;
  apiKeyPermissions: string;
  denied: string;
  organizationKey: string;
  resource: string;
  rolePermissions: string;
  userKey: string;
};

const messages = {
  en: {
    action: "Action",
    allowed: "Allowed",
    apiKeyPermissions: "API-key assignable permissions",
    denied: "Not allowed",
    organizationKey: "Organization key",
    resource: "Resource",
    rolePermissions: "Role grants",
    userKey: "User key",
  },
  fr: {
    action: "Action",
    allowed: "Autorisé",
    apiKeyPermissions: "Autorisations attribuables aux clés API",
    denied: "Non autorisé",
    organizationKey: "Clé d’organisation",
    resource: "Ressource",
    rolePermissions: "Droits des rôles",
    userKey: "Clé utilisateur",
  },
} as const satisfies Record<"en" | "fr", ProjectAccessMatrixMessages>;

export const ProjectAccessMatrix = <
  Action extends string,
  Role extends string,
>({
  access,
  labels,
  locale = "en",
  messages: messageOverrides,
}: {
  access: ProjectAccessMatrixAccess<Action>;
  labels?: ProjectAccessLabels<Action, Role>;
  locale?: string;
  messages?: Partial<ProjectAccessMatrixMessages>;
}) => {
  const language = locale === "fr" ? "fr" : "en";
  const text = { ...messages[language], ...messageOverrides };
  const roleLabels: Readonly<Record<string, string | undefined>> =
    labels?.roles ?? {};
  const roleLabel = (id: string) => {
    const label = roleLabels[id];
    return label ?? capitalizeFirst(id);
  };
  const roleColumns = Object.entries(access.roles).map(([id, permissions]) => ({
    id,
    label: roleLabel(id),
    permissions: permissions ?? [],
  }));
  const keyColumns = [
    {
      id: "user",
      label: text.userKey,
      permissions: access.apiKeys.user,
    },
    {
      id: "organization",
      label: text.organizationKey,
      permissions: access.apiKeys.organization,
    },
  ];

  return (
    <div className="space-y-8">
      <PermissionTable
        access={access}
        columns={roleColumns}
        labels={labels}
        text={text}
        title={text.rolePermissions}
      />
      <PermissionTable
        access={access}
        columns={keyColumns}
        labels={labels}
        text={text}
        title={text.apiKeyPermissions}
      />
    </div>
  );
};

const PermissionTable = <Action extends string, Role extends string>({
  access,
  columns,
  labels,
  text,
  title,
}: {
  access: ProjectAccessMatrixAccess<Action>;
  columns: ReadonlyArray<{
    id: string;
    label: string;
    permissions: ReadonlyArray<string>;
  }>;
  labels: ProjectAccessLabels<Action, Role> | undefined;
  text: ProjectAccessMatrixMessages;
  title: string;
}) => (
  <section className="space-y-3">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium" scope="col">
              {text.resource}
            </th>
            <th className="px-4 py-3 text-left font-medium" scope="col">
              {text.action}
            </th>
            {columns.map((column) => (
              <th
                className="px-4 py-3 text-center font-medium"
                key={column.id}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {access.actions.map((permission) => {
            const { action, resource } = splitPermission(permission);
            return (
              <tr className="border-t" key={permission}>
                <th className="px-4 py-3 text-left font-normal" scope="row">
                  <span>
                    {permissionLabels(labels, resource, action).resource}
                  </span>
                  <code className="text-muted-foreground ml-2 text-xs">
                    {resource}
                  </code>
                </th>
                <td className="px-4 py-3">
                  <span>
                    {permissionLabels(labels, resource, action).action}
                  </span>
                  <code className="text-muted-foreground ml-2 text-xs">
                    {action}
                  </code>
                </td>
                {columns.map((column) => (
                  <PermissionCell
                    key={column.id}
                    allowed={column.permissions.includes(permission)}
                    messages={text}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </section>
);

const PermissionCell = ({
  allowed,
  messages,
}: {
  allowed: boolean;
  messages: ProjectAccessMatrixMessages;
}) => (
  <td className="px-4 py-3 text-center">
    <span className="sr-only">
      {allowed ? messages.allowed : messages.denied}
    </span>
    {allowed ? (
      <Check
        aria-hidden="true"
        className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
      />
    ) : (
      <Minus
        aria-hidden="true"
        className="text-muted-foreground/60 mx-auto size-4"
      />
    )}
  </td>
);

const splitPermission = (permission: string) => {
  const separator = permission.indexOf(":");
  return separator === -1
    ? { resource: permission, action: permission }
    : {
        resource: permission.slice(0, separator),
        action: permission.slice(separator + 1),
      };
};

const capitalizeFirst = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const permissionLabels = <Action extends string, Role extends string>(
  labels: ProjectAccessLabels<Action, Role> | undefined,
  resource: string,
  action: string,
) => {
  const permissionGroups: ProjectAccessLabelCatalog["permissions"] =
    labels?.permissions ?? {};
  const group = permissionGroups[resource];
  if (!group) {
    return {
      resource: capitalizeFirst(resource),
      action: capitalizeFirst(action),
    };
  }

  const actionLabel = group.actions[action];
  return {
    resource: group.label,
    action: actionLabel ?? capitalizeFirst(action),
  };
};
