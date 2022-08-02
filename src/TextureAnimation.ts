import { DiffuseShader } from "webgl-framework";
import { RendererWithExposedMethods } from "webgl-framework/dist/types/RendererWithExposedMethods";

export class TextureAnimation {
    private m_frames = 0;
    private m_vertices = 0;
    private m_texelHalfWidth = 0;
    private m_texelHalfHeight = 0;

    constructor(vertices: number, frames: number) {
        this.m_vertices = vertices;
        this.m_frames = frames;
        this.m_texelHalfWidth = 1.0 / vertices * 0.5;
        this.m_texelHalfHeight = 1.0 / this.frames * 0.5;
    }

    get vertices() {
        return this.m_vertices;
    }

    get frames() {
        return this.m_frames;
    }

    get texelHalfWidth() {
        return this.m_texelHalfWidth;
    }

    get texelHalfHeight() {
        return this.m_texelHalfHeight;
    }

    public animateStartEndStart(timer: number): number {
        const coeff = timer < 0.5
            ? timer * 2
            : (1 - timer) * 2;

        const y = coeff * ((this.frames - 1) / this.frames) + this.m_texelHalfHeight;

        return y;
    }

    public animateStartToEnd(timer: number): number {
        return timer;
    }
}
