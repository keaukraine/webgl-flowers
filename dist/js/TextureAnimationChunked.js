"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextureAnimationChunked = void 0;
class TextureAnimationChunked {
    constructor(textureWidth, vertices, frames) {
        this.m_frames = 0;
        this.m_vertices = 0;
        this.m_texelHalfWidth = 0;
        this.m_texelHalfHeight = 0;
        this.m_texelHeight = 0;
        this.m_textureWidth = 0;
        this.m_textureHeight = 0;
        this.m_chunkSize = 0;
        this.m_textureWidth = textureWidth;
        this.m_vertices = vertices;
        this.m_frames = frames;
        this.m_textureHeight = Math.ceil(vertices / textureWidth) * (frames + 1);
        this.m_texelHalfWidth = 1.0 / textureWidth * 0.5;
        this.m_texelHalfHeight = 1.0 / this.m_textureHeight * 0.5;
        this.m_texelHeight = 1.0 / this.m_textureHeight;
        this.m_chunkSize = 1.0 / Math.ceil(vertices / textureWidth);
    }
    get chunkSize() {
        return this.m_chunkSize;
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
    get textureWidth() {
        return this.m_textureWidth;
    }
    get textureHeight() {
        return this.m_textureHeight;
    }
    animateStartEndStart(timer) {
        const coeff = timer < 0.5
            ? timer * 2
            : (1 - timer) * 2;
        const y = this.m_texelHeight * coeff * (this.frames - 1) + this.m_texelHalfHeight;
        return y;
    }
    animateStartToEnd(timer) {
        return timer;
    }
}
exports.TextureAnimationChunked = TextureAnimationChunked;
//# sourceMappingURL=TextureAnimationChunked.js.map