"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const webgl_framework_1 = require("webgl-framework");
const Renderer_1 = require("./Renderer");
const FreeMovement_1 = require("./FreeMovement");
const dat_gui_1 = require("dat.gui");
function ready(fn) {
    if (document.readyState !== "loading") {
        fn();
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}
let renderer;
ready(() => {
    renderer = new Renderer_1.Renderer();
    renderer.ready = () => {
        initUI();
    };
    renderer.init("canvasGL", true);
    const canvas = document.getElementById("canvasGL");
    new FreeMovement_1.FreeMovement(renderer, {
        canvas,
        movementSpeed: 35,
        rotationSpeed: 0.006
    });
    const fullScreenUtils = new webgl_framework_1.FullScreenUtils();
    const toggleFullscreenElement = document.getElementById("toggleFullscreen");
    toggleFullscreenElement.addEventListener("click", () => {
        if (document.body.classList.contains("fs")) {
            fullScreenUtils.exitFullScreen();
        }
        else {
            fullScreenUtils.enterFullScreen();
        }
        fullScreenUtils.addFullScreenListener(function () {
            if (fullScreenUtils.isFullScreen()) {
                document.body.classList.add("fs");
            }
            else {
                document.body.classList.remove("fs");
            }
        });
    });
});
function initUI() {
    var _a, _b;
    (_a = document.getElementById("message")) === null || _a === void 0 ? void 0 : _a.classList.add("hidden");
    (_b = document.getElementById("canvasGL")) === null || _b === void 0 ? void 0 : _b.classList.remove("transparent");
    setTimeout(() => { var _a; return (_a = document.querySelector(".promo")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 4000);
    setTimeout(() => { var _a; return (_a = document.querySelector("#toggleFullscreen")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 1800);
    const gui = new dat_gui_1.GUI();
    const config = {
        density: 100,
        timeOfDay: "Day",
        glare: true,
        insects: true
    };
    gui.add(config, "density", 0, 100)
        .name("Grass Density")
        .onChange(() => renderer.density = config.density / 100);
    gui.add(config, "timeOfDay", ["Day", "Night", "Sunrise", "Sunset"])
        .name("Time Of Day")
        .onChange(() => renderer.timeOfDay = config.timeOfDay);
    gui.add(config, "glare", true)
        .name("Sun Glare")
        .onChange(() => renderer.glare = config.glare);
    gui.add(config, "insects", true)
        .name("Ants & Butterflies")
        .onChange(() => renderer.insects = config.insects);
    gui.add({ iterateCamera: () => renderer.iterateCamera() }, "iterateCamera")
        .name("Next Camera");
    const stats = gui.addFolder("Stats");
    stats.add(renderer, "tiles", "")
        .name("Tiles visible")
        .listen();
    stats.add(renderer, "grassInstances", "")
        .name("Instances visible")
        .listen();
}
//# sourceMappingURL=index.js.map