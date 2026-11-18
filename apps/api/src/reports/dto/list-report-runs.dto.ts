import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";

export class ListReportRunsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit = 50;
}
