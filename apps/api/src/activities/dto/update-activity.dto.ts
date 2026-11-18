import { IsArray, IsOptional, IsUUID, ValidateIf } from "class-validator";
import {
  OptionalDateField,
  OptionalDescriptionField,
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

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsUUID("4", { each: true })
  projectIds?: string[];
}
