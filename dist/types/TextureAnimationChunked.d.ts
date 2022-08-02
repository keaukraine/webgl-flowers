export declare class TextureAnimationChunked {
    private m_frames;
    private m_vertices;
    private m_texelHalfWidth;
    private m_texelHalfHeight;
    private m_texelHeight;
    private m_textureWidth;
    private m_textureHeight;
    private m_chunkSize;
    constructor(textureWidth: number, vertices: number, frames: number);
    get chunkSize(): number;
    get vertices(): number;
    get frames(): number;
    get texelHalfWidth(): number;
    get texelHalfHeight(): number;
    get textureWidth(): number;
    get textureHeight(): number;
    animateStartEndStart(timer: number): number;
    animateStartToEnd(timer: number): number;
}
