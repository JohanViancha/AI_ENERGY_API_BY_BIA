import { Module } from '@nestjs/common';
import { AnomaliesModule } from '../anomalies/anomalies.module';
import { EventsModule } from '../events/events.module';
import { MetersModule } from '../meters/meters.module';
import { ReadingsModule } from '../readings/readings.module';
import { RecommendationTemplateService } from './explainer/recommendation-template.service';
import { ReasonTemplateService } from './explainer/reason-template.service';
import { AnomalyBuilderService } from './engine/anomaly-builder.service';
import { AnomalyClassifierService } from './engine/anomaly-classifier.service';
import { AnomalyDetectorRunnerService } from './engine/anomaly-detector-runner.service';
import { AnomalyEngineService } from './engine/anomaly-engine.service';
import { AnomalyGrouperService } from './engine/anomaly-grouper.service';
import { BaselineCalculatorService } from './engine/baseline-calculator.service';
import { ConfidenceCalculatorService } from './engine/confidence-calculator.service';
import { EventCorrelatorService } from './engine/event-correlator.service';
import { ReadingEventLoaderService } from './engine/reading-event-loader.service';

@Module({
  imports: [MetersModule, ReadingsModule, EventsModule, AnomaliesModule],
  providers: [
    BaselineCalculatorService,
    AnomalyGrouperService,
    EventCorrelatorService,
    AnomalyClassifierService,
    ConfidenceCalculatorService,
    ReasonTemplateService,
    RecommendationTemplateService,
    ReadingEventLoaderService,
    AnomalyDetectorRunnerService,
    AnomalyBuilderService,
    AnomalyEngineService,
  ],
  exports: [AnomalyEngineService],
})
export class AiModule {}
