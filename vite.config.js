import {defineConfig} from 'vite';
import {rmSync} from 'node:fs';
import {join} from 'node:path';

// MediaPipe loads its wasm/model files by bare filename at runtime
// (locateFile(name), plus a hardcoded "pose_solution_*_wasm_bin.wasm" inside the
// glue script), so those files must keep their original names — hashing them
// turned every lookup into a 404 on Pages and left initialize() waiting forever.
function mediapipeAssets(){
  return {
    name:'mediapipe-unhashed-assets',
    apply:'build',
    writeBundle(options){
      const dir=options.dir||'dist';
      // The pose model is built with modelComplexity 0, which only ever loads the
      // lite landmark model; the 27MB full/heavy weight would ship unused.
      rmSync(join(dir,'assets/pose_landmark_heavy.tflite'),{force:true});
      rmSync(join(dir,'assets/pose_landmark_full.tflite'),{force:true});
    },
  };
}

export default defineConfig({
  base:'./',
  server:{host:'0.0.0.0',allowedHosts:true},
  assetsInclude:['**/*.wasm','**/*.binarypb','**/*.tflite','**/*.data'],
  plugins:[mediapipeAssets()],
  build:{
    rollupOptions:{
      output:{
        assetFileNames(assetInfo){
          const name=assetInfo.names?.[0]||assetInfo.name||'';
          if(/^pose_/.test(name)) return 'assets/[name].[ext]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
