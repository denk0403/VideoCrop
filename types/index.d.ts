import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

interface FFmpegUtil {
    fetchFile: typeof fetchFile;
    toBlobURL: typeof toBlobURL;
}

interface FFmpegWASM {
    FFmpeg: typeof FFmpeg;
}

export declare global {
    export const FFmpegUtil: FFmpegUtil;
    export const FFmpegWASM: FFmpegWASM;
    export interface Window {
        FFmpegUtil: FFmpegUtil;
        FFmpegWASM: FFmpegWASM;
    }
}
