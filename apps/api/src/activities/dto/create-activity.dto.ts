import { IsOptional } from "class-validator";
import {
  OptionalDescriptionField,
  OptionalProjectField,
  OptionalReferenceUrlsField,
  OptionalTagsField,
  RequiredDateField,
  RequiredTitleField,
} from "./activity-field-validators";

export class CreateActivityDto {
  @RequiredDateField()
  date!: string;

  @RequiredTitleField()
  title!: string;

  @IsOptional()
  @OptionalDescriptionField()
  description?: string | null;

  @IsOptional()
  @OptionalReferenceUrlsField()
  referenceUrls?: string[];

  @IsOptional()
  @OptionalTagsField()
  tags?: string[];

  @IsOptional()
  @OptionalProjectField()
  project?: string | null;
}
