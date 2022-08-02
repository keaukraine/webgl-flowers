import { DiffuseAnimatedTextureShader } from "./DiffuseAnimatedTextureShader";
export declare class DiffuseAnimatedTextureChunkedShader extends DiffuseAnimatedTextureShader {
    uTexelHeight: WebGLUniformLocation | undefined;
    uTextureWidthInt: WebGLUniformLocation | undefined;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
