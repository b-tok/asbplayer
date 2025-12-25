import { renderSidePanelUi } from '@/ui/side-panel';

console.log('[SidePanel] Script loaded!');

// Message relay: Forward window.postMessage to background script and vice versa
// This is needed for Firefox sidebar where the ChromeExtension instance sends messages via window.postMessage
// but they need to reach the background script via browser.runtime.sendMessage
const setupMessageRelay = () => {
    console.log('[SidePanel] Setting up message relay');

    // Listen for messages from the page (ChromeExtension instance)
    window.addEventListener('message', async (event) => {
        if (event.source !== window) {
            return;
        }

        const command = event.data;

        // Forward asbplayerv2 messages to background script
        if (command.sender === 'asbplayerv2') {
            console.log('[SidePanel] Relaying message to background:', command.message.command);
            try {
                const response = await browser.runtime.sendMessage(command);

                // If there's a response with a messageId, send it back to the page
                if (response && command.message.messageId) {
                    window.postMessage({
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            response: response,
                            messageId: command.message.messageId,
                        },
                    }, '*');
                }
            } catch (error) {
                console.error('[SidePanel] Error relaying message:', error);
            }
        }
    });

    // Listen for messages from background script and forward to page
    browser.runtime.onMessage.addListener((message) => {
        console.log('[SidePanel] Received message from background:', message);

        // Forward messages from background to the page
        if (message.sender === 'asbplayer-extension-to-player') {
            console.log('[SidePanel] Forwarding to page:', message.message?.command);
            window.postMessage(message, '*');
        }

        return false; // Synchronous response
    });

    console.log('[SidePanel] Message relay setup complete');
};

// Initialize extension context by sending version message
// This is needed for Firefox sidebar to properly initialize the ChromeExtension instance
const initializeExtension = async () => {
    console.log('[SidePanel] Starting extension initialization');

    try {
        const manifest = browser.runtime.getManifest();
        console.log('[SidePanel] Manifest version:', manifest.version);
    } catch (error) {
        console.error('[SidePanel] Error getting manifest:', error);
    }

    try {
        console.log('[SidePanel] Requesting extension commands...');
        const commandsPromise = browser.runtime.sendMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'extension-commands',
            },
        });

        console.log('[SidePanel] Requesting page config...');
        const pageConfigPromise = browser.runtime.sendMessage({
            sender: 'asbplayerv2',
            message: {
                command: 'page-config',
            },
        }).catch((error) => {
            console.warn('[SidePanel] Page config not available:', error);
            return undefined;
        });

        const commands = await commandsPromise;
        console.log('[SidePanel] Got commands:', commands);

        const pageConfig = await pageConfigPromise;
        console.log('[SidePanel] Got pageConfig:', pageConfig);

        const manifest = browser.runtime.getManifest();

        window.postMessage({
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'version',
                version: manifest.version,
                extensionCommands: commands,
                pageConfig: pageConfig,
            },
        }, '*');

        console.log('[SidePanel] Version message posted');
    } catch (error) {
        console.error('[SidePanel] Error during initialization:', error);
        console.error('[SidePanel] Error stack:', error instanceof Error ? error.stack : String(error));

        // Try to render UI anyway with default values
        const manifest = browser.runtime.getManifest();
        window.postMessage({
            sender: 'asbplayer-extension-to-player',
            message: {
                command: 'version',
                version: manifest.version,
                extensionCommands: {},
                pageConfig: undefined,
            },
        }, '*');
        console.log('[SidePanel] Posted default version message after error');
    }
};

// Log when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[SidePanel] DOMContentLoaded fired');
});

console.log('[SidePanel] Setting up load listener');
window.addEventListener('load', async () => {
    console.log('[SidePanel] Window load event fired');
    const root = document.getElementById('root');

    if (!root) {
        console.error('[SidePanel] Root element not found!');
        return;
    }

    console.log('[SidePanel] Root element found:', root);

    // Setup message relay first (critical for Firefox sidebar)
    console.log('[SidePanel] Setting up message relay...');
    setupMessageRelay();

    // Initialize extension context (important for Firefox sidebar)
    console.log('[SidePanel] Initializing extension...');
    await initializeExtension();

    // Then render the UI
    console.log('[SidePanel] Rendering UI...');
    try {
        renderSidePanelUi(root);
        console.log('[SidePanel] UI rendered successfully');
    } catch (error) {
        console.error('[SidePanel] Error rendering UI:', error);
        console.error('[SidePanel] Error stack:', error instanceof Error ? error.stack : String(error));
    }
});

console.log('[SidePanel] Script setup complete');
