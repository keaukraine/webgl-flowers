import { DiffuseShader, FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
export declare class InstancedTexturePositionsShader extends DiffuseShader {
    uScale: WebGLUniformLocation | undefined;
    sPositions: WebGLUniformLocation | undefined;
    uPositionOffset: WebGLUniformLocation | undefined;
    static readonly COMMON_TRANSFORMS = "\n    vec4 vertex = rm_Vertex;\n    float fInstance = float(gl_InstanceID);\n    int x = uPositionOffset + gl_InstanceID;\n    vec4 translationAndScale = texelFetch(sPositions, ivec2(x, 0), 0); // xy=translation, z=scale\n    vec4 rotations = texelFetch(sPositions, ivec2(x, 1), 0); // x=sin a; y=cos a\n    vec2 translation = translationAndScale.xy;\n    float scale = uScale.x + translationAndScale.z * uScale.y;\n    float s = rotations.x;\n    float c = rotations.y;\n    mat4 rotationMatrix = mat4(\n        c,  -s,   0.0, 0.0,\n        s,   c,   0.0, 0.0,\n        0.0, 0.0, 1.0, 0.0,\n        0.0, 0.0, 0.0, 1.0\n    );\n\n    vertex *= rotationMatrix;\n    vertex *= vec4(scale, scale, scale, 1.0);\n    vertex.xy += translation;\n    ";
    fillCode(): void;
    fillUniformsAttributes(): void;
    /** @inheritdoc */
    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
    drawInstanced(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, offset: number, instances: number): void;
}
