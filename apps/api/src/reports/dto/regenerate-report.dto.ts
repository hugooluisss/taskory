import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

export class RegenerateReportDto {
  @IsIn(["summary", "detailed", "custom"])
  style!: "summary" | "detailed" | "custom";

  @ValidateIf((value: RegenerateReportDto) => value.style === "custom")
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  customPrompt?: string;

  @IsOptional()
  @IsIn(["es", "en"])
  language?: "es" | "en";
}
