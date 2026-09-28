import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AnomalyEngineService } from '../src/ai/engine/anomaly-engine.service';
import { RunAnalysisParams } from '../src/ai/engine/types';

function parseCliArgs(): RunAnalysisParams {
  const argv = process.argv.slice(2);
  const getArg = (flag: string): string | undefined =>
    argv
      .find((arg) => arg.startsWith(`--${flag}=`))
      ?.split('=')
      .slice(1)
      .join('=');

  const metersArg = getArg('meters');
  const windowDaysArg = getArg('windowDays');
  const gapHoursArg = getArg('gapHours');

  return {
    meterIds: metersArg
      ? metersArg.split(',').map((id) => id.trim())
      : undefined,
    from: getArg('from'),
    to: getArg('to'),
    windowDays: windowDaysArg !== undefined ? Number(windowDaysArg) : undefined,
    gapHours: gapHoursArg !== undefined ? Number(gapHoursArg) : undefined,
  };
}

async function main(): Promise<void> {
  const params = parseCliArgs();
  const startedAt = Date.now();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const engine = app.get(AnomalyEngineService);
    const analysis = await engine.runAnalysis(params);
    const durationMs = Date.now() - startedAt;

    console.log('Análisis finalizado.');
    console.log(`  analysisId:        ${analysis.id}`);
    console.log(`  status:            ${analysis.status}`);
    console.log(`  anomaliesCount:    ${analysis.anomaliesCount}`);
    console.log(`  highPriorityCount: ${analysis.highPriorityCount}`);
    console.log(`  duración:          ${durationMs}ms`);

    process.exitCode = analysis.status === 'COMPLETED' ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(`Análisis falló: ${error.message}`);
  process.exit(1);
});
