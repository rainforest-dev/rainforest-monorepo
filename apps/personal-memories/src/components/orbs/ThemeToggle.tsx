import { Button } from '@rainforest-dev/rainforest-react';
import { MoonStarIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { applyIoTheme, IO_THEME_KEY, type IoTheme } from '@/lib';

export function ThemeToggle() {
  const [theme, setTheme] = useState<IoTheme>('night');
  useEffect(() => {
    setTheme(
      document.documentElement.dataset['ioTheme'] === 'day' ? 'day' : 'night',
    );
  }, []);
  const next: IoTheme = theme === 'night' ? 'day' : 'night';
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={next === 'day' ? '切到總部（白天）' : '切到夢境（夜晚）'}
      onClick={() => {
        applyIoTheme(document.documentElement, next);
        setTheme(next);
        try {
          localStorage.setItem(IO_THEME_KEY, next);
        } catch {
          return;
        }
      }}
    >
      {theme === 'night' ? <MoonStarIcon /> : <SunIcon />}
      <span className="max-sm:hidden">
        {theme === 'night' ? '夢境' : '總部'}
      </span>
    </Button>
  );
}
