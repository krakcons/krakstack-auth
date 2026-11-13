import {
  createContext,
  useContext,
  type ComponentType,
  type ComponentProps,
} from "react";
import * as Menu from "@/components/ui/dropdown-menu";
import * as Dialog from "@/components/ui/dialog";
import * as Alert from "@/components/ui/alert-dialog";
import * as Select from "@/components/ui/select";
import { AppBrand as RegistryAppBrand } from "@krak-stack/registry/app-brand";
import {
  DataTable as RegistryDataTable,
  type DataTableProps,
} from "@krak-stack/registry/data-table";
import {
  SelectField as RegistrySelectField,
  SingleSearchableSelectField as RegistrySingleSearchableSelectField,
} from "@krak-stack/registry/effect-form";
import { cn } from "./utils.js";

type Slots<Key extends string> = Partial<Record<Key, string>>;

/** Optional presentation hooks. No auth, data or interaction policy lives here. */
export type AuthUIClassNames = {
  trigger?: Slots<
    | "visual"
    | "image"
    | "icon"
    | "content"
    | "label"
    | "subtitle"
    | "indicator"
    | "badge"
  >;
  menu?: Slots<
    | "content"
    | "header"
    | "group"
    | "item"
    | "label"
    | "separator"
    | "subContent"
    | "subTrigger"
  >;
  dialog?: Slots<
    "content" | "header" | "title" | "description" | "body" | "footer"
  >;
  popup?: Slots<"select" | "combobox">;
  /** Scope forms through existing field/input/button data-slot attributes. */
  form?: Slots<"content">;
  table?: {
    className?: string;
    classNames?: {
      table?: Slots<"content" | "header" | "body" | "row" | "head" | "cell">;
      toolbar?: Slots<"content" | "search" | "trigger">;
      menu?: Slots<
        "content" | "subContent" | "label" | "item" | "separator" | "subTrigger"
      >;
      popup?: Slots<"select" | "tooltip">;
      pagination?: string;
      gallery?: string;
      feedback?: Slots<"loading" | "empty" | "error">;
    };
  };
};

export const AuthUIStylesContext = createContext<AuthUIClassNames | undefined>(
  undefined,
);
export const useAuthUIStyles = () => useContext(AuthUIStylesContext);

const styled = <Props extends object>(
  Part: ComponentType<Props>,
  slot: string,
  style: (styles: AuthUIClassNames | undefined) => string | undefined,
) => {
  const StyledPart = (props: Props & { className?: string }) => {
    const styles = useAuthUIStyles();
    const className = cn(props.className, style(styles));
    return <Part data-auth-slot={slot} {...props} className={className} />;
  };
  return StyledPart;
};

export const DropdownMenuContent = styled(
  Menu.DropdownMenuContent,
  "menu",
  (s) => s?.menu?.content,
);
export const DropdownMenuGroup = styled(
  Menu.DropdownMenuGroup,
  "menu-group",
  (s) => s?.menu?.group,
);
export const DropdownMenuLabel = styled(
  Menu.DropdownMenuLabel,
  "menu-label",
  (s) => s?.menu?.label,
);
export const DropdownMenuItem = styled(
  Menu.DropdownMenuItem,
  "menu-item",
  (s) => s?.menu?.item,
);
export const DropdownMenuSeparator = styled(
  Menu.DropdownMenuSeparator,
  "menu-separator",
  (s) => s?.menu?.separator,
);
export const DropdownMenuSubContent = styled(
  Menu.DropdownMenuSubContent,
  "submenu",
  (s) => s?.menu?.subContent,
);
export const DropdownMenuSubTrigger = styled(
  Menu.DropdownMenuSubTrigger,
  "submenu-trigger",
  (s) => s?.menu?.subTrigger,
);
export const DialogContent = styled(
  Dialog.DialogContent,
  "dialog",
  (s) => s?.dialog?.content,
);
export const DialogHeader = styled(
  Dialog.DialogHeader,
  "dialog-header",
  (s) => s?.dialog?.header,
);
export const DialogTitle = styled<ComponentProps<typeof Dialog.DialogTitle>>(
  Dialog.DialogTitle,
  "dialog-title",
  (s) => s?.dialog?.title,
);
export const DialogDescription = styled(
  Dialog.DialogDescription,
  "dialog-description",
  (s) => s?.dialog?.description,
);
export const DialogFooter = styled(
  Dialog.DialogFooter,
  "dialog-footer",
  (s) => s?.dialog?.footer,
);
export const AlertDialogContent = styled(
  Alert.AlertDialogContent,
  "alert-dialog",
  (s) => s?.dialog?.content,
);
export const AlertDialogHeader = styled(
  Alert.AlertDialogHeader,
  "alert-dialog-header",
  (s) => s?.dialog?.header,
);
export const AlertDialogTitle = styled(
  Alert.AlertDialogTitle,
  "alert-dialog-title",
  (s) => s?.dialog?.title,
);
export const AlertDialogDescription = styled(
  Alert.AlertDialogDescription,
  "alert-dialog-description",
  (s) => s?.dialog?.description,
);
export const AlertDialogFooter = styled(
  Alert.AlertDialogFooter,
  "alert-dialog-footer",
  (s) => s?.dialog?.footer,
);
export const SelectContent = styled(
  Select.SelectContent,
  "select-popup",
  (s) => s?.popup?.select,
);

export const AppBrand = ({
  appearance = "default",
  ...props
}: ComponentProps<typeof RegistryAppBrand> & {
  appearance?: "default" | "menuHeader" | "trigger";
}) => {
  const styles = useAuthUIStyles();
  const appearanceProps =
    appearance === "trigger" && styles?.trigger
      ? { classNames: styles.trigger }
      : {};
  return (
    <RegistryAppBrand
      {...props}
      {...appearanceProps}
      className={cn(
        props.className,
        appearance === "menuHeader" && styles?.menu?.header,
      )}
    />
  );
};

export const DataTable = <Row extends object>(props: DataTableProps<Row>) => {
  const styles = useAuthUIStyles();
  return <RegistryDataTable {...styles?.table} {...props} />;
};

export const SelectField = <Value extends string>({
  field,
  props,
}: ComponentProps<typeof RegistrySelectField<Value>>) => {
  const styles = useAuthUIStyles();
  const appearance = { contentClassName: styles?.popup?.select };
  return (
    <RegistrySelectField field={field} props={{ ...props, ...appearance }} />
  );
};

export const SingleSearchableSelectField = <Value,>({
  field,
  props,
}: ComponentProps<typeof RegistrySingleSearchableSelectField<Value>>) => {
  const styles = useAuthUIStyles();
  const appearance = { contentClassName: styles?.popup?.combobox };
  return (
    <RegistrySingleSearchableSelectField
      field={field}
      props={{ ...props, ...appearance }}
    />
  );
};
