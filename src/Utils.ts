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
export class TiledInstances {
    /** Texture data. */
    public textureData: Float32Array;

    /** Tiles. */
    public tiles: Tile[];

    /** Array with culled status for each tile. */
    protected culledTiles: boolean[];

    constructor(textureData: Float32Array, tiles: Tile[], culledTiles: boolean[]) {
        this.textureData = textureData;
        this.tiles = tiles;
        this.culledTiles = culledTiles;
    }

    public cull(bboxVisibility: BoundingBoxVisibility): void {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            this.culledTiles[i] = bboxVisibility.isModelCulled(tile.boundingBox);
        }
    }

    public drawTiles(
        shader: InstancedTexturePositionsShader,
        model: FullModel,
        renderer: RendererWithExposedMethods,
        density = 1
    ): void {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            const count = Math.round(tile.instancesCount * density);
            if (count === 0) {
                continue;
            }
            if (!this.culledTiles[i]) {
                shader.drawInstanced(
                    renderer, model,
                    0, 0, 0, 0, 0, 0, 1, 1, 1,
                    tile.instancesOffset, count
                );
            }
        }
    }
}

export function sortInstancesByTiles(
    texture: Float32Array,
    tesselation: number,
    size: number,
    padding: { x: number, y: number, z: number },
    culledTiles: boolean[]
): TiledInstances {
    const textureData = new Float32Array(texture.length);
    const tiles = new Array<Tile>(tesselation * tesselation);
    let tilesCounter = 0;
    let textureCursor = 0;
    const tileSize = size / tesselation;
    const halfSize = size / 2;
    const textureWidth = textureData.length / 3 / 2;

    for (let tileX = 0; tileX < tesselation; tileX++) {
        for (let tileY = 0; tileY < tesselation; tileY++) {
            const instancesOffset = textureCursor;
            let instancesCount = 0;

            const boundingBoxInternal: BoundingBox = {
                min: { x: tileX * tileSize - halfSize, y: tileY * tileSize - halfSize, z: 0 },
                max: { x: tileX * tileSize + tileSize - halfSize, y: tileY * tileSize + tileSize - halfSize, z: 0 }
            };
            const boundingBox: BoundingBox = {
                min: {
                    x: boundingBoxInternal.min.x - padding.x,
                    y: boundingBoxInternal.min.y - padding.x,
                    z: 0
                },
                max: {
                    x: boundingBoxInternal.max.x + padding.x,
                    y: boundingBoxInternal.max.y + padding.x,
                    z: padding.z
                },
            };

            for (let i = 0; i < textureWidth; i++) {
                const x = texture[i * 3 + 0];
                const y = texture[i * 3 + 1];
                if (x > boundingBoxInternal.min.x && x < boundingBoxInternal.max.x && y > boundingBoxInternal.min.y && y < boundingBoxInternal.max.y) {
                    textureData[textureCursor * 3 + 0] = x;
                    textureData[textureCursor * 3 + 1] = y;
                    textureData[textureCursor * 3 + 2] = texture[i * 3 + 2];

                    textureData[textureCursor * 3 + 0 + textureWidth * 3] = texture[i * 3 + 0 + textureWidth * 3];
                    textureData[textureCursor * 3 + 1 + textureWidth * 3] = texture[i * 3 + 1 + textureWidth * 3];
                    textureData[textureCursor * 3 + 2 + textureWidth * 3] = texture[i * 3 + 2 + textureWidth * 3];

                    textureCursor++;
                    instancesCount++;
                }
            }

            tiles[tilesCounter++] = {
                boundingBoxInternal,
                boundingBox,
                instancesOffset,
                instancesCount
            };
        }
    }

    return new TiledInstances(textureData, tiles, culledTiles);
}

export function printFloat32Array(arr: Float32Array) {
    let str = "";

    str += `FloatBuffer.wrap(new float[]{\n`;
    for (let i = 0; i < arr.length; i += 3) {
        str += `${arr[i + 0]}f, ${arr[i + 1]}f, ${arr[i + 2]}f,\n`;
    }
    str += `});\n`;

    console.log(str);
}


export function printTiledInstances(obj: TiledInstances) {
    let str = "";

    str += `new Tile[]{\n`;
    for (const tile of obj.tiles) {
        str += `            new Tile(){{
            boundingBox = new BoundingBox(
                    new Point3D(${tile.boundingBox.min.x}f, ${tile.boundingBox.min.y}f, ${tile.boundingBox.min.z}f),
                    new Point3D(${tile.boundingBox.max.x}f, ${tile.boundingBox.max.y}f, ${tile.boundingBox.max.z}f)
            );
            instancesOffset = ${tile.instancesOffset};
            instancesCount = ${tile.instancesCount};
        }},
`;
    }
    str += `};\n`;

    console.log(str);
}
