"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexLitGrassShader = void 0;
const webgl_framework_1 = require("webgl-framework");
class VertexLitGrassShader extends webgl_framework_1.DiffuseShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform vec4 lightDir;
            uniform vec3 viewPos;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;
            uniform vec3 uDistributionRange;

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0);
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float ZERO = 0.0;
                vec3 vNormal2 = normalize(normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration

                vec3 viewDir = normalize(viewPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            in vec4 vDiffuseColor;
            out vec4 fragColor;
            
            void main(void)
            {
                fragColor = vDiffuseColor * texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.viewPos = this.getUniform("viewPos");
        this.uSpecularColor = this.getUniform("uSpecularColor");
        this.uSpecularPower = this.getUniform("uSpecularPower");
        this.uSpecularStrength = this.getUniform("uSpecularStrength");
        this.view_matrix = this.getUniform("view_matrix");
        this.model_matrix = this.getUniform("model_matrix");
        this.rm_Normal = this.getAttrib("rm_Normal");
        this.ambient = this.getUniform("ambient");
        this.diffuse = this.getUniform("diffuse");
        this.lightDir = this.getUniform("lightDir");
        this.diffuseCoef = this.getUniform("diffuseCoef");
        this.diffuseExponent = this.getUniform("diffuseExponent");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
}
exports.VertexLitGrassShader = VertexLitGrassShader;
//# sourceMappingURL=VertexLitGrassShader.js.map