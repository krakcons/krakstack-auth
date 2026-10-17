import { FormReact } from "@lucas-barake/effect-form-react";
import { TextField } from "@krak-stack/registry/effect-form";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

export type PasswordFieldOptions = Omit<
  ComponentProps<typeof TextField>["props"],
  "type" | "autoComplete"
> &
  (
    | {
        autoComplete: "current-password";
        recovery?: { label: string; onClick: () => void; disabled?: boolean };
      }
    | { autoComplete: "new-password"; recovery?: never }
  );

export const PasswordField: FormReact.FieldComponent<
  string,
  PasswordFieldOptions
> = ({ field, props }) => {
  const { recovery, children, ...inputProps } = props;

  return (
    <TextField
      field={field}
      props={{
        ...inputProps,
        type: "password",
        children: (
          <>
            {children}
            {recovery ? (
              <Button
                type="button"
                variant="link"
                className="ms-auto h-auto p-0 text-xs"
                onClick={recovery.onClick}
                disabled={recovery.disabled}
              >
                {recovery.label}
              </Button>
            ) : null}
          </>
        ),
      }}
    />
  );
};
