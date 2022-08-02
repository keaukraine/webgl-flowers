"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstancedVegetationShader = void 0;
const webgl_framework_1 = require("webgl-framework");
const ShaderCommonFunctions_1 = require("./ShaderCommonFunctions");
class InstancedVegetationShader extends webgl_framework_1.DiffuseShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform mat4 view_proj_matrix;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.0; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions_1.ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions_1.ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions_1.ShaderCommonFunctions.ROTATION}
                       
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
           
                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            out vec4 fragColor;
            
            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.spread = this.getUniform("spread");
        this.cullDistances = this.getUniform("cullDistances");
        this.uScale = this.getUniform("uScale");
        this.uDistributionRange = this.getUniform("uDistributionRange");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
exports.InstancedVegetationShader = InstancedVegetationShader;
InstancedVegetationShader.DISTRIBUTION_CULLING = `
        float distributionNoise = noise(translation * uDistributionRange.z /*.027*/); // [-1...1] range
        if (distributionNoise < uDistributionRange.x || distributionNoise > uDistributionRange.y) {
            vertex = EMTPY_COORDINATE;
        }
    `;
//# sourceMappingURL=InstancedVegetationShader.js.map