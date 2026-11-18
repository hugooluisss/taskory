import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { isCalendarDate } from "../../common/dates/is-calendar-date";

@ValidatorConstraint({ name: "calendarDate", async: false })
class CalendarDateValidator implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return isCalendarDate(value);
  }
}

@ValidatorConstraint({ name: "reportProject", async: false })
class ReportProjectValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== "string") return false;
    const project = value.trim();
    return project.length > 0 && project.length <= 100;
  }
}

export class CreateReportDto {
  @IsString()
  @Validate(CalendarDateValidator)
  from!: string;

  @IsString()
  @Validate(CalendarDateValidator)
  to!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Validate(ReportProjectValidator, { each: true })
  projects?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsIn(["es", "en"])
  language!: "es" | "en";

  @IsOptional()
  @IsIn(["summary", "detailed"])
  style: "summary" | "detailed" = "summary";
}
