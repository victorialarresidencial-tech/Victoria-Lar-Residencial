import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import nodemailer, { Transporter } from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Load Firebase configuration
let firebaseConfig: any = null;
try {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

import {
  OFFICIAL_GMAIL,
  OFFICIAL_SENDER_NAME,
  getTransporter,
  sendMeetingConfirmationEmail,
  buildSmtpConfig,
  verifySmtpConnection,
  sanitizeLog,
} from './server/mailer';


// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    firebase: {
      configured: !!firebaseConfig,
      projectId: firebaseConfig?.projectId || null,
      databaseId: firebaseConfig?.firestoreDatabaseId || null,
    },
    institution: 'Victoria Lar Residencial',
  });
});

// Bootstrap Status Query
app.get('/api/bootstrap/status', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      configured: !!firebaseConfig,
      projectId: firebaseConfig?.projectId,
      bootstrapDocPath: '/system/bootstrap',
      guardDocPath: '/system/superAdminGuard',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao consultar status' });
  }
});

// Availability & Scheduling Endpoints
const bookedAppointments: Array<{ date: string; time: string }> = [];

let serverAvailabilityConfig = {
  dailyTimeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
  activeDays: [1, 2, 3, 4, 5],
  blockedSlots: [],
  meetingDuration: '30 a 45 minutos',
  meetingLink: 'https://meet.google.com/vic-tori-lar',
};

app.get('/api/schedule/availability', (_req: Request, res: Response) => {
  res.json({
    success: true,
    availability: serverAvailabilityConfig,
  });
});

app.post('/api/schedule/availability', (req: Request, res: Response) => {
  if (req.body && req.body.availability) {
    serverAvailabilityConfig = {
      ...serverAvailabilityConfig,
      ...req.body.availability,
    };
  }
  res.json({
    success: true,
    availability: serverAvailabilityConfig,
  });
});

app.get('/api/schedule/booked-slots', (req: Request, res: Response) => {
  const dateQuery = typeof req.query.date === 'string' ? req.query.date : '';
  const bookedSlots = bookedAppointments
    .filter((a) => a.date === dateQuery)
    .map((a) => a.time);

  res.json({
    success: true,
    date: dateQuery,
    bookedSlots,
  });
});

