export const ShaderCommonFunctions = {
    RANDOM: `
    /** From https://thebookofshaders.com/10/ */
    float random_vec2 (vec2 st) {
        return fract(sin(dot(st.xy,vec2(12.9898, 78.233))) * 43758.5453123);
    }

    /** Optimized version of the same random() from The Book of Shaders */
    float random (float st) {
        return fract(sin(st) * 43758.5453123);
    }
    `,

    INVERSE_RANDOM: `
    /** From https://thebookofshaders.com/10/ */
    float random_vec2 (vec2 st) {
        return 1.0 - fract(sin(dot(st.xy,vec2(12.9898, 78.233))) * 43758.5453123);
    }

    /** Optimized version of the same random() from The Book of Shaders */
    float random (float st) {
        return 1.0 - fract(sin(st) * 43758.5453123);
    }
    `,

    GRADIENT_NOISE: `
    vec2 random2(vec2 st){
        st = vec2( dot(st,vec2(127.1,311.7)),
                  dot(st,vec2(269.5,183.3)) );
        return -1.0 + 2.0*fract(sin(st)*43758.5453123);
    }

    // Gradient Noise by Inigo Quilez - iq/2013
    // https://www.shadertoy.com/view/XdXGW8
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org    
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
    
        vec2 u = f*f*(3.0-2.0*f);
    
        return mix( mix( dot( random2(i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                         dot( random2(i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                    mix( dot( random2(i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                         dot( random2(i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
    }    
    `,

    ROTATION: `
    /** https://www.neilmendoza.com/glsl-rotation-about-an-arbitrary-axis/ */
    mat4 rotationMatrix(vec3 axis, float angle)
    {
        // axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        
        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                    0.0,                                0.0,                                0.0,                                1.0);
    }  

    /** Optimized version to rotate only around Z axis */
    mat4 rotationAroundZ(float angle)
    {
        float s = sin(angle);
        float c = cos(angle);
        
        return mat4(c,  -s,   0.0, 0.0,
                    s,   c,   0.0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    0.0, 0.0, 0.0, 1.0);
    }
    `
};