import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { Activity, ActivityFilters, ActivityInput, Paginated } from '../models';

@Injectable({ providedIn: 'root' })
export class ActivitiesRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  list(filters: ActivityFilters = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === '') continue;
      params = params.set(key, value);
    }
    return this.http.get<Paginated<Activity>>(`${this.config.apiBaseUrl}/activities`, { params });
  }
  get(id: string) {
    return this.http.get<Activity>(`${this.config.apiBaseUrl}/activities/${id}`);
  }
  create(body: ActivityInput) {
    return this.http.post<Activity>(`${this.config.apiBaseUrl}/activities`, body);
  }
  update(id: string, body: Partial<ActivityInput>) {
    return this.http.patch<Activity>(`${this.config.apiBaseUrl}/activities/${id}`, body);
  }
  delete(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/activities/${id}`);
  }
  meta() {
    return this.http.get<{ projects: string[]; tags: string[] }>(
      `${this.config.apiBaseUrl}/activities/meta`,
    );
  }
}
