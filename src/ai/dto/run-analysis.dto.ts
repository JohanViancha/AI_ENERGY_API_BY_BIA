import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class RunAnalysisDto {
  @ApiPropertyOptional({
    description:
      'Medidores a analizar. Default: todos (MetersRepository.listAll())',
    type: [String],
    example: ['M-001', 'M-002'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  meterIds?: string[];

  @ApiPropertyOptional({
    description:
      'Fecha inicial ISO 8601. Default: min(timestamp) de las lecturas del medidor',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Fecha final ISO 8601. Default: max(timestamp) de las lecturas del medidor',
    example: '2026-01-31T23:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Alternativa a from/to: últimos N días desde el máximo timestamp disponible',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  windowDays?: number;

  @ApiPropertyOptional({
    description:
      'Separación máxima en horas entre lecturas anómalas para seguir en el mismo tramo. Default 4',
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  gapHours?: number;
}
