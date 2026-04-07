import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed') === 'true') return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

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
        <p className="text-sm leading-6 text-on-surface-variant">安装后可像 App 一样从桌面快速打开，适合日常交易复盘使用。</p>
      </div>

      <button
        type="button"
        onClick={async () => {
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
    </div>
  );
}
