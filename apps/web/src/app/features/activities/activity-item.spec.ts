import { TestBed } from '@angular/core/testing';
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivityItemComponent } from './activity-item';
import { TestTranslocoPipe } from './test-transloco.pipe';

describe('Activity management', () => {
  it('shows all reference URLs in order with safe new-tab links', async () => {
    await TestBed.configureTestingModule({ imports: [ActivityItemComponent] })
      .overrideComponent(ActivityItemComponent, {
        remove: { imports: [TranslocoPipe] },
        add: { imports: [TestTranslocoPipe] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(ActivityItemComponent);
    fixture.componentInstance.activity = {
      id: '1',
      date: '2026-11-17',
      title: 'Work',
      description: null,
      projects: [],
      tags: [],
      referenceUrls: ['https://a.test', 'https://b.test', 'https://c.test'],
      createdAt: '',
      updatedAt: '',
    };
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(links.map((link) => link.href)).toEqual([
      'https://a.test/',
      'https://b.test/',
      'https://c.test/',
    ]);
    expect(
      links.every((link) => link.target === '_blank' && link.rel === 'noopener noreferrer'),
    ).toBe(true);
  });
});
