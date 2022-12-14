import { BaseRenderer } from "webgl-framework";
import { mat4, vec3 } from "gl-matrix";
import { BoundingBox } from "./BoundingBoxVisibility";
export interface CulledObjects {
    boundingBox: BoundingBox;
    visibleCount: number;
    positions: Float32Array;
    rotations: Float32Array;
    count: number;
}
export declare class Renderer extends BaseRenderer {
    private lastTime;
    private angleYaw;
    private loaded;
    private fmSky;
    private fmGrassPatch;
    private fmDust;
    private fmAnt;
    private fmGroundFading;
    private fmRoundGrass;
    private fmButterfly;
    private fmDandelion0Leaves;
    private fmDandelion0Petals;
    private fmDandelion0Stem;
    private fmSphere;
    private noTextures;
    private noGlare;
    private vec3Temp;
    private textureSky;
    private textureGrass;
    private textureGround;
    private textureRoundGrass;
    private textureWhite;
    private textureAnt;
    private textureButterfly;
    private textureDandelionStem;
    private textureDandelionPetals;
    private textureDandelionLeavesDiffuse;
    private textureGrass1Positions;
    private textureGrass2Positions;
    private textureFlowersPositions;
    private shaderDiffuse;
    private shaderVertexLit;
    private shaderVertexLitInstancedVegetation;
    private shaderVertexLitInstancedVegetationFading;
    private shaderVertexLitInstancedGrass;
    private shaderVertexLitInstancedGrassAnimated;
    private shaderVertexLitInstancedGrassAt;
    private shaderVertexLitInstancedGrassFading;
    private shaderInstancedVegetation;
    private shaderDiffuseAnimatedTexture;
    private shaderDiffuseAnimatedTextureChunked;
    private shaderDiffuseColored;
    private shaderDiffuseColoredVertexAlpha;
    private shaderGlare;
    private shaderInstancedTexturePositionsColored;
    private shaderVertexLitInstancedTexturePositions;
    private shaderInstancedTexturePositionsGrass;
    private shaderInstancedTexturePositionsGrassAt;
    private shaderInstancedTexturePositionsGrassAnimated;
    private shaderAnts;
    private shaderButterfly;
    private customCamera;
    private Z_NEAR;
    private Z_FAR;
    private timerAnts;
    private ANTS_PERIOD;
    private timerGrassWind;
    private WIND_PERIOD;
    private timerButterfly;
    private BUTTERFLY_PERIOD;
    private timerButterflyAnimation;
    private BUTTERFLY_ANIMATION_PERIOD;
    private readonly WIND_STIFFNESS;
    private readonly WIND_HEIGHT_COEFF;
    private readonly WIND_OFFSET;
    private readonly GRASS_PATCH_SCALE;
    private readonly DANDELION_SCALE;
    private FLOWERS_SCALE;
    private ROUND_GRASS_SCALE;
    private readonly GRASS1_COUNT;
    private readonly GRASS2_COUNT;
    private readonly FLOWERS_COUNT;
    private readonly ANTS_SCALE;
    private readonly ANTS_COUNT;
    private readonly ANTS_SPREAD;
    private readonly ANTS_RADIUS;
    private readonly BUTTERFLIES_SCALE;
    private readonly BUTTERFLIES_COUNT;
    private readonly BUTTERFLIES_SPREAD;
    private readonly BUTTERFLIES_RADIUS;
    private readonly BUTTERFLIES_SIZE_X;
    private readonly BUTTERFLIES_ANIMATION_AMPLITUDE;
    private readonly BUTTERFLIES_FLIGHT_Z_AMPLITUDE;
    private currentPreset;
    private PRESETS;
    private cameraMode;
    private currentRandomCamera;
    protected matViewInverted: mat4;
    protected matViewInvertedTransposed: mat4;
    protected matTemp: mat4;
    protected cameraPosition: vec3;
    protected cameraRotation: vec3;
    private CAMERAS;
    private readonly CAMERA_SPEED;
    private readonly CAMERA_MIN_DURATION;
    private useRandomCamera;
    private cameraPositionInterpolator;
    private bboxVisibility;
    private grassDensity;
    private drawInsects;
    private visibleTiles;
    private visibleGrassInstances;
    private readyCallback;
    constructor();
    setCustomCamera(camera: mat4 | undefined, position?: vec3, rotation?: vec3): void;
    resetCustomCamera(): void;
    onBeforeInit(): void;
    onAfterInit(): void;
    onInitError(): void;
    initShaders(): void;
    protected loadFloatingPointTexture(url: string, gl: WebGL2RenderingContext, width: number, height: number, minFilter?: number, magFilter?: number, clamp?: boolean, numberOfComponents?: number): Promise<WebGLTexture>;
    protected loadFp32Texture(data: ArrayBuffer, gl: WebGL2RenderingContext, width: number, height: number, minFilter?: number, magFilter?: number, clamp?: boolean, numberOfComponents?: number): WebGLTexture;
    loadData(): Promise<void>;
    animate(): void;
    /** Calculates projection matrix */
    setCameraFOV(multiplier: number): void;
    /**
     * Calculates camera matrix.
     *
     * @param a Position in [0...1] range
     */
    private positionCamera;
    /** Issues actual draw calls */
    drawScene(): void;
    private drawSceneObjects;
    private drawButterflies;
    private drawAnts;
    private drawGrass;
    private drawSkyObject;
    private randomizeCamera;
    iterateCamera(): void;
    private nextCamera;
    checkGlError(operation: string): void;
    set density(value: number);
    set timeOfDay(value: string);
    set glare(value: boolean);
    set insects(value: boolean);
    get tiles(): number;
    get grassInstances(): number;
    set ready(callback: () => void);
}
