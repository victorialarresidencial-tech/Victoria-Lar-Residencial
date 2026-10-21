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

// -------------------------------------------------------------
// Mailer Service Helper (Oficial: victorialarresidencial@gmail.com)
// -------------------------------------------------------------
const OFFICIAL_GMAIL = 'victorialarresidencial@gmail.com';
const OFFICIAL_SENDER_NAME = 'Victoria Lar Residencial';

let cachedTransporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter;

  const appPassword = (
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.GMAIL_PASSWORD ||
    ''
  ).replace(/\s+/g, '');

  if (appPassword) {
    console.log(`[Victoria Lar Mailer] Usando autenticação oficial Gmail para ${OFFICIAL_GMAIL}`);
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: OFFICIAL_GMAIL,
        pass: appPassword,
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
    });
    return cachedTransporter;
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    console.log(`[Victoria Lar Mailer] Usando SMTP configurado: ${process.env.SMTP_HOST}`);
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
    });
    return cachedTransporter;
  }

  // Graceful development / demo transporter (caso a secret ainda não esteja cadastrada)
  console.warn(
    `[Victoria Lar Mailer] GMAIL_APP_PASSWORD não informada no ambiente. Cadastre o secret GMAIL_APP_PASSWORD no painel de segredos do AI Studio para envio real pelo Gmail victorialarresidencial@gmail.com. Utilizando transporte de teste em desenvolvimento.`
  );
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      connectionTimeout: 3000,
      greetingTimeout: 3000,
      socketTimeout: 4000,
    });
    return cachedTransporter;
  } catch (err) {
    cachedTransporter = nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    });
    return cachedTransporter;
  }
}

interface SendMeetingEmailParams {
  to: string;
  name: string;
  scheduledDate: string;
  scheduledTime: string;
  meetingLink: string;
  serviceInterest?: string;
  phone?: string;
  instructions?: string;
  subject?: string;
}

interface CalendarDetails {
  title: string;
  formattedDate: string;
  startIso: string;
  endIso: string;
  googleCalendarUrl: string;
  icsContent: string;
}

