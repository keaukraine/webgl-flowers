import { FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { DiffuseColoredShader } from "./DiffuseColoredShader";
export declare class DiffuseColoredVertexAlphaShader extends DiffuseColoredShader {
    rm_AO: number | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
}
