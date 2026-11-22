import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';

/**
 * Hosted-checkout bridge for Flouci. Routes live under the global `/api` prefix:
 *   GET /api/payments/flouci/checkout?orderId=  → 302 to the Flouci payment page
 *   GET /api/payments/flouci/success|fail        → verify, then bounce back
 * The customer app opens `checkout` in a WebView and watches the URL for the
 * `payments/flouci/success|fail` segments; web clients use `PAYMENT_RETURN_URL`.
 */
@Controller('payments/flouci')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('checkout')
  async checkout(@Query('orderId') orderId: string, @Res() res: Response): Promise<void> {
    if (!orderId) {
      res.status(400).send('Missing orderId');
      return;
    }
    try {
      const { link } = await this.paymentsService.initiateOrderPayment(orderId);
      res.redirect(302, link);
    } catch {
      res.redirect(302, this.returnUrl(orderId, 'fail'));
    }
  }

  @Get('success')
  async success(@Query('orderId') orderId: string, @Res() res: Response): Promise<void> {
    let ok = false;
    try {
      const result = await this.paymentsService.confirmOrderPayment(orderId);
      ok = result.status === 'SUCCESS';
    } catch {
      ok = false;
    }
    res.redirect(302, this.returnUrl(orderId, ok ? 'success' : 'fail'));
  }

  @Get('fail')
  fail(@Query('orderId') orderId: string, @Res() res: Response): void {
    res.redirect(302, this.returnUrl(orderId, 'fail'));
  }

  /** Wallet top-up: Flouci calls this on success → verify + credit wallet → done page. */
  @Get('topup-success')
  async topUpSuccess(@Query('sessionId') sessionId: string, @Res() res: Response): Promise<void> {
    let ok = false;
    try {
      const result = await this.paymentsService.confirmWalletTopUp(sessionId);
      ok = result.status === 'SUCCESS';
    } catch {
      ok = false;
    }
    const base = this.paymentsService.publicApiBase();
    res.redirect(302, `${base}/payments/flouci/done?status=${ok ? 'success' : 'fail'}&type=topup`);
  }

  @Get('topup-fail')
  topUpFail(@Res() res: Response): void {
    const base = this.paymentsService.publicApiBase();
    res.redirect(302, `${base}/payments/flouci/done?status=fail&type=topup`);
  }

  /** Terminal page the mobile WebView lands on; the app detects the URL/status. */
  @Get('done')
  done(@Query('status') status: string, @Res() res: Response): void {
    const ok = status === 'success';
    res
      .status(200)
      .type('html')
      .send(
        `<!doctype html><html><head><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>Paiement</title></head>` +
          `<body style="font-family:sans-serif;text-align:center;padding-top:48px">` +
          `<h2>${ok ? '✅ Paiement réussi' : '❌ Paiement échoué'}</h2>` +
          `<p>${ok ? 'Vous pouvez revenir à l’application.' : 'Veuillez réessayer.'}</p>` +
          `</body></html>`,
      );
  }

  private returnUrl(orderId: string, outcome: 'success' | 'fail'): string {
    const webReturn = this.paymentsService.webReturnUrl();
    if (webReturn) {
      const sep = webReturn.includes('?') ? '&' : '?';
      return `${webReturn}${sep}orderId=${encodeURIComponent(orderId)}&status=${outcome}`;
    }
    const base = this.paymentsService.publicApiBase();
    return `${base}/payments/flouci/done?orderId=${encodeURIComponent(orderId)}&status=${outcome}`;
  }
}
