import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// iPhone / iPad Safari zooms the page when a focused field has text under 16px and
// never zooms back. Making every field 16px made forms look oversized next to
// 13–14px content, so the zoom is stopped at the viewport instead. Apple devices
// only: there `maximum-scale=1` blocks the focus zoom but still allows pinch-zoom;
// on Android it would switch pinch-zoom off.
const apple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (apple) {
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute('content', viewport.getAttribute('content') + ', maximum-scale=1');
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
