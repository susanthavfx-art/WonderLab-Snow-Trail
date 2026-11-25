import {defineConfig} from 'vite';
import {execSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {join} from 'node:path';

// Short commit id + timestamp, surfaced in the UI so we can tell at a glance
// which deploy a browser is actually running.
function buildId(){
  let commit='local';
  try { commit=execSync('git rev-parse --short HEAD',{stdio:['ignore','pipe','ignore']}).toString().trim(); } catch {}
  const stamp=new Date().toISOString().slice(0,16).replace('T',' ');
  return `${commit} · ${stamp}`;
}

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
      // The pose graph runs with modelComplexity 0, so only the lite landmark
      // model is ever fetched; the full/heavy weights are unused dead weight.
      rmSync(join(dir,'assets/pose_landmark_heavy.tflite'),{force:true});
      rmSync(join(dir,'assets/pose_landmark_full.tflite'),{force:true});
    },
  };
}

export default defineConfig({
  base:'./',
  define:{__BUILD_ID__:JSON.stringify(buildId())},
  server:{host:'0.0.0.0',allowedHosts:true},
  assetsInclude:['**/*.wasm','**/*.binarypb','**/*.tflite','**/*.data'],
  plugins:[mediapipeAssets()],
  build:{
    // Everything here is on the critical path of a phone opening the page, so the
    // pose-tracking chunk (camera.js + mediapipe glue) is split out and only
    // fetched when the player actually enables the webcam.
    chunkSizeWarningLimit:900,
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
