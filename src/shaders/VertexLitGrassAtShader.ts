import { VertexLitGrassShader } from "./VertexLitGrassShader";

export class VertexLitGrassAtShader extends VertexLitGrassShader {
    fillCode() {
        super.fillCode();

        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            in vec4 vDiffuseColor;
            out vec4 fragColor;
            
            void main(void)
            {
                vec4 base = texture(sTexture, vTexCoord);
                if (base.a < 0.9) {
                    discard;
                } else {
                    fragColor = vDiffuseColor * base;
                }
            }`;
    }
}
