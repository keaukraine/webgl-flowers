import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";
import { VertexLitInstancedTexturePositionsShader } from "./VertexLitInstancedTexturePositionsShader";

export class InstancedTexturePositionsGrassShader extends VertexLitInstancedTexturePositionsShader {
    viewPos: WebGLUniformLocation | undefined;
    uSpecularPower: WebGLUniformLocation | undefined;
    uSpecularColor: WebGLUniformLocation | undefined;
    uSpecularStrength: WebGLUniformLocation | undefined;

    fillCode() {
        super.fillCode();

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

            out vec2 vTexCoord;
            out vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform vec3 viewPos;
            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}
                gl_Position = view_proj_matrix * vertex;

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
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
                //const float specularStrength = 1.8;
                //vDiffuseColor = mix(vDiffuseColor, uSpecularColor, uSpecularStrength * spec);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                vTexCoord = rm_TexCoord0;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.viewPos = this.getUniform("viewPos");
        this.uSpecularColor = this.getUniform("uSpecularColor");
        this.uSpecularPower = this.getUniform("uSpecularPower");
        this.uSpecularStrength = this.getUniform("uSpecularStrength");
    }
}
