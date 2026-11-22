import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentAttempt, PaymentAttemptSchema } from './payment-attempt.schema';
import { PAYMENT_ATTEMPT_AUDIT_PORT } from './payment-attempts.port';
import { PaymentAttemptsService } from './payment-attempts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PaymentAttempt.name, schema: PaymentAttemptSchema }]),
  ],
  providers: [
    PaymentAttemptsService,
    { provide: PAYMENT_ATTEMPT_AUDIT_PORT, useExisting: PaymentAttemptsService },
  ],
  exports: [PAYMENT_ATTEMPT_AUDIT_PORT],
})
export class PaymentAttemptsModule {}
