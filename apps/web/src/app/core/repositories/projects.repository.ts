import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { ConfigService } from '../config.service';
import { Project } from '../models';

@Injectable({ providedIn: 'root' })
export class ProjectsRepository {
  private http = inject(HttpClient);
  private config = inject(ConfigService);
  list() {
    return this.http.get<Project[]>(`${this.config.apiBaseUrl}/projects`);
  }
  create(name: string, description?: string) {
    return this.http.post<Project>(`${this.config.apiBaseUrl}/projects`, {
      name,
      ...(description === undefined ? {} : { description }),
    });
  }
  update(id: string, body: { name?: string; description?: string | null; archived?: boolean }) {
    return this.http.patch<Project>(`${this.config.apiBaseUrl}/projects/${id}`, body);
  }
  delete(id: string) {
    return this.http.delete<void>(`${this.config.apiBaseUrl}/projects/${id}`);
  }
}
