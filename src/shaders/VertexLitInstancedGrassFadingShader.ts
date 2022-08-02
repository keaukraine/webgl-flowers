import { InstancedVegetationShader } from "./InstancedVegetationShader";
import { ShaderCommonFunctions } from "./ShaderCommonFunctions";
import { VertexLitInstancedVegetationFadingShader } from "./VertexLitInstancedVegetationFadingShader";
import { VertexLitInstancedVegetationShader } from "./VertexLitInstancedVegetationShader";

export class VertexLitInstancedGrassFadingShader extends VertexLitInstancedVegetationFadingShader {
    fillCode() {
        super.fillCode();

        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform vec4 lightDir;
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
            uniform float minInstanceScale; // minimum scale of instance to draw
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.1; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;
            
            ${ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
                        
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                float shrink = smoothstep(0.0, 0.6, (cullDistances.y - instancePosition.z) / cullDistances.y);
                if (shrink < minInstanceScale) {
                    shrink = 0.0;
                }

                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    scale *= shrink;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // animation ======================================
                //vDiffuseColor.r += 5.0;
                // end animation ==================================

                vTexCoord = rm_TexCoord0;
            }`;
    }

    fillUniformsAttributes() {
        super.fillUniformsAttributes();
    }
}
