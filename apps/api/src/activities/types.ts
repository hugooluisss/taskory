export interface CreateActivityInput {
  date: string;
  title: string;
  description?: string | null;
  referenceUrls?: string[];
  tags?: string[];
  project?: string | null;
}

export type UpdateActivityInput = Partial<CreateActivityInput> & {
  updatedAt?: Date;
};

export interface ActivityFilters {
  from?: string;
  to?: string;
  project?: string;
  tag?: string;
  q?: string;
  page: number;
  limit: number;
}
