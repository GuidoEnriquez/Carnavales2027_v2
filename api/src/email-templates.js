const BRAND_COLOR = "#1a2a3a";
const ACCENT_COLOR = "#e0b94a";
const BRAND_NAME = "Carnavales 2027";

function wrap({ title, preheader, children }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${BRAND_COLOR};padding:24px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">${BRAND_NAME}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px 16px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;text-align:center;">${title}</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#555555;text-align:center;line-height:1.5;">${preheader}</p>
              ${children}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #eef1f5;">
              <p style="margin:0;font-size:12px;color:#999999;text-align:center;line-height:1.5;">
                Si no solicitaste este mensaje, puedes ignorarlo de forma segura.<br/>
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpEmail({ otp }) {
  return wrap({
    title: "Código de verificación",
    preheader: "Utiliza el siguiente código para completar tu inicio de sesión.",
    children: `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
        <tr>
          <td align="center" style="padding:20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};font-family:'Courier New',monospace;">${otp}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:14px;color:#666666;text-align:center;line-height:1.5;">
        Este código expira en <strong>5 minutos</strong>.
      </p>
    `,
  });
}

