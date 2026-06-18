import { ThemeSwitcher, useTheme } from "@/components/ui/theme-switcher";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return <ThemeSwitcher value={theme} onChange={setTheme} />;
}
