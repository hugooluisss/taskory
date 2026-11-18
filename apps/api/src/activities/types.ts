export interface CreateActivityInput {
  date: string;
  title: string;
  description?: string | null;
  referenceUrls?: string[];
  tags?: string[];
  projectIds?: string[];
}

export type UpdateActivityInput = Partial<CreateActivityInput> & {
  updatedAt?: Date;
};

export interface ActivityFilters {
  from?: string;
  to?: string;
  projectIds?: string[];
  tag?: string;
  q?: string;
  page: number;
  limit: number;
}

export interface ReportActivityFilters {
  from: string;
  to: string;
  projectIds?: string[];
  tags?: string[];
}
