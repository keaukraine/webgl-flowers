import { DiffuseShader, FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { DiffuseColoredShader } from "./DiffuseColoredShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";

export class InstancedTexturePositionsShader extends DiffuseShader {
    // Uniforms are of type `WebGLUniformLocation`
    uScale: WebGLUniformLocation | undefined;
    sPositions: WebGLUniformLocation | undefined;
    uPositionOffset: WebGLUniformLocation | undefined;

    static readonly COMMON_TRANSFORMS = `
    vec4 vertex = rm_Vertex;
    float fInstance = float(gl_InstanceID);
    int x = uPositionOffset + gl_InstanceID;
    vec4 translationAndScale = texelFetch(sPositions, ivec2(x, 0), 0); // xy=translation, z=scale
    vec4 rotations = texelFetch(sPositions, ivec2(x, 1), 0); // x=sin a; y=cos a
    vec2 translation = translationAndScale.xy;
    float scale = uScale.x + translationAndScale.z * uScale.y;
    float s = rotations.x;
    float c = rotations.y;
    mat4 rotationMatrix = mat4(
        c,  -s,   0.0, 0.0,
        s,   c,   0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    );

    vertex *= rotationMatrix;
    vertex *= vec4(scale, scale, scale, 1.0);
    vertex.xy += translation;
    `;

    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            out mediump vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;

        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.uScale = this.getUniform("uScale");
        this.sPositions = this.getUniform("sPositions");
        this.uPositionOffset = this.getUniform("uPositionOffset");
    }

    /** @inheritdoc */
    drawModel(
        renderer: RendererWithExposedMethods,
        model: FullModel,
        tx: number, ty: number, tz: number,
        rx: number, ry: number, rz: number,
        sx: number, sy: number, sz: number
    ): void {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined
        ) {
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

    drawInstanced(
        renderer: RendererWithExposedMethods,
        model: FullModel,
        tx: number, ty: number, tz: number,
        rx: number, ry: number, rz: number,
        sx: number, sy: number, sz: number,
        offset: number,
        instances: number
    ): void {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined
        ) {
            return;
        }

        const gl = renderer.gl as WebGL2RenderingContext;

        model.bindBuffers(gl);

        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);

        // gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        // gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);

        gl.vertexAttribPointer(this.rm_Vertex, 4, gl.INT_2_10_10_10_REV, false, 8, 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 8, 4);

        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniform1i(this.uPositionOffset!, offset);
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);

        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
