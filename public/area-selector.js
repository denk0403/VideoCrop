"use strict";
{
    const MIN_SIZE = 50;

    const styles = /* css */ `
    :host {
        position: absolute;
        top: 0;
        left: 0;
        min-width: ${MIN_SIZE}px;
        min-height: ${MIN_SIZE}px;
        background-color: rgba(0, 0, 0, 0.33);
        z-index: 10;
        outline: dashed #949494 2.5px;
        box-sizing: border-box;
        /* display: none; */
        justify-content: center;
        align-items: center;
        overflow-wrap: anywhere;
        cursor: move;

        /* prevents default behavior on mobile (scrolling) */
        touch-action: none;
    }

    .resizer {
        --radius: 10px;
        --position-offset: calc(var(--radius) * -1 - 2.5px);
        box-sizing: border-box;
        width: calc(var(--radius) * 2);
        height: calc(var(--radius) * 2);
        border-radius: 50%; /*magic to turn square into circle*/
        background: white;
        border: 3px solid #4286f4;
        position: absolute;
    }

    .resizer#top-left {
        left: var(--position-offset);
        top: var(--position-offset);
        cursor: nwse-resize; /*resizer cursor*/
    }
    .resizer#top-right {
        right: var(--position-offset);
        top: var(--position-offset);
        cursor: nesw-resize;
    }
    .resizer#bottom-left {
        left: var(--position-offset);
        bottom: var(--position-offset);
        cursor: nesw-resize;
    }
    .resizer#bottom-right {
        right: var(--position-offset);
        bottom: var(--position-offset);
        cursor: nwse-resize;
    }
    `;

    class AreaSelector extends HTMLElement {
        /** @type {ShadowRoot} */
        #r;

        get #box() {
            return this.getBoundingClientRect();
        }

        /** @type {number} */
        get width() {
            return this.#box.width;
        }
        /** @type {number} */
        get height() {
            return this.#box.height;
        }
        /** @type {number} */
        get x() {
            const parentXOffset = this.#parentBox.x;
            return parentXOffset - this.#box.x;
        }
        /** @type {number} */
        get y() {
            const parentXOffset = this.#parentBox.y;
            return parentXOffset - this.#box.y;
        }

        /** @type {HTMLElement} */
        get parent() {
            return this.offsetParent;
        }

        /** @type {DOMRect} */
        get #parentBox() {
            return this.offsetParent.getBoundingClientRect();
        }

        constructor() {
            super();

            this.#r = this.attachShadow({ mode: "open" });
            this.#r.innerHTML = /* html */ `
                <style>${styles}</style>
                <div class='resizable'>
                    <div id="top-left" class='resizer '></div>
                    <div id="top-right" class='resizer'></div>
                    <div id="bottom-left" class='resizer'></div>
                    <div id="bottom-right" class='resizer'></div>
                </div>
            `;
        }

        connectedCallback() {
            this.#makeResizable();
            this.#makeDraggable();
        }

        #makeResizable() {
            const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

            /** @type {NodeListOf<HTMLElement>} */
            const resizers = this.#r.querySelectorAll(".resizer");
            for (const resizer of resizers) {
                let startX, // horizontal position on page
                    startY, // vertical position on page
                    startLeft, // distance to parent's left edge (relative x-offset)
                    startTop, // distance to parent's top edge (relative y-offset)
                    startRight, // distance to parent's right edge
                    startBottom, // distance to parent's bottom edge
                    startWidth,
                    startHeight,
                    startMouseX,
                    startMouseY;

                resizer.addEventListener("mousedown", (e) => {
                    e.preventDefault();

                    const parentBox = this.#parentBox;
                    const boundingBox = this.#box;
                    startX = boundingBox.x;
                    startY = boundingBox.y;
                    startWidth = boundingBox.width;
                    startHeight = boundingBox.height;
                    startLeft = startX - parentBox.x;
                    startTop = startY - parentBox.y;
                    startRight = parentBox.width - (startLeft + startWidth);
                    startBottom = parentBox.height - (startTop + startHeight);
                    startMouseX = e.pageX;
                    startMouseY = e.pageY;

                    window.addEventListener("mousemove", resize);
                    window.addEventListener("mouseup", () =>
                        window.removeEventListener("mousemove", touchResize),
                    );
                });

                resizer.addEventListener("touchstart", (e) => {
                    e.preventDefault();

                    const parentBox = this.#parentBox;
                    const boundingBox = this.#box;
                    startX = boundingBox.x;
                    startY = boundingBox.y;
                    startWidth = boundingBox.width;
                    startHeight = boundingBox.height;
                    startLeft = startX - parentBox.x;
                    startTop = startY - parentBox.y;
                    startRight = parentBox.width - (startLeft + startWidth);
                    startBottom = parentBox.height - (startTop + startHeight);
                    startMouseX = e.pageX;
                    startMouseY = e.pageY;

                    window.addEventListener("touchmove", touchResize);
                    window.addEventListener("touchend", () =>
                        window.removeEventListener("touchmove", touchResize),
                    );
                });

                /**
                 * @param {MouseEvent | Touch} e
                 */
                const resize = (e) => {
                    if (resizer.id === "bottom-right") {
                        // horizontal movement
                        const movementX = e.pageX - startMouseX;
                        const newWidth = clamp(
                            MIN_SIZE,
                            startWidth + movementX,
                            startWidth + startRight,
                        );
                        this.style.width = newWidth + "px";

                        // vertical movement
                        const movementY = e.pageY - startMouseY;
                        const newHeight = clamp(
                            MIN_SIZE,
                            startHeight + movementY,
                            startHeight + startBottom,
                        );
                        this.style.height = newHeight + "px";
                    } else if (resizer.id === "bottom-left") {
                        // horizontal movement
                        const movementX = e.pageX - startMouseX;
                        const xShift = clamp(-startLeft, movementX, startWidth - MIN_SIZE);
                        const newWidth = startWidth - xShift;
                        const newLeft = startLeft + xShift;
                        this.style.width = newWidth + "px";
                        this.style.left = newLeft + "px";

                        // vertical movement
                        const movementY = e.pageY - startMouseY;
                        const newHeight = clamp(
                            MIN_SIZE,
                            startHeight + movementY,
                            startHeight + startBottom,
                        );
                        this.style.height = newHeight + "px";
                    } else if (resizer.id === "top-right") {
                        // horizontal movement
                        const movementX = e.pageX - startMouseX;
                        const newWidth = clamp(
                            MIN_SIZE,
                            startWidth + movementX,
                            startWidth + startRight,
                        );
                        this.style.width = newWidth + "px";

                        // vertical movement
                        const movementY = e.pageY - startMouseY;
                        const yShift = clamp(-startTop, movementY, startHeight - MIN_SIZE);
                        const newHeight = startHeight - yShift;
                        const newTop = startTop + yShift;

                        this.style.height = newHeight + "px";
                        this.style.top = newTop + "px";
                    } else {
                        // horizontal movement
                        const movementX = e.pageX - startMouseX;
                        const xShift = clamp(-startLeft, movementX, startWidth - MIN_SIZE);
                        const newWidth = startWidth - xShift;
                        const newLeft = startLeft + xShift;
                        this.style.width = newWidth + "px";
                        this.style.left = newLeft + "px";

                        // vertical movement
                        const movementY = e.pageY - startMouseY;
                        const yShift = clamp(-startTop, movementY, startHeight - MIN_SIZE);
                        const newHeight = startHeight - yShift;
                        const newTop = startTop + yShift;
                        this.style.height = newHeight + "px";
                        this.style.top = newTop + "px";
                    }
                };

                /**
                 * @param {TouchEvent} e
                 */
                const touchResize = (e) => {
                    const touch = e.targetTouches[0];
                    resize(touch);
                };
            }
        }

        #makeDraggable() {}

        #isNewSizeWithinParent(newX, newY, newWidth, newHeight) {
            return true;
            const parentBox = this.#parentBox;
            return (
                newX >= 0 &&
                newY >= 0 &&
                newX + newWidth <= parentBox.width &&
                newY + newHeight <= parentBox.height
            );
        }

        #clampBoxToParent(newX, newY, newWidth, newHeight) {}
    }

    customElements.define("area-selector", AreaSelector);
}
