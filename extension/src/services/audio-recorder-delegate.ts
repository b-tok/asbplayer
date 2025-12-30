import {
    ExtensionToOffscreenDocumentCommand,
    ExtensionToVideoCommand,
    StartRecordingAudioMessage,
    StartRecordingAudioViaCaptureStreamMessage,
    StartRecordingAudioWithTimeoutMessage,
    StartRecordingAudioWithTimeoutViaCaptureStreamMessage,
    StartRecordingResponse,
    StartRecordingErrorCode,
    StopRecordingAudioMessage,
    StopRecordingResponse,
    StopRecordingErrorCode,
} from '@project/common';
import { ensureOffscreenAudioServiceDocument } from './offscreen-document';
import { getNativeAudioRecorder } from './native-audio-recorder';

export interface Requester {
    tabId: number;
    src: string;
}

/**
 * Shows a notification to the user
 */
async function showNotification(title: string, message: string) {
    try {
        await browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL('icon/icon128.png'),
            title: title,
            message: message,
        });
    } catch (error) {
        console.error('[AudioRecorder] Failed to show notification:', error);
    }
}

export interface AudioRecorderDelegate {
    startWithTimeout: (
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ) => Promise<StartRecordingResponse>;
    start: (requestId: string, requester: Requester) => Promise<StartRecordingResponse>;
    stop: (encodeAsMp3: boolean, requester: Requester) => Promise<StopRecordingResponse>;
}

export class OffscreenAudioRecorder implements AudioRecorderDelegate {
    private _mediaStreamId(tabId: number): Promise<string> {
        return new Promise((resolve, reject) => {
            browser.tabCapture.getMediaStreamId(
                {
                    targetTabId: tabId,
                },
                (streamId) => resolve(streamId)
            );
        });
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        await ensureOffscreenAudioServiceDocument();

        const streamId = await this._mediaStreamId(tabId);
        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioWithTimeoutMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                streamId,
                requestId,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StartRecordingResponse;
    }

    async start(requestId: string, { tabId, src }: Requester) {
        await ensureOffscreenAudioServiceDocument();
        const streamId = await this._mediaStreamId(tabId);

        const command: ExtensionToOffscreenDocumentCommand<StartRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'start-recording-audio',
                streamId,
                requestId,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StartRecordingResponse;
    }

    async stop(encodeAsMp3: boolean): Promise<StopRecordingResponse> {
        const command: ExtensionToOffscreenDocumentCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-offscreen-document',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
        };
        return (await browser.runtime.sendMessage(command)) as StopRecordingResponse;
    }
}

export class CaptureStreamAudioRecorder implements AudioRecorderDelegate {
    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        const command: ExtensionToVideoCommand<StartRecordingAudioWithTimeoutViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio-with-timeout',
                timeout: time,
                encodeAsMp3,
                requestId,
            },
            src,
        };

        return (await browser.tabs.sendMessage(tabId, command)) as StartRecordingResponse;
    }

    async start(requestId: string, { tabId, src }: Requester) {
        const command: ExtensionToVideoCommand<StartRecordingAudioViaCaptureStreamMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'start-recording-audio',
                requestId,
            },
            src,
        };
        return (await browser.tabs.sendMessage(tabId, command)) as StartRecordingResponse;
    }

    async stop(encodeAsMp3: boolean, { tabId, src }: Requester): Promise<StopRecordingResponse> {
        const command: ExtensionToVideoCommand<StopRecordingAudioMessage> = {
            sender: 'asbplayer-extension-to-video',
            message: {
                command: 'stop-recording-audio',
                encodeAsMp3,
            },
            src,
        };
        return (await browser.tabs.sendMessage(tabId, command)) as StopRecordingResponse;
    }
}

export class NativeMessagingAudioRecorder implements AudioRecorderDelegate {
    private recordingPromise?: Promise<string>;
    private onAudioCallback?: (base64: string, requestId: string) => void;
    private currentRequestId?: string;

