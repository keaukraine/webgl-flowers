import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

const name = 'index';

export default {
  input: `src/${name}.ts`,
  output: [
    // { file: "dist/js/umd/index.js", name, format: 'umd', sourcemap: true },
    { file: "dist/js/es/index.js", format: 'es', sourcemap: true },
    { file: "dist/js/es/index.min.js", format: 'es', sourcemap: true, plugins: [terser()] },
  ],
  // Indicate here external modules you don't wanna include in your bundle (i.e.: 'lodash')
  external: [],
  watch: {
    include: 'src/**',
  },
  plugins: [
    // Allow json resolution
    json(),
    // Compile TypeScript files
    typescript({ clean: true }),
    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs(),
    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve()
  ]
}
