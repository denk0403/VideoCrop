const MIN_SIZE = 50;
const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

const styles = /* css */ `
:host {
    position: absolute;
    top: 0;
    left: 0;
    width: 33%; /* default */
    height: 33%; /* default */
    min-width: ${MIN_SIZE}px;
    min-height: ${MIN_SIZE}px;

    z-index: 15;
    box-sizing: border-box;
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

.resizer#right {
    right: var(--position-offset);
    top: calc(50% - var(--radius));;
    cursor: ew-resize;
}
.resizer#left {
    left: var(--position-offset);
    top: calc(50% - var(--radius));;
    cursor: ew-resize;
}
.resizer#bottom {
    left: calc(50% - var(--radius));;
    bottom: var(--position-offset);
    cursor: ns-resize;
}
.resizer#top {
    left: calc(50% - var(--radius));;
    top: var(--position-offset);
    cursor: ns-resize;
}
.resizer#top-left {
    left: var(--position-offset);
    top: var(--position-offset);
    cursor: nwse-resize;
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

export class AreaSelector extends HTMLElement {
    /** @type {ShadowRoot} */
    #r;

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
                    <div id="right" class='resizer'></div>
                    <div id="left" class='resizer'></div>
                    <div id="bottom" class='resizer'></div>
                    <div id="top" class='resizer'></div>
                    <div id="top-left" class='resizer'></div>
                    <div id="top-right" class='resizer'></div>
                    <div id="bottom-left" class='resizer'></div>
                    <div id="bottom-right" class='resizer'></div>
                    <slot></slot>
                </div>
            `;
    }

    connectedCallback() {
        this.#makeResizable();
        this.#makeDraggable();
        this.#attachKeyBindings();
    }

    #makeResizable() {
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
            startWidth = this.offsetWidth;
            startHeight = this.offsetHeight;
            startLeft = this.offsetLeft;
            startTop = this.offsetTop;
            startRight = parentBox.width - (startLeft + startWidth);
            startBottom = parentBox.height - (startTop + startHeight);
            startMouseX = e.pageX;
            startMouseY = e.pageY;
        };

        /** @param {MouseEvent | Touch} e */
        const handleRight = (e) => {
            const movementX = e.pageX - startMouseX;
            const newWidth = clamp(MIN_SIZE, startWidth + movementX, startWidth + startRight);
            this.style.width = newWidth + "px";
        };
        /** @param {MouseEvent | Touch} e */
        const handleLeft = (e) => {
            const movementX = e.pageX - startMouseX;
            const xShift = clamp(-startLeft, movementX, startWidth - MIN_SIZE);
            const newWidth = startWidth - xShift;
            const newLeft = startLeft + xShift;
            this.style.width = newWidth + "px";
            this.style.left = newLeft + "px";
        };
        /** @param {MouseEvent | Touch} e */
        const handleBottom = (e) => {
            const movementY = e.pageY - startMouseY;
            const newHeight = clamp(MIN_SIZE, startHeight + movementY, startHeight + startBottom);
            this.style.height = newHeight + "px";
        };
        /** @param {MouseEvent | Touch} e */
        const handleTop = (e) => {
            const movementY = e.pageY - startMouseY;
            const yShift = clamp(-startTop, movementY, startHeight - MIN_SIZE);
            const newHeight = startHeight - yShift;
            const newTop = startTop + yShift;

            this.style.height = newHeight + "px";
            this.style.top = newTop + "px";
        };

        const resizeHandlers = {
            right: handleRight,
            bottom: handleBottom,
            left: handleLeft,
            top: handleTop,
            "bottom-right": (e) => {
                handleBottom(e);
                handleRight(e);
            },
            "bottom-left": (e) => {
                handleBottom(e);
                handleLeft(e);
            },
            "top-right": (e) => {
                handleTop(e);
                handleRight(e);
            },
            "top-left": (e) => {
                handleTop(e);
                handleLeft(e);
            },
        };

        /** @type {NodeListOf<HTMLElement>} */
        const resizers = this.#r.querySelectorAll(".resizer");
        for (const resizer of resizers) {
            /** @param {MouseEvent | Touch} e */
            const resize = (e) => {
                resizeHandlers[resizer.id](e);
                this.dispatchEvent(new UIEvent("resize"));
            };

            resizer.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.focus();
                assignStartingValues(e);

                window.addEventListener("mousemove", resize);
                window.addEventListener(
                    "mouseup",
                    () => window.removeEventListener("mousemove", resize),
                    { once: true },
                );
            });

            resizer.addEventListener(
                "touchstart",
                (e) => {
                    e.stopPropagation();

                    this.focus();
                    const touch = e.changedTouches[0];
                    const identifier = touch.identifier;

                    /** @param {TouchEvent} e */
                    const touchResize = (e) => {
                        const touch = this.#getTouch(e.changedTouches, identifier);
                        resize(touch);
                    };

                    assignStartingValues(touch);

                    window.addEventListener("touchmove", touchResize, { passive: true });
                    window.addEventListener(
                        "touchend",
                        (e) => {
                            if (this.#getTouch(e.changedTouches, identifier))
                                window.removeEventListener("touchmove", touchResize);
                        },
                        { once: true, passive: true },
                    );
                },
                { passive: true },
            );
        }
    }

    #makeDraggable() {
        let startLeft, // distance to parent's left edge (relative x-offset)
            startTop, // distance to parent's top edge (relative y-offset)
            startRight, // distance to parent's right edge
            startBottom, // distance to parent's bottom edge
            startMouseX,
            startMouseY;

        /** @param {MouseEvent | Touch} e */
        const assignStartingValues = (e) => {
            const parentBox = this.#parentBox;
            startLeft = this.offsetLeft;
            startTop = this.offsetTop;
            startRight = parentBox.width - (startLeft + this.offsetWidth);
            startBottom = parentBox.height - (startTop + this.offsetHeight);
            startMouseX = e.pageX;
            startMouseY = e.pageY;
        };

        /** @param {MouseEvent | Touch} e */
        const translate = (e) => {
            const movementX = e.pageX - startMouseX;
            const movementY = e.pageY - startMouseY;

            this.style.left = clamp(0, startLeft + movementX, startLeft + startRight) + "px";
            this.style.top = clamp(0, startTop + movementY, startTop + startBottom) + "px";

            this.dispatchEvent(new UIEvent("translate"));
        };

        this.addEventListener("mousedown", (e) => {
            e.preventDefault();

            this.focus();
            assignStartingValues(e);

            window.addEventListener("mousemove", translate);
            window.addEventListener(
                "mouseup",
                () => window.removeEventListener("mousemove", translate),
                { once: true },
            );
        });

        this.addEventListener(
            "touchstart",
            (e) => {
                this.focus();
                const touch = e.changedTouches[0];
                const identifier = touch.identifier;

                /** @param {TouchEvent} e */
                const touchTranslate = (e) => {
                    const touch = this.#getTouch(e.changedTouches, identifier);
                    if (touch) translate(touch);
                };

                assignStartingValues(touch);

                window.addEventListener("touchmove", touchTranslate, { passive: true });
                window.addEventListener(
                    "touchend",
                    (e) => {
                        if (this.#getTouch(e.changedTouches, identifier))
                            window.removeEventListener("touchmove", touchTranslate);
                    },
                    { once: true, passive: true },
                );
            },
            { passive: true },
        );
    }

    #attachKeyBindings() {
        /** @param {KeyboardEvent} e */
        const handleKeyPress = (e) => {
            const parentBox = this.#parentBox;
            const availLeft = this.offsetLeft;
            const availTop = this.offsetTop;
            const availRight = parentBox.width - (availLeft + this.offsetWidth);
            const availBottom = parentBox.height - (availTop + this.offsetHeight);

            let shift = 1;
            if (e.metaKey) shift = 10;
            if (e.shiftKey && e.metaKey) shift = 25;

            if (e.ctrlKey && e.altKey) {
                switch (e.key) {
                    case "ArrowUp":
                        shift *= -1;
                    case "ArrowDown": {
                        e.preventDefault();
                        this.style.height =
                            clamp(
                                MIN_SIZE,
                                this.offsetHeight + shift,
                                this.offsetHeight + availBottom,
                            ) + "px";
                        break;
                    }
                    case "ArrowLeft":
                        shift *= -1;
                    case "ArrowRight": {
                        e.preventDefault();
                        this.style.width =
                            clamp(
                                MIN_SIZE,
                                this.offsetWidth + shift,
                                this.offsetWidth + availRight,
                            ) + "px";
                        break;
                    }
                }
            } else {
                switch (e.key) {
                    case "ArrowUp":
                        shift *= -1;
                    case "ArrowDown": {
                        e.preventDefault();
                        this.style.top =
                            clamp(0, this.offsetTop + shift, this.offsetTop + availBottom) + "px";
                        break;
                    }
                    case "ArrowLeft":
                        shift *= -1;
                    case "ArrowRight": {
                        e.preventDefault();
                        this.style.left =
                            clamp(0, this.offsetLeft + shift, this.offsetLeft + availRight) + "px";
                        break;
                    }
                }
            }
        };

        this.addEventListener("focus", () => {
            window.addEventListener("keydown", handleKeyPress);
            window.addEventListener(
                "blur",
                () => window.removeEventListener("keydown", handleKeyPress),
                { once: true },
            );
        });
    }

    /**
     * @param {TouchList} touchList
     * @param {number} identifier
     */
    #getTouch(touchList, identifier) {
        return [...touchList].find((t) => t.identifier === identifier);
    }
}

customElements.define("area-selector", AreaSelector);
