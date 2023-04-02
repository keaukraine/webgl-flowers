import { InstancedTexturePositionsGrassShader } from "./InstancedTexturePositionsGrassShader";
import { InstancedTexturePositionsShader } from "./InstancedTexturePositionsShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";

export class InstancedTexturePositionsGrassAnimatedShader extends InstancedTexturePositionsGrassShader {
    uTime: WebGLUniformLocation | undefined;
    stiffness: WebGLUniformLocation | undefined;
    heightCoeff: WebGLUniformLocation | undefined;
    windOffset: WebGLUniformLocation | undefined;

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

            out mediump vec2 vTexCoord;
            out mediump vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform vec3 viewPos;
            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
            ${ShaderCommonFunctions.VALUE_NOISE}

            const float PI2 = 6.28318530718;

            uniform vec2 uTime; // x=sin(time), y=cos(time)
            uniform float stiffness;// = 2.0;
            uniform float heightCoeff;// = 0.06;
            uniform float windOffset;// = 11.0;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float SPECULAR_POWER = 6.0;
                const float ZERO = 0.0;
                // const vec3 NORMAL = vec3(0.0, 0.0, 1.0);
                float time3 =  noise(uTime.x * vertex.xy * .01);
                vec3 vNormal2 = normalize(normal + time3 * 0.2).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                //vNormal2 *= time2 / 2.0;

                vec3 viewDir = normalize(viewPos - FragPos);
                //vec3 lightDir = normalize(lightPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                //const float specularStrength = 1.8;
                //vec4 specularColor = specularStrength * spec * vec4(1.0, 1.0, 1.0, 1.0);
                //vDiffuseColor = mix(vDiffuseColor, uSpecularColor, uSpecularStrength * spec);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                //gl_Position = view_proj_matrix * vertex;
                // animation ======================================
                float time1 = uTime.x;
                float time2 = uTime.y;
                // float bendCoeff = pow(rm_Vertex.z * heightCoeff, stiffness);
                float bendCoeff = pow(abs(rm_Vertex.z) * heightCoeff, stiffness);
                float noiseX = noise(vertex.xy * .07);
                float noiseY = noise(vertex.xy * .077);
                float ox = time1 * noiseX * windOffset;
                float oy = time2 * noiseY * windOffset;
                // float oz = time * noise(vertex.xy * .075) * windOffset;
                vertex.x += ox * bendCoeff;
                vertex.y += oy * bendCoeff;
                // vertex.z += oz * bendCoeff;
                // end animation ==================================
                gl_Position = view_proj_matrix * vertex;
                //vDiffuseColor.r += bendCoeff * 5.; // FIXME


                // gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.uTime = this.getUniform("uTime");
        this.stiffness = this.getUniform("stiffness");
        this.heightCoeff = this.getUniform("heightCoeff");
        this.windOffset = this.getUniform("windOffset");
    }
}
