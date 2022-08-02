import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { mat4, vec4 } from "gl-matrix";

export interface BoundingBox {
    min: { x: number, y: number, z: number },
    max: { x: number, y: number, z: number }
}

/**
 * This class is used to test model visibility by testing model's bounding box against renderer's matrices.
 */
export class BoundingBoxVisibility {
    private renderer: RendererWithExposedMethods;
    private pointsBB: vec4[] = [vec4.create(), vec4.create(), vec4.create(), vec4.create(), vec4.create(), vec4.create(), vec4.create(), vec4.create()];
    private mMVPMatrix = mat4.create();
    private modelMatrix = mat4.create();

    /**
     * Default constructor.
     *
     * @param renderer Renderer instance.
     */
    public constructor(renderer: RendererWithExposedMethods) {
        this.renderer = renderer;

        mat4.identity(this.modelMatrix);
        mat4.rotate(this.modelMatrix, this.modelMatrix, 0, [1, 0, 0]);
        mat4.translate(this.modelMatrix, this.modelMatrix, [0, 0, 0]);
    }

    /**
     * Tests if model is culled by view and projection matrices from renderer.
     *
     * @param model Model to test.
     * @return `true` if model is culled, `false` otherwise. Also returns `false` if model has no bounding box.
     */
    public isModelCulled(boundingBox: BoundingBox): boolean {
        let result: boolean;

        this.pointsBB[0][0] = boundingBox.min.x;
        this.pointsBB[0][1] = boundingBox.min.y;
        this.pointsBB[0][2] = boundingBox.min.z;
        this.pointsBB[0][3] = 1.0;

        this.pointsBB[1][0] = boundingBox.min.x;
        this.pointsBB[1][1] = boundingBox.max.y;
        this.pointsBB[1][2] = boundingBox.min.z;
        this.pointsBB[1][3] = 1.0;

        this.pointsBB[2][0] = boundingBox.min.x;
        this.pointsBB[2][1] = boundingBox.max.y;
        this.pointsBB[2][2] = boundingBox.max.z;
        this.pointsBB[2][3] = 1.0;

        this.pointsBB[3][0] = boundingBox.min.x;
        this.pointsBB[3][1] = boundingBox.min.y;
        this.pointsBB[3][2] = boundingBox.max.z;
        this.pointsBB[3][3] = 1.0;

        this.pointsBB[4][0] = boundingBox.max.x;
        this.pointsBB[4][1] = boundingBox.min.y;
        this.pointsBB[4][2] = boundingBox.min.z;
        this.pointsBB[4][3] = 1.0;

        this.pointsBB[5][0] = boundingBox.max.x;
        this.pointsBB[5][1] = boundingBox.max.y;
        this.pointsBB[5][2] = boundingBox.min.z;
        this.pointsBB[5][3] = 1.0;

        this.pointsBB[6][0] = boundingBox.max.x;
        this.pointsBB[6][1] = boundingBox.max.y;
        this.pointsBB[6][2] = boundingBox.max.z;
        this.pointsBB[6][3] = 1.0;

        this.pointsBB[7][0] = boundingBox.max.x;
        this.pointsBB[7][1] = boundingBox.min.y;
        this.pointsBB[7][2] = boundingBox.max.z;
        this.pointsBB[7][3] = 1.0;

        this.prepareCullingMatrix();

        for (let i = 0; i < 8; i++) {
            vec4.transformMat4(this.pointsBB[i], this.pointsBB[i], this.mMVPMatrix);
        }

        result = true;
        for (let i = 0; i < 8; i++) {
            result = 0 > this.pointsBB[i][2];
            if (!result) { // at least 1 point is not clipped by near plane
                break;
            }
        }
        if (result) {
            return result;
        }

        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][0] < -this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped ny left plane
                break;
            }
        }
        if (result) {
            return result;
        }

        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][0] > this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by right plane
                break;
            }
        }
        if (result) {
            return result;
        }

        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][1] < -this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by top plane
                break;
            }
        }
        if (result) {
            return result;
        }

        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][1] > this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by bottom plane
                break;
            }
        }

        return result;
    }

    private prepareCullingMatrix(): void {
        mat4.multiply(this.mMVPMatrix, this.renderer.getViewMatrix(), this.modelMatrix);
        mat4.multiply(this.mMVPMatrix, (this.renderer as any).mProjMatrix, this.mMVPMatrix); // FIXME
    }
}
