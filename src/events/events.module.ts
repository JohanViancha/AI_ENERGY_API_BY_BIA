import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { EventsRepository } from './events.repository';

@Module({
  imports: [FirebaseModule],
  providers: [EventsRepository],
  exports: [EventsRepository],
})
export class EventsModule {}
