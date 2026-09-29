import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListReadingsQueryDto {
  @ApiProperty({
    description: 'Fecha inicial ISO 8601 del rango de lecturas',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsISO8601()
  from!: string;

  @ApiProperty({
    description: 'Fecha final ISO 8601 del rango de lecturas',
    example: '2026-01-02T00:00:00.000Z',
  })
  @IsISO8601()
  to!: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de lecturas por página',
    default: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;

  @ApiPropertyOptional({
    description: 'Timestamp ISO de la última lectura de la página anterior',
    example: '2026-01-01T05:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
