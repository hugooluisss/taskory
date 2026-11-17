import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Length,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { isCalendarDate } from "../../common/dates/is-calendar-date";

@ValidatorConstraint({ name: "calendarDate", async: false })
export class CalendarDateValidator implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    return isCalendarDate(value);
  }
}

@ValidatorConstraint({ name: "httpUrl", async: false })
export class HttpUrlValidator implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
}

export function RequiredDateField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsString()(target, propertyKey);
    Validate(CalendarDateValidator)(target, propertyKey);
  };
}

export function OptionalDateField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsString()(target, propertyKey);
    Validate(CalendarDateValidator)(target, propertyKey);
  };
}

export function RequiredTitleField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsString()(target, propertyKey);
    Length(1, 200)(target, propertyKey);
  };
}

export function OptionalTitleField(): PropertyDecorator {
  return RequiredTitleField();
}

export function OptionalDescriptionField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsString()(target, propertyKey);
    MaxLength(10000)(target, propertyKey);
  };
}

export function OptionalReferenceUrlsField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsArray()(target, propertyKey);
    ArrayMaxSize(20)(target, propertyKey);
    Validate(HttpUrlValidator, { each: true })(target, propertyKey);
  };
}

export function OptionalTagsField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsArray()(target, propertyKey);
    ArrayMaxSize(20)(target, propertyKey);
    IsString({ each: true })(target, propertyKey);
    MaxLength(50, { each: true })(target, propertyKey);
  };
}

export function OptionalProjectField(): PropertyDecorator {
  return (target, propertyKey) => {
    IsString()(target, propertyKey);
    MaxLength(100)(target, propertyKey);
  };
}
