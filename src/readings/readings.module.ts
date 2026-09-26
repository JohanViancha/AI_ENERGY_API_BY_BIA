import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { ReadingsRepository } from './readings.repository';

@Module({
  imports: [FirebaseModule],
  providers: [ReadingsRepository],
  exports: [ReadingsRepository],
})
export class ReadingsModule {}
