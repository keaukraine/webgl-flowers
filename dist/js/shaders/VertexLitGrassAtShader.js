"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexLitGrassAtShader = void 0;
const VertexLitGrassShader_1 = require("./VertexLitGrassShader");
class VertexLitGrassAtShader extends VertexLitGrassShader_1.VertexLitGrassShader {
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
exports.VertexLitGrassAtShader = VertexLitGrassAtShader;
//# sourceMappingURL=VertexLitGrassAtShader.js.map