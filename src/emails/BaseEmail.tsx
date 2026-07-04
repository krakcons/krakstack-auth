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

export const markdownStyles = {
  markdownContainerStyles: {
    fontFamily: "sans-serif",
  },
  markdownCustomStyles: {
    h1: {
      fontSize: "1.5rem",
      fontWeight: 600,
      marginTop: "2rem",
      marginBottom: "1rem",
    },
    p: {
      marginTop: "1rem",
      marginBottom: "1rem",
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
}

export const BaseEmail = ({
  preview,
  content,
}: {
  readonly preview: string;
  readonly content: BaseEmailContent;
}) => (
  <Html>
    <Tailwind>
      <Head />
      <Preview>{preview}</Preview>
      <Body className="mx-auto my-auto bg-white px-4 font-sans">
        <Container className="border-border text-foreground mx-auto my-10 max-w-[465px] rounded border border-solid p-8">
          {content.logo ? (
            <Img src={content.logo} alt="logo" height={100} />
          ) : null}
          <Markdown {...markdownStyles}>{"# " + content.title}</Markdown>
          <Markdown {...markdownStyles}>{content.description}</Markdown>
          {content.action}
          {content.extra ? (
            <Markdown {...markdownStyles}>{content.extra}</Markdown>
          ) : null}
          <strong>
            <Text>{content.appName}</Text>
          </strong>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
