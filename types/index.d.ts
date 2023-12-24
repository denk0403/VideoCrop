import type { createFFmpeg, fetchFile, FFmpeg } from "@ffmpeg/ffmpeg";

export interface FFmpegModule {
    createFFmpeg: typeof createFFmpeg;
    fetchFile: typeof fetchFile;
}

export declare global {
    export const FFmpeg: FFmpegModule;
    export interface Window {
        FFmpeg: FFmpegModule;
    }
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Transform {
    scale: number;
    removeAudio: boolean;
}

export interface TimeRange {
    start: number;
    end: number;
}

export interface TranscodeParams {
    file: File;
    box: BoundingBox;
    transform: Transform;
    time: TimeRange;
}

export interface CommandIO {
    input: string;
    output: string;
}

export type BuildFFmpegCommandParams = {
    io: CommandIO;
    box: BoundingBox;
    transform: Transform;
    time: TimeRange;
};


export { FFmpeg };
