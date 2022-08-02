import { FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";

export class VertexLitInstancedTexturePositionsShader extends InstancedTexturePositionsShader {
    // Uniforms are of type `WebGLUniformLocation`
    view_matrix: WebGLUniformLocation | undefined;
    model_matrix: WebGLUniformLocation | undefined;
    ambient: WebGLUniformLocation | undefined;
    diffuse: WebGLUniformLocation | undefined;
    lightDir: WebGLUniformLocation | undefined;
    diffuseCoef: WebGLUniformLocation | undefined;
    diffuseExponent: WebGLUniformLocation | undefined;

    // Attributes are numbers.
    rm_Normal: number | undefined;

    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            out mediump vec2 vTexCoord;
            out mediump vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;

        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            in mediump vec4 vDiffuseColor;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = vDiffuseColor * texture(sTexture, vTexCoord);
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

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
    drawModel(
        renderer: RendererWithExposedMethods,
        model: FullModel,
        tx: number, ty: number, tz: number,
        rx: number, ry: number, rz: number,
        sx: number, sy: number, sz: number
    ): void {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined
        ) {
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
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined
        ) {
            return;
        }

        const gl = renderer.gl as WebGL2RenderingContext;

        model.bindBuffers(gl);

        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);

        gl.vertexAttribPointer(this.rm_Vertex, 4, gl.INT_2_10_10_10_REV, false, 12, 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 12, 4);
        gl.vertexAttribPointer(this.rm_Normal, 4, gl.INT_2_10_10_10_REV, true, 12, 8);

        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.uniform1i(this.uPositionOffset!, offset);
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);

        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
}
