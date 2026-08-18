(function () {
    if (window.__dmdashGuideDownloadHandler) {
        return;
    }

    window.__dmdashGuideDownloadHandler = true;

    var installHref = "/install/ios";
    var ipaHrefPattern = /\/downloads\/darkmesh\.ipa(?:[?#].*)?$/i;

    var isNativeAppShell = function () {
        var capacitor = window.Capacitor;
        if (typeof (capacitor === null || capacitor === void 0 ? void 0 : capacitor.isNativePlatform) === "function") {
            return capacitor.isNativePlatform();
        }
        if (typeof (capacitor === null || capacitor === void 0 ? void 0 : capacitor.getPlatform) === "function") {
            var platform = capacitor.getPlatform();
            return platform === "ios" || platform === "android";
        }
        return false;
    };

    var updateInstallLinks = function () {
        document.querySelectorAll("a").forEach(function (anchor) {
            var isInstallLink = anchor.getAttribute("href") === installHref || anchor.href.endsWith(installHref);
            var isIpaLink = ipaHrefPattern.test(anchor.href);
            if (!isInstallLink && !isIpaLink) {
                return;
            }

            if (isNativeAppShell()) {
                anchor.remove();
                return;
            }

            anchor.href = installHref;
            anchor.removeAttribute("download");
            anchor.removeAttribute("data-dmdash-download");
            anchor.setAttribute("target", "_top");
        });
    };

    updateInstallLinks();
    document.addEventListener("DOMContentLoaded", updateInstallLinks);
})();
