/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
            self.registration
                .unregister()
                .then(() => {
                    return self.clients.matchAll();
                })
                .then(clients => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        } else if (ev.data.type === "coepCredentialless") {
            coepCredentialless = ev.data.value;
        }
    });

    self.addEventListener("fetch", function (event) {
        const r = event.request;
        if (r.cache === "only-if-cached" && r.mode !== "same-origin") {
            return;
        }

        const request = (coepCredentialless && r.mode === "no-cors") ?
            new Request(r, {
                credentials: "omit"
            }) :
            r;
        event.respondWith(
            fetch(request)
            .then((response) => {
                const newResponse = new Response(response.body, response);
                newResponse.headers.set("Cross-Origin-Embedder-Policy",
                    coepCredentialless ? "credentialless" : "require-corp"
                );
                newResponse.headers.set("Cross-Origin-Opener-Policy", "same-origin");
                return newResponse;
            })
            .catch((e) => console.error(e))
        );
    });
} else {
    (() => {
        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");
        const coepDegrading = (reloadedBySelf == "coepdegrade");
        if (reloadedBySelf) {
            const coepCredentialless = (reloadedBySelf == "coepcredentialless");
            window.coiServiceWorkerDeregister = () => {
                if (navigator.serviceWorker) {
                    navigator.serviceWorker.controller.postMessage({
                        type: "deregister"
                    });
                }
            };
            window.coiServiceWorkerDeregister();
            return;
        }
        if (!window.crossOriginIsolated && !coepDegrading) {
            let coepCredentialless = false;
            navigator.serviceWorker.register(window.document.currentScript.src)
                .then((registration) => {
                    return new Promise((resolve, reject) => {
                        const channel = new MessageChannel();
                        channel.port1.onmessage = (ev) => {
                            if (ev.data && ev.data.type === "coepCredentialless") {
                                coepCredentialless = ev.data.value;
                            }
                            resolve(registration);
                        };
                        navigator.serviceWorker.controller.postMessage({
                            type: "coepCredentialless",
                            value: coepCredentialless
                        }, [channel.port2]);
                    });
                })
                .then((registration) => {
                    return Promise.all([
                        registration.update(),
                        new Promise((resolve) => {
                            if (navigator.serviceWorker.controller) {
                                resolve();
                            } else {
                                navigator.serviceWorker.addEventListener("controllerchange", () => {
                                    resolve();
                                }, { once: true });
                            }
                        })
                    ]);
                })
                .then(() => {
                    const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
                    window.sessionStorage.setItem("coiReloadedBySelf",
                        coepCredentialless ? "coepcredentialless" : "coepdegrade"
                    );
                    window.location.reload();
                })
                .catch((e) => console.error("COOP/COEP Service Worker failed to install:", e));
        }
    })();
}
