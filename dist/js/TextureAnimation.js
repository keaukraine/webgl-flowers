"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextureAnimation = void 0;
class TextureAnimation {
    constructor(vertices, frames) {
        this.m_frames = 0;
        this.m_vertices = 0;
        this.m_texelHalfWidth = 0;
        this.m_texelHalfHeight = 0;
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
    animateStartEndStart(timer) {
        const coeff = timer < 0.5
            ? timer * 2
            : (1 - timer) * 2;
        const y = coeff * ((this.frames - 1) / this.frames) + this.m_texelHalfHeight;
        return y;
    }
    animateStartToEnd(timer) {
        return timer;
    }
}
exports.TextureAnimation = TextureAnimation;
//# sourceMappingURL=TextureAnimation.js.map