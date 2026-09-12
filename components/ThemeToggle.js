// components/ThemeToggle.js
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Baca preferensi tersimpan saat pertama kali mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored || (systemDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  // Hindari hydration mismatch
  if (!mounted) return <button disabled style={{ width: 40 }} />;

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      style={{
        cursor: 'pointer',
        border: '1px solid var(--foreground)',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 18,
      }}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
