import { Injectable } from '@nestjs/common';
import {
  AnomalySeverity,
  AnomalyType,
} from '../../anomalies/entities/anomaly.entity';

export interface RecommendationTemplateInput {
  type: AnomalyType;
  severity: AnomalySeverity;
  meterId: string;
}

type TemplateFn = (meterId: string) => string;

const TEMPLATES: Record<string, TemplateFn> = {
  DATA_QUALITY_HIGH: (meterId) =>
    `Inspeccionar el medidor ${meterId}: posible falla de instrumentación (calibración, cableado o comunicación).`,
  REAL_ANOMALY_HIGH: (meterId) =>
    `Investigar de inmediato la causa del consumo anómalo en ${meterId}; posible fuga, fallo de equipo o uso no autorizado.`,
  REAL_ANOMALY_MEDIUM: (meterId) =>
    `Revisar el consumo del medidor ${meterId} en las próximas horas; la variación es significativa pero no crítica.`,
  REAL_ANOMALY_LOW: (meterId) =>
    `Monitorear el medidor ${meterId}; la variación es leve y podría normalizarse sin intervención.`,
  EXPLAINABLE_ANOMALY_MEDIUM: (meterId) =>
    `Confirmar que el evento operativo registrado para ${meterId} explica la variación observada; evaluar si se requiere acción adicional.`,
  FALSE_POSITIVE_LOW: (meterId) =>
    `Confirmar que el evento operativo registrado para ${meterId} explica completamente la variación; no se requiere acción correctiva.`,
};

@Injectable()
export class RecommendationTemplateService {
  generate(input: RecommendationTemplateInput): string {
    const key = `${input.type}_${input.severity}`;
    const template = TEMPLATES[key];

    if (!template) {
      throw new Error(
        `No hay plantilla de recomendación para la combinación ${key}`,
      );
    }

    return template(input.meterId);
  }
}
