"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstancedVegetationAtShader = void 0;
const InstancedVegetationShader_1 = require("./InstancedVegetationShader");
class InstancedVegetationAtShader extends InstancedVegetationShader_1.InstancedVegetationShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            out vec4 fragColor;
            
            void main(void)
            {
                vec4 base = texture(sTexture, vTexCoord);
                if (base.a < 0.9) {
                    discard;
                } else {
                    fragColor = base;
                }
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
    }
}
exports.InstancedVegetationAtShader = InstancedVegetationAtShader;
//# sourceMappingURL=InstancedVegetationAtShader.js.map