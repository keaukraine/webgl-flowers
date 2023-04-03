class FullScreenUtils {
    /** Enters fullscreen. */
    enterFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen({ navigationUI: "hide" });
        }
    }
    /** Exits fullscreen */
    exitFullScreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    /**
     * Adds cross-browser fullscreenchange event
     *
     * @param exitHandler Function to be called on fullscreenchange event
     */
    addFullScreenListener(exitHandler) {
        document.addEventListener("fullscreenchange", exitHandler, false);
    }
    /**
     * Checks fullscreen state.
     *
     * @return `true` if fullscreen is active, `false` if not
     */
    isFullScreen() {
        return !!document.fullscreenElement;
    }
}

class BinaryDataLoader {
    static async load(url) {
        const response = await fetch(url);
        return response.arrayBuffer();
    }
}

class UncompressedTextureLoader {
    static load(url, gl, minFilter = gl.LINEAR, magFilter = gl.LINEAR, clamp = false) {
        return new Promise((resolve, reject) => {
            const texture = gl.createTexture();
            if (texture === null) {
                reject("Error creating WebGL texture");
                return;
            }
            const image = new Image();
            image.src = url;
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
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
                gl.bindTexture(gl.TEXTURE_2D, null);
                if (image && image.src) {
                    console.log(`Loaded texture ${url} [${image.width}x${image.height}]`);
                }
                resolve(texture);
            };
            image.onerror = () => reject("Cannot load image");
        });
    }
    static async loadCubemap(url, gl) {
        const texture = gl.createTexture();
        if (texture === null) {
            throw new Error("Error creating WebGL texture");
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        const promises = [
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_X, suffix: "-posx.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, suffix: "-negx.png" },
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, suffix: "-posy.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, suffix: "-negy.png" },
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, suffix: "-posz.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, suffix: "-negz.png" }
        ].map(face => new Promise((resolve, reject) => {
            const image = new Image();
            image.src = url + face.suffix;
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.texImage2D(face.type, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                if (image && image.src) {
                    console.log(`Loaded texture ${url}${face.suffix} [${image.width}x${image.height}]`);
                }
                resolve();
            };
            image.onerror = () => reject("Cannot load image");
        }));
        await Promise.all(promises);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
}

class FullModel {
    /** Default constructor. */
    constructor() {
        /** Number of model indices. */
        this.numIndices = 0;
    }
    loadBuffer(gl, buffer, target, arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer, 0, arrayBuffer.byteLength);
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, byteArray, gl.STATIC_DRAW);
    }
    /**
     * Loads model.
     *
     * @param url Base URL to model indices and strides files.
     * @param gl WebGL context.
     * @returns Promise which resolves when model is loaded.
     */
    async load(url, gl) {
        const [dataIndices, dataStrides] = await Promise.all([
            BinaryDataLoader.load(`${url}-indices.bin`),
            BinaryDataLoader.load(`${url}-strides.bin`)
        ]);
        console.log(`Loaded ${url}-indices.bin (${dataIndices.byteLength} bytes)`);
        console.log(`Loaded ${url}-strides.bin (${dataStrides.byteLength} bytes)`);
        this.bufferIndices = gl.createBuffer();
        this.loadBuffer(gl, this.bufferIndices, gl.ELEMENT_ARRAY_BUFFER, dataIndices);
        this.numIndices = dataIndices.byteLength / 2 / 3;
        this.bufferStrides = gl.createBuffer();
        this.loadBuffer(gl, this.bufferStrides, gl.ARRAY_BUFFER, dataStrides);
    }
    /**
     * Binds buffers for a `glDrawElements()` call.
     *
     * @param gl WebGL context.
     */
    bindBuffers(gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferStrides);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferIndices);
    }
    /**
     * Returns number of indices in model.
     *
     * @return Number of indices
     */
    getNumIndices() {
        return this.numIndices;
    }
}

class BaseShader {
    /**
     * Constructor. Compiles shader.
     *
     * @param gl WebGL context.
     */
    constructor(gl) {
        this.gl = gl;
        this.vertexShaderCode = "";
        this.fragmentShaderCode = "";
        this.fillCode();
        this.initShader();
    }
    /**
     * Creates WebGL shader from code.
     *
     * @param type Shader type.
     * @param code GLSL code.
     * @returns Shader or `undefined` if there were errors during shader compilation.
     */
    getShader(type, code) {
        const shader = this.gl.createShader(type);
        if (!shader) {
            console.warn('Error creating shader.');
            return undefined;
        }
        this.gl.shaderSource(shader, code);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.warn(this.gl.getShaderInfoLog(shader));
            return undefined;
        }
        return shader;
    }
    /**
     * Get shader unform location.
     *
     * @param uniform Uniform name.
     * @return Uniform location.
     */
    getUniform(uniform) {
        if (this.program === undefined) {
            throw new Error('No program for shader.');
        }
        const result = this.gl.getUniformLocation(this.program, uniform);
        if (result !== null) {
            return result;
        }
        else {
            throw new Error(`Cannot get uniform "${uniform}".`);
        }
    }
    /**
     * Get shader attribute location.
     *
     * @param attrib Attribute name.
     * @return Attribute location.
     */
    getAttrib(attrib) {
        if (this.program === undefined) {
            throw new Error("No program for shader.");
        }
        return this.gl.getAttribLocation(this.program, attrib);
    }
    /** Initializes shader. */
    initShader() {
        const fragmentShader = this.getShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderCode);
        const vertexShader = this.getShader(this.gl.VERTEX_SHADER, this.vertexShaderCode);
        const shaderProgram = this.gl.createProgram();
        if (fragmentShader === undefined || vertexShader === undefined || shaderProgram === null) {
            return;
        }
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            console.warn(this.constructor.name + ": Could not initialise shader");
        }
        else {
            console.log(this.constructor.name + ": Initialised shader");
        }
        this.gl.useProgram(shaderProgram);
        this.program = shaderProgram;
        this.fillUniformsAttributes();
    }
    /** Activates shader. */
    use() {
        if (this.program) {
            this.gl.useProgram(this.program);
        }
    }
    /** Deletes shader. */
    deleteProgram() {
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }
    }
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON$1 = 0.000001;
var ARRAY_TYPE$1 = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 3x3 Matrix
 * @module mat3
 */

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */

function create$2$1() {
  var out = new ARRAY_TYPE$1(9);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }

  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}

/**
 * 4x4 Matrix<br>Format: column-major, when typed out it looks like row-major<br>The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */

function create$3() {
  var out = new ARRAY_TYPE$1(16);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }

  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */

function identity$3(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */

function multiply$3(out, a, b) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]; // Cache only the current line of the second matrix

  var b0 = b[0],
      b1 = b[1],
      b2 = b[2],
      b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */

function translate$2(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}
/**
 * Scales the mat4 by the dimensions in the given vec3 not using vectorization
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {ReadonlyVec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/

function scale$3(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */

function rotate$3(out, a, rad, axis) {
  var x = axis[0],
      y = axis[1],
      z = axis[2];
  var len = Math.hypot(x, y, z);
  var s, c, t;
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  var b00, b01, b02;
  var b10, b11, b12;
  var b20, b21, b22;

  if (len < EPSILON$1) {
    return null;
  }

  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11]; // Construct the elements of the rotation matrix

  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c; // Perform rotation-specific matrix multiplication

  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  return out;
}
/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateX$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateY$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateZ$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */

function frustum(out, left, right, bottom, top, near, far) {
  var rl = 1 / (right - left);
  var tb = 1 / (top - bottom);
  var nf = 1 / (near - far);
  out[0] = near * 2 * rl;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = near * 2 * tb;
  out[6] = 0;
  out[7] = 0;
  out[8] = (right + left) * rl;
  out[9] = (top + bottom) * tb;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = far * near * 2 * nf;
  out[15] = 0;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create$4() {
  var out = new ARRAY_TYPE$1(3);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Calculates the length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate length of
 * @returns {Number} length of a
 */

function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */

function fromValues$4(x, y, z) {
  var out = new ARRAY_TYPE$1(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Alias for {@link vec3.length}
 * @function
 */

var len = length;
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$4();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

/**
 * 4 Dimensional Vector
 * @module vec4
 */

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */

function create$5() {
  var out = new ARRAY_TYPE$1(4);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }

  return out;
}
/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to normalize
 * @returns {vec4} out
 */

function normalize$1$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  var len = x * x + y * y + z * z + w * w;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }

  out[0] = x * len;
  out[1] = y * len;
  out[2] = z * len;
  out[3] = w * len;
  return out;
}
/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$5();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 4;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }

    return a;
  };
})();

/**
 * Quaternion
 * @module quat
 */

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */

function create$6() {
  var out = new ARRAY_TYPE$1(4);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  out[3] = 1;
  return out;
}
/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyVec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/

function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

function slerp(out, a, b, t) {
  // benchmarks:
  //    http://jsperf.com/quaternion-slerp-implementations
  var ax = a[0],
      ay = a[1],
      az = a[2],
      aw = a[3];
  var bx = b[0],
      by = b[1],
      bz = b[2],
      bw = b[3];
  var omega, cosom, sinom, scale0, scale1; // calc cosine

  cosom = ax * bx + ay * by + az * bz + aw * bw; // adjust signs (if necessary)

  if (cosom < 0.0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  } // calculate coefficients


  if (1.0 - cosom > EPSILON$1) {
    // standard case (slerp)
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1.0 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    // "from" and "to" quaternions are very close
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t;
    scale1 = t;
  } // calculate final values


  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyMat3} m rotation matrix
 * @returns {quat} out
 * @function
 */

function fromMat3(out, m) {
  // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
  // article "Quaternion Calculus and Fast Animation".
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;

  if (fTrace > 0.0) {
    // |w| > 1/2, may as well choose w > 1/2
    fRoot = Math.sqrt(fTrace + 1.0); // 2w

    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot; // 1/(4w)

    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    // |w| <= 1/2
    var i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }

  return out;
}
/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */

var normalize$2 = normalize$1$1;
/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {ReadonlyVec3} a the initial vector
 * @param {ReadonlyVec3} b the destination vector
 * @returns {quat} out
 */

(function () {
  var tmpvec3 = create$4();
  var xUnitVec3 = fromValues$4(1, 0, 0);
  var yUnitVec3 = fromValues$4(0, 1, 0);
  return function (out, a, b) {
    var dot$$1 = dot(a, b);

    if (dot$$1 < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 0.000001) cross(tmpvec3, yUnitVec3, a);
      normalize$1(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot$$1 > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot$$1;
      return normalize$2(out, out);
    }
  };
})();
/**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {ReadonlyQuat} c the third operand
 * @param {ReadonlyQuat} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

(function () {
  var temp1 = create$6();
  var temp2 = create$6();
  return function (out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
})();
/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {ReadonlyVec3} view  the vector representing the viewing direction
 * @param {ReadonlyVec3} right the vector representing the local "right" direction
 * @param {ReadonlyVec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */

(function () {
  var matr = create$2$1();
  return function (out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize$2(out, fromMat3(out, matr));
  };
})();

/**
 * 2 Dimensional Vector
 * @module vec2
 */

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */

function create$8() {
  var out = new ARRAY_TYPE$1(2);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }

  return out;
}
/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$8();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 2;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }

    return a;
  };
})();

class BaseRenderer {
    constructor() {
        this.mMMatrix = create$3();
        this.mVMatrix = create$3();
        this.mMVPMatrix = create$3();
        this.mProjMatrix = create$3();
        this.matOrtho = create$3();
        this.m_boundTick = this.tick.bind(this);
        this.isWebGL2 = false;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
    }
    /** Getter for current WebGL context. */
    get gl() {
        if (this.m_gl === undefined) {
            throw new Error("No WebGL context");
        }
        return this.m_gl;
    }
    /** Logs last GL error to console */
    logGLError() {
        var err = this.gl.getError();
        if (err !== this.gl.NO_ERROR) {
            console.warn(`WebGL error # + ${err}`);
        }
    }
    /**
     * Binds 2D texture.
     *
     * @param textureUnit A texture unit to use
     * @param texture A texture to be used
     * @param uniform Shader's uniform ID
     */
    setTexture2D(textureUnit, texture, uniform) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(uniform, textureUnit);
    }
    /**
     * Binds cubemap texture.
     *
     * @param textureUnit A texture unit to use
     * @param texture A texture to be used
     * @param uniform Shader's uniform ID
     */
    setTextureCubemap(textureUnit, texture, uniform) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture);
        this.gl.uniform1i(uniform, textureUnit);
    }
    /**
     * Calculates FOV for matrix.
     *
     * @param matrix Output matrix
     * @param fovY Vertical FOV in degrees
     * @param aspect Aspect ratio of viewport
     * @param zNear Near clipping plane distance
     * @param zFar Far clipping plane distance
     */
    setFOV(matrix, fovY, aspect, zNear, zFar) {
        const fH = Math.tan(fovY / 360.0 * Math.PI) * zNear;
        const fW = fH * aspect;
        frustum(matrix, -fW, fW, -fH, fH, zNear, zFar);
    }
    /**
     * Calculates MVP matrix. Saved in this.mMVPMatrix
     */
    calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        identity$3(this.mMMatrix);
        rotate$3(this.mMMatrix, this.mMMatrix, 0, [1, 0, 0]);
        translate$2(this.mMMatrix, this.mMMatrix, [tx, ty, tz]);
        scale$3(this.mMMatrix, this.mMMatrix, [sx, sy, sz]);
        rotateX$1(this.mMMatrix, this.mMMatrix, rx);
        rotateY$1(this.mMMatrix, this.mMMatrix, ry);
        rotateZ$1(this.mMMatrix, this.mMMatrix, rz);
        multiply$3(this.mMVPMatrix, this.mVMatrix, this.mMMatrix);
        multiply$3(this.mMVPMatrix, this.mProjMatrix, this.mMVPMatrix);
    }
    /** Perform each frame's draw calls here. */
    drawScene() {
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    /** Called on each frame. */
    tick() {
        requestAnimationFrame(this.m_boundTick);
        this.resizeCanvas();
        this.drawScene();
        this.animate();
    }
    /**
     * Initializes WebGL context.
     *
     * @param canvas Canvas to initialize WebGL.
     */
    initGL(canvas) {
        const gl = canvas.getContext("webgl", { alpha: false });
        if (gl === null) {
            throw new Error("Cannot initialize WebGL context");
        }
        // this.isETC1Supported = !!gl.getExtension('WEBGL_compressed_texture_etc1');
        return gl;
    }
    ;
    /**
     * Initializes WebGL 2 context
     *
     * @param canvas Canvas to initialize WebGL 2.
     */
    initGL2(canvas) {
        let gl = canvas.getContext("webgl2", { alpha: false });
        if (gl === null) {
            console.warn('Could not initialise WebGL 2, falling back to WebGL 1');
            return this.initGL(canvas);
        }
        return gl;
    }
    ;
    /**
     * Generates mipmasp for textures.
     *
     * @param textures Textures to generate mipmaps for.
     */
    generateMipmaps(...textures) {
        for (const texture of textures) {
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
            this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }
    }
    /**
     * Initializes WebGL and calls all callbacks.
     *
     * @param canvasID ID of canvas element to initialize WebGL.
     * @param requestWebGL2 Set to `true` to initialize WebGL 2 context.
     */
    init(canvasID, requestWebGL2 = false) {
        this.onBeforeInit();
        this.canvas = document.getElementById(canvasID);
        if (this.canvas === null) {
            throw new Error("Cannot find canvas element");
        }
        this.viewportWidth = this.canvas.width;
        this.viewportHeight = this.canvas.height;
        this.m_gl = !!requestWebGL2 ? this.initGL2(this.canvas) : this.initGL(this.canvas);
        if (this.m_gl) {
            this.resizeCanvas();
            this.onAfterInit();
            this.initShaders();
            this.loadData();
            this.m_boundTick();
        }
        else {
            this.onInitError();
        }
    }
    /** Adjusts viewport according to resizing of canvas. */
    resizeCanvas() {
        if (this.canvas === undefined) {
            return;
        }
        const cssToRealPixels = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(this.canvas.clientWidth * cssToRealPixels);
        const displayHeight = Math.floor(this.canvas.clientHeight * cssToRealPixels);
        if (this.canvas.width != displayWidth || this.canvas.height != displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }
    }
    /**
     * Logs GL error to console.
     *
     * @param operation Operation name.
     */
    checkGlError(operation) {
        let error;
        while ((error = this.gl.getError()) !== this.gl.NO_ERROR) {
            console.error(`${operation}: glError ${error}`);
        }
    }
    /** @inheritdoc */
    unbindBuffers() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    }
    /** @inheritdoc */
    getMVPMatrix() {
        return this.mMVPMatrix;
    }
    /** @inheritdoc */
    getOrthoMatrix() {
        return this.matOrtho;
    }
    /** @inheritdoc */
    getModelMatrix() {
        return this.mMMatrix;
    }
    /** @inheritdoc */
    getViewMatrix() {
        return this.mVMatrix;
    }
}

