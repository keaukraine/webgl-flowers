import { DiffuseShader, FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";

export class ButterflyShader extends DiffuseShader {
    // Uniforms are of type `WebGLUniformLocation`
    uSpread: WebGLUniformLocation | undefined;
    uRadius: WebGLUniformLocation | undefined;
    uTime: WebGLUniformLocation | undefined;
    uRotation: WebGLUniformLocation | undefined;
    uAnimationTime: WebGLUniformLocation | undefined;
    uButterflyParams: WebGLUniformLocation | undefined;

    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uRadius; // x: base radius, y: additional random radius
            uniform vec2 uSpread; // x: X spread; y: Y spread.
            uniform float uTime;
            uniform float uRotation;

            uniform float uAnimationTime;
            uniform vec4 uButterflyParams; // x: X size; y: Z animation amplitude, z: Z flight amplitude, w: atlas Y size.

            out mediump vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float STIFFNESS = 4.0;
            const float JUMP_PERIOD_COEFF = 4.0;
            const float HALF = 0.5;
            const float ONE = 1.0;
            const float MAGIC_1 = 0.0196;
            const float MAGIC_2 = 0.0177;

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    uSpread.x * (random(fInstance * MAGIC_1) - HALF),
                    uSpread.y * (random(fInstance * MAGIC_2) - HALF)
                );

                float angle = uTime + fInstance;
                float radius = uRadius.x + uRadius.y * random(fInstance);
                translation += vec2(sin(angle), cos(angle)) * radius;

                mat4 rotationMatrix = rotationAroundZ(-angle + uRotation);

                float animCoeff = pow(abs(vertex.x / uButterflyParams.x), STIFFNESS);
                vertex.z += sin(uAnimationTime + fInstance) * animCoeff * uButterflyParams.y;
                vertex.z += sin(uTime * JUMP_PERIOD_COEFF + fInstance) * uButterflyParams.z;

                vertex *= rotationMatrix;
                vertex.xy += translation;

                gl_Position = view_proj_matrix * vertex;

                vTexCoord = rm_TexCoord0;
                vTexCoord.y *= uButterflyParams.w;
                vTexCoord.y += mod(fInstance * uButterflyParams.w, ONE);
            }`;

        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;

            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
                if (fragColor.a < 0.2) discard;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.uSpread = this.getUniform("uSpread");
        this.uTime = this.getUniform("uTime");
        this.uRadius = this.getUniform("uRadius");
        this.uRotation = this.getUniform("uRotation");
        this.uAnimationTime = this.getUniform("uAnimationTime");
        this.uButterflyParams = this.getUniform("uButterflyParams");
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
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);

        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);

        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);

        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
