import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { app } from '../../server/app';

/**
 * Declaração formal de segredos gerenciados pelo Google Cloud Secret Manager.
 * No ambiente Cloud Functions (2ª geração), esses segredos são disponibilizados
 * de maneira estritamente segura apenas durante a execução autorizada da função,
 * sem expor credenciais no código-fonte, nos arquivos de configuração ou no frontend.
 */
export const smtpPass = defineSecret('SMTP_PASS');
export const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');
export const smtpUser = defineSecret('SMTP_USER');
export const firebaseServiceAccountKey = defineSecret('FIREBASE_SERVICE_ACCOUNT_KEY');

/**
 * Região da Cloud Function:
 * O padrão é 'southamerica-east1' (São Paulo), garantindo mínima latência para os
 * usuários, colaboradores e familiares no Brasil. Pode ser personalizada via variável
 * de ambiente FUNCTION_REGION se a base do Firestore estiver provisionada em outra região.
 */
export const FUNCTION_REGION = process.env.FUNCTION_REGION || 'southamerica-east1';

/**
 * Cloud Function HTTP (2ª geração) para a API do Victoria Lar Residencial.
 *
 * Princípios de Engenharia e Governança:
 * 1. Reaproveitamento Integral: Encaminha as requisições para a aplicação Express
 *    existente em `server/app.ts`, sem duplicar regras de negócio ou endpoints.
 * 2. minInstances: 0 (scale-to-zero) — Custo financeiro zero quando não houver requisições.
 * 3. maxInstances: 2 — Limite estrito de concorrência simultânea para controle de custos
 *    e contenção contra picos acidentais ou abusivos de tráfego.
 * 4. timeoutSeconds: 60 — Limite conservador suficiente para operações atômicas no Firestore
 *    e despacho seguro de e-mails via SMTP com Nodemailer.
 * 5. memory: '256MiB' — Perfil conservador de memória adequado ao Node.js/Express.
 */
export const api = onRequest(
  {
    region: FUNCTION_REGION,
    minInstances: 0,
    maxInstances: 2,
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [smtpPass, gmailAppPassword, smtpUser, firebaseServiceAccountKey],
    cors: true,
  },
  app
);

export default api;
