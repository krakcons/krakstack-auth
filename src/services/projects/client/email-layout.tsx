import { Schema, Struct } from "effect";
import { useId } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowRightLeftIcon,
  BoldIcon,
  ChevronDownIcon,
  ImageIcon,
  ItalicIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  StrikethroughIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UnderlineIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import {
  AuthEmailAlignment,
  AuthEmailColor,
  AuthEmailFont,
  AuthEmailGap,
  AuthEmailPublishedBlock,
  AuthEmailLinkDestination,
  emailSizeOptions,
  type AuthEmailBlock,
  type AuthEmailSettings,
  type AuthEmailTextStyle,
} from "@/services/auth-emails/schema";
import {
  resolveEmailTextStyle,
  resolveEmailRoleColor,
  emailDefaultColors,
  emailRoleIsBold,
  resolveEmailTextFormatting,
  type EmailTextRole,
} from "@/services/auth-emails/typography";

export type EmailSectionName = "header" | "footer";

export const EmailColorField = ({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  const valid =
    value === undefined || value === "" || Schema.is(AuthEmailColor)(value);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <ColorPicker
          hidden
          className="w-9 shrink-0 justify-center"
          locale={getLocale()}
          messages={{
            [getLocale()]: {
              open: m.project_email_choose_color({ field: label }),
            },
          }}
          value={valid && value ? value : fallback}
          onValueChange={onChange}
        />
        <Input
          id={id}
          className="min-w-0 font-mono"
          value={value ?? ""}
          placeholder={fallback}
          maxLength={7}
          aria-invalid={!valid}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
};

export const EmailChoice = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={value}
        items={options}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger
          id={id}
          className="w-full min-w-0"
          title={options.find((option) => option.value === value)?.label}
        >
          <SelectValue className="min-w-0 flex-1 truncate text-left" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
};

const fonts = () => [
  { value: "sans", label: m.project_email_font_sans() },
  { value: "poppins", label: m.project_email_font_poppins() },
  { value: "serif", label: m.project_email_font_serif() },
  { value: "mono", label: m.project_email_font_mono() },
];
const gaps = () => [
  { value: "small", label: m.project_email_small() },
  { value: "medium", label: m.project_email_medium() },
  { value: "large", label: m.project_email_large() },
];

export const EmailAlignmentChoice = ({
  value,
  onChange,
}: {
  value: "left" | "center" | "right";
  onChange: (value: "left" | "center" | "right") => void;
}) => (
  <EmailChoice
    label={m.project_email_alignment()}
    value={value}
    options={[
      { value: "left", label: m.project_email_left() },
      { value: "center", label: m.project_email_center() },
      { value: "right", label: m.project_email_right() },
    ]}
    onChange={(value) => {
      if (Schema.is(AuthEmailAlignment)(value)) onChange(value);
    }}
  />
);

