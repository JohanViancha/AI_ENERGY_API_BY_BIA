import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { AnomalySeverity, AnomalyType } from '../entities/anomaly.entity';

const SEVERITIES: AnomalySeverity[] = ['LOW', 'MEDIUM', 'HIGH'];
const TYPES: AnomalyType[] = [
  'REAL_ANOMALY',
  'EXPLAINABLE_ANOMALY',
  'FALSE_POSITIVE',
  'DATA_QUALITY',
];

export class ListAnomaliesQueryDto {
  @ApiProperty({
    description: 'Id de la corrida (Analysis) cuyas anomalías se listan',
    example: 'analysis-123',
  })
  @IsString()
  @IsNotEmpty()
  analysisId!: string;

  @ApiPropertyOptional({
    description: 'Filtra por medidor',
    example: 'M-001',
  })
  @IsOptional()
  @IsString()
  meterId?: string;

  @ApiPropertyOptional({
    enum: SEVERITIES,
    description: 'Filtra por severidad',
  })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: AnomalySeverity;

  @ApiPropertyOptional({
    enum: TYPES,
    description: 'Filtra por tipo de anomalía',
  })
  @IsOptional()
  @IsIn(TYPES)
  type?: AnomalyType;
}
