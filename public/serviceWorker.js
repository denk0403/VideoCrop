const CACHE_NAME = "videocrop-v1.2.2";
const urlsToCache = [
    "/",
    "/index.js",
    "/ffmpeg.min.js",
    "/swWrapper.js",
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm",
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js",
];

// Install a service worker
self.addEventListener("install", (event) => {
    self.skipWaiting();

    // Precache assets on install
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        }),
    );
});

// Allow service worker to control current page on next load
self.addEventListener("activate", (event) => {
    console.log("Activating new service worker");
    event.waitUntil(clients.claim());
});

// Intercepts when the browser fetches a URL to check cache
self.addEventListener("fetch", (event) => event.respondWith(cacheFirst(event.request)));

// Returns a match from the cache first, only making a network request if necessary
async function cacheFirst(req) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    return cached ?? networkAndCache(cache, req);
}

// Makes the network request immediately if possible,
// and saves the result in cache for future offline use
async function networkAndCache(cache, req) {
    try {
        const fresh = await fetch(req);
        await cache.put(req, fresh.clone()); // must clone before use
        return fresh;
    } catch (e) {
        console.error(e);
        return;
    }
}

// // Intercepts when the browser fetches a URL to use network first, then check cache
// self.addEventListener("fetch", (event) => event.respondWith(networkFirst(event.request)));

// // Makes the network request immediately if possible,
// // and saves the result in cache for future offline use
// async function networkFirst(req) {
//     const cache = await caches.open(CACHE_NAME);
//     try {
//         const fresh = await fetch(req);
//         await cache.put(req, fresh.clone()); // must clone before result is used
//         return fresh;
//     } catch (err) {
//         console.error(err);
//         return fallbackToCache(cache, req);
//     }
// }

// // Fallback to cache; retrieves the resource from cache if available.
// function fallbackToCache(cache, req) {
//     return cache.match(req);
// }
