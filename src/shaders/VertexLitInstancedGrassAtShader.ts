import { VertexLitInstancedGrassShader } from "./VertexLitInstancedGrassShader";

export class VertexLitInstancedGrassAtShader extends VertexLitInstancedGrassShader {
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

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.viewPos = this.getUniform("viewPos");
    }
}
