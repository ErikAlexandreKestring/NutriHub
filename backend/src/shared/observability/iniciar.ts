// Importado como primeira linha do server.ts: o coletor precisa ligar antes do
// Express e do pg serem carregados, senão não consegue instrumentá-los. O
// import de env vem junto porque é ele que lê o .env em desenvolvimento.
import { env } from '../../config/env';
import { iniciarTelemetria } from './telemetria';

iniciarTelemetria(env.telemetry.connectionString);
