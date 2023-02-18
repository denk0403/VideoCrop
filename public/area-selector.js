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
            return this.#parentBox.x - this.#box.x;
        }
        /** @type {number} */
        get y() {
            return this.#parentBox.y - this.#box.y;
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

            /** @param {MouseEvent | Touch} e */
            const assignStartingValues = (e) => {
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
            };

            const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

            /** @type {NodeListOf<HTMLElement>} */
            const resizers = this.#r.querySelectorAll(".resizer");
            for (const resizer of resizers) {
                /** @param {MouseEvent | Touch} e */
                const resize = (e) => {
                    switch (resizer.id) {
                        case "bottom-right": {
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
                            break;
                        }
                        case "bottom-left": {
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
                            break;
                        }
                        case "top-right": {
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
                            break;
                        }
                        case "top-left": {
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
                            break;
                        }
                    }
                };

                /** @param {TouchEvent} e */
                const touchResize = (e) => {
                    const touch = e.targetTouches[0];
                    resize(touch);
                };

                resizer.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    assignStartingValues(e);

                    window.addEventListener("mousemove", resize);
                    window.addEventListener("mouseup", () =>
                        window.removeEventListener("mousemove", resize),
                    );
                });

                resizer.addEventListener("touchstart", (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const touch = e.targetTouches[0];
                    assignStartingValues(touch);

                    window.addEventListener("touchmove", touchResize);
                    window.addEventListener("touchend", () =>
                        window.removeEventListener("touchmove", touchResize),
                    );
                });
            }
        }

        #makeDraggable() {
            let startLeft, // distance to parent's left edge (relative x-offset)
                startTop, // distance to parent's top edge (relative y-offset)
                startRight, // distance to parent's right edge
                startBottom, // distance to parent's bottom edge
                startWidth,
                startHeight,
                startMouseX,
                startMouseY;

            /** @param {MouseEvent | Touch} e */
            const assignStartingValues = (e) => {
                const parentBox = this.#parentBox;
                const boundingBox = this.#box;
                startWidth = boundingBox.width;
                startHeight = boundingBox.height;
                startLeft = boundingBox.x - parentBox.x;
                startTop = boundingBox.y - parentBox.y;
                startRight = parentBox.width - (startLeft + startWidth);
                startBottom = parentBox.height - (startTop + startHeight);
                startMouseX = e.pageX;
                startMouseY = e.pageY;
            };

            const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

            /** @param {MouseEvent | Touch} e */
            const translate = (e) => {
                const movementX = e.pageX - startMouseX;
                const movementY = e.pageY - startMouseY;

                this.style.left = clamp(0, startLeft + movementX, startLeft + startRight);
                this.style.top = clamp(0, startTop + movementY, startTop + startBottom);
            };

            /** @param {TouchEvent} e */
            const touchTranslate = (e) => {
                const touch = e.targetTouches[0];
                translate(touch);
            };

            this.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();

                assignStartingValues(e);

                window.addEventListener("mousemove", translate);
                window.addEventListener("mouseup", () =>
                    window.removeEventListener("mousemove", translate),
                );
            });
            this.addEventListener("touchstart", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const touch = e.targetTouches[0];
                assignStartingValues(touch);

                window.addEventListener("touchmove", touchTranslate);
                window.addEventListener("touchend", () =>
                    window.removeEventListener("touchmove", touchTranslate),
                );
            });
        }
    }

    customElements.define("area-selector", AreaSelector);
}
