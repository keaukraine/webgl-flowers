import { DiffuseShader, FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
export declare class ButterflyShader extends DiffuseShader {
    uSpread: WebGLUniformLocation | undefined;
    uRadius: WebGLUniformLocation | undefined;
    uTime: WebGLUniformLocation | undefined;
    uRotation: WebGLUniformLocation | undefined;
    uAnimationTime: WebGLUniformLocation | undefined;
    uButterflyParams: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
    /** @inheritdoc */
    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
    drawInstanced(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, instances: number): void;
}
