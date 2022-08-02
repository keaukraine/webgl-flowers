import { VertexLitInstancedVegetationShader } from "./VertexLitInstancedVegetationShader";
export declare class VertexLitInstancedGrassShader extends VertexLitInstancedVegetationShader {
    viewPos: WebGLUniformLocation | undefined;
    stiffness: WebGLUniformLocation | undefined;
    windOffset: WebGLUniformLocation | undefined;
    uSpecularPower: WebGLUniformLocation | undefined;
    uSpecularColor: WebGLUniformLocation | undefined;
    uSpecularStrength: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
