import type { createFFmpeg, fetchFile, FFmpeg } from "@ffmpeg/ffmpeg";

interface FFmpegModule {
    createFFmpeg: typeof createFFmpeg;
    fetchFile: typeof fetchFile;
}


export declare global {
    export const FFmpeg: FFmpegModule;
    export interface Window {
        FFmpeg: FFmpegModule;
    }
}

export { FFmpeg };

