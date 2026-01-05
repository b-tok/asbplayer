import { useEffect, useState } from 'react';

export const useCurrentTabId = () => {
    const [currentTabId, setCurrentTabId] = useState<number>();

    useEffect(() => {
        // In Firefox sidebar, we need to query differently
        const getCurrentTab = async () => {
            try {
                console.log('[useCurrentTabId] Attempting to get current tab');

                // Firefox sidebar: Get the window containing the sidebar
                // Use populate: true to get window details, but then query separately
                const windows = await browser.windows.getAll({ populate: false });
                console.log('[useCurrentTabId] Found windows:', windows.length);

                // Find the focused window
                const focusedWindow = windows.find((w) => w.focused);
                const targetWindowId = focusedWindow?.id ?? windows[0]?.id;

                console.log('[useCurrentTabId] Target window ID:', targetWindowId);

                if (targetWindowId === undefined) {
                    console.error('[useCurrentTabId] No window found');
                    return;
                }

                // Query for active tab in the target window
                const tabs = await browser.tabs.query({
                    active: true,
                    windowId: targetWindowId,
                });

                console.log(
                    '[useCurrentTabId] Found tabs:',
                    tabs.length,
                    tabs.map((t) => ({ id: t.id, url: t.url }))
                );

                if (tabs.length > 0 && tabs[0].id !== undefined) {
                    console.log('[useCurrentTabId] Setting currentTabId to:', tabs[0].id);
                    setCurrentTabId(tabs[0].id);
                } else {
                    console.warn('[useCurrentTabId] No active tab found in target window');
                }
            } catch (error) {
                console.error('[useCurrentTabId] Error getting current tab:', error);

                // Last resort fallback
                try {
                    const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
                    console.log('[useCurrentTabId] Fallback found tabs:', tabs.length);
                    if (tabs.length > 0 && tabs[0].id !== undefined) {
                        console.log('[useCurrentTabId] Fallback setting currentTabId to:', tabs[0].id);
                        setCurrentTabId(tabs[0].id);
                    }
                } catch (fallbackError) {
                    console.error('[useCurrentTabId] Fallback also failed:', fallbackError);
                }
            }
        };

        getCurrentTab();
    }, []);

    useEffect(() => {
        const listener = (info: Browser.tabs.TabActiveInfo) => {
            console.log('[useCurrentTabId] Tab activated:', info.tabId);
            setCurrentTabId(info.tabId);
        };
        browser.tabs.onActivated.addListener(listener);
        return () => browser.tabs.onActivated.removeListener(listener);
    });

    return currentTabId;
};
