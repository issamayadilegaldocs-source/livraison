import { bootstrapApi } from './common/bootstrap-api';
import { apiConfig } from './common/api.config';
import { AppModule } from './app.module';

void bootstrapApi(AppModule, apiConfig);