// Meeting Scheduling Intake API (Dispara e-mail de confirmação ao cliente)
app.post('/api/schedule-meeting', async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      phone,
      scheduledDate,
      scheduledTime,
      meetingLink,
      relationship,
      serviceInterest,
      message,
      honeypot,
      emailSubject,
      emailInstructions,
    } = req.body;

    // Honeypot anti-bot check
    if (honeypot) {
      return res.status(200).json({ success: true, message: 'Agendamento recebido.' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: 'Nome completo é obrigatório.' });
    }

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 160) {
      return res.status(400).json({ error: 'E-mail válido é obrigatório para envio da confirmação.' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: 'Telefone ou WhatsApp é obrigatório.' });
    }

    if (!scheduledDate || typeof scheduledDate !== 'string') {
      return res.status(400).json({ error: 'Selecione a data da reunião.' });
    }

    if (!scheduledTime || typeof scheduledTime !== 'string') {
      return res.status(400).json({ error: 'Selecione o horário da reunião.' });
    }

    // Formata a data para formato amigável brasileiro (DD/MM/AAAA)
    let formattedDate = scheduledDate.trim();
    if (formattedDate.includes('-')) {
      const [y, m, d] = formattedDate.split('-');
      formattedDate = `${d}/${m}/${y}`;
    }

    const resolvedMeetingLink = meetingLink || 'https://meet.google.com/vic-tori-lar';

    // 1. Reunião salva no agendamento do servidor (sempre preservada, sem duplicação)
    const appointmentRecord = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      scheduledDate: scheduledDate.trim(),
      scheduledTime: scheduledTime.trim(),
      meetingLink: resolvedMeetingLink,
      relationship: relationship ? String(relationship).slice(0, 60) : 'Familiar',
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : 'Reunião de Apresentação',
      message: message ? message.trim() : '',
      status: 'scheduled',
      type: 'meeting',
      createdAt: new Date().toISOString(),
      notificationStatus: 'pending',
    };

    const alreadyBooked = bookedAppointments.some(
      (a) => a.date === scheduledDate.trim() && a.time === scheduledTime.trim()
    );

    if (!alreadyBooked) {
      bookedAppointments.push({
        date: scheduledDate.trim(),
        time: scheduledTime.trim(),
      });
    }

    // 2. Dispara e-mail de confirmação ao cliente de forma síncrona
    const emailResult = await sendMeetingConfirmationEmail({
      to: email.trim(),
      name: name.trim(),
      scheduledDate: scheduledDate.trim(),
      scheduledTime: scheduledTime.trim(),
      meetingLink: resolvedMeetingLink,
      serviceInterest,
      phone,
      subject: emailSubject,
      instructions: emailInstructions,
    });

    appointmentRecord.notificationStatus = emailResult.success ? 'sent' : 'failed';

    // 3. Monta resposta HTTP distinguindo reunião agendada de entrega do e-mail
    const emailSent = emailResult.success === true;
    const userMessage = emailSent
      ? `Reunião agendada com sucesso para ${formattedDate} às ${scheduledTime}! Um e-mail de confirmação com a sala do Google Meet e botão para registro no Google Calendar foi enviado para ${email.trim()} a partir de ${OFFICIAL_GMAIL}.`
      : `Reunião agendada com sucesso para ${formattedDate} às ${scheduledTime}! Não foi possível despachar o e-mail de confirmação automaticamente (${emailResult.error || 'instabilidade na conexão SMTP'}), mas seu horário com a direção está confirmado. Salve o link do Google Meet e adicione o compromisso ao seu calendário pelos botões abaixo.`;

    return res.status(201).json({
      success: true,
      appointmentScheduled: true,
      emailSent,
      emailError: emailSent ? null : (emailResult.error || 'Falha no envio de e-mail'),
      errorCode: emailSent ? null : (emailResult.errorCode || 'SEND_FAILED'),
      message: userMessage,
      data: appointmentRecord,
      meetingLink: resolvedMeetingLink,
      googleCalendarUrl: emailResult?.googleCalendarUrl || null,
      sender: OFFICIAL_GMAIL,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (err: any) {
    console.error('Erro no agendamento de reunião:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha ao processar agendamento. Tente novamente mais tarde.' });
  }
});

// Mailer Status & Health Endpoint (Permite auditoria segura de conexão no Render)
app.get('/api/mail/status', async (req: Request, res: Response) => {
  const config = buildSmtpConfig();
  const shouldVerify = req.query.verify === 'true';

  let verificationResult: { ok: boolean; error?: string } | null = null;
  if (shouldVerify) {
    verificationResult = await verifySmtpConnection();
  }

  res.json({
    success: true,
    senderEmail: OFFICIAL_GMAIL,
    senderName: OFFICIAL_SENDER_NAME,
    configured: !config.isFallback,
    mode: config.isCustomHost
      ? 'CUSTOM_SMTP'
      : config.isDirectGmail
      ? 'GMAIL_OFFICIAL'
      : 'DEVELOPMENT_FALLBACK',
    connection: {
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      hasAuth: !!config.pass,
      timeouts: {
        connection: config.connectionTimeout,
        greeting: config.greetingTimeout,
        socket: config.socketTimeout,
      },
    },
    verification: verificationResult,
    renderTips: [
      'Render bloqueia porta 25 de saída.',
      'Para Gmail no Render, recomenda-se porta 465 com SSL/TLS (SMTP_PORT=465 e SMTP_SECURE=true).',
      'Para porta 587, use STARTTLS (SMTP_PORT=587 e SMTP_SECURE=false).',
    ],
  });
});