const TextStyleEditor = ({
  style,
  inherited,
  sizes,
  formattingDefaults,
  onChange,
}: {
  style: AuthEmailTextStyle | undefined;
  inherited: ReturnType<typeof resolveEmailTextStyle>;
  sizes: ReadonlyArray<number>;
  formattingDefaults?: { bold?: boolean; underline?: boolean };
  onChange: (style: AuthEmailTextStyle) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-end gap-2">
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
        <EmailChoice
          label={m.project_email_font()}
          value={style?.font ?? inherited.font}
          options={fonts()}
          onChange={(font) => {
            if (Schema.is(AuthEmailFont)(font)) onChange({ ...style, font });
          }}
        />
        <EmailChoice
          label={m.project_email_font_size()}
          value={String(style?.size ?? inherited.size)}
          options={[...new Set([inherited.size, ...sizes])]
            .sort((a, b) => a - b)
            .map((size) => ({ value: String(size), label: `${size} px` }))}
          onChange={(value) => {
            const size = sizes.find((size) => String(size) === value);
            onChange(
              size === undefined
                ? Struct.omit(style ?? {}, ["size"])
                : { ...style, size },
            );
          }}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={m.project_email_reset_text_style()}
        title={m.project_email_reset_text_style()}
        disabled={!style || Object.keys(style).length === 0}
        onClick={() => onChange({})}
      >
        <RotateCcwIcon aria-hidden="true" />
      </Button>
    </div>
    <div
      className="flex flex-wrap gap-1"
      role="group"
      aria-label={m.project_email_formatting()}
    >
      {(
        [
          { key: "bold", label: m.project_email_bold(), icon: BoldIcon },
          { key: "italic", label: m.project_email_italic(), icon: ItalicIcon },
          {
            key: "underline",
            label: m.project_email_underline(),
            icon: UnderlineIcon,
          },
          {
            key: "strikethrough",
            label: m.project_email_strikethrough(),
            icon: StrikethroughIcon,
          },
        ] as const
      ).map(({ key, label, icon: Icon }) => {
        const pressed = resolveEmailTextFormatting(style, formattingDefaults)[
          key
        ];
        return (
          <Button
            key={key}
            type="button"
            variant={pressed ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            onClick={() => onChange({ ...style, [key]: !pressed })}
          >
            <Icon aria-hidden="true" />
          </Button>
        );
      })}
    </div>
  </div>
);

// Editing a role preserves the legacy shared font. Merely opening a control
// displays its effective value without adding overrides to the saved document.
export const EmailRoleStyleEditor = ({
  role,
  settings,
  onChange,
}: {
  role: EmailTextRole;
  settings: AuthEmailSettings;
  onChange: (settings: AuthEmailSettings) => void;
}) => {
  const style = settings.typography?.[role];
  return (
    <div className="space-y-3">
      <TextStyleEditor
        style={style}
        inherited={resolveEmailTextStyle(settings.typography, role)}
        sizes={emailSizeOptions[role]}
        formattingDefaults={{ bold: emailRoleIsBold(role) }}
        onChange={(style) =>
          onChange({
            ...settings,
            typography: { ...settings.typography, [role]: style },
          })
        }
      />
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <EmailColorField
          label={m.project_email_foreground()}
          value={style?.color}
          fallback={resolveEmailRoleColor(settings, role)}
          onChange={(color) =>
            onChange({
              ...settings,
              typography: {
                ...settings.typography,
                [role]: color
                  ? { ...style, color }
                  : Struct.omit(style ?? {}, ["color"]),
              },
            })
          }
        />
        <EmailAlignmentChoice
          value={style?.alignment ?? settings.appearance?.alignment ?? "left"}
          onChange={(alignment) =>
            onChange({
              ...settings,
              typography: {
                ...settings.typography,
                [role]: { ...style, alignment },
              },
            })
          }
        />
      </div>
    </div>
  );
};

export const EmailLogoPlacement = ({
  settings,
  logo,
  onChange,
}: {
  settings: AuthEmailSettings;
  logo: string | undefined;
  onChange: (settings: AuthEmailSettings) => void;
}) => (
  <div className="flex flex-wrap items-end gap-3">
    <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md p-1">
      {logo ? (
        <img
          src={logo}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <ImageIcon className="size-5" aria-hidden="true" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <EmailChoice
        label={m.project_email_logo_placement()}
        value={settings.appearance?.logoPlacement ?? "card"}
        options={[
          { value: "header", label: m.project_email_placement_header() },
          { value: "card", label: m.project_email_placement_card() },
          { value: "footer", label: m.project_email_placement_footer() },
          { value: "hidden", label: m.project_email_placement_hidden() },
        ]}
        onChange={(logoPlacement) => {
          if (
            logoPlacement === "header" ||
            logoPlacement === "card" ||
            logoPlacement === "footer" ||
            logoPlacement === "hidden"
          )
            onChange({
              ...settings,
              appearance: { ...settings.appearance, logoPlacement },
            });
        }}
      />
    </div>
    <a
      href="#project-details"
      className="text-muted-foreground w-full text-xs underline underline-offset-4 sm:w-auto sm:pb-2"
    >
      {m.project_email_manage_logo()}
    </a>
  </div>
);

export const EmailSectionEditor = ({
  name,
  settings,
  locale,
  logo,
  activeBlock,
  onSelectBlock,
  onMove,
  onChange,
}: {
  name: EmailSectionName;
  settings: AuthEmailSettings;
  locale: "en" | "fr";
  logo: string | undefined;
  activeBlock: string | null;
  onSelectBlock: (id: string | null) => void;
  onMove: (section: EmailSectionName) => void;
  onChange: (settings: AuthEmailSettings) => void;
}) => {
  const baseId = useId();
  const types = [
    { value: "text", label: m.project_email_block_text() },
    { value: "link", label: m.project_email_block_link() },
    { value: "divider", label: m.project_email_block_divider() },
    { value: "spacer", label: m.project_email_block_spacer() },
  ];
  const section = settings.layout?.[name];
  const blocks = section?.blocks ?? [];
  const other = name === "header" ? "footer" : "header";
  const moveLabel =
    other === "header"
      ? m.project_email_move_to_header()
      : m.project_email_move_to_footer();
  const hasLogo = settings.appearance?.logoPlacement === name && !!logo;
  const update = (blocks: ReadonlyArray<AuthEmailBlock>) =>
    onChange({
      ...settings,
      layout: { ...settings.layout, [name]: { ...section, blocks } },
    });
  const replace = (block: AuthEmailBlock) =>
    update(blocks.map((item) => (item.id === block.id ? block : item)));
  const add = (type: string) => {
    if (blocks.length >= 8) return;
    const id = crypto.randomUUID();
    if (type === "text")
      update([...blocks, { id, type, text: { en: "", fr: "" } }]);
    if (type === "link")
      update([
        ...blocks,
        {
          id,
          type,
          translations: {
            en: { label: "", url: "" },
            fr: { label: "", url: "" },
          },
        },
      ]);
    if (type === "divider") update([...blocks, { id, type }]);
    if (type === "spacer") update([...blocks, { id, type, size: "medium" }]);
    onSelectBlock(id);
  };
  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex items-center justify-between gap-3">
        <h4 id={`${baseId}-heading`} className="text-sm font-medium">
          {name === "header"
            ? m.project_email_section_header()
            : m.project_email_section_footer()}
        </h4>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={blocks.length >= 8}
                />
              }
            >
              <PlusIcon aria-hidden="true" />
              {m.project_email_add_block()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {types.map((type) => (
                <DropdownMenuItem
                  key={type.value}
                  onClick={() => add(type.value)}
                >
                  {type.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={m.project_email_section_actions()}
                />
              }
            >
              <MoreHorizontalIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!blocks.length}
                onClick={() => {
                  if (window.confirm(m.project_email_confirm_clear())) {
                    update([]);
                    if (blocks.some((block) => block.id === activeBlock))
                      onSelectBlock(null);
                  }
                }}
              >
                {m.project_email_clear_section()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {hasLogo ? (
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <ImageIcon className="size-3" aria-hidden="true" />
          {m.project_email_logo_first()}
        </p>
      ) : null}
      {blocks.map((block, index) => {
        const selected = activeBlock === block.id;
        const label =
          types.find((type) => type.value === block.type)?.label ?? "";
        const colorKey =
          block.type === "link"
            ? "primary"
            : block.type === "text" && block.tone === "muted"
              ? "mutedForeground"
              : "foreground";
        return (
          <div key={block.id} className="overflow-hidden rounded-lg border">
            <button
              type="button"
              className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm"
              aria-label={m.project_email_edit_block({
                type: label,
                number: index + 1,
              })}
              aria-expanded={selected}
              aria-controls={
                selected ? `${baseId}-${block.id}-editor` : undefined
              }
              onClick={() => onSelectBlock(selected ? null : block.id)}
            >
              <span className="text-muted-foreground text-xs">{index + 1}</span>
              <span className="min-w-0 flex-1 font-medium">{label}</span>
              {!Schema.is(AuthEmailPublishedBlock)(block) ? (
                <TriangleAlertIcon
                  className="text-destructive size-4 shrink-0"
                  aria-label={m.project_email_missing_translation()}
                />
              ) : null}
              <ChevronDownIcon
                className={`size-4 shrink-0 ${selected ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {selected ? (
              <div
                id={`${baseId}-${block.id}-editor`}
                className="space-y-3 border-t p-3"
              >
                {!Schema.is(AuthEmailPublishedBlock)(block) ? (
                  <p className="text-destructive text-xs">
                    {m.project_email_missing_translation()}
                  </p>
                ) : null}
                {block.type === "text" ? (
                  <Field>
                    <FieldLabel htmlFor={`${baseId}-${block.id}-text`}>
                      {m.project_email_block_content()} ({locale.toUpperCase()})
                    </FieldLabel>
                    <Textarea
                      id={`${baseId}-${block.id}-text`}
                      maxLength={4000}
                      rows={3}
                      value={block.text[locale]}
                      onChange={(event) =>
                        replace({
                          ...block,
                          text: { ...block.text, [locale]: event.target.value },
                        })
                      }
                    />
                  </Field>
                ) : null}
                {block.type === "link" ? (
                  <>
                    <Field>
                      <FieldLabel htmlFor={`${baseId}-${block.id}-label`}>
                        {m.project_email_link_label()} ({locale.toUpperCase()})
                      </FieldLabel>
                      <Input
                        id={`${baseId}-${block.id}-label`}
                        maxLength={200}
                        value={block.translations[locale].label}
                        onChange={(event) =>
                          replace({
                            ...block,
                            translations: {
                              ...block.translations,
                              [locale]: {
                                ...block.translations[locale],
                                label: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`${baseId}-${block.id}-url`}>
                        {m.project_email_link_url()} ({locale.toUpperCase()})
                      </FieldLabel>
                      <Input
                        id={`${baseId}-${block.id}-url`}
                        maxLength={2000}
                        value={block.translations[locale].url}
                        aria-invalid={
                          !!block.translations[locale].url &&
                          !Schema.is(AuthEmailLinkDestination)(
                            block.translations[locale].url,
                          )
                        }
                        onChange={(event) =>
                          replace({
                            ...block,
                            translations: {
                              ...block.translations,
                              [locale]: {
                                ...block.translations[locale],
                                url: event.target.value,
                              },
                            },
                          })
                        }
                      />
                    </Field>
                    <p className="text-muted-foreground text-xs">
                      {m.project_email_link_help()}
                    </p>
                  </>
                ) : null}
                {block.type === "text" || block.type === "link" ? (
                  <>
                    <TextStyleEditor
                      style={block.style}
                      inherited={resolveEmailTextStyle(
                        settings.typography,
                        "body",
                      )}
                      sizes={emailSizeOptions.body}
                      formattingDefaults={{ underline: block.type === "link" }}
                      onChange={(style) => replace({ ...block, style })}
                    />
                    <div className="grid min-w-0 grid-cols-2 gap-2">
                      <EmailColorField
                        label={m.project_email_foreground()}
                        value={block.style?.color}
                        fallback={
                          settings.appearance?.[colorKey] ??
                          emailDefaultColors[colorKey]
                        }
                        onChange={(color) =>
                          replace({
                            ...block,
                            style: color
                              ? { ...block.style, color }
                              : Struct.omit(block.style ?? {}, ["color"]),
                          })
                        }
                      />
                      <EmailAlignmentChoice
                        value={block.alignment ?? "left"}
                        onChange={(alignment) =>
                          replace({ ...block, alignment })
                        }
                      />
                    </div>
                    <div className="grid min-w-0 grid-cols-2 gap-2">
                      {(
                        [
                          {
                            key: "spacingTop",
                            label: m.project_email_block_spacing_top(),
                          },
                          {
                            key: "spacingBottom",
                            label: m.project_email_block_spacing_bottom(),
                          },
                        ] as const
                      ).map(({ key, label }) => (
                        <Field key={key}>
                          <FieldLabel htmlFor={`${baseId}-${block.id}-${key}`}>
                            {label}
                          </FieldLabel>
                          <Input
                            id={`${baseId}-${block.id}-${key}`}
                            type="number"
                            min={0}
                            max={96}
                            step={1}
                            value={block[key] ?? ""}
                            placeholder="16"
                            onChange={(event) =>
                              replace(
                                event.target.value === ""
                                  ? block.type === "text"
                                    ? Struct.omit(block, [key])
                                    : Struct.omit(block, [key])
                                  : {
                                      ...block,
                                      [key]: event.target.valueAsNumber,
                                    },
                              )
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  </>
                ) : null}
                {block.type === "spacer" ? (
                  <EmailChoice
                    label={m.project_email_spacer_size()}
                    value={block.size}
                    options={gaps()}
                    onChange={(size) => {
                      if (Schema.is(AuthEmailGap)(size))
                        replace({ ...block, size });
                    }}
                  />
                ) : null}
                <div className="flex items-center gap-1 border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={m.project_email_move_up()}
                    title={m.project_email_move_up()}
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...blocks];
                      next.splice(index, 1);
                      next.splice(index - 1, 0, block);
                      update(next);
                    }}
                  >
                    <ArrowUpIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={m.project_email_move_down()}
                    title={m.project_email_move_down()}
                    disabled={index === blocks.length - 1}
                    onClick={() => {
                      const next = [...blocks];
                      next.splice(index, 1);
                      next.splice(index + 1, 0, block);
                      update(next);
                    }}
                  >
                    <ArrowDownIcon aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={moveLabel}
                    title={moveLabel}
                    disabled={
                      (settings.layout?.[other]?.blocks.length ?? 0) >= 8
                    }
                    onClick={() => {
                      onChange({
                        ...settings,
                        layout: {
                          ...settings.layout,
                          [name]: {
                            ...section,
                            blocks: blocks.filter(
                              (item) => item.id !== block.id,
                            ),
                          },
                          [other]: {
                            ...settings.layout?.[other],
                            blocks: [
                              ...(settings.layout?.[other]?.blocks ?? []),
                              block,
                            ],
                          },
                        },
                      });
                      onMove(other);
                    }}
                  >
                    <ArrowRightLeftIcon aria-hidden="true" />
                    {moveLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto"
                    aria-label={m.project_email_delete_block()}
                    title={m.project_email_delete_block()}
                    onClick={() => {
                      update(blocks.filter((item) => item.id !== block.id));
                      onSelectBlock(null);
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};
