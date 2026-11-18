import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { Activity, ActivityFilters, ActivityInput } from '../models';
import { ActivitiesRepository } from '../repositories/activities.repository';

export interface UrlNormalization {
  urls: string[];
  invalid: string[];
}

export interface ActivityFormValue {
  date?: string;
  title: string;
  description?: string | null;
  referenceUrls?: string | string[];
  tags?: string | string[];
  projectIds?: string[];
}

export interface ActivityDayGroup {
  date: string;
  items: Activity[];
}

@Injectable({ providedIn: 'root' })
export class ActivitiesService {
  private repository = inject(ActivitiesRepository);
  private metaRequest?: Observable<{ projects: string[]; tags: string[] }>;
  normalizeTags(raw: string | string[] | null | undefined): string[] {
    const values = Array.isArray(raw) ? raw : (raw ?? '').split(/[\n,]+/);
    const normalized = values
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0 && value.length <= 50);
    return [...new Set(normalized)].slice(0, 20);
  }
  normalizeUrls(raw: string | string[] | null | undefined): UrlNormalization {
    const values = Array.isArray(raw) ? raw : (raw ?? '').split(/[\n,]+/);
    const urls: string[] = [];
    const invalid: string[] = [];
    for (const source of values) {
      const value = source.trim();
      if (!value) continue;
      let valid = false;
      try {
        valid = ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        valid = false;
      }
      if (!valid || urls.length >= 20) {
        invalid.push(value);
      } else if (!urls.includes(value)) {
        urls.push(value);
      }
    }
    return { urls, invalid };
  }
  buildFilters(raw: ActivityFilters): ActivityFilters {
    const filters: ActivityFilters = {};
    for (const key of ['from', 'to', 'tag', 'q'] as const) {
      const value = raw[key]?.trim();
      if (value) filters[key] = value;
    }
    if (raw.projectIds?.length) filters.projectIds = [...new Set(raw.projectIds)];
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new RangeError('Activity filter start date must not be after its end date.');
    }
    if (raw.page !== undefined && Number.isFinite(Number(raw.page)) && Number(raw.page) > 0) {
      filters.page = Math.floor(Number(raw.page));
    }
    if (raw.limit !== undefined && Number.isFinite(Number(raw.limit)) && Number(raw.limit) > 0) {
      filters.limit = Math.min(200, Math.floor(Number(raw.limit)));
    }
    return filters;
  }
  toInput(value: ActivityFormValue): ActivityInput {
    const normalizedUrls = this.normalizeUrls(value.referenceUrls);
    return {
      date: value.date?.trim() || this.todayLocal(),
      title: value.title.trim(),
      description: value.description?.trim() || null,
      projectIds: value.projectIds ?? [],
      tags: this.normalizeTags(value.tags),
      referenceUrls: normalizedUrls.urls,
    };
  }
  todayLocal(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  groupByDay(items: Activity[]): ActivityDayGroup[] {
    const groups = new Map<string, Activity[]>();
    for (const item of items) {
      const dayItems = groups.get(item.date) ?? [];
      groups.set(item.date, [...dayItems, item]);
    }
    return [...groups].map(([date, groupedItems]) => ({ date, items: groupedItems }));
  }
  list(filters: ActivityFilters = {}) {
    return this.repository.list(this.buildFilters(filters));
  }
  meta(): Observable<{ projects: string[]; tags: string[] }> {
    this.metaRequest ??= this.repository
      .meta()
      .pipe(tap({ error: () => (this.metaRequest = undefined) }), shareReplay(1));
    return this.metaRequest;
  }
  get(id: string) {
    return this.repository.get(id);
  }
  create(formValue: ActivityFormValue) {
    return this.repository
      .create(this.toInput(formValue))
      .pipe(tap(() => (this.metaRequest = undefined)));
  }
  update(id: string, formValue: Partial<ActivityFormValue>) {
    const input: Partial<ActivityInput> = {};
    if (formValue.date !== undefined) input.date = formValue.date.trim();
    if (formValue.title !== undefined) input.title = formValue.title.trim();
    if (formValue.description !== undefined)
      input.description = formValue.description?.trim() || null;
    if (formValue.projectIds !== undefined) input.projectIds = formValue.projectIds;
    if (formValue.tags !== undefined) input.tags = this.normalizeTags(formValue.tags);
    if (formValue.referenceUrls !== undefined)
      input.referenceUrls = this.normalizeUrls(formValue.referenceUrls).urls;
    return this.repository.update(id, input).pipe(tap(() => (this.metaRequest = undefined)));
  }
  remove(id: string) {
    return this.repository.delete(id).pipe(tap(() => (this.metaRequest = undefined)));
  }
}
