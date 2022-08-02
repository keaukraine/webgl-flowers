import { InstancedTexturePositionsGrassShader } from "./InstancedTexturePositionsGrassShader";
import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";

export class InstancedTexturePositionsGrassAtShader extends InstancedTexturePositionsGrassShader {
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
