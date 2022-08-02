import { FullModel } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";
import { BoundingBox, BoundingBoxVisibility } from "./BoundingBoxVisibility";
import { InstancedTexturePositionsShader } from "./shaders/InstancedTexturePositionsShader";
/** Data for instances within certain tile. */
export interface Tile {
    /** Bounding box without padding. */
    boundingBoxInternal: BoundingBox;
    /** Bounding box with padding for culling. */
    boundingBox: BoundingBox;
    /** Offset in texture. */
    instancesOffset: number;
    /** Instances count. */
    instancesCount: number;
}
/** Tiles with texture data. */
export declare class TiledInstances {
    /** Texture data. */
    textureData: Float32Array;
    /** Tiles. */
    tiles: Tile[];
    /** Array with culled status for each tile. */
    protected culledTiles: boolean[];
    constructor(textureData: Float32Array, tiles: Tile[], culledTiles: boolean[]);
    cull(bboxVisibility: BoundingBoxVisibility): void;
    drawTiles(shader: InstancedTexturePositionsShader, model: FullModel, renderer: RendererWithExposedMethods, density?: number): void;
}
export declare function sortInstancesByTiles(texture: Float32Array, tesselation: number, size: number, padding: {
    x: number;
    y: number;
    z: number;
}, culledTiles: boolean[]): TiledInstances;
export declare function printFloat32Array(arr: Float32Array): void;
export declare function printTiledInstances(obj: TiledInstances): void;
