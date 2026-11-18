import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
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
  @IsUUID("4", { each: true })
  projectIds?: string[];

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
