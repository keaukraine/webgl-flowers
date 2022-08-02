import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";

export class InstancedTexturePositionsColoredShader extends InstancedTexturePositionsShader {
    // Uniforms are of type `WebGLUniformLocation`
    color: WebGLUniformLocation | undefined;

    fillCode() {
        super.fillCode();

        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            uniform vec4 color;

            in mediump vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord) * color;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.color = this.getUniform("color");
    }
}
