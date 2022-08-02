"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffuseAnimatedTextureShader = void 0;
const webgl_framework_1 = require("webgl-framework");
class DiffuseAnimatedTextureShader extends webgl_framework_1.DiffuseShader {
    // Attributes are numbers.
    // rm_Vertex: number | undefined;
    fillCode() {
        this.vertexShaderCode = "#version 300 es\n" +
            "precision highp float;\n" +
            "uniform sampler2D sPositions;\n" +
            "uniform vec3 uTexelSizes; // x = vertex count; y = texel half width; z = sampler y coord (animation frame)\n" +
            "uniform mat4 view_proj_matrix;\n" +
            "in vec2 rm_TexCoord0;\n" +
            "out vec2 vTextureCoord;\n" +
            "\n" +
            "void main() {\n" +
            "  float id = float(gl_VertexID);" +
            "  vec4 position = texture(sPositions, vec2(id / uTexelSizes.x + uTexelSizes.y, uTexelSizes.z));" +
            "  gl_Position = view_proj_matrix * position;\n" +
            "  vTextureCoord = rm_TexCoord0;\n" +
            "}";
        this.fragmentShaderCode = "#version 300 es\n" +
            "precision mediump float;\n" +
            "in vec2 vTextureCoord;\n" +
            "uniform sampler2D sTexture;\n" +
            "out vec4 fragColor;\n" +
            "\n" +
            "void main() {\n" +
            "  fragColor = texture(sTexture, vTextureCoord);\n" +
            "}";
    }
    fillUniformsAttributes() {
        // super.fillUniformsAttributes();
        this.view_proj_matrix = this.getUniform('view_proj_matrix');
        // this.rm_Vertex = this.getAttrib('rm_Vertex');
        this.rm_TexCoord0 = this.getAttrib('rm_TexCoord0');
        this.sTexture = this.getUniform('sTexture');
        this.sPositions = this.getUniform("sPositions");
        this.uTexelSizes = this.getUniform("uTexelSizes");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_TexCoord0 === undefined || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        // gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        // gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 4, 0);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}
exports.DiffuseAnimatedTextureShader = DiffuseAnimatedTextureShader;
//# sourceMappingURL=DiffuseAnimatedTextureShader.js.map