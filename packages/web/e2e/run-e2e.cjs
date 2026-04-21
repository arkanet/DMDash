const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // navigate to app origin first, write IndexedDB entries in that origin, then reload
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    return (async () => {
      const dbName = "keyval-store";
      const storeName = "keyval";
      function open() {
        return new Promise((res, rej) => {
          const r = indexedDB.open(dbName);
          r.onupgradeneeded = () => r.result.createObjectStore(storeName);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      const db = await open();
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.put({ num: 42, name: "e2e-node" }, "nodeinfo:1:42");
      store.put([42], "nodeinfo:index:1");
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    })();
  });

  // reload so app picks up persisted entries on startup
  await page.reload({ waitUntil: "networkidle" });

  const ok = await page
    .waitForFunction(
      () => {
        const r = document.getElementById("root");
        return !!(r && r.childElementCount > 0);
      },
      { timeout: 10000 },
    )
    .then(() => true)
    .catch(() => false);

  if (!ok) {
    console.error("App did not hydrate root in time");
    await browser.close();
    process.exit(2);
  }

  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.waitForTimeout(1000);

  if (errors.length > 0) {
    console.error("Runtime errors on page:", errors);
    await browser.close();
    process.exit(3);
  }

  console.log("E2E smoke passed");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
