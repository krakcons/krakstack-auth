import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { Tailwind } from "./Tailwind";

export interface BaseEmailContent {
  readonly title: string;
  readonly description: string;
  readonly extra?: string | undefined;
  readonly appName: string;
  readonly logo?: string | undefined;
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
          <Text className="text-foreground mt-0 text-2xl leading-8 font-semibold">
            {content.title}
          </Text>
          <Text className="text-foreground text-base leading-6">
            {content.description}
          </Text>
          {content.action ? (
            <Section className="my-6">{content.action}</Section>
          ) : null}
          {content.extra ? (
            <Text className="text-muted-foreground text-sm leading-6">
              {content.extra}
            </Text>
          ) : null}
          <Text className="text-foreground m-0 text-sm font-semibold">
            {content.appName}
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);
