const RAPIER_CDN_URL = "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/rapier.es.js";

let rapierPromise = null;

function ensureBrowserEnvironment() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export async function loadRapier() {
  if (!rapierPromise) {
    rapierPromise = (async () => {
      if (!ensureBrowserEnvironment()) {
        throw new Error(
          "Rapier can only be loaded in a browser environment. Mock PhysicsWorld in tests or non-browser contexts."
        );
      }

      const rapierModule = await import(RAPIER_CDN_URL);
      const rapier = rapierModule?.default ?? rapierModule;
      if (!rapier) {
        throw new Error("Failed to load Rapier physics module from CDN.");
      }
      if (typeof rapier.init === "function") {
        await rapier.init();
      }
      return rapier;
    })();
  }
  return rapierPromise;
}

export { RAPIER_CDN_URL };
