"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundingBoxVisibility = void 0;
const gl_matrix_1 = require("gl-matrix");
/**
 * This class is used to test model visibility by testing model's bounding box against renderer's matrices.
 */
class BoundingBoxVisibility {
    /**
     * Default constructor.
     *
     * @param renderer Renderer instance.
     */
    constructor(renderer) {
        this.pointsBB = [gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create(), gl_matrix_1.vec4.create()];
        this.mMVPMatrix = gl_matrix_1.mat4.create();
        this.modelMatrix = gl_matrix_1.mat4.create();
        this.renderer = renderer;
        gl_matrix_1.mat4.identity(this.modelMatrix);
        gl_matrix_1.mat4.rotate(this.modelMatrix, this.modelMatrix, 0, [1, 0, 0]);
        gl_matrix_1.mat4.translate(this.modelMatrix, this.modelMatrix, [0, 0, 0]);
    }
    /**
     * Tests if model is culled by view and projection matrices from renderer.
     *
     * @param model Model to test.
     * @return `true` if model is culled, `false` otherwise. Also returns `false` if model has no bounding box.
     */
    isModelCulled(boundingBox) {
        let result;
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
            gl_matrix_1.vec4.transformMat4(this.pointsBB[i], this.pointsBB[i], this.mMVPMatrix);
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
    prepareCullingMatrix() {
        gl_matrix_1.mat4.multiply(this.mMVPMatrix, this.renderer.getViewMatrix(), this.modelMatrix);
        gl_matrix_1.mat4.multiply(this.mMVPMatrix, this.renderer.mProjMatrix, this.mMVPMatrix); // FIXME
    }
}
exports.BoundingBoxVisibility = BoundingBoxVisibility;
//# sourceMappingURL=BoundingBoxVisibility.js.map