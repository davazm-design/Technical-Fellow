// responsive.spec.ts — NÚCLEO del agente /responsive. Renderiza y MIDE a varios viewports.
// No opina sobre CSS: assert-a pixeles reales. Requiere @playwright/test + chromium.
//
// Uso:  RESPONSIVE_BASE_URL=http://localhost:4173 npx playwright test responsive.spec.ts
// Ajusta VIEWPORTS / ROUTES desde kit.config.yaml responsive.* en tu proyecto.

import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const ROUTES = ['/'];
const MIN_TAP = 44; // px — WCAG 2.5.5 / Apple HIG
const BASE_URL = process.env.RESPONSIVE_BASE_URL ?? 'http://localhost:4173';

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`${vp.name} ${route} — sin overflow horizontal`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL + route, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `scroll horizontal de ${overflow}px en ${vp.name} (${vp.width}px)`).toBeLessThanOrEqual(1);
    });

    test(`${vp.name} ${route} — touch targets >= ${MIN_TAP}px`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL + route, { waitUntil: 'networkidle' });
      const small = await page.evaluate((min) => {
        const sel = 'button, a, input, select, textarea, [role="button"]';
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue; // oculto
          if (r.width < min || r.height < min) {
            bad.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        return bad;
      }, MIN_TAP);
      expect(small, `targets < ${MIN_TAP}px: ${small.join(', ')}`).toHaveLength(0);
    });
  }
}
