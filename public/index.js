function init() {
    /** @type {HTMLInputElement} */
    const inputHtml = document.getElementById("input");
    /** @type {HTMLVideoElement} */
    const videoIn = document.getElementById("video-input");
    /** @type {HTMLVideoElement} */
    const videoOut = document.getElementById("video-output");
    /** @type {HTMLButtonElement} */
    const cropBtn = document.getElementById("crop-btn");
    /** @type {HTMLDivElement} */
    const areaElt = document.getElementById("area");
    /** @type {HTMLDivElement} */
    const loader = document.getElementById("loader");
    /** @type {HTMLSpanElement} */
    const progress = document.getElementById("progress");
    /** @type {HTMLDivElement} */
    const errorMsg = document.getElementById("error-msg");
    /** @type {HTMLDivElement} */
    const resultBtnGroup = document.getElementById("result-btn-group");
    /** @type {HTMLDivElement} */
    const shareBtn = document.getElementById("share-btn");
    /** @type {HTMLAnchorElement} */
    const downloadBtn = document.getElementById("download-btn");
    /** @type {HTMLDivElement} */
    const areaTxt = document.getElementById("area-txt");
    /** @type {HTMLInputElement} */
    const startTimeInput = document.getElementById("start-time");
    /** @type {HTMLInputElement} */
    const endTimeInput = document.getElementById("end-time");
    /** @type {HTMLInputElement} */
    const scaleInput = document.getElementById("scale");
    /** @type {HTMLDivElement} */
    const outDim = document.getElementById("out-dim");

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

    new ResizeObserver(() => {
        if (!scaleInput.valueAsNumber) return;

        const width = areaElt.offsetWidth;
        const height = areaElt.offsetHeight;
        areaTxt.textContent = `${width} x ${height}`;
        const [outWidth, outHeight] = calcDimensions(width, height, scaleInput.valueAsNumber);
        outDim.textContent = `Output Dimensions: ${outWidth} x ${outHeight}`;
    }).observe(areaElt);

    /**
     * Must use onresize because the "resize" event will always fire when a video src has successfully changed.
     * onloadeddata will not fire in mobile/tablet devices if data-saver is on in browser settings.
     */
    videoOut.onresize = () => {
        resultBtnGroup.style.visibility = "visible";
        videoOut.style.display = "inline-block";
        videoOut.scrollIntoView({ behavior: "smooth" });
    };

    const { createFFmpeg, fetchFile } = FFmpeg;

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
     * @returns
     */
    function calcDimensions(width, height, scale) {
        const outWidth = Math.floor((width * scale) / 2) * 2;
        const outHeight = Math.floor((height * scale) / 2) * 2;

        return [outWidth, outHeight];
    }

    /**
     * @param {File} file
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} start
     * @param {number} end
     * @param {number} scaleFactor
     */
    const transcode = async (file, x, y, w, h, start, end, scaleFactor) => {
        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        // Scaling code
        const [outWidth, outHeight] = calcDimensions(w, h, scaleFactor);

        ffmpeg.FS("writeFile", file.name, await fetchFile(file));
        await ffmpeg.run(
            "-i",
            file.name,
            "-ss",
            `${start}`,
            "-to",
            `${end}`,
            "-vf",
            `crop=${w}:${h}:${x}:${y}, scale=${outWidth}:${outHeight}`, // for scaling
            "output.mp4",
        );
        const data = ffmpeg.FS("readFile", "output.mp4");

        if (videoOut.src) URL.revokeObjectURL(videoOut.src);

        const objURL = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
        videoOut.src = objURL;
        downloadBtn.href = objURL;
        downloadBtn.download = file.name.trim().replace(/\.[^/.]+$/, "") + " cropped.mp4";

        if (!navigator.canShare) return;

        fetch(objURL)
            .then((res) => res.blob())
            .then((blob) => {
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
            })
            .catch((err) => console.error("Something went fetching the video at", objURL, err));
    };

    inputHtml.addEventListener("input", async () => {
        const file = inputHtml.files[0];
        if (!file || !file.type.startsWith("video")) {
            videoIn.src = null;
            cropBtn.disabled = true;
            areaElt.style.display = "none";
            return;
        }

        const fr = new FileReader();
        fr.onload = () => {
            videoIn.textContent = "";
            videoIn.src = URL.createObjectURL(new Blob([fr.result], { type: "video/mp4" }));

            videoIn.onresize = () => {
                areaElt.style.display = "flex";
                createDragElement(areaElt, videoIn.videoWidth, videoIn.videoHeight);
                progress.textContent = "";
                cropBtn.disabled = false;
                cropBtn.textContent = "Crop";

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
                    }
                };
                startTimeInput.onblur = () => {
                    if (!isValidStart()) startTimeInput.valueAsNumber = prevStart;
                };

                let prevEnd = duration;
                endTimeInput.oninput = () => {
                    if (isValidEnd()) {
                        const newValue = endTimeInput.valueAsNumber;
                        prevEnd = newValue;
                        startTimeInput.max = toRange(newValue - 0.01);
                        endTimeInput.title = formatNumber2Time(newValue);
                    }
                };
                endTimeInput.onblur = () => {
                    if (!isValidEnd()) endTimeInput.valueAsNumber = prevEnd;
                };

                scaleInput.oninput = () => {
                    const newValue = scaleInput.valueAsNumber;
                    if (newValue > 0) prevScale = newValue;

                    const width = areaElt.offsetWidth;
                    const height = areaElt.offsetHeight;
                    const [outWidth, outHeight] = calcDimensions(width, height, newValue);
                    outDim.textContent = `Output Dimensions: ${outWidth} x ${outHeight}`;
                };
                scaleInput.onblur = () => {
                    const newValue = scaleInput.valueAsNumber;
                    if (!newValue || newValue < 0) scaleInput.valueAsNumber = 0.1;

                    const width = areaElt.offsetWidth;
                    const height = areaElt.offsetHeight;
                    const [outWidth, outHeight] = calcDimensions(
                        width,
                        height,
                        scaleInput.valueAsNumber,
                    );
                    outDim.textContent = `Output Dimensions: ${outWidth} x ${outHeight}`;
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
                    try {
                        await transcode(
                            file,
                            areaElt.offsetLeft,
                            areaElt.offsetTop,
                            areaElt.offsetWidth,
                            areaElt.offsetHeight,
                            startTimeInput.valueAsNumber || 0,
                            endTimeInput.valueAsNumber || duration,
                            scaleInput.valueAsNumber || 1,
                        );
                    } catch (err) {
                        progress.textContent = "Errored";
                        console.error(err);
                    } finally {
                        loader.style.display = "none";
                        cropBtn.textContent = "Crop";
                        cropBtn.style.background = "snow";
                        cropBtn.onclick = crop;
                    }
                }

                cropBtn.onclick = crop;
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

    /**
     * Creates a draggable element.
     * @param {HTMLDivElement} elmnt
     * @param {number} cWidth the container's width
     * @param {number} cHeight the container's height
     */
    function createDragElement(elmnt, cWidth, cHeight) {
        var deltaX = 0,
            deltaY = 0,
            lastX = 0,
            lastY = 0;
        elmnt.onmousedown = dragMouseDown;
        elmnt.ontouchstart = dragMouseDown;

        elmnt.style.left = 0;
        elmnt.style.top = 0;
        elmnt.style.maxWidth = cWidth - elmnt.offsetLeft;
        elmnt.style.maxHeight = cHeight - elmnt.offsetTop;

        /**
         *
         * @param {MouseEvent | TouchEvent} e
         */
        function dragMouseDown(e) {
            /** @type {MouseEvent | Touch} */
            let interaction = e;

            if (e.type.includes("touch")) {
                /** @type {TouchEvent} */
                const touchEvent = e;
                interaction = touchEvent.targetTouches[0];
            }

            // checks that mousedown is inside the
            // resize corner padding for the element
            const padding = 20; // pixels
            if (
                interaction.offsetX > elmnt.offsetWidth - padding &&
                interaction.offsetY > elmnt.offsetHeight - padding
            ) {
                // allow resizing
                return;
            }

            e.preventDefault();
            // get the mouse cursor position at startup
            lastX = interaction.clientX;
            lastY = interaction.clientY;
            elmnt.focus();

            // call a function whenever the cursor moves
            document.onmousemove = dragElement;
            document.ontouchmove = dragElement;
            document.onmouseup = closeDragElement;
            document.ontouchend = closeDragElement;
        }

        moveArea = (elmnt, dx, dy) => {
            // set the element's new position:
            elmnt.offsetWidth = clamp(0, elmnt.style.width, cWidth - elmnt.offsetLeft);
            elmnt.offsetHeight = clamp(0, elmnt.style.height, cHeight - elmnt.offsetTop);
            elmnt.style.width = elmnt.offsetWidth;
            elmnt.style.height = elmnt.offsetHeight;

            elmnt.style.top = clamp(0, elmnt.offsetTop + dy, cHeight - elmnt.offsetHeight) + "px";
            elmnt.style.left = clamp(0, elmnt.offsetLeft + dx, cWidth - elmnt.offsetWidth) + "px";
            elmnt.style.maxWidth = cWidth - elmnt.offsetLeft;
            elmnt.style.maxHeight = cHeight - elmnt.offsetTop;
        };

        /**
         *
         * @param {MouseEvent | TouchEvent} e
         */
        function dragElement(e) {
            /** @type {MouseEvent | Touch} */
            let interaction = e;

            if (e.type.includes("touch")) {
                /** @type {TouchEvent} */
                const touchEvent = e;
                interaction = touchEvent.targetTouches[0];
            }

            e.preventDefault();

            // calculate the new cursor position
            deltaX = interaction.clientX - lastX;
            deltaY = interaction.clientY - lastY;
            lastX = interaction.clientX;
            lastY = interaction.clientY;

            // set the element's new position
            moveArea(elmnt, deltaX, deltaY);
        }

        function closeDragElement() {
            // stop moving when mouse button is released
            document.onmousemove = null;
            document.ontouchmove = null;
            document.onmouseup = null;
            document.ontouchend = null;
        }
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

    /**
     *
     * @param {KeyboardEvent} event
     */
    function handleAreaKeyBindings(event) {
        let shift = 1;
        if (event.metaKey) shift = 10;
        if (event.shiftKey && event.metaKey) shift = 25;

        if (event.ctrlKey && event.ctrlKey) {
            if (event.key === "ArrowUp") {
                event.preventDefault();
                areaElt.style.height = areaElt.offsetHeight - shift;
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                areaElt.style.width = areaElt.offsetWidth + shift;
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                areaElt.style.height = areaElt.offsetHeight + shift;
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                areaElt.style.width = areaElt.offsetWidth - shift;
            }
        } else {
            if (event.key === "ArrowUp") {
                event.preventDefault();
                moveArea(areaElt, 0, -shift);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveArea(areaElt, shift, 0);
            } else if (event.key === "ArrowDown") {
                event.preventDefault();
                moveArea(areaElt, 0, shift);
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveArea(areaElt, -shift, 0);
            }
        }
    }

    areaElt.onfocus = () => {
        areaElt.onkeydown = handleAreaKeyBindings;
    };
    areaElt.onblur = () => {
        areaElt.onkeydown = undefined;
    };
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

document.addEventListener("DOMContentLoaded", init, { once: true });
