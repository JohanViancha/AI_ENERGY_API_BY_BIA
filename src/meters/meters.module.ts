import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { MetersRepository } from './meters.repository';

@Module({
  imports: [FirebaseModule],
  providers: [MetersRepository],
  exports: [MetersRepository],
})
export class MetersModule {}
