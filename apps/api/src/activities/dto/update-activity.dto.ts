import { IsOptional } from "class-validator";
import {
  OptionalDateField,
  OptionalDescriptionField,
  OptionalProjectField,
  OptionalReferenceUrlsField,
  OptionalTagsField,
  OptionalTitleField,
} from "./activity-field-validators";

export class UpdateActivityDto {
  @IsOptional()
  @OptionalDateField()
  date?: string;

  @IsOptional()
  @OptionalTitleField()
  title?: string;

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
