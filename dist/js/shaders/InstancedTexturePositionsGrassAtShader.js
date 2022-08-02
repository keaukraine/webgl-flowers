"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstancedTexturePositionsGrassAtShader = void 0;
const InstancedTexturePositionsGrassShader_1 = require("./InstancedTexturePositionsGrassShader");
class InstancedTexturePositionsGrassAtShader extends InstancedTexturePositionsGrassShader_1.InstancedTexturePositionsGrassShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            in mediump vec4 vDiffuseColor;
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
exports.InstancedTexturePositionsGrassAtShader = InstancedTexturePositionsGrassAtShader;
//# sourceMappingURL=InstancedTexturePositionsGrassAtShader.js.map