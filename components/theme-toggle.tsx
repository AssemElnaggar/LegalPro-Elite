"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("legalpro-theme", nextTheme);
    setTheme(nextTheme);
  };

  return (
    <button type="button" onClick={toggleTheme} className="btn-secondary min-w-28 justify-center">
      {theme === "dark" ? "☀️ الوضع الفاتح" : "🌙 الوضع الليلي"}
    </button>
  );
}
