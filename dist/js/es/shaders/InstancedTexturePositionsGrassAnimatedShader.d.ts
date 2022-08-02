import { InstancedTexturePositionsGrassShader } from "./InstancedTexturePositionsGrassShader";
export declare class InstancedTexturePositionsGrassAnimatedShader extends InstancedTexturePositionsGrassShader {
    uTime: WebGLUniformLocation | undefined;
    stiffness: WebGLUniformLocation | undefined;
    heightCoeff: WebGLUniformLocation | undefined;
    windOffset: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