// Contact Intake API (Server-side validation and confirmation)
app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, relationship, serviceInterest, message, honeypot } = req.body;

    // Honeypot check: anti-bot protection
    if (honeypot) {
      return res.status(200).json({ success: true, message: 'Solicitação recebida com sucesso.' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
      return res.status(400).json({ error: 'Nome é obrigatório e deve ter até 120 caracteres.' });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length < 8 || phone.length > 30) {
      return res.status(400).json({ error: 'Telefone de contato válido é obrigatório.' });
    }

    if (email && (typeof email !== 'string' || email.length > 160 || !email.includes('@'))) {
      return res.status(400).json({ error: 'E-mail fornecido é inválido.' });
    }

    if (message && (typeof message !== 'string' || message.length > 2000)) {
      return res.status(400).json({ error: 'Mensagem excede o limite de 2000 caracteres.' });
    }

    // Se forneceu e-mail, dispara confirmação de recebimento sem travar a resposta HTTP
    if (email && email.includes('@')) {
      (async () => {
        try {
          const transporter = await getTransporter();
          await transporter.sendMail({
            from: `"${OFFICIAL_SENDER_NAME}" <${OFFICIAL_GMAIL}>`,
            replyTo: OFFICIAL_GMAIL,
            to: email.trim(),
            bcc: OFFICIAL_GMAIL,
            subject: 'Recebemos sua mensagem - Victoria Lar Residencial',
            html: `
              <div style="font-family: sans-serif; background-color: #FAF9F5; padding: 24px; color: #173D2B;">
                <div style="max-width: 550px; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #B8954A; margin: 0 auto;">
                  <h2 style="color: #173D2B; font-family: Georgia, serif;">Olá, ${name.trim()}!</h2>
                  <p>Recebemos sua solicitação de contato e interesse em <strong>${serviceInterest || 'nossos cuidados'}</strong>.</p>
                  <p>Nossa equipe entrará em contato prontamente pelo telefone <strong>${phone.trim()}</strong> para tirar todas as suas dúvidas e acolher sua família.</p>
                  <p style="margin-top: 20px; font-weight: bold; color: #173D2B;">Victoria Lar Residencial</p>
                  <p style="font-size: 11px; color: #718096; margin-top: 10px;">E-mail oficial: ${OFFICIAL_GMAIL}</p>
                </div>
              </div>
            `,
          });
        } catch (e: any) {
          console.warn('[Victoria Lar Mailer] Aviso no envio de e-mail de contato simples:', sanitizeLog(e?.message || e));
        }
      })();
    }

    const leadRecord = {
      name: name.trim(),
      email: email ? email.trim() : null,
      phone: phone.trim(),
      relationship: relationship ? String(relationship).slice(0, 60) : 'Familiar',
      serviceInterest: serviceInterest ? String(serviceInterest).slice(0, 100) : 'Geral',
      message: message ? message.trim() : '',
      status: 'unread',
      type: 'form',
      createdAt: new Date().toISOString(),
      origin: 'landing_page_form',
    };

    return res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso! Um e-mail de confirmação foi encaminhado e nossa equipe retornará rapidamente.',
      data: leadRecord,
    });
  } catch (err: any) {
    console.error('Erro no processamento de contato:', sanitizeLog(err?.message || err));
    return res.status(500).json({ error: 'Falha no envio da mensagem. Tente novamente mais tarde.' });
  }
});

// -------------------------------------------------------------
// Express + Vite Integration (Dev & Prod)
// -------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Victoria Lar Server] Rodando na porta ${PORT} (${isProd ? 'produção' : 'desenvolvimento'})`);
  });
}

// Inicia o servidor apenas quando executado diretamente como processo principal e fora do ambiente de teste
const isMainModule = !!(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js') ||
    process.argv[1].endsWith('/server'))
);

if (isMainModule && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Falha ao iniciar servidor Express/Vite:', sanitizeLog(err?.message || err));
    process.exit(1);
  });
}

export { app, bookedAppointments };
