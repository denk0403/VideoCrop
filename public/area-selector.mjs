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
    /** @type {ShadowRoot} */
    #r;

    /** @type {DOMRect} */
    #parentBox;

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

        let onChange;
        Object.defineProperty(this, "onchange", {
            get() {
                return onChange;
            },
            set(fn) {
                if (onChange) this.removeEventListener("change", onChange);
                onChange = fn;
                this.addEventListener("change", fn);
            },
        });
    }

    get x() {
        return this.offsetLeft;
    }

    get y() {
        return this.offsetTop;
    }

    get width() {
        return this.offsetWidth;
    }

    get height() {
        return this.offsetHeight;
    }

    dispatchChangeEvent() {
        this.dispatchEvent(new CustomEvent("change"));
    }

    connectedCallback() {
        this.#watchParentBox();
        this.#makeResizable();
        this.#makeDraggable();
        this.#attachKeyBindings();
    }

    #makeResizable() {
        /** @typedef {{prevPageX: number; prevPageY: number}} Scope */
        /** @typedef {(scope: Scope) => (e: PointerEvent) => any} ResizeHandlerGenerator */

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
        const createHandleRight = (scope) => (e) => {
            const left = this.offsetLeft;
            const width = this.offsetWidth;
            const right = this.#parentBox.width - (left + width);

            const movementX = e.pageX - scope.prevPageX;
            const newWidth = clamp(MIN_SIZE, width + movementX, width + right);

            this.style.width = newWidth + "px";
            scope.prevPageX = e.pageX;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleLeft = (scope) => (e) => {
            const left = this.offsetLeft;
            const width = this.offsetWidth;

            const movementX = e.pageX - scope.prevPageX;
            const xShift = clamp(-left, movementX, width - MIN_SIZE);
            const newWidth = width - xShift;
            const newLeft = left + xShift;

            this.style.width = newWidth + "px";
            this.style.left = newLeft + "px";
            scope.prevPageX = e.pageX;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleBottom = (scope) => (e) => {
            const height = this.offsetHeight;
            const top = this.offsetTop;
            const bottom = this.#parentBox.height - (top + height);

            const movementY = e.pageY - scope.prevPageY;
            const newHeight = clamp(MIN_SIZE, height + movementY, height + bottom);

            this.style.height = newHeight + "px";
            scope.prevPageY = e.pageY;
        };
        /** @type {ResizeHandlerGenerator} */
        const createHandleTop = (scope) => (e) => {
            const height = this.offsetHeight;
            const top = this.offsetTop;

            const movementY = e.pageY - scope.prevPageY;
            const yShift = clamp(-top, movementY, height - MIN_SIZE);
            const newHeight = height - yShift;
            const newTop = top + yShift;

            this.style.height = newHeight + "px";
            this.style.top = newTop + "px";
            scope.prevPageY = e.pageY;
        };

        /** @type {Record<string, ResizeHandlerGenerator>} */
        const handlerGeneratorMap = {
            right: createHandleRight,
            bottom: createHandleBottom,
            left: createHandleLeft,
            top: createHandleTop,
            "bottom-right": (scope) => chain(createHandleBottom(scope), createHandleRight(scope)),
            "bottom-left": (scope) => chain(createHandleBottom(scope), createHandleLeft(scope)),
            "top-right": (scope) => chain(createHandleTop(scope), createHandleRight(scope)),
            "top-left": (scope) => chain(createHandleTop(scope), createHandleLeft(scope)),
        };

        /** @type {NodeListOf<HTMLElement>} */
        const resizers = this.#r.querySelectorAll(".resizer");
        for (const resizer of resizers) {
            /** @type {Scope} */
            const scope = { prevPageX: 0, prevPageY: 0 };
            const handleResize = handlerGeneratorMap[resizer.id](scope);

            resizer.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const pid = e.pointerId;
                scope.prevPageX = e.pageX;
                scope.prevPageY = e.pageY;

                /** @param {PointerEvent} e */
                const guardedResize = (e) => {
                    if (e.pointerId === pid) {
                        handleResize(e);
                        this.dispatchChangeEvent();
                    }
                };

                this.focus();
                const abortCtrl = new AbortController();

                window.addEventListener("pointermove", guardedResize, {
                    signal: abortCtrl.signal,
                });

                window.addEventListener(
                    "pointerup",
                    (e) => {
                        if (e.pointerId === pid) abortCtrl.abort();
                    },
                    { signal: abortCtrl.signal },
                );
            });
        }
    }

    #makeDraggable() {
        let startLeft, // distance to parent's left edge (relative x-offset)
            startTop, // distance to parent's top edge (relative y-offset)
            startRight, // distance to parent's right edge
            startBottom, // distance to parent's bottom edge
            startPageX,
            startPageY;

        /** @param {MouseEvent | Touch} e */
        const handleTranslate = (e) => {
            const movementX = e.pageX - startPageX;
            const movementY = e.pageY - startPageY;

            this.style.left = clamp(0, startLeft + movementX, startLeft + startRight) + "px";
            this.style.top = clamp(0, startTop + movementY, startTop + startBottom) + "px";
        };

        /** @type {number?} */
        let currentPid = null;
        /** @param {PointerEvent} e */
        const guardedTranslate = (e) => {
            if (e.pointerId === currentPid) {
                handleTranslate(e);
                this.dispatchChangeEvent();
            }
        };

        this.addEventListener("pointerdown", (e) => {
            // abort if a pointer is already active
            if (currentPid !== null) return;
            currentPid = e.pointerId;

            // assign initial conditions
            startLeft = this.offsetLeft;
            startTop = this.offsetTop;
            startRight = this.#parentBox.width - (startLeft + this.offsetWidth);
            startBottom = this.#parentBox.height - (startTop + this.offsetHeight);
            startPageX = e.pageX;
            startPageY = e.pageY;

            this.focus();
            window.addEventListener("pointermove", guardedTranslate);
        });

        window.addEventListener("pointerup", (e) => {
            if (currentPid === null || e.pointerId !== currentPid) return;
            window.removeEventListener("pointermove", guardedTranslate);
            currentPid = null;
        });
    }

    #attachKeyBindings() {
        /** @param {KeyboardEvent} e */
        const handleKeyPress = (e) => {
            const width = this.offsetWidth;
            const height = this.offsetHeight;
            const availLeft = this.offsetLeft;
            const availTop = this.offsetTop;
            const availRight = this.#parentBox.width - (availLeft + width);
            const availBottom = this.#parentBox.height - (availTop + height);

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
                    default:
                        return;
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
                    default:
                        return;
                }
            }

            this.dispatchChangeEvent();
        };

        this.addEventListener("focus", () => {
            window.addEventListener("keydown", handleKeyPress);
            this.addEventListener(
                "blur",
                () => window.removeEventListener("keydown", handleKeyPress),
                { once: true },
            );
        });
    }

    #watchParentBox() {
        const resizeObs = new ResizeObserver(() => {
            this.#parentBox = this.offsetParent?.getBoundingClientRect();
        });

        new IntersectionObserver(() => {
            if (this.offsetParent) {
                resizeObs.observe(this.offsetParent);
            } else {
                resizeObs.disconnect();
            }
        }).observe(this);
    }

    setX(x) {
        if (x < 0 || x > this.#parentBox.width - this.offsetWidth) return;
        this.style.left = x + "px";
    }

    setY(y) {
        if (y < 0 || y > this.#parentBox.height - this.offsetHeight) return;
        this.style.top = y + "px";
    }

    setWidth(width) {
        if (width < MIN_SIZE || width > this.#parentBox.width - this.offsetLeft) return;
        this.style.width = width + "px";
    }

    setHeight(height) {
        if (height < MIN_SIZE || height > this.#parentBox.height - this.offsetTop) return;
        this.style.height = height + "px";
    }
}

customElements.define("area-selector", AreaSelector);
