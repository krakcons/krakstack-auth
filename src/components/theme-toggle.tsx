import { ThemeSwitcher, useTheme } from "@/components/theme-switcher";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return <ThemeSwitcher value={theme} onChange={setTheme} />;
}
