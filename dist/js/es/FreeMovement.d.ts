import { Renderer } from "./Renderer";
import { FpsCameraOptions } from "./FpsCamera";
export declare class FreeMovement {
    private renderer;
    private options;
    private mode;
    private matCamera;
    private matInvCamera;
    private vec3Eye;
    private vec3Rotation;
    private fpsCamera;
    constructor(renderer: Renderer, options: FpsCameraOptions);
    private setupControls;
}