    setOnAudioCallback(callback: (base64: string, requestId: string) => void) {
        this.onAudioCallback = callback;
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        { tabId, src }: Requester
    ): Promise<StartRecordingResponse> {
        console.log('[NativeMessagingAudioRecorder] startWithTimeout called', { time, encodeAsMp3, requestId, tabId });

        try {
            const nativeRecorder = getNativeAudioRecorder();

            // Check if native host is available
            console.log('[NativeMessagingAudioRecorder] Checking native host availability...');
            const isAvailable = await nativeRecorder.checkAvailability();
            console.log('[NativeMessagingAudioRecorder] Native host available:', isAvailable);

            if (!isAvailable) {
                console.error('[NativeMessagingAudioRecorder] Native host not available');
                return {
                    started: false,
                    error: {
                        code: StartRecordingErrorCode.other,
                        message:
                            'Native messaging host not installed. See extension documentation for installation instructions.',
                    },
                };
            }

            this.currentRequestId = requestId;
            console.log('[NativeMessagingAudioRecorder] Starting audio recording...');

            // Start recording (this will complete after the timeout)
            this.recordingPromise = nativeRecorder
                .recordAudio(time, encodeAsMp3)
                .then((response) => {
                    console.log('[NativeMessagingAudioRecorder] Recording complete, success:', response.success);
                    const audioBase64 = response.audioBase64 || '';

                    if (!response.success) {
                        console.warn('[NativeMessagingAudioRecorder] Recording failed:', response.error);
                        // Still trigger callback with empty audio to unblock the state machine
                        if (this.onAudioCallback && this.currentRequestId) {
                            console.log('[NativeMessagingAudioRecorder] Triggering callback with empty audio (failed)');
                            this.onAudioCallback('', this.currentRequestId);
                        }
                        return '';
                    }

                    console.log('[NativeMessagingAudioRecorder] Audio length:', audioBase64.length);
                    // Trigger the callback if set (for integration with AudioRecorderService)
                    if (this.onAudioCallback && this.currentRequestId) {
                        console.log('[NativeMessagingAudioRecorder] Triggering callback with audio data');
                        this.onAudioCallback(audioBase64, this.currentRequestId);
                    }

                    return audioBase64;
                })
                .catch((error) => {
                    console.error('[NativeMessagingAudioRecorder] Recording error:', error);
                    // Trigger callback with empty audio to unblock the state machine
                    if (this.onAudioCallback && this.currentRequestId) {
                        console.log('[NativeMessagingAudioRecorder] Triggering callback with empty audio (error)');
                        this.onAudioCallback('', this.currentRequestId);
                    }
                    return '';
                });

            console.log('[NativeMessagingAudioRecorder] Recording initiated successfully');
            return {
                started: true,
            };
        } catch (error: any) {
            console.error('[NativeMessagingAudioRecorder] Error starting recording:', error);
            return {
                started: false,
                error: {
                    code: StartRecordingErrorCode.other,
                    message: error.message || 'Failed to start native audio recording',
                },
            };
        }
    }

    async start(requestId: string, { tabId, src }: Requester): Promise<StartRecordingResponse> {
        // Native messaging doesn't support manual start/stop, only timed recording
        return {
            started: false,
            error: {
                code: StartRecordingErrorCode.other,
                message: 'Native messaging audio recorder only supports timed recording',
            },
        };
    }

    async stop(encodeAsMp3: boolean, { tabId, src }: Requester): Promise<StopRecordingResponse> {
        // For native messaging, the audio is already being recorded
        // We just need to wait for it to complete
        if (!this.recordingPromise) {
            return {
                stopped: false,
                error: {
                    code: StopRecordingErrorCode.noRecording,
                    message: 'No recording in progress',
                },
            };
        }

        try {
            // The audio will be provided via callback, but we still wait for completion
            // Even if recording failed, the callback was triggered, so we just wait
            await this.recordingPromise;
            this.recordingPromise = undefined;
            this.currentRequestId = undefined;

            return {
                stopped: true,
                // Don't return audioBase64 here - it's provided via callback
                // Even if audio is empty, we return success to unblock the state machine
            };
        } catch (error: any) {
            // This should not happen since we catch errors in startWithTimeout
            // But handle it anyway for safety
            console.error('[NativeMessagingAudioRecorder] Unexpected error in stop:', error);
            this.recordingPromise = undefined;
            this.currentRequestId = undefined;

            // Still return success to unblock the state machine
            // The callback was already triggered with empty audio
            return {
                stopped: true,
            };
        }
    }
}

