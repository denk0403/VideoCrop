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

    new ResizeObserver(() => {
        areaElt.textContent = `${areaElt.offsetWidth} x ${areaElt.offsetHeight}`;
    }).observe(areaElt);

    const { createFFmpeg, fetchFile } = FFmpeg;

    let ffmpeg;
    function initFFmpeg() {
        ffmpeg = createFFmpeg({
            corePath: "./ffmpeg-core/ffmpeg-core.js",
            progress: ({ ratio }) => {
                progress.textContent = `${(ratio * 100).toFixed(2)}%`;
            },
        });
        return ffmpeg;
    }
    initFFmpeg();

    /**
     * @param {File} file
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     */
    const transcode = async (file, x, y, w, h) => {
        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        ffmpeg.FS("writeFile", file.name, await fetchFile(file));
        await ffmpeg.run("-i", file.name, "-filter:v", `crop=${w}:${h}:${x}:${y}`, "output.mp4");
        const data = ffmpeg.FS("readFile", "output.mp4");

        if (videoOut.src) URL.revokeObjectURL(videoOut.src);
        videoOut.onresize = () => {
            videoOut.style.display = "inline-block";
        };
        videoOut.src = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
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
                dragElement(areaElt, videoIn.videoWidth, videoIn.videoHeight);
                progress.textContent = "";
                cropBtn.disabled = false;
                cropBtn.textContent = "Crop";

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
                        );
                    } catch (err) {
                        progress.textContent = "Errored";
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
     * @param {HTMLDivElement} elmnt
     * @param {number} width
     * @param {number} height
     */
    function dragElement(elmnt, width, height) {
        var deltaX = 0,
            deltaY = 0,
            lastX = 0,
            lastY = 0;
        elmnt.onmousedown = dragMouseDown;

        elmnt.style.left = 0;
        elmnt.style.top = 0;
        elmnt.style.width = "50%";
        elmnt.style.height = "50%";
        elmnt.style.maxWidth = width - elmnt.offsetLeft;
        elmnt.style.maxHeight = height - elmnt.offsetTop;

        /**
         *
         * @param {MouseEvent} e
         */
        function dragMouseDown(e) {
            e = e || window.event;

            const padding = 20; // pixels
            if (
                e.offsetX > elmnt.offsetWidth - padding &&
                e.offsetY > elmnt.offsetHeight - padding
            ) {
                // allow resizing
                return;
            }

            e.preventDefault();
            // get the mouse cursor position at startup:
            lastX = e.clientX;
            lastY = e.clientY;
            document.onmouseup = closeDragElement;
            // call a function whenever the cursor moves:
            document.onmousemove = elementDrag;
        }

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
         *
         * @param {MouseEvent} e
         */
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();

            // calculate the new cursor position:
            deltaX = lastX - e.clientX;
            deltaY = lastY - e.clientY;
            lastX = e.clientX;
            lastY = e.clientY;

            // set the element's new position:
            elmnt.offsetWidth = clamp(0, elmnt.style.width, width - elmnt.offsetLeft);
            elmnt.offsetHeight = clamp(0, elmnt.style.height, height - elmnt.offsetTop);
            elmnt.style.width = elmnt.offsetWidth;
            elmnt.style.height = elmnt.offsetHeight;

            elmnt.style.top =
                clamp(0, elmnt.offsetTop - deltaY, height - elmnt.offsetHeight) + "px";
            elmnt.style.left =
                clamp(0, elmnt.offsetLeft - deltaX, width - elmnt.offsetWidth) + "px";
            elmnt.style.maxWidth = width - elmnt.offsetLeft;
            elmnt.style.maxHeight = height - elmnt.offsetTop;
        }

        function closeDragElement() {
            // stop moving when mouse button is released:
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    document.body.addEventListener("dragover", (event) => {
        event.preventDefault();
    });
    document.body.addEventListener("drop", (event) => {
        event.preventDefault();
        inputHtml.files = event.dataTransfer.files;
        inputHtml.dispatchEvent(new InputEvent("input"));
    });
}

document.addEventListener("DOMContentLoaded", init, { once: true });
