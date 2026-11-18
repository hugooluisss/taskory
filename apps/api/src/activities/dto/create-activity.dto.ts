import { IsArray, IsOptional, IsUUID, ValidateIf } from "class-validator";
import {
  OptionalDescriptionField,
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

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsUUID("4", { each: true })
  projectIds?: string[];
}
