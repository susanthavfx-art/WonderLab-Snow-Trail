// Advance the course only after a stable pose and a complete countdown.
export function createRideGate(motion) {
  let since = null, started = false;
  return (locked, now, recent = locked) => {
    if (!motion) return {ride:true, message:'', status:''};
    if (!(started ? recent : locked)) {
      since = null;
      return {ride:false, message:started?'Tracking paused':'Find your stance', status:'Show both shoulders and hips'};
    }
    if (started) return {ride:true, message:'', status:'Motion tracking active'};
    since ??= now;
    const elapsed = now - since;
    if (elapsed < 450) return {ride:false, message:'Hold steady', status:'Body detected'};
    if (elapsed < 3450) return {ride:false, message:String(Math.ceil((3450-elapsed)/1000)), status:'Body locked · Get ready'};
    started = true;
    return {ride:true, message:'', status:'Motion tracking active'};
  };
}
