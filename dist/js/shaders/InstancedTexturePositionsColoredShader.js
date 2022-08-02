"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstancedTexturePositionsColoredShader = void 0;
const InstancedTexturePositionsShader_1 = require("./InstancedTexturePositionsShader");
class InstancedTexturePositionsColoredShader extends InstancedTexturePositionsShader_1.InstancedTexturePositionsShader {
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
exports.InstancedTexturePositionsColoredShader = InstancedTexturePositionsColoredShader;
//# sourceMappingURL=InstancedTexturePositionsColoredShader.js.map