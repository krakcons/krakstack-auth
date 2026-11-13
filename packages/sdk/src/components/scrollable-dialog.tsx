import type { ComponentProps, ReactNode } from "react";

import { DialogContent, useAuthUIStyles } from "./appearance.js";
import { Separator } from "@/components/ui/separator";
import { cn } from "./utils.js";

type ScrollableDialogSize = "2xl" | "3xl" | "4xl" | "6xl";

const widthClass = {
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "6xl": "sm:max-w-6xl",
} satisfies Record<ScrollableDialogSize, string>;

export const ScrollableDialogContent = ({
  children,
  size,
  className,
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "className"> & {
  readonly className?: string;
  readonly children: ReactNode;
  readonly size: ScrollableDialogSize;
}) => (
  <DialogContent
    className={cn(
      `grid max-h-[85vh] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden ${widthClass[size]}`,
      className,
    )}
    {...props}
  >
    {children}
  </DialogContent>
);

export const ScrollableDialogHeader = ({
  children,
  className = "",
  ...props
}: ComponentProps<"div">) => {
  const styles = useAuthUIStyles();
  return (
    <div
      data-auth-slot="dialog-header"
      className={cn(
        "flex flex-col gap-6 pb-6",
        styles?.dialog?.header,
        className,
      )}
      {...props}
    >
      {children}
      <Separator />
    </div>
  );
};

export const ScrollableDialogBody = ({
  children,
  className = "",
  padding = "default",
  ...props
}: Omit<ComponentProps<"div">, "className"> & {
  readonly className?: string;
  readonly padding?: "default" | "form";
}) => {
  const styles = useAuthUIStyles();
  return (
    <div
      data-auth-slot="dialog-body"
      className={cn("-mx-6 min-h-0 overflow-y-auto", styles?.dialog?.body)}
      {...props}
    >
      <div
        data-auth-slot="form-scope"
        className={cn(
          `min-w-0 px-6 pt-1 ${padding === "form" ? "pb-6" : "pb-2"}`,
          styles?.form?.content,
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
};