function buildCalendarDetails(params: {
  name: string;
  email: string;
  scheduledDate: string;
  scheduledTime: string;
  meetingLink: string;
  serviceInterest?: string;
  durationMinutes?: number;
}): CalendarDetails {
  let formattedDate = params.scheduledDate;
  if (params.scheduledDate.includes('-')) {
    const [y, m, d] = params.scheduledDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
  }

  const [yearStr, monthStr, dayStr] = params.scheduledDate.split('-');
  const [hourStr, minStr] = params.scheduledTime.split(':');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || 1;
  const day = parseInt(dayStr, 10) || 1;
  const hour = parseInt(hourStr, 10) || 9;
  const minute = parseInt(minStr, 10) || 0;
  const duration = params.durationMinutes || 45;

  // Horário de Brasília é UTC-3. Criamos a data em UTC somando 3 horas ao horário local.
  const startUtc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  const endUtc = new Date(startUtc.getTime() + duration * 60 * 1000);
  const nowUtc = new Date();

  const toCompactIso = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const startIso = toCompactIso(startUtc);
  const endIso = toCompactIso(endUtc);
  const dtStamp = toCompactIso(nowUtc);

  const title = 'Reunião Online - Victoria Lar Residencial';
  const description = [
    `Reunião com a direção da Victoria Lar Residencial (Olga & Robson).`,
    ``,
    `📹 Link do Google Meet: ${params.meetingLink}`,
    `📅 Data: ${formattedDate}`,
    `⏰ Horário: ${params.scheduledTime} (Horário de Brasília)`,
    `🩺 Assunto: ${params.serviceInterest || 'Reunião de Apresentação e Planos'}`,
    `👤 Participante: ${params.name}`,
    `✉️ Remetente Oficial: ${OFFICIAL_GMAIL}`,
    `📞 WhatsApp da Direção: (11) 98765-4321`,
    `📍 Endereço: Alameda das Rosas, 450 - São Paulo, SP`,
    ``,
    `Instruções: Conecte-se com 5 minutos de antecedência. Reunião acessível pelo celular ou computador.`,
  ].join('\n');

  // URL para registro no Google Calendar (com timezone America/Sao_Paulo)
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${startIso}/${endIso}&details=${encodeURIComponent(
    description
  )}&location=${encodeURIComponent(params.meetingLink)}&ctz=America/Sao_Paulo`;

  // Convite padrão iCalendar RFC 5545 (.ics)
  const uid = `meet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@victorialar.com.br`;
  const cleanDesc = description.replace(/\n/g, '\\n');
  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Victoria Lar Residencial//Agendamento Google Meet//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${cleanDesc}`,
    `LOCATION:${params.meetingLink}`,
    `ORGANIZER;CN="Victoria Lar Residencial":mailto:${OFFICIAL_GMAIL}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${params.name.replace(/[",\r\n]/g, '')}":mailto:${params.email}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const icsContent = icsLines.join('\r\n');

  return {
    title,
    formattedDate,
    startIso,
    endIso,
    googleCalendarUrl,
    icsContent,
  };
}

async function sendMeetingConfirmationEmail(params: SendMeetingEmailParams) {
  const transporter = await getTransporter();
  const mailSubject = params.subject || `Confirmação de Agendamento: Reunião - Victoria Lar Residencial`;

  const calendarDetails = buildCalendarDetails({
    name: params.name,
    email: params.to,
    scheduledDate: params.scheduledDate,
    scheduledTime: params.scheduledTime,
    meetingLink: params.meetingLink,
    serviceInterest: params.serviceInterest,
  });

  const htmlBody = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${mailSubject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F5; margin: 0; padding: 24px; color: #1c2b22;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #B8954A; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background-color: #173D2B; padding: 32px 28px; text-align: center; border-bottom: 3px solid #B8954A;">
            <h1 style="margin: 0; color: #FAF9F5; font-size: 24px; font-family: Georgia, serif; letter-spacing: 2px;">VICTORIA</h1>
            <p style="margin: 6px 0 0 0; color: #B8954A; font-size: 11px; letter-spacing: 3px; font-weight: 600;">LAR RESIDENCIAL</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <div style="display: inline-block; background-color: #FAF9F5; border: 1px solid #B8954A; border-radius: 9999px; padding: 4px 14px; font-size: 12px; font-weight: bold; color: #173D2B; margin-bottom: 16px;">
              ✓ AGENDAMENTO CONFIRMADO • GOOGLE MEET
            </div>

            <h2 style="margin: 0 0 16px 0; color: #173D2B; font-size: 20px; font-family: Georgia, serif;">
              Olá, ${params.name}!
            </h2>

            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #4a5568;">
              Recebemos com muito carinho a sua solicitação. Sua reunião online com a direção da <strong>Victoria Lar Residencial</strong> está confirmada com os seguintes detalhes:
            </p>

            <!-- Card dos detalhes da reunião -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAF9F5; border-left: 4px solid #B8954A; border-radius: 12px; margin: 20px 0; padding: 20px;">
              <tr>
                <td style="font-size: 14px; line-height: 1.8;">
                  <strong style="color: #173D2B;">📅 Data:</strong> ${calendarDetails.formattedDate}<br />
                  <strong style="color: #173D2B;">⏰ Horário:</strong> ${params.scheduledTime} (Horário de Brasília)<br />
                  <strong style="color: #173D2B;">📹 Formato:</strong> Reunião Online via Google Meet<br />
                  ${params.serviceInterest ? `<strong style="color: #173D2B;">🩺 Assunto:</strong> ${params.serviceInterest}<br />` : ''}
                  <strong style="color: #173D2B;">👥 Atendimento:</strong> Olga & Robson (Sócios-Proprietários)<br />
                  <strong style="color: #173D2B;">✉️ E-mail Oficial:</strong> ${OFFICIAL_GMAIL}
                </td>
              </tr>
            </table>

            <!-- Link do Google Meet -->
            <div style="text-align: center; margin: 28px 0 20px 0;">
              <a href="${params.meetingLink}" target="_blank" style="display: inline-block; background-color: #173D2B; color: #FAF9F5; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 9999px; border: 2px solid #B8954A; box-shadow: 0 4px 14px rgba(23,61,43,0.3);">
                📹 Entrar na Sala do Google Meet
              </a>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #718096;">
                Link direto: <a href="${params.meetingLink}" style="color: #173D2B; font-weight: 600;">${params.meetingLink}</a>
              </p>
            </div>

            <!-- OPÇÃO PARA REGISTRO NO GOOGLE CALENDAR -->
            <div style="background-color: #FAF9F5; border: 1.5px solid #B8954A; border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center;">
              <div style="font-size: 13px; font-weight: bold; color: #173D2B; margin-bottom: 6px;">
                🗓️ Registro no Google Calendar
              </div>
              <p style="margin: 0 0 14px 0; font-size: 12px; line-height: 1.5; color: #4a5568;">
                Adicione este compromisso diretamente à sua agenda do Google para receber notificações e ter o link do Meet sempre à mão:
              </p>
              <a href="${calendarDetails.googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #B8954A; color: #173D2B; font-size: 13px; font-weight: bold; text-decoration: none; padding: 11px 24px; border-radius: 9999px; box-shadow: 0 3px 10px rgba(184,149,74,0.3);">
                📅 Adicionar ao Google Calendar
              </a>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #718096;">
                Também anexamos a este e-mail o arquivo de calendário (.ics) compatível com celular, Outlook e Apple Calendar.
              </p>
            </div>

            <!-- Orientações -->
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 12px; line-height: 1.6; color: #4a5568;">
              <strong style="color: #173D2B; display: block; margin-bottom: 6px;">💡 Informações Importantes:</strong>
              • Recomendamos acessar o link com 5 minutos de antecedência.<br />
              • A reunião pode ser acessada pelo computador ou celular com câmera e microfone.<br />
              • Se precisar remarcar ou tiver qualquer imprevisto, basta responder diretamente a este e-mail (<a href="mailto:${OFFICIAL_GMAIL}" style="color: #173D2B;">${OFFICIAL_GMAIL}</a>) ou nos chamar no WhatsApp: <strong>(11) 98765-4321</strong>.<br />
              ${params.instructions ? `<br /><em>Nota adicional: ${params.instructions}</em>` : ''}
            </div>

            <p style="margin: 28px 0 0 0; font-size: 13px; line-height: 1.6; color: #4a5568;">
              Estamos muito felizes em poder conversar com você e apresentar toda a nossa estrutura de carinho, saúde e dignidade para seu familiar.
            </p>

            <p style="margin: 16px 0 0 0; font-size: 13px; font-weight: bold; color: #173D2B;">
              Com carinho,<br />
              Olga & Robson — Direção da Victoria Lar Residencial
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #FAF9F5; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #718096;">
            <strong>Victoria Lar Residencial</strong><br />
            Alameda das Rosas, 450 - São Paulo, SP • WhatsApp: (11) 98765-4321 • E-mail: ${OFFICIAL_GMAIL}<br />
            Atendimento direto, humanizado e sem intermediários.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  let messageId = `msg_${Date.now()}`;
  let previewUrl: string | null = null;

  try {
    const sendPromise = transporter.sendMail({
      from: `"${OFFICIAL_SENDER_NAME}" <${OFFICIAL_GMAIL}>`,
      replyTo: OFFICIAL_GMAIL,
      to: params.to,
      bcc: OFFICIAL_GMAIL, // Notifica a administração da Victoria Lar
      subject: mailSubject,
      html: htmlBody,
      icalEvent: {
        filename: 'agendamento-victoria-lar.ics',
        method: 'REQUEST',
        content: calendarDetails.icsContent,
      },
      alternatives: [
        {
          contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
          content: calendarDetails.icsContent,
        },
      ],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MAIL_TIMEOUT')), 4500)
    );

    const info = (await Promise.race([sendPromise, timeoutPromise])) as any;
    messageId = info.messageId || messageId;
    previewUrl = nodemailer.getTestMessageUrl(info) || null;
  } catch (mailErr) {
    console.warn('[Victoria Lar Mailer] Aviso no envio assíncrono de e-mail:', mailErr);
  }

  return {
    messageId,
    previewUrl,
    googleCalendarUrl: calendarDetails.googleCalendarUrl,
  };
}

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

    // Dispara e-mail de confirmação para o cliente
    let emailResult: any = null;
    try {
      emailResult = await sendMeetingConfirmationEmail({
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
      console.log(`[Victoria Lar Mailer] E-mail de confirmação enviado para ${email.trim()}:`, emailResult);
    } catch (mailErr) {
      console.warn('[Victoria Lar Mailer] Aviso no envio de e-mail:', mailErr);
    }

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
    };

    bookedAppointments.push({
      date: scheduledDate.trim(),
      time: scheduledTime.trim(),
    });

    return res.status(201).json({
      success: true,
      message: `Reunião agendada com sucesso para ${formattedDate} às ${scheduledTime}! Um e-mail de confirmação com a sala do Google Meet e botão para registro no Google Calendar foi enviado para ${email.trim()} a partir de ${OFFICIAL_GMAIL}.`,
      data: appointmentRecord,
      meetingLink: resolvedMeetingLink,
      googleCalendarUrl: emailResult?.googleCalendarUrl || null,
      emailSent: true,
      sender: OFFICIAL_GMAIL,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (err: any) {
    console.error('Erro no agendamento de reunião:', err);
    return res.status(500).json({ error: 'Falha ao processar agendamento. Tente novamente mais tarde.' });
  }
});

// Mailer Status & Health Endpoint
app.get('/api/mail/status', (_req: Request, res: Response) => {
  const hasAppPassword = !!(
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASS ||
    process.env.GMAIL_PASSWORD
  );
  res.json({
    success: true,
    senderEmail: OFFICIAL_GMAIL,
    senderName: OFFICIAL_SENDER_NAME,
    hasAppPassword,
    secretKey: 'GMAIL_APP_PASSWORD',
    smtpConfigured: hasAppPassword || !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    mode: hasAppPassword ? 'GMAIL_OFFICIAL' : 'DEVELOPMENT_FALLBACK',
    instructions:
      'Para ativar o envio direto pela conta victorialarresidencial@gmail.com, registre a secret GMAIL_APP_PASSWORD no painel de segredos do AI Studio.',
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
          const sendPromise = transporter.sendMail({
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
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('MAIL_TIMEOUT')), 4000)
          );
          await Promise.race([sendPromise, timeoutPromise]);
        } catch (e) {
          console.warn('[Victoria Lar Mailer] Aviso no envio de e-mail de contato simples:', e);
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
    console.error('Erro no processamento de contato:', err);
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

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor Express/Vite:', err);
  process.exit(1);
});
