import { InstancedVegetationShader } from "./InstancedVegetationShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";
import { VertexLitInstancedGrassShader } from "./VertexLitInstancedGrassShader";

export class VertexLitInstancedGrassAnimatedShader extends VertexLitInstancedGrassShader {
    uTime: WebGLUniformLocation | undefined;
    viewPos: WebGLUniformLocation | undefined;
    stiffness: WebGLUniformLocation | undefined;
    heightCoeff: WebGLUniformLocation | undefined;
    windOffset: WebGLUniformLocation | undefined;

    fillCode() {
        super.fillCode();
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

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near

            uniform float stiffness;// = 2.0;
            uniform float heightCoeff;// = 0.06;
            uniform float windOffset;// = 11.0;

            out vec2 vTexCoord;
            out vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform float uTime;
            const float PI2 = 6.283185307179586;

            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;
            uniform vec3 uDistributionRange;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.0; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions.INVERSE_RANDOM}
            ${ShaderCommonFunctions.ROTATION}
            ${ShaderCommonFunctions.GRADIENT_NOISE}

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                // animation ======================================
                float time1 = sin(uTime + random(fInstance * 0.0196));
                float time2 = cos(uTime + random(fInstance * 0.0177));
                float bendCoeff = pow(rm_Vertex.z * heightCoeff, stiffness);
                float ox = time1 * noise(vertex.xy * .07) * windOffset;
                float oy = time2 * noise(vertex.xy * .077) * windOffset;
                // float oz = time * noise(vertex.xy * .075) * windOffset;
                vertex.x += ox * bendCoeff;
                vertex.y += oy * bendCoeff;
                // vertex.z += oz * bendCoeff;
                // end animation ==================================

                gl_Position = view_proj_matrix * vertex;

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // vDiffuseColor.r += bendCoeff * 3.; // FIXME

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float SPECULAR_POWER = 6.0;
                const float ZERO = 0.0;
                // const vec3 NORMAL = vec3(0.0, 0.0, 1.0);
                float time3 =  noise(sin(uTime) * vertex.xy * .01);
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

                vTexCoord = rm_TexCoord0;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();

        this.uTime = this.getUniform("uTime");
        this.viewPos = this.getUniform("viewPos");
        this.stiffness = this.getUniform("stiffness");
        this.heightCoeff = this.getUniform("heightCoeff");
        this.windOffset = this.getUniform("windOffset");
    }
}
