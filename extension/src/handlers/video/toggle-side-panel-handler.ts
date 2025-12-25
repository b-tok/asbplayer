import { CloseSidePanelMessage, Command, ExtensionToAsbPlayerCommand, Message } from '@project/common';
import TabRegistry from '../../services/tab-registry';
import { SidebarService } from '../../services/sidebar-service';
import { isFirefoxBuild } from '../../services/build-flags';

export default class ToggleSidePanelHandler {
    private readonly _tabRegistry: TabRegistry;
    constructor(tabRegistry: TabRegistry) {
        this._tabRegistry = tabRegistry;
    }

    get sender() {
        return ['asbplayer-video-tab', 'asbplayerv2'];
    }

    get command() {
        return 'toggle-side-panel';
    }

    handle(command: Command<Message>, sender: Browser.runtime.MessageSender) {
        // Firefox has built-in toggle support
        if (isFirefoxBuild) {
            SidebarService.toggle();
            return false;
        }

        // Chrome requires custom toggle logic via message passing
        let sidePanelOpen = false;
        this._tabRegistry.publishCommandToAsbplayers({
            commandFactory: (asbplayer) => {
                if (asbplayer.sidePanel) {
                    const command: ExtensionToAsbPlayerCommand<CloseSidePanelMessage> = {
                        sender: 'asbplayer-extension-to-player',
                        message: {
                            command: 'close-side-panel',
                        },
                    };

                    sidePanelOpen = true;
                    return command;
                }

                return undefined;
            },
        });

        if (!sidePanelOpen) {
            SidebarService.open();
        }

        return false;
    }
}
