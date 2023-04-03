export declare const ShaderCommonFunctions: {
    RANDOM: string;
    INVERSE_RANDOM: string;
    GRADIENT_NOISE: string;
    ROTATION: string;
    /**
     * Fast and somewhat good enough.
     */
    VALUE_NOISE: string;
    /**
     * Clear repetitive horizontal and vertical patterns can be seen.
     * Still good enough for low-frequency vertex stuff
     */
    VALUE_NOISE_CHEAP: string;
    /**
     * Generates 2 random values for 2 vec2 packed into single vec4.
     */
    VALUE_NOISE2: string;
    /**
     * Generates 2 random values for 2 vec2 packed into single vec4.
     * Clear repetitive horizontal and vertical patterns can be seen.
     * Still good enough for low-frequency vertex stuff
     */
    VALUE_NOISE2_CHEAP: string;
};
