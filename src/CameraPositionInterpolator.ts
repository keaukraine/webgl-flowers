import { mat4, vec3 } from "gl-matrix";


export interface CameraPosition {
    position: Float32Array;
    rotation: Float32Array;
}

export interface CameraPositionPair {
    start: CameraPosition;
    end: CameraPosition;
}

export class CameraPositionInterpolator {
    private _position: CameraPositionPair | undefined;
    private _speed = 0;
    private duration = 0;
    private _minDuration = 3000;
    private _timer = 0;
    private lastTime = 0;
    private _reverse = false;

    private _cameraPosition = vec3.create();
    private _cameraRotation = vec3.create();

    private _matrix: mat4 = mat4.create();

    public get cameraPosition() {
        return this._cameraPosition;
    }

    public get cameraRotation() {
        return this._cameraRotation;
    }

    public set reverse(value: boolean) {
        this._reverse = value;
    }

    public set minDuration(value: number) {
        this._minDuration = value;
    }

    public get matrix(): mat4 {
        return this._matrix;
    }

    public get speed(): number {
        return this._speed;
    }

    public set speed(value: number) {
        this._speed = value;
    }

    public get position(): CameraPositionPair | undefined {
        return this._position;
    }

    public set position(value: CameraPositionPair | undefined) {
        this._position = value;
        this.duration = Math.max(this.getLength() / this.speed, this._minDuration);
    }

    public get timer(): number {
        return this._timer;
    }

    private getLength(): number {
        if (this.position === undefined) {
            return 0;
        }

        const start = this.position.start.position;
        const end = this.position.end.position;

        return Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2 + (end[2] - start[2]) ** 2);
    }

    public iterate(timeNow: number): void {
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

    public reset() {
        this._timer = 0;
        this.updateMatrix();
    }

    private updateMatrix(): void {
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

        mat4.identity(this.matrix);
        mat4.rotateX(this.matrix, this.matrix, this._cameraRotation[0] - Math.PI / 2.0);
        mat4.rotateZ(this.matrix, this.matrix, this._cameraRotation[1]);
        mat4.rotateY(this.matrix, this.matrix, this._cameraRotation[2]);
        mat4.translate(this.matrix, this.matrix, [-this._cameraPosition[0], -this._cameraPosition[1], - this._cameraPosition[2]]);
    }
}
