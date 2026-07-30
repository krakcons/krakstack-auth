import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
  selected,
  title,
  onChange,
}: {
  description: string;
  idPrefix: string;
  permissions: Readonly<Record<string, ReadonlyArray<string>>>;
  selected: Readonly<Record<string, boolean>>;
  title: string;
  onChange: (id: string, checked: boolean) => void;
}) => {
  const groups = Object.entries(permissions).filter(
    ([, actions]) => actions.length > 0,
  );

  if (groups.length === 0) return null;

  return (
    <FieldSet className="gap-3">
      <FieldLegend className="mb-0">{title}</FieldLegend>
      <FieldDescription>{description}</FieldDescription>
      <div className="overflow-hidden rounded-lg border">
        {groups.map(([resource, actions], index) => (
          <PermissionGroup
            key={resource}
            actions={actions}
            className={index > 0 ? "border-t" : ""}
            idPrefix={idPrefix}
            resource={resource}
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
  resource,
  selected,
  onChange,
}: {
  actions: ReadonlyArray<string>;
  className?: string;
  idPrefix: string;
  resource: string;
  selected: Readonly<Record<string, boolean>>;
  onChange: (id: string, checked: boolean) => void;
}) => {
  const selectedCount = actions.filter(
    (action) => selected[`${resource}:${action}`],
  ).length;
  const [open, setOpen] = useState(selectedCount > 0);

  return (
    <Collapsible className={className} open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {capitalizeFirst(resource)}
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
            const permissionId = `${resource}:${action}`;
            const inputId = `${idPrefix}-${permissionId}`;

            return (
              <Field key={permissionId} orientation="horizontal">
                <Checkbox
                  id={inputId}
                  checked={selected[permissionId] ?? false}
                  onCheckedChange={(checked: boolean) =>
                    onChange(permissionId, checked)
                  }
                />
                <FieldContent>
                  <FieldLabel htmlFor={inputId}>
                    {capitalizeFirst(action)}
                  </FieldLabel>
                </FieldContent>
              </Field>
            );
          })}
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  );
};

const capitalizeFirst = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);
