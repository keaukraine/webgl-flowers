"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntsShader = void 0;
const DiffuseColoredShader_1 = require("./DiffuseColoredShader");
const ShaderCommonFunctions_1 = require("./ShaderCommonFunctions");
class AntsShader extends DiffuseColoredShader_1.DiffuseColoredShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uRadius; // x: base radius, y: additional random radius
            uniform vec2 uSpread; // x: X spread; y: Y spread.
            uniform float uTime;
            uniform float uRotation;

            out vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions_1.ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions_1.ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;
            const float PI = 3.14159265359;
            const float HALF_PI = 1.57079632679;

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID) + uRotation;

                vec2 translation = vec2(
                    uSpread.x * (random(fInstance * 0.0196) - 0.5),
                    uSpread.y * (random(fInstance * 0.0177) - 0.5)
                );

                float angle = uTime + fInstance;
                float s = sin(angle);
                float c = cos(angle);
                float radius = uRadius.x + uRadius.y * random(fInstance);

                mat4 rotationMatrix = rotationAroundZ(-angle + uRotation);

                vertex *= rotationMatrix;
                vertex.x += s * radius;
                vertex.y += c * radius;
                vertex.xy += translation;

                gl_Position = view_proj_matrix * vertex;

                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            uniform vec4 color;

            in vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord) * color;
                if (fragColor.a < 0.2) discard;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uSpread = this.getUniform("uSpread");
        this.uTime = this.getUniform("uTime");
        this.uRadius = this.getUniform("uRadius");
        this.uRotation = this.getUniform("uRotation");
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
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
exports.AntsShader = AntsShader;
//# sourceMappingURL=AntsShader.js.map