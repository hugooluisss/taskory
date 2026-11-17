import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { Subject } from 'rxjs';
import { Activity } from '../../core/models';
import { ActivitiesService } from '../../core/services/activities.service';
import { ConfirmService } from '../../shared/confirm.service';
import { ToastService } from '../../shared/toast.service';
import { ActivitiesPage } from './activities-page';

const activity: Activity = {
  id: 'a1',
  date: '2026-11-17',
  title: 'Write docs',
  description: null,
  referenceUrls: [],
  tags: [],
  project: null,
  createdAt: '',
  updatedAt: '',
};

describe('Activity management', () => {
  let repositoryService: {
    list: ReturnType<typeof vi.fn>;
    meta: ReturnType<typeof vi.fn>;
    groupByDay: ReturnType<typeof vi.fn>;
    buildFilters: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let ask: ReturnType<typeof vi.fn>;
  let page: ActivitiesPage;
  let quickAdd: { pending: WritableSignal<boolean>; clearIfUnchanged: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    repositoryService = {
      list: vi.fn(() => of({ items: [activity], total: 1, page: 1, limit: 20 })),
      meta: vi.fn(() => of({ projects: ['Taskory'], tags: [] })),
      groupByDay: vi.fn((items) =>
        items.map((item: Activity) => ({ date: item.date, items: [item] })),
      ),
      buildFilters: vi.fn((filters) => {
        if (filters.from && filters.to && filters.from > filters.to) throw new RangeError();
        return Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== '' && value != null),
        );
      }),
      create: vi.fn(() => of(activity)),
      update: vi.fn(() => of(activity)),
      remove: vi.fn(() => of(undefined)),
    };
    ask = vi.fn(() => Promise.resolve(false));
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivitiesService, useValue: repositoryService },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslocoService, useValue: { translate: (key: string) => key } },
      ],
    });
    page = TestBed.runInInjectionContext(() => new ActivitiesPage());
    quickAdd = { pending: signal(false), clearIfUnchanged: vi.fn() };
    (page as unknown as { quickAdd: typeof quickAdd }).quickAdd = quickAdd;
  });
  it('Create with several URLs', () => {
    const urls = ['https://a.test', 'https://b.test', 'https://c.test'];
    page.create({ title: 'Work', referenceUrls: urls });
    expect(repositoryService.create).toHaveBeenCalledWith(
      expect.objectContaining({ referenceUrls: urls }),
    );
    expect(repositoryService.list).toHaveBeenCalledTimes(2);
  });
  it('does not clear edits made while create is pending', () => {
    const response = new Subject<Activity>();
    repositoryService.create.mockReturnValue(response);
    const submitted = {
      title: 'Work',
      referenceUrls: ['https://a.test', 'https://b.test', 'https://c.test'],
    };
    page.create(submitted);
    expect(quickAdd.pending()).toBe(true);
    response.next(activity);
    expect(quickAdd.clearIfUnchanged).toHaveBeenCalledWith(expect.objectContaining(submitted));
    expect(quickAdd.pending()).toBe(false);
  });
  it('keeps only the latest activity list response', () => {
    const initial = new Subject<{
      items: Activity[];
      total: number;
      page: number;
      limit: number;
    }>();
    const newer = new Subject<{ items: Activity[]; total: number; page: number; limit: number }>();
    repositoryService.list.mockReturnValueOnce(initial).mockReturnValueOnce(newer);
    page.load();
    page.applyFilters({ q: 'latest' });
    newer.next({ items: [activity], total: 1, page: 1, limit: 20 });
    initial.next({ items: [], total: 0, page: 1, limit: 20 });
    expect(page.items()).toEqual([activity]);
    expect(page.loading()).toBe(false);
  });
  it('Delete confirmation', async () => {
    await page.remove(activity);
    expect(ask).toHaveBeenCalled();
    expect(repositoryService.remove).not.toHaveBeenCalled();
    ask.mockResolvedValue(true);
    await page.remove(activity);
    expect(repositoryService.remove).toHaveBeenCalledWith('a1');
  });
  it('Filters omit empty values and block inverted ranges', () => {
    page.applyFilters({ from: '2026-11-01', to: '', project: '', tag: '', q: '' });
    expect(repositoryService.list).toHaveBeenLastCalledWith({
      from: '2026-11-01',
      page: 1,
      limit: 20,
    });
    const calls = repositoryService.list.mock.calls.length;
    page.applyFilters({ from: '2026-11-20', to: '2026-11-01' });
    expect(repositoryService.list).toHaveBeenCalledTimes(calls);
    expect(page.error()).toBe('activities.invalidRange');
  });
  it('Pagination keeps filters and scrolls to the top', () => {
    page.applyFilters({ q: 'docs', project: 'Taskory' });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    page.changePage(2);
    expect(repositoryService.list).toHaveBeenLastCalledWith({
      q: 'docs',
      project: 'Taskory',
      page: 2,
      limit: 20,
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
