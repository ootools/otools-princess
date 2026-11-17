/**
 * 插件自带主题引导（独立仓库版）。
 * 儿童游戏以奶油粉彩为主视觉；亮/暗由本模块自持，
 * 不加载宿主样式表，不依赖外部包。
 */

type ThemeMode = 'light' | 'dark' | 'system';

type InjectedTheme = { themeMode?: string; resolvedTheme?: string };

const MODE_CACHE_KEY = 'otools:theme-mode';
const SYNC_MESSAGE_TYPE = 'otools:theme-sync';
const DEFAULT_MODE: ThemeMode = 'light'; // 儿童默认亮色

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const readInjectedTheme = (): InjectedTheme | null => {
  if (typeof window === 'undefined') return null;
  const detail = (window as unknown as { __OTOOLS_THEME__?: InjectedTheme }).__OTOOLS_THEME__;
  return detail && typeof detail === 'object' ? detail : null;
};

const readCached = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const prefersDark = (): boolean => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
};

/** 本地预览可用 ?theme=dark|light 覆盖（宿主环境不传，走注入/缓存/默认） */
const readUrlMode = (): ThemeMode | null => {
  try {
    const v = new URLSearchParams(window.location.search).get('theme');
    return v === 'dark' || v === 'light' ? v : null;
  } catch { return null; }
};

const resolveMode = (): ThemeMode => {
  const injected = readInjectedTheme();
  if (isThemeMode(injected?.themeMode)) return injected.themeMode;
  const fromUrl = readUrlMode();
  if (fromUrl) return fromUrl;
  const cached = readCached(MODE_CACHE_KEY);
  if (isThemeMode(cached)) return cached;
  return DEFAULT_MODE;
};

const applyTheme = (mode: ThemeMode = resolveMode()): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const injected = readInjectedTheme();
  const resolved = injected?.resolvedTheme === 'dark' || injected?.resolvedTheme === 'light'
    ? injected.resolvedTheme
    : mode === 'system'
      ? (prefersDark() ? 'dark' : 'light')
      : mode;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved !== 'dark');
  root.dataset.theme = resolved;
};

let installed = false;

export const installPluginTheme = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  applyTheme();

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data as (InjectedTheme & { type?: string }) | null;
    if (!data || typeof data !== 'object' || data.type !== SYNC_MESSAGE_TYPE) return;
    (window as unknown as { __OTOOLS_THEME__?: InjectedTheme }).__OTOOLS_THEME__ = data;
    applyTheme(isThemeMode(data.themeMode) ? data.themeMode : undefined);
  });

  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (resolveMode() === 'system' && !readInjectedTheme()?.resolvedTheme) applyTheme();
    });
  } catch {
    // ignore
  }
};
