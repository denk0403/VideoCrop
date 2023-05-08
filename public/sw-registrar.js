async function registerSW() {
    return await new Promise((res, rej) => {
        if ("serviceWorker" in navigator) {
            if (navigator.serviceWorker.controller) {
                console.log("Service worker already found, skipping register");
                res();
            } else {
                window.addEventListener("load", () =>
                    navigator.serviceWorker
                        .register("/sw.js")
                        .then(res())
                        .catch((error) =>
                            console.error("Error during service worker registration:", error),
                        ),
                );
            }
        } else {
            rej("Service Workers are not available at the moment.");
        }
    });
}

async function unregisterSW() {
    if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.unregister();
    }
}

registerSW();
