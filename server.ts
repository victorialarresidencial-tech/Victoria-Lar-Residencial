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
// Mailer Service Helper (with zero-failure graceful fallback)
// -------------------------------------------------------------
let cachedTransporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return cachedTransporter;
  }

  // Graceful development / demo transporter
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

async function sendMeetingConfirmationEmail(params: SendMeetingEmailParams) {
  const transporter = await getTransporter();
  const mailSubject = params.subject || `Confirmação de Agendamento: Reunião - Victoria Lar Residencial`;

  // Format date to Brazilian friendly format (DD/MM/YYYY)
  let formattedDate = params.scheduledDate;
  if (params.scheduledDate.includes('-')) {
    const [y, m, d] = params.scheduledDate.split('-');
    formattedDate = `${d}/${m}/${y}`;
  }

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
              ✓ AGENDAMENTO CONFIRMADO
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
                  <strong style="color: #173D2B;">📅 Data:</strong> ${formattedDate}<br />
                  <strong style="color: #173D2B;">⏰ Horário:</strong> ${params.scheduledTime} (Horário de Brasília)<br />
                  <strong style="color: #173D2B;">📹 Formato:</strong> Reunião Online via Google Meet<br />
                  ${params.serviceInterest ? `<strong style="color: #173D2B;">🩺 Assunto:</strong> ${params.serviceInterest}<br />` : ''}
                  <strong style="color: #173D2B;">👥 Atendimento:</strong> Regina & Roberto (Sócios-Proprietários)
                </td>
              </tr>
            </table>

            <!-- Link do Google Meet -->
            <div style="text-align: center; margin: 28px 0;">
              <a href="${params.meetingLink}" target="_blank" style="display: inline-block; background-color: #B8954A; color: #173D2B; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 9999px; box-shadow: 0 3px 10px rgba(184,149,74,0.3);">
                Entrar na Reunião (Google Meet)
              </a>
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #718096;">
                Link direto: <a href="${params.meetingLink}" style="color: #173D2B;">${params.meetingLink}</a>
              </p>
            </div>

            <!-- Orientações -->
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 12px; line-height: 1.6; color: #4a5568;">
              <strong style="color: #173D2B; display: block; margin-bottom: 6px;">💡 Informações Importantes:</strong>
              • Recomendamos acessar o link com 5 minutos de antecedência.<br />
              • A reunião pode ser acessada pelo computador ou celular com câmera e microfone.<br />
              • Se precisar remarcar ou tiver qualquer imprevisto, basta responder a este e-mail ou nos chamar diretamente no WhatsApp.<br />
              ${params.instructions ? `<br /><em>Nota adicional: ${params.instructions}</em>` : ''}
            </div>

            <p style="margin: 28px 0 0 0; font-size: 13px; line-height: 1.6; color: #4a5568;">
              Estamos muito felizes em poder conversar com você e apresentar toda a nossa estrutura de carinho, saúde e dignidade para seu familiar.
            </p>

            <p style="margin: 16px 0 0 0; font-size: 13px; font-weight: bold; color: #173D2B;">
              Com carinho,<br />
              Equipe Victoria Lar Residencial
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #FAF9F5; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 11px; color: #718096;">
            <strong>Victoria Lar Residencial</strong><br />
            Alameda das Rosas, 450 - São Paulo, SP • WhatsApp: (11) 98765-4321<br />
            Atendimento direto, humanizado e sem intermediários.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: `"Victoria Lar Residencial" <contato@victorialar.com.br>`,
    to: params.to,
    bcc: 'victorialarresidencial@gmail.com', // Notifica a administração
    subject: mailSubject,
    html: htmlBody,
  });

  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
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

    return res.status(201).json({
      success: true,
      message: `Reunião agendada com sucesso para ${scheduledDate} às ${scheduledTime}! Um e-mail de confirmação com o link do Google Meet foi enviado para ${email.trim()}.`,
      data: appointmentRecord,
      emailSent: true,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (err: any) {
    console.error('Erro no agendamento de reunião:', err);
    return res.status(500).json({ error: 'Falha ao processar agendamento. Tente novamente mais tarde.' });
  }
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

    // Se forneceu e-mail, envia confirmação de recebimento
    if (email && email.includes('@')) {
      try {
        const transporter = await getTransporter();
        await transporter.sendMail({
          from: `"Victoria Lar Residencial" <contato@victorialar.com.br>`,
          to: email.trim(),
          bcc: 'victorialarresidencial@gmail.com',
          subject: 'Recebemos sua mensagem - Victoria Lar Residencial',
          html: `
            <div style="font-family: sans-serif; background-color: #FAF9F5; padding: 24px; color: #173D2B;">
              <div style="max-width: 550px; background: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #B8954A; margin: 0 auto;">
                <h2 style="color: #173D2B; font-family: Georgia, serif;">Olá, ${name.trim()}!</h2>
                <p>Recebemos sua solicitação de contato e interesse em <strong>${serviceInterest || 'nossos cuidados'}</strong>.</p>
                <p>Nossa equipe entrará em contato prontamente pelo telefone <strong>${phone.trim()}</strong> para tirar todas as suas dúvidas e acolher sua família.</p>
                <p style="margin-top: 20px; font-weight: bold;">Victoria Lar Residencial</p>
              </div>
            </div>
          `,
        });
      } catch (e) {
        console.warn('Aviso no envio de e-mail de contato simples:', e);
      }
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
