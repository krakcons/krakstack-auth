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
import type { AuthEmailAppearance } from "@/services/auth-emails/schema";

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
}

export const BaseEmail = ({
  preview,
  content,
}: {
  readonly preview: string;
  readonly content: BaseEmailContent;
}) => (
  <Html lang={content.locale ?? "en"}>
    <Tailwind theme={content.theme}>
      <Head />
      <Preview>{preview}</Preview>
      <Body className="bg-background mx-auto my-auto px-4 font-sans">
        <Container
          className="border-border bg-card text-foreground mx-auto my-10 max-w-[600px] border border-solid p-8"
          style={{
            padding: content.appearance?.padding ?? 32,
            borderRadius: content.appearance?.radius ?? 0,
            textAlign: content.appearance?.alignment ?? "left",
          }}
        >
          {content.notice ? <Text>{content.notice}</Text> : null}
          {content.logo ? (
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
                  style={{
                    display: "inline-block",
                    maxWidth: "100%",
                    height: "auto",
                  }}
                />
              </Column>
            </Row>
          ) : null}
          <Heading
            as="h1"
            style={{
              fontSize: "32px",
              fontWeight: 900,
              marginTop: content.logo ? "0" : "10px",
              marginBottom: "1rem",
              lineHeight: "1.25",
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
            }}
          >
            {content.description}
          </Text>
          {content.action}
          {content.extra ? <Text>{content.extra}</Text> : null}
          {content.footer ? (
            <Text style={{ whiteSpace: "pre-line" }}>{content.footer}</Text>
          ) : null}
          <strong>
            <Text className="text-muted-foreground text-xs">
              {content.appName}
            </Text>
          </strong>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
