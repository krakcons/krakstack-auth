import { Struct } from "effect";
import type {
  AuthEmailBlock,
  AuthEmailSettings,
  AuthEmailSection,
} from "./schema";

type EmailSections = {
  header?: AuthEmailSection;
  footer?: AuthEmailSection;
};

const resetBlockTypography = (block: AuthEmailBlock): AuthEmailBlock => {
  switch (block.type) {
    case "text":
      return Struct.omit(block, ["style"]);
    case "link":
      return Struct.omit(block, ["style"]);
    default:
      return block;
  }
};

// Missing optional properties must be omitted: HTTP's JSON codec encodes an
// explicitly present `undefined` as null, which is not a valid section.
const mapSections = (
  layout: NonNullable<AuthEmailSettings["layout"]>,
  transform: (section: AuthEmailSection) => AuthEmailSection,
) => {
  const next: EmailSections = {};
  if (layout.header) next.header = transform(layout.header);
  if (layout.footer) next.footer = transform(layout.footer);
  return next;
};

export const resetEmailTypography = (
  settings: AuthEmailSettings,
): AuthEmailSettings => {
  const next = Struct.omit(settings, ["typography"]);
  if (!settings.layout) return next;
  return {
    ...next,
    layout: mapSections(settings.layout, (section) => ({
      ...section,
      blocks: section.blocks.map(resetBlockTypography),
    })),
  };
};

export const resetEmailAppearance = (
  settings: AuthEmailSettings,
): AuthEmailSettings => {
  const resetBlock = (block: AuthEmailBlock): AuthEmailBlock =>
    block.type === "text"
      ? Struct.omit(block, ["style", "alignment", "tone"])
      : block.type === "link"
        ? Struct.omit(block, ["style", "alignment"])
        : block.type === "spacer"
          ? { ...block, size: "medium" }
          : block;
  const next = Struct.omit(settings, ["appearance", "typography"]);
  if (!settings.layout) return next;
  return {
    ...next,
    layout: mapSections(settings.layout, (section) => ({
      blocks: section.blocks.map(resetBlock),
    })),
  };
};
