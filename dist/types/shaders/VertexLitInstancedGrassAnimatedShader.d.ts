import { VertexLitInstancedGrassShader } from "./VertexLitInstancedGrassShader";
export declare class VertexLitInstancedGrassAnimatedShader extends VertexLitInstancedGrassShader {
    uTime: WebGLUniformLocation | undefined;
    viewPos: WebGLUniformLocation | undefined;
    stiffness: WebGLUniformLocation | undefined;
    heightCoeff: WebGLUniformLocation | undefined;
    windOffset: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
