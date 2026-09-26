import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnomaliesModule } from './anomalies/anomalies.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
