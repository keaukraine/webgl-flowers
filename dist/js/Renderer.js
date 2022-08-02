"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Renderer = void 0;
const webgl_framework_1 = require("webgl-framework");
const gl_matrix_1 = require("gl-matrix");
const DiffuseColoredShader_1 = require("./shaders/DiffuseColoredShader");
const CameraMode_1 = require("./CameraMode");
const CameraPositionInterpolator_1 = require("./CameraPositionInterpolator");
const DiffuseAnimatedTextureShader_1 = require("./shaders/DiffuseAnimatedTextureShader");
const DiffuseAnimatedTextureChunkedShader_1 = require("./shaders/DiffuseAnimatedTextureChunkedShader");
const VertexLitShader_1 = require("./shaders/VertexLitShader");
const VertexLitInstancedVegetationShader_1 = require("./shaders/VertexLitInstancedVegetationShader");
const VertexLitInstancedVegetationFadingShader_1 = require("./shaders/VertexLitInstancedVegetationFadingShader");
const VertexLitInstancedGrassAnimatedShader_1 = require("./shaders/VertexLitInstancedGrassAnimatedShader");
const VertexLitInstancedGrassFadingShader_1 = require("./shaders/VertexLitInstancedGrassFadingShader");
const VertexLitInstancedGrassShader_1 = require("./shaders/VertexLitInstancedGrassShader");
const InstancedVegetationShader_1 = require("./shaders/InstancedVegetationShader");
const VertexLitInstancedGrassAtShader_1 = require("./shaders/VertexLitInstancedGrassAtShader");
const GlareShader_1 = require("./shaders/GlareShader");
const DiffuseColoredVertexAlphaShader_1 = require("./shaders/DiffuseColoredVertexAlphaShader");
const InstancedTexturePositionsColoredShader_1 = require("./shaders/InstancedTexturePositionsColoredShader");
const VertexLitInstancedTexturePositionsShader_1 = require("./shaders/VertexLitInstancedTexturePositionsShader");
const InstancedTexturePositionsGrassShader_1 = require("./shaders/InstancedTexturePositionsGrassShader");
const InstancedTexturePositionsGrassAnimatedShader_1 = require("./shaders/InstancedTexturePositionsGrassAnimatedShader");
const InstancedTexturePositionsGrassAtShader_1 = require("./shaders/InstancedTexturePositionsGrassAtShader");
const AntsShader_1 = require("./shaders/AntsShader");
const ButterflyShader_1 = require("./shaders/ButterflyShader");
const GrassPositions_1 = require("./GrassPositions");
const BoundingBoxVisibility_1 = require("./BoundingBoxVisibility");
const FOV_LANDSCAPE = 20.0; // FOV for landscape
const FOV_PORTRAIT = 30.0; // FOV for portrait
const YAW_COEFF_NORMAL = 220.0; // camera rotation time
class Renderer extends webgl_framework_1.BaseRenderer {
    constructor() {
        super();
        this.lastTime = 0;
        this.angleYaw = 0;
        this.loaded = false;
        this.fmSky = new webgl_framework_1.FullModel();
        this.fmGrassPatch = new webgl_framework_1.FullModel();
        this.fmDust = new webgl_framework_1.FullModel();
        this.fmAnt = new webgl_framework_1.FullModel();
        this.fmGroundFading = new webgl_framework_1.FullModel();
        this.fmRoundGrass = new webgl_framework_1.FullModel();
        this.fmButterfly = new webgl_framework_1.FullModel();
        this.fmDandelion0Leaves = new webgl_framework_1.FullModel();
        this.fmDandelion0Petals = new webgl_framework_1.FullModel();
        this.fmDandelion0Stem = new webgl_framework_1.FullModel();
        this.fmSphere = new webgl_framework_1.FullModel();
        this.noTextures = false;
        this.noGlare = false;
        this.vec3Temp = [0, 0, 0];
        this.textureGrass1Positions = null;
        this.textureGrass2Positions = null;
        this.textureFlowersPositions = null;
        this.Z_NEAR = 10.0;
        this.Z_FAR = 1500.0;
        this.timerAnts = 0;
        this.ANTS_PERIOD = 18000;
        this.timerGrassWind = 0;
        this.WIND_PERIOD = 5000;
        this.timerButterfly = 0;
        this.BUTTERFLY_PERIOD = 5000;
        this.timerButterflyAnimation = 0;
        this.BUTTERFLY_ANIMATION_PERIOD = 350;
        this.WIND_STIFFNESS = 2.0;
        this.WIND_HEIGHT_COEFF = 0.06;
        this.WIND_OFFSET = 11.0;
        this.GRASS_PATCH_SCALE = 28.0;
        this.DANDELION_SCALE = 39.0;
        this.FLOWERS_SCALE = [2.2 / this.DANDELION_SCALE, 0.5 / this.DANDELION_SCALE];
        this.ROUND_GRASS_SCALE = [2.2 / 122, 0.5 / 122];
        this.GRASS1_COUNT = 339;
        this.GRASS2_COUNT = 157;
        this.FLOWERS_COUNT = 15;
        this.ANTS_SCALE = 0.005;
        this.ANTS_COUNT = 34;
        this.ANTS_SPREAD = 75;
        this.ANTS_RADIUS = [50, 30];
        this.BUTTERFLIES_SCALE = 0.06;
        this.BUTTERFLIES_COUNT = 4;
        this.BUTTERFLIES_SPREAD = 80;
        this.BUTTERFLIES_RADIUS = [50, 30];
        this.BUTTERFLIES_SIZE_X = 74;
        this.BUTTERFLIES_ANIMATION_AMPLITUDE = 60;
        this.BUTTERFLIES_FLIGHT_Z_AMPLITUDE = 50;
        this.currentPreset = 0;
        this.PRESETS = [
            {
                name: "Day",
                glareColor: [105 / 255, 105 / 255, 45 / 255],
                glareBrightness: 0.8,
                glareExponent: 2.5,
                lightDir: gl_matrix_1.vec3.normalize(this.vec3Temp, [1.0, 1.0, 1.0]),
                flowerColor: [255 / 255, 255 / 255, 255 / 255],
                flowerColorBrightness: 1.0,
                lightDiffuse: [255 / 255, 255 / 255, 255 / 255],
                lightDiffuseBrightness: 1.0,
                lightAmbient: [128 / 255, 128 / 255, 160 / 255],
                lightAmbientBrightness: 1.0,
                lightDiffuseGrass: [255 / 255, 255 / 255, 255 / 255],
                lightDiffuseGrassBrightness: 1.0,
                lightAmbientGrass: [95 / 255, 126 / 255, 82 / 255],
                lightAmbientGrassBrightness: 1.0,
                diffuseCoeff: 1.0,
                grassSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                grassSpecularColorBrightness: 1.0,
                grassSpecularPower: 4.0,
                grassSpecularStrength: 0.66,
                roundGrassSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                roundGrassSpecularPower: 4.0,
                roundGrassSpecularStrength: 0.1,
                stemSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                stemSpecularColorBrightness: 1.0,
                stemSpecularPower: 1.0,
                stemSpecularStrength: 0.2,
                leavesSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                leavesSpecularColorBrightness: 1.0,
                leavesSpecularPower: 4.0,
                leavesSpecularStrength: 1.0,
                groundColor: [255 / 255, 255 / 255, 255 / 255],
                groundColorBrightness: 1.0,
                drawAnts: true,
                antsColor: [255 / 255, 255 / 255, 255 / 255],
                antsColorBrightness: 1.0,
                skyTexture: "sky-half.webp",
                skyColor: [255 / 255, 255 / 255, 255 / 255],
                skyColorBrightness: 1.0,
                drawButterflies: true
            },
            {
                name: "Sunset",
                glareColor: [241 / 255, 133 / 255, 0 / 255],
                glareBrightness: 0.85,
                glareExponent: 22.5,
                lightDir: gl_matrix_1.vec3.normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
                flowerColor: [255 / 255, 200 / 255, 180 / 255],
                flowerColorBrightness: 0.35,
                lightDiffuse: [255 / 255, 180 / 255, 120 / 255],
                lightDiffuseBrightness: 0.35,
                lightAmbient: [110 / 255, 90 / 255, 144 / 255],
                lightAmbientBrightness: 0.45,
                lightDiffuseGrass: [225 / 255, 132 / 255, 64 / 255],
                lightDiffuseGrassBrightness: 0.45,
                lightAmbientGrass: [100 / 255, 100 / 255, 168 / 255],
                lightAmbientGrassBrightness: 0.4,
                diffuseCoeff: 1.0,
                grassSpecularColor: [255 / 255, 88 / 255, 0 / 255],
                grassSpecularColorBrightness: 0.45,
                grassSpecularPower: 4.0,
                grassSpecularStrength: 0.66,
                roundGrassSpecularColor: [255 / 255, 88 / 255, 0 / 255],
                roundGrassSpecularPower: 4.0,
                roundGrassSpecularStrength: 0.1,
                stemSpecularColor: [255 / 255, 88 / 255, 0 / 255],
                stemSpecularColorBrightness: 0.45,
                stemSpecularPower: 1.0,
                stemSpecularStrength: 0.2,
                leavesSpecularColor: [255 / 255, 160 / 255, 88 / 255],
                leavesSpecularColorBrightness: 0.45,
                leavesSpecularPower: 4.0,
                leavesSpecularStrength: 1.0,
                groundColor: [255 / 255, 255 / 255, 255 / 255],
                groundColorBrightness: 0.35,
                drawAnts: true,
                antsColor: [255 / 255, 180 / 255, 120 / 255],
                antsColorBrightness: 0.4,
                skyTexture: "sky-sunset.webp",
                skyColor: [255 / 255, 255 / 255, 255 / 255],
                skyColorBrightness: 1.0
            },
            {
                name: "Night",
                glareColor: [241 / 255, 133 / 255, 0 / 255],
                glareBrightness: 0.85,
                glareExponent: 22.5,
                noGlare: true,
                lightDir: gl_matrix_1.vec3.normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
                flowerColor: [180 / 255, 180 / 255, 200 / 255],
                flowerColorBrightness: 0.3,
                lightDiffuse: [123 / 255, 120 / 255, 255 / 255],
                lightDiffuseBrightness: 0.33,
                lightAmbient: [60 / 255, 77 / 255, 144 / 255],
                lightAmbientBrightness: 0.33,
                lightDiffuseGrass: [140 / 255, 140 / 255, 255 / 255],
                lightDiffuseGrassBrightness: 0.35,
                lightAmbientGrass: [95 / 255, 80 / 255, 182 / 255],
                lightAmbientGrassBrightness: 0.3,
                diffuseCoeff: 1.0,
                grassSpecularColor: [255 / 255, 200 / 255, 180 / 255],
                grassSpecularColorBrightness: 0.3,
                grassSpecularPower: 4.0,
                grassSpecularStrength: 0.66,
                roundGrassSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                roundGrassSpecularPower: 4.0,
                roundGrassSpecularStrength: 0.1,
                stemSpecularColor: [255 / 255, 185 / 255, 155 / 255],
                stemSpecularColorBrightness: 0.3,
                stemSpecularPower: 1.0,
                stemSpecularStrength: 0.2,
                leavesSpecularColor: [255 / 255, 255 / 255, 255 / 255],
                leavesSpecularColorBrightness: 0.3,
                leavesSpecularPower: 4.0,
                leavesSpecularStrength: 1.0,
                groundColor: [255 / 255, 255 / 255, 255 / 255],
                groundColorBrightness: 0.4,
                drawAnts: false,
                antsColor: [255 / 255, 255 / 255, 255 / 255],
                antsColorBrightness: 1,
                skyTexture: "sky-half.webp",
                skyColor: [80 / 255, 92 / 255, 138 / 255],
                skyColorBrightness: 0.3,
            },
            {
                name: "Sunrise",
                glareColor: [255 / 255, 70 / 255, 0 / 255],
                glareBrightness: 0.7,
                glareExponent: 22.5,
                lightDir: gl_matrix_1.vec3.normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
                flowerColor: [255 / 255, 144 / 255, 111 / 255],
                flowerColorBrightness: 0.35,
                lightDiffuse: [255 / 255, 160 / 255, 100 / 255],
                lightDiffuseBrightness: 0.4,
                lightAmbient: [110 / 255, 90 / 255, 144 / 255],
                lightAmbientBrightness: 0.45,
                lightDiffuseGrass: [255 / 255, 122 / 255, 55 / 255],
                lightDiffuseGrassBrightness: 0.45,
                lightAmbientGrass: [144 / 255, 90 / 255, 90 / 255],
                lightAmbientGrassBrightness: 0.4,
                diffuseCoeff: 1.0,
                grassSpecularColor: [255 / 255, 55 / 255, 11 / 255],
                grassSpecularColorBrightness: 0.45,
                grassSpecularPower: 4.0,
                grassSpecularStrength: 0.66,
                roundGrassSpecularColor: [255 / 255, 88 / 255, 0 / 255],
                roundGrassSpecularPower: 4.0,
                roundGrassSpecularStrength: 0.1,
                stemSpecularColor: [255 / 255, 88 / 255, 0 / 255],
                stemSpecularColorBrightness: 0.45,
                stemSpecularPower: 1.0,
                stemSpecularStrength: 0.2,
                leavesSpecularColor: [255 / 255, 160 / 255, 88 / 255],
                leavesSpecularColorBrightness: 0.45,
                leavesSpecularPower: 4.0,
                leavesSpecularStrength: 1.0,
                groundColor: [255 / 255, 255 / 255, 255 / 255],
                groundColorBrightness: 0.35,
                drawAnts: true,
                antsColor: [255 / 255, 180 / 255, 120 / 255],
                antsColorBrightness: 0.4,
                skyTexture: "sky-sunset.webp",
                skyColor: [255 / 255, 150 / 255, 150 / 255],
                skyColorBrightness: 1.0
            }
        ];
        this.cameraMode = CameraMode_1.CameraMode.Random;
        this.currentRandomCamera = 0;
        this.matViewInverted = gl_matrix_1.mat4.create();
        this.matViewInvertedTransposed = gl_matrix_1.mat4.create();
        this.matTemp = gl_matrix_1.mat4.create();
        this.cameraPosition = gl_matrix_1.vec3.create();
        this.cameraRotation = gl_matrix_1.vec3.create();
        this.CAMERAS = [
            // // TEST CAMERA
            // {
            //     start: {
            //         position: new Float32Array([11.336540222167969,-406.69482421875,309.68804931640625]),
            //         rotation: new Float32Array([0.6600002646446228,0.036000173538923264,0])
            //     },
            //     end: {
            //         position: new Float32Array([11.336540222167969,-406.69482421875,309.68804931640625]),
            //         rotation: new Float32Array([0.6600002646446228,0.036000173538923264,0])
            //     },
            //     speedMultiplier: 1.0
            // },
            {
                start: {
                    position: new Float32Array([193.48460388183594, -161.2293701171875, 26.288768768310547]),
                    rotation: new Float32Array([-0.006000004708766937, 5.191177845001221, 0])
                },
                end: {
                    position: new Float32Array([138.8173828125, 178.6765594482422, 31.021570205688477]),
                    rotation: new Float32Array([-2.7418136649970393e-9, 3.949169158935547, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([105.49623107910156, 57.43907165527344, 71.68569946289062]),
                    rotation: new Float32Array([0.5879998803138733, 4.345171928405762, 0])
                },
                end: {
                    position: new Float32Array([42.728511810302734, -90.01109313964844, 74.52281188964844]),
                    rotation: new Float32Array([0.48600009083747864, 6.04318380355835, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-67.54290008544922, -33.61400604248047, 63.343177795410156]),
                    rotation: new Float32Array([0.4320005774497986, 0.9239993691444397, 0])
                },
                end: {
                    position: new Float32Array([44.3769645690918, 70.59022521972656, 69.28772735595703]),
                    rotation: new Float32Array([0.6060004234313965, 3.9420197010040283, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([38.70161819458008, 30.623598098754883, 29.440074920654297]),
                    rotation: new Float32Array([0.14999987185001373, 4.212021350860596, 0])
                },
                end: {
                    position: new Float32Array([5.7086896896362305, 98.68388366699219, 23.767621994018555]),
                    rotation: new Float32Array([0.023999907076358795, 2.8620119094848633, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([126.77375793457031, 82.41195678710938, 64.88525390625]),
                    rotation: new Float32Array([0.5220004320144653, 4.009169578552246, 0])
                },
                end: {
                    position: new Float32Array([121.06608581542969, 111.07565307617188, 25.369491577148438]),
                    rotation: new Float32Array([0.01200005691498518, 4.5131731033325195, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([122.68425750732422, 6.09023904800415, 26.537200927734375]),
                    rotation: new Float32Array([0.03599995747208595, 3.996018886566162, 0])
                },
                end: {
                    position: new Float32Array([101.9842529296875, 74.69181823730469, 20.949016571044922]),
                    rotation: new Float32Array([-0.024000033736228943, 4.95002555847168, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([129.5026092529297, 142.1769256591797, 24.73994255065918]),
                    rotation: new Float32Array([-1.778304579147516e-7, 3.6180028915405273, 0])
                },
                end: {
                    position: new Float32Array([-97.36258697509766, 173.8473358154297, 21.665822982788086]),
                    rotation: new Float32Array([-0.012000122107565403, 2.622001886367798, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([75.2061996459961, 75.03823852539062, 185.00991821289062]),
                    rotation: new Float32Array([1.0079998970031738, 3.755999803543091, 0])
                },
                end: {
                    position: new Float32Array([-29.02829933166504, 42.7842903137207, 189.60440063476562]),
                    rotation: new Float32Array([1.0920006036758423, 2.387998580932617, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([103.99015808105469, 74.62678527832031, 156.29510498046875]),
                    rotation: new Float32Array([0.9899996519088745, 4.032003879547119, 0])
                },
                end: {
                    position: new Float32Array([-178.87892150878906, -5.985522747039795, 177.8407440185547]),
                    rotation: new Float32Array([0.959999680519104, 1.6260037422180176, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([60.910362243652344, 119.53804016113281, 81.02588653564453]),
                    rotation: new Float32Array([0.8939999341964722, 3.4200048446655273, 0])
                },
                end: {
                    position: new Float32Array([-182.57057189941406, 34.927425384521484, 183.38380432128906]),
                    rotation: new Float32Array([0.9479997754096985, 1.9920008182525635, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([7.54575777053833, 107.43892669677734, 124.10911560058594]),
                    rotation: new Float32Array([1.0620001554489136, 2.736001968383789, 0])
                },
                end: {
                    position: new Float32Array([-107.07096862792969, -121.59932708740234, 155.70933532714844]),
                    rotation: new Float32Array([0.8699998259544373, 0.9540011286735535, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([80.27741241455078, 171.7574920654297, 68.77640533447266]),
                    rotation: new Float32Array([0.7019999027252197, 3.210000514984131, 0])
                },
                end: {
                    position: new Float32Array([-140.18307495117188, -137.1750030517578, 65.08952331542969]),
                    rotation: new Float32Array([0.4560002386569977, 1.1220002174377441, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([50.706085205078125, 86.05104064941406, 102.37602233886719]),
                    rotation: new Float32Array([0.8219998478889465, 2.8080010414123535, 0])
                },
                end: {
                    position: new Float32Array([-5.94230842590332, -62.32189178466797, 75.14812469482422]),
                    rotation: new Float32Array([0.7379996180534363, 4.704004764556885, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-141.20269775390625, 27.679370880126953, 218.7299041748047]),
                    rotation: new Float32Array([1.2060006856918335, 1.6259998083114624, 0])
                },
                end: {
                    position: new Float32Array([67.05718231201172, -151.7519073486328, 125.82315063476562]),
                    rotation: new Float32Array([0.9900000095367432, 0.2279992401599884, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-145.80145263671875, 114.13640594482422, 22.470090866088867]),
                    rotation: new Float32Array([-0.024000030010938644, 1.9740006923675537, 0])
                },
                end: {
                    position: new Float32Array([-123.3978500366211, -117.26119995117188, 15.269742965698242]),
                    rotation: new Float32Array([0.01799994334578514, 1.175997257232666, 0])
                },
                speedMultiplier: 1.0
            },
        ];
        this.CAMERA_SPEED = 0.01;
        this.CAMERA_MIN_DURATION = 8000;
        this.useRandomCamera = true;
        this.cameraPositionInterpolator = new CameraPositionInterpolator_1.CameraPositionInterpolator();
        this.grassDensity = 1.0;
        this.drawInsects = true;
        this.visibleTiles = 0;
        this.visibleGrassInstances = 0;
        this.bboxVisibility = new BoundingBoxVisibility_1.BoundingBoxVisibility(this);
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED;
        this.cameraPositionInterpolator.minDuration = this.CAMERA_MIN_DURATION;
        this.randomizeCamera();
    }
    setCustomCamera(camera, position, rotation) {
        this.customCamera = camera;
        if (position !== undefined) {
            this.cameraPosition = position;
        }
        if (rotation !== undefined) {
            this.cameraRotation = rotation;
        }
    }
    resetCustomCamera() {
        this.customCamera = undefined;
    }
    onBeforeInit() {
    }
    onAfterInit() {
    }
    onInitError() {
    }
    initShaders() {
        this.shaderVertexLit = new VertexLitShader_1.VertexLitShader(this.gl);
        this.shaderVertexLitInstancedVegetation = new VertexLitInstancedVegetationShader_1.VertexLitInstancedVegetationShader(this.gl);
        this.shaderVertexLitInstancedVegetationFading = new VertexLitInstancedVegetationFadingShader_1.VertexLitInstancedVegetationFadingShader(this.gl);
        this.shaderVertexLitInstancedGrass = new VertexLitInstancedGrassShader_1.VertexLitInstancedGrassShader(this.gl);
        this.shaderVertexLitInstancedGrassAnimated = new VertexLitInstancedGrassAnimatedShader_1.VertexLitInstancedGrassAnimatedShader(this.gl);
        this.shaderVertexLitInstancedGrassAt = new VertexLitInstancedGrassAtShader_1.VertexLitInstancedGrassAtShader(this.gl);
        this.shaderVertexLitInstancedGrassFading = new VertexLitInstancedGrassFadingShader_1.VertexLitInstancedGrassFadingShader(this.gl);
        this.shaderInstancedVegetation = new InstancedVegetationShader_1.InstancedVegetationShader(this.gl);
        this.shaderGlare = new GlareShader_1.GlareShader(this.gl);
        this.shaderInstancedTexturePositionsColored = new InstancedTexturePositionsColoredShader_1.InstancedTexturePositionsColoredShader(this.gl);
        this.shaderVertexLitInstancedTexturePositions = new VertexLitInstancedTexturePositionsShader_1.VertexLitInstancedTexturePositionsShader(this.gl);
        this.shaderInstancedTexturePositionsGrass = new InstancedTexturePositionsGrassShader_1.InstancedTexturePositionsGrassShader(this.gl);
        this.shaderInstancedTexturePositionsGrassAt = new InstancedTexturePositionsGrassAtShader_1.InstancedTexturePositionsGrassAtShader(this.gl);
        this.shaderInstancedTexturePositionsGrassAnimated = new InstancedTexturePositionsGrassAnimatedShader_1.InstancedTexturePositionsGrassAnimatedShader(this.gl);
        this.shaderAnts = new AntsShader_1.AntsShader(this.gl);
        this.shaderButterfly = new ButterflyShader_1.ButterflyShader(this.gl);
        this.shaderDiffuse = new webgl_framework_1.DiffuseShader(this.gl);
        this.shaderDiffuseAnimatedTexture = new DiffuseAnimatedTextureShader_1.DiffuseAnimatedTextureShader(this.gl);
        this.shaderDiffuseAnimatedTextureChunked = new DiffuseAnimatedTextureChunkedShader_1.DiffuseAnimatedTextureChunkedShader(this.gl);
        this.shaderDiffuseColored = new DiffuseColoredShader_1.DiffuseColoredShader(this.gl);
        this.shaderDiffuseColoredVertexAlpha = new DiffuseColoredVertexAlphaShader_1.DiffuseColoredVertexAlphaShader(this.gl);
    }
    async loadFloatingPointTexture(url, gl, width, height, minFilter = gl.LINEAR, magFilter = gl.LINEAR, clamp = false, numberOfComponents = 3) {
        const texture = gl.createTexture();
        if (texture === null) {
            throw new Error("Error creating WebGL texture");
        }
        let internalFormat = gl.RGB16F;
        let format = gl.RGB;
        if (numberOfComponents === 2) {
            internalFormat = gl.RG16F;
            format = gl.RG;
        }
        else if (numberOfComponents === 1) {
            internalFormat = gl.R16F;
            format = gl.RED;
        }
        else if (numberOfComponents === 4) {
            internalFormat = gl.RGBA16F;
            format = gl.RGBA;
        }
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const dataView = new Uint16Array(data);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        this.checkGlError("loadFloatingPointTexture 0");
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.HALF_FLOAT, dataView);
        this.checkGlError("loadFloatingPointTexture 1");
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        if (clamp === true) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }
        this.checkGlError("loadFloatingPointTexture 2");
        gl.bindTexture(gl.TEXTURE_2D, null);
        console.log(`Loaded texture ${url} [${width}x${height}]`);
        return texture;
    }
    loadFp32Texture(data, gl, width, height, minFilter = gl.LINEAR, magFilter = gl.LINEAR, clamp = false, numberOfComponents = 3) {
        const texture = gl.createTexture();
        if (texture === null) {
            throw new Error("Error creating WebGL texture");
        }
        let internalFormat = gl.RGB32F;
        let format = gl.RGB;
        if (numberOfComponents === 2) {
            internalFormat = gl.RG32F;
            format = gl.RG;
        }
        else if (numberOfComponents === 1) {
            internalFormat = gl.R32F;
            format = gl.RED;
        }
        else if (numberOfComponents === 4) {
            internalFormat = gl.RGBA32F;
            format = gl.RGBA;
        }
        const dataView = new Float32Array(data);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        this.checkGlError("loadFp32Texture 0");
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.FLOAT, dataView);
        this.checkGlError("loadFp32Texture 1");
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
        if (clamp === true) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        }
        this.checkGlError("loadFp32Texture 2");
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
    async loadData() {
        var _a;
        const preset = this.PRESETS[this.currentPreset];
        await Promise.all([
            this.fmSky.load("data/models/sky-half", this.gl),
            this.fmGrassPatch.load("data/models/grass_twosided2", this.gl),
            this.fmDust.load("data/models/particles_20", this.gl),
            this.fmDandelion0Leaves.load("data/models/dandelion0_leaves", this.gl),
            this.fmDandelion0Stem.load("data/models/dandelion0_stem", this.gl),
            this.fmDandelion0Petals.load("data/models/dandelion0_petals", this.gl),
            this.fmAnt.load("data/models/ant", this.gl),
            this.fmGroundFading.load("data/models/ground-vntao", this.gl),
            this.fmSphere.load("data/models/sphere10", this.gl),
            this.fmRoundGrass.load("data/models/small-grass2", this.gl),
            this.fmButterfly.load("data/models/butterfly", this.gl)
        ]);
        [
            this.textureDandelionStem,
            this.textureDandelionLeavesDiffuse,
            this.textureDandelionPetals,
            this.textureGround,
            this.textureRoundGrass,
            this.textureWhite,
            this.textureAnt,
            this.textureButterfly,
            this.textureGrass1Positions,
            this.textureGrass2Positions,
            this.textureFlowersPositions,
            this.textureSky,
            this.textureGrass
        ] = await Promise.all([
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/stem.webp", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/leaves.webp", this.gl, undefined, undefined, false),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/petal.webp", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/ground.webp", this.gl, undefined, undefined, false),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/round-grass2.webp", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/white.webp", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/ant.webp", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/butterfly-all.webp", this.gl, undefined, undefined, true),
            this.loadFp32Texture(GrassPositions_1.TILES_GRASS1.textureData, this.gl, this.GRASS1_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            this.loadFp32Texture(GrassPositions_1.TILES_GRASS2.textureData, this.gl, this.GRASS2_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            this.loadFp32Texture(GrassPositions_1.TILES_FLOWERS.textureData, this.gl, this.FLOWERS_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            webgl_framework_1.UncompressedTextureLoader.load(`data/textures/${preset.skyTexture}`, this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load(this.noTextures ? "data/textures/white.webp" : "data/textures/grass.webp", this.gl, undefined, undefined, false),
        ]);
        this.generateMipmaps(this.textureDandelionStem, this.textureDandelionLeavesDiffuse, this.textureDandelionPetals, this.textureGround, this.textureRoundGrass);
        this.loaded = true;
        console.log("Loaded all assets");
        (_a = this.readyCallback) === null || _a === void 0 ? void 0 : _a.call(this);
    }
    animate() {
        const timeNow = new Date().getTime();
        if (this.lastTime != 0) {
            const elapsed = timeNow - this.lastTime;
            this.angleYaw += elapsed / YAW_COEFF_NORMAL;
            this.angleYaw %= 360.0;
            this.timerAnts = (timeNow % this.ANTS_PERIOD) / this.ANTS_PERIOD;
            this.timerGrassWind = (timeNow % this.WIND_PERIOD) / this.WIND_PERIOD;
            this.timerButterfly = (timeNow % this.BUTTERFLY_PERIOD) / this.BUTTERFLY_PERIOD;
            this.timerButterflyAnimation = (timeNow % this.BUTTERFLY_ANIMATION_PERIOD) / this.BUTTERFLY_ANIMATION_PERIOD;
            this.cameraPositionInterpolator.iterate(timeNow);
            if (this.useRandomCamera) {
                if (this.cameraMode === CameraMode_1.CameraMode.Random && this.customCamera === undefined && this.cameraPositionInterpolator.timer === 1.0) {
                    this.randomizeCamera();
                }
            }
            else {
                if (this.cameraPositionInterpolator.timer === 1.0) {
                    this.cameraPositionInterpolator.reset();
                }
            }
        }
        this.lastTime = timeNow;
    }
    /** Calculates projection matrix */
    setCameraFOV(multiplier) {
        var ratio;
        if (this.gl.canvas.height > 0) {
            ratio = this.gl.canvas.width / this.gl.canvas.height;
        }
        else {
            ratio = 1.0;
        }
        let fov = 0;
        if (this.gl.canvas.width >= this.gl.canvas.height) {
            fov = FOV_LANDSCAPE * multiplier;
        }
        else {
            fov = FOV_PORTRAIT * multiplier;
        }
        this.setFOV(this.mProjMatrix, fov, ratio, this.Z_NEAR, this.Z_FAR);
    }
    /**
     * Calculates camera matrix.
     *
     * @param a Position in [0...1] range
     */
    positionCamera(a) {
        if (this.customCamera !== undefined) {
            this.mVMatrix = this.customCamera;
            return;
        }
        if (this.cameraMode === CameraMode_1.CameraMode.Random) {
            this.mVMatrix = this.cameraPositionInterpolator.matrix;
            this.cameraPosition[0] = this.cameraPositionInterpolator.cameraPosition[0];
            this.cameraPosition[1] = this.cameraPositionInterpolator.cameraPosition[1];
            this.cameraPosition[2] = this.cameraPositionInterpolator.cameraPosition[2];
        }
        else {
            const a = this.angleYaw / 360 * Math.PI * 2;
            const sina = Math.sin(a);
            const cosa = Math.cos(a);
            const cosa2 = Math.cos(a * 2);
            this.cameraPosition[0] = sina * 77 + 29;
            this.cameraPosition[1] = cosa * 77 - 11;
            this.cameraPosition[2] = 40 + cosa2 * 20;
            gl_matrix_1.mat4.lookAt(this.mVMatrix, this.cameraPosition, // eye
            [29, -11, 20], // center
            [0, 0, 1] // up vector
            );
        }
    }
    /** Issues actual draw calls */
    drawScene() {
        if (!this.loaded) {
            return;
        }
        this.positionCamera(0.0);
        this.setCameraFOV(1.0);
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.positionCamera(0.0);
        this.setCameraFOV(1.0);
        this.gl.colorMask(true, true, true, true);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // This differs from OpenGL ES
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        GrassPositions_1.TILES_FLOWERS.cull(this.bboxVisibility);
        this.drawSceneObjects();
    }
    drawSceneObjects() {
        var _a, _b;
        if (this.shaderDiffuse === undefined
            || this.shaderDiffuseAnimatedTexture === undefined
            || this.shaderDiffuseAnimatedTextureChunked === undefined
            || this.shaderDiffuseColored === undefined
            || this.shaderVertexLit === undefined
            || this.shaderVertexLitInstancedVegetation === undefined
            || this.shaderVertexLitInstancedVegetationFading === undefined
            || this.shaderVertexLitInstancedGrass === undefined
            || this.shaderVertexLitInstancedGrassAnimated === undefined
            || this.shaderVertexLitInstancedGrassAt === undefined
            || this.shaderVertexLitInstancedGrassFading === undefined
            || this.shaderInstancedVegetation === undefined
            || this.shaderGlare === undefined
            || this.shaderDiffuseColoredVertexAlpha === undefined
            || this.shaderInstancedTexturePositionsColored === undefined
            || this.shaderVertexLitInstancedTexturePositions === undefined
            || this.shaderInstancedTexturePositionsGrass === undefined
            || this.shaderInstancedTexturePositionsGrassAt === undefined
            || this.shaderInstancedTexturePositionsGrassAnimated === undefined
            || this.shaderAnts === undefined
            || this.shaderButterfly === undefined) {
            console.log("undefined shaders");
            return;
        }
        const preset = this.PRESETS[this.currentPreset];
        this.gl.cullFace(this.gl.BACK);
        this.gl.disable(this.gl.BLEND);
        if (this.drawInsects) {
            this.drawButterflies();
        }
        this.drawGrass(this.grassDensity);
        if (this.drawInsects) {
            this.drawAnts();
        }
        this.shaderDiffuse.use();
        this.drawSkyObject();
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.shaderDiffuseColoredVertexAlpha.use();
        this.setTexture2D(0, this.textureGround, this.shaderDiffuseColoredVertexAlpha.sTexture);
        (_a = this.shaderDiffuseColoredVertexAlpha) === null || _a === void 0 ? void 0 : _a.setColor(preset.groundColor[0] * preset.groundColorBrightness, preset.groundColor[1] * preset.groundColorBrightness, preset.groundColor[2] * preset.groundColorBrightness, 1);
        this.shaderDiffuseColoredVertexAlpha.drawModel(this, this.fmGroundFading, 0, 0, 0, 0, 0, 0, 1.05, 1.05, 1.05);
        if (!(this.noGlare || preset.noGlare)) {
            this.gl.depthMask(false);
            this.gl.cullFace(this.gl.FRONT);
            this.gl.disable(this.gl.DEPTH_TEST);
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
            (_b = this.shaderGlare) === null || _b === void 0 ? void 0 : _b.use();
            this.gl.uniform4f(this.shaderGlare.lightDir, preset.lightDir[0], preset.lightDir[1], preset.lightDir[2], 0);
            this.gl.uniform1f(this.shaderGlare.glareExponent, preset.glareExponent);
            this.gl.uniform4f(this.shaderGlare.glareColor, preset.glareColor[0] * preset.glareBrightness, preset.glareColor[1] * preset.glareBrightness, preset.glareColor[2] * preset.glareBrightness, 1);
            this.shaderGlare.drawModel(this, this.fmSphere, 0, 0, 0, 0, 0, 0, 32, 32, 32);
        }
        this.gl.depthMask(true);
        this.gl.cullFace(this.gl.BACK);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.disable(this.gl.BLEND);
    }
    drawButterflies() {
        if (this.shaderButterfly === undefined) {
            console.log("undefined shaders");
            return;
        }
        const preset = this.PRESETS[this.currentPreset];
        if (!preset.drawButterflies) {
            return;
        }
        this.gl.disable(this.gl.CULL_FACE);
        this.shaderButterfly.use();
        this.gl.uniform2f(this.shaderButterfly.uSpread, this.BUTTERFLIES_SPREAD / this.BUTTERFLIES_SCALE, this.BUTTERFLIES_SPREAD / this.BUTTERFLIES_SCALE);
        this.gl.uniform2f(this.shaderButterfly.uRadius, this.BUTTERFLIES_RADIUS[0] / this.BUTTERFLIES_SCALE, this.BUTTERFLIES_RADIUS[1] / this.BUTTERFLIES_SCALE);
        this.gl.uniform4f(this.shaderButterfly.uButterflyParams, this.BUTTERFLIES_SIZE_X, this.BUTTERFLIES_ANIMATION_AMPLITUDE, this.BUTTERFLIES_FLIGHT_Z_AMPLITUDE, 0.25);
        this.setTexture2D(0, this.textureButterfly, this.shaderButterfly.sTexture);
        this.gl.uniform1f(this.shaderButterfly.uAnimationTime, Math.PI * 2 * this.timerButterflyAnimation);
        this.gl.uniform1f(this.shaderButterfly.uTime, Math.PI * 2 * this.timerButterfly);
        this.gl.uniform1f(this.shaderButterfly.uRotation, -1.57079632679);
        this.shaderButterfly.drawInstanced(this, this.fmButterfly, -5, 0, 40, 0, 0, 0, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_COUNT);
        this.gl.uniform1f(this.shaderButterfly.uTime, Math.PI * 2 * (1.0 - this.timerButterfly));
        this.gl.uniform1f(this.shaderButterfly.uRotation, 1.57079632679);
        this.shaderButterfly.drawInstanced(this, this.fmButterfly, 0, 5, 50, 0, 0, 0, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_SCALE, this.BUTTERFLIES_COUNT);
        this.gl.enable(this.gl.CULL_FACE);
    }
    drawAnts() {
        var _a;
        if (this.shaderAnts === undefined) {
            console.log("undefined shaders");
            return;
        }
        const preset = this.PRESETS[this.currentPreset];
        if (!preset.drawAnts) {
            return;
        }
        (_a = this.shaderAnts) === null || _a === void 0 ? void 0 : _a.use();
        this.setTexture2D(1, this.textureAnt, this.shaderAnts.sTexture);
        this.gl.uniform2f(this.shaderAnts.uSpread, this.ANTS_SPREAD / this.ANTS_SCALE, this.ANTS_SPREAD / this.ANTS_SCALE);
        this.gl.uniform2f(this.shaderAnts.uRadius, this.ANTS_RADIUS[0] / this.ANTS_SCALE, this.ANTS_RADIUS[1] / this.ANTS_SCALE);
        this.shaderAnts.setColor(preset.antsColor[0] * preset.antsColorBrightness, preset.antsColor[1] * preset.antsColorBrightness, preset.antsColor[2] * preset.antsColorBrightness, 1);
        this.gl.uniform1f(this.shaderAnts.uTime, Math.PI * 2 * this.timerAnts);
        this.gl.uniform1f(this.shaderAnts.uRotation, -1.57079632679);
        this.shaderAnts.drawInstanced(this, this.fmAnt, 0, 0, 0.1, 0, 0, 0, this.ANTS_SCALE, this.ANTS_SCALE, this.ANTS_SCALE, this.ANTS_COUNT);
        this.gl.uniform1f(this.shaderAnts.uTime, Math.PI * 2 * (1.0 - this.timerAnts));
        this.gl.uniform1f(this.shaderAnts.uRotation, 1.57079632679);
        this.shaderAnts.drawInstanced(this, this.fmAnt, 0, 0, 0.1, 0, 0, 0, this.ANTS_SCALE, this.ANTS_SCALE, this.ANTS_SCALE, this.ANTS_COUNT);
    }
    drawGrass(density) {
        var _a;
        if (this.shaderInstancedTexturePositionsColored === undefined
            || this.shaderInstancedTexturePositionsGrass === undefined
            || this.shaderInstancedTexturePositionsGrassAt === undefined
            || this.shaderInstancedTexturePositionsGrassAnimated === undefined) {
            console.log("undefined shaders");
            return;
        }
        const preset = this.PRESETS[this.currentPreset];
        this.gl.disable(this.gl.CULL_FACE);
        (_a = this.shaderInstancedTexturePositionsColored) === null || _a === void 0 ? void 0 : _a.use();
        this.setTexture2D(0, this.textureFlowersPositions, this.shaderInstancedTexturePositionsColored.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureDandelionPetals, this.shaderInstancedTexturePositionsColored.sTexture);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsColored.color, preset.flowerColor[0] * preset.flowerColorBrightness, preset.flowerColor[1] * preset.flowerColorBrightness, preset.flowerColor[2] * preset.flowerColorBrightness, 1);
        this.gl.uniform2fv(this.shaderInstancedTexturePositionsColored.uScale, this.FLOWERS_SCALE);
        GrassPositions_1.TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsColored, this.fmDandelion0Petals, this, 1.0);
        this.gl.enable(this.gl.CULL_FACE); // FIXME
        this.gl.cullFace(this.gl.BACK);
        this.setTexture2D(0, this.textureGrass2Positions, this.shaderInstancedTexturePositionsColored.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureRoundGrass, this.shaderInstancedTexturePositionsColored.sTexture);
        this.gl.uniform2fv(this.shaderInstancedTexturePositionsColored.uScale, this.ROUND_GRASS_SCALE);
        GrassPositions_1.TILES_GRASS2.drawTiles(this.shaderInstancedTexturePositionsColored, this.fmRoundGrass, this, density);
        this.shaderInstancedTexturePositionsGrassAnimated.use();
        this.setTexture2D(0, this.textureGrass1Positions, this.shaderInstancedTexturePositionsGrassAnimated.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureGrass, this.shaderInstancedTexturePositionsGrassAnimated.sTexture);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAnimated.lightDir, preset.lightDir[0], preset.lightDir[1], preset.lightDir[2], 0);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.diffuseCoef, preset.diffuseCoeff);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.diffuseExponent, 1.0);
        this.gl.uniform2f(this.shaderInstancedTexturePositionsGrassAnimated.uScale, 0.9 / this.GRASS_PATCH_SCALE, 0.8 / this.GRASS_PATCH_SCALE);
        this.gl.uniform2f(this.shaderInstancedTexturePositionsGrassAnimated.uTime, Math.sin(this.timerGrassWind * Math.PI * 2), Math.cos(this.timerGrassWind * Math.PI * 2));
        this.gl.uniform3f(this.shaderInstancedTexturePositionsGrassAnimated.viewPos, this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAnimated.uSpecularColor, preset.grassSpecularColor[0] * preset.grassSpecularColorBrightness, preset.grassSpecularColor[1] * preset.grassSpecularColorBrightness, preset.grassSpecularColor[2] * preset.grassSpecularColorBrightness, 1);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.uSpecularPower, preset.grassSpecularPower);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.uSpecularStrength, preset.grassSpecularStrength);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAnimated.ambient, preset.lightAmbientGrass[0] * preset.lightAmbientGrassBrightness, preset.lightAmbientGrass[1] * preset.lightAmbientGrassBrightness, preset.lightAmbientGrass[2] * preset.lightAmbientGrassBrightness, 0);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAnimated.diffuse, preset.lightDiffuseGrass[0] * preset.lightDiffuseGrassBrightness, preset.lightDiffuseGrass[1] * preset.lightDiffuseGrassBrightness, preset.lightDiffuseGrass[2] * preset.lightDiffuseGrassBrightness, 0);
        // wind params
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.stiffness, this.WIND_STIFFNESS);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.heightCoeff, this.WIND_HEIGHT_COEFF / this.GRASS_PATCH_SCALE);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAnimated.windOffset, this.WIND_OFFSET);
        // end wind params
        GrassPositions_1.TILES_GRASS1.drawTiles(this.shaderInstancedTexturePositionsGrassAnimated, this.fmGrassPatch, this, density);
        this.shaderInstancedTexturePositionsGrass.use();
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrass.lightDir, -preset.lightDir[0], -preset.lightDir[1], -preset.lightDir[2], 0);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrass.diffuseCoef, preset.diffuseCoeff);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrass.diffuseExponent, 1.0);
        this.gl.uniform3f(this.shaderInstancedTexturePositionsGrass.viewPos, this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]);
        this.setTexture2D(0, this.textureFlowersPositions, this.shaderInstancedTexturePositionsGrass.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureDandelionStem, this.shaderInstancedTexturePositionsGrass.sTexture);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrass.ambient, preset.lightAmbient[0] * preset.lightAmbientBrightness, preset.lightAmbient[1] * preset.lightAmbientBrightness, preset.lightAmbient[2] * preset.lightAmbientBrightness, 0);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrass.diffuse, preset.lightDiffuse[0] * preset.lightDiffuseBrightness, preset.lightDiffuse[1] * preset.lightDiffuseBrightness, preset.lightDiffuse[2] * preset.lightDiffuseBrightness, 0);
        this.gl.uniform2fv(this.shaderInstancedTexturePositionsGrass.uScale, this.FLOWERS_SCALE);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrass.uSpecularColor, preset.stemSpecularColor[0] * preset.stemSpecularColorBrightness, preset.stemSpecularColor[1] * preset.stemSpecularColorBrightness, preset.stemSpecularColor[2] * preset.stemSpecularColorBrightness, 1);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrass.uSpecularPower, preset.stemSpecularPower);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrass.uSpecularStrength, preset.stemSpecularStrength);
        GrassPositions_1.TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsGrass, this.fmDandelion0Stem, this, 1.0);
        this.shaderInstancedTexturePositionsGrassAt.use();
        this.setTexture2D(0, this.textureFlowersPositions, this.shaderInstancedTexturePositionsGrassAt.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureDandelionLeavesDiffuse, this.shaderInstancedTexturePositionsGrassAt.sTexture);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAt.lightDir, preset.lightDir[0], preset.lightDir[1], preset.lightDir[2], 0);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAt.ambient, preset.lightAmbient[0] * preset.lightAmbientBrightness, preset.lightAmbient[1] * preset.lightAmbientBrightness, preset.lightAmbient[2] * preset.lightAmbientBrightness, 0);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAt.diffuse, preset.lightDiffuse[0] * preset.lightDiffuseBrightness, preset.lightDiffuse[1] * preset.lightDiffuseBrightness, preset.lightDiffuse[2] * preset.lightDiffuseBrightness, 0);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAt.diffuseCoef, preset.diffuseCoeff);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAt.diffuseExponent, 1.0);
        this.gl.uniform2fv(this.shaderInstancedTexturePositionsGrassAt.uScale, this.FLOWERS_SCALE);
        this.gl.uniform3f(this.shaderInstancedTexturePositionsGrassAt.viewPos, this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]);
        this.gl.uniform4f(this.shaderInstancedTexturePositionsGrassAt.uSpecularColor, preset.leavesSpecularColor[0] * preset.leavesSpecularColorBrightness, preset.leavesSpecularColor[1] * preset.leavesSpecularColorBrightness, preset.leavesSpecularColor[2] * preset.leavesSpecularColorBrightness, 1);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAt.uSpecularPower, preset.leavesSpecularPower);
        this.gl.uniform1f(this.shaderInstancedTexturePositionsGrassAt.uSpecularStrength, preset.leavesSpecularStrength);
        GrassPositions_1.TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsGrassAt, this.fmDandelion0Leaves, this, 1.0);
        this.visibleTiles = 0;
        this.visibleGrassInstances = 0;
        for (let i = 0; i < GrassPositions_1.CULLED_TILES.length; i++) {
            const culled = GrassPositions_1.CULLED_TILES[i];
            this.visibleTiles += culled ? 0 : 1;
            if (!culled) {
                this.visibleGrassInstances += GrassPositions_1.TILES_FLOWERS.tiles[i].instancesCount * 3;
                this.visibleGrassInstances += Math.round(GrassPositions_1.TILES_GRASS1.tiles[i].instancesCount * density);
                this.visibleGrassInstances += Math.round(GrassPositions_1.TILES_GRASS2.tiles[i].instancesCount * density);
            }
        }
    }
    drawSkyObject() {
        var _a;
        if (this.shaderDiffuseColored === undefined) {
            return;
        }
        const preset = this.PRESETS[this.currentPreset];
        this.shaderDiffuseColored.use();
        (_a = this.shaderDiffuseColored) === null || _a === void 0 ? void 0 : _a.setColor(preset.skyColor[0] * preset.skyColorBrightness, preset.skyColor[1] * preset.skyColorBrightness, preset.skyColor[2] * preset.skyColorBrightness, 1);
        this.setTexture2D(0, this.textureSky, this.shaderDiffuseColored.sTexture);
        this.shaderDiffuseColored.drawModel(this, this.fmSky, 0, 0, 0, 0, 0, 0, 3, 3, 3);
    }
    randomizeCamera() {
        this.currentRandomCamera = (this.currentRandomCamera + 1 + Math.trunc(Math.random() * (this.CAMERAS.length - 2))) % this.CAMERAS.length;
        // this.currentRandomCamera++;
        // this.currentRandomCamera %= this.CAMERAS.length;
        // this.currentRandomCamera = 0; // TEST CAMERA
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED * this.CAMERAS[this.currentRandomCamera].speedMultiplier;
        this.cameraPositionInterpolator.position = this.CAMERAS[this.currentRandomCamera];
        this.cameraPositionInterpolator.reset();
    }
    iterateCamera() {
        if (this.useRandomCamera) {
            this.nextCamera(0);
        }
        this.useRandomCamera = false;
        this.nextCamera();
    }
    nextCamera(index) {
        if (index !== undefined) {
            this.currentRandomCamera = index;
        }
        else {
            this.currentRandomCamera++;
            this.currentRandomCamera %= this.CAMERAS.length;
        }
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED * this.CAMERAS[this.currentRandomCamera].speedMultiplier;
        this.cameraPositionInterpolator.position = this.CAMERAS[this.currentRandomCamera];
        this.cameraPositionInterpolator.reset();
    }
    checkGlError(operation) {
        // Do nothing in production build.
    }
    set density(value) {
        this.grassDensity = value;
    }
    set timeOfDay(value) {
        this.currentPreset = this.PRESETS.findIndex(p => p.name === value);
        (async () => {
            const preset = this.PRESETS[this.currentPreset];
            const textureSky = await webgl_framework_1.UncompressedTextureLoader.load(`data/textures/${preset.skyTexture}`, this.gl, undefined, undefined, true);
            this.gl.deleteTexture(this.textureSky);
            this.textureSky = textureSky;
        })();
    }
    set glare(value) {
        this.noGlare = !value;
    }
    set insects(value) {
        this.drawInsects = value;
    }
    get tiles() {
        return this.visibleTiles;
    }
    get grassInstances() {
        return this.visibleGrassInstances;
    }
    set ready(callback) {
        this.readyCallback = callback;
    }
}
exports.Renderer = Renderer;
//# sourceMappingURL=Renderer.js.map