"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffuseColoredVertexAlphaShader = void 0;
const DiffuseColoredShader_1 = require("./DiffuseColoredShader");
class DiffuseColoredVertexAlphaShader extends DiffuseColoredShader_1.DiffuseColoredShader {
    fillCode() {
        this.vertexShaderCode = `uniform mat4 view_proj_matrix;
            attribute vec4 rm_Vertex;
            attribute vec2 rm_TexCoord0;
            attribute float rm_AO;
            varying vec2 vTextureCoord;
            varying float vAlpha;
            
            void main() {
              gl_Position = view_proj_matrix * rm_Vertex;
              vTextureCoord = rm_TexCoord0;
              vAlpha = rm_AO;
            }`;
        this.fragmentShaderCode = `precision mediump float;
            varying vec2 vTextureCoord;
            varying float vAlpha;
            uniform sampler2D sTexture;
            uniform vec4 color;
            
            void main() {
              gl_FragColor = texture2D(sTexture, vTextureCoord) * color;
              gl_FragColor.a = vAlpha;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.rm_AO = this.getAttrib("rm_AO");
    }
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_AO === undefined
            || this.view_proj_matrix === undefined
            || this.color === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_AO);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 1), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 1), 4 * 3);
        gl.vertexAttribPointer(this.rm_AO, 1, gl.FLOAT, false, 4 * (3 + 2 + 1), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}
exports.DiffuseColoredVertexAlphaShader = DiffuseColoredVertexAlphaShader;
//# sourceMappingURL=DiffuseColoredVertexAlphaShader.js.map