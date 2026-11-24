// The trackside coach bubble: a friendly rider portrait plus short status
// lines, mirroring the avatar callouts in the badminton-style HUD.
export function createCoach(host, face) {
  const el = document.createElement('div');
  el.className = 'coach';
  el.innerHTML = `<div class="coach-face"><img src="${face}" alt="Rider"></div>
    <div class="coach-copy"><strong class="coach-title">Ride ready</strong><span class="coach-line">Pass between the flags</span></div>`;
  host.append(el);
  const title = el.querySelector('.coach-title'), line = el.querySelector('.coach-line');
  let hold = 0;
  return {
    el,
    set(nextTitle, nextLine, ms = 0) {
      if (nextTitle && title.textContent !== nextTitle) title.textContent = nextTitle;
      if (nextLine && line.textContent !== nextLine) line.textContent = nextLine;
      hold = ms ? performance.now() + ms : 0;
    },
    tick(now) {
      if (hold && now > hold) {
        hold = 0;
        title.textContent = 'Riding';
        line.textContent = 'Pass between the flags';
        el.classList.remove('cheer');
      }
    },
    cheer(text) {
      line.textContent = text;
      el.classList.add('cheer');
      hold = performance.now() + 1400;
    },
  };
}
