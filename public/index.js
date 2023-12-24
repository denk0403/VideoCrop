"use strict";

{
    /** @type {HTMLInputElement} */
    const inputHtml = document.getElementById("input");
    /** @type {HTMLVideoElement} */
    const videoIn = document.getElementById("video-input");
    /** @type {HTMLVideoElement} */
    const videoOut = document.getElementById("video-output");
    /** @type {HTMLDivElement} */
    const editor = document.getElementById("editor");
    /** @type {HTMLButtonElement} */
    const cropBtn = document.getElementById("crop-btn");
    /** @type {import("./area-selector.mjs").AreaSelector} */
    const areaSelector = document.getElementById("area");
    /** @type {HTMLDivElement} */
    const loader = document.getElementById("loader");
    /** @type {HTMLSpanElement} */
    const progress = document.getElementById("progress");
    /** @type {HTMLDivElement} */
    const errorMsg = document.getElementById("error-msg");
    /** @type {HTMLDivElement} */
    const shareBtn = document.getElementById("share-btn");
    /** @type {HTMLAnchorElement} */
    const downloadBtn = document.getElementById("download-btn");

    /** @type {HTMLDivElement} */
    const areaTxtX = document.getElementById("area-txt-x");
    /** @type {HTMLDivElement} */
    const areaTxtY = document.getElementById("area-txt-y");
    /** @type {HTMLDivElement} */
    const areaTxtW = document.getElementById("area-txt-w");
    /** @type {HTMLDivElement} */
    const areaTxtH = document.getElementById("area-txt-h");

    /** @type {HTMLSpanElement} */
    const cmd = document.getElementById("cmd");

    /** @type {HTMLDivElement} */
    const progressIndicator = document.getElementById("progress-indicator");

    /** @type {HTMLInputElement} */
    const startTimeInput = document.getElementById("start-time");
    /** @type {HTMLInputElement} */
    const endTimeInput = document.getElementById("end-time");
    /** @type {HTMLInputElement} */
    const scaleInput = document.getElementById("scale");
    /** @type {HTMLInputElement} */
    const removeAudioInput = document.getElementById("remove-audio");
    /** @type {HTMLDivElement} */
    const outDim = document.getElementById("out-dim");
    /** @type {HTMLDivElement} */
    const resultBox = document.getElementById("result");

    /** @type {HTMLButtonElement} */
    const minimizeBtn = document.getElementById("minimize-btn");
    /** @type {HTMLButtonElement} */
    const maximizeBtn = document.getElementById("maximize-btn");

    maximizeBtn.onclick = () => {
        areaSelector.setX(0);
        areaSelector.setY(0);
        areaSelector.setWidth(videoIn.videoWidth);
        areaSelector.setHeight(videoIn.videoHeight);
    };

    minimizeBtn.onclick = () => {
        areaSelector.setWidth(areaSelector.width / 2);
        areaSelector.setHeight(areaSelector.height / 2);
    };

    cmd.onclick = () => {
        const selection = window.getSelection();
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(cmd);
        selection.addRange(range);

        navigator.clipboard.writeText(cmd.textContent);
    };

    /** The minimum number of pixels a video must be in either direction. */
    const MIN_DIM = 50;

    let errorTimer;
    /**
     * @param {string} msg error msg to show below input
     */
    function showError(msg) {
        const ERROR_DURATION = 5100; // 5.1 seconds

        clearError();
        errorMsg.textContent = msg;
        errorMsg.classList.add("show");
        errorTimer = setTimeout(clearError, ERROR_DURATION);
    }

    /** Clears the currently displayed error */
    function clearError() {
        clearTimeout(errorTimer);
        errorTimer = undefined;
        errorMsg.classList.remove("show");
        errorMsg.textContent = "";
    }

    function renderAreaText() {
        const x = areaSelector.offsetLeft;
        const y = areaSelector.offsetTop;
        const width = areaSelector.offsetWidth;
        const height = areaSelector.offsetHeight;
        areaTxtX.textContent = x;
        areaTxtY.textContent = y;
        areaTxtW.textContent = width;
        areaTxtH.textContent = height;

        const [outWidth, outHeight] = calcDimensions(width, height, scaleInput.valueAsNumber);
        outDim.textContent = getOutputDimensionsStr(outWidth, outHeight);
    }

    /**
     * Must use onresize because the "resize" event will always fire when a video src has successfully changed.
     * onloadeddata will not fire in mobile/tablet devices if data-saver is on in browser settings.
     */
    videoOut.onresize = () => {
        resultBox.style.display = "block";
        resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const { createFFmpeg, fetchFile } = FFmpeg;

    /** @type {import("../types").FFmpeg} */
    let ffmpeg;
    function initFFmpeg() {
        ffmpeg = createFFmpeg({
            // corePath: "./ffmpeg-core/ffmpeg-core.js",
            corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
            progress: ({ ratio }) => {
                const clampedRatio = clamp(0, ratio, 100);
                progress.textContent = `${(clampedRatio * 100).toFixed(2)}%`;
            },
        });
        return ffmpeg;
    }
    initFFmpeg();

    /**
     * Calculates new dimensions using some scale factor.
     * @param {number} width
     * @param {number} height
     * @param {number} scale
     * @returns {[number, number]}
     */
    function calcDimensions(width, height, scale) {
        const outWidth = Math.floor((width * scale) / 2) * 2;
        const outHeight = Math.floor((height * scale) / 2) * 2;

        return [outWidth, outHeight];
    }

    /**
     * Creates the ffmpeg command as an array of strings.
     * @param {import("../types").BuildFFmpegCommandParams} params
     * @returns {Promise<void>}
     */
    function buildFFmpegCommand({ io, box, time, transform }) {
        const result = ["-i", io.input];

        // add time filter
        result.push("-ss", `${time.start}`, "-to", `${time.end}`);

        // add filter to crop and scale
        // https://trac.ffmpeg.org/wiki/FilteringGuide

        const [outWidth, outHeight] = calcDimensions(box.width, box.height, transform.scale);
        result.push(
            "-vf",
            `crop=${box.width}:${box.height}:${box.x}:${box.y},scale=${outWidth}:${outHeight}`,
        );

        // decide whether to remove audio
        if (removeAudioInput.checked) result.push("-an");

        // lastly, add output file
        result.push(io.output);

        return result;
    }

    /**
     * Returns the output file name given the input file name.
     * @param {string} inputName
     * @returns {string} The output file name
     */
    function getOutputName(inputName) {
        return inputName.trim().replace(/\.[^/.]+$/, "") + " cropped.mp4";
    }

    /**
     * Renders the ffmpeg command as a string to the command preview.
     * @param {import("../types").BuildFFmpegCommandParams} params
     */
    function renderFFmpegCommand({ io, ...params }) {
        const commandArray = buildFFmpegCommand({
            ...params,
            io: {
                input: `"${io.input}"`,
                output: `"${getOutputName(io.input)}"`,
            },
        });
        commandArray.unshift("ffmpeg");
        cmd.textContent = commandArray.join(" ");
    }

    /**
     * Transcodes the video using the supplied params.
     * @param {import("../types").TranscodeParams} params
     * @returns {Promise<void>}
     */
    async function transcode(params) {
        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        const { file, ...restParams } = params;

        const buildCmdParams = {
            ...restParams,
            io: {
                input: file.name,
                output: "output.mp4",
            },
        };

        /** @type {Uint8Array} */
        let ffmpegFile;
        try {
            ffmpegFile = await fetchFile(file);
        } catch (err) {
            throw new Error("Error fetching input file", { cause: err });
        }

        try {
            ffmpeg.FS("writeFile", file.name, ffmpegFile);
        } catch (err) {
            throw new Error("Error writing input file", { cause: err });
        }

        try {
            await ffmpeg.run(...buildFFmpegCommand(buildCmdParams));
        } catch (err) {
            throw new Error("Error running crop command", { cause: err });
        }

        /** @type {Uint8Array} */
        let data;
        try {
            data = ffmpeg.FS("readFile", "output.mp4");
        } catch (err) {
            throw new Error("Error reading output file", { cause: err });
        }

        if (videoOut.src) URL.revokeObjectURL(videoOut.src);

        const objURL = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
        videoOut.src = objURL;
        downloadBtn.href = objURL;
        downloadBtn.download = getOutputName(file.name);

        if (!navigator.canShare) return;

        const blob = await fetch(objURL).then((res) => res.blob());
        try {
            const shareData = {
                files: [new File([blob], file.name, { type: "video/mp4" })],
                text: `Cropped using ${location.href}`,
            };

            if (navigator.canShare(shareData)) {
                shareBtn.style.display = "inline";
                shareBtn.onclick = () => {
                    navigator.share(shareData);
                };
            } else {
                shareBtn.style.display = "none";
                shareBtn.onclick = undefined;
            }
        } catch (err) {
            console.error(
                new Error(`Something went fetching the video at ${objURL}`, { cause: err }),
            );
        }
    }

    function getOutputDimensionsStr(width, height) {
        return `Output: ${width} × ${height}`;
    }

    function unloadEditor() {
        editor.style.display = "none";
        if (videoIn.src) URL.revokeObjectURL(videoIn.src);
        if (videoOut.src) URL.revokeObjectURL(videoOut.src);
    }

    inputHtml.addEventListener("input", async () => {
        resultBox.style.display = "none";

        const file = inputHtml.files[0];
        if (!file || !file.type.startsWith("video")) {
            unloadEditor();
            return;
        }

        const fr = new FileReader();
        fr.onload = () => {
            if (videoIn.src) URL.revokeObjectURL(videoIn.src);

            videoIn.textContent = "";
            videoIn.src = URL.createObjectURL(new Blob([fr.result], { type: "video/mp4" }));

            videoIn.onresize = () => {
                if (videoIn.videoWidth < MIN_DIM || videoIn.videoHeight < MIN_DIM) {
                    showError(
                        `Video dimensions must be at least ${MIN_DIM}px in either direction.`,
                    );
                    unloadEditor();
                    return;
                }

                editor.style.removeProperty("display");

                const videoInBox = videoIn.getBoundingClientRect();
                areaSelector.style.left = `0`;
                areaSelector.style.top = `0`;
                areaSelector.style.width = `${videoInBox.width / 3}px`;
                areaSelector.style.height = `${videoInBox.height / 3}px`;

                progress.textContent = "";
                cropBtn.textContent = "Go";

                const duration = Math.floor(videoIn.duration * 100) / 100;
                startTimeInput.disabled = false;
                startTimeInput.max = toRange(duration - 0.01);
                startTimeInput.value = "0";
                startTimeInput.title = formatNumber2Time(0);
                endTimeInput.disabled = false;
                endTimeInput.value = toRange(duration);
                endTimeInput.min = toRange(0.01);
                endTimeInput.max = toRange(duration);
                endTimeInput.title = formatNumber2Time(duration);
                scaleInput.disabled = false;
                scaleInput.value = "1";
                scaleInput.min = toRange(0.1);

                // initialize values
                renderAreaText();

                /**
                 * Creates the transcode params object.
                 * @returns {import("../types").TranscodeParams}
                 */
                function createTranscodeParams() {
                    return {
                        file,
                        box: {
                            x: areaSelector.offsetLeft,
                            y: areaSelector.offsetTop,
                            width: areaSelector.offsetWidth,
                            height: areaSelector.offsetHeight,
                        },
                        time: {
                            start: startTimeInput.valueAsNumber || 0,
                            end: endTimeInput.valueAsNumber || duration,
                        },
                        transform: {
                            scale: scaleInput.valueAsNumber || 1,
                        },
                    };
                }

                /**
                 * Creates the transcode params object.
                 * @returns {import("../types").TranscodeParams}
                 */
                function createRenderCmdParams() {
                    return {
                        io: {
                            input: file.name,
                            output: getOutputName(file.name),
                        },
                        box: {
                            x: areaSelector.offsetLeft,
                            y: areaSelector.offsetTop,
                            width: areaSelector.offsetWidth,
                            height: areaSelector.offsetHeight,
                        },
                        time: {
                            start: startTimeInput.valueAsNumber || 0,
                            end: endTimeInput.valueAsNumber || duration,
                        },
                        transform: {
                            scale: scaleInput.valueAsNumber || 1,
                        },
                    };
                }

                function isValidStart() {
                    const curValue = startTimeInput.valueAsNumber;
                    return curValue < prevEnd && curValue >= 0;
                }

                function isValidEnd() {
                    const curValue = endTimeInput.valueAsNumber;
                    return curValue > prevStart && curValue <= duration;
                }

                let prevStart = 0;
                startTimeInput.oninput = () => {
                    if (isValidStart()) {
                        const newValue = startTimeInput.valueAsNumber;
                        prevStart = newValue;
                        endTimeInput.min = toRange(newValue + 0.01);
                        startTimeInput.title = formatNumber2Time(newValue);
                        renderFFmpegCommand(createRenderCmdParams());
                    }
                };
                startTimeInput.onblur = () => {
                    if (!isValidStart()) {
                        startTimeInput.valueAsNumber = prevStart;
                        renderFFmpegCommand(createRenderCmdParams());
                    }
                };

                let prevEnd = duration;
                endTimeInput.oninput = () => {
                    if (isValidEnd()) {
                        const newValue = endTimeInput.valueAsNumber;
                        prevEnd = newValue;
                        startTimeInput.max = toRange(newValue - 0.01);
                        endTimeInput.title = formatNumber2Time(newValue);
                        renderFFmpegCommand(createRenderCmdParams());
                    }
                };
                endTimeInput.onblur = () => {
                    if (!isValidEnd()) {
                        endTimeInput.valueAsNumber = prevEnd;
                        renderFFmpegCommand(createRenderCmdParams());
                    }
                };

                let prevScale = 1;
                scaleInput.oninput = (e) => {
                    e.preventDefault();
                    let newValue = scaleInput.valueAsNumber;
                    if (!newValue || newValue < 0) newValue = 0.1;

                    const width = areaSelector.offsetWidth;
                    const height = areaSelector.offsetHeight;
                    const [outWidth, outHeight] = calcDimensions(width, height, newValue);

                    // only update if the new dimensions are valid
                    if (outWidth >= MIN_DIM && outHeight >= MIN_DIM) {
                        prevScale = newValue;
                        outDim.textContent = getOutputDimensionsStr(outWidth, outHeight);
                        renderFFmpegCommand(createRenderCmdParams());
                    }
                };
                scaleInput.onblur = () => {
                    const newValue = scaleInput.valueAsNumber;
                    if (!newValue || newValue < 0) scaleInput.valueAsNumber = 0.1;

                    const width = areaSelector.offsetWidth;
                    const height = areaSelector.offsetHeight;
                    const [outWidth, outHeight] = calcDimensions(
                        width,
                        height,
                        scaleInput.valueAsNumber,
                    );

                    // revert to previous value if the new dimensions are invalid
                    if (outWidth < MIN_DIM || outHeight < MIN_DIM) {
                        scaleInput.valueAsNumber = prevScale;
                        scaleInput.dispatchEvent(new InputEvent("input"));
                        renderFFmpegCommand(createRenderCmdParams());
                    } else {
                        outDim.textContent = getOutputDimensionsStr(outWidth, outHeight);
                    }
                };

                removeAudioInput.oninput = () => {
                    renderFFmpegCommand(createRenderCmdParams());
                };

                function cancel() {
                    try {
                        ffmpeg.exit();
                    } finally {
                        progress.textContent = "Canceled";
                        cropBtn.textContent = "Crop";
                        cropBtn.style.background = "snow";
                        cropBtn.onclick = crop;
                        loader.style.display = "none";

                        initFFmpeg();
                    }
                }

                async function crop() {
                    progress.textContent = "0.00%";
                    cropBtn.textContent = "Cancel";
                    cropBtn.style.background = "#ef3746";
                    cropBtn.onclick = cancel;
                    loader.style.display = "inline-block";
                    progressIndicator.style.display = "flex";

                    try {
                        await transcode(createTranscodeParams());
                    } catch (err) {
                        progress.textContent = "Errored";
                        console.error(err);
                    } finally {
                        loader.style.display = "none";
                        cropBtn.textContent = "Go";
                        cropBtn.style.removeProperty("background");
                        cropBtn.onclick = crop;
                    }
                }

                areaSelector.onchange = () => {
                    renderAreaText();
                    renderFFmpegCommand(createRenderCmdParams());
                };

                cropBtn.onclick = crop;
                editor.style.display = "block";
                renderFFmpegCommand(createRenderCmdParams());
            };
        };
        fr.readAsArrayBuffer(file);
    });

    /**
     * @callback moveArea
     * @param {HTMLElement} elmnt
     * @param {number} dx
     * @param {number} dy
     */

    /** @type {moveArea} */
    let moveArea;

    /**
     * Clamps a value within a range
     * @param {number} min
     * @param {number} val
     * @param {number} max
     * @returns
     */
    function clamp(min = 0, val = 0, max = Infinity) {
        return val < min ? min : val > max ? max : val;
    }

    window.addEventListener("dragover", (event) => {
        event.preventDefault();
    });
    window.addEventListener("drop", (event) => {
        event.preventDefault();

        const files = event.dataTransfer.files;
        if (files.length !== 1) return showError("Only drop one file at a time.");

        const file = files.item(0);
        if (!file.type.startsWith("video"))
            return showError(`Did not recognize "${file.name}" as a video file.`);

        clearError();
        inputHtml.files = files;
        inputHtml.dispatchEvent(new InputEvent("input"));
    });
}

/**
 * Formats a number as a time
 * @param {number} num
 * @returns {number}
 */
function formatNumber2Time(num) {
    var hours = Math.floor(num / 3600);
    var minutes = Math.floor((num - hours * 3600) / 60);
    var seconds = (num - hours * 3600 - minutes * 60).toFixed(2);

    if (hours == 0) {
        hours = "";
    } else if (hours < 10) {
        hours = "0" + hours + ":";
    }

    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }
    return hours + minutes + ":" + seconds;
}

/**
 * Converts a number to a range representation.
 * To be used in min and max attributes of input fields.
 * @param {number} num
 * @returns {string}
 */
function toRange(num) {
    return num.toFixed(2);
}
