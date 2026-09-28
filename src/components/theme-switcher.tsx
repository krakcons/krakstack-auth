import { ThemeSwitcher as RegistryThemeSwitcher } from "@krak-stack/registry/theme-switcher";
import type { ComponentProps } from "react";


export {
  ThemeProvider,
  themes,
  useTheme,
} from "@krak-stack/registry/theme-switcher";
export type { Theme } from "@krak-stack/registry/theme-switcher";

export const ThemeSwitcher = (
  props: Omit<ComponentProps<typeof RegistryThemeSwitcher>, "locale">,
) => <RegistryThemeSwitcher {...props} />;
