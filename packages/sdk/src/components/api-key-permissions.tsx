import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ProjectAccessLabelCatalog } from "../access";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

export const ApiKeyPermissions = ({
  description,
  idPrefix,
  permissions,
  labels,
  selected,
  title,
  onChange,
}: {
  description: string;
  idPrefix: string;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  labels?: ProjectAccessLabelCatalog | undefined;
  selected: Readonly<Record<string, boolean>>;
  title: string;
  onChange: (id: string, checked: boolean) => void;
}) => {
  const groups = Object.entries(permissions).reduce<
    Array<{
      resource: string;
      label: string;
      actions: Array<{ id: string; label: string }>;
    }>
  >((groups, [permissionResource, permissionActions]) => {
    for (const permissionAction of permissionActions) {
      const separator = permissionAction.indexOf(":");
      const resource =
        separator === -1
          ? permissionResource
          : permissionAction.slice(0, separator);
      const label =
        separator === -1
          ? permissionAction
          : permissionAction.slice(separator + 1);
      const group = groups.find((item) => item.resource === resource);
      const permissionLabels = labels?.permissions[resource];
      const action = {
        id: `${permissionResource}:${permissionAction}`,
        label: permissionLabels?.actions[label] ?? label,
      };

      if (group) group.actions.push(action);
      else
        groups.push({
          resource,
          label: permissionLabels?.label ?? resource,
          actions: [action],
        });
    }

    return groups;
  }, []);

  if (groups.length === 0) return null;

  return (
    <FieldSet className="gap-3">
      <FieldLegend className="mb-0">{title}</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <div className="overflow-hidden rounded-lg border">
        {groups.map(({ resource, label, actions }, index) => (
          <PermissionGroup
            key={resource}
            actions={actions}
            className={index > 0 ? "border-t" : ""}
            idPrefix={idPrefix}
            resourceLabel={label}
            selected={selected}
            onChange={onChange}
          />
        ))}
      </div>
    </FieldSet>
  );
};

const PermissionGroup = ({
  actions,
  className,
  idPrefix,
  resourceLabel,
  selected,
  onChange,
}: {
  actions: ReadonlyArray<{ id: string; label: string }>;
  className?: string;
  idPrefix: string;
  resourceLabel: string;
  selected: Readonly<Record<string, boolean>>;
  onChange: (id: string, checked: boolean) => void;
}) => {
  const selectedCount = actions.filter((action) => selected[action.id]).length;
  const [open, setOpen] = useState(selectedCount > 0);

  return (
    <Collapsible className={className} open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {resourceLabel}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {selectedCount}/{actions.length}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-3">
        <FieldGroup
          data-slot="checkbox-group"
          className="grid gap-3 sm:grid-cols-2"
        >
          {actions.map((action) => {
            const inputId = `${idPrefix}-${action.id}`;

            return (
              <Field key={action.id} orientation="horizontal">
                <Checkbox
                  id={inputId}
                  checked={selected[action.id] ?? false}
                  onCheckedChange={(checked: boolean) =>
                    onChange(action.id, checked)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={inputId}>{action.label}</FieldLabel>
                </FieldContent>
              </Field>
            );
          })}
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
};
