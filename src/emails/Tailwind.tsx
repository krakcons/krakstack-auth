import { Tailwind as EmailTailwind } from "@react-email/components";

const defaultColors = {
  primary: "#0A1F44",
  primaryForeground: "#FFFFFF",
  secondary: "#F1F5F9",
  secondaryForeground: "#1C2A47",
};

export const Tailwind = ({ children }: { children: React.ReactNode }) => (
  <EmailTailwind
    config={{
      theme: {
        extend: {
          colors: {
            background: "#FFFFFF",
            foreground: "#0A1F44",
            card: "#FFFFFF",
            "card-foreground": "#0A1F44",
            primary: defaultColors.primary,
            "primary-foreground": defaultColors.primaryForeground,
            secondary: defaultColors.secondary,
            "secondary-foreground": defaultColors.secondaryForeground,
            muted: "#F1F5F9",
            "muted-foreground": "#767D92",
            border: "#E9F2FA",
          },
        },
      },
    }}
  >
    {children}
  </EmailTailwind>
);
