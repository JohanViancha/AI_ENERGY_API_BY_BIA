import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { AnalysesRepository } from './analyses.repository';
import { AnomaliesController } from './anomalies.controller';
import { AnomaliesRepository } from './anomalies.repository';

@Module({
  imports: [FirebaseModule, AuthModule],
  controllers: [AnomaliesController],
  providers: [AnalysesRepository, AnomaliesRepository],
  exports: [AnalysesRepository, AnomaliesRepository],
})
export class AnomaliesModule {}
