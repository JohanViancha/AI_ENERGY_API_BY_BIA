import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { HealthController } from './health.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
