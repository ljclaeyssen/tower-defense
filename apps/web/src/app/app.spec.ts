import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslateLoader,
  provideTranslateService,
  TranslateNoOpLoader,
} from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideTranslateService({
          loader: provideTranslateLoader(TranslateNoOpLoader),
        }),
      ],
    }).compileComponents();
  });

  it('should create the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
