const CACHE_NAME = "videocrop";
const urlsToCache = [
    "/",
    "/index.js",
    "/ffmpeg.min.js",
    "/ffmpeg-core/ffmpeg-core.worker.js",
    "/ffmpeg-core/ffmpeg-core.js",
    "/ffmpeg-core/ffmpeg-core.wasm",
    "/serviceWorker.js",
    "/swWrapper.js",
];

// Install a service worker
self.addEventListener("install", (event) => {
    self.skipWaiting();

    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log(`Opened cache: ${CACHE_NAME}`);
            return cache.addAll(urlsToCache);
        }),
    );
});

// Cache and return requests
self.addEventListener("fetch", async (event) => {
    const req = event.request;
    event.respondWith(tryNetwork(req).catch(() => fallbackToCache(req)));
});

/**
 * Attempts retrieving the given resource from the network, and stores the result in cache.
 */
async function tryNetwork(req) {
    return fetch(req).then((res) =>
        // Store in cache on success
        caches.open(CACHE_NAME).then((cache) => {
            cache.put(req.url, res.clone());
            return res;
        }),
    );
}
/**
 * Fallback to cache; retrieves the resource from cache if available.
 */
async function fallbackToCache(req) {
    return caches.match(req);
}

// Update a service worker
self.addEventListener("activate", (event) => {
    var cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                }),
            );
        }),
    );
});
