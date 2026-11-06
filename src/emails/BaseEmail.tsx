import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
  Text,
} from "@react-email/components";

import { Tailwind } from "./Tailwind";
import type { EmailTheme } from "./Tailwind";
import type {
  AuthEmailAppearance,
  AuthEmailSettings,
  AuthEmailTypography,
} from "@/services/auth-emails/schema";
import {
  emailFontStacks,
  emailTextStyle,
} from "@/services/auth-emails/typography";
import { EmailSection, sectionHasContent } from "./EmailSection";

export interface BaseEmailContent {
  readonly title: string;
  readonly description: string;
  readonly extra?: string | undefined;
  readonly appName: string;
  readonly logo?: string | null | undefined;
  readonly action?: React.ReactNode;
  readonly theme?: EmailTheme | undefined;
  readonly appearance?: AuthEmailAppearance | undefined;
  readonly footer?: string | undefined;
  readonly locale?: "en" | "fr" | undefined;
  readonly notice?: string | undefined;
  readonly layout?: AuthEmailSettings["layout"] | undefined;
  readonly typography?: AuthEmailTypography | undefined;
}

export const BaseEmail = ({
  preview,
  content,
}: {
  readonly preview: string;
  readonly content: BaseEmailContent;
}) => {
  const placement = content.appearance?.logoPlacement ?? "card";
  const usesPoppins =
    content.typography?.font === "poppins" ||
    (
      ["heading", "body", "code", "button", "help", "projectName"] as const
    ).some((role) => content.typography?.[role]?.font === "poppins") ||
    [content.layout?.header, content.layout?.footer].some((section) =>
      section?.blocks.some(
        (block) =>
          (block.type === "text" || block.type === "link") &&
          block.style?.font === "poppins",
      ),
    );
  const logo = content.logo ? (
    <Row>
      <Column
        align={
          content.appearance?.logoAlignment ??
          content.appearance?.alignment ??
          "left"
        }
        style={{
          paddingTop: content.appearance?.logoSpacingTop ?? 0,
          paddingBottom: content.appearance?.logoSpacingBottom ?? 10,
          lineHeight: 0,
        }}
      >
        <Img
          src={content.logo}
          alt={content.appName}
          width={content.appearance?.logoWidth ?? 267}
          style={{ display: "inline-block", maxWidth: "100%", height: "auto" }}
        />
      </Column>
    </Row>
  ) : null;
  const hasSection = (name: "header" | "footer") =>
    !!(placement === name && logo) ||
    sectionHasContent(content.layout?.[name], content.locale ?? "en");
  return (
    <Html lang={content.locale ?? "en"}>
      <Tailwind theme={content.theme}>
        <Head>
          {usesPoppins ? (
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
            />
          ) : null}
        </Head>
        <Preview>{preview}</Preview>
        <Body
          className="bg-background mx-auto my-auto px-4 font-sans"
          style={
            content.typography?.font
              ? { fontFamily: emailFontStacks[content.typography.font] }
              : undefined
          }
        >
          <EmailSection
            position="header"
            section={content.layout?.header}
            logo={placement === "header" ? logo : null}
            locale={content.locale ?? "en"}
            typography={content.typography}
          />
          <Container
            className="border-border bg-card text-foreground mx-auto my-10 max-w-[600px] border border-solid p-8"
            style={{
              padding: content.appearance?.padding ?? 32,
              borderRadius: content.appearance?.radius ?? 0,
              textAlign: content.appearance?.alignment ?? "left",
              marginTop: hasSection("header") ? 0 : undefined,
              marginBottom: hasSection("footer") ? 0 : undefined,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {placement === "card" ? logo : null}
            {content.notice ? (
              <Text style={emailTextStyle(content.typography, "help")}>
                {content.notice}
              </Text>
            ) : null}
            <Heading
              as="h1"
              style={{
                fontSize: "32px",
                fontWeight: 900,
                marginTop: content.logo && placement === "card" ? "0" : "10px",
                marginBottom: "1rem",
                lineHeight: "1.25",
                ...emailTextStyle(content.typography, "heading"),
              }}
            >
              {content.title}
            </Heading>
            <Text
              style={{
                marginTop: "1rem",
                marginBottom: "1rem",
                fontSize: "16px",
                lineHeight: "22px",
                whiteSpace: "pre-line",
                ...emailTextStyle(content.typography, "body"),
              }}
            >
              {content.description}
            </Text>
            {content.action}
            {content.extra ? (
              <Text style={emailTextStyle(content.typography, "help")}>
                {content.extra}
              </Text>
            ) : null}
            {content.footer ? (
              <Text
                style={{
                  whiteSpace: "pre-line",
                  ...emailTextStyle(content.typography, "help"),
                }}
              >
                {content.footer}
              </Text>
            ) : null}
            {content.appearance?.showProjectName !== false ? (
              <strong>
                <Text
                  className="text-muted-foreground text-xs"
                  style={emailTextStyle(content.typography, "projectName")}
                >
                  {content.appName}
                </Text>
              </strong>
            ) : null}
          </Container>
          <EmailSection
            position="footer"
            section={content.layout?.footer}
            logo={placement === "footer" ? logo : null}
            locale={content.locale ?? "en"}
            typography={content.typography}
          />
        </Body>
      </Tailwind>
    </Html>
  );
};
