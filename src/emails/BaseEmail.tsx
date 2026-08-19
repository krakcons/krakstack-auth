import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Markdown,
  Preview,
  Text,
} from "@react-email/components";

import { Tailwind } from "./Tailwind";
import type { EmailTheme } from "./Tailwind";

export const markdownStyles = {
  markdownContainerStyles: {
    fontFamily: "sans-serif",
  },
  markdownCustomStyles: {
    h1: {
      fontSize: "32px",
      fontWeight: 900,
      marginTop: "10px",
      marginBottom: "1rem",
      lineHeight: "1.25",
    },
    p: {
      marginTop: "1rem",
      marginBottom: "1rem",
      fontSize: "16px",
      lineHeight: "22px",
    },
  },
};

export interface BaseEmailContent {
  readonly title: string;
  readonly description: string;
  readonly extra?: string | undefined;
  readonly appName: string;
  readonly logo?: string | null | undefined;
  readonly action?: React.ReactNode;
  readonly theme?: EmailTheme | undefined;
}

export const BaseEmail = ({
  preview,
  content,
}: {
  readonly preview: string;
  readonly content: BaseEmailContent;
}) => (
  <Html>
    <Tailwind theme={content.theme}>
      <Head />
      <Preview>{preview}</Preview>
      <Body className="bg-background mx-auto my-auto px-4 font-sans">
        <Container className="border-border bg-card text-foreground mx-auto my-10 max-w-[600px] border border-solid p-8">
          {content.logo ? (
            <Img src={content.logo} alt="logo" width={267} />
          ) : null}
          <Markdown {...markdownStyles}>{"# " + content.title}</Markdown>
          <Markdown {...markdownStyles}>{content.description}</Markdown>
          {content.action}
          {content.extra ? (
            <Markdown {...markdownStyles}>{content.extra}</Markdown>
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
