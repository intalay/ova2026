import volleyball from '@/assets/coach-volleyball-sticker.png';
export function CoachHomeIntro() {
  return <div className="coach-intro"><p className="coach-narrative"><span>Your game.</span><img src={volleyball} alt="" width={512} height={512} className="coach-inline-sticker"/><br/>Your community.</p><img src={volleyball} alt="" width={512} height={512} className="coach-floating-sticker"/></div>;
}