import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import {
  Meter,
  toFirestoreDoc as meterToDoc,
} from '../src/meters/entities/meter.entity';
import {
  getReadingDocId,
  Reading,
  ReadingStatus,
  toFirestoreDoc as readingToDoc,
} from '../src/readings/entities/reading.entity';
import {
  getEventDocId,
  OperationalEvent,
  toFirestoreDoc as eventToDoc,
} from '../src/events/entities/operational-event.entity';

type Firestore = ReturnType<FirebaseService['getFirestore']>;

const READING_COLUMNS = [
  'meter_id',
  'timestamp',
  'consumption_kwh',
  'voltage_v',
  'current_a',
  'power_factor',
  'status',
] as const;

const EVENT_COLUMNS = [
  'meter_id',
  'event_timestamp',
  'event_type',
  'description',
] as const;

const FIRESTORE_BATCH_LIMIT = 500;

function parseCliArgs(): { readingsPath: string; eventsPath: string } {
  const argv = process.argv.slice(2);
  const getArg = (flag: string): string | undefined =>
    argv
      .find((arg) => arg.startsWith(`--${flag}=`))
      ?.split('=')
      .slice(1)
      .join('=');

  const readingsPath =
    getArg('readings') ??
    process.env.SEED_READINGS_PATH ??
    join('data', 'readings.csv');
  const eventsPath =
    getArg('events') ??
    process.env.SEED_EVENTS_PATH ??
    join('data', 'events.csv');

  return { readingsPath, eventsPath };
}

function readCsv(
  filePath: string,
  requiredColumns: readonly string[],
): Record<string, string>[] {
  if (!existsSync(filePath)) {
    throw new Error(`No se encontró el archivo CSV: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const rows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (rows.length === 0) {
    return rows;
  }

  const actualColumns = Object.keys(rows[0]);
  const missingColumns = requiredColumns.filter(
    (column) => !actualColumns.includes(column),
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `${filePath} no tiene las columnas esperadas. Faltan: ${missingColumns.join(', ')}. ` +
        `Columnas encontradas: ${actualColumns.join(', ')}.`,
    );
  }

  return rows;
}

function assertNoDuplicateReadings(readings: Reading[]): void {
  const seenAtRow = new Map<string, number>();
  const duplicates: string[] = [];

  readings.forEach((reading, index) => {
    const key = `${reading.meterId}|${reading.timestamp}`;
    const firstRow = seenAtRow.get(key);

    if (firstRow !== undefined) {
      duplicates.push(
        `(meter_id=${reading.meterId}, timestamp=${reading.timestamp}) en las filas ${firstRow} y ${index}`,
      );
    } else {
      seenAtRow.set(key, index);
    }
  });

  if (duplicates.length > 0) {
    throw new Error(
      `readings.csv contiene duplicados de (meter_id, timestamp): ${duplicates.join('; ')}.`,
    );
  }
}

function parseReadings(filePath: string): Reading[] {
  const rows = readCsv(filePath, READING_COLUMNS);

  const readings: Reading[] = rows.map((row) => ({
    meterId: row.meter_id,
    timestamp: row.timestamp,
    consumptionKwh: Number(row.consumption_kwh),
    voltage: Number(row.voltage_v),
    current: Number(row.current_a),
    powerFactor: Number(row.power_factor),
    status: row.status.toUpperCase() as ReadingStatus,
  }));

  assertNoDuplicateReadings(readings);

  return readings;
}

function parseEvents(filePath: string): OperationalEvent[] {
  const rows = readCsv(filePath, EVENT_COLUMNS);

  return rows.map((row) => ({
    meterId: row.meter_id,
    eventTimestamp: row.event_timestamp,
    eventType: row.event_type.toUpperCase(),
    description: row.description,
    durationHours: null, // el CSV no trae este campo; el motor infiere ventana por defecto
  }));
}

function deriveMeters(readings: Reading[]): Meter[] {
  const meterIds = [...new Set(readings.map((reading) => reading.meterId))];
  return meterIds.map((meterId) => ({ meterId }));
}

async function writeInBatches<T, D extends object>(
  firestore: Firestore,
  collection: string,
  items: T[],
  getDocId: (item: T) => string,
  toDoc: (item: T) => D,
): Promise<void> {
  for (let offset = 0; offset < items.length; offset += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(offset, offset + FIRESTORE_BATCH_LIMIT);
    const batch = firestore.batch();
    chunk.forEach((item) => {
      const ref = firestore.collection(collection).doc(getDocId(item));
      batch.set(ref, toDoc(item));
    });
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const { readingsPath, eventsPath } = parseCliArgs();

  console.log(`Leyendo readings desde ${readingsPath}...`);
  const readings = parseReadings(readingsPath);

  console.log(`Leyendo events desde ${eventsPath}...`);
  const events = parseEvents(eventsPath);

  const meters = deriveMeters(readings);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const firebaseService = app.get(FirebaseService);
    const firestore = firebaseService.getFirestore();

    console.log(`Escribiendo ${meters.length} meters...`);
    await writeInBatches(
      firestore,
      'meters',
      meters,
      (meter) => meter.meterId,
      meterToDoc,
    );

    console.log(`Escribiendo ${readings.length} readings...`);
    await writeInBatches(
      firestore,
      'readings',
      readings,
      (reading) => getReadingDocId(reading.meterId, reading.timestamp),
      readingToDoc,
    );

    console.log(`Escribiendo ${events.length} events...`);
    await writeInBatches(
      firestore,
      'events',
      events,
      (event) =>
        getEventDocId(event.meterId, event.eventTimestamp, event.eventType),
      eventToDoc,
    );

    console.log('Seed completado.');
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(`Seed falló: ${error.message}`);
  process.exit(1);
});
