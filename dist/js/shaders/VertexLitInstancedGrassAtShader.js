"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexLitInstancedGrassAtShader = void 0;
const VertexLitInstancedGrassShader_1 = require("./VertexLitInstancedGrassShader");
class VertexLitInstancedGrassAtShader extends VertexLitInstancedGrassShader_1.VertexLitInstancedGrassShader {
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
exports.VertexLitInstancedGrassAtShader = VertexLitInstancedGrassAtShader;
//# sourceMappingURL=VertexLitInstancedGrassAtShader.js.map