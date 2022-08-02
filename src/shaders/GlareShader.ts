import { BaseShader, DiffuseShader, FullModel } from "webgl-framework";
import { DrawableShader } from "webgl-framework/dist/types/DrawableShader";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";

export class GlareShader extends BaseShader implements DrawableShader {
    // Uniforms are of type `WebGLUniformLocation`
    view_proj_matrix: WebGLUniformLocation | undefined;
    lightDir: WebGLUniformLocation | undefined;
    glareExponent: WebGLUniformLocation | undefined;
    glareColor: WebGLUniformLocation | undefined;

    // Attributes are numbers.
    rm_Vertex: number | undefined;
    rm_Normal: number | undefined;

    fillCode() {
        this.vertexShaderCode = `precision mediump float;
        uniform mat4 view_proj_matrix;
        uniform vec4 lightDir;
        uniform float glareExponent;
        attribute vec4 rm_Vertex;
        attribute vec4 rm_Normal;
        varying vec3 vNormal;
        varying float vGlare;
        
        void main() {
            gl_Position = view_proj_matrix * rm_Vertex;
            vGlare = clamp(dot(rm_Normal, lightDir), 0.0, 1.0);
        }`;

        this.fragmentShaderCode = `precision mediump float;
        varying vec3 vNormal;
        varying float vGlare;
        uniform float glareExponent;
        uniform vec4 glareColor;

        void main() {
            float glare = pow(vGlare, glareExponent);
            gl_FragColor = glareColor * glare;
        }`;
    }

    fillUniformsAttributes() {
        this.rm_Vertex = this.getAttrib("rm_Vertex");
        this.rm_Normal = this.getAttrib("rm_Normal");

        this.view_proj_matrix = this.getUniform("view_proj_matrix");
        this.lightDir = this.getUniform("lightDir");
        this.glareExponent = this.getUniform("glareExponent");
        this.glareColor = this.getUniform("glareColor");
    }

    drawModel(renderer: RendererWithExposedMethods, model: FullModel, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void {
        if (this.rm_Vertex === undefined || this.rm_Normal === undefined || this.view_proj_matrix === undefined) {
            return;
        }

        const gl = renderer.gl;

        model.bindBuffers(gl);

        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);

        renderer.checkGlError("GlareShader glDrawElements");
    }
}
