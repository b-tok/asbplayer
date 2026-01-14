/**
 * Native Audio Recorder Service
 * Communicates with the native messaging host to record audio from DRM-protected content
 */

const NATIVE_HOST_NAME = 'dev.asbplayer.audio';

export interface NativeRecordingResponse {
    success: boolean;
    audioBase64?: string;
    format?: string;
    error?: string;
}

export interface NativePingResponse {
    success: boolean;
    message?: string;
    audioSystem?: string;
    error?: string;
}

export class NativeAudioRecorder {
    private port: Browser.runtime.Port | null = null;
    private _isAvailable: boolean | null = null;

    /**
     * Check if the native messaging host is installed and available
     */
    async checkAvailability(): Promise<boolean> {
        if (this._isAvailable !== null) {
            return this._isAvailable;
        }

        try {
            const response = await this.ping();
            this._isAvailable = response.success;
            console.log('[NativeAudioRecorder] Native host available:', this._isAvailable);
            if (response.audioSystem) {
                console.log('[NativeAudioRecorder] Audio system:', response.audioSystem);
            }
            return this._isAvailable;
        } catch (error) {
            console.warn('[NativeAudioRecorder] Native host not available:', error);
            this._isAvailable = false;
            return false;
        }
    }

    /**
     * Test connection to native host
     */
    async ping(): Promise<NativePingResponse> {
        return this.sendMessage({ command: 'ping' });
    }

    /**
     * Record audio for the specified duration
     * @param durationMs Duration in milliseconds
     * @param encodeMp3 Whether to encode as MP3 (currently returns WAV)
     */
    async recordAudio(durationMs: number, encodeMp3: boolean = false): Promise<NativeRecordingResponse> {
        // Add extra time for processing, but cap total timeout at 30 seconds
        const timeout = Math.min(durationMs + 5000, 30000);

        const recordingPromise = this.sendMessage({
            command: 'record',
            duration: durationMs,
            encodeMp3: encodeMp3,
        });

        // Race between recording and timeout
        const timeoutPromise = new Promise<NativeRecordingResponse>((resolve) => {
            setTimeout(() => {
                console.warn('[NativeAudioRecorder] Recording timed out after', timeout, 'ms');
                resolve({
                    success: false,
                    error: 'Recording timed out',
                });
            }, timeout);
        });

        return Promise.race([recordingPromise, timeoutPromise]);
    }

    /**
     * Send a message to the native messaging host and wait for response
     */
    private async sendMessage(message: any): Promise<any> {
        console.log('[NativeAudioRecorder] sendMessage called with command:', message.command);
        return new Promise((resolve, reject) => {
            let port: Browser.runtime.Port;

            try {
                console.log('[NativeAudioRecorder] Connecting to native host:', NATIVE_HOST_NAME);
                port = browser.runtime.connectNative(NATIVE_HOST_NAME);
                console.log('[NativeAudioRecorder] connectNative returned, port:', !!port);
            } catch (error) {
                console.error('[NativeAudioRecorder] Failed to connect:', error);
                reject(new Error(`Failed to connect to native host: ${error}`));
                return;
            }

            const timeout = setTimeout(() => {
                console.error('[NativeAudioRecorder] Response timeout after 60 seconds');
                port.disconnect();
                reject(new Error('Native host response timeout'));
            }, 60000); // 60 second timeout for recording

            let responseReceived = false;

            port.onMessage.addListener((response) => {
                responseReceived = true;
                clearTimeout(timeout);
                console.log('[NativeAudioRecorder] Received response:', JSON.stringify(response).substring(0, 200));
                port.disconnect();
                resolve(response);
            });

            port.onDisconnect.addListener(() => {
                clearTimeout(timeout);
                const error = browser.runtime.lastError;
                if (error) {
                    console.error('[NativeAudioRecorder] Native host disconnected with error:', error);
                    reject(new Error(`Native host error: ${error.message}`));
                } else if (!responseReceived) {
                    // Host disconnected without sending a response - this is an error
                    console.error('[NativeAudioRecorder] Native host disconnected without sending a response');
                    reject(
                        new Error(
                            'Native host disconnected without sending a response. Check that the native host is properly installed and working.'
                        )
                    );
                } else {
                    // Normal disconnect after response was received
                    console.log('[NativeAudioRecorder] Native host disconnected normally after response');
                }
            });

            console.log('[NativeAudioRecorder] Sending message:', message.command);
            try {
                port.postMessage(message);
                console.log('[NativeAudioRecorder] Message sent successfully');
            } catch (e) {
                console.error('[NativeAudioRecorder] Error sending message:', e);
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    /**
     * Get the availability status (cached)
     */
    get isAvailable(): boolean {
        return this._isAvailable === true;
    }
}

// Singleton instance
let nativeAudioRecorder: NativeAudioRecorder | null = null;

/**
 * Get the singleton NativeAudioRecorder instance
 */
export function getNativeAudioRecorder(): NativeAudioRecorder {
    if (!nativeAudioRecorder) {
        nativeAudioRecorder = new NativeAudioRecorder();
    }
    return nativeAudioRecorder;
}
