import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AnomaliesModule } from './anomalies/anomalies.module';
import { EventsModule } from './events/events.module';
import { FirebaseModule } from './firebase/firebase.module';
import { MetersModule } from './meters/meters.module';
import { ReadingsModule } from './readings/readings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    MetersModule,
    ReadingsModule,
    EventsModule,
    AnomaliesModule,
    AiModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
