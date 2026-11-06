import { Tailwind as EmailTailwind } from "@react-email/components";
import { emailDefaultColors as defaultColors } from "@/services/auth-emails/typography";

export type EmailTheme = Partial<typeof defaultColors>;

export const Tailwind = ({
  children,
  theme,
}: {
  readonly children: React.ReactNode;
  readonly theme?: EmailTheme | undefined;
}) => (
  <EmailTailwind
    config={{
      theme: {
        extend: {
          colors: {
            background: theme?.background ?? defaultColors.background,
            foreground: theme?.foreground ?? defaultColors.foreground,
            card: theme?.card ?? defaultColors.card,
            "card-foreground": theme?.foreground ?? defaultColors.foreground,
            primary: theme?.primary ?? defaultColors.primary,
            "primary-foreground":
              theme?.primaryForeground ?? defaultColors.primaryForeground,
            secondary: theme?.secondary ?? defaultColors.secondary,
            "secondary-foreground":
              theme?.secondaryForeground ?? defaultColors.secondaryForeground,
            muted: theme?.muted ?? defaultColors.muted,
            "muted-foreground":
              theme?.mutedForeground ?? defaultColors.mutedForeground,
            border: theme?.border ?? defaultColors.border,
          },
        },
      },
    }}
  >
    {children}
  </EmailTailwind>
);
