import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { APP_ICON_PATHS } from './app-icon.paths';
import { AppIconComponent } from './app-icon';

describe('AppIconComponent', () => {
  it('renders an accessible SVG for every supported icon name', async () => {
    await TestBed.configureTestingModule({ imports: [AppIconComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AppIconComponent);
    for (const name of Object.keys(APP_ICON_PATHS)) {
      fixture.componentInstance.name = name as keyof typeof APP_ICON_PATHS;
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
    }
    fixture.destroy();
  });
});
