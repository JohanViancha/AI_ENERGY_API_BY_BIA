import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { AnalysesRepository } from './analyses.repository';
import { AnomaliesRepository } from './anomalies.repository';

@Module({
  imports: [FirebaseModule],
  providers: [AnalysesRepository, AnomaliesRepository],
  exports: [AnalysesRepository, AnomaliesRepository],
})
export class AnomaliesModule {}
