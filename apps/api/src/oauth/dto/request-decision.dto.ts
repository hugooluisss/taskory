import { IsBoolean } from "class-validator";

export class RequestDecisionDto {
  @IsBoolean()
  approve!: boolean;
}