class DiffuseShader extends BaseShader {
    /** @inheritdoc */
    fillCode() {
        this.vertexShaderCode = 'uniform mat4 view_proj_matrix;\n' +
            'attribute vec4 rm_Vertex;\n' +
            'attribute vec2 rm_TexCoord0;\n' +
            'varying vec2 vTextureCoord;\n' +
            '\n' +
            'void main() {\n' +
            '  gl_Position = view_proj_matrix * rm_Vertex;\n' +
            '  vTextureCoord = rm_TexCoord0;\n' +
            '}';
        this.fragmentShaderCode = 'precision mediump float;\n' +
            'varying vec2 vTextureCoord;\n' +
            'uniform sampler2D sTexture;\n' +
            '\n' +
            'void main() {\n' +
            '  gl_FragColor = texture2D(sTexture, vTextureCoord);\n' +
            '}';
    }
    /** @inheritdoc */
    fillUniformsAttributes() {
        this.view_proj_matrix = this.getUniform('view_proj_matrix');
        this.rm_Vertex = this.getAttrib('rm_Vertex');
        this.rm_TexCoord0 = this.getAttrib('rm_TexCoord0');
        this.sTexture = this.getUniform('sTexture');
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined || this.rm_TexCoord0 === undefined || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON = 0.000001;
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 4x4 Matrix<br>Format: column-major, when typed out it looks like row-major<br>The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */

function create$2() {
  var out = new ARRAY_TYPE(16);

  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }

  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {ReadonlyMat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */

function clone(a) {
  var out = new ARRAY_TYPE(16);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */

function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */

function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }

  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
/**
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */

function multiply(out, a, b) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]; // Cache only the current line of the second matrix

  var b0 = b[0],
      b1 = b[1],
      b2 = b[2],
      b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */

function translate(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}
/**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */

function rotate(out, a, rad, axis) {
  var x = axis[0],
      y = axis[1],
      z = axis[2];
  var len = Math.hypot(x, y, z);
  var s, c, t;
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  var b00, b01, b02;
  var b10, b11, b12;
  var b20, b21, b22;

  if (len < EPSILON) {
    return null;
  }

  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11]; // Construct the elements of the rotation matrix

  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c; // Perform rotation-specific matrix multiplication

  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  return out;
}
/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateX(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateY(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateZ(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
/**
 * Returns the translation vector component of a transformation
 *  matrix. If a matrix is built with fromRotationTranslation,
 *  the returned vector will be the same as the translation vector
 *  originally supplied.
 * @param  {vec3} out Vector to receive translation component
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {vec3} out
 */

function getTranslation(out, mat) {
  out[0] = mat[12];
  out[1] = mat[13];
  out[2] = mat[14];
  return out;
}
/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis.
 * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {ReadonlyVec3} eye Position of the viewer
 * @param {ReadonlyVec3} center Point the viewer is looking at
 * @param {ReadonlyVec3} up vec3 pointing up
 * @returns {mat4} out
 */

function lookAt(out, eye, center, up) {
  var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
  var eyex = eye[0];
  var eyey = eye[1];
  var eyez = eye[2];
  var upx = up[0];
  var upy = up[1];
  var upz = up[2];
  var centerx = center[0];
  var centery = center[1];
  var centerz = center[2];

  if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
    return identity(out);
  }

  z0 = eyex - centerx;
  z1 = eyey - centery;
  z2 = eyez - centerz;
  len = 1 / Math.hypot(z0, z1, z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;
  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len = Math.hypot(x0, x1, x2);

  if (!len) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;
  len = Math.hypot(y0, y1, y2);

  if (!len) {
    y0 = 0;
    y1 = 0;
    y2 = 0;
  } else {
    len = 1 / len;
    y0 *= len;
    y1 *= len;
    y2 *= len;
  }

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create$1() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */

function scale(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4$1(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create$1();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

/**
 * 4 Dimensional Vector
 * @module vec4
 */

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */

function create() {
  var out = new ARRAY_TYPE(4);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }

  return out;
}
/**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec4} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2],
      w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return out;
}
/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 4;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }

    return a;
  };
})();

class DiffuseColoredShader extends DiffuseShader {
    constructor() {
        super(...arguments);
        this._color = [1, 1, 0, 0];
    }
    // Attributes are numbers.
    // rm_Vertex: number | undefined;
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            uniform vec4 color;

            void main() {
                gl_FragColor = texture2D(sTexture, vTextureCoord) * color;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.color = this.getUniform("color");
    }
    setColor(r, g, b, a) {
        this._color = [r, g, b, a];
    }
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined || this.view_proj_matrix === undefined || this.color === undefined) {
            return;
        }
        const gl = renderer.gl;
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        super.drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz);
    }
}

var CameraMode;
(function (CameraMode) {
    CameraMode[CameraMode["Rotating"] = 0] = "Rotating";
    CameraMode[CameraMode["Random"] = 1] = "Random";
})(CameraMode || (CameraMode = {}));

class CameraPositionInterpolator {
    constructor() {
        this._speed = 0;
        this.duration = 0;
        this._minDuration = 3000;
        this._timer = 0;
        this.lastTime = 0;
        this._reverse = false;
        this._cameraPosition = create$1();
        this._cameraRotation = create$1();
        this._matrix = create$2();
    }
    get cameraPosition() {
        return this._cameraPosition;
    }
    get cameraRotation() {
        return this._cameraRotation;
    }
    set reverse(value) {
        this._reverse = value;
    }
    set minDuration(value) {
        this._minDuration = value;
    }
    get matrix() {
        return this._matrix;
    }
    get speed() {
        return this._speed;
    }
    set speed(value) {
        this._speed = value;
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this.duration = Math.max(this.getLength() / this.speed, this._minDuration);
    }
    get timer() {
        return this._timer;
    }
    getLength() {
        if (this.position === undefined) {
            return 0;
        }
        const start = this.position.start.position;
        const end = this.position.end.position;
        return Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2 + (end[2] - start[2]) ** 2);
    }
    iterate(timeNow) {
        if (this.lastTime != 0) {
            const elapsed = timeNow - this.lastTime;
            this._timer += elapsed / this.duration;
            if (this._timer > 1.0) {
                this._timer = 1.0;
            }
        }
        this.lastTime = timeNow;
        this.updateMatrix();
    }
    reset() {
        this._timer = 0;
        this.updateMatrix();
    }
    updateMatrix() {
        if (this._position === undefined) {
            return;
        }
        const start = this._reverse ? this._position.end : this._position.start;
        const end = this._reverse ? this._position.start : this._position.end;
        this._cameraPosition[0] = start.position[0] + this._timer * (end.position[0] - start.position[0]);
        this._cameraPosition[1] = start.position[1] + this._timer * (end.position[1] - start.position[1]);
        this._cameraPosition[2] = start.position[2] + this._timer * (end.position[2] - start.position[2]);
        this._cameraRotation[0] = start.rotation[0] + this._timer * (end.rotation[0] - start.rotation[0]);
        this._cameraRotation[1] = start.rotation[1] + this._timer * (end.rotation[1] - start.rotation[1]);
        this._cameraRotation[2] = start.rotation[2] + this._timer * (end.rotation[2] - start.rotation[2]);
        identity(this.matrix);
        rotateX(this.matrix, this.matrix, this._cameraRotation[0] - Math.PI / 2.0);
        rotateZ(this.matrix, this.matrix, this._cameraRotation[1]);
        rotateY(this.matrix, this.matrix, this._cameraRotation[2]);
        translate(this.matrix, this.matrix, [-this._cameraPosition[0], -this._cameraPosition[1], -this._cameraPosition[2]]);
    }
}

class DiffuseAnimatedTextureShader extends DiffuseShader {
    // Attributes are numbers.
    // rm_Vertex: number | undefined;
    fillCode() {
        this.vertexShaderCode = "#version 300 es\n" +
            "precision highp float;\n" +
            "uniform sampler2D sPositions;\n" +
            "uniform vec3 uTexelSizes; // x = vertex count; y = texel half width; z = sampler y coord (animation frame)\n" +
            "uniform mat4 view_proj_matrix;\n" +
            "in vec2 rm_TexCoord0;\n" +
            "out vec2 vTextureCoord;\n" +
            "\n" +
            "void main() {\n" +
            "  float id = float(gl_VertexID);" +
            "  vec4 position = texture(sPositions, vec2(id / uTexelSizes.x + uTexelSizes.y, uTexelSizes.z));" +
            "  gl_Position = view_proj_matrix * position;\n" +
            "  vTextureCoord = rm_TexCoord0;\n" +
            "}";
        this.fragmentShaderCode = "#version 300 es\n" +
            "precision mediump float;\n" +
            "in vec2 vTextureCoord;\n" +
            "uniform sampler2D sTexture;\n" +
            "out vec4 fragColor;\n" +
            "\n" +
            "void main() {\n" +
            "  fragColor = texture(sTexture, vTextureCoord);\n" +
            "}";
    }
    fillUniformsAttributes() {
        // super.fillUniformsAttributes();
        this.view_proj_matrix = this.getUniform('view_proj_matrix');
        // this.rm_Vertex = this.getAttrib('rm_Vertex');
        this.rm_TexCoord0 = this.getAttrib('rm_TexCoord0');
        this.sTexture = this.getUniform('sTexture');
        this.sPositions = this.getUniform("sPositions");
        this.uTexelSizes = this.getUniform("uTexelSizes");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_TexCoord0 === undefined || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        // gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        // gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 4, 0);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}

class DiffuseAnimatedTextureChunkedShader extends DiffuseAnimatedTextureShader {
    // Attributes are numbers.
    // rm_Vertex: number | undefined;
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = "#version 300 es\n" +
            "precision highp float;\n" +
            "uniform sampler2D sPositions;\n" +
            "// x = texture width; y = texel half width; z = sampler y coord (animation frame); w = chunk size\n" +
            "uniform vec4 uTexelSizes;\n" +
            "uniform float uTexelHeight;\n" +
            "uniform int uTextureWidthInt;\n" +
            "uniform mat4 view_proj_matrix;\n" +
            "in vec2 rm_TexCoord0;\n" +
            "out vec2 vTextureCoord;\n" +
            "\n" +
            "float getCenter(float y) {\n" +
            "  return y - mod(y, uTexelHeight) + uTexelHeight * 0.5;\n" +
            "}\n" +
            "\n" +
            "vec4 linearFilter(vec2 coords) {\n" +
            "  vec2 coords1 = vec2(coords.x, coords.y - uTexelHeight * 0.49);\n" +
            "  vec2 coords2 = vec2(coords.x, coords.y + uTexelHeight * 0.49);\n" +
            "  float center1 = getCenter(coords1.y);\n" +
            "  float center2 = getCenter(coords2.y);\n" +
            "  vec4 v1 = texture(sPositions, vec2(coords1.x, center1));\n" +
            "  vec4 v2 = texture(sPositions, vec2(coords2.x, center2));\n" +
            "  float d1 = abs(coords.y - center1);\n" +
            "  float d2 = abs(coords.y - center2);\n" +
            "  if (d1 > d2) {\n" +
            "    return mix( v1, v2, d1 / (uTexelHeight) );\n" +
            "  } else {\n" +
            "    return mix( v2, v1, d2 / (uTexelHeight) );\n" +
            "  }\n" +
            "}\n" +
            "\n" +
            "void main() {\n" +
            "  float id = float(gl_VertexID % uTextureWidthInt);" +
            "  float chunk = float(gl_VertexID / uTextureWidthInt);" +
            "  vec2 coords = vec2(id / uTexelSizes.x + uTexelSizes.y, uTexelSizes.z);" +
            "  coords.y += chunk * uTexelSizes.w;" +
            "  vec4 position = linearFilter(coords);" +
            "  gl_Position = view_proj_matrix * position;\n" +
            "  vTextureCoord = rm_TexCoord0;\n" +
            "}";
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uTextureWidthInt = this.getUniform("uTextureWidthInt");
        this.uTexelHeight = this.getUniform("uTexelHeight");
    }
}

class VertexLitShader extends DiffuseShader {
    fillCode() {
        this.vertexShaderCode =
            "// vertex-lit for trunk\n" +
                "// ambient = RGBA 206, 206, 205, 255\n" +
                "// diffuse = RGBA 105, 125, 152, 255\n" +
                "// lightDir - normalized light direction\n" +
                "// lightDir = 0.57735, -0.57735, -0.57735, 0.0\n" +
                "\n" +
                "uniform vec4 lightDir;\n" +
                "uniform mat4 view_matrix;\n" +
                "uniform mat4 model_matrix;\n" +
                "uniform mat4 view_proj_matrix;\n" +
                "uniform vec4 diffuse;\n" +
                "uniform vec4 ambient;\n" +
                "uniform float diffuseCoef;\n" +
                "uniform float diffuseExponent;\n" +
                "\n" +
                "varying vec2 vTexCoord;\n" +
                "varying vec4 vDiffuseColor;\n" +
                "\n" +
                "attribute vec2 rm_TexCoord0;\n" +
                "attribute vec4 rm_Vertex;\n" +
                "attribute vec3 rm_Normal;\n" +
                "\n" +
                "void main(void)\n" +
                "{\n" +
                "   gl_Position = view_proj_matrix * rm_Vertex;\n" +
                "\n" +
                "   vec3 vLightVec = (view_matrix * lightDir).xyz;\n" +
                "   vec4 normal = model_matrix * vec4(rm_Normal, 0.0);\n" +
                "   vec3 vNormal = normalize( view_matrix * normal).xyz;\n" + // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                "   float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent);\n" + // redundant normalize() ??
                "   vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);\n" +
                "\n" +
                "   vTexCoord = rm_TexCoord0;\n" +
                "}\n";
        this.fragmentShaderCode =
            "precision mediump float;\n" +
                "uniform sampler2D sTexture;\n" +
                "\n" +
                "varying vec2 vTexCoord;\n" +
                "varying vec4 vDiffuseColor;\n" +
                "\n" +
                "void main(void)\n" +
                "{\n" +
                "   gl_FragColor = vDiffuseColor * texture2D(sTexture, vTexCoord);\n" +
                "}\n";
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.view_matrix = this.getUniform("view_matrix");
        this.model_matrix = this.getUniform("model_matrix");
        // this.view_proj_matrix = this.getUniform("view_proj_matrix");
        // this.rm_Vertex = this.getAttrib("rm_Vertex");
        // this.rm_TexCoord0 = this.getAttrib("rm_TexCoord0");
        this.rm_Normal = this.getAttrib("rm_Normal");
        this.ambient = this.getUniform("ambient");
        this.diffuse = this.getUniform("diffuse");
        this.lightDir = this.getUniform("lightDir");
        this.diffuseCoef = this.getUniform("diffuseCoef");
        this.diffuseExponent = this.getUniform("diffuseExponent");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitShader glDrawElements");
    }
}

const ShaderCommonFunctions = {
    RANDOM: `
    /** From https://thebookofshaders.com/10/ */
    float random_vec2 (vec2 st) {
        return fract(sin(dot(st.xy,vec2(12.9898, 78.233))) * 43758.5453123);
    }

    /** Optimized version of the same random() from The Book of Shaders */
    float random (float st) {
        return fract(sin(st) * 43758.5453123);
    }
    `,
    INVERSE_RANDOM: `
    /** From https://thebookofshaders.com/10/ */
    float random_vec2 (vec2 st) {
        return 1.0 - fract(sin(dot(st.xy,vec2(12.9898, 78.233))) * 43758.5453123);
    }

    /** Optimized version of the same random() from The Book of Shaders */
    float random (float st) {
        return 1.0 - fract(sin(st) * 43758.5453123);
    }
    `,
    GRADIENT_NOISE: `
    vec2 random2(vec2 st){
        st = vec2( dot(st,vec2(127.1,311.7)),
                  dot(st,vec2(269.5,183.3)) );
        return -1.0 + 2.0*fract(sin(st)*43758.5453123);
    }

    // Gradient Noise by Inigo Quilez - iq/2013
    // https://www.shadertoy.com/view/XdXGW8
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org
    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);

        vec2 u = f*f*(3.0-2.0*f);

        return mix( mix( dot( random2(i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ),
                         dot( random2(i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                    mix( dot( random2(i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ),
                         dot( random2(i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
    }
    `,
    ROTATION: `
    /** https://www.neilmendoza.com/glsl-rotation-about-an-arbitrary-axis/ */
    mat4 rotationMatrix(vec3 axis, float angle)
    {
        // axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;

        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                    0.0,                                0.0,                                0.0,                                1.0);
    }

    /** Optimized version to rotate only around Z axis */
    mat4 rotationAroundZ(float angle)
    {
        float s = sin(angle);
        float c = cos(angle);

        return mat4(c,  -s,   0.0, 0.0,
                    s,   c,   0.0, 0.0,
                    0.0, 0.0, 1.0, 0.0,
                    0.0, 0.0, 0.0, 1.0);
    }
    `,
    /**
     * Fast and somewhat good enough.
     */
    VALUE_NOISE: `
    // https://www.shadertoy.com/view/lsf3WH
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org/

    float hash(vec2 p)  // replace this by something better
    {
        p  = 50.0*fract( p*0.3183099 + vec2(0.71,0.113));
        return -1.0+2.0*fract( p.x*p.y*(p.x+p.y) );
    }

    float noise( in vec2 p )
    {
        vec2 i = floor( p );
        vec2 f = fract( p );

        // vec2 u = f*f*(3.0-2.0*f); // original
        vec2 u = f; // less contrast, faster

        return mix( mix( hash( i + vec2(0.0,0.0) ),
                         hash( i + vec2(1.0,0.0) ), u.x),
                    mix( hash( i + vec2(0.0,1.0) ),
                         hash( i + vec2(1.0,1.0) ), u.x), u.y);
    }
    `,
    /**
     * Clear repetitive horizontal and vertical patterns can be seen.
     * Still good enough for low-frequency vertex stuff
     */
    VALUE_NOISE_CHEAP: `
    // https://www.shadertoy.com/view/lsf3WH
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org/

    float hash(vec2 p)  // replace this by something better
    {
        p  = 50.0*fract( p*0.3183099 + vec2(0.71,0.113));
        return -1.0+2.0*fract( p.x*p.y ); // repetitive horizontal and vertical patterns can be seen
    }

    float noise( in vec2 p )
    {
        vec2 i = floor( p );
        vec2 f = fract( p );

        // vec2 u = f*f*(3.0-2.0*f); // original
        vec2 u = f; // less contrast, faster

        return mix( mix( hash( i + vec2(0.0,0.0) ),
                         hash( i + vec2(1.0,0.0) ), u.x),
                    mix( hash( i + vec2(0.0,1.0) ),
                         hash( i + vec2(1.0,1.0) ), u.x), u.y);
    }
    `,
    /**
     * Generates 2 random values for 2 vec2 packed into single vec4.
     */
    VALUE_NOISE2: `
    // https://www.shadertoy.com/view/lsf3WH
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org/

    const vec4 VALUE_NOISE_VEC2_COEFFS = vec4(0.71,0.113, 0.77,0.111);

    vec2 hash2(vec4 p)  // replace this by something better
    {
        p  = 50.0*fract( p*0.3183099 + VALUE_NOISE_VEC2_COEFFS);
        return -1.0 + 2.0 * fract( vec2(
            ( p.x*p.y*(p.x+p.y) ),
            ( p.z*p.w*(p.z+p.w) )
        ));
    }

    vec2 noise2( in vec4 p )
    {
        vec4 i = floor( p );
        vec4 f = fract( p );
        // vec2 u = f*f*(3.0-2.0*f); // original
        vec4 u = f; // less contrast, faster
        return mix( mix( hash2( i ),
                         hash2( i + vec4(1.0,0.0,1.0,0.0) ), u.x),
                    mix( hash2( i + vec4(0.0,1.0,0.0,1.0) ),
                         hash2( i + vec4(1.0,1.0,1.0,1.0) ), u.x), u.y);
    }
    `,
    /**
     * Generates 2 random values for 2 vec2 packed into single vec4.
     * Clear repetitive horizontal and vertical patterns can be seen.
     * Still good enough for low-frequency vertex stuff
     */
    VALUE_NOISE2_CHEAP: `
    // https://www.shadertoy.com/view/lsf3WH
    // The MIT License
    // Copyright © 2013 Inigo Quilez
    // Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
    // https://www.youtube.com/c/InigoQuilez
    // https://iquilezles.org/

    const vec4 VALUE_NOISE_VEC2_COEFFS = vec4(0.71,0.113, 0.77,0.111);

    vec2 hash2(vec4 p)  // replace this by something better
    {
        p  = 50.0*fract( p*0.3183099 + VALUE_NOISE_VEC2_COEFFS);
        return -1.0 + 2.0 * fract( vec2(
            ( p.x*p.y ), // repetitive horizontal and vertical patterns can be seen
            ( p.z*p.w )
        ));
    }

    vec2 noise2( in vec4 p )
    {
        vec4 i = floor( p );
        vec4 f = fract( p );
        // vec2 u = f*f*(3.0-2.0*f); // original
        vec4 u = f; // less contrast, faster
        return mix( mix( hash2( i ),
                         hash2( i + vec4(1.0,0.0,1.0,0.0) ), u.x),
                    mix( hash2( i + vec4(0.0,1.0,0.0,1.0) ),
                         hash2( i + vec4(1.0,1.0,1.0,1.0) ), u.x), u.y);
    }
    `
};

class InstancedVegetationShader extends DiffuseShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform mat4 view_proj_matrix;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.0; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
                       
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
           
                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            out vec4 fragColor;
            
            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.spread = this.getUniform("spread");
        this.cullDistances = this.getUniform("cullDistances");
        this.uScale = this.getUniform("uScale");
        this.uDistributionRange = this.getUniform("uDistributionRange");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
InstancedVegetationShader.DISTRIBUTION_CULLING = `
        float distributionNoise = noise(translation * uDistributionRange.z /*.027*/); // [-1...1] range
        if (distributionNoise < uDistributionRange.x || distributionNoise > uDistributionRange.y) {
            vertex = EMTPY_COORDINATE;
        }
    `;

class VertexLitInstancedVegetationShader extends InstancedVegetationShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            // vertex-lit for trunk
            // ambient = RGBA 206, 206, 205, 255
            // diffuse = RGBA 105, 125, 152, 255
            // lightDir - normalized light direction
            // lightDir = 0.57735, -0.57735, -0.57735, 0.0
            
            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.1; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
                       
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);
            
                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            in vec4 vDiffuseColor;
            out vec4 fragColor;
            
            void main(void)
            {
                fragColor = vDiffuseColor * texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.view_matrix = this.getUniform("view_matrix");
        this.model_matrix = this.getUniform("model_matrix");
        this.rm_Normal = this.getAttrib("rm_Normal");
        this.ambient = this.getUniform("ambient");
        this.diffuse = this.getUniform("diffuse");
        this.lightDir = this.getUniform("lightDir");
        this.diffuseCoef = this.getUniform("diffuseCoef");
        this.diffuseExponent = this.getUniform("diffuseExponent");
        this.spread = this.getUniform("spread");
        this.cullDistances = this.getUniform("cullDistances");
        this.uScale = this.getUniform("uScale");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
}

class VertexLitInstancedVegetationFadingShader extends VertexLitInstancedVegetationShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            // vertex-lit for trunk
            // ambient = RGBA 206, 206, 205, 255
            // diffuse = RGBA 105, 125, 152, 255
            // lightDir - normalized light direction
            // lightDir = 0.57735, -0.57735, -0.57735, 0.0
            
            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            uniform float minInstanceScale; // minimum scale of instance to draw
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.1; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;
            
            ${ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
                        
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                float shrink = smoothstep(0.0, 0.6, (cullDistances.y - instancePosition.z) / cullDistances.y);
                if (shrink < minInstanceScale) {
                    shrink = 0.0;
                }

                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    scale *= shrink;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}
                
                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);
            
                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.minInstanceScale = this.getUniform("minInstanceScale");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
}

class VertexLitInstancedGrassShader extends VertexLitInstancedVegetationShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform vec4 lightDir;
            uniform vec3 viewPos;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            
            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;
            uniform vec3 uDistributionRange;

            const float PI2 = 6.283185307179586;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.0; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
            ${ShaderCommonFunctions.GRADIENT_NOISE}
                       
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // vDiffuseColor.r += bendCoeff * 3.; // FIXME
           
                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float ZERO = 0.0;
                vec3 vNormal2 = normalize(normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration

                vec3 viewDir = normalize(viewPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                //const float specularStrength = 1.8;
                //vDiffuseColor = mix(vDiffuseColor, uSpecularColor, uSpecularStrength * spec);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.viewPos = this.getUniform("viewPos");
        this.uSpecularColor = this.getUniform("uSpecularColor");
        this.uSpecularPower = this.getUniform("uSpecularPower");
        this.uSpecularStrength = this.getUniform("uSpecularStrength");
    }
}

class VertexLitInstancedGrassAnimatedShader extends VertexLitInstancedGrassShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform vec4 lightDir;
            uniform vec3 viewPos;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near

            uniform float stiffness;// = 2.0;
            uniform float heightCoeff;// = 0.06;
            uniform float windOffset;// = 11.0;

            out vec2 vTexCoord;
            out vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform float uTime;
            const float PI2 = 6.283185307179586;

            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;
            uniform vec3 uDistributionRange;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.0; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;

            ${ShaderCommonFunctions.INVERSE_RANDOM}
            ${ShaderCommonFunctions.ROTATION}
            ${ShaderCommonFunctions.GRADIENT_NOISE}

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = smoothstep(0.0, FADE_MIN, t) * (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                // animation ======================================
                float time1 = sin(uTime + random(fInstance * 0.0196));
                float time2 = cos(uTime + random(fInstance * 0.0177));
                float bendCoeff = pow(rm_Vertex.z * heightCoeff, stiffness);
                float ox = time1 * noise(vertex.xy * .07) * windOffset;
                float oy = time2 * noise(vertex.xy * .077) * windOffset;
                // float oz = time * noise(vertex.xy * .075) * windOffset;
                vertex.x += ox * bendCoeff;
                vertex.y += oy * bendCoeff;
                // vertex.z += oz * bendCoeff;
                // end animation ==================================

                gl_Position = view_proj_matrix * vertex;

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // vDiffuseColor.r += bendCoeff * 3.; // FIXME

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float SPECULAR_POWER = 6.0;
                const float ZERO = 0.0;
                // const vec3 NORMAL = vec3(0.0, 0.0, 1.0);
                float time3 =  noise(sin(uTime) * vertex.xy * .01);
                vec3 vNormal2 = normalize(normal + time3 * 0.2).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                //vNormal2 *= time2 / 2.0;

                vec3 viewDir = normalize(viewPos - FragPos);
                //vec3 lightDir = normalize(lightPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                //const float specularStrength = 1.8;
                //vec4 specularColor = specularStrength * spec * vec4(1.0, 1.0, 1.0, 1.0);
                //vDiffuseColor = mix(vDiffuseColor, uSpecularColor, uSpecularStrength * spec);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uTime = this.getUniform("uTime");
        this.viewPos = this.getUniform("viewPos");
        this.stiffness = this.getUniform("stiffness");
        this.heightCoeff = this.getUniform("heightCoeff");
        this.windOffset = this.getUniform("windOffset");
    }
}

class VertexLitInstancedGrassFadingShader extends VertexLitInstancedVegetationFadingShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;
            
            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform mat4 view_proj_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            uniform vec3 uScale; // x: base scale for models; y: min random scale (normalized); z: max additional scale (normalized)
            uniform vec2 spread; // x: X spread; y: Y spread.
            uniform vec3 cullDistances; // x: near culling distance; y: far culling distance; z: cascade width = far - near
            uniform float minInstanceScale; // minimum scale of instance to draw
            uniform vec3 uDistributionRange;
            
            out vec2 vTexCoord;
            out vec4 vDiffuseColor;
            
            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            const vec4 EMTPY_COORDINATE = vec4(0., 0., 0., 0.); // vertex coordinates to create degenerate triangle
            const float FADE_WIDTH = 0.1; // size of fade in-out (using scale) width relative to cascade width.
            const float FADE_MIN = FADE_WIDTH;
            const float FADE_MAX = 1.0 - FADE_WIDTH;
            
            ${ShaderCommonFunctions.GRADIENT_NOISE}
            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
                        
            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    spread.x * (random(fInstance * 0.0196) - 0.5),
                    spread.y * (random(fInstance * 0.0177) - 0.5)
                );
                vec4 instancePosition = view_proj_matrix * vec4(translation, 0., 1.);
                float rotation = 6.28318530718 * random(fInstance * 0.03);
                mat4 rotationMatrix = rotationAroundZ(rotation);

                float shrink = smoothstep(0.0, 0.6, (cullDistances.y - instancePosition.z) / cullDistances.y);
                if (shrink < minInstanceScale) {
                    shrink = 0.0;
                }

                if (instancePosition.z < cullDistances.x || instancePosition.z > cullDistances.y) {
                    vertex = EMTPY_COORDINATE;
                } else {
                    float scale = uScale.x * (uScale.y + random(fInstance * 1.07) * uScale.z);

                    // t = normalized position of instance within width of cascade.
                    float t = (cullDistances.y - instancePosition.z) / cullDistances.z;
                    float fade = (1.0 - smoothstep(FADE_MAX, 1.0, t));
                    scale *= fade;

                    scale *= shrink;

                    vertex *= rotationMatrix;
                    vertex *= vec4(scale, scale, scale, 1.0);
                    vertex.xy += translation;
                }
                ${InstancedVegetationShader.DISTRIBUTION_CULLING}

                gl_Position = view_proj_matrix * vertex;
            
                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // animation ======================================
                //vDiffuseColor.r += 5.0;
                // end animation ==================================

                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
    }
}

class VertexLitInstancedGrassAtShader extends VertexLitInstancedGrassShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            
            in vec2 vTexCoord;
            in vec4 vDiffuseColor;
            out vec4 fragColor;
            
            void main(void)
            {
                vec4 base = texture(sTexture, vTexCoord);
                if (base.a < 0.9) {
                    discard;
                } else {
                    fragColor = vDiffuseColor * base;
                }
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.viewPos = this.getUniform("viewPos");
    }
}

class GlareShader extends BaseShader {
    fillCode() {
        this.vertexShaderCode = `precision mediump float;
        uniform mat4 view_proj_matrix;
        uniform vec4 lightDir;
        uniform float glareExponent;
        attribute vec4 rm_Vertex;
        attribute vec4 rm_Normal;
        varying vec3 vNormal;
        varying float vGlare;
        
        void main() {
            gl_Position = view_proj_matrix * rm_Vertex;
            vGlare = clamp(dot(rm_Normal, lightDir), 0.0, 1.0);
        }`;
        this.fragmentShaderCode = `precision mediump float;
        varying vec3 vNormal;
        varying float vGlare;
        uniform float glareExponent;
        uniform vec4 glareColor;

        void main() {
            float glare = pow(vGlare, glareExponent);
            gl_FragColor = glareColor * glare;
        }`;
    }
    fillUniformsAttributes() {
        this.rm_Vertex = this.getAttrib("rm_Vertex");
        this.rm_Normal = this.getAttrib("rm_Normal");
        this.view_proj_matrix = this.getUniform("view_proj_matrix");
        this.lightDir = this.getUniform("lightDir");
        this.glareExponent = this.getUniform("glareExponent");
        this.glareColor = this.getUniform("glareColor");
    }
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined || this.rm_Normal === undefined || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("GlareShader glDrawElements");
    }
}

class DiffuseColoredVertexAlphaShader extends DiffuseColoredShader {
    fillCode() {
        this.vertexShaderCode = `uniform mat4 view_proj_matrix;
            attribute vec4 rm_Vertex;
            attribute vec2 rm_TexCoord0;
            attribute float rm_AO;
            varying vec2 vTextureCoord;
            varying float vAlpha;
            
            void main() {
              gl_Position = view_proj_matrix * rm_Vertex;
              vTextureCoord = rm_TexCoord0;
              vAlpha = rm_AO;
            }`;
        this.fragmentShaderCode = `precision mediump float;
            varying vec2 vTextureCoord;
            varying float vAlpha;
            uniform sampler2D sTexture;
            uniform vec4 color;
            
            void main() {
              gl_FragColor = texture2D(sTexture, vTextureCoord) * color;
              gl_FragColor.a = vAlpha;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.rm_AO = this.getAttrib("rm_AO");
    }
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_AO === undefined
            || this.view_proj_matrix === undefined
            || this.color === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_AO);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 1), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 1), 4 * 3);
        gl.vertexAttribPointer(this.rm_AO, 1, gl.FLOAT, false, 4 * (3 + 2 + 1), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}

class InstancedTexturePositionsShader extends DiffuseShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            out mediump vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uScale = this.getUniform("uScale");
        this.sPositions = this.getUniform("sPositions");
        this.uPositionOffset = this.getUniform("uPositionOffset");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, offset, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        // gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        // gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        gl.vertexAttribPointer(this.rm_Vertex, 4, gl.INT_2_10_10_10_REV, false, 8, 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 8, 4);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniform1i(this.uPositionOffset, offset);
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}
InstancedTexturePositionsShader.COMMON_TRANSFORMS = `
    vec4 vertex = rm_Vertex;
    float fInstance = float(gl_InstanceID);
    int x = uPositionOffset + gl_InstanceID;
    vec4 translationAndScale = texelFetch(sPositions, ivec2(x, 0), 0); // xy=translation, z=scale
    vec4 rotations = texelFetch(sPositions, ivec2(x, 1), 0); // x=sin a; y=cos a
    vec2 translation = translationAndScale.xy;
    float scale = uScale.x + translationAndScale.z * uScale.y;
    float s = rotations.x;
    float c = rotations.y;
    mat4 rotationMatrix = mat4(
        c,  -s,   0.0, 0.0,
        s,   c,   0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0
    );

    vertex *= rotationMatrix;
    vertex *= vec4(scale, scale, scale, 1.0);
    vertex.xy += translation;
    `;

class InstancedTexturePositionsColoredShader extends InstancedTexturePositionsShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            uniform vec4 color;

            in mediump vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord) * color;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.color = this.getUniform("color");
    }
}

class VertexLitInstancedTexturePositionsShader extends InstancedTexturePositionsShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            out mediump vec2 vTexCoord;
            out mediump vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            in mediump vec4 vDiffuseColor;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = vDiffuseColor * texture(sTexture, vTexCoord);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.view_matrix = this.getUniform("view_matrix");
        this.model_matrix = this.getUniform("model_matrix");
        this.rm_Normal = this.getAttrib("rm_Normal");
        this.ambient = this.getUniform("ambient");
        this.diffuse = this.getUniform("diffuse");
        this.lightDir = this.getUniform("lightDir");
        this.diffuseCoef = this.getUniform("diffuseCoef");
        this.diffuseExponent = this.getUniform("diffuseExponent");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 3);
        gl.vertexAttribPointer(this.rm_Normal, 3, gl.FLOAT, false, 4 * (3 + 2 + 3), 4 * 5);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, offset, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.rm_Normal === undefined
            || this.view_proj_matrix === undefined
            || this.view_matrix === undefined
            || this.model_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.enableVertexAttribArray(this.rm_Normal);
        gl.vertexAttribPointer(this.rm_Vertex, 4, gl.INT_2_10_10_10_REV, false, 12, 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.HALF_FLOAT, false, 12, 4);
        gl.vertexAttribPointer(this.rm_Normal, 4, gl.INT_2_10_10_10_REV, true, 12, 8);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.uniformMatrix4fv(this.view_matrix, false, renderer.getViewMatrix());
        gl.uniformMatrix4fv(this.model_matrix, false, renderer.getModelMatrix());
        gl.uniform1i(this.uPositionOffset, offset);
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
}

class InstancedTexturePositionsGrassShader extends VertexLitInstancedTexturePositionsShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            out vec2 vTexCoord;
            out vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform vec3 viewPos;
            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}
                gl_Position = view_proj_matrix * vertex;

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float ZERO = 0.0;
                vec3 vNormal2 = normalize(normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration

                vec3 viewDir = normalize(viewPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                //const float specularStrength = 1.8;
                //vDiffuseColor = mix(vDiffuseColor, uSpecularColor, uSpecularStrength * spec);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.viewPos = this.getUniform("viewPos");
        this.uSpecularColor = this.getUniform("uSpecularColor");
        this.uSpecularPower = this.getUniform("uSpecularPower");
        this.uSpecularStrength = this.getUniform("uSpecularStrength");
    }
}

class InstancedTexturePositionsGrassAnimatedShader extends InstancedTexturePositionsGrassShader {
    fillCode() {
        super.fillCode();
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uScale; // x: base scale for models; y: max random additional scale
            uniform sampler2D sPositions;
            uniform int uPositionOffset;

            uniform vec4 lightDir;
            uniform mat4 view_matrix;
            uniform mat4 model_matrix;
            uniform vec4 diffuse;
            uniform vec4 ambient;
            uniform float diffuseCoef;
            uniform float diffuseExponent;

            out mediump vec2 vTexCoord;
            out mediump vec4 vDiffuseColor;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;
            in vec3 rm_Normal;

            uniform vec3 viewPos;
            uniform float uSpecularPower;
            uniform vec4 uSpecularColor;
            uniform float uSpecularStrength;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}
            ${ShaderCommonFunctions.VALUE_NOISE_CHEAP}
            ${ShaderCommonFunctions.VALUE_NOISE2_CHEAP}

            const float PI2 = 6.28318530718;

            uniform vec2 uTime; // x=sin(time), y=cos(time)
            uniform float stiffness;// = 2.0;
            uniform float heightCoeff;// = 0.06;
            uniform float windOffset;// = 11.0;

            void main(void)
            {
                ${InstancedTexturePositionsShader.COMMON_TRANSFORMS}

                vec3 vLightVec = (view_matrix * lightDir).xyz;
                vec4 normal = model_matrix * vec4(rm_Normal, 0.0) * rotationMatrix;
                vec3 vNormal = normalize( view_matrix * normal).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                float d = pow(max(0.0, dot(normalize(vNormal), normalize(vLightVec))), diffuseExponent); // redundant normalize() ??
                vDiffuseColor = mix(ambient, diffuse, d * diffuseCoef);

                // specular ==================
                vec3 FragPos = vec3(model_matrix * vertex);
                const float SPECULAR_POWER = 6.0;
                const float ZERO = 0.0;
                float time3 =  noise(uTime.x * vertex.xy * .01);
                vec3 vNormal2 = normalize(normal + time3 * 0.2).xyz; // w component of rm_Normal might be ignored, and implicitly converted to vec4 in uniform declaration
                vec3 viewDir = normalize(viewPos - FragPos);
                vec3 reflectDir = reflect(-lightDir.xyz, vNormal2);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), uSpecularPower);
                vDiffuseColor += uSpecularColor * uSpecularStrength * spec;
                // end specular ==============

