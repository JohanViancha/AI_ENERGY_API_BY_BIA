import { Module } from '@nestjs/common';
import { AnomaliesModule } from '../anomalies/anomalies.module';
import { AuthModule } from '../auth/auth.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReadingsModule } from '../readings/readings.module';
import { MetersController } from './meters.controller';
import { MetersRepository } from './meters.repository';

@Module({
  imports: [FirebaseModule, ReadingsModule, AnomaliesModule, AuthModule],
  controllers: [MetersController],
  providers: [MetersRepository],
  exports: [MetersRepository],
})
export class MetersModule {}
