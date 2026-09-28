import { Injectable } from '@nestjs/common';
import { AnomalyType } from '../../anomalies/entities/anomaly.entity';

export interface ReasonTemplateInput {
  type: AnomalyType;
  meterId: string;
  windowStart: string;
  windowEnd: string;
  variationPct: number;
  signals: string[]; // evidence.signals ya armado (detectores + NO_EVENT/EVENT_MATCH)
}

const VARIATION_PCT_DECIMALS = 1;

@Injectable()
export class ReasonTemplateService {
  generate(input: ReasonTemplateInput): string {
    const variationPctText = input.variationPct.toFixed(VARIATION_PCT_DECIMALS);

    return (
      `${input.type} en ${input.meterId} durante ${input.windowStart}–${input.windowEnd}: ` +
      `variación de ${variationPctText}% vs. baseline horario. ` +
      `Señales: ${input.signals.join(', ')}.`
    );
  }
}
