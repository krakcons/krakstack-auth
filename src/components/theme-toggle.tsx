import { ThemeSwitcher, useTheme } from "@krak-stack/registry/theme-switcher";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return <ThemeSwitcher value={theme} onChange={setTheme} />;
}
