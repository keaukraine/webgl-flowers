import { VertexLitInstancedTexturePositionsShader } from "./VertexLitInstancedTexturePositionsShader";
export declare class InstancedTexturePositionsGrassShader extends VertexLitInstancedTexturePositionsShader {
    viewPos: WebGLUniformLocation | undefined;
    uSpecularPower: WebGLUniformLocation | undefined;
    uSpecularColor: WebGLUniformLocation | undefined;
    uSpecularStrength: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
