import React, { useEffect, useState } from 'react';
import { Download, ExternalLink, Share2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed') === 'true') return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios|edgios/i.test(window.navigator.userAgent);

    if (isStandalone) return;

    if (isIOS && isSafari) {
      setIosMode(true);
      setVisible(true);
      return;
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || (!deferredPrompt && !iosMode)) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[60] rounded-3xl border border-primary/15 bg-surface-container-lowest p-4 shadow-2xl md:bottom-6 md:left-auto md:right-6 md:w-[360px]">
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          localStorage.setItem('pwa-install-dismissed', 'true');
        }}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-8">
        <div className="mb-2 text-base font-bold text-on-surface">添加到桌面</div>
        <p className="text-sm leading-6 text-on-surface-variant">
          {iosMode
            ? '请在 Safari 底部点击“分享”，再选择“添加到主屏幕”，即可像 App 一样从桌面快速打开。'
            : '安装后可像 App 一样从桌面快速打开，适合日常交易复盘使用。'}
        </p>
      </div>

      {iosMode ? (
        <div className="mt-4 rounded-2xl bg-surface px-4 py-4 text-sm leading-7 text-on-surface">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Share2 className="h-4 w-4" />
            Safari 安装步骤
          </div>
          <div className="mt-2">1. 点击底部分享按钮</div>
          <div>2. 选择“添加到主屏幕”</div>
          <div>3. 确认后即可从桌面打开</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={async () => {
            if (!deferredPrompt) return;
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
              setVisible(false);
              localStorage.setItem('pwa-install-dismissed', 'true');
            }
          }}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-on-primary"
        >
          <Download className="h-4 w-4" />
          安装到桌面
        </button>
      )}

      <a
        href="/"
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        安装后可直接从桌面进入
      </a>
    </div>
  );
}
