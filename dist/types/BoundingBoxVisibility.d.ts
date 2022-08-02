import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
export interface BoundingBox {
    min: {
        x: number;
        y: number;
        z: number;
    };
    max: {
        x: number;
        y: number;
        z: number;
    };
}
/**
 * This class is used to test model visibility by testing model's bounding box against renderer's matrices.
 */
export declare class BoundingBoxVisibility {
    private renderer;
    private pointsBB;
    private mMVPMatrix;
    private modelMatrix;
    /**
     * Default constructor.
     *
     * @param renderer Renderer instance.
     */
    constructor(renderer: RendererWithExposedMethods);
    /**
     * Tests if model is culled by view and projection matrices from renderer.
     *
     * @param model Model to test.
     * @return `true` if model is culled, `false` otherwise. Also returns `false` if model has no bounding box.
     */
    isModelCulled(boundingBox: BoundingBox): boolean;
    private prepareCullingMatrix;
}
