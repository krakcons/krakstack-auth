import { Container, Hr, Link, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import type {
  AuthEmailSection,
  AuthEmailTypography,
  AuthEmailTextStyle,
} from "@/services/auth-emails/schema";
import {
  emailGapPixels,
  emailTextStyle,
} from "@/services/auth-emails/typography";

export const sectionHasContent = (
  section: AuthEmailSection | undefined,
  locale: "en" | "fr",
) =>
  section?.blocks.some((block) => {
    switch (block.type) {
      case "text":
        return !!block.text[locale].trim();
      case "link":
        return (
          !!block.translations[locale].label.trim() &&
          !!block.translations[locale].url
        );
      case "divider":
        return true;
      case "spacer":
        return false;
    }
  }) ?? false;

export const EmailSection = ({
  section,
  logo,
  locale,
  typography,
  position,
}: {
  section: AuthEmailSection | undefined;
  logo: ReactNode;
  locale: "en" | "fr";
  typography: AuthEmailTypography | undefined;
  position: "header" | "footer";
}) => {
  if (!logo && !sectionHasContent(section, locale)) return null;
  // Outer blocks inherit font/size only, not Body formatting, alignment, or color.
  const blockTextStyle = (style: AuthEmailTextStyle | undefined) => {
    return emailTextStyle(
      {
        font: typography?.font,
        body: { font: typography?.body?.font, size: typography?.body?.size },
      },
      "body",
      { ...style, lineHeight: style?.lineHeight ?? 1 },
    );
  };
  return (
    <Container
      className="text-foreground mx-auto max-w-[600px]"
      style={{
        marginTop: position === "header" ? 40 : 0,
        marginBottom: position === "footer" ? 40 : 0,
      }}
    >
      <Section
        style={{
          paddingTop:
            position === "footer"
              ? emailGapPixels[section?.gap ?? "medium"]
              : 0,
          paddingBottom:
            position === "header"
              ? emailGapPixels[section?.gap ?? "medium"]
              : 0,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {logo}
        {section?.blocks.map((block) => {
          switch (block.type) {
            case "text":
              return block.text[locale].trim() ? (
                <Text
                  key={block.id}
                  className={
                    block.tone === "muted"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                  style={{
                    fontSize: 16,
                    lineHeight: 1,
                    whiteSpace: "pre-line",
                    marginTop: block.spacingTop ?? 16,
                    marginBottom: block.spacingBottom ?? 16,
                    ...blockTextStyle(block.style),
                    textAlign: block.alignment ?? "left",
                  }}
                >
                  {block.text[locale]}
                </Text>
              ) : null;
            case "link": {
              const translation = block.translations[locale];
              return translation.label.trim() && translation.url ? (
                <Text
                  key={block.id}
                  style={{
                    fontSize: 16,
                    lineHeight: 1,
                    marginTop: block.spacingTop ?? 16,
                    marginBottom: block.spacingBottom ?? 16,
                    ...blockTextStyle(
                      block.style
                        ? {
                            font: block.style.font,
                            size: block.style.size,
                            lineHeight: block.style.lineHeight,
                          }
                        : undefined,
                    ),
                    textAlign: block.alignment ?? "left",
                  }}
                >
                  <Link
                    href={translation.url}
                    className="text-primary underline"
                    style={blockTextStyle({
                      ...block.style,
                      underline: block.style?.underline ?? true,
                    })}
                  >
                    {translation.label}
                  </Link>
                </Text>
              ) : null;
            }
            case "divider":
              return <Hr key={block.id} className="border-border" />;
            case "spacer":
              return (
                <Section
                  key={block.id}
                  aria-hidden="true"
                  style={{
                    height: emailGapPixels[block.size],
                    lineHeight: `${emailGapPixels[block.size]}px`,
                  }}
                >
                  {"\u00a0"}
                </Section>
              );
          }
        })}
      </Section>
    </Container>
  );
};

export const sectionPlainText = (
  section: AuthEmailSection | undefined,
  locale: "en" | "fr",
) =>
  section?.blocks
    .flatMap((block) =>
      block.type === "text"
        ? [block.text[locale].trim()]
        : block.type === "link" &&
            block.translations[locale].label.trim() &&
            block.translations[locale].url
          ? [
              `${block.translations[locale].label}: ${block.translations[locale].url}`,
            ]
          : [],
    )
    .filter(Boolean)
    .join("\n\n");
