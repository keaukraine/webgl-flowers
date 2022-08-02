import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";
export declare class InstancedTexturePositionsColoredShader extends InstancedTexturePositionsShader {
    color: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
