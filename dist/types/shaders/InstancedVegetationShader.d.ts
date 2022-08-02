import { DiffuseShader, FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
export declare class InstancedVegetationShader extends DiffuseShader {
    spread: WebGLUniformLocation | undefined;
    cullDistances: WebGLUniformLocation | undefined;
    uScale: WebGLUniformLocation | undefined;
    /**
     * Specifies vegetation distribution area.
     * Distribution noise is in range [-1, 1], so min and max values must be within this range.
     *
     * x: Min distribution range.
     * y: Max distribution range.
     * z: Distribution scale - scale for random distribution noise.
     */
    uDistributionRange: WebGLUniformLocation | undefined;
    protected static DISTRIBUTION_CULLING: string;
    fillCode(): void;
    fillUniformsAttributes(): void;
    /** @inheritdoc */
    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
    drawInstanced(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, instances: number): void;
}
