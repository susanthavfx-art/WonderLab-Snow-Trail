# WonderLab Motion Snow Rider

A browser-based 3D endless snowboard game built with Three.js and MediaPipe Pose.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Use localhost or HTTPS for webcam access. WebGL 2 is required for gameplay. To create a production build, run `npm run build` and serve `dist/` over HTTPS.

## GitHub Pages

The Pages workflow builds the game and publishes only `dist/` on pushes to `main`. Keep the Pages deployment source set to **GitHub Actions**. The built files use relative asset URLs so they also work under the repository subpath.

Each push starts a fresh run, so a deploy never mixes artifacts from earlier attempts. Re-running an old run can leave several `github-pages` artifacts behind, which makes `deploy-pages` fail with *Multiple artifacts named "github-pages"*. The workflow clears those leftovers before uploading, but the simplest recovery is to trigger a new run from **Actions → Deploy static content to Pages → Run workflow** (or push any commit to `main`) instead of re-running the failed one, and to delete the extra artifacts from the failed run's page if re-running is unavoidable.

## Controls

- Choose **Start Game → Enable Webcam & Ride**, allow camera access, and step back until your shoulders and hips are visible. Use the mirrored skeleton preview to check your pose. Hold steady for the 3–2–1 countdown, then lean left or right to steer. If tracking is lost, the run waits until you're visible again.
- Choose **Play without webcam** to steer with the arrow keys, A/D, or the on-screen buttons.
- Avoid trees, rocks and rolling snowballs. Each gold star adds 100 points, and each automatic ramp jump adds 150, on top of one point per meter. A collision ends your run and your best completed score is saved in your browser.
- Use **Esc** or the exit button to leave a run. Webcam frames are processed in the browser and are not uploaded. The camera is released when the run ends.

## Trail art

Gameplay loads the rider, rock variants, and low-poly pine obstacles from `Models/`. Models load as each run starts, with procedural stand-ins until they are ready. The roadside forest and boulders use instanced low-poly pines and rocks with puffy snow caps, matching the illustrated backdrop, and closing off the horizon instead of a haze band. Hot air balloons drift and gondola cabins creep along a cable overhead. The sunny mountain backdrop is `public/snow-village-wide.jpg` (the menu hero still uses `public/alpine.jpg`); the race surface, snowboard, stars and ramps are rendered in Three.js.
