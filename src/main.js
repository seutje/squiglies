import { App } from "./core/App.js";

const container = document.getElementById("visualizer-container");
const controlsRoot = document.getElementById("controls");

const app = new App({
  visualizerContainer: container,
  controlsRoot
});

app
  .init()
  .then(() => app.start())
  .catch((error) => {
    console.error("Failed to initialize app", error);
    const message = document.createElement("p");
    message.textContent = "Failed to initialize visualizer.";
    controlsRoot?.appendChild(message);
  });