/**
 * Composite Audio Recorder for Firefox
 * Tries CaptureStreamAudioRecorder first, falls back to NativeMessagingAudioRecorder for DRM content
 */
export class FirefoxAudioRecorder implements AudioRecorderDelegate {
    private captureStreamRecorder = new CaptureStreamAudioRecorder();
    private nativeMessagingRecorder = new NativeMessagingAudioRecorder();
    private usingNativeRecorder = false;
    private notificationShown = false;

    setOnAudioCallback(callback: (base64: string, requestId: string) => void) {
        this.nativeMessagingRecorder.setOnAudioCallback(callback);
    }

    async startWithTimeout(
        time: number,
        encodeAsMp3: boolean,
        requestId: string,
        requester: Requester
    ): Promise<StartRecordingResponse> {
        console.log('[FirefoxAudioRecorder] startWithTimeout called', { time, encodeAsMp3, requestId });

        // Try CaptureStream first
        console.log('[FirefoxAudioRecorder] Trying CaptureStream first...');
        const captureStreamResponse = await this.captureStreamRecorder.startWithTimeout(
            time,
            encodeAsMp3,
            requestId,
            requester
        );
        console.log('[FirefoxAudioRecorder] CaptureStream response:', captureStreamResponse);

        if (captureStreamResponse.started) {
            console.log('[FirefoxAudioRecorder] CaptureStream succeeded, using it');
            this.usingNativeRecorder = false;
            return captureStreamResponse;
        }

        // Check if it's a DRM error
        if (captureStreamResponse.error?.code === StartRecordingErrorCode.drmProtected) {
            console.log('[FirefoxAudioRecorder] DRM detected, falling back to native messaging');

            // Try native messaging recorder
            console.log('[FirefoxAudioRecorder] Starting native messaging recorder...');
            const nativeResponse = await this.nativeMessagingRecorder.startWithTimeout(
                time,
                encodeAsMp3,
                requestId,
                requester
            );
            console.log('[FirefoxAudioRecorder] Native messaging response:', nativeResponse);

            if (!nativeResponse.started && !this.notificationShown) {
                // Native host not installed, show notification
                console.warn('[FirefoxAudioRecorder] Native host not available, showing notification');
                this.notificationShown = true;
                await showNotification(
                    'asbplayer-linux: Native Audio Host Required',
                    'To record audio from DRM-protected content, install the native messaging host. See: https://github.com/b-tok/asbplayer/tree/main/native-messaging-host'
                );
            }

            this.usingNativeRecorder = nativeResponse.started;
            console.log('[FirefoxAudioRecorder] Using native recorder:', this.usingNativeRecorder);
            return nativeResponse;
        }

        // Some other error, return it
        console.error('[FirefoxAudioRecorder] Recording failed with error:', captureStreamResponse.error);
        return captureStreamResponse;
    }

    async start(requestId: string, requester: Requester): Promise<StartRecordingResponse> {
        // Try CaptureStream first
        const captureStreamResponse = await this.captureStreamRecorder.start(requestId, requester);

        if (captureStreamResponse.started) {
            this.usingNativeRecorder = false;
            return captureStreamResponse;
        }

        // Check if it's a DRM error
        if (captureStreamResponse.error?.code === StartRecordingErrorCode.drmProtected) {
            console.log("[FirefoxAudioRecorder] DRM detected, but native messaging doesn't support manual recording");
            // Native messaging doesn't support manual start/stop
            return captureStreamResponse;
        }

        return captureStreamResponse;
    }

    async stop(encodeAsMp3: boolean, requester: Requester): Promise<StopRecordingResponse> {
        if (this.usingNativeRecorder) {
            return this.nativeMessagingRecorder.stop(encodeAsMp3, requester);
        } else {
            return this.captureStreamRecorder.stop(encodeAsMp3, requester);
        }
    }
}
