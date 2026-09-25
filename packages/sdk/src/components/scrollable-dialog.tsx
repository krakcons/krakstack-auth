import type { ComponentProps, ReactNode } from "react";

import { DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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
  ...props
}: Omit<ComponentProps<typeof DialogContent>, "className"> & {
  readonly children: ReactNode;
  readonly size: ScrollableDialogSize;
}) => (
  <DialogContent
    className={`grid max-h-[85vh] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden ${widthClass[size]}`}
    {...props}
  >
    {children}
  </DialogContent>
);

export const ScrollableDialogHeader = ({
  children,
  className = "",
  ...props
}: ComponentProps<"div">) => (
  <div className={`flex flex-col gap-6 pb-6 ${className}`} {...props}>
    {children}
    <Separator />
  </div>
);

export const ScrollableDialogBody = ({
  children,
  className = "",
  padding = "default",
  ...props
}: Omit<ComponentProps<"div">, "className"> & {
  readonly className?: string;
  readonly padding?: "default" | "form";
}) => (
  <div className="-mx-6 min-h-0 overflow-y-auto" {...props}>
    <div
      className={`min-w-0 px-6 pt-1 ${padding === "form" ? "pb-6" : "pb-2"} ${className}`}
    >
      {children}
    </div>
  </div>
);
