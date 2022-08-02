import { FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { VertexLitInstancedVegetationShader } from "./VertexLitInstancedVegetationShader";
export declare class VertexLitInstancedVegetationFadingShader extends VertexLitInstancedVegetationShader {
    minInstanceScale: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
    /** @inheritdoc */
    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
    drawInstanced(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, instances: number): void;
}
