const CACHE_NAME = "videocrop-v1.2.6";
const FFMPEG_URLS = [
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm",
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
    "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.worker.js",
];
const PRECACHE_URLS = [
    "/",
    "/styles.css",
    "/index.js",
    "/area-selector.mjs",
    "/ffmpeg.min.js",
    "/swWrapper.js",
    "/default-yellow.png",
    ...FFMPEG_URLS,
];

// Install a service worker
self.addEventListener("install", (event) => {
    self.skipWaiting(); // forces this service worker to become the active service worker.

    // delete old cache, then
    // precache updated assets
    const refreshCacheTask = caches
        .keys()
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .then(() => caches.open(CACHE_NAME))
        .then((cache) => cache.addAll(PRECACHE_URLS));

    event.waitUntil(refreshCacheTask);
});

// Allow service worker to control current page on next load
self.addEventListener("activate", (event) => {
    console.log("Activating new service worker");
    event.waitUntil(clients.claim());
});

// Intercepts when the browser fetches a URL to check cache
self.addEventListener("fetch", (event) => event.respondWith(fetchWrapper(event.request)));

/** @param {Request} req */
function fetchWrapper(req) {
    if (FFMPEG_URLS.includes(req.url)) return cacheFirst(req);
    return networkFirst(req);
}

/** Returns a match from the cache first, only making a network request if necessary
 * @param {Request} req */
async function cacheFirst(req) {
    try {
        const cache = await caches.open(CACHE_NAME);
        try {
            const cached = await cache.match(req);
            return cached ?? networkAndCache(cache, req);
        } catch (reason) {
            console.error("Errored while reading from cache", req.url, reason, "Trying network...");
            return networkAndCache(cache, req);
        }
    } catch (reason) {
        console.error("Error opening cache:", CACHE_NAME, reason, "Trying network...");
        return fetch(req);
    }
}

/** Returns a match from the network first, only opening cache if necessary
 * @param {Request} req */
async function networkFirst(req) {
    try {
        const fresh = await fetch(req);
        const freshCopy = fresh.clone(); // must clone before use
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(req, freshCopy))
            .catch((reason) => console.error("Failed to update cache", reason));
        return fresh;
    } catch (e) {
        console.error(e, req.url, "Trying to retrieve from cache...");
        const cache = await caches.open(CACHE_NAME);
        return cache.match(req);
    }
}

/**
 * Makes the network request immediately if possible,
 * and saves the result in cache for future offline use
 * @param {Cache} cache
 * @param {Request} req
 */
async function networkAndCache(cache, req) {
    const fresh = await fetch(req);
    cache
        .put(req, fresh.clone()) // must clone before use
        .catch((reason) => console.error("Failed to update cache", reason));
    return fresh;
}