                // animation ======================================
                float bendCoeff = pow(abs(rm_Vertex.z) * heightCoeff, stiffness);
                vec2 offsetsXY = noise2(vec4(vertex.xy, vertex.xy) * 0.07);
                offsetsXY *= (uTime * windOffset) * bendCoeff;
                vertex.xy += offsetsXY;
                // end animation ==================================

                gl_Position = view_proj_matrix * vertex;
                vTexCoord = rm_TexCoord0;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uTime = this.getUniform("uTime");
        this.stiffness = this.getUniform("stiffness");
        this.heightCoeff = this.getUniform("heightCoeff");
        this.windOffset = this.getUniform("windOffset");
    }
}

class InstancedTexturePositionsGrassAtShader extends InstancedTexturePositionsGrassShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;
            in mediump vec4 vDiffuseColor;
            out vec4 fragColor;

            void main(void)
            {
                vec4 base = texture(sTexture, vTexCoord);
                if (base.a < 0.9) {
                    discard;
                } else {
                    fragColor = vDiffuseColor * base;
                }
            }`;
    }
}

class AntsShader extends DiffuseColoredShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uRadius; // x: base radius, y: additional random radius
            uniform vec2 uSpread; // x: X spread; y: Y spread.
            uniform float uTime;
            uniform float uRotation;

            out vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float PI2 = 6.28318530718;
            const float PI = 3.14159265359;
            const float HALF_PI = 1.57079632679;

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID) + uRotation;

                vec2 translation = vec2(
                    uSpread.x * (random(fInstance * 0.0196) - 0.5),
                    uSpread.y * (random(fInstance * 0.0177) - 0.5)
                );

                float angle = uTime + fInstance;
                float s = sin(angle);
                float c = cos(angle);
                float radius = uRadius.x + uRadius.y * random(fInstance);

                mat4 rotationMatrix = rotationAroundZ(-angle + uRotation);

                vertex *= rotationMatrix;
                vertex.x += s * radius;
                vertex.y += c * radius;
                vertex.xy += translation;

                gl_Position = view_proj_matrix * vertex;

                vTexCoord = rm_TexCoord0;
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;
            uniform vec4 color;

            in vec2 vTexCoord;
            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord) * color;
                if (fragColor.a < 0.2) discard;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uSpread = this.getUniform("uSpread");
        this.uTime = this.getUniform("uTime");
        this.uRadius = this.getUniform("uRadius");
        this.uRotation = this.getUniform("uRotation");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}

class ButterflyShader extends DiffuseShader {
    fillCode() {
        this.vertexShaderCode = `#version 300 es
            precision highp float;

            uniform mat4 view_proj_matrix;

            uniform vec2 uRadius; // x: base radius, y: additional random radius
            uniform vec2 uSpread; // x: X spread; y: Y spread.
            uniform float uTime;
            uniform float uRotation;

            uniform float uAnimationTime;
            uniform vec4 uButterflyParams; // x: X size; y: Z animation amplitude, z: Z flight amplitude, w: atlas Y size.

            out mediump vec2 vTexCoord;

            in vec2 rm_TexCoord0;
            in vec4 rm_Vertex;

            ${ShaderCommonFunctions.RANDOM}
            ${ShaderCommonFunctions.ROTATION}

            const float STIFFNESS = 4.0;
            const float JUMP_PERIOD_COEFF = 4.0;
            const float HALF = 0.5;
            const float ONE = 1.0;
            const float MAGIC_1 = 0.0196;
            const float MAGIC_2 = 0.0177;

            void main(void)
            {
                vec4 vertex = rm_Vertex;
                float fInstance = float(gl_InstanceID);

                vec2 translation = vec2(
                    uSpread.x * (random(fInstance * MAGIC_1) - HALF),
                    uSpread.y * (random(fInstance * MAGIC_2) - HALF)
                );

                float angle = uTime + fInstance;
                float radius = uRadius.x + uRadius.y * random(fInstance);
                translation += vec2(sin(angle), cos(angle)) * radius;

                mat4 rotationMatrix = rotationAroundZ(-angle + uRotation);

                float animCoeff = pow(abs(vertex.x / uButterflyParams.x), STIFFNESS);
                vertex.z += sin(uAnimationTime + fInstance) * animCoeff * uButterflyParams.y;
                vertex.z += sin(uTime * JUMP_PERIOD_COEFF + fInstance) * uButterflyParams.z;

                vertex *= rotationMatrix;
                vertex.xy += translation;

                gl_Position = view_proj_matrix * vertex;

                vTexCoord = rm_TexCoord0;
                vTexCoord.y *= uButterflyParams.w;
                vTexCoord.y += mod(fInstance * uButterflyParams.w, ONE);
            }`;
        this.fragmentShaderCode = `#version 300 es
            precision mediump float;
            uniform sampler2D sTexture;

            in mediump vec2 vTexCoord;

            out vec4 fragColor;

            void main(void)
            {
                fragColor = texture(sTexture, vTexCoord);
                if (fragColor.a < 0.2) discard;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.uSpread = this.getUniform("uSpread");
        this.uTime = this.getUniform("uTime");
        this.uRadius = this.getUniform("uRadius");
        this.uRotation = this.getUniform("uRotation");
        this.uAnimationTime = this.getUniform("uAnimationTime");
        this.uButterflyParams = this.getUniform("uButterflyParams");
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("VertexLitInstancedShader glDrawElements");
    }
    drawInstanced(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz, instances) {
        if (this.rm_Vertex === undefined
            || this.rm_TexCoord0 === undefined
            || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElementsInstanced(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0, instances);
        renderer.checkGlError("InstancedVegetationShader glDrawElements");
    }
}

