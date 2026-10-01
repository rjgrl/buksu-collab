// next-themes wrapper so screens import useTheme from one place.
// TODO(PLAKY-WEB): PLAKY-WEB-004 - keep the class attribute contract with
// globals.css (@custom-variant dark).
import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export { useTheme } from "next-themes";
