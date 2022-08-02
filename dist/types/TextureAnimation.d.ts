export declare class TextureAnimation {
    private m_frames;
    private m_vertices;
    private m_texelHalfWidth;
    private m_texelHalfHeight;
    constructor(vertices: number, frames: number);
    get vertices(): number;
    get frames(): number;
    get texelHalfWidth(): number;
    get texelHalfHeight(): number;
    animateStartEndStart(timer: number): number;
    animateStartToEnd(timer: number): number;
}