/** Tiles with texture data. */
class TiledInstances {
    constructor(textureData, tiles, culledTiles) {
        this.textureData = textureData;
        this.tiles = tiles;
        this.culledTiles = culledTiles;
    }
    cull(bboxVisibility) {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            this.culledTiles[i] = bboxVisibility.isModelCulled(tile.boundingBox);
        }
    }
    drawTiles(shader, model, renderer, density = 1) {
        for (let i = 0; i < this.tiles.length; i++) {
            const tile = this.tiles[i];
            const count = Math.round(tile.instancesCount * density);
            if (count === 0) {
                continue;
            }
            if (!this.culledTiles[i]) {
                shader.drawInstanced(renderer, model, 0, 0, 0, 0, 0, 0, 1, 1, 1, tile.instancesOffset, count);
            }
        }
    }
}
function sortInstancesByTiles(texture, tesselation, size, padding, culledTiles) {
    const textureData = new Float32Array(texture.length);
    const tiles = new Array(tesselation * tesselation);
    let tilesCounter = 0;
    let textureCursor = 0;
    const tileSize = size / tesselation;
    const halfSize = size / 2;
    const textureWidth = textureData.length / 3 / 2;
    for (let tileX = 0; tileX < tesselation; tileX++) {
        for (let tileY = 0; tileY < tesselation; tileY++) {
            const instancesOffset = textureCursor;
            let instancesCount = 0;
            const boundingBoxInternal = {
                min: { x: tileX * tileSize - halfSize, y: tileY * tileSize - halfSize, z: 0 },
                max: { x: tileX * tileSize + tileSize - halfSize, y: tileY * tileSize + tileSize - halfSize, z: 0 }
            };
            const boundingBox = {
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

const PADDING = { x: 25, y: 25, z: 30 };
const SIZE = 400;
const TILES_COUNT = 4;
const CULLED_TILES = new Array(TILES_COUNT * TILES_COUNT);
const FLOWERS = new Float32Array([
    87.726, -114.001, 0.83500,
    44.0889, -142.431, 0.86356,
    46.5807, 105.192, 0.22177,
    -32.1435, -62.4233, 0.23101,
    -134.172, -64.1917, 0.44838,
    -68.9657, -73.0562, 0.21271,
    145.539, -22.5776, 0.51821,
    29.1278, -8.04683, 0.65153,
    -3.48778, 21.4798, 0.85161,
    -100.302, 142.878, 0.10030,
    -147.302, 21.457, 0.73634,
    -76.2492, 35.6231, 0.64953,
    68.495, -23.88, 0.44742,
    41.9443, 30.5061, 0.07180,
    -0.511131, 84.7348, 0.94091,
    0.9748879741391069, -0.222695841629223, 0.0,
    -0.523117898010644, -0.852260326884295, 0.0,
    0.6942360716170535, 0.7197473701693682, 0.0,
    0.5096843264509942, -0.8603614864521753, 0.0,
    0.47313172525019465, -0.8809916972150046, 0.0,
    -0.003637959044835528, 0.9999933826050991, 0.0,
    0.5637816433398299, -0.8259238818638439, 0.0,
    -0.8343375083968227, 0.5512539542553702, 0.0,
    -0.8843323228993865, 0.4668579469982012, 0.0,
    0.8976102438495904, -0.4407900295336532, 0.0,
    0.8809573365733816, -0.47319570067524247, 0.0,
    -0.18434087797557186, 0.982862371193035, 0.0,
    -0.8802733835516019, -0.47446682730262013, 0.0,
    -0.9989169986212127, -0.04652773222055871, 0.0,
    0.6033142620947886, -0.797503543034776, 0.0
]);
new Float32Array(FLOWERS.slice(0, FLOWERS.length / 2));
new Float32Array(FLOWERS.slice(FLOWERS.length / 2));
const TILES_FLOWERS = sortInstancesByTiles(FLOWERS, TILES_COUNT, SIZE, PADDING, CULLED_TILES);
const GRASS1 = new Float32Array([
    -97.8327, 117.342, 0.69328,
    -111.633, 96.0024, 0.63766,
    -97.2021, 155.132, 0.36827,
    -154.819, 80.5617, 0.24186,
    -30.1532, 64.3189, 0.02491,
    -47.8267, 56.7768, 0.74484,
    -70.7269, 149.215, 0.66939,
    -101.388, 77.1888, 0.01608,
    -13.5901, -0.286582, 0.30126,
    -38.5456, 84.7179, 0.22045,
    -41.8196, 41.7573, 0.63355,
    -131.462, 80.5613, 0.74526,
    -61.9944, 85.9636, 0.79867,
    -101.774, 59.077, 0.39862,
    -150.927, 69.8197, 0.19171,
    -70.9281, 91.9282, 0.03574,
    121.045, -104.797, 0.51456,
    115.438, -67.0238, 0.00160,
    110.222, 30.762, 0.20005,
    -57.6145, -30.3018, 0.14702,
    -37.5022, -99.4647, 0.16389,
    86.7184, 89.8945, 0.14714,
    0.701865, 47.0858, 0.19826,
    45.8065, 0.863282, 0.00040,
    107.237, 121.574, 0.13187,
    13.2823, 41.5099, 0.36785,
    -132.866, 111.532, 0.85905,
    101.09, 94.8165, 0.03887,
    -48.4459, -69.2061, 0.21764,
    -70.0844, -129.262, 0.06406,
    -132.148, 0.457548, 0.93870,
    15.875, 23.6906, 0.65892,
    -141.043, -82.0164, 0.68783,
    59.6386, 48.6978, 0.94631,
    73.3649, -66.73, 0.38010,
    52.8335, 20.0134, 0.78251,
    89.5817, 105.738, 0.14429,
    50.92, 67.7286, 0.86970,
    16.6343, 6.65897, 0.17232,
    63.3694, -100.471, 0.48565,
    19.9507, 33.7931, 0.73958,
    -61.1721, -59.6412, 0.72555,
    25.4066, 84.3105, 0.60059,
    75.5511, 52.3604, 0.63947,
    50.4259, -10.1633, 0.20878,
    -90.6659, 48.4627, 0.67467,
    116.324, 5.18666, 0.94642,
    -43.59, -24.381, 0.40163,
    -44.7389, -55.1578, 0.16274,
    40.1454, 91.8185, 0.82877,
    -57.6158, -47.2884, 0.79503,
    -38.8279, -42.8392, 0.54204,
    88.2564, -74.1988, 0.85545,
    37.2427, 22.2765, 0.69772,
    36.0891, -21.9179, 0.50563,
    63.943, 60.0359, 0.99902,
    92.5023, 64.5061, 0.89414,
    -132.081, -96.395, 0.90160,
    114.868, 93.951, 0.60681,
    63.0208, 29.0235, 0.23999,
    56.6394, 79.0495, 0.29515,
    121.559, 125.155, 0.10677,
    124.812, 64.4218, 0.48642,
    -47.7045, -90.4934, 0.97986,
    124.707, 78.9322, 0.58498,
    153.002, 4.1807, 0.59777,
    -27.5848, -86.4617, 0.00351,
    -15.2397, -142.182, 0.12995,
    -23.8334, -131.783, 0.22960,
    -55.3915, -111.15, 0.34782,
    136.47, 80.4205, 0.76765,
    -18.6615, -118.831, 0.02501,
    -37.2174, -121.439, 0.32615,
    90.2413, 50.2349, 0.39028,
    125.095, 20.2994, 0.14931,
    98.2974, 4.54914, 0.68756,
    38.5574, 80.3908, 0.86000,
    -37.5985, -166.501, 0.60437,
    5.36929, -166.5, 0.86020,
    -16.1146, -166.5, 0.77322,
    26.8532, -166.5, 0.88375,
    -59.0824, -166.501, 0.30879,
    -123.534, -166.502, 0.33505,
    -145.018, -166.502, 0.08642,
    -80.5663, -166.501, 0.22275,
    -166.502, -166.503, 0.24738,
    -102.05, -166.502, 0.87681,
    134.273, -166.498, 0.16631,
    69.8209, -166.499, 0.23597,
    91.3048, -166.499, 0.76931,
    112.789, -166.498, 0.60850,
    48.3371, -166.499, 0.22851,
    -76.2696, -15.783, 0.31761,
    -151.079, -69.658, 0.50249,
    -145.984, -110.388, 0.88438,
    -152.501, -140.636, 0.01130,
    -121.344, -26.8583, 0.16519,
    -124.193, -112.794, 0.39216,
    -147.257, -94.8343, 0.76125,
    -77.5196, 11.8978, 0.12987,
    -61.2458, -7.2059, 0.20577,
    -151.448, -41.1804, 0.52948,
    -47.9898, -13.1596, 0.25482,
    -59.4781, 7.32497, 0.15209,
    -151.448, -12.5352, 0.83425,
    75.8256, -124.231, 0.29041,
    116.369, -152.232, 0.07512,
    121.143, -140.316, 0.43655,
    37.595, -156.601, 0.21039,
    102.046, -123.701, 0.63696,
    87.0681, -131.189, 0.33558,
    154.297, -124.22, 0.91253,
    59.0781, -113.66, 0.51801,
    145.014, -145.015, 0.45521,
    129.896, -125.601, 0.15811,
    150.231, -113.708, 0.25673,
    97.0022, -154.788, 0.68242,
    102.252, -65.188, 0.86293,
    45.4582, -111.862, 0.06740,
    39.7019, -85.122, 0.32018,
    83.3327, -145.634, 0.89137,
    66.3527, -135.332, 0.16702,
    16.1098, -81.0868, 0.42299,
    -5.37338, -121.767, 0.57686,
    -143.896, -126.094, 0.37966,
    -69.8252, -114.74, 0.80601,
    -5.3729, -151.589, 0.08938,
    5.36897, -146.619, 0.60732,
    19.6197, -36.7624, 0.81701,
    -134.09, -39.7899, 0.23239,
    -69.8246, -149.247, 0.18302,
    -4.08674, -43.6696, 0.56548,
    10.5476, -53.8396, 0.20050,
    39.959, -42.0983, 0.39801,
    -84.844, 0.180354, 0.09109,
    -154.995, -124.853, 0.38390,
    -130.541, -135.13, 0.17984,
    -133.031, -156.045, 0.25110,
    -113.999, 48.9306, 0.56927,
    -131.239, 47.9151, 0.17558,
    -14.4579, 158.786, 0.87218,
    -79.0284, 81.5185, 0.84514,
    -60.646, 102.879, 0.75443,
    -114.828, 84.5842, 0.53857,
    -8.68415, 103.34, 0.23811,
    10.8075, 74.5183, 0.25837,
    -95.4358, 36.6476, 0.90962,
    -27.1552, 76.8092, 0.18768,
    -109.644, 112.104, 0.88732,
    -136.857, 59.4754, 0.81957,
    -127.439, 62.9891, 0.85345,
    32.1777, 64.1003, 0.16107,
    10.339, 92.9731, 0.53760,
    -143.55, 132.485, 0.83470,
    -130.557, 97.048, 0.80864,
    -90.4078, 104.602, 0.28576,
    -94.6497, 88.3731, 0.17651,
    82.7165, 76.0061, 0.17664,
    -21.6847, -156.126, 0.12612,
    -84.1033, 68.2832, 0.15140,
    108.114, 77.4842, 0.86387,
    104.549, 67.2775, 0.18080,
    2.82746, 109.004, 0.96529,
    -21.8347, 35.9841, 0.90299,
    -21.7546, 130.492, 0.27289,
    33.7507, 142.961, 0.89812,
    -78.7409, 108.09, 0.16995,
    -115.575, 141.442, 0.52815,
    -166.498, 112.788, 0.48640,
    -166.497, 134.272, 0.32868,
    -166.497, 155.755, 0.99671,
    -166.498, 91.3038, 0.71151,
    -166.498, 69.8199, 0.17195,
    48.3386, 129.735, 0.96812,
    -16.1129, 119.625, 0.31695,
    93.6934, 143.825, 0.78680,
    91.3065, 123.535, 0.23978,
    -1.79055, 150.876, 0.52864,
    26.855, 98.0225, 0.35980,
    48.3385, 154.247, 0.66167,
    -140.173, -10.944, 0.96143,
    -29.5597, 7.98718, 0.24093,
    0.647622, -26.9062, 0.70941,
    -81.3232, -44.0383, 0.24891,
    -95.6727, -73.2651, 0.95443,
    -101.186, -131.014, 0.88373,
    -97.6119, -115.956, 0.74197,
    -145.662, -31.1685, 0.10642,
    -86.8985, -117.901, 0.36739,
    -67.2379, -30.4572, 0.91132,
    -54.3087, -133.035, 0.23974,
    26.8529, -146.675, 0.15081,
    -86.1194, -140.011, 0.12038,
    -92.0965, -16.8618, 0.71653,
    19.3717, -138.924, 0.28978,
    -58.7504, -84.3747, 0.23296,
    -124.793, -81.557, 0.65761,
    -82.0045, -77.9833, 0.51162,
    32.8621, -110.634, 0.43219,
    -120.722, -3.7931, 0.30104,
    -20.6941, 55.5948, 0.77893,
    -74.7876, 49.6637, 0.94891,
    -45.6392, 4.60336, 0.89891,
    -104.239, -27.6496, 0.53670,
    -108.776, -16.6938, 0.78578,
    -144.001, -54.0564, 0.67930,
    -118.64, -126.313, 0.67086,
    -89.5786, -157.671, 0.96864,
    -90.083, -95.6524, 0.97287,
    -72.8862, -98.2557, 0.88956,
    -106.886, -80.5135, 0.18515,
    27.235, -96.5623, 0.55537,
    -104.751, -98.9523, 0.78470,
    -166.5, -37.5995, 0.20265,
    -166.5, -16.1156, 0.36457,
    -166.499, 48.336, 0.24528,
    -166.499, 5.36825, 0.81875,
    -166.499, 26.8521, 0.09265,
    166.499, 80.5678, 0.05860,
    166.5, 123.536, 0.74380,
    134.274, 134.278, 0.05174,
    148.597, 148.6, 0.95587,
    135.468, 149.794, 0.63959,
    166.499, 102.052, 0.80722,
    166.5, 145.019, 0.64077,
    166.499, 59.0839, 0.57421,
    166.499, 37.6, 0.18838,
    166.5, 166.503, 0.38199,
    166.498, -134.271, 0.42335,
    166.498, -112.787, 0.98146,
    166.498, -91.3033, 0.21302,
    166.498, -69.8194, 0.42172,
    166.499, -26.8516, 0.21857,
    166.499, -5.36776, 0.69881,
    166.498, -155.755, 0.53251,
    166.499, -48.3355, 0.51442,
    166.499, 16.1161, 0.22763,
    155.756, -166.498, 0.09302,
    132.917, -48.558, 0.94499,
    54.3418, -128.599, 0.46440,
    57.4451, -77.4151, 0.40467,
    125.579, -9.28856, 0.21641,
    52.075, -92.0659, 0.18822,
    28.7566, 4.0129, 0.40666,
    114.875, -54.3928, 0.52313,
    106.73, -139.602, 0.99079,
    -28.9152, -14.3759, 0.97246,
    87.4612, -53.0666, 0.47456,
    23.525, -65.1817, 0.20867,
    114.818, -21.1619, 0.45707,
    13.2971, -128.056, 0.03119,
    27.7012, -48.0141, 0.89439,
    -25.1657, -29.6815, 0.62430,
    69.9336, -152.945, 0.72115,
    157.552, -83.7297, 0.23837,
    5.27137, -7.72662, 0.37061,
    149.148, -95.8348, 0.89003,
    -6.07836, -92.9364, 0.52791,
    102.463, -85.3679, 0.87838,
    102.394, -104.872, 0.66830,
    111.445, -118.058, 0.70568,
    129.186, -81.4908, 0.91072,
    97.4481, -20.2317, 0.26760,
    131.885, -154.582, 0.08720,
    139.929, -109.792, 0.21975,
    143.069, -131.612, 0.95486,
    58.2369, 8.74026, 0.21878,
    17.8826, -13.492, 0.06184,
    111.762, -86.5425, 0.51585,
    -13.9526, -13.8562, 0.09048,
    0.842643, -77.2816, 0.59982,
    -37.599, -134.336, 0.99918,
    110.783, -37.7455, 0.37486,
    136.13, 5.37434, 0.21161,
    111.597, 133.084, 0.98299,
    108.131, -10.5534, 0.91328,
    156.376, -8.94835, 0.23388,
    158.065, 106.826, 0.96514,
    -150.926, 91.3036, 0.03909,
    136.137, -67.8633, 0.00860,
    89.423, -0.884165, 0.82838,
    144.512, 111.998, 0.10803,
    131.589, -60.2449, 0.50367,
    92.6288, -42.4383, 0.00216,
    141.197, 94.8905, 0.93537,
    -43.5665, -150.288, 0.57656,
    97.3377, 25.085, 0.46936,
    122.818, 48.3422, 0.34340,
    158.271, 28.0517, 0.18906,
    -55.502, -150.028, 0.53569,
    17.4144, 127.585, 0.24315,
    118.806, 108.104, 0.08571,
    79.7726, 27.797, 0.23346,
    -148.577, 114.58, 0.66684,
    141.816, 30.4389, 0.92491,
    158.065, 92.5033, 0.16651,
    148.429, 123.27, 0.88512,
    -11.1473, 143.353, 0.67208,
    139.66, -90.0665, 0.07768,
    103.848, -30.2458, 0.93798,
    138.413, 43.7005, 0.25072,
    80.5642, 166.503, 0.01184,
    59.0803, 166.503, 0.58031,
    145.016, 166.503, 0.02524,
    102.048, 166.503, 0.88794,
    123.532, 166.503, 0.85750,
    -112.791, 166.501, 0.81875,
    -91.3069, 166.502, 0.50155,
    -69.823, 166.502, 0.51698,
    -155.759, 166.501, 0.65785,
    -166.502, -145.019, 0.18932,
    -166.501, -102.051, 0.02710,
    -166.501, -123.535, 0.76915,
    -166.5, -59.0834, 0.50338,
    -166.501, -80.5673, 0.82358,
    -30.4357, 150.876, 0.18506,
    14.2563, 114.415, 0.24919,
    -67.4619, 114.999, 0.25517,
    -1.21572, 128.305, 0.51825,
    -54.6316, 126.722, 0.23181,
    20.8869, 149.038, 0.98772,
    32.0268, 125.599, 0.77313,
    -38.0035, 128.5, 0.23789,
    -58.4295, 136.667, 0.02543,
    5.9602, 142.74, 0.76485,
    37.5965, 166.502, 0.98872,
    -26.8552, 166.502, 0.82186,
    -48.3391, 166.502, 0.39277,
    -5.37131, 166.502, 0.46000,
    16.1126, 166.502, 0.63486,
    -79.8168, 125.768, 0.74602,
    -69.9399, 132.047, 0.10015,
    -83.9283, 144.475, 0.78737,
    -116.371, 154.42, 0.85729,
    -128.306, 139.65, 0.32252,
    -153.767, 143.226, 0.17207,
    -138.782, 149.792, 0.08598,
    -45.7348, 151.348, 0.63709,
    -134.275, 166.501, 0.79699,
    0.9968935124625302, -0.07876118847579174, 0.0,
    0.6723239550941096, -0.7402570495487455, 0.0,
    -0.7921827059004907, -0.6102839998493952, 0.0,
    -0.8851132523678202, -0.46537568746428865, 0.0,
    -0.6101472853415748, 0.7922880096216949, 0.0,
    0.8276889480744266, 0.5611871392284833, 0.0,
    0.9664157679278241, 0.2569835860526386, 0.0,
    -0.12088443424982952, 0.9926665873071878, 0.0,
    0.5862244331925074, 0.8101486986523668, 0.0,
    0.9874923703463258, 0.15766679583157364, 0.0,
    0.46115837698748563, 0.8873178412126447, 0.0,
    -0.9825430051060641, -0.18603559637108413, 0.0,
    -0.9988351865157414, -0.04825215205629743, 0.0,
    0.27856900535103635, -0.9604162166778184, 0.0,
    0.8508055694756316, -0.5254806209074188, 0.0,
    -0.3384709787019663, -0.9409768310519303, 0.0,
    -0.911784166653668, 0.4106697376721057, 0.0,
    -0.9478642499492393, -0.3186743850204561, 0.0,
    -0.9418738741718355, -0.3359666726812904, 0.0,
    0.6400794264743114, -0.7683087451046725, 0.0,
    0.7384465261510355, 0.674312040538702, 0.0,
    -0.74686051831799, -0.6649807261701525, 0.0,
    0.9906275440159951, -0.1365908819681525, 0.0,
    0.7387961038435357, -0.6739290147675878, 0.0,
    0.5580669543134833, 0.8297959234072391, 0.0,
    -0.6730493003250919, -0.7395976198798264, 0.0,
    -0.44008949800477526, 0.8979539151570669, 0.0,
    -0.6331823533046086, -0.7740026533957347, 0.0,
    0.23154123537185028, -0.9728250903027108, 0.0,
    0.6727823026045777, 0.739840505313194, 0.0,
    -0.4125151766856114, 0.9109507280879898, 0.0,
    -0.17663374685749067, -0.9842766478338719, 0.0,
    -0.14810874181646047, 0.9889710817802233, 0.0,
    -0.022031958312998992, -0.9997572669467796, 0.0,
    0.7277401238703228, 0.6858529814101615, 0.0,
    -0.5233968511641724, -0.8520890424077927, 0.0,
    -0.9162089661802337, 0.400700798964698, 0.0,
    -0.815597934184227, 0.5786190540886303, 0.0,
    0.6070767426977205, -0.7946432082862885, 0.0,
    -0.8844557138247494, 0.4666241424130914, 0.0,
    -0.9605277815347336, 0.2781840773659829, 0.0,
    -0.88260204094409, -0.47012087522394375, 0.0,
    0.6792537062478927, -0.7339035376318208, 0.0,
    0.006504620041837252, -0.9999788447352831, 0.0,
    0.2156819483945862, 0.9764636691330175, 0.0,
    0.7332536612569268, 0.6799551957690388, 0.0,
    0.3862963411216232, 0.9223747269066117, 0.0,
    0.48084172621981897, -0.8768074100541947, 0.0,
    -0.16702521354096633, 0.9859526246435955, 0.0,
    -0.974093866938832, -0.2261440655691698, 0.0,
    -0.30647268827483987, 0.9518794521059863, 0.0,
    0.1822812061494954, -0.98324644005696, 0.0,
    -0.9948307429946677, 0.10154699795009946, 0.0,
    0.90546661053682, -0.42441750341257467, 0.0,
    0.7342243260561514, 0.6789069443063536, 0.0,
    -0.30768180058062555, 0.9514893113385269, 0.0,
    0.9708991696744143, -0.23948862671436608, 0.0,
    -0.790060416395461, -0.613028986627085, 0.0,
    0.7975102524922362, -0.6033053929559802, 0.0,
    -0.9767414248591745, -0.21442058894628, 0.0,
    0.9257567334147833, -0.37811965108572426, 0.0,
    0.7270945811751768, -0.6865373041763239, 0.0,
    0.7343481996000437, -0.6787729530146103, 0.0,
    -0.522912584926231, 0.8523863141356548, 0.0,
    -0.471867749784291, -0.8816693409172793, 0.0,
    0.8807508577280021, -0.4735799052022675, 0.0,
    0.9650828664129425, -0.2619447669952173, 0.0,
    -0.9366205849481509, -0.35034537224199735, 0.0,
    0.37826582962583344, -0.925697014220895, 0.0,
    0.8690548437199268, -0.49471575536557727, 0.0,
    0.29050411393329967, 0.9568737428667528, 0.0,
    0.9913289190060367, 0.1314038596934002, 0.0,
    -0.38295374590280257, -0.9237675186425488, 0.0,
    0.9990481497917022, 0.04362103159917815, 0.0,
    -0.20051406949310707, -0.9796908226248286, 0.0,
    0.29449657013476166, -0.9556525363220993, 0.0,
    -0.9873622976964707, -0.15847931438375806, 0.0,
    0.9375499606791535, 0.34785064500517693, 0.0,
    0.9996299931981524, -0.027200674599387988, 0.0,
    0.11796177768098429, -0.9930181362927578, 0.0,
    -0.8035550236368435, 0.595230479720244, 0.0,
    0.44896705555719074, -0.8935483104031401, 0.0,
    0.8654055994924642, -0.5010719991848362, 0.0,
    -0.4393734553394153, 0.8983044955598869, 0.0,
    -0.9937502333046269, 0.11162649240659489, 0.0,
    0.936716831626061, -0.3500879565886745, 0.0,
    -0.6094072959066223, 0.7928573312366975, 0.0,
    -0.94684962877967, -0.3216765152755187, 0.0,
    0.04082028532316609, -0.99916650479594, 0.0,
    0.5750236656660002, -0.8181367758046548, 0.0,
    -0.8170547366652116, -0.576560107268047, 0.0,
    -0.620454881428756, 0.7842421437994953, 0.0,
    0.7319253195467444, -0.6813848593903419, 0.0,
    0.0771191547994578, -0.997021883392244, 0.0,
    0.1642885735618308, -0.9864123197715137, 0.0,
    0.977777919340628, -0.20964336490791327, 0.0,
    -0.49304947472892824, 0.8700012732574177, 0.0,
    -0.9726213842522706, 0.23239544508272322, 0.0,
    -0.23673155741279983, -0.9715750973161623, 0.0,
    -0.9992811526628622, 0.037910129685632364, 0.0,
    0.6685319621431816, -0.743683410863109, 0.0,
    -0.9487216645041077, 0.3161126433734587, 0.0,
    0.735999992736664, 0.676981543833826, 0.0,
    0.4865715093487757, 0.873640753565248, 0.0,
    -0.8312317487696298, -0.5559260560878425, 0.0,
    0.6374882245485798, -0.7704600986176374, 0.0,
    -0.9923280015332155, -0.12363307556270885, 0.0,
    0.3880964028233058, 0.9216187835084582, 0.0,
    -0.9976129864294325, 0.0690530904981725, 0.0,
    0.7836528932950271, 0.6211989559153597, 0.0,
    0.9559014653978755, 0.29368756945126956, 0.0,
    0.9605658264082578, 0.2780526805060881, 0.0,
    -0.9988351915141985, 0.048252048586504157, 0.0,
    -0.9072849310662584, -0.42051641330641865, 0.0,
    0.47164904457018514, -0.8817863566397653, 0.0,
    0.5963292354608856, -0.8027399597220981, 0.0,
    0.9383037859799485, -0.34581209524204776, 0.0,
    -0.9279142055306012, 0.37279381321920185, 0.0,
    -0.6333624569994416, 0.7738552823775454, 0.0,
    -0.1490507213420222, 0.9888295517769596, 0.0,
    0.9392092907209932, 0.3433451735839152, 0.0,
    -0.4789190878152192, 0.8778590475276987, 0.0,
    0.6451809705892166, -0.764029786847055, 0.0,
    -0.9436488064160329, -0.33094853096757576, 0.0,
    -0.33678538041032896, 0.9415814396757564, 0.0,
    0.9983854853450156, -0.05680160783285686, 0.0,
    -0.5198348566278815, -0.8542667743946676, 0.0,
    0.3762188564226291, 0.9265308262934641, 0.0,
    0.27600241145479365, -0.9611569428928549, 0.0,
    0.6452906276792323, -0.7639371740066997, 0.0,
    0.9090905274421146, -0.4165986232754712, 0.0,
    -0.35668337575998665, 0.9342253312003802, 0.0,
    -0.8122654513918494, -0.5832879533088225, 0.0,
    -0.9989278266315128, 0.04629467767726967, 0.0,
    -0.9999974498328342, -0.0022583905393424018, 0.0,
    0.6948730866622761, -0.7191323893640453, 0.0,
    0.960516719317128, -0.27822227069783884, 0.0,
    0.786795383438163, -0.6172139212626316, 0.0,
    -0.4518826014937054, 0.8920774150640072, 0.0,
    0.2013106191585912, 0.9795274547525377, 0.0,
    -0.9979415225695556, -0.0641304727220778, 0.0,
    -0.9986266363876773, -0.052391231108207835, 0.0,
    0.5060943223841193, 0.8624781370275765, 0.0,
    -0.8834051166589697, -0.46861007229972357, 0.0,
    -0.411531506838297, -0.9113955337170578, 0.0,
    -0.9650437283578462, 0.26208892070667067, 0.0,
    0.8910369786544508, -0.45393072452781597, 0.0,
    0.015408556125862677, 0.9998812811519756, 0.0,
    -0.833910651027204, 0.5518994710120538, 0.0,
    0.5043537096280559, -0.8634971543580319, 0.0,
    0.9918819089671735, -0.12716241057653668, 0.0,
    0.033233385699222254, -0.9994476184748087, 0.0,
    0.9820437958063837, 0.18865307608992174, 0.0,
    -0.8253763987798771, 0.5645828551569392, 0.0,
    0.3562016905166767, 0.9344090943869616, 0.0,
    -0.8639023145822013, 0.5036593996536899, 0.0,
    -0.001545482454307891, -0.9999988057412786, 0.0,
    0.9963798704333664, 0.08501266843940322, 0.0,
    0.24376676359882532, 0.9698338852424957, 0.0,
    0.9731749030103604, -0.23006652983599285, 0.0,
    -0.8618449799005135, 0.5071717959629494, 0.0,
    0.5396255170425832, -0.84190516173529, 0.0,
    0.8867848867559673, 0.4621823932401645, 0.0,
    -0.9762894511931612, 0.2164691836935597, 0.0,
    -0.9595344667998169, -0.281591205514645, 0.0,
    0.335912183054062, -0.9418933088603265, 0.0,
    -0.5287139280733865, -0.8488000838013683, 0.0,
    -0.3825041414540365, 0.9239537768581881, 0.0,
    -0.2995957587061823, -0.9540662353134959, 0.0,
    0.7578107114464053, -0.6524744635747004, 0.0,
    -0.5470624829919579, -0.8370917749582024, 0.0,
    0.8081083148906272, -0.589033913628605, 0.0,
    0.8538207060305839, 0.5205671925442816, 0.0,
    0.994462383177442, -0.10509314176026208, 0.0,
    0.7714928412566755, -0.6362380025506982, 0.0,
    -0.8884620114319931, 0.45895016531451105, 0.0,
    -0.054468710779565443, 0.9985154778700288, 0.0,
    -0.32249285870536376, 0.9465718969439365, 0.0,
    -0.9339718214216218, -0.35734666192701187, 0.0,
    0.5336869611222017, -0.8456821078444013, 0.0,
    0.7079417667949243, -0.7062708084207368, 0.0,
    -0.9873423240431654, 0.15860370472672164, 0.0,
    -0.5793301464450799, -0.8150929894312197, 0.0,
    0.9686918953929474, -0.24826601015849717, 0.0,
    0.7562160214799899, -0.6543220375755163, 0.0,
    0.23019162427488699, 0.9731453211692944, 0.0,
    0.5995192772909068, -0.8003603164554005, 0.0,
    0.789263169974853, 0.6140550859012947, 0.0,
    0.8457473577310505, 0.5335835519306669, 0.0,
    -0.7608079081783738, 0.6489771389295982, 0.0,
    0.7048593261422651, 0.7093471155578712, 0.0,
    -0.9990607332607313, 0.043331873448188216, 0.0,
    -0.15063267585502157, -0.9885898021751772, 0.0,
    0.9929529065448459, 0.11850960038808, 0.0,
    -0.9172221041244479, -0.39837621880016943, 0.0,
    -0.8020994651486297, 0.5971904620875003, 0.0,
    0.9861624895423944, 0.1657816160481819, 0.0,
    0.9948148844882195, -0.101702239900065, 0.0,
    0.17040134837397342, 0.9853747411377722, 0.0,
    0.8639924328261194, -0.5035047924490923, 0.0,
    0.5116357177499814, 0.8592024745788744, 0.0,
    -0.6191979153408445, 0.7852349595105611, 0.0,
    -0.7774276214005179, 0.6289724107490988, 0.0,
    -0.5453009144139369, -0.8382403669230708, 0.0,
    0.9538097132088036, 0.30041143618134764, 0.0,
    -0.7535707471754656, 0.6573668146487245, 0.0,
    0.7684122497963374, -0.6399551659006522, 0.0,
    -0.7691127373547546, 0.6391131333642552, 0.0,
    0.6717504675163464, -0.7407775032974274, 0.0,
    0.14394128315723173, -0.9895862302008096, 0.0,
    -0.14441853265199772, 0.9895166938595042, 0.0,
    0.05498135811309803, -0.9984873811220847, 0.0,
    0.47490925387255956, -0.880034772373347, 0.0,
    -0.9766606275964168, -0.2147883109086089, 0.0,
    -0.8487104836256103, -0.5288577455081684, 0.0,
    0.888461149630923, -0.4589518336345314, 0.0,
    0.9143791472425669, -0.40485895703066305, 0.0,
    0.8258910224224726, 0.5638297784632902, 0.0,
    0.3348964587539573, 0.9422549346721719, 0.0,
    -0.3131675967364804, 0.9496978763555793, 0.0,
    0.9695027922070109, 0.24508026420503434, 0.0,
    -0.7378295096833676, 0.6749871218330031, 0.0,
    -0.0047726406647966724, 0.9999886108856864, 0.0,
    0.16050897399269792, -0.987034380995825, 0.0,
    0.060260612840242894, -0.9981826779403249, 0.0,
    -0.914086529618584, 0.4055191935899625, 0.0,
    -0.44181664960316336, 0.8971053718117151, 0.0,
    0.6044820664244377, -0.7966187490708725, 0.0,
    -0.9999041078384492, 0.01384828970649438, 0.0,
    -0.8305260953442269, 0.5569797168230385, 0.0,
    -0.9457461664724546, 0.3249064305344789, 0.0,
    0.8112509361603139, -0.5846981431294394, 0.0,
    -0.9960996583447262, 0.08823531405009906, 0.0,
    0.8549911199163045, -0.5186426369517486, 0.0,
    -0.42609573518137517, 0.9046780778046096, 0.0,
    0.2838094640920206, -0.9588806954422433, 0.0,
    0.24659973518222458, -0.969117418380279, 0.0,
    -0.9757152100524065, -0.2190429840747891, 0.0,
    -0.4257425346228848, -0.904844348058207, 0.0,
    -0.5140688220839642, 0.857748941218353, 0.0,
    -0.7665027883676253, -0.642240979247397, 0.0,
    -0.3590019687420476, 0.9333368022527205, 0.0,
    0.9711122463876414, 0.2386231441330636, 0.0,
    0.8499093240788704, -0.5269289713460416, 0.0,
    -0.8853879097258458, -0.4648529329920351, 0.0,
    0.3940680518306465, -0.9190812643756802, 0.0,
    0.5438712363542627, 0.8391686828442096, 0.0,
    0.9798876889698744, -0.19954978578108912, 0.0,
    0.3359491368515647, 0.9418801290231622, 0.0,
    0.6403701321044023, -0.7680664645124081, 0.0,
    -0.7329923242388556, 0.680236909177178, 0.0,
    0.02797033250973034, 0.999608753712819, 0.0,
    -0.9966923248246571, 0.0812675189458876, 0.0,
    0.4144072657695442, 0.9100915437896401, 0.0,
    -0.6944934391508775, 0.7194990361191504, 0.0,
    -0.9617131816757374, -0.2740579431272337, 0.0,
    -0.9844130060254395, 0.1758722080601656, 0.0,
    -0.6459904593419546, 0.7633454830148473, 0.0,
    -0.04346330959384442, -0.9990550238696313, 0.0,
    0.9814727873501413, 0.19160158582627712, 0.0,
    0.8973416320648772, 0.44133660097837185, 0.0,
    -0.08768113796126925, -0.9961485923524748, 0.0,
    0.9951658095370897, 0.09820901958776009, 0.0,
    -0.24903148396386082, -0.9684953897643278, 0.0,
    -0.972421885682817, 0.2332288066364755, 0.0,
    -0.8823378878043542, -0.47061645927968865, 0.0,
    -0.29341601931518063, -0.9559848532321177, 0.0,
    0.4702183213111021, -0.8825501290597431, 0.0,
    0.2547837538154307, 0.9669980552160992, 0.0,
    0.135319078772395, -0.9908020725251792, 0.0,
    0.34020796836362266, -0.9403502210676065, 0.0,
    0.6121466903488944, -0.7907442250784351, 0.0,
    -0.5336889719720874, 0.8456808388484254, 0.0,
    0.09561072747148082, -0.9954188007026863, 0.0,
    0.08831719450096448, -0.9960924019163477, 0.0,
    0.21057574681081237, -0.9775775441646911, 0.0,
    -0.2935374689398417, -0.9559475688176583, 0.0,
    0.671377955185843, 0.7411151336266695, 0.0,
    -0.8766039781027927, 0.4812124952392224, 0.0,
    0.4294347178557896, -0.9030979033859609, 0.0,
    0.9455357990641323, 0.32551812958444093, 0.0,
    -0.9564512793490292, -0.2918920181019092, 0.0,
    0.545710479942646, -0.8379737896144288, 0.0,
    -0.7440915306971193, -0.6680776855612062, 0.0,
    0.6557571675287798, -0.7549718784396091, 0.0,
    0.34181041088552105, 0.9397689306474604, 0.0,
    0.43101024493159373, 0.9023470334433463, 0.0,
    0.9559161699987233, -0.29363970428906916, 0.0,
    -0.9963303843124527, -0.08559068463215058, 0.0,
    0.5914160685028448, -0.8063665629951668, 0.0,
    0.27007784917706296, 0.9628384887320882, 0.0,
    0.9164482056302379, 0.4001533286093185, 0.0,
    0.5288454496129684, 0.8487181454544596, 0.0,
    0.1332796931448377, 0.9910784648024685, 0.0,
    0.7640766434452658, -0.6451254784469578, 0.0,
    -0.7060534978279984, -0.7081584979401495, 0.0,
    -0.7895126716225966, 0.6137342595515993, 0.0,
    -0.4184226899656213, 0.9082524167443397, 0.0,
    -0.7410112759851668, -0.671492582879986, 0.0,
    0.9540060578912025, -0.2997873271285623, 0.0,
    -0.924452442722322, -0.38129736577208617, 0.0,
    0.40765634972866727, 0.9131354228841955, 0.0,
    -0.8236716798057041, -0.5670669835972199, 0.0,
    -0.32340950331027757, -0.9462591046688003, 0.0,
    -0.16800044772581013, 0.9857869189454318, 0.0,
    0.9528070410230349, -0.30357658436863777, 0.0,
    -0.5631106356428678, 0.82638151723395, 0.0,
    0.3281922623844936, -0.9446109457924716, 0.0,
    -0.4213645854808049, -0.9068913309226136, 0.0,
    0.01717471326290172, 0.9998525037345944, 0.0,
    0.9997050666224605, 0.024285381804324484, 0.0,
    0.9937746240471731, -0.11140914055812412, 0.0,
    0.7775293899147098, -0.6288466011825612, 0.0,
    -0.9607470274166974, 0.27742593481861016, 0.0,
    -0.9713812898691131, -0.23752555587182217, 0.0,
    0.9798032998709515, -0.19996373061631512, 0.0,
    -0.2632933065723885, -0.9647158310684957, 0.0,
    -0.7322666637615709, 0.6810180123487913, 0.0,
    -0.5496659884479427, 0.8353845229255484, 0.0,
    0.37311457960678635, -0.9277852717546508, 0.0,
    -0.8837268364120121, -0.468003075422819, 0.0,
    -0.5211907132370185, -0.8534402383503417, 0.0,
    -0.9912005596143479, 0.13236861644741713, 0.0,
    0.9536195851852535, 0.30101442947324814, 0.0,
    0.023263746650139548, 0.9997293624235501, 0.0,
    0.9848074843276047, 0.17364970144614314, 0.0,
    0.9897876968394407, -0.14254934298436983, 0.0,
    -0.07269915373415965, 0.9973539156419535, 0.0,
    -0.9289750940897291, -0.37014223558110587, 0.0,
    0.770654694434567, 0.6372529654273601, 0.0,
    0.5968625224755877, 0.8023435232268524, 0.0,
    -0.74910841450201, -0.6624474192887195, 0.0,
    -0.9874781538661086, 0.15775581015348358, 0.0,
    -0.9956147414192907, -0.09354831194948865, 0.0,
    -0.5714013720925019, 0.8206707451656884, 0.0,
    -0.36866306388026016, -0.9295630937867635, 0.0,
    0.3475865073529601, -0.937647918947283, 0.0,
    -0.42754895476632293, 0.903992196469762, 0.0,
    -0.7908534733084855, 0.6120055422591404, 0.0
]);
const TILES_GRASS1 = sortInstancesByTiles(GRASS1, TILES_COUNT, SIZE, PADDING, CULLED_TILES);
const GRASS2 = new Float32Array([
    -135.549, 16.1097, 0.12055,
    -147.726, 6.56152, 0.03329,
    -130.541, -135.13, 0.91595,
    -144.001, -54.0564, 0.00070,
    -132.148, 0.457548, 0.36004,
    -142.863, 35.3392, 0.23895,
    -131.239, 47.9151, 0.46836,
    -136.857, 59.4754, 0.43825,
    -129.477, -51.3309, 0.94129,
    122.818, 48.3422, 0.91146,
    67.503, -51.5735, 0.02476,
    80.3651, -19.896, 0.45353,
    136.137, -67.8633, 0.47462,
    80.1656, -37.9693, 0.81894,
    -102.049, 130.257, 0.77958,
    -38.0035, 128.5, 0.45273,
    -43.5479, 101.709, 0.07360,
    122.736, 152.578, 0.39981,
    72.4748, 137.405, 0.25310,
    66.1975, 150.198, 0.15680,
    17.4144, 127.585, 0.03674,
    89.423, -0.884165, 0.98540,
    -99.2771, -39.2287, 0.20648,
    -81.3232, -44.0383, 0.95349,
    150.606, 52.3205, 0.09679,
    -116.749, -43.4893, 0.38586,
    79.7726, 27.797, 0.56389,
    97.3377, 25.085, 0.73853,
    111.597, 133.084, 0.73693,
    38.1273, 113.573, 0.95806,
    -113.999, 48.9306, 0.58556,
    33.7507, 142.961, 0.48011,
    -32.5548, 116.611, 0.17275,
    143.505, 67.4389, 0.25840,
    141.197, 94.8905, 0.83885,
    55.5, 117.098, 0.51596,
    -79.0284, 81.5185, 0.87610,
    -119.465, 122.966, 0.11790,
    108.235, 46.9016, 0.07138,
    32.1777, 64.1003, 0.14899,
    -84.1033, 68.2832, 0.76510,
    -30.2592, 96.5888, 0.33956,
    -57.4196, 48.0892, 0.83193,
    -95.4358, 36.6476, 0.23724,
    10.8075, 74.5183, 0.44742,
    -28.155, -48.9788, 0.33977,
    -21.5433, -60.9185, 0.65232,
    -115.575, 141.442, 0.86025,
    -29.4499, 19.6448, 0.10363,
    -7.50355, -57.8215, 0.92021,
    -29.5597, 7.98718, 0.11308,
    -109.644, 112.104, 0.83829,
    -81.1685, 22.6262, 0.62276,
    -62.6213, 27.7413, 0.62707,
    -28.9715, -75.9553, 0.62586,
    -74.7876, 49.6637, 0.71093,
    -6.07836, -92.9364, 0.38136,
    -25.1657, -29.6815, 0.37322,
    151.931, -41.031, 0.82542,
    23.525, -65.1817, 0.26978,
    27.7012, -48.0141, 0.38452,
    -95.0919, 18.4307, 0.75484,
    -58.7504, -84.3747, 0.92152,
    93.3745, -104.373, 0.97788,
    -126.669, 26.7611, 0.32932,
    -72.8862, -98.2557, 0.87250,
    -1.08236, 33.2659, 0.35388,
    -113.219, 16.2585, 0.42470,
    13.2971, -128.056, 0.80811,
    132.475, -22.6866, 0.47720,
    125.579, -9.28856, 0.92878,
    61.0135, -64.8289, 0.29325,
    75.8109, 11.8844, 0.09753,
    57.4451, -77.4151, 0.30443,
    66.1816, -5.5891, 0.90954,
    124.812, 64.4218, 0.62450,
    102.463, -85.3679, 0.80999,
    114.818, -21.1619, 0.37809,
    136.47, 80.4205, 0.57089,
    151.123, 80.6513, 0.03318,
    71.62, -82.2945, 0.37388,
    54.6005, -40.8618, 0.00568,
    89.1525, -90.6785, 0.28499,
    97.4481, -20.2317, 0.19940,
    -27.5848, -86.4617, 0.98057,
    -13.0122, -100.388, 0.43714,
    58.2369, 8.74026, 0.09302,
    5.26107, -103.755, 0.49414,
    0.653939, 13.2128, 0.14608,
    -16.8769, 22.9472, 0.32881,
    45.8065, 0.863282, 0.79771,
    -90.6659, 48.4627, 0.82752,
    -61.1721, -59.6412, 0.09954,
    76.0928, -114.088, 0.58460,
    73.3649, -66.73, 0.68710,
    37.2557, 48.8637, 0.42022,
    15.875, 23.6906, 0.74215,
    0.471659, 62.6952, 0.31289,
    -101.186, -131.014, 0.32557,
    20.9786, 57.4706, 0.95202,
    88.2564, -74.1988, 0.39354,
    68.3143, 113.99, 0.79780,
    35.7148, -70.3075, 0.67352,
    144.742, -50.6495, 0.49337,
    78.9551, -95.6871, 0.17378,
    -48.4459, -69.2061, 0.82205,
    -97.6119, -115.956, 0.73661,
    110.222, 30.762, 0.26483,
    139.108, -37.4252, 0.70097,
    -86.8985, -117.901, 0.06229,
    -87.8635, -54.9604, 0.13876,
    71.9016, 84.6389, 0.47000,
    -118.64, -126.313, 0.90917,
    76.349, 98.861, 0.33139,
    73.0938, 126.012, 0.53000,
    50.4259, -10.1633, 0.85366,
    -114.677, 34.6438, 0.11475,
    -41.2073, 41.7697, 0.10962,
    86.7184, 89.8945, 0.50797,
    -60.1396, 68.4793, 0.92060,
    -12.7721, 82.5047, 0.60294,
    -21.3997, 36.0397, 0.54724,
    89.7934, 49.1531, 0.12613,
    15.8821, 7.65362, 0.88755,
    55.0239, 97.042, 0.40167,
    -10.4966, 66.7169, 0.12175,
    -104.813, -58.4138, 0.48267,
    -100.743, 4.42635, 0.11681,
    -84.844, 0.180354, 0.25152,
    -69.8252, -114.74, 0.94055,
    -77.5196, 11.8978, 0.81603,
    -103.365, 28.2396, 0.35441,
    -61.9944, 85.9636, 0.14594,
    -52.9248, 23.2368, 0.89772,
    -77.4545, -62.4291, 0.13892,
    -59.4781, 7.32497, 0.19740,
    -120.235, -69.3232, 0.84871,
    25.8932, -123.478, 0.58915,
    -4.08674, -43.6696, 0.48005,
    37.5947, -136.804, 0.96998,
    56.3395, -28.9137, 0.59908,
    10.5476, -53.8396, 0.60734,
    43.9176, -60.6188, 0.75637,
    39.959, -42.0983, 0.76805,
    56.6473, -146.702, 0.05185,
    109.21, 141.438, 0.42868,
    93.6934, 143.825, 0.88834,
    -83.9283, 144.475, 0.04110,
    -70.9281, 91.9282, 0.51509,
    -13.5901, -0.286582, 0.83744,
    -101.774, 59.077, 0.45619,
    -97.8327, 117.342, 0.72183,
    -71.5073, 64.2542, 0.68134,
    -16.1129, 119.625, 0.74754,
    48.3386, 129.735, 0.74438,
    48.3385, 154.247, 0.94867,
    32.0268, 125.599, 0.03716,
    0.9140698748311425, -0.4055567333014944, 0.0,
    -0.9949334577795435, -0.10053563841166685, 0.0,
    -0.2868132054203161, -0.9579865266257785, 0.0,
    -0.8967008878512512, 0.4426370044706811, 0.0,
    0.8841937560035473, 0.4671203290848509, 0.0,
    0.1401187140553252, -0.9901347110224356, 0.0,
    0.006765295539604454, 0.9999771151262722, 0.0,
    0.9076565504746499, 0.41971369572657413, 0.0,
    0.4589085370027373, 0.8884835140091274, 0.0,
    -0.9990259657191668, -0.04412618065147023, 0.0,
    0.9861797170601236, -0.16567910447372208, 0.0,
    0.8061415963477321, 0.5917226771367903, 0.0,
    -0.6656550268427187, -0.7462595964133523, 0.0,
    0.11549040838663042, 0.9933085953371638, 0.0,
    -0.9779487488519973, 0.20884502536285848, 0.0,
    0.09334036811006229, -0.9956342579888853, 0.0,
    -0.9596893839166931, 0.28106278017125985, 0.0,
    0.9570722183188293, -0.2898495625704395, 0.0,
    -0.12162675503872536, 0.9925759076558074, 0.0,
    -0.8486487385668586, 0.5289568210439105, 0.0,
    0.8251084784702526, 0.5649743345998159, 0.0,
    -0.9155643871706318, 0.4021714223373728, 0.0,
    0.9414734603014179, -0.337087115666076, 0.0,
    -0.9999232809064978, -0.012386779290234753, 0.0,
    -0.9266442871209674, -0.3759393104559221, 0.0,
    -0.9990585637417668, 0.04338186503872477, 0.0,
    0.3422332026258103, 0.9396150461867249, 0.0,
    -0.8449807310620251, -0.534796750302286, 0.0,
    -0.5728734814696287, 0.8196438093640841, 0.0,
    -0.4584746677351802, 0.8887074766452211, 0.0,
    -0.810926014810633, 0.5851486977712119, 0.0,
    -0.7096582809298015, 0.704546041297344, 0.0,
    -0.8876019031078308, -0.46061139977138754, 0.0,
    0.9939941913025735, 0.10943284542011518, 0.0,
    -0.06957627066400407, 0.997576634931116, 0.0,
    -0.16264968613305883, 0.9866838802781859, 0.0,
    0.27330593955370586, 0.9619271611742056, 0.0,
    0.39046776177295617, 0.9206166015318309, 0.0,
    -0.26069980270368615, -0.965419915306422, 0.0,
    -0.8135948515646404, 0.5814322123063966, 0.0,
    0.8737325575247166, -0.4864066384428958, 0.0,
    0.8484587248078324, -0.529261553768519, 0.0,
    -0.905233489043894, 0.4249144976503134, 0.0,
    -0.8166213083710955, 0.5771738375171558, 0.0,
    -0.13019304177431576, 0.9914886645209572, 0.0,
    0.810711179305404, 0.5854463115856492, 0.0,
    0.13744863259624024, 0.9905088961727824, 0.0,
    -0.024727776183703625, 0.9996942217923482, 0.0,
    -0.64403549711225, 0.7649956068235797, 0.0,
    0.4495193750943261, -0.8932705812993097, 0.0,
    -0.9996502147581966, 0.026447081765127698, 0.0,
    0.08836912017766424, 0.9960877966319162, 0.0,
    -0.7094865755578085, 0.7047189504357423, 0.0,
    -0.17340546695376316, 0.9848505186222666, 0.0,
    0.6420762360355313, 0.7666407940609765, 0.0,
    -0.5480650743074345, 0.8364356964670903, 0.0,
    0.8703935702547856, 0.49235661147092113, 0.0,
    -0.9317592108211784, 0.3630768142554613, 0.0,
    -0.7112043788101795, -0.7029852996764774, 0.0,
    0.06603437523593578, -0.9978173486601641, 0.0,
    0.9759041294126831, -0.21819974838499007, 0.0,
    0.7667303915061587, 0.6419692412731411, 0.0,
    -0.5033752936614231, -0.8640678872237274, 0.0,
    0.23047124273159433, 0.9730791366963709, 0.0,
    -0.08626753348522458, -0.9962720073686582, 0.0,
    0.9113072942183161, 0.4117268700297461, 0.0,
    0.30270964704327763, 0.9530828240960668, 0.0,
    0.8061161755513679, -0.5917573079518631, 0.0,
    -0.31628098983314257, 0.9486655551194887, 0.0,
    -0.040781989443463666, 0.9991680686136007, 0.0,
    -0.1625091110854122, -0.9867070430549431, 0.0,
    0.7400573045804086, 0.6725438171131903, 0.0,
    -0.9635176252439033, 0.2676448875737201, 0.0,
    0.7885409969743447, -0.6149821916858297, 0.0,
    -0.41418958095845076, 0.9101906344417432, 0.0,
    -0.6670814856608885, -0.7449847592323362, 0.0,
    0.9913581654605742, -0.13118303158047828, 0.0,
    0.7631247602202242, -0.6462511898161776, 0.0,
    0.16538969062765002, 0.9862282951903633, 0.0,
    0.771018301382246, 0.6368129858393562, 0.0,
    0.8350349912174959, -0.5501968406328743, 0.0,
    -0.9780666300532209, 0.20829226384178542, 0.0,
    -0.9181077178748107, 0.39633094552243464, 0.0,
    -0.8206217939820554, 0.5714716714253412, 0.0,
    -0.9797511382744013, -0.20021914756090387, 0.0,
    0.275241239523189, -0.961375192141829, 0.0,
    0.7080734345893963, -0.706138804505726, 0.0,
    -0.29443674827059196, -0.9556709691456783, 0.0,
    -0.8302399810797021, 0.5574061121092735, 0.0,
    0.9361661417145458, -0.3515578972335865, 0.0,
    0.386313475571975, -0.9223675507038943, 0.0,
    0.09403673824564357, 0.9955687278435981, 0.0,
    0.8372296500792409, 0.5468514542617511, 0.0,
    0.6142734878710088, 0.7890932024157765, 0.0,
    0.9423419140238645, 0.3346516353969296, 0.0,
    0.11720248750651582, 0.9931080388972214, 0.0,
    -0.8831784765449473, -0.4690370758988527, 0.0,
    -0.2949524398561577, -0.9555119351546059, 0.0,
    -0.3681086780775783, -0.92978277093307, 0.0,
    0.9634243765648933, -0.2679803549526469, 0.0,
    0.9603068074440183, -0.27894593665561285, 0.0,
    -0.7361080260795143, -0.6768640734603374, 0.0,
    -0.1145374265943165, 0.9934189337380034, 0.0,
    0.9090409789372745, -0.4167067297425871, 0.0,
    0.9936433088525971, -0.11257430778140413, 0.0,
    -0.9969296485882049, 0.07830246334438286, 0.0,
    0.538118480534915, 0.8428692074733745, 0.0,
    -0.5733019539697795, 0.8193441704036423, 0.0,
    0.826755249894549, 0.5625617804044298, 0.0,
    -0.9993609405450095, 0.035745076765816654, 0.0,
    -0.99664356984194, 0.08186326827530123, 0.0,
    0.8550322841730821, 0.5185747709074959, 0.0,
    0.7750121859998429, 0.631946288502231, 0.0,
    0.4210012032845477, 0.9070600789545106, 0.0,
    0.9643309276028093, 0.26469956945319256, 0.0,
    0.9064192634961742, 0.42237911733779304, 0.0,
    0.06963269819856362, 0.9975726977727426, 0.0,
    -0.8087742726134313, 0.5881191851645508, 0.0,
    -0.8279001321529594, 0.5608755398313536, 0.0,
    -0.5255777863415156, 0.8507455497999106, 0.0,
    0.8724271939745399, -0.488744095835142, 0.0,
    -0.5877769754949278, -0.8090230077556726, 0.0,
    -0.3206620631811768, 0.9471936661720194, 0.0,
    0.9649697474369218, 0.2623611757320876, 0.0,
    -0.37208053601858987, 0.9282004496422736, 0.0,
    0.06762049235138548, -0.997711115009829, 0.0,
    -0.6435919852830374, -0.7653687715601144, 0.0,
    0.25236236613774404, 0.967632800269482, 0.0,
    0.08405847760559389, -0.9964608232854064, 0.0,
    -0.42199816808189355, -0.906596683280678, 0.0,
    -0.9998391000949952, 0.01793805790018034, 0.0,
    -0.8770177034984277, 0.48045806034485883, 0.0,
    0.5249843541526465, 0.8511118774255995, 0.0,
    -0.21774777278397828, -0.9760050755234918, 0.0,
    0.8202391464096408, 0.5720207537294288, 0.0,
    -0.17141142244291502, -0.9851995352496349, 0.0,
    0.9706168158002019, -0.2406304155460754, 0.0,
    0.06393026054650473, 0.9979543685892938, 0.0,
    -0.44745026388425435, -0.894308817663066, 0.0,
    0.7195632366160739, -0.6944269209287612, 0.0,
    -0.10515577315512252, -0.994455762400796, 0.0,
    -0.9843655425304809, -0.17613766967537606, 0.0,
    -0.9586865449606988, -0.28446459975068605, 0.0,
    0.6071457902395015, -0.794590453878255, 0.0,
    -0.07915853145497666, -0.9968620400526301, 0.0,
    -0.944311754299752, -0.32905213977624415, 0.0,
    -0.6324149073988041, -0.7746298373415279, 0.0,
    -0.9584416058816287, -0.28528878021233967, 0.0,
    -0.9946299678752377, 0.10349505787477727, 0.0,
    -0.876288816981142, -0.48178616546533437, 0.0,
    0.3121859534090077, 0.950021015817076, 0.0,
    0.4193302538750088, 0.9078337613159805, 0.0,
    0.969651371266351, 0.24449175487383026, 0.0,
    -0.5473088207529228, 0.8369307347242334, 0.0,
    -0.07574174915904718, 0.9971274679971102, 0.0,
    -0.936375119924256, 0.35100090425358615, 0.0,
    -0.228719066407469, 0.9734924697508943, 0.0
]);
const TILES_GRASS2 = sortInstancesByTiles(GRASS2, TILES_COUNT, SIZE, PADDING, CULLED_TILES);

/**
 * This class is used to test model visibility by testing model's bounding box against renderer's matrices.
 */
class BoundingBoxVisibility {
    /**
     * Default constructor.
     *
     * @param renderer Renderer instance.
     */
    constructor(renderer) {
        this.pointsBB = [create(), create(), create(), create(), create(), create(), create(), create()];
        this.mMVPMatrix = create$2();
        this.modelMatrix = create$2();
        this.renderer = renderer;
        identity(this.modelMatrix);
        rotate(this.modelMatrix, this.modelMatrix, 0, [1, 0, 0]);
        translate(this.modelMatrix, this.modelMatrix, [0, 0, 0]);
    }
    /**
     * Tests if model is culled by view and projection matrices from renderer.
     *
     * @param model Model to test.
     * @return `true` if model is culled, `false` otherwise. Also returns `false` if model has no bounding box.
     */
    isModelCulled(boundingBox) {
        let result;
        this.pointsBB[0][0] = boundingBox.min.x;
        this.pointsBB[0][1] = boundingBox.min.y;
        this.pointsBB[0][2] = boundingBox.min.z;
        this.pointsBB[0][3] = 1.0;
        this.pointsBB[1][0] = boundingBox.min.x;
        this.pointsBB[1][1] = boundingBox.max.y;
        this.pointsBB[1][2] = boundingBox.min.z;
        this.pointsBB[1][3] = 1.0;
        this.pointsBB[2][0] = boundingBox.min.x;
        this.pointsBB[2][1] = boundingBox.max.y;
        this.pointsBB[2][2] = boundingBox.max.z;
        this.pointsBB[2][3] = 1.0;
        this.pointsBB[3][0] = boundingBox.min.x;
        this.pointsBB[3][1] = boundingBox.min.y;
        this.pointsBB[3][2] = boundingBox.max.z;
        this.pointsBB[3][3] = 1.0;
        this.pointsBB[4][0] = boundingBox.max.x;
        this.pointsBB[4][1] = boundingBox.min.y;
        this.pointsBB[4][2] = boundingBox.min.z;
        this.pointsBB[4][3] = 1.0;
        this.pointsBB[5][0] = boundingBox.max.x;
        this.pointsBB[5][1] = boundingBox.max.y;
        this.pointsBB[5][2] = boundingBox.min.z;
        this.pointsBB[5][3] = 1.0;
        this.pointsBB[6][0] = boundingBox.max.x;
        this.pointsBB[6][1] = boundingBox.max.y;
        this.pointsBB[6][2] = boundingBox.max.z;
        this.pointsBB[6][3] = 1.0;
        this.pointsBB[7][0] = boundingBox.max.x;
        this.pointsBB[7][1] = boundingBox.min.y;
        this.pointsBB[7][2] = boundingBox.max.z;
        this.pointsBB[7][3] = 1.0;
        this.prepareCullingMatrix();
        for (let i = 0; i < 8; i++) {
            transformMat4(this.pointsBB[i], this.pointsBB[i], this.mMVPMatrix);
        }
        result = true;
        for (let i = 0; i < 8; i++) {
            result = 0 > this.pointsBB[i][2];
            if (!result) { // at least 1 point is not clipped by near plane
                break;
            }
        }
        if (result) {
            return result;
        }
        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][0] < -this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped ny left plane
                break;
            }
        }
        if (result) {
            return result;
        }
        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][0] > this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by right plane
                break;
            }
        }
        if (result) {
            return result;
        }
        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][1] < -this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by top plane
                break;
            }
        }
        if (result) {
            return result;
        }
        result = true;
        for (let i = 0; i < 8; i++) {
            result = this.pointsBB[i][1] > this.pointsBB[i][3];
            if (!result) { // at least 1 point is not clipped by bottom plane
                break;
            }
        }
        return result;
    }
    prepareCullingMatrix() {
        multiply(this.mMVPMatrix, this.renderer.getViewMatrix(), this.modelMatrix);
        multiply(this.mMVPMatrix, this.renderer.mProjMatrix, this.mMVPMatrix); // FIXME
    }
}

