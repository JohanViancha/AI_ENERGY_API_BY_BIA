import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FirebaseService } from '../firebase/firebase.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso responde' })
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: Firestore es alcanzable' })
  async readiness() {
    try {
      await this.firebaseService.getFirestore().listCollections();
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Firestore unreachable');
    }
  }
}
