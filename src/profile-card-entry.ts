import { profile } from './profile';
import { escapeHtml as e } from './html';

/** A personal identity card unfolds into the creator page. */
export class ProfileCardEntry {
  private card = document.createElement('div');
  private frame = 0;
  private animation: Animation;
  private started = performance.now();
  constructor(private root: HTMLElement, private complete: () => void) {
    this.card.className = 'profile-entry-card';
    this.card.setAttribute('aria-hidden','true');
    this.card.innerHTML = `<div class="identity-card-head"><span>CREATOR / PERSONAL RECORD</span><span>01</span></div><div class="identity-card-face"><span class="identity-card-monogram">SC</span><div><small>HELLO, I'M</small><strong>${e(profile.name)}</strong><span>${e(profile.roleEn)}</span></div></div><div class="identity-card-foot"><span>SC—001</span><span>BEHIND THE WORKS ↗</span></div>`;
    root.append(this.card); root.classList.add('entering');
    const origin=document.querySelector('[data-action="about"]')?.getBoundingClientRect();
    const x=origin?origin.left+origin.width/2-innerWidth/2:innerWidth/2;
    const y=origin?origin.top+origin.height/2-innerHeight/2:-innerHeight/3;
    this.animation=this.card.animate([
      {transform:`translate(${x}px,${y}px) scale(.18) rotate(8deg)`,opacity:0,offset:0,easing:'cubic-bezier(.22,1,.36,1)'},
      {transform:'translate(0,0) scale(1) rotate(-4deg)',opacity:1,offset:.35},
      {transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:.72},
      {transform:'translate(0,-4vh) scale(1.6) rotate(0deg)',opacity:0,offset:1},
    ],{duration:1200,easing:'linear',fill:'both'});
    this.tick();
  }
  private tick=()=>{
    const p=Math.min(1,Math.max(0,((performance.now()-this.started)-650)/550));
    const reveal=p*p*(3-2*p);
    this.root.style.setProperty('--profile-reveal',String(reveal));
    this.root.style.setProperty('--profile-heading',String(reveal));
    if(performance.now()-this.started>=1250){this.dispose();this.complete();}
    else this.frame=requestAnimationFrame(this.tick);
  };
  dispose(){cancelAnimationFrame(this.frame);this.animation.cancel();this.card.remove();this.root.classList.remove('entering');this.root.style.removeProperty('--profile-reveal');this.root.style.removeProperty('--profile-heading');}
}