const FOV_LANDSCAPE = 20.0; // FOV for landscape
const FOV_PORTRAIT = 30.0; // FOV for portrait
const YAW_COEFF_NORMAL = 220.0; // camera rotation time
class Renderer extends BaseRenderer {
    constructor() {
        super();
        this.lastTime = 0;
        this.angleYaw = 0;
        this.loaded = false;
        this.fmSky = new FullModel();
        this.fmGrassPatch = new FullModel();
        this.fmDust = new FullModel();
        this.fmAnt = new FullModel();
        this.fmGroundFading = new FullModel();
        this.fmRoundGrass = new FullModel();
        this.fmButterfly = new FullModel();
        this.fmDandelion0Leaves = new FullModel();
        this.fmDandelion0Petals = new FullModel();
        this.fmDandelion0Stem = new FullModel();
        this.fmSphere = new FullModel();
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
        this.WIND_OFFSET = 7.0;
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
                lightDir: normalize(this.vec3Temp, [1.0, 1.0, 1.0]),
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
                lightDir: normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
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
                lightDir: normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
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
                lightDir: normalize(this.vec3Temp, [-1.0, -1.0, 0.3]),
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
        this.cameraMode = CameraMode.Random;
        this.currentRandomCamera = 0;
        this.matViewInverted = create$2();
        this.matViewInvertedTransposed = create$2();
        this.matTemp = create$2();
        this.cameraPosition = create$1();
        this.cameraRotation = create$1();
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
        this.cameraPositionInterpolator = new CameraPositionInterpolator();
        this.grassDensity = 1.0;
        this.drawInsects = true;
        this.visibleTiles = 0;
        this.visibleGrassInstances = 0;
        this.bboxVisibility = new BoundingBoxVisibility(this);
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
        this.shaderVertexLit = new VertexLitShader(this.gl);
        this.shaderVertexLitInstancedVegetation = new VertexLitInstancedVegetationShader(this.gl);
        this.shaderVertexLitInstancedVegetationFading = new VertexLitInstancedVegetationFadingShader(this.gl);
        this.shaderVertexLitInstancedGrass = new VertexLitInstancedGrassShader(this.gl);
        this.shaderVertexLitInstancedGrassAnimated = new VertexLitInstancedGrassAnimatedShader(this.gl);
        this.shaderVertexLitInstancedGrassAt = new VertexLitInstancedGrassAtShader(this.gl);
        this.shaderVertexLitInstancedGrassFading = new VertexLitInstancedGrassFadingShader(this.gl);
        this.shaderInstancedVegetation = new InstancedVegetationShader(this.gl);
        this.shaderGlare = new GlareShader(this.gl);
        this.shaderInstancedTexturePositionsColored = new InstancedTexturePositionsColoredShader(this.gl);
        this.shaderVertexLitInstancedTexturePositions = new VertexLitInstancedTexturePositionsShader(this.gl);
        this.shaderInstancedTexturePositionsGrass = new InstancedTexturePositionsGrassShader(this.gl);
        this.shaderInstancedTexturePositionsGrassAt = new InstancedTexturePositionsGrassAtShader(this.gl);
        this.shaderInstancedTexturePositionsGrassAnimated = new InstancedTexturePositionsGrassAnimatedShader(this.gl);
        this.shaderAnts = new AntsShader(this.gl);
        this.shaderButterfly = new ButterflyShader(this.gl);
        this.shaderDiffuse = new DiffuseShader(this.gl);
        this.shaderDiffuseAnimatedTexture = new DiffuseAnimatedTextureShader(this.gl);
        this.shaderDiffuseAnimatedTextureChunked = new DiffuseAnimatedTextureChunkedShader(this.gl);
        this.shaderDiffuseColored = new DiffuseColoredShader(this.gl);
        this.shaderDiffuseColoredVertexAlpha = new DiffuseColoredVertexAlphaShader(this.gl);
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
            UncompressedTextureLoader.load("data/textures/stem.webp", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/leaves.webp", this.gl, undefined, undefined, false),
            UncompressedTextureLoader.load("data/textures/petal.webp", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/ground.webp", this.gl, undefined, undefined, false),
            UncompressedTextureLoader.load("data/textures/round-grass2.webp", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/white.webp", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/ant.webp", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/butterfly-all.webp", this.gl, undefined, undefined, true),
            this.loadFp32Texture(TILES_GRASS1.textureData, this.gl, this.GRASS1_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            this.loadFp32Texture(TILES_GRASS2.textureData, this.gl, this.GRASS2_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            this.loadFp32Texture(TILES_FLOWERS.textureData, this.gl, this.FLOWERS_COUNT, 2, this.gl.NEAREST, this.gl.NEAREST, true, 3),
            UncompressedTextureLoader.load(`data/textures/${preset.skyTexture}`, this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load(this.noTextures ? "data/textures/white.webp" : "data/textures/grass.webp", this.gl, undefined, undefined, false),
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
                if (this.cameraMode === CameraMode.Random && this.customCamera === undefined && this.cameraPositionInterpolator.timer === 1.0) {
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
        if (this.cameraMode === CameraMode.Random) {
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
            lookAt(this.mVMatrix, this.cameraPosition, // eye
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
        TILES_FLOWERS.cull(this.bboxVisibility);
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
        TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsColored, this.fmDandelion0Petals, this, 1.0);
        this.gl.enable(this.gl.CULL_FACE); // FIXME
        this.gl.cullFace(this.gl.BACK);
        this.setTexture2D(0, this.textureGrass2Positions, this.shaderInstancedTexturePositionsColored.sPositions);
        this.setTexture2D(1, this.noTextures ? this.textureWhite : this.textureRoundGrass, this.shaderInstancedTexturePositionsColored.sTexture);
        this.gl.uniform2fv(this.shaderInstancedTexturePositionsColored.uScale, this.ROUND_GRASS_SCALE);
        TILES_GRASS2.drawTiles(this.shaderInstancedTexturePositionsColored, this.fmRoundGrass, this, density);
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
        TILES_GRASS1.drawTiles(this.shaderInstancedTexturePositionsGrassAnimated, this.fmGrassPatch, this, density);
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
        TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsGrass, this.fmDandelion0Stem, this, 1.0);
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
        TILES_FLOWERS.drawTiles(this.shaderInstancedTexturePositionsGrassAt, this.fmDandelion0Leaves, this, 1.0);
        this.visibleTiles = 0;
        this.visibleGrassInstances = 0;
        for (let i = 0; i < CULLED_TILES.length; i++) {
            const culled = CULLED_TILES[i];
            this.visibleTiles += culled ? 0 : 1;
            if (!culled) {
                this.visibleGrassInstances += TILES_FLOWERS.tiles[i].instancesCount * 3;
                this.visibleGrassInstances += Math.round(TILES_GRASS1.tiles[i].instancesCount * density);
                this.visibleGrassInstances += Math.round(TILES_GRASS2.tiles[i].instancesCount * density);
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
            const textureSky = await UncompressedTextureLoader.load(`data/textures/${preset.skyTexture}`, this.gl, undefined, undefined, true);
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

/**
 * A Flying Camera allows free motion around the scene using FPS style controls (WASD + mouselook)
 * This type of camera is good for displaying large scenes
 */
class FpsCamera {
    constructor(options) {
        var _a, _b;
        this._dirty = true;
        this._angles = create$1();
        this._position = create$1();
        this.speed = 100;
        this.rotationSpeed = 0.025;
        this._cameraMat = create$2();
        this._viewMat = create$2();
        this.projectionMat = create$2();
        this.pressedKeys = new Array();
        this.canvas = options.canvas;
        this.speed = (_a = options.movementSpeed) !== null && _a !== void 0 ? _a : 100;
        this.rotationSpeed = (_b = options.rotationSpeed) !== null && _b !== void 0 ? _b : 0.025;
        // Set up the appropriate event hooks
        let moving = false;
        let lastX, lastY;
        window.addEventListener("keydown", event => this.pressedKeys[event.keyCode] = true);
        window.addEventListener("keyup", event => this.pressedKeys[event.keyCode] = false);
        this.canvas.addEventListener('contextmenu', event => event.preventDefault());
        this.canvas.addEventListener('mousedown', event => {
            if (event.which === 3) {
                moving = true;
            }
            lastX = event.pageX;
            lastY = event.pageY;
        });
        this.canvas.addEventListener('mousemove', event => {
            if (moving) {
                let xDelta = event.pageX - lastX;
                let yDelta = event.pageY - lastY;
                lastX = event.pageX;
                lastY = event.pageY;
                this.angles[1] += xDelta * this.rotationSpeed;
                if (this.angles[1] < 0) {
                    this.angles[1] += Math.PI * 2;
                }
                if (this.angles[1] >= Math.PI * 2) {
                    this.angles[1] -= Math.PI * 2;
                }
                this.angles[0] += yDelta * this.rotationSpeed;
                if (this.angles[0] < -Math.PI * 0.5) {
                    this.angles[0] = -Math.PI * 0.5;
                }
                if (this.angles[0] > Math.PI * 0.5) {
                    this.angles[0] = Math.PI * 0.5;
                }
                this._dirty = true;
            }
        });
        this.canvas.addEventListener('mouseup', event => moving = false);
    }
    get angles() {
        return this._angles;
    }
    set angles(value) {
        this._angles = value;
        this._dirty = true;
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this._dirty = true;
    }
    get viewMat() {
        if (this._dirty) {
            var mv = this._viewMat;
            identity(mv);
            rotateX(mv, mv, this.angles[0] - Math.PI / 2.0);
            rotateZ(mv, mv, this.angles[1]);
            rotateY(mv, mv, this.angles[2]);
            translate(mv, mv, [-this.position[0], -this.position[1], -this.position[2]]);
            this._dirty = false;
        }
        return this._viewMat;
    }
    update(frameTime) {
        const dir = create$1();
        let speed = (this.speed / 1000) * frameTime;
        if (this.pressedKeys[16]) { // Shift, speed up
            speed *= 5;
        }
        // This is our first person movement code. It's not really pretty, but it works
        if (this.pressedKeys['W'.charCodeAt(0)]) {
            dir[1] += speed;
        }
        if (this.pressedKeys['S'.charCodeAt(0)]) {
            dir[1] -= speed;
        }
        if (this.pressedKeys['A'.charCodeAt(0)]) {
            dir[0] -= speed;
        }
        if (this.pressedKeys['D'.charCodeAt(0)]) {
            dir[0] += speed;
        }
        if (this.pressedKeys[32]) { // Space, moves up
            dir[2] += speed;
        }
        if (this.pressedKeys['C'.charCodeAt(0)]) { // C, moves down
            dir[2] -= speed;
        }
        if (dir[0] !== 0 || dir[1] !== 0 || dir[2] !== 0) {
            let cam = this._cameraMat;
            identity(cam);
            rotateX(cam, cam, this.angles[0]);
            rotateZ(cam, cam, this.angles[1]);
            invert(cam, cam);
            transformMat4$1(dir, dir, cam);
            // Move the camera in the direction we are facing
            add(this.position, this.position, dir);
            this._dirty = true;
        }
    }
}

var MovementMode;
(function (MovementMode) {
    MovementMode[MovementMode["Free"] = 0] = "Free";
    MovementMode[MovementMode["Predefined"] = 1] = "Predefined";
})(MovementMode || (MovementMode = {}));
class FreeMovement {
    constructor(renderer, options) {
        this.renderer = renderer;
        this.options = options;
        this.matCamera = create$2();
        this.matInvCamera = new Float32Array(16);
        this.vec3Eye = new Float32Array(3);
        this.vec3Rotation = new Float32Array(3);
        this.mode = MovementMode.Predefined;
        this.setupControls();
    }
    setupControls() {
        document.addEventListener("keypress", (event) => {
            var _a;
            if (event.code === "Enter") {
                if (this.mode === MovementMode.Predefined) {
                    this.matCamera = clone(this.renderer.getViewMatrix());
                    this.renderer.setCustomCamera(this.matCamera);
                    this.mode = MovementMode.Free;
                    invert(this.matInvCamera, this.matCamera);
                    getTranslation(this.vec3Eye, this.matInvCamera);
                    normalize(this.vec3Rotation, this.vec3Eye);
                    scale(this.vec3Rotation, this.vec3Rotation, -1);
                    this.fpsCamera = (_a = this.fpsCamera) !== null && _a !== void 0 ? _a : new FpsCamera(this.options);
                    this.fpsCamera.position = this.vec3Eye;
                    const callback = (time) => {
                        if (this.mode !== MovementMode.Free) {
                            return;
                        }
                        this.fpsCamera.update(16);
                        this.matCamera = this.fpsCamera.viewMat;
                        this.renderer.setCustomCamera(this.matCamera, this.fpsCamera.position, this.fpsCamera.angles);
                        requestAnimationFrame(callback);
                    };
                    callback();
                }
                else {
                    this.renderer.resetCustomCamera();
                    this.mode = MovementMode.Predefined;
                }
            }
        });
    }
    ;
}

/**
 * dat-gui JavaScript Controller Library
 * https://github.com/dataarts/dat.gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

function ___$insertStyle(css) {
  if (!css) {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }

  var style = document.createElement('style');

  style.setAttribute('type', 'text/css');
  style.innerHTML = css;
  document.head.appendChild(style);

  return css;
}

function colorToString (color, forceCSSHex) {
  var colorFormat = color.__state.conversionName.toString();
  var r = Math.round(color.r);
  var g = Math.round(color.g);
  var b = Math.round(color.b);
  var a = color.a;
  var h = Math.round(color.h);
  var s = color.s.toFixed(1);
  var v = color.v.toFixed(1);
  if (forceCSSHex || colorFormat === 'THREE_CHAR_HEX' || colorFormat === 'SIX_CHAR_HEX') {
    var str = color.hex.toString(16);
    while (str.length < 6) {
      str = '0' + str;
    }
    return '#' + str;
  } else if (colorFormat === 'CSS_RGB') {
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  } else if (colorFormat === 'CSS_RGBA') {
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  } else if (colorFormat === 'HEX') {
    return '0x' + color.hex.toString(16);
  } else if (colorFormat === 'RGB_ARRAY') {
    return '[' + r + ',' + g + ',' + b + ']';
  } else if (colorFormat === 'RGBA_ARRAY') {
    return '[' + r + ',' + g + ',' + b + ',' + a + ']';
  } else if (colorFormat === 'RGB_OBJ') {
    return '{r:' + r + ',g:' + g + ',b:' + b + '}';
  } else if (colorFormat === 'RGBA_OBJ') {
    return '{r:' + r + ',g:' + g + ',b:' + b + ',a:' + a + '}';
  } else if (colorFormat === 'HSV_OBJ') {
    return '{h:' + h + ',s:' + s + ',v:' + v + '}';
  } else if (colorFormat === 'HSVA_OBJ') {
    return '{h:' + h + ',s:' + s + ',v:' + v + ',a:' + a + '}';
  }
  return 'unknown format';
}

var ARR_EACH = Array.prototype.forEach;
var ARR_SLICE = Array.prototype.slice;
var Common = {
  BREAK: {},
  extend: function extend(target) {
    this.each(ARR_SLICE.call(arguments, 1), function (obj) {
      var keys = this.isObject(obj) ? Object.keys(obj) : [];
      keys.forEach(function (key) {
        if (!this.isUndefined(obj[key])) {
          target[key] = obj[key];
        }
      }.bind(this));
    }, this);
    return target;
  },
  defaults: function defaults(target) {
    this.each(ARR_SLICE.call(arguments, 1), function (obj) {
      var keys = this.isObject(obj) ? Object.keys(obj) : [];
      keys.forEach(function (key) {
        if (this.isUndefined(target[key])) {
          target[key] = obj[key];
        }
      }.bind(this));
    }, this);
    return target;
  },
  compose: function compose() {
    var toCall = ARR_SLICE.call(arguments);
    return function () {
      var args = ARR_SLICE.call(arguments);
      for (var i = toCall.length - 1; i >= 0; i--) {
        args = [toCall[i].apply(this, args)];
      }
      return args[0];
    };
  },
  each: function each(obj, itr, scope) {
    if (!obj) {
      return;
    }
    if (ARR_EACH && obj.forEach && obj.forEach === ARR_EACH) {
      obj.forEach(itr, scope);
    } else if (obj.length === obj.length + 0) {
      var key = void 0;
      var l = void 0;
      for (key = 0, l = obj.length; key < l; key++) {
        if (key in obj && itr.call(scope, obj[key], key) === this.BREAK) {
          return;
        }
      }
    } else {
      for (var _key in obj) {
        if (itr.call(scope, obj[_key], _key) === this.BREAK) {
          return;
        }
      }
    }
  },
  defer: function defer(fnc) {
    setTimeout(fnc, 0);
  },
  debounce: function debounce(func, threshold, callImmediately) {
    var timeout = void 0;
    return function () {
      var obj = this;
      var args = arguments;
      function delayed() {
        timeout = null;
        if (!callImmediately) func.apply(obj, args);
      }
      var callNow = callImmediately || !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(delayed, threshold);
      if (callNow) {
        func.apply(obj, args);
      }
    };
  },
  toArray: function toArray(obj) {
    if (obj.toArray) return obj.toArray();
    return ARR_SLICE.call(obj);
  },
  isUndefined: function isUndefined(obj) {
    return obj === undefined;
  },
  isNull: function isNull(obj) {
    return obj === null;
  },
  isNaN: function (_isNaN) {
    function isNaN(_x) {
      return _isNaN.apply(this, arguments);
    }
    isNaN.toString = function () {
      return _isNaN.toString();
    };
    return isNaN;
  }(function (obj) {
    return isNaN(obj);
  }),
  isArray: Array.isArray || function (obj) {
    return obj.constructor === Array;
  },
  isObject: function isObject(obj) {
    return obj === Object(obj);
  },
  isNumber: function isNumber(obj) {
    return obj === obj + 0;
  },
  isString: function isString(obj) {
    return obj === obj + '';
  },
  isBoolean: function isBoolean(obj) {
    return obj === false || obj === true;
  },
  isFunction: function isFunction(obj) {
    return obj instanceof Function;
  }
};

var INTERPRETATIONS = [
{
  litmus: Common.isString,
  conversions: {
    THREE_CHAR_HEX: {
      read: function read(original) {
        var test = original.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
        if (test === null) {
          return false;
        }
        return {
          space: 'HEX',
          hex: parseInt('0x' + test[1].toString() + test[1].toString() + test[2].toString() + test[2].toString() + test[3].toString() + test[3].toString(), 0)
        };
      },
      write: colorToString
    },
    SIX_CHAR_HEX: {
      read: function read(original) {
        var test = original.match(/^#([A-F0-9]{6})$/i);
        if (test === null) {
          return false;
        }
        return {
          space: 'HEX',
          hex: parseInt('0x' + test[1].toString(), 0)
        };
      },
      write: colorToString
    },
    CSS_RGB: {
      read: function read(original) {
        var test = original.match(/^rgb\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\)/);
        if (test === null) {
          return false;
        }
        return {
          space: 'RGB',
          r: parseFloat(test[1]),
          g: parseFloat(test[2]),
          b: parseFloat(test[3])
        };
      },
      write: colorToString
    },
    CSS_RGBA: {
      read: function read(original) {
        var test = original.match(/^rgba\(\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*,\s*(\S+)\s*\)/);
        if (test === null) {
          return false;
        }
        return {
          space: 'RGB',
          r: parseFloat(test[1]),
          g: parseFloat(test[2]),
          b: parseFloat(test[3]),
          a: parseFloat(test[4])
        };
      },
      write: colorToString
    }
  }
},
{
  litmus: Common.isNumber,
  conversions: {
    HEX: {
      read: function read(original) {
        return {
          space: 'HEX',
          hex: original,
          conversionName: 'HEX'
        };
      },
      write: function write(color) {
        return color.hex;
      }
    }
  }
},
{
  litmus: Common.isArray,
  conversions: {
    RGB_ARRAY: {
      read: function read(original) {
        if (original.length !== 3) {
          return false;
        }
        return {
          space: 'RGB',
          r: original[0],
          g: original[1],
          b: original[2]
        };
      },
      write: function write(color) {
        return [color.r, color.g, color.b];
      }
    },
    RGBA_ARRAY: {
      read: function read(original) {
        if (original.length !== 4) return false;
        return {
          space: 'RGB',
          r: original[0],
          g: original[1],
          b: original[2],
          a: original[3]
        };
      },
      write: function write(color) {
        return [color.r, color.g, color.b, color.a];
      }
    }
  }
},
{
  litmus: Common.isObject,
  conversions: {
    RGBA_OBJ: {
      read: function read(original) {
        if (Common.isNumber(original.r) && Common.isNumber(original.g) && Common.isNumber(original.b) && Common.isNumber(original.a)) {
          return {
            space: 'RGB',
            r: original.r,
            g: original.g,
            b: original.b,
            a: original.a
          };
        }
        return false;
      },
      write: function write(color) {
        return {
          r: color.r,
          g: color.g,
          b: color.b,
          a: color.a
        };
      }
    },
    RGB_OBJ: {
      read: function read(original) {
        if (Common.isNumber(original.r) && Common.isNumber(original.g) && Common.isNumber(original.b)) {
          return {
            space: 'RGB',
            r: original.r,
            g: original.g,
            b: original.b
          };
        }
        return false;
      },
      write: function write(color) {
        return {
          r: color.r,
          g: color.g,
          b: color.b
        };
      }
    },
    HSVA_OBJ: {
      read: function read(original) {
        if (Common.isNumber(original.h) && Common.isNumber(original.s) && Common.isNumber(original.v) && Common.isNumber(original.a)) {
          return {
            space: 'HSV',
            h: original.h,
            s: original.s,
            v: original.v,
            a: original.a
          };
        }
        return false;
      },
      write: function write(color) {
        return {
          h: color.h,
          s: color.s,
          v: color.v,
          a: color.a
        };
      }
    },
    HSV_OBJ: {
      read: function read(original) {
        if (Common.isNumber(original.h) && Common.isNumber(original.s) && Common.isNumber(original.v)) {
          return {
            space: 'HSV',
            h: original.h,
            s: original.s,
            v: original.v
          };
        }
        return false;
      },
      write: function write(color) {
        return {
          h: color.h,
          s: color.s,
          v: color.v
        };
      }
    }
  }
}];
var result = void 0;
var toReturn = void 0;
var interpret = function interpret() {
  toReturn = false;
  var original = arguments.length > 1 ? Common.toArray(arguments) : arguments[0];
  Common.each(INTERPRETATIONS, function (family) {
    if (family.litmus(original)) {
      Common.each(family.conversions, function (conversion, conversionName) {
        result = conversion.read(original);
        if (toReturn === false && result !== false) {
          toReturn = result;
          result.conversionName = conversionName;
          result.conversion = conversion;
          return Common.BREAK;
        }
      });
      return Common.BREAK;
    }
  });
  return toReturn;
};

var tmpComponent = void 0;
var ColorMath = {
  hsv_to_rgb: function hsv_to_rgb(h, s, v) {
    var hi = Math.floor(h / 60) % 6;
    var f = h / 60 - Math.floor(h / 60);
    var p = v * (1.0 - s);
    var q = v * (1.0 - f * s);
    var t = v * (1.0 - (1.0 - f) * s);
    var c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][hi];
    return {
      r: c[0] * 255,
      g: c[1] * 255,
      b: c[2] * 255
    };
  },
  rgb_to_hsv: function rgb_to_hsv(r, g, b) {
    var min = Math.min(r, g, b);
    var max = Math.max(r, g, b);
    var delta = max - min;
    var h = void 0;
    var s = void 0;
    if (max !== 0) {
      s = delta / max;
    } else {
      return {
        h: NaN,
        s: 0,
        v: 0
      };
    }
    if (r === max) {
      h = (g - b) / delta;
    } else if (g === max) {
      h = 2 + (b - r) / delta;
    } else {
      h = 4 + (r - g) / delta;
    }
    h /= 6;
    if (h < 0) {
      h += 1;
    }
    return {
      h: h * 360,
      s: s,
      v: max / 255
    };
  },
  rgb_to_hex: function rgb_to_hex(r, g, b) {
    var hex = this.hex_with_component(0, 2, r);
    hex = this.hex_with_component(hex, 1, g);
    hex = this.hex_with_component(hex, 0, b);
    return hex;
  },
  component_from_hex: function component_from_hex(hex, componentIndex) {
    return hex >> componentIndex * 8 & 0xFF;
  },
  hex_with_component: function hex_with_component(hex, componentIndex, value) {
    return value << (tmpComponent = componentIndex * 8) | hex & ~(0xFF << tmpComponent);
  }
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var Color = function () {
  function Color() {
    classCallCheck(this, Color);
    this.__state = interpret.apply(this, arguments);
    if (this.__state === false) {
      throw new Error('Failed to interpret color arguments');
    }
    this.__state.a = this.__state.a || 1;
  }
  createClass(Color, [{
    key: 'toString',
    value: function toString() {
      return colorToString(this);
    }
  }, {
    key: 'toHexString',
    value: function toHexString() {
      return colorToString(this, true);
    }
  }, {
    key: 'toOriginal',
    value: function toOriginal() {
      return this.__state.conversion.write(this);
    }
  }]);
  return Color;
}();
function defineRGBComponent(target, component, componentHexIndex) {
  Object.defineProperty(target, component, {
    get: function get$$1() {
      if (this.__state.space === 'RGB') {
        return this.__state[component];
      }
      Color.recalculateRGB(this, component, componentHexIndex);
      return this.__state[component];
    },
    set: function set$$1(v) {
      if (this.__state.space !== 'RGB') {
        Color.recalculateRGB(this, component, componentHexIndex);
        this.__state.space = 'RGB';
      }
      this.__state[component] = v;
    }
  });
}
function defineHSVComponent(target, component) {
  Object.defineProperty(target, component, {
    get: function get$$1() {
      if (this.__state.space === 'HSV') {
        return this.__state[component];
      }
      Color.recalculateHSV(this);
      return this.__state[component];
    },
    set: function set$$1(v) {
      if (this.__state.space !== 'HSV') {
        Color.recalculateHSV(this);
        this.__state.space = 'HSV';
      }
      this.__state[component] = v;
    }
  });
}
Color.recalculateRGB = function (color, component, componentHexIndex) {
  if (color.__state.space === 'HEX') {
    color.__state[component] = ColorMath.component_from_hex(color.__state.hex, componentHexIndex);
  } else if (color.__state.space === 'HSV') {
    Common.extend(color.__state, ColorMath.hsv_to_rgb(color.__state.h, color.__state.s, color.__state.v));
  } else {
    throw new Error('Corrupted color state');
  }
};
Color.recalculateHSV = function (color) {
  var result = ColorMath.rgb_to_hsv(color.r, color.g, color.b);
  Common.extend(color.__state, {
    s: result.s,
    v: result.v
  });
  if (!Common.isNaN(result.h)) {
    color.__state.h = result.h;
  } else if (Common.isUndefined(color.__state.h)) {
    color.__state.h = 0;
  }
};
Color.COMPONENTS = ['r', 'g', 'b', 'h', 's', 'v', 'hex', 'a'];
defineRGBComponent(Color.prototype, 'r', 2);
defineRGBComponent(Color.prototype, 'g', 1);
defineRGBComponent(Color.prototype, 'b', 0);
defineHSVComponent(Color.prototype, 'h');
defineHSVComponent(Color.prototype, 's');
defineHSVComponent(Color.prototype, 'v');
Object.defineProperty(Color.prototype, 'a', {
  get: function get$$1() {
    return this.__state.a;
  },
  set: function set$$1(v) {
    this.__state.a = v;
  }
});
Object.defineProperty(Color.prototype, 'hex', {
  get: function get$$1() {
    if (this.__state.space !== 'HEX') {
      this.__state.hex = ColorMath.rgb_to_hex(this.r, this.g, this.b);
      this.__state.space = 'HEX';
    }
    return this.__state.hex;
  },
  set: function set$$1(v) {
    this.__state.space = 'HEX';
    this.__state.hex = v;
  }
});

var Controller = function () {
  function Controller(object, property) {
    classCallCheck(this, Controller);
    this.initialValue = object[property];
    this.domElement = document.createElement('div');
    this.object = object;
    this.property = property;
    this.__onChange = undefined;
    this.__onFinishChange = undefined;
  }
  createClass(Controller, [{
    key: 'onChange',
    value: function onChange(fnc) {
      this.__onChange = fnc;
      return this;
    }
  }, {
    key: 'onFinishChange',
    value: function onFinishChange(fnc) {
      this.__onFinishChange = fnc;
      return this;
    }
  }, {
    key: 'setValue',
    value: function setValue(newValue) {
      this.object[this.property] = newValue;
      if (this.__onChange) {
        this.__onChange.call(this, newValue);
      }
      this.updateDisplay();
      return this;
    }
  }, {
    key: 'getValue',
    value: function getValue() {
      return this.object[this.property];
    }
  }, {
    key: 'updateDisplay',
    value: function updateDisplay() {
      return this;
    }
  }, {
    key: 'isModified',
    value: function isModified() {
      return this.initialValue !== this.getValue();
    }
  }]);
  return Controller;
}();

var EVENT_MAP = {
  HTMLEvents: ['change'],
  MouseEvents: ['click', 'mousemove', 'mousedown', 'mouseup', 'mouseover'],
  KeyboardEvents: ['keydown']
};
var EVENT_MAP_INV = {};
Common.each(EVENT_MAP, function (v, k) {
  Common.each(v, function (e) {
    EVENT_MAP_INV[e] = k;
  });
});
var CSS_VALUE_PIXELS = /(\d+(\.\d+)?)px/;
function cssValueToPixels(val) {
  if (val === '0' || Common.isUndefined(val)) {
    return 0;
  }
  var match = val.match(CSS_VALUE_PIXELS);
  if (!Common.isNull(match)) {
    return parseFloat(match[1]);
  }
  return 0;
}
var dom = {
  makeSelectable: function makeSelectable(elem, selectable) {
    if (elem === undefined || elem.style === undefined) return;
    elem.onselectstart = selectable ? function () {
      return false;
    } : function () {};
    elem.style.MozUserSelect = selectable ? 'auto' : 'none';
    elem.style.KhtmlUserSelect = selectable ? 'auto' : 'none';
    elem.unselectable = selectable ? 'on' : 'off';
  },
  makeFullscreen: function makeFullscreen(elem, hor, vert) {
    var vertical = vert;
    var horizontal = hor;
    if (Common.isUndefined(horizontal)) {
      horizontal = true;
    }
    if (Common.isUndefined(vertical)) {
      vertical = true;
    }
    elem.style.position = 'absolute';
    if (horizontal) {
      elem.style.left = 0;
      elem.style.right = 0;
    }
    if (vertical) {
      elem.style.top = 0;
      elem.style.bottom = 0;
    }
  },
  fakeEvent: function fakeEvent(elem, eventType, pars, aux) {
    var params = pars || {};
    var className = EVENT_MAP_INV[eventType];
    if (!className) {
      throw new Error('Event type ' + eventType + ' not supported.');
    }
    var evt = document.createEvent(className);
    switch (className) {
      case 'MouseEvents':
        {
          var clientX = params.x || params.clientX || 0;
          var clientY = params.y || params.clientY || 0;
          evt.initMouseEvent(eventType, params.bubbles || false, params.cancelable || true, window, params.clickCount || 1, 0,
          0,
          clientX,
          clientY,
          false, false, false, false, 0, null);
          break;
        }
      case 'KeyboardEvents':
        {
          var init = evt.initKeyboardEvent || evt.initKeyEvent;
          Common.defaults(params, {
            cancelable: true,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            keyCode: undefined,
            charCode: undefined
          });
          init(eventType, params.bubbles || false, params.cancelable, window, params.ctrlKey, params.altKey, params.shiftKey, params.metaKey, params.keyCode, params.charCode);
          break;
        }
      default:
        {
          evt.initEvent(eventType, params.bubbles || false, params.cancelable || true);
          break;
        }
    }
    Common.defaults(evt, aux);
    elem.dispatchEvent(evt);
  },
  bind: function bind(elem, event, func, newBool) {
    var bool = newBool || false;
    if (elem.addEventListener) {
      elem.addEventListener(event, func, bool);
    } else if (elem.attachEvent) {
      elem.attachEvent('on' + event, func);
    }
    return dom;
  },
  unbind: function unbind(elem, event, func, newBool) {
    var bool = newBool || false;
    if (elem.removeEventListener) {
      elem.removeEventListener(event, func, bool);
    } else if (elem.detachEvent) {
      elem.detachEvent('on' + event, func);
    }
    return dom;
  },
  addClass: function addClass(elem, className) {
    if (elem.className === undefined) {
      elem.className = className;
    } else if (elem.className !== className) {
      var classes = elem.className.split(/ +/);
      if (classes.indexOf(className) === -1) {
        classes.push(className);
        elem.className = classes.join(' ').replace(/^\s+/, '').replace(/\s+$/, '');
      }
    }
    return dom;
  },
  removeClass: function removeClass(elem, className) {
    if (className) {
      if (elem.className === className) {
        elem.removeAttribute('class');
      } else {
        var classes = elem.className.split(/ +/);
        var index = classes.indexOf(className);
        if (index !== -1) {
          classes.splice(index, 1);
          elem.className = classes.join(' ');
        }
      }
    } else {
      elem.className = undefined;
    }
    return dom;
  },
  hasClass: function hasClass(elem, className) {
    return new RegExp('(?:^|\\s+)' + className + '(?:\\s+|$)').test(elem.className) || false;
  },
  getWidth: function getWidth(elem) {
    var style = getComputedStyle(elem);
    return cssValueToPixels(style['border-left-width']) + cssValueToPixels(style['border-right-width']) + cssValueToPixels(style['padding-left']) + cssValueToPixels(style['padding-right']) + cssValueToPixels(style.width);
  },
  getHeight: function getHeight(elem) {
    var style = getComputedStyle(elem);
    return cssValueToPixels(style['border-top-width']) + cssValueToPixels(style['border-bottom-width']) + cssValueToPixels(style['padding-top']) + cssValueToPixels(style['padding-bottom']) + cssValueToPixels(style.height);
  },
  getOffset: function getOffset(el) {
    var elem = el;
    var offset = { left: 0, top: 0 };
    if (elem.offsetParent) {
      do {
        offset.left += elem.offsetLeft;
        offset.top += elem.offsetTop;
        elem = elem.offsetParent;
      } while (elem);
    }
    return offset;
  },
  isActive: function isActive(elem) {
    return elem === document.activeElement && (elem.type || elem.href);
  }
};

var BooleanController = function (_Controller) {
  inherits(BooleanController, _Controller);
  function BooleanController(object, property) {
    classCallCheck(this, BooleanController);
    var _this2 = possibleConstructorReturn(this, (BooleanController.__proto__ || Object.getPrototypeOf(BooleanController)).call(this, object, property));
    var _this = _this2;
    _this2.__prev = _this2.getValue();
    _this2.__checkbox = document.createElement('input');
    _this2.__checkbox.setAttribute('type', 'checkbox');
    function onChange() {
      _this.setValue(!_this.__prev);
    }
    dom.bind(_this2.__checkbox, 'change', onChange, false);
    _this2.domElement.appendChild(_this2.__checkbox);
    _this2.updateDisplay();
    return _this2;
  }
  createClass(BooleanController, [{
    key: 'setValue',
    value: function setValue(v) {
      var toReturn = get(BooleanController.prototype.__proto__ || Object.getPrototypeOf(BooleanController.prototype), 'setValue', this).call(this, v);
      if (this.__onFinishChange) {
        this.__onFinishChange.call(this, this.getValue());
      }
      this.__prev = this.getValue();
      return toReturn;
    }
  }, {
    key: 'updateDisplay',
    value: function updateDisplay() {
      if (this.getValue() === true) {
        this.__checkbox.setAttribute('checked', 'checked');
        this.__checkbox.checked = true;
        this.__prev = true;
      } else {
        this.__checkbox.checked = false;
        this.__prev = false;
      }
      return get(BooleanController.prototype.__proto__ || Object.getPrototypeOf(BooleanController.prototype), 'updateDisplay', this).call(this);
    }
  }]);
  return BooleanController;
}(Controller);

var OptionController = function (_Controller) {
  inherits(OptionController, _Controller);
  function OptionController(object, property, opts) {
    classCallCheck(this, OptionController);
    var _this2 = possibleConstructorReturn(this, (OptionController.__proto__ || Object.getPrototypeOf(OptionController)).call(this, object, property));
    var options = opts;
    var _this = _this2;
    _this2.__select = document.createElement('select');
    if (Common.isArray(options)) {
      var map = {};
      Common.each(options, function (element) {
        map[element] = element;
      });
      options = map;
    }
    Common.each(options, function (value, key) {
      var opt = document.createElement('option');
      opt.innerHTML = key;
      opt.setAttribute('value', value);
      _this.__select.appendChild(opt);
    });
    _this2.updateDisplay();
    dom.bind(_this2.__select, 'change', function () {
      var desiredValue = this.options[this.selectedIndex].value;
      _this.setValue(desiredValue);
    });
    _this2.domElement.appendChild(_this2.__select);
    return _this2;
  }
  createClass(OptionController, [{
    key: 'setValue',
    value: function setValue(v) {
      var toReturn = get(OptionController.prototype.__proto__ || Object.getPrototypeOf(OptionController.prototype), 'setValue', this).call(this, v);
      if (this.__onFinishChange) {
        this.__onFinishChange.call(this, this.getValue());
      }
      return toReturn;
    }
  }, {
    key: 'updateDisplay',
    value: function updateDisplay() {
      if (dom.isActive(this.__select)) return this;
      this.__select.value = this.getValue();
      return get(OptionController.prototype.__proto__ || Object.getPrototypeOf(OptionController.prototype), 'updateDisplay', this).call(this);
    }
  }]);
  return OptionController;
}(Controller);

var StringController = function (_Controller) {
  inherits(StringController, _Controller);
  function StringController(object, property) {
    classCallCheck(this, StringController);
    var _this2 = possibleConstructorReturn(this, (StringController.__proto__ || Object.getPrototypeOf(StringController)).call(this, object, property));
    var _this = _this2;
    function onChange() {
      _this.setValue(_this.__input.value);
    }
    function onBlur() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }
    _this2.__input = document.createElement('input');
    _this2.__input.setAttribute('type', 'text');
    dom.bind(_this2.__input, 'keyup', onChange);
    dom.bind(_this2.__input, 'change', onChange);
    dom.bind(_this2.__input, 'blur', onBlur);
    dom.bind(_this2.__input, 'keydown', function (e) {
      if (e.keyCode === 13) {
        this.blur();
      }
    });
    _this2.updateDisplay();
    _this2.domElement.appendChild(_this2.__input);
    return _this2;
  }
  createClass(StringController, [{
    key: 'updateDisplay',
    value: function updateDisplay() {
      if (!dom.isActive(this.__input)) {
        this.__input.value = this.getValue();
      }
      return get(StringController.prototype.__proto__ || Object.getPrototypeOf(StringController.prototype), 'updateDisplay', this).call(this);
    }
  }]);
  return StringController;
}(Controller);

function numDecimals(x) {
  var _x = x.toString();
  if (_x.indexOf('.') > -1) {
    return _x.length - _x.indexOf('.') - 1;
  }
  return 0;
}
var NumberController = function (_Controller) {
  inherits(NumberController, _Controller);
  function NumberController(object, property, params) {
    classCallCheck(this, NumberController);
    var _this = possibleConstructorReturn(this, (NumberController.__proto__ || Object.getPrototypeOf(NumberController)).call(this, object, property));
    var _params = params || {};
    _this.__min = _params.min;
    _this.__max = _params.max;
    _this.__step = _params.step;
    if (Common.isUndefined(_this.__step)) {
      if (_this.initialValue === 0) {
        _this.__impliedStep = 1;
      } else {
        _this.__impliedStep = Math.pow(10, Math.floor(Math.log(Math.abs(_this.initialValue)) / Math.LN10)) / 10;
      }
    } else {
      _this.__impliedStep = _this.__step;
    }
    _this.__precision = numDecimals(_this.__impliedStep);
    return _this;
  }
  createClass(NumberController, [{
    key: 'setValue',
    value: function setValue(v) {
      var _v = v;
      if (this.__min !== undefined && _v < this.__min) {
        _v = this.__min;
      } else if (this.__max !== undefined && _v > this.__max) {
        _v = this.__max;
      }
      if (this.__step !== undefined && _v % this.__step !== 0) {
        _v = Math.round(_v / this.__step) * this.__step;
      }
      return get(NumberController.prototype.__proto__ || Object.getPrototypeOf(NumberController.prototype), 'setValue', this).call(this, _v);
    }
  }, {
    key: 'min',
    value: function min(minValue) {
      this.__min = minValue;
      return this;
    }
  }, {
    key: 'max',
    value: function max(maxValue) {
      this.__max = maxValue;
      return this;
    }
  }, {
    key: 'step',
    value: function step(stepValue) {
      this.__step = stepValue;
      this.__impliedStep = stepValue;
      this.__precision = numDecimals(stepValue);
      return this;
    }
  }]);
  return NumberController;
}(Controller);

function roundToDecimal(value, decimals) {
  var tenTo = Math.pow(10, decimals);
  return Math.round(value * tenTo) / tenTo;
}
var NumberControllerBox = function (_NumberController) {
  inherits(NumberControllerBox, _NumberController);
  function NumberControllerBox(object, property, params) {
    classCallCheck(this, NumberControllerBox);
    var _this2 = possibleConstructorReturn(this, (NumberControllerBox.__proto__ || Object.getPrototypeOf(NumberControllerBox)).call(this, object, property, params));
    _this2.__truncationSuspended = false;
    var _this = _this2;
    var prevY = void 0;
    function onChange() {
      var attempted = parseFloat(_this.__input.value);
      if (!Common.isNaN(attempted)) {
        _this.setValue(attempted);
      }
    }
    function onFinish() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }
    function onBlur() {
      onFinish();
    }
    function onMouseDrag(e) {
      var diff = prevY - e.clientY;
      _this.setValue(_this.getValue() + diff * _this.__impliedStep);
      prevY = e.clientY;
    }
    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
      onFinish();
    }
    function onMouseDown(e) {
      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);
      prevY = e.clientY;
    }
    _this2.__input = document.createElement('input');
    _this2.__input.setAttribute('type', 'text');
    dom.bind(_this2.__input, 'change', onChange);
    dom.bind(_this2.__input, 'blur', onBlur);
    dom.bind(_this2.__input, 'mousedown', onMouseDown);
    dom.bind(_this2.__input, 'keydown', function (e) {
      if (e.keyCode === 13) {
        _this.__truncationSuspended = true;
        this.blur();
        _this.__truncationSuspended = false;
        onFinish();
      }
    });
    _this2.updateDisplay();
    _this2.domElement.appendChild(_this2.__input);
    return _this2;
  }
  createClass(NumberControllerBox, [{
    key: 'updateDisplay',
    value: function updateDisplay() {
      this.__input.value = this.__truncationSuspended ? this.getValue() : roundToDecimal(this.getValue(), this.__precision);
      return get(NumberControllerBox.prototype.__proto__ || Object.getPrototypeOf(NumberControllerBox.prototype), 'updateDisplay', this).call(this);
    }
  }]);
  return NumberControllerBox;
}(NumberController);

function map(v, i1, i2, o1, o2) {
  return o1 + (o2 - o1) * ((v - i1) / (i2 - i1));
}
var NumberControllerSlider = function (_NumberController) {
  inherits(NumberControllerSlider, _NumberController);
  function NumberControllerSlider(object, property, min, max, step) {
    classCallCheck(this, NumberControllerSlider);
    var _this2 = possibleConstructorReturn(this, (NumberControllerSlider.__proto__ || Object.getPrototypeOf(NumberControllerSlider)).call(this, object, property, { min: min, max: max, step: step }));
    var _this = _this2;
    _this2.__background = document.createElement('div');
    _this2.__foreground = document.createElement('div');
    dom.bind(_this2.__background, 'mousedown', onMouseDown);
    dom.bind(_this2.__background, 'touchstart', onTouchStart);
    dom.addClass(_this2.__background, 'slider');
    dom.addClass(_this2.__foreground, 'slider-fg');
    function onMouseDown(e) {
      document.activeElement.blur();
      dom.bind(window, 'mousemove', onMouseDrag);
      dom.bind(window, 'mouseup', onMouseUp);
      onMouseDrag(e);
    }
    function onMouseDrag(e) {
      e.preventDefault();
      var bgRect = _this.__background.getBoundingClientRect();
      _this.setValue(map(e.clientX, bgRect.left, bgRect.right, _this.__min, _this.__max));
      return false;
    }
    function onMouseUp() {
      dom.unbind(window, 'mousemove', onMouseDrag);
      dom.unbind(window, 'mouseup', onMouseUp);
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }
    function onTouchStart(e) {
      if (e.touches.length !== 1) {
        return;
      }
      dom.bind(window, 'touchmove', onTouchMove);
      dom.bind(window, 'touchend', onTouchEnd);
      onTouchMove(e);
    }
    function onTouchMove(e) {
      var clientX = e.touches[0].clientX;
      var bgRect = _this.__background.getBoundingClientRect();
      _this.setValue(map(clientX, bgRect.left, bgRect.right, _this.__min, _this.__max));
    }
    function onTouchEnd() {
      dom.unbind(window, 'touchmove', onTouchMove);
      dom.unbind(window, 'touchend', onTouchEnd);
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.getValue());
      }
    }
    _this2.updateDisplay();
    _this2.__background.appendChild(_this2.__foreground);
    _this2.domElement.appendChild(_this2.__background);
    return _this2;
  }
  createClass(NumberControllerSlider, [{
    key: 'updateDisplay',
    value: function updateDisplay() {
      var pct = (this.getValue() - this.__min) / (this.__max - this.__min);
      this.__foreground.style.width = pct * 100 + '%';
      return get(NumberControllerSlider.prototype.__proto__ || Object.getPrototypeOf(NumberControllerSlider.prototype), 'updateDisplay', this).call(this);
    }
  }]);
  return NumberControllerSlider;
}(NumberController);

var FunctionController = function (_Controller) {
  inherits(FunctionController, _Controller);
  function FunctionController(object, property, text) {
    classCallCheck(this, FunctionController);
    var _this2 = possibleConstructorReturn(this, (FunctionController.__proto__ || Object.getPrototypeOf(FunctionController)).call(this, object, property));
    var _this = _this2;
    _this2.__button = document.createElement('div');
    _this2.__button.innerHTML = text === undefined ? 'Fire' : text;
    dom.bind(_this2.__button, 'click', function (e) {
      e.preventDefault();
      _this.fire();
      return false;
    });
    dom.addClass(_this2.__button, 'button');
    _this2.domElement.appendChild(_this2.__button);
    return _this2;
  }
  createClass(FunctionController, [{
    key: 'fire',
    value: function fire() {
      if (this.__onChange) {
        this.__onChange.call(this);
      }
      this.getValue().call(this.object);
      if (this.__onFinishChange) {
        this.__onFinishChange.call(this, this.getValue());
      }
    }
  }]);
  return FunctionController;
}(Controller);

var ColorController = function (_Controller) {
  inherits(ColorController, _Controller);
  function ColorController(object, property) {
    classCallCheck(this, ColorController);
    var _this2 = possibleConstructorReturn(this, (ColorController.__proto__ || Object.getPrototypeOf(ColorController)).call(this, object, property));
    _this2.__color = new Color(_this2.getValue());
    _this2.__temp = new Color(0);
    var _this = _this2;
    _this2.domElement = document.createElement('div');
    dom.makeSelectable(_this2.domElement, false);
    _this2.__selector = document.createElement('div');
    _this2.__selector.className = 'selector';
    _this2.__saturation_field = document.createElement('div');
    _this2.__saturation_field.className = 'saturation-field';
    _this2.__field_knob = document.createElement('div');
    _this2.__field_knob.className = 'field-knob';
    _this2.__field_knob_border = '2px solid ';
    _this2.__hue_knob = document.createElement('div');
    _this2.__hue_knob.className = 'hue-knob';
    _this2.__hue_field = document.createElement('div');
    _this2.__hue_field.className = 'hue-field';
    _this2.__input = document.createElement('input');
    _this2.__input.type = 'text';
    _this2.__input_textShadow = '0 1px 1px ';
    dom.bind(_this2.__input, 'keydown', function (e) {
      if (e.keyCode === 13) {
        onBlur.call(this);
      }
    });
    dom.bind(_this2.__input, 'blur', onBlur);
    dom.bind(_this2.__selector, 'mousedown', function () {
      dom.addClass(this, 'drag').bind(window, 'mouseup', function () {
        dom.removeClass(_this.__selector, 'drag');
      });
    });
    dom.bind(_this2.__selector, 'touchstart', function () {
      dom.addClass(this, 'drag').bind(window, 'touchend', function () {
        dom.removeClass(_this.__selector, 'drag');
      });
    });
    var valueField = document.createElement('div');
    Common.extend(_this2.__selector.style, {
      width: '122px',
      height: '102px',
      padding: '3px',
      backgroundColor: '#222',
      boxShadow: '0px 1px 3px rgba(0,0,0,0.3)'
    });
    Common.extend(_this2.__field_knob.style, {
      position: 'absolute',
      width: '12px',
      height: '12px',
      border: _this2.__field_knob_border + (_this2.__color.v < 0.5 ? '#fff' : '#000'),
      boxShadow: '0px 1px 3px rgba(0,0,0,0.5)',
      borderRadius: '12px',
      zIndex: 1
    });
    Common.extend(_this2.__hue_knob.style, {
      position: 'absolute',
      width: '15px',
      height: '2px',
      borderRight: '4px solid #fff',
      zIndex: 1
    });
    Common.extend(_this2.__saturation_field.style, {
      width: '100px',
      height: '100px',
      border: '1px solid #555',
      marginRight: '3px',
      display: 'inline-block',
      cursor: 'pointer'
    });
    Common.extend(valueField.style, {
      width: '100%',
      height: '100%',
      background: 'none'
    });
    linearGradient(valueField, 'top', 'rgba(0,0,0,0)', '#000');
    Common.extend(_this2.__hue_field.style, {
      width: '15px',
      height: '100px',
      border: '1px solid #555',
      cursor: 'ns-resize',
      position: 'absolute',
      top: '3px',
      right: '3px'
    });
    hueGradient(_this2.__hue_field);
    Common.extend(_this2.__input.style, {
      outline: 'none',
      textAlign: 'center',
      color: '#fff',
      border: 0,
      fontWeight: 'bold',
      textShadow: _this2.__input_textShadow + 'rgba(0,0,0,0.7)'
    });
    dom.bind(_this2.__saturation_field, 'mousedown', fieldDown);
    dom.bind(_this2.__saturation_field, 'touchstart', fieldDown);
    dom.bind(_this2.__field_knob, 'mousedown', fieldDown);
    dom.bind(_this2.__field_knob, 'touchstart', fieldDown);
    dom.bind(_this2.__hue_field, 'mousedown', fieldDownH);
    dom.bind(_this2.__hue_field, 'touchstart', fieldDownH);
    function fieldDown(e) {
      setSV(e);
      dom.bind(window, 'mousemove', setSV);
      dom.bind(window, 'touchmove', setSV);
      dom.bind(window, 'mouseup', fieldUpSV);
      dom.bind(window, 'touchend', fieldUpSV);
    }
    function fieldDownH(e) {
      setH(e);
      dom.bind(window, 'mousemove', setH);
      dom.bind(window, 'touchmove', setH);
      dom.bind(window, 'mouseup', fieldUpH);
      dom.bind(window, 'touchend', fieldUpH);
    }
    function fieldUpSV() {
      dom.unbind(window, 'mousemove', setSV);
      dom.unbind(window, 'touchmove', setSV);
      dom.unbind(window, 'mouseup', fieldUpSV);
      dom.unbind(window, 'touchend', fieldUpSV);
      onFinish();
    }
    function fieldUpH() {
      dom.unbind(window, 'mousemove', setH);
      dom.unbind(window, 'touchmove', setH);
      dom.unbind(window, 'mouseup', fieldUpH);
      dom.unbind(window, 'touchend', fieldUpH);
      onFinish();
    }
    function onBlur() {
      var i = interpret(this.value);
      if (i !== false) {
        _this.__color.__state = i;
        _this.setValue(_this.__color.toOriginal());
      } else {
        this.value = _this.__color.toString();
      }
    }
    function onFinish() {
      if (_this.__onFinishChange) {
        _this.__onFinishChange.call(_this, _this.__color.toOriginal());
      }
    }
    _this2.__saturation_field.appendChild(valueField);
    _this2.__selector.appendChild(_this2.__field_knob);
    _this2.__selector.appendChild(_this2.__saturation_field);
    _this2.__selector.appendChild(_this2.__hue_field);
    _this2.__hue_field.appendChild(_this2.__hue_knob);
    _this2.domElement.appendChild(_this2.__input);
    _this2.domElement.appendChild(_this2.__selector);
    _this2.updateDisplay();
    function setSV(e) {
      if (e.type.indexOf('touch') === -1) {
        e.preventDefault();
      }
      var fieldRect = _this.__saturation_field.getBoundingClientRect();
      var _ref = e.touches && e.touches[0] || e,
          clientX = _ref.clientX,
          clientY = _ref.clientY;
      var s = (clientX - fieldRect.left) / (fieldRect.right - fieldRect.left);
      var v = 1 - (clientY - fieldRect.top) / (fieldRect.bottom - fieldRect.top);
      if (v > 1) {
        v = 1;
      } else if (v < 0) {
        v = 0;
      }
      if (s > 1) {
        s = 1;
      } else if (s < 0) {
        s = 0;
      }
      _this.__color.v = v;
      _this.__color.s = s;
      _this.setValue(_this.__color.toOriginal());
      return false;
    }
    function setH(e) {
      if (e.type.indexOf('touch') === -1) {
        e.preventDefault();
      }
      var fieldRect = _this.__hue_field.getBoundingClientRect();
      var _ref2 = e.touches && e.touches[0] || e,
          clientY = _ref2.clientY;
      var h = 1 - (clientY - fieldRect.top) / (fieldRect.bottom - fieldRect.top);
      if (h > 1) {
        h = 1;
      } else if (h < 0) {
        h = 0;
      }
      _this.__color.h = h * 360;
      _this.setValue(_this.__color.toOriginal());
      return false;
    }
    return _this2;
  }
  createClass(ColorController, [{
    key: 'updateDisplay',
    value: function updateDisplay() {
      var i = interpret(this.getValue());
      if (i !== false) {
        var mismatch = false;
        Common.each(Color.COMPONENTS, function (component) {
          if (!Common.isUndefined(i[component]) && !Common.isUndefined(this.__color.__state[component]) && i[component] !== this.__color.__state[component]) {
            mismatch = true;
            return {};
          }
        }, this);
        if (mismatch) {
          Common.extend(this.__color.__state, i);
        }
      }
      Common.extend(this.__temp.__state, this.__color.__state);
      this.__temp.a = 1;
      var flip = this.__color.v < 0.5 || this.__color.s > 0.5 ? 255 : 0;
      var _flip = 255 - flip;
      Common.extend(this.__field_knob.style, {
        marginLeft: 100 * this.__color.s - 7 + 'px',
        marginTop: 100 * (1 - this.__color.v) - 7 + 'px',
        backgroundColor: this.__temp.toHexString(),
        border: this.__field_knob_border + 'rgb(' + flip + ',' + flip + ',' + flip + ')'
      });
      this.__hue_knob.style.marginTop = (1 - this.__color.h / 360) * 100 + 'px';
      this.__temp.s = 1;
      this.__temp.v = 1;
      linearGradient(this.__saturation_field, 'left', '#fff', this.__temp.toHexString());
      this.__input.value = this.__color.toString();
      Common.extend(this.__input.style, {
        backgroundColor: this.__color.toHexString(),
        color: 'rgb(' + flip + ',' + flip + ',' + flip + ')',
        textShadow: this.__input_textShadow + 'rgba(' + _flip + ',' + _flip + ',' + _flip + ',.7)'
      });
    }
  }]);
  return ColorController;
}(Controller);
var vendors = ['-moz-', '-o-', '-webkit-', '-ms-', ''];
function linearGradient(elem, x, a, b) {
  elem.style.background = '';
  Common.each(vendors, function (vendor) {
    elem.style.cssText += 'background: ' + vendor + 'linear-gradient(' + x + ', ' + a + ' 0%, ' + b + ' 100%); ';
  });
}
function hueGradient(elem) {
  elem.style.background = '';
  elem.style.cssText += 'background: -moz-linear-gradient(top,  #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%);';
  elem.style.cssText += 'background: -webkit-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);';
  elem.style.cssText += 'background: -o-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);';
  elem.style.cssText += 'background: -ms-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);';
  elem.style.cssText += 'background: linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);';
}

var css = {
  load: function load(url, indoc) {
    var doc = indoc || document;
    var link = doc.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = url;
    doc.getElementsByTagName('head')[0].appendChild(link);
  },
  inject: function inject(cssContent, indoc) {
    var doc = indoc || document;
    var injected = document.createElement('style');
    injected.type = 'text/css';
    injected.innerHTML = cssContent;
    var head = doc.getElementsByTagName('head')[0];
    try {
      head.appendChild(injected);
    } catch (e) {
    }
  }
};

var saveDialogContents = "<div id=\"dg-save\" class=\"dg dialogue\">\n\n  Here's the new load parameter for your <code>GUI</code>'s constructor:\n\n  <textarea id=\"dg-new-constructor\"></textarea>\n\n  <div id=\"dg-save-locally\">\n\n    <input id=\"dg-local-storage\" type=\"checkbox\"/> Automatically save\n    values to <code>localStorage</code> on exit.\n\n    <div id=\"dg-local-explain\">The values saved to <code>localStorage</code> will\n      override those passed to <code>dat.GUI</code>'s constructor. This makes it\n      easier to work incrementally, but <code>localStorage</code> is fragile,\n      and your friends may not see the same values you do.\n\n    </div>\n\n  </div>\n\n</div>";

var ControllerFactory = function ControllerFactory(object, property) {
  var initialValue = object[property];
  if (Common.isArray(arguments[2]) || Common.isObject(arguments[2])) {
    return new OptionController(object, property, arguments[2]);
  }
  if (Common.isNumber(initialValue)) {
    if (Common.isNumber(arguments[2]) && Common.isNumber(arguments[3])) {
      if (Common.isNumber(arguments[4])) {
        return new NumberControllerSlider(object, property, arguments[2], arguments[3], arguments[4]);
      }
      return new NumberControllerSlider(object, property, arguments[2], arguments[3]);
    }
    if (Common.isNumber(arguments[4])) {
      return new NumberControllerBox(object, property, { min: arguments[2], max: arguments[3], step: arguments[4] });
    }
    return new NumberControllerBox(object, property, { min: arguments[2], max: arguments[3] });
  }
  if (Common.isString(initialValue)) {
    return new StringController(object, property);
  }
  if (Common.isFunction(initialValue)) {
    return new FunctionController(object, property, '');
  }
  if (Common.isBoolean(initialValue)) {
    return new BooleanController(object, property);
  }
  return null;
};

function requestAnimationFrame$1(callback) {
  setTimeout(callback, 1000 / 60);
}
var requestAnimationFrame$1$1 = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || requestAnimationFrame$1;

var CenteredDiv = function () {
  function CenteredDiv() {
    classCallCheck(this, CenteredDiv);
    this.backgroundElement = document.createElement('div');
    Common.extend(this.backgroundElement.style, {
      backgroundColor: 'rgba(0,0,0,0.8)',
      top: 0,
      left: 0,
      display: 'none',
      zIndex: '1000',
      opacity: 0,
      WebkitTransition: 'opacity 0.2s linear',
      transition: 'opacity 0.2s linear'
    });
    dom.makeFullscreen(this.backgroundElement);
    this.backgroundElement.style.position = 'fixed';
    this.domElement = document.createElement('div');
    Common.extend(this.domElement.style, {
      position: 'fixed',
      display: 'none',
      zIndex: '1001',
      opacity: 0,
      WebkitTransition: '-webkit-transform 0.2s ease-out, opacity 0.2s linear',
      transition: 'transform 0.2s ease-out, opacity 0.2s linear'
    });
    document.body.appendChild(this.backgroundElement);
    document.body.appendChild(this.domElement);
    var _this = this;
    dom.bind(this.backgroundElement, 'click', function () {
      _this.hide();
    });
  }
  createClass(CenteredDiv, [{
    key: 'show',
    value: function show() {
      var _this = this;
      this.backgroundElement.style.display = 'block';
      this.domElement.style.display = 'block';
      this.domElement.style.opacity = 0;
      this.domElement.style.webkitTransform = 'scale(1.1)';
      this.layout();
      Common.defer(function () {
        _this.backgroundElement.style.opacity = 1;
        _this.domElement.style.opacity = 1;
        _this.domElement.style.webkitTransform = 'scale(1)';
      });
    }
  }, {
    key: 'hide',
    value: function hide() {
      var _this = this;
      var hide = function hide() {
        _this.domElement.style.display = 'none';
        _this.backgroundElement.style.display = 'none';
        dom.unbind(_this.domElement, 'webkitTransitionEnd', hide);
        dom.unbind(_this.domElement, 'transitionend', hide);
        dom.unbind(_this.domElement, 'oTransitionEnd', hide);
      };
      dom.bind(this.domElement, 'webkitTransitionEnd', hide);
      dom.bind(this.domElement, 'transitionend', hide);
      dom.bind(this.domElement, 'oTransitionEnd', hide);
      this.backgroundElement.style.opacity = 0;
      this.domElement.style.opacity = 0;
      this.domElement.style.webkitTransform = 'scale(1.1)';
    }
  }, {
    key: 'layout',
    value: function layout() {
      this.domElement.style.left = window.innerWidth / 2 - dom.getWidth(this.domElement) / 2 + 'px';
      this.domElement.style.top = window.innerHeight / 2 - dom.getHeight(this.domElement) / 2 + 'px';
    }
  }]);
  return CenteredDiv;
}();

var styleSheet = ___$insertStyle(".dg ul{list-style:none;margin:0;padding:0;width:100%;clear:both}.dg.ac{position:fixed;top:0;left:0;right:0;height:0;z-index:0}.dg:not(.ac) .main{overflow:hidden}.dg.main{-webkit-transition:opacity .1s linear;-o-transition:opacity .1s linear;-moz-transition:opacity .1s linear;transition:opacity .1s linear}.dg.main.taller-than-window{overflow-y:auto}.dg.main.taller-than-window .close-button{opacity:1;margin-top:-1px;border-top:1px solid #2c2c2c}.dg.main ul.closed .close-button{opacity:1 !important}.dg.main:hover .close-button,.dg.main .close-button.drag{opacity:1}.dg.main .close-button{-webkit-transition:opacity .1s linear;-o-transition:opacity .1s linear;-moz-transition:opacity .1s linear;transition:opacity .1s linear;border:0;line-height:19px;height:20px;cursor:pointer;text-align:center;background-color:#000}.dg.main .close-button.close-top{position:relative}.dg.main .close-button.close-bottom{position:absolute}.dg.main .close-button:hover{background-color:#111}.dg.a{float:right;margin-right:15px;overflow-y:visible}.dg.a.has-save>ul.close-top{margin-top:0}.dg.a.has-save>ul.close-bottom{margin-top:27px}.dg.a.has-save>ul.closed{margin-top:0}.dg.a .save-row{top:0;z-index:1002}.dg.a .save-row.close-top{position:relative}.dg.a .save-row.close-bottom{position:fixed}.dg li{-webkit-transition:height .1s ease-out;-o-transition:height .1s ease-out;-moz-transition:height .1s ease-out;transition:height .1s ease-out;-webkit-transition:overflow .1s linear;-o-transition:overflow .1s linear;-moz-transition:overflow .1s linear;transition:overflow .1s linear}.dg li:not(.folder){cursor:auto;height:27px;line-height:27px;padding:0 4px 0 5px}.dg li.folder{padding:0;border-left:4px solid rgba(0,0,0,0)}.dg li.title{cursor:pointer;margin-left:-4px}.dg .closed li:not(.title),.dg .closed ul li,.dg .closed ul li>*{height:0;overflow:hidden;border:0}.dg .cr{clear:both;padding-left:3px;height:27px;overflow:hidden}.dg .property-name{cursor:default;float:left;clear:left;width:40%;overflow:hidden;text-overflow:ellipsis}.dg .cr.function .property-name{width:100%}.dg .c{float:left;width:60%;position:relative}.dg .c input[type=text]{border:0;margin-top:4px;padding:3px;width:100%;float:right}.dg .has-slider input[type=text]{width:30%;margin-left:0}.dg .slider{float:left;width:66%;margin-left:-5px;margin-right:0;height:19px;margin-top:4px}.dg .slider-fg{height:100%}.dg .c input[type=checkbox]{margin-top:7px}.dg .c select{margin-top:5px}.dg .cr.function,.dg .cr.function .property-name,.dg .cr.function *,.dg .cr.boolean,.dg .cr.boolean *{cursor:pointer}.dg .cr.color{overflow:visible}.dg .selector{display:none;position:absolute;margin-left:-9px;margin-top:23px;z-index:10}.dg .c:hover .selector,.dg .selector.drag{display:block}.dg li.save-row{padding:0}.dg li.save-row .button{display:inline-block;padding:0px 6px}.dg.dialogue{background-color:#222;width:460px;padding:15px;font-size:13px;line-height:15px}#dg-new-constructor{padding:10px;color:#222;font-family:Monaco, monospace;font-size:10px;border:0;resize:none;box-shadow:inset 1px 1px 1px #888;word-wrap:break-word;margin:12px 0;display:block;width:440px;overflow-y:scroll;height:100px;position:relative}#dg-local-explain{display:none;font-size:11px;line-height:17px;border-radius:3px;background-color:#333;padding:8px;margin-top:10px}#dg-local-explain code{font-size:10px}#dat-gui-save-locally{display:none}.dg{color:#eee;font:11px 'Lucida Grande', sans-serif;text-shadow:0 -1px 0 #111}.dg.main::-webkit-scrollbar{width:5px;background:#1a1a1a}.dg.main::-webkit-scrollbar-corner{height:0;display:none}.dg.main::-webkit-scrollbar-thumb{border-radius:5px;background:#676767}.dg li:not(.folder){background:#1a1a1a;border-bottom:1px solid #2c2c2c}.dg li.save-row{line-height:25px;background:#dad5cb;border:0}.dg li.save-row select{margin-left:5px;width:108px}.dg li.save-row .button{margin-left:5px;margin-top:1px;border-radius:2px;font-size:9px;line-height:7px;padding:4px 4px 5px 4px;background:#c5bdad;color:#fff;text-shadow:0 1px 0 #b0a58f;box-shadow:0 -1px 0 #b0a58f;cursor:pointer}.dg li.save-row .button.gears{background:#c5bdad url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQJJREFUeNpiYKAU/P//PwGIC/ApCABiBSAW+I8AClAcgKxQ4T9hoMAEUrxx2QSGN6+egDX+/vWT4e7N82AMYoPAx/evwWoYoSYbACX2s7KxCxzcsezDh3evFoDEBYTEEqycggWAzA9AuUSQQgeYPa9fPv6/YWm/Acx5IPb7ty/fw+QZblw67vDs8R0YHyQhgObx+yAJkBqmG5dPPDh1aPOGR/eugW0G4vlIoTIfyFcA+QekhhHJhPdQxbiAIguMBTQZrPD7108M6roWYDFQiIAAv6Aow/1bFwXgis+f2LUAynwoIaNcz8XNx3Dl7MEJUDGQpx9gtQ8YCueB+D26OECAAQDadt7e46D42QAAAABJRU5ErkJggg==) 2px 1px no-repeat;height:7px;width:8px}.dg li.save-row .button:hover{background-color:#bab19e;box-shadow:0 -1px 0 #b0a58f}.dg li.folder{border-bottom:0}.dg li.title{padding-left:16px;background:#000 url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlI+hKgFxoCgAOw==) 6px 10px no-repeat;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.2)}.dg .closed li.title{background-image:url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlGIWqMCbWAEAOw==)}.dg .cr.boolean{border-left:3px solid #806787}.dg .cr.color{border-left:3px solid}.dg .cr.function{border-left:3px solid #e61d5f}.dg .cr.number{border-left:3px solid #2FA1D6}.dg .cr.number input[type=text]{color:#2FA1D6}.dg .cr.string{border-left:3px solid #1ed36f}.dg .cr.string input[type=text]{color:#1ed36f}.dg .cr.function:hover,.dg .cr.boolean:hover{background:#111}.dg .c input[type=text]{background:#303030;outline:none}.dg .c input[type=text]:hover{background:#3c3c3c}.dg .c input[type=text]:focus{background:#494949;color:#fff}.dg .c .slider{background:#303030;cursor:ew-resize}.dg .c .slider-fg{background:#2FA1D6;max-width:100%}.dg .c .slider:hover{background:#3c3c3c}.dg .c .slider:hover .slider-fg{background:#44abda}\n");

css.inject(styleSheet);
var CSS_NAMESPACE = 'dg';
var HIDE_KEY_CODE = 72;
var CLOSE_BUTTON_HEIGHT = 20;
var DEFAULT_DEFAULT_PRESET_NAME = 'Default';
var SUPPORTS_LOCAL_STORAGE = function () {
  try {
    return !!window.localStorage;
  } catch (e) {
    return false;
  }
}();
var SAVE_DIALOGUE = void 0;
var autoPlaceVirgin = true;
var autoPlaceContainer = void 0;
var hide = false;
var hideableGuis = [];
var GUI = function GUI(pars) {
  var _this = this;
  var params = pars || {};
  this.domElement = document.createElement('div');
  this.__ul = document.createElement('ul');
  this.domElement.appendChild(this.__ul);
  dom.addClass(this.domElement, CSS_NAMESPACE);
  this.__folders = {};
  this.__controllers = [];
  this.__rememberedObjects = [];
  this.__rememberedObjectIndecesToControllers = [];
  this.__listening = [];
  params = Common.defaults(params, {
    closeOnTop: false,
    autoPlace: true,
    width: GUI.DEFAULT_WIDTH
  });
  params = Common.defaults(params, {
    resizable: params.autoPlace,
    hideable: params.autoPlace
  });
  if (!Common.isUndefined(params.load)) {
    if (params.preset) {
      params.load.preset = params.preset;
    }
  } else {
    params.load = { preset: DEFAULT_DEFAULT_PRESET_NAME };
  }
  if (Common.isUndefined(params.parent) && params.hideable) {
    hideableGuis.push(this);
  }
  params.resizable = Common.isUndefined(params.parent) && params.resizable;
  if (params.autoPlace && Common.isUndefined(params.scrollable)) {
    params.scrollable = true;
  }
  var useLocalStorage = SUPPORTS_LOCAL_STORAGE && localStorage.getItem(getLocalStorageHash(this, 'isLocal')) === 'true';
  var saveToLocalStorage = void 0;
  var titleRow = void 0;
  Object.defineProperties(this,
  {
    parent: {
      get: function get$$1() {
        return params.parent;
      }
    },
    scrollable: {
      get: function get$$1() {
        return params.scrollable;
      }
    },
    autoPlace: {
      get: function get$$1() {
        return params.autoPlace;
      }
    },
    closeOnTop: {
      get: function get$$1() {
        return params.closeOnTop;
      }
    },
    preset: {
      get: function get$$1() {
        if (_this.parent) {
          return _this.getRoot().preset;
        }
        return params.load.preset;
      },
      set: function set$$1(v) {
        if (_this.parent) {
          _this.getRoot().preset = v;
        } else {
          params.load.preset = v;
        }
        setPresetSelectIndex(this);
        _this.revert();
      }
    },
    width: {
      get: function get$$1() {
        return params.width;
      },
      set: function set$$1(v) {
        params.width = v;
        setWidth(_this, v);
      }
    },
    name: {
      get: function get$$1() {
        return params.name;
      },
      set: function set$$1(v) {
        params.name = v;
        if (titleRow) {
          titleRow.innerHTML = params.name;
        }
      }
    },
    closed: {
      get: function get$$1() {
        return params.closed;
      },
      set: function set$$1(v) {
        params.closed = v;
        if (params.closed) {
          dom.addClass(_this.__ul, GUI.CLASS_CLOSED);
        } else {
          dom.removeClass(_this.__ul, GUI.CLASS_CLOSED);
        }
        this.onResize();
        if (_this.__closeButton) {
          _this.__closeButton.innerHTML = v ? GUI.TEXT_OPEN : GUI.TEXT_CLOSED;
        }
      }
    },
    load: {
      get: function get$$1() {
        return params.load;
      }
    },
    useLocalStorage: {
      get: function get$$1() {
        return useLocalStorage;
      },
      set: function set$$1(bool) {
        if (SUPPORTS_LOCAL_STORAGE) {
          useLocalStorage = bool;
          if (bool) {
            dom.bind(window, 'unload', saveToLocalStorage);
          } else {
            dom.unbind(window, 'unload', saveToLocalStorage);
          }
          localStorage.setItem(getLocalStorageHash(_this, 'isLocal'), bool);
        }
      }
    }
  });
  if (Common.isUndefined(params.parent)) {
    this.closed = params.closed || false;
    dom.addClass(this.domElement, GUI.CLASS_MAIN);
    dom.makeSelectable(this.domElement, false);
    if (SUPPORTS_LOCAL_STORAGE) {
      if (useLocalStorage) {
        _this.useLocalStorage = true;
        var savedGui = localStorage.getItem(getLocalStorageHash(this, 'gui'));
        if (savedGui) {
          params.load = JSON.parse(savedGui);
        }
      }
    }
    this.__closeButton = document.createElement('div');
    this.__closeButton.innerHTML = GUI.TEXT_CLOSED;
    dom.addClass(this.__closeButton, GUI.CLASS_CLOSE_BUTTON);
    if (params.closeOnTop) {
      dom.addClass(this.__closeButton, GUI.CLASS_CLOSE_TOP);
      this.domElement.insertBefore(this.__closeButton, this.domElement.childNodes[0]);
    } else {
      dom.addClass(this.__closeButton, GUI.CLASS_CLOSE_BOTTOM);
      this.domElement.appendChild(this.__closeButton);
    }
    dom.bind(this.__closeButton, 'click', function () {
      _this.closed = !_this.closed;
    });
  } else {
    if (params.closed === undefined) {
      params.closed = true;
    }
    var titleRowName = document.createTextNode(params.name);
    dom.addClass(titleRowName, 'controller-name');
    titleRow = addRow(_this, titleRowName);
    var onClickTitle = function onClickTitle(e) {
      e.preventDefault();
      _this.closed = !_this.closed;
      return false;
    };
    dom.addClass(this.__ul, GUI.CLASS_CLOSED);
    dom.addClass(titleRow, 'title');
    dom.bind(titleRow, 'click', onClickTitle);
    if (!params.closed) {
      this.closed = false;
    }
  }
  if (params.autoPlace) {
    if (Common.isUndefined(params.parent)) {
      if (autoPlaceVirgin) {
        autoPlaceContainer = document.createElement('div');
        dom.addClass(autoPlaceContainer, CSS_NAMESPACE);
        dom.addClass(autoPlaceContainer, GUI.CLASS_AUTO_PLACE_CONTAINER);
        document.body.appendChild(autoPlaceContainer);
        autoPlaceVirgin = false;
      }
      autoPlaceContainer.appendChild(this.domElement);
      dom.addClass(this.domElement, GUI.CLASS_AUTO_PLACE);
    }
    if (!this.parent) {
      setWidth(_this, params.width);
    }
  }
  this.__resizeHandler = function () {
    _this.onResizeDebounced();
  };
  dom.bind(window, 'resize', this.__resizeHandler);
  dom.bind(this.__ul, 'webkitTransitionEnd', this.__resizeHandler);
  dom.bind(this.__ul, 'transitionend', this.__resizeHandler);
  dom.bind(this.__ul, 'oTransitionEnd', this.__resizeHandler);
  this.onResize();
  if (params.resizable) {
    addResizeHandle(this);
  }
  saveToLocalStorage = function saveToLocalStorage() {
    if (SUPPORTS_LOCAL_STORAGE && localStorage.getItem(getLocalStorageHash(_this, 'isLocal')) === 'true') {
      localStorage.setItem(getLocalStorageHash(_this, 'gui'), JSON.stringify(_this.getSaveObject()));
    }
  };
  this.saveToLocalStorageIfPossible = saveToLocalStorage;
  function resetWidth() {
    var root = _this.getRoot();
    root.width += 1;
    Common.defer(function () {
      root.width -= 1;
    });
  }
  if (!params.parent) {
    resetWidth();
  }
};
GUI.toggleHide = function () {
  hide = !hide;
  Common.each(hideableGuis, function (gui) {
    gui.domElement.style.display = hide ? 'none' : '';
  });
};
GUI.CLASS_AUTO_PLACE = 'a';
GUI.CLASS_AUTO_PLACE_CONTAINER = 'ac';
GUI.CLASS_MAIN = 'main';
GUI.CLASS_CONTROLLER_ROW = 'cr';
GUI.CLASS_TOO_TALL = 'taller-than-window';
GUI.CLASS_CLOSED = 'closed';
GUI.CLASS_CLOSE_BUTTON = 'close-button';
GUI.CLASS_CLOSE_TOP = 'close-top';
GUI.CLASS_CLOSE_BOTTOM = 'close-bottom';
GUI.CLASS_DRAG = 'drag';
GUI.DEFAULT_WIDTH = 245;
GUI.TEXT_CLOSED = 'Close Controls';
GUI.TEXT_OPEN = 'Open Controls';
GUI._keydownHandler = function (e) {
  if (document.activeElement.type !== 'text' && (e.which === HIDE_KEY_CODE || e.keyCode === HIDE_KEY_CODE)) {
    GUI.toggleHide();
  }
};
dom.bind(window, 'keydown', GUI._keydownHandler, false);
Common.extend(GUI.prototype,
{
  add: function add(object, property) {
    return _add(this, object, property, {
      factoryArgs: Array.prototype.slice.call(arguments, 2)
    });
  },
  addColor: function addColor(object, property) {
    return _add(this, object, property, {
      color: true
    });
  },
  remove: function remove(controller) {
    this.__ul.removeChild(controller.__li);
    this.__controllers.splice(this.__controllers.indexOf(controller), 1);
    var _this = this;
    Common.defer(function () {
      _this.onResize();
    });
  },
  destroy: function destroy() {
    if (this.parent) {
      throw new Error('Only the root GUI should be removed with .destroy(). ' + 'For subfolders, use gui.removeFolder(folder) instead.');
    }
    if (this.autoPlace) {
      autoPlaceContainer.removeChild(this.domElement);
    }
    var _this = this;
    Common.each(this.__folders, function (subfolder) {
      _this.removeFolder(subfolder);
    });
    dom.unbind(window, 'keydown', GUI._keydownHandler, false);
    removeListeners(this);
  },
  addFolder: function addFolder(name) {
    if (this.__folders[name] !== undefined) {
      throw new Error('You already have a folder in this GUI by the' + ' name "' + name + '"');
    }
    var newGuiParams = { name: name, parent: this };
    newGuiParams.autoPlace = this.autoPlace;
    if (this.load &&
    this.load.folders &&
    this.load.folders[name]) {
      newGuiParams.closed = this.load.folders[name].closed;
      newGuiParams.load = this.load.folders[name];
    }
    var gui = new GUI(newGuiParams);
    this.__folders[name] = gui;
    var li = addRow(this, gui.domElement);
    dom.addClass(li, 'folder');
    return gui;
  },
  removeFolder: function removeFolder(folder) {
    this.__ul.removeChild(folder.domElement.parentElement);
    delete this.__folders[folder.name];
    if (this.load &&
    this.load.folders &&
    this.load.folders[folder.name]) {
      delete this.load.folders[folder.name];
    }
    removeListeners(folder);
    var _this = this;
    Common.each(folder.__folders, function (subfolder) {
      folder.removeFolder(subfolder);
    });
    Common.defer(function () {
      _this.onResize();
    });
  },
  open: function open() {
    this.closed = false;
  },
  close: function close() {
    this.closed = true;
  },
  hide: function hide() {
    this.domElement.style.display = 'none';
  },
  show: function show() {
    this.domElement.style.display = '';
  },
  onResize: function onResize() {
    var root = this.getRoot();
    if (root.scrollable) {
      var top = dom.getOffset(root.__ul).top;
      var h = 0;
      Common.each(root.__ul.childNodes, function (node) {
        if (!(root.autoPlace && node === root.__save_row)) {
          h += dom.getHeight(node);
        }
      });
      if (window.innerHeight - top - CLOSE_BUTTON_HEIGHT < h) {
        dom.addClass(root.domElement, GUI.CLASS_TOO_TALL);
        root.__ul.style.height = window.innerHeight - top - CLOSE_BUTTON_HEIGHT + 'px';
      } else {
        dom.removeClass(root.domElement, GUI.CLASS_TOO_TALL);
        root.__ul.style.height = 'auto';
      }
    }
    if (root.__resize_handle) {
      Common.defer(function () {
        root.__resize_handle.style.height = root.__ul.offsetHeight + 'px';
      });
    }
    if (root.__closeButton) {
      root.__closeButton.style.width = root.width + 'px';
    }
  },
  onResizeDebounced: Common.debounce(function () {
    this.onResize();
  }, 50),
  remember: function remember() {
    if (Common.isUndefined(SAVE_DIALOGUE)) {
      SAVE_DIALOGUE = new CenteredDiv();
      SAVE_DIALOGUE.domElement.innerHTML = saveDialogContents;
    }
    if (this.parent) {
      throw new Error('You can only call remember on a top level GUI.');
    }
    var _this = this;
    Common.each(Array.prototype.slice.call(arguments), function (object) {
      if (_this.__rememberedObjects.length === 0) {
        addSaveMenu(_this);
      }
      if (_this.__rememberedObjects.indexOf(object) === -1) {
        _this.__rememberedObjects.push(object);
      }
    });
    if (this.autoPlace) {
      setWidth(this, this.width);
    }
  },
  getRoot: function getRoot() {
    var gui = this;
    while (gui.parent) {
      gui = gui.parent;
    }
    return gui;
  },
  getSaveObject: function getSaveObject() {
    var toReturn = this.load;
    toReturn.closed = this.closed;
    if (this.__rememberedObjects.length > 0) {
      toReturn.preset = this.preset;
      if (!toReturn.remembered) {
        toReturn.remembered = {};
      }
      toReturn.remembered[this.preset] = getCurrentPreset(this);
    }
    toReturn.folders = {};
    Common.each(this.__folders, function (element, key) {
      toReturn.folders[key] = element.getSaveObject();
    });
    return toReturn;
  },
  save: function save() {
    if (!this.load.remembered) {
      this.load.remembered = {};
    }
    this.load.remembered[this.preset] = getCurrentPreset(this);
    markPresetModified(this, false);
    this.saveToLocalStorageIfPossible();
  },
  saveAs: function saveAs(presetName) {
    if (!this.load.remembered) {
      this.load.remembered = {};
      this.load.remembered[DEFAULT_DEFAULT_PRESET_NAME] = getCurrentPreset(this, true);
    }
    this.load.remembered[presetName] = getCurrentPreset(this);
    this.preset = presetName;
    addPresetOption(this, presetName, true);
    this.saveToLocalStorageIfPossible();
  },
  revert: function revert(gui) {
    Common.each(this.__controllers, function (controller) {
      if (!this.getRoot().load.remembered) {
        controller.setValue(controller.initialValue);
      } else {
        recallSavedValue(gui || this.getRoot(), controller);
      }
      if (controller.__onFinishChange) {
        controller.__onFinishChange.call(controller, controller.getValue());
      }
    }, this);
    Common.each(this.__folders, function (folder) {
      folder.revert(folder);
    });
    if (!gui) {
      markPresetModified(this.getRoot(), false);
    }
  },
  listen: function listen(controller) {
    var init = this.__listening.length === 0;
    this.__listening.push(controller);
    if (init) {
      updateDisplays(this.__listening);
    }
  },
  updateDisplay: function updateDisplay() {
    Common.each(this.__controllers, function (controller) {
      controller.updateDisplay();
    });
    Common.each(this.__folders, function (folder) {
      folder.updateDisplay();
    });
  }
});
function addRow(gui, newDom, liBefore) {
  var li = document.createElement('li');
  if (newDom) {
    li.appendChild(newDom);
  }
  if (liBefore) {
    gui.__ul.insertBefore(li, liBefore);
  } else {
    gui.__ul.appendChild(li);
  }
  gui.onResize();
  return li;
}
function removeListeners(gui) {
  dom.unbind(window, 'resize', gui.__resizeHandler);
  if (gui.saveToLocalStorageIfPossible) {
    dom.unbind(window, 'unload', gui.saveToLocalStorageIfPossible);
  }
}
function markPresetModified(gui, modified) {
  var opt = gui.__preset_select[gui.__preset_select.selectedIndex];
  if (modified) {
    opt.innerHTML = opt.value + '*';
  } else {
    opt.innerHTML = opt.value;
  }
}
function augmentController(gui, li, controller) {
  controller.__li = li;
  controller.__gui = gui;
  Common.extend(controller, {
    options: function options(_options) {
      if (arguments.length > 1) {
        var nextSibling = controller.__li.nextElementSibling;
        controller.remove();
        return _add(gui, controller.object, controller.property, {
          before: nextSibling,
          factoryArgs: [Common.toArray(arguments)]
        });
      }
      if (Common.isArray(_options) || Common.isObject(_options)) {
        var _nextSibling = controller.__li.nextElementSibling;
        controller.remove();
        return _add(gui, controller.object, controller.property, {
          before: _nextSibling,
          factoryArgs: [_options]
        });
      }
    },
    name: function name(_name) {
      controller.__li.firstElementChild.firstElementChild.innerHTML = _name;
      return controller;
    },
    listen: function listen() {
      controller.__gui.listen(controller);
      return controller;
    },
    remove: function remove() {
      controller.__gui.remove(controller);
      return controller;
    }
  });
  if (controller instanceof NumberControllerSlider) {
    var box = new NumberControllerBox(controller.object, controller.property, { min: controller.__min, max: controller.__max, step: controller.__step });
    Common.each(['updateDisplay', 'onChange', 'onFinishChange', 'step', 'min', 'max'], function (method) {
      var pc = controller[method];
      var pb = box[method];
      controller[method] = box[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        pb.apply(box, args);
        return pc.apply(controller, args);
      };
    });
    dom.addClass(li, 'has-slider');
    controller.domElement.insertBefore(box.domElement, controller.domElement.firstElementChild);
  } else if (controller instanceof NumberControllerBox) {
    var r = function r(returned) {
      if (Common.isNumber(controller.__min) && Common.isNumber(controller.__max)) {
        var oldName = controller.__li.firstElementChild.firstElementChild.innerHTML;
        var wasListening = controller.__gui.__listening.indexOf(controller) > -1;
        controller.remove();
        var newController = _add(gui, controller.object, controller.property, {
          before: controller.__li.nextElementSibling,
          factoryArgs: [controller.__min, controller.__max, controller.__step]
        });
        newController.name(oldName);
        if (wasListening) newController.listen();
        return newController;
      }
      return returned;
    };
    controller.min = Common.compose(r, controller.min);
    controller.max = Common.compose(r, controller.max);
  } else if (controller instanceof BooleanController) {
    dom.bind(li, 'click', function () {
      dom.fakeEvent(controller.__checkbox, 'click');
    });
    dom.bind(controller.__checkbox, 'click', function (e) {
      e.stopPropagation();
    });
  } else if (controller instanceof FunctionController) {
    dom.bind(li, 'click', function () {
      dom.fakeEvent(controller.__button, 'click');
    });
    dom.bind(li, 'mouseover', function () {
      dom.addClass(controller.__button, 'hover');
    });
    dom.bind(li, 'mouseout', function () {
      dom.removeClass(controller.__button, 'hover');
    });
  } else if (controller instanceof ColorController) {
    dom.addClass(li, 'color');
    controller.updateDisplay = Common.compose(function (val) {
      li.style.borderLeftColor = controller.__color.toString();
      return val;
    }, controller.updateDisplay);
    controller.updateDisplay();
  }
  controller.setValue = Common.compose(function (val) {
    if (gui.getRoot().__preset_select && controller.isModified()) {
      markPresetModified(gui.getRoot(), true);
    }
    return val;
  }, controller.setValue);
}
function recallSavedValue(gui, controller) {
  var root = gui.getRoot();
  var matchedIndex = root.__rememberedObjects.indexOf(controller.object);
  if (matchedIndex !== -1) {
    var controllerMap = root.__rememberedObjectIndecesToControllers[matchedIndex];
    if (controllerMap === undefined) {
      controllerMap = {};
      root.__rememberedObjectIndecesToControllers[matchedIndex] = controllerMap;
    }
    controllerMap[controller.property] = controller;
    if (root.load && root.load.remembered) {
      var presetMap = root.load.remembered;
      var preset = void 0;
      if (presetMap[gui.preset]) {
        preset = presetMap[gui.preset];
      } else if (presetMap[DEFAULT_DEFAULT_PRESET_NAME]) {
        preset = presetMap[DEFAULT_DEFAULT_PRESET_NAME];
      } else {
        return;
      }
      if (preset[matchedIndex] && preset[matchedIndex][controller.property] !== undefined) {
        var value = preset[matchedIndex][controller.property];
        controller.initialValue = value;
        controller.setValue(value);
      }
    }
  }
}
function _add(gui, object, property, params) {
  if (object[property] === undefined) {
    throw new Error('Object "' + object + '" has no property "' + property + '"');
  }
  var controller = void 0;
  if (params.color) {
    controller = new ColorController(object, property);
  } else {
    var factoryArgs = [object, property].concat(params.factoryArgs);
    controller = ControllerFactory.apply(gui, factoryArgs);
  }
  if (params.before instanceof Controller) {
    params.before = params.before.__li;
  }
  recallSavedValue(gui, controller);
  dom.addClass(controller.domElement, 'c');
  var name = document.createElement('span');
  dom.addClass(name, 'property-name');
  name.innerHTML = controller.property;
  var container = document.createElement('div');
  container.appendChild(name);
  container.appendChild(controller.domElement);
  var li = addRow(gui, container, params.before);
  dom.addClass(li, GUI.CLASS_CONTROLLER_ROW);
  if (controller instanceof ColorController) {
    dom.addClass(li, 'color');
  } else {
    dom.addClass(li, _typeof(controller.getValue()));
  }
  augmentController(gui, li, controller);
  gui.__controllers.push(controller);
  return controller;
}
function getLocalStorageHash(gui, key) {
  return document.location.href + '.' + key;
}
function addPresetOption(gui, name, setSelected) {
  var opt = document.createElement('option');
  opt.innerHTML = name;
  opt.value = name;
  gui.__preset_select.appendChild(opt);
  if (setSelected) {
    gui.__preset_select.selectedIndex = gui.__preset_select.length - 1;
  }
}
function showHideExplain(gui, explain) {
  explain.style.display = gui.useLocalStorage ? 'block' : 'none';
}
function addSaveMenu(gui) {
  var div = gui.__save_row = document.createElement('li');
  dom.addClass(gui.domElement, 'has-save');
  gui.__ul.insertBefore(div, gui.__ul.firstChild);
  dom.addClass(div, 'save-row');
  var gears = document.createElement('span');
  gears.innerHTML = '&nbsp;';
  dom.addClass(gears, 'button gears');
  var button = document.createElement('span');
  button.innerHTML = 'Save';
  dom.addClass(button, 'button');
  dom.addClass(button, 'save');
  var button2 = document.createElement('span');
  button2.innerHTML = 'New';
  dom.addClass(button2, 'button');
  dom.addClass(button2, 'save-as');
  var button3 = document.createElement('span');
  button3.innerHTML = 'Revert';
  dom.addClass(button3, 'button');
  dom.addClass(button3, 'revert');
  var select = gui.__preset_select = document.createElement('select');
  if (gui.load && gui.load.remembered) {
    Common.each(gui.load.remembered, function (value, key) {
      addPresetOption(gui, key, key === gui.preset);
    });
  } else {
    addPresetOption(gui, DEFAULT_DEFAULT_PRESET_NAME, false);
  }
  dom.bind(select, 'change', function () {
    for (var index = 0; index < gui.__preset_select.length; index++) {
      gui.__preset_select[index].innerHTML = gui.__preset_select[index].value;
    }
    gui.preset = this.value;
  });
  div.appendChild(select);
  div.appendChild(gears);
  div.appendChild(button);
  div.appendChild(button2);
  div.appendChild(button3);
  if (SUPPORTS_LOCAL_STORAGE) {
    var explain = document.getElementById('dg-local-explain');
    var localStorageCheckBox = document.getElementById('dg-local-storage');
    var saveLocally = document.getElementById('dg-save-locally');
    saveLocally.style.display = 'block';
    if (localStorage.getItem(getLocalStorageHash(gui, 'isLocal')) === 'true') {
      localStorageCheckBox.setAttribute('checked', 'checked');
    }
    showHideExplain(gui, explain);
    dom.bind(localStorageCheckBox, 'change', function () {
      gui.useLocalStorage = !gui.useLocalStorage;
      showHideExplain(gui, explain);
    });
  }
  var newConstructorTextArea = document.getElementById('dg-new-constructor');
  dom.bind(newConstructorTextArea, 'keydown', function (e) {
    if (e.metaKey && (e.which === 67 || e.keyCode === 67)) {
      SAVE_DIALOGUE.hide();
    }
  });
  dom.bind(gears, 'click', function () {
    newConstructorTextArea.innerHTML = JSON.stringify(gui.getSaveObject(), undefined, 2);
    SAVE_DIALOGUE.show();
    newConstructorTextArea.focus();
    newConstructorTextArea.select();
  });
  dom.bind(button, 'click', function () {
    gui.save();
  });
  dom.bind(button2, 'click', function () {
    var presetName = prompt('Enter a new preset name.');
    if (presetName) {
      gui.saveAs(presetName);
    }
  });
  dom.bind(button3, 'click', function () {
    gui.revert();
  });
}
function addResizeHandle(gui) {
  var pmouseX = void 0;
  gui.__resize_handle = document.createElement('div');
  Common.extend(gui.__resize_handle.style, {
    width: '6px',
    marginLeft: '-3px',
    height: '200px',
    cursor: 'ew-resize',
    position: 'absolute'
  });
  function drag(e) {
    e.preventDefault();
    gui.width += pmouseX - e.clientX;
    gui.onResize();
    pmouseX = e.clientX;
    return false;
  }
  function dragStop() {
    dom.removeClass(gui.__closeButton, GUI.CLASS_DRAG);
    dom.unbind(window, 'mousemove', drag);
    dom.unbind(window, 'mouseup', dragStop);
  }
  function dragStart(e) {
    e.preventDefault();
    pmouseX = e.clientX;
    dom.addClass(gui.__closeButton, GUI.CLASS_DRAG);
    dom.bind(window, 'mousemove', drag);
    dom.bind(window, 'mouseup', dragStop);
    return false;
  }
  dom.bind(gui.__resize_handle, 'mousedown', dragStart);
  dom.bind(gui.__closeButton, 'mousedown', dragStart);
  gui.domElement.insertBefore(gui.__resize_handle, gui.domElement.firstElementChild);
}
function setWidth(gui, w) {
  gui.domElement.style.width = w + 'px';
  if (gui.__save_row && gui.autoPlace) {
    gui.__save_row.style.width = w + 'px';
  }
  if (gui.__closeButton) {
    gui.__closeButton.style.width = w + 'px';
  }
}
function getCurrentPreset(gui, useInitialValues) {
  var toReturn = {};
  Common.each(gui.__rememberedObjects, function (val, index) {
    var savedValues = {};
    var controllerMap = gui.__rememberedObjectIndecesToControllers[index];
    Common.each(controllerMap, function (controller, property) {
      savedValues[property] = useInitialValues ? controller.initialValue : controller.getValue();
    });
    toReturn[index] = savedValues;
  });
  return toReturn;
}
function setPresetSelectIndex(gui) {
  for (var index = 0; index < gui.__preset_select.length; index++) {
    if (gui.__preset_select[index].value === gui.preset) {
      gui.__preset_select.selectedIndex = index;
    }
  }
}
function updateDisplays(controllerArray) {
  if (controllerArray.length !== 0) {
    requestAnimationFrame$1$1.call(window, function () {
      updateDisplays(controllerArray);
    });
  }
  Common.each(controllerArray, function (c) {
    c.updateDisplay();
  });
}
var GUI$1 = GUI;

function ready(fn) {
    if (document.readyState !== "loading") {
        fn();
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}
let renderer;
ready(() => {
    renderer = new Renderer();
    renderer.ready = () => {
        initUI();
    };
    renderer.init("canvasGL", true);
    const canvas = document.getElementById("canvasGL");
    new FreeMovement(renderer, {
        canvas,
        movementSpeed: 35,
        rotationSpeed: 0.006
    });
    const fullScreenUtils = new FullScreenUtils();
    const toggleFullscreenElement = document.getElementById("toggleFullscreen");
    toggleFullscreenElement.addEventListener("click", () => {
        if (document.body.classList.contains("fs")) {
            fullScreenUtils.exitFullScreen();
        }
        else {
            fullScreenUtils.enterFullScreen();
        }
        fullScreenUtils.addFullScreenListener(function () {
            if (fullScreenUtils.isFullScreen()) {
                document.body.classList.add("fs");
            }
            else {
                document.body.classList.remove("fs");
            }
        });
    });
});
function initUI() {
    var _a, _b;
    (_a = document.getElementById("message")) === null || _a === void 0 ? void 0 : _a.classList.add("hidden");
    (_b = document.getElementById("canvasGL")) === null || _b === void 0 ? void 0 : _b.classList.remove("transparent");
    setTimeout(() => { var _a; return (_a = document.querySelector(".promo")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 4000);
    setTimeout(() => { var _a; return (_a = document.querySelector("#toggleFullscreen")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 1800);
    const gui = new GUI$1();
    const config = {
        density: 100,
        timeOfDay: "Day",
        glare: true,
        insects: true
    };
    gui.add(config, "density", 0, 100)
        .name("Grass Density")
        .onChange(() => renderer.density = config.density / 100);
    gui.add(config, "timeOfDay", ["Day", "Night", "Sunrise", "Sunset"])
        .name("Time Of Day")
        .onChange(() => renderer.timeOfDay = config.timeOfDay);
    gui.add(config, "glare", true)
        .name("Sun Glare")
        .onChange(() => renderer.glare = config.glare);
    gui.add(config, "insects", true)
        .name("Ants & Butterflies")
        .onChange(() => renderer.insects = config.insects);
    gui.add({ iterateCamera: () => renderer.iterateCamera() }, "iterateCamera")
        .name("Next Camera");
    const stats = gui.addFolder("Stats");
    stats.add(renderer, "tiles", "")
        .name("Tiles visible")
        .listen();
    stats.add(renderer, "grassInstances", "")
        .name("Instances visible")
        .listen();
}
//# sourceMappingURL=index.js.map
