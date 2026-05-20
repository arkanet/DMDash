self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";
  const target = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        const sameOriginClient = clients.find((client) => {
          return new URL(client.url).origin === self.location.origin;
        });

        if (sameOriginClient) {
          return sameOriginClient.focus().then((client) => {
            if ("navigate" in client && client.url !== target) {
              return client.navigate(target);
            }

            return client;
          });
        }

        return self.clients.openWindow(target);
      }),
  );
});
