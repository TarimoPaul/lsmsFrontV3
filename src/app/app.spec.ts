import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('creates the root with a router outlet and toast host', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('router-outlet')).toBeTruthy();
    expect(el.querySelector('lsms-toast-host')).toBeTruthy();
  });

  it('applies the theme attribute to <html>', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toMatch(/light|dark/);
  });
});
