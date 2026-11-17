import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { Activity } from '../models';
import { ActivitiesRepository } from '../repositories/activities.repository';
import { ActivitiesService } from './activities.service';

describe('Activity management', () => {
  const repository = {
    list: vi.fn(() => of({ items: [], total: 0, page: 1, limit: 20 })),
    meta: vi.fn(() => of({ projects: ['Taskory'], tags: ['work'] })),
    get: vi.fn(() => of({ id: '1' } as Activity)),
    create: vi.fn(() => of({ id: '1' } as Activity)),
    update: vi.fn(() => of({ id: '1' } as Activity)),
    delete: vi.fn(() => of(undefined)),
  };
  let service: ActivitiesService;
  beforeEach(() => {
    repository.create.mockClear();
    repository.list.mockClear();
    repository.meta.mockClear();
    repository.get.mockClear();
    repository.update.mockClear();
    repository.delete.mockClear();
    TestBed.configureTestingModule({
      providers: [ActivitiesService, { provide: ActivitiesRepository, useValue: repository }],
    });
    service = TestBed.inject(ActivitiesService);
  });
  it('normalizes tags, removes duplicates and enforces limits', () => {
    const longTag = 'x'.repeat(51);
    expect(service.normalizeTags(' Foo, foo, , BAR ')).toEqual(['foo', 'bar']);
    expect(service.normalizeTags(['ok', longTag])).toEqual(['ok']);
    expect(
      service.normalizeTags(Array.from({ length: 22 }, (_, index) => `t${index}`)),
    ).toHaveLength(20);
  });
  it('keeps only unique http and https URLs and returns invalid values', () => {
    expect(
      service.normalizeUrls(' https://a.test,https://a.test,javascript:evil,ftp://b.test'),
    ).toEqual({
      urls: ['https://a.test'],
      invalid: ['javascript:evil', 'ftp://b.test'],
    });
  });
  it('trims filters, omits empty filters and validates dates and pagination', () => {
    expect(
      service.buildFilters({
        from: ' 2026-01-01 ',
        project: '  ',
        q: ' task ',
        page: 2.8,
        limit: 999,
      }),
    ).toEqual({ from: '2026-01-01', q: 'task', page: 2, limit: 200 });
    expect(() => service.buildFilters({ from: '2026-02-02', to: '2026-02-01' })).toThrow(
      RangeError,
    );
  });
  it('builds API input using local today and nulls empty optional fields', () => {
    vi.spyOn(service, 'todayLocal').mockReturnValue('2026-11-17');
    expect(
      service.toInput({
        title: ' Task ',
        description: ' ',
        project: '',
        tags: 'One,ONE',
        referenceUrls: 'https://a.test',
      }),
    ).toEqual({
      date: '2026-11-17',
      title: 'Task',
      description: null,
      project: null,
      tags: ['one'],
      referenceUrls: ['https://a.test'],
    });
  });
  it('uses local calendar fields for today', () => {
    expect(service.todayLocal(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
  it('groups activities by their calendar day', () => {
    const items = [
      { date: '2026-01-01' },
      { date: '2026-01-02' },
      { date: '2026-01-01' },
    ] as Activity[];
    expect(service.groupByDay(items)).toEqual([
      { date: '2026-01-01', items: [items[0], items[2]] },
      { date: '2026-01-02', items: [items[1]] },
    ]);
  });
  it('creates an activity from normalized form values', () => {
    service.create({ title: ' T ', tags: 'X, x' }).subscribe();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', tags: ['x'] }),
    );
  });
  it('lists with validated non-empty filters and returns pagination', () => {
    service.list({ from: ' 2026-01-01 ', project: ' ', page: 2, limit: 20 }).subscribe();
    expect(repository.list).toHaveBeenCalledWith({ from: '2026-01-01', page: 2, limit: 20 });
    expect(() => service.list({ from: '2026-02-02', to: '2026-02-01' })).toThrow(RangeError);
  });
  it('loads metadata once and refreshes it after mutations', () => {
    service.meta().subscribe();
    service.meta().subscribe();
    expect(repository.meta).toHaveBeenCalledTimes(1);
    service.create({ title: 'new' }).subscribe();
    service.meta().subscribe();
    expect(repository.meta).toHaveBeenCalledTimes(2);
    service.update('1', { project: 'Other' }).subscribe();
    service.meta().subscribe();
    expect(repository.meta).toHaveBeenCalledTimes(3);
    service.remove('1').subscribe();
    service.meta().subscribe();
    expect(repository.meta).toHaveBeenCalledTimes(4);
  });
  it('gets an activity by id', () => {
    service.get('1').subscribe();
    expect(repository.get).toHaveBeenCalledWith('1');
  });
  it('updates only supplied activity fields after normalizing them', () => {
    service
      .update('1', { title: ' Task ', tags: 'A,a', referenceUrls: 'https://a.test' })
      .subscribe();
    expect(repository.update).toHaveBeenCalledWith('1', {
      title: 'Task',
      tags: ['a'],
      referenceUrls: ['https://a.test'],
    });
  });
  it('removes an activity by id', () => {
    service.remove('1').subscribe();
    expect(repository.delete).toHaveBeenCalledWith('1');
  });
  it('propagates repository errors from every service method', () => {
    const failure = new Error('repository failed');
    const methods: Array<() => Observable<unknown>> = [
      () => service.list(),
      () => service.meta(),
      () => service.get('1'),
      () => service.create({ title: 'x' }),
      () => service.update('1', { title: 'x' }),
      () => service.remove('1'),
    ];
    const repositoryMethods = [
      repository.list,
      repository.meta,
      repository.get,
      repository.create,
      repository.update,
      repository.delete,
    ];
    for (let index = 0; index < methods.length; index++) {
      repositoryMethods[index].mockImplementationOnce(() => throwError(() => failure) as never);
      let caught: unknown;
      methods[index]().subscribe({ error: (error: unknown) => (caught = error) });
      expect(caught).toBe(failure);
    }
  });
});
