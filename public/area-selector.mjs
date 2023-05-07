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
    border-radius: 50%;
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
    /** @typedef {(touch: Touch) => any} TouchAction */
    /** @typedef {(e: TouchEvent) => any} TouchEventHandler */

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
        /** @typedef {{prevMouseX: number; prevMouseY: number}} PointerContext */
        /** @typedef {(pc: PointerContext) => (e: MouseEvent | Touch) => any} ResizeHandlerGenerator */

        /**
         * @template E
         * @param {((e: E) => any)[]} fns
         * @returns {(e: E) => void}
         */
        const chain =
            (...fns) =>
            (e) =>
                fns.forEach((fn) => fn(e));

        /** @type {ResizeHandlerGenerator} */
        const createHandleRight = (pc) => (e) => {
            const left = this.offsetLeft;
            const width = this.offsetWidth;

            const movementX = e.pageX - pc.prevMouseX;
            const right = this.#parentBox.width - (left + width);
            const newWidth = clamp(MIN_SIZE, width + movementX, width + right);

            this.style.width = newWidth + "px";
            pc.prevMouseX = e.pageX;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleLeft = (pc) => (e) => {
            const left = this.offsetLeft;
            const width = this.offsetWidth;

            const movementX = e.pageX - pc.prevMouseX;
            const xShift = clamp(-left, movementX, width - MIN_SIZE);
            const newWidth = width - xShift;
            const newLeft = left + xShift;

            this.style.width = newWidth + "px";
            this.style.left = newLeft + "px";
            pc.prevMouseX = e.pageX;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleBottom = (pc) => (e) => {
            const height = this.offsetHeight;
            const top = this.offsetTop;

            const movementY = e.pageY - pc.prevMouseY;
            const bottom = this.#parentBox.height - (top + height);
            const newHeight = clamp(MIN_SIZE, height + movementY, height + bottom);

            this.style.height = newHeight + "px";
            pc.prevMouseY = e.pageY;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleTop = (pc) => (e) => {
            const height = this.offsetHeight;
            const top = this.offsetTop;

            const movementY = e.pageY - pc.prevMouseY;
            const yShift = clamp(-top, movementY, height - MIN_SIZE);
            const newHeight = height - yShift;
            const newTop = top + yShift;

            this.style.height = newHeight + "px";
            this.style.top = newTop + "px";
            pc.prevMouseY = e.pageY;
        };

        /** @type {Record<string, ResizeHandlerGenerator>} */
        const resizeHandlerGeneratorMap = {
            right: createHandleRight,
            bottom: createHandleBottom,
            left: createHandleLeft,
            top: createHandleTop,
            "bottom-right": (pc) => chain(createHandleBottom(pc), createHandleRight(pc)),
            "bottom-left": (pc) => chain(createHandleBottom(pc), createHandleLeft(pc)),
            "top-right": (pc) => chain(createHandleTop(pc), createHandleRight(pc)),
            "top-left": (pc) => chain(createHandleTop(pc), createHandleLeft(pc)),
        };

        /** @type {NodeListOf<HTMLElement>} */
        const resizers = this.#r.querySelectorAll(".resizer");
        for (const resizer of resizers) {
            /** @type {PointerContext} */
            let pc = { prevMouseX: 0, prevMouseY: 0 };
            const handleResize = resizeHandlerGeneratorMap[resizer.id](pc);

            resizer.addEventListener("mousedown", (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.focus();

                pc.prevMouseX = e.pageX;
                pc.prevMouseY = e.pageY;

                window.addEventListener("mousemove", handleResize);
                window.addEventListener(
                    "mouseup",
                    () => window.removeEventListener("mousemove", handleResize),
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
                    pc.prevMouseX = touch.pageX;
                    pc.prevMouseY = touch.pageY;

                    /** @param {TouchEvent} e */
                    const touchResize = (e) => {
                        const touch = this.#getTouch(e.changedTouches, identifier);
                        if (touch) handleResize(touch);
                    };

                    const abortCtrl = new AbortController();

                    window.addEventListener("touchmove", touchResize, {
                        passive: true,
                        signal: abortCtrl.signal,
                    });

                    window.addEventListener(
                        "touchend",
                        (e) => {
                            if (this.#getTouch(e.changedTouches, identifier)) abortCtrl.abort();
                        },
                        { passive: true, signal: abortCtrl.signal },
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

        /** @type {number?} */
        let currentTouchId = null;
        /** @type {TouchEventHandler} */
        const touchTranslate = (e) => {
            if (currentTouchId === null) return;

            const touch = this.#getTouch(e.changedTouches, currentTouchId);
            if (touch) translate(touch);
        };

        this.addEventListener(
            "touchstart",
            (e) => {
                // abort if a touch is already active
                if (currentTouchId !== null) return;

                this.focus();
                const touch = e.changedTouches[0];
                currentTouchId = touch.identifier;

                assignStartingValues(touch);

                window.addEventListener("touchmove", touchTranslate, { passive: true });
            },
            { passive: true },
        );

        window.addEventListener(
            "touchend",
            (e) => {
                if (currentTouchId === null || !this.#getTouch(e.changedTouches, currentTouchId))
                    return;

                window.removeEventListener("touchmove", touchTranslate);
                currentTouchId = null;
            },
            { passive: true },
        );
    }

    #attachKeyBindings() {
        /** @param {KeyboardEvent} e */
        const handleKeyPress = (e) => {
            const parentBox = this.#parentBox;
            const width = this.offsetWidth;
            const height = this.offsetHeight;
            const availLeft = this.offsetLeft;
            const availTop = this.offsetTop;
            const availRight = parentBox.width - (availLeft + width);
            const availBottom = parentBox.height - (availTop + height);

            let shift = 1;
            if (e.metaKey) shift = 10;
            if (e.shiftKey && e.metaKey) shift = 25;

            if (e.ctrlKey && e.altKey) {
                // resize
                switch (e.key) {
                    case "ArrowUp":
                        shift *= -1;
                    case "ArrowDown": {
                        e.preventDefault();
                        const newHeight = clamp(MIN_SIZE, height + shift, height + availBottom);
                        this.style.height = newHeight + "px";
                        break;
                    }
                    case "ArrowLeft":
                        shift *= -1;
                    case "ArrowRight": {
                        e.preventDefault();
                        const newWidth = clamp(MIN_SIZE, width + shift, width + availRight);
                        this.style.width = newWidth + "px";
                        break;
                    }
                }
            } else {
                // translate
                switch (e.key) {
                    case "ArrowUp":
                        shift *= -1;
                    case "ArrowDown": {
                        e.preventDefault();
                        const newTop = clamp(0, availTop + shift, availTop + availBottom);
                        this.style.top = newTop + "px";
                        break;
                    }
                    case "ArrowLeft":
                        shift *= -1;
                    case "ArrowRight": {
                        e.preventDefault();
                        const newLeft = clamp(0, availLeft + shift, availLeft + availRight);
                        this.style.left = newLeft + "px";
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
