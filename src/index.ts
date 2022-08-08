import { FullScreenUtils } from "webgl-framework";
import { Renderer } from "./Renderer";
import { FreeMovement } from "./FreeMovement";
import { GUI } from 'dat.gui'

function ready(fn: () => void) {
    if (document.readyState !== "loading") {
        fn();
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}


let renderer: Renderer;

ready(() => {
    renderer = new Renderer();
    renderer.ready = () => {
        initUI();
    };
    renderer.init("canvasGL", true);
    const canvas = document.getElementById("canvasGL")!;
    new FreeMovement(
        renderer,
        {
            canvas,
            movementSpeed: 35,
            rotationSpeed: 0.006
        }
    );

    const fullScreenUtils = new FullScreenUtils();

    const toggleFullscreenElement = document.getElementById("toggleFullscreen")!;
    toggleFullscreenElement.addEventListener("click", () => {
        if (document.body.classList.contains("fs")) {
            fullScreenUtils.exitFullScreen();
        } else {
            fullScreenUtils.enterFullScreen();
        }
        fullScreenUtils.addFullScreenListener(function () {
            if (fullScreenUtils.isFullScreen()) {
                document.body.classList.add("fs");
            } else {
                document.body.classList.remove("fs");
            }
        });
    });
});

function initUI(): void {
    document.getElementById("message")?.classList.add("hidden");
    document.getElementById("canvasGL")?.classList.remove("transparent");
    setTimeout(() => document.querySelector(".promo")?.classList.remove("transparent"), 4000);
    setTimeout(() => document.querySelector("#toggleFullscreen")?.classList.remove("transparent"), 1800);

    const gui = new GUI();

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
